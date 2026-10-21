/**
 * 《隔代夺蛋：2026》高燃街机多巴胺合成器与鼓机引擎 (High-Energy Arcade Drum & Synth Engine)
 * 纯 Web Audio API 实时合成：
 * - 四四拍强劲电子底鼓 (Punchy Kick) + 清脆军鼓 (Noise Snare) + 疾走高帽镲片 (Hi-Hat)
 * - 双振荡器失真超锯齿波 (Detuned SuperSaw) 高燃洗脑主旋律 + 八度跳跃重低音 (Octave Sub-Bass)
 * - 街机金币三连琶音、激光撕裂音、涡轮蓄力重击与大满贯和弦礼花音效
 */

class DopamineAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.noiseBuffer = null;

    this.muted = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bpm = 142;
    this.isPlayingBgm = false;
    this.intensity = 1; // 1: 普通高燃, 2: FEVER / 终局狂暴

    // 多巴胺大调五声+七声爬升音阶 (C4 -> G6)
    this.comboScale = [
      261.63, 293.66, 329.63, 392.00, 440.00,
      523.25, 587.33, 659.25, 783.99, 880.00,
      1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00
    ];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // 动态压缩器：让鼓点与合成器紧凑饱满、充满街机压迫感且不破音
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // 预生成白噪音 Buffer 供军鼓、镲片与爆炸特效使用
      this.createNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else {
      this.init();
    }
    return this.muted;
  }

  /**
   * 合成强劲电子底鼓 (Punchy Arcade Kick)
   */
  triggerKick(time, volume = 0.75) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);
    osc.frequency.exponentialRampToValueAtTime(28, time + 0.18);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  /**
   * 合成炸裂军鼓 (Crisp Arcade Snare)
   */
  triggerSnare(time, volume = 0.42) {
    if (!this.ctx || !this.noiseBuffer) return;

    // 噪音层
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, time);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(volume, time);
    nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + 0.15);

    // 瞬态敲击层
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.07);

    oGain.gain.setValueAtTime(volume * 0.8, time);
    oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  /**
   * 合成疾走金属高帽镲片 (Metallic Hi-Hat)
   */
  triggerHiHat(time, open = false, volume = 0.22) {
    if (!this.ctx || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const dur = open ? 0.14 : 0.045;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  /**
   * 合成双振荡器失真超锯齿主音 (Detuned SuperSaw Lead)
   */
  triggerSuperSawLead(time, freq, duration = 0.13, volume = 0.22) {
    if (!this.ctx) return;

    const detunes = [-8, 8];
    detunes.forEach((det) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(det, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.5, time);
      filter.Q.setValueAtTime(3.5, time);

      gain.gain.setValueAtTime(volume * 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + duration + 0.01);
    });
  }

  /**
   * 接住好蛋：高燃阶梯升调 + 街机金币三连快琶音 (Hyper Coin Arpeggio)
   */
  playPickup(combo = 1, isFever = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const idx = Math.min(Math.max(0, combo - 1), this.comboScale.length - 1);
    const rootFreq = this.comboScale[idx] * (isFever ? 1.2 : 1.0);

    // 三音极速上行琶音 (Root -> Major 3rd -> Perfect 5th -> Octave)
    const arpMultipliers = [1, 1.25, 1.5, 2.0];
    arpMultipliers.forEach((mult, i) => {
      const t = now + i * 0.032;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i === 3 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(rootFreq * mult, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });

    // 叠加一记清脆底鼓增强肉感冲击
    this.triggerKick(now, 0.45);
  }

  /**
   * 踩中陷阱/假按钮：高能警报蜂鸣 + 电击爆破低音
   */
  playTrap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 失真下潜滑音
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.linearRampToValueAtTime(55, now + 0.32);
    osc2.frequency.setValueAtTime(305, now);
    osc2.frequency.linearRampToValueAtTime(48, now + 0.32);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);

    // 叠加触电白噪音冲击
    this.triggerSnare(now, 0.65);
  }

  /**
   * 手撕流氓弹窗：激光轰爆音 + 清脆碎裂声
   */
  playPopupClose() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.triggerSnare(now, 0.55);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.11);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Stage 3 疯狂连点：重拳涡轮增压打击音 (Turbo Combo Punch)
   */
  playMashHit(progressRatio = 0.5) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.triggerKick(now, 0.65);
    this.triggerSnare(now, 0.35);

    const baseFreq = 260 + progressRatio * 920;
    this.triggerSuperSawLead(now, baseFreq, 0.09, 0.38);
    this.triggerSuperSawLead(now + 0.03, baseFreq * 1.5, 0.09, 0.32);
  }

  /**
   * 触发 DOPAMINE FEVER / 破壁大满贯：辉煌铜管和弦 + 礼花爆炸
   */
  playFeverFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.triggerKick(now, 0.85);
    this.triggerSnare(now + 0.08, 0.6);

    // 高燃大三和弦连续冲锋 (C5 -> E5 -> G5 -> C6 + 和声)
    const chordSeq = [
      { f: 523.25, t: 0, d: 0.12 },
      { f: 659.25, t: 0.07, d: 0.12 },
      { f: 783.99, t: 0.14, d: 0.12 },
      { f: 1046.50, t: 0.21, d: 0.42 },
      { f: 1318.51, t: 0.21, d: 0.42 }
    ];

    chordSeq.forEach((n) => {
      this.triggerSuperSawLead(now + n.t, n.f, n.d, 0.36);
    });
  }

  /**
   * 开启 16-Step 高燃街机鼓机与双时空电音合成器 BGM
   * 融合：强劲四四拍底鼓 + 反拍军鼓镲片 + 八度滚奏 Bassline + 魔性洗脑五声电音 Riff
   */
  startBGM(bpm = 145) {
    this.bpm = bpm;
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.stopBGM();
    this.isPlayingBgm = true;
    // 16分音符步进时长
    const sixteenthMs = (60 / this.bpm / 4) * 1000;

    // 16步高燃旋律音序 (C大调/A小调疾走街机风，0代表休止)
    const leadPattern = [
      523.25, 0, 659.25, 783.99,
      880.00, 783.99, 659.25, 523.25,
      587.33, 659.25, 783.99, 880.00,
      1046.50, 880.00, 783.99, 659.25
    ];

    // 16步八度跳跃赛博 Bassline
    const bassPattern = [
      130.81, 261.63, 130.81, 261.63,
      164.81, 329.63, 164.81, 329.63,
      146.83, 293.66, 146.83, 293.66,
      196.00, 392.00, 220.00, 440.00
    ];

    this.bgmTimer = setInterval(() => {
      if (this.muted || !this.ctx || !this.isPlayingBgm) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % 16;

      // 1. 鼓组音序 (Kick on 0, 4, 8, 12 + 加花; Snare on 4, 12; Hi-Hat 疾走)
      if (step % 4 === 0 || step === 14) {
        this.triggerKick(now, 0.55);
      }
      if (step === 4 || step === 12) {
        this.triggerSnare(now, 0.34);
      }
      this.triggerHiHat(now, step % 4 === 2, step % 2 === 0 ? 0.18 : 0.1);

      // 2. 赛博跳跃重低音 Bass
      const bFreq = bassPattern[step];
      if (bFreq) {
        const bOsc = this.ctx.createOscillator();
        const bFilter = this.ctx.createBiquadFilter();
        const bGain = this.ctx.createGain();

        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(bFreq, now);

        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(680, now);

        bGain.gain.setValueAtTime(0.22, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        bOsc.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(this.masterGain);
        bOsc.start(now);
        bOsc.stop(now + 0.12);
      }

      // 3. 高燃洗脑双锯齿波主旋律
      const lFreq = leadPattern[step];
      if (lFreq > 0) {
        this.triggerSuperSawLead(now, lFreq, 0.11, 0.2);
      }

      this.bgmStep++;
    }, sixteenthMs);
  }

  stopBGM() {
    this.isPlayingBgm = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const audio = new DopamineAudioEngine();
