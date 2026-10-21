// 音频引擎：FM 合成音色 + 程序化混响 + 乒乓延迟 + 恒星底噪 + 录音

import { clamp } from './music.js';

/** 生成混响脉冲：带通指数衰减噪声，且高频衰减得更快（更像真实空间） */
function impulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (0.85 - 0.7 * t);
      const fadeIn = Math.min(1, i / (rate * 0.015));
      d[i] = lp * Math.pow(1 - t, decay) * fadeIn;
    }
  }
  return buf;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.timbre = 'crystal';
    this.recorder = null;
  }

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    const gain = (v = 1) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };

    this.master = gain(0.9);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.recordDest = ctx.createMediaStreamDestination();
    this.master.connect(comp);
    comp.connect(ctx.destination);
    comp.connect(this.analyser);
    comp.connect(this.recordDest);

    // 三条总线：干声 / 混响 / 延迟
    this.dryBus = gain(0.8);
    this.dryBus.connect(this.master);

    this.verbBus = gain(0.45);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 5, 2.4);
    this.verbBus.connect(verb);
    verb.connect(this.master);

    this.delayBus = gain(0.2);
    const dL = (this.dL = ctx.createDelay(3));
    const dR = (this.dR = ctx.createDelay(3));
    const fb = gain(0.38);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    const pL = ctx.createStereoPanner();
    const pR = ctx.createStereoPanner();
    pL.pan.value = -0.7;
    pR.pan.value = 0.7;
    this.delayBus.connect(dL);
    dL.connect(dR);
    dR.connect(tone);
    tone.connect(fb);
    fb.connect(dL);
    dL.connect(pL);
    dR.connect(pR);
    for (const p of [pL, pR]) {
      p.connect(this.master);
      p.connect(this.verbBus);
    }

    this.wave = new Float32Array(this.analyser.fftSize);
    this.buildDrone();
    this.ready = true;
  }

  buildDrone() {
    const ctx = this.ctx;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    lp.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoDepth.gain.value = 240;
    lfo.connect(lfoDepth).connect(lp.frequency);
    lfo.start();
    this.droneOsc = [-7, 7, 0].map((cents, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.detune.value = cents;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.droneGain.connect(this.verbBus);
  }

  setDroneRoot(freq) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.droneOsc[0].frequency.setTargetAtTime(freq, t, 0.4);
    this.droneOsc[1].frequency.setTargetAtTime(freq, t, 0.4);
    this.droneOsc[2].frequency.setTargetAtTime(freq / 2, t, 0.4);
  }

  setDrone(on) {
    if (!this.ready) return;
    this.droneGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.8);
  }

  setTempo(bpm) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dotted8 = (60 / bpm) * 0.75;
    this.dL.delayTime.setTargetAtTime(dotted8, t, 0.1);
    this.dR.delayTime.setTargetAtTime(dotted8, t, 0.1);
  }

  setReverb(v) {
    if (!this.ready) return;
    this.verbBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  /** 演奏一个音。size 为行星质量（0.6–3），越大越响越长 */
  note({ time, freq, size = 1, pan = 0, sub = false, gain = 0.2 }) {
    const ctx = this.ctx;
    const t = Math.max(time, ctx.currentTime + 0.005);
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    out.connect(panner);
    panner.connect(this.dryBus);
    panner.connect(this.verbBus);
    panner.connect(this.delayBus);

    const oscs = [];
    const osc = (type, f) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      oscs.push(o);
      return o;
    };
    const env = (g, from, to, t1, t2) => {
      g.gain.setValueAtTime(from, t1);
      g.gain.exponentialRampToValueAtTime(to, t2);
      return g;
    };
    const amp = gain * (0.5 + size * 0.28);
    let dur;
    let attack = 0.003;

    if (this.timbre === 'kalimba') {
      dur = 1.3 + size * 0.4;
      const c = osc('sine', freq);
      const m = osc('sine', freq * 2);
      m.connect(env(ctx.createGain(), freq * 1.2, 1, t, t + 0.25)).connect(c.frequency);
      c.connect(out);
      const tine = osc('sine', freq * 5.95);
      tine.connect(env(ctx.createGain(), 0.25, 0.0001, t, t + 0.12)).connect(out);
    } else if (this.timbre === 'glass') {
      dur = 3.2 + size * 0.8;
      attack = 0.08;
      const c = osc('sine', freq);
      const h2 = osc('sine', freq * 2);
      const h3 = osc('sine', freq * 3.01);
      const lfo = osc('sine', 4.6);
      const depth = ctx.createGain();
      depth.gain.value = freq * 0.004;
      lfo.connect(depth);
      depth.connect(c.frequency);
      depth.connect(h2.frequency);
      c.connect(out);
      const g2 = ctx.createGain();
      g2.gain.value = 0.18;
      h2.connect(g2).connect(out);
      const g3 = ctx.createGain();
      g3.gain.value = 0.06;
      h3.connect(g3).connect(out);
    } else {
      // 水晶钟：非整数比 FM，产生钟铃般的非谐泛音
      dur = 2.6 + size * 0.9;
      const c = osc('sine', freq);
      const m = osc('sine', freq * 3.5);
      const index = freq * 2.2 * (0.6 + size * 0.2);
      m.connect(env(ctx.createGain(), index, freq * 0.02, t, t + dur * 0.5)).connect(c.frequency);
      c.connect(out);
      const p2 = osc('sine', freq * 2);
      p2.connect(env(ctx.createGain(), 0.12, 0.0001, t, t + 0.9)).connect(out);
    }

    if (sub) {
      const s = osc('sine', freq / 2);
      const sg = ctx.createGain();
      sg.gain.value = 0.55;
      s.connect(sg).connect(out);
    }

    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(amp, t + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const o of oscs) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    oscs[0].onended = () => {
      out.disconnect();
      panner.disconnect();
    };
  }

  waveform() {
    if (!this.ready) return null;
    this.analyser.getFloatTimeDomainData(this.wave);
    return this.wave;
  }

  get recording() {
    return !!this.recorder;
  }

  startRecording() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mimeType = types.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    this.chunks = [];
    this.recorder = new MediaRecorder(this.recordDest.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start();
  }

  stopRecording() {
    return new Promise((resolve) => {
      const r = this.recorder;
      r.onstop = () => resolve(new Blob(this.chunks, { type: r.mimeType || 'audio/webm' }));
      r.stop();
      this.recorder = null;
    });
  }
}
