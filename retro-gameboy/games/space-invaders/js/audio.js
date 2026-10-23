/* ==========================================================================
   Space Invaders Chiptune Audio Synthesizer (Zero External Assets)
   ========================================================================== */

class InvadersSound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.marchNotes = [174.61, 164.81, 155.56, 146.83]; // Iconic 4-step descending bass
    this.ufoOsc = null;
    this.ufoGain = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  // Iconic 4-beat march sound
  playMarch(step = 0) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freq = this.marchNotes[step % 4];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.06);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Player Laser Shot (High frequency sweep)
  playShoot() {
    if (!this.enabled || !this.ctx) return;
    this.vibrate(10);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Invader Death Explosion
  playInvaderHit() {
    if (!this.enabled || !this.ctx) return;
    this.vibrate(18);
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(180, now + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Player Tank Destroyed Explosion
  playPlayerHit() {
    if (!this.enabled || !this.ctx) return;
    this.vibrate([40, 30, 60]);
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.38;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.linearRampToValueAtTime(60, now + 0.38);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Mystery UFO Warble (Continuous loop)
  startUfo() {
    if (!this.enabled || !this.ctx || this.ufoOsc) return;
    try {
      const now = this.ctx.currentTime;
      this.ufoOsc = this.ctx.createOscillator();
      this.ufoGain = this.ctx.createGain();

      this.ufoOsc.type = 'sawtooth';
      this.ufoOsc.frequency.setValueAtTime(400, now);

      // Low frequency modulation (LFO) for warble
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(5.5, now); // 5.5 Hz vibrato
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(70, now);
      lfo.connect(this.ufoOsc.frequency);
      lfo.start(now);

      this.ufoGain.gain.setValueAtTime(0.12, now);
      this.ufoOsc.connect(this.ufoGain);
      this.ufoGain.connect(this.ctx.destination);

      this.ufoOsc.start(now);
    } catch (e) {}
  }

  stopUfo() {
    if (this.ufoOsc) {
      try {
        this.ufoOsc.stop();
        this.ufoOsc.disconnect();
      } catch (e) {}
      this.ufoOsc = null;
      this.ufoGain = null;
    }
  }

  // UFO Shot Down
  playUfoHit() {
    this.stopUfo();
    if (!this.enabled || !this.ctx) return;
    this.vibrate([20, 20, 30]);
    const notes = [440, 554, 659, 880, 1108];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.18, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0, now + idx * 0.04 + 0.038);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.04);
    });
  }

  // Base / Shield Impact
  playShieldHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

const invadersSound = new InvadersSound();
