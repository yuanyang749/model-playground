// 程序化合成音效（无音频文件）。传入 pos 时按听者位置做距离衰减与立体声定位

import * as THREE from 'three';

const tmp = new THREE.Vector3();

export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.listenerPos = new THREE.Vector3();
    this.listenerRight = new THREE.Vector3(1, 0, 0);
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setListener(pos, right) {
    this.listenerPos.copy(pos);
    this.listenerRight.copy(right);
  }

  out(pos, vol) {
    const ctx = this.ctx;
    let gain = vol;
    let pan = 0;
    if (pos) {
      const d = pos.distanceTo(this.listenerPos);
      gain *= 1 / (1 + d * 0.06 + d * d * 0.003);
      if (gain < 0.008) return null;
      if (d > 0.01) pan = tmp.subVectors(pos, this.listenerPos).normalize().dot(this.listenerRight) * 0.8;
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.master);
    return g;
  }

  noise(out, t, dur, { type = 'lowpass', f0 = 1000, f1 = f0, q = 1, gain = 1, attack = 0.002 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  tone(out, t, dur, { type = 'sine', f0 = 440, f1 = f0, gain = 1, attack = 0.003 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const out = this.out(pos, vol);
    if (!out) return;
    const t = this.ctx.currentTime;
    const r = 0.94 + Math.random() * 0.12; // 轻微随机音高，避免机械感
    switch (name) {
      case 'rifle':
        this.noise(out, t, 0.14, { type: 'bandpass', f0: 2400 * r, f1: 500, q: 0.8, gain: 0.9 });
        this.tone(out, t, 0.09, { type: 'square', f0: 170 * r, f1: 50, gain: 0.35 });
        break;
      case 'shotgun':
        this.noise(out, t, 0.4, { f0: 3500, f1: 300, gain: 1.2 });
        this.tone(out, t, 0.25, { f0: 110 * r, f1: 35, gain: 0.9 });
        this.noise(out, t + 0.35, 0.05, { type: 'highpass', f0: 3000, gain: 0.3 });
        this.noise(out, t + 0.5, 0.05, { type: 'highpass', f0: 2500, gain: 0.3 });
        break;
      case 'rocket':
        this.noise(out, t, 0.6, { type: 'bandpass', f0: 500, f1: 2200, q: 1.5, gain: 0.8, attack: 0.04 });
        this.tone(out, t, 0.3, { type: 'sawtooth', f0: 90, f1: 40, gain: 0.3 });
        break;
      case 'explosion':
        this.noise(out, t, 1.6, { f0: 1600 * r, f1: 120, gain: 1.6, attack: 0.005 });
        this.tone(out, t, 0.9, { f0: 70 * r, f1: 25, gain: 1.3 });
        this.noise(out, t + 0.05, 0.6, { type: 'bandpass', f0: 600, f1: 200, gain: 0.5 });
        break;
      case 'hit':
        this.tone(out, t, 0.05, { type: 'square', f0: 1400, f1: 1200, gain: 0.12 });
        break;
      case 'headshot':
        this.tone(out, t, 0.18, { f0: 1900, gain: 0.3 });
        this.tone(out, t + 0.03, 0.2, { f0: 2850, gain: 0.18 });
        break;
      case 'kill':
        this.tone(out, t, 0.12, { type: 'triangle', f0: 880, gain: 0.25 });
        this.tone(out, t + 0.07, 0.18, { type: 'triangle', f0: 1320, gain: 0.25 });
        break;
      case 'grunt':
        this.tone(out, t, 0.16, { type: 'square', f0: 260 * r, f1: 150, gain: 0.18 });
        this.noise(out, t, 0.1, { type: 'bandpass', f0: 700, gain: 0.25 });
        break;
      case 'die':
        this.tone(out, t, 0.45, { type: 'sawtooth', f0: 240 * r, f1: 55, gain: 0.25 });
        this.noise(out, t, 0.3, { f0: 1200, f1: 200, gain: 0.4 });
        break;
      case 'hurt':
        this.tone(out, t, 0.22, { type: 'sawtooth', f0: 190, f1: 90, gain: 0.35 });
        this.noise(out, t, 0.12, { f0: 900, gain: 0.4 });
        break;
      case 'step':
        this.noise(out, t, 0.07, { type: 'bandpass', f0: 500 * r, f1: 300, q: 1.2, gain: 0.22 });
        break;
      case 'stepStone':
        this.noise(out, t, 0.06, { type: 'bandpass', f0: 1800 * r, f1: 900, q: 2, gain: 0.18 });
        break;
      case 'land':
        this.noise(out, t, 0.12, { f0: 700, f1: 200, gain: 0.45 });
        break;
      case 'break':
        this.noise(out, t, 0.2, { type: 'bandpass', f0: 900 * r, f1: 300, q: 0.9, gain: 0.7 });
        this.noise(out, t + 0.04, 0.12, { type: 'highpass', f0: 2000, gain: 0.2 });
        break;
      case 'dig':
        this.noise(out, t, 0.08, { type: 'bandpass', f0: 1200 * r, f1: 600, q: 1.5, gain: 0.35 });
        break;
      case 'place':
        this.tone(out, t, 0.09, { f0: 220 * r, f1: 140, gain: 0.5 });
        this.noise(out, t, 0.06, { f0: 1500, gain: 0.3 });
        break;
      case 'swing':
        this.noise(out, t, 0.15, { type: 'bandpass', f0: 600, f1: 1800, q: 2, gain: 0.3, attack: 0.03 });
        break;
      case 'pickup':
        [660, 880, 1320].forEach((f, i) => this.tone(out, t + i * 0.06, 0.14, { type: 'triangle', f0: f, gain: 0.22 }));
        break;
      case 'reload':
        this.noise(out, t, 0.04, { type: 'highpass', f0: 2500, gain: 0.4 });
        this.noise(out, t + 0.45, 0.05, { type: 'highpass', f0: 1800, gain: 0.45 });
        this.tone(out, t + 0.45, 0.04, { type: 'square', f0: 600, gain: 0.08 });
        break;
      case 'empty':
        this.noise(out, t, 0.03, { type: 'highpass', f0: 3000, gain: 0.3 });
        break;
      case 'equip':
        this.noise(out, t, 0.08, { type: 'highpass', f0: 2000, gain: 0.25 });
        break;
      case 'bow':
        this.tone(out, t, 0.12, { type: 'triangle', f0: 320, f1: 140, gain: 0.25 });
        this.noise(out, t, 0.2, { type: 'bandpass', f0: 1500, f1: 600, gain: 0.25 });
        break;
      case 'fuse':
        this.noise(out, t, 1.1, { type: 'highpass', f0: 3500, f1: 5000, gain: 0.35, attack: 0.1 });
        break;
      case 'slam':
        this.noise(out, t, 0.9, { f0: 600, f1: 60, gain: 1.4 });
        this.tone(out, t, 0.6, { f0: 55, f1: 28, gain: 1.2 });
        break;
      case 'wave':
        this.tone(out, t, 1.4, { type: 'sawtooth', f0: 110, f1: 104, gain: 0.22, attack: 0.15 });
        this.tone(out, t, 1.4, { type: 'sawtooth', f0: 165, f1: 158, gain: 0.16, attack: 0.15 });
        break;
      case 'roar':
        this.tone(out, t, 1.6, { type: 'sawtooth', f0: 75, f1: 40, gain: 0.5, attack: 0.1 });
        this.noise(out, t, 1.4, { type: 'bandpass', f0: 400, f1: 150, q: 2, gain: 0.7, attack: 0.1 });
        break;
      case 'clear':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(out, t + i * 0.09, 0.3, { type: 'triangle', f0: f, gain: 0.2 }));
        break;
    }
  }
}
