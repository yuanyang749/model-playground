/* ==========================================================================
   Tetris 1989 - Authentic Game Boy 8-Bit Chiptune Synthesizer
   Procedural Web Audio API Sound Effects & Korobeiniki (Type A Theme)
   ========================================================================== */

class TetrisAudio {
  constructor() {
    this.ctx = null;
    this.bgmPlaying = false;
    this.bgmMuted = false;
    this.sfxMuted = false;
    this.timer = null;
    this.stepIndex = 0;

    // Iconic Korobeiniki (Type A) Melody in [freq, 16th_note_duration_multipliers]
    // 1 step = 16th note (~140ms at ~110 BPM)
    const N = {
      REST: 0,
      A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
      GS4: 415.30, A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
      G5: 783.99, GS5: 830.61, A5: 880.00
    };

    // Melody: [Note, 16th note steps]
    this.melody = [
      // Phrase 1
      [N.E5, 4], [N.B4, 2], [N.C5, 2], [N.D5, 4], [N.C5, 2], [N.B4, 2],
      [N.A4, 4], [N.A4, 2], [N.C5, 2], [N.E5, 4], [N.D5, 2], [N.C5, 2],
      [N.B4, 6], [N.C5, 2], [N.D5, 4], [N.E5, 4],
      [N.C5, 4], [N.A4, 4], [N.A4, 4], [N.REST, 4],

      // Phrase 2
      [N.D5, 4], [N.F5, 2], [N.A5, 2], [N.G5, 4], [N.F5, 2], [N.E5, 2],
      [N.C5, 6], [N.E5, 2], [N.D5, 4], [N.C5, 2], [N.B4, 2],
      [N.B4, 2], [N.C5, 2], [N.D5, 4], [N.E5, 4], [N.C5, 4],
      [N.A4, 4], [N.A4, 4], [N.REST, 4],

      // Repeat with variation
      [N.E5, 4], [N.B4, 2], [N.C5, 2], [N.D5, 4], [N.C5, 2], [N.B4, 2],
      [N.A4, 4], [N.A4, 2], [N.C5, 2], [N.E5, 4], [N.D5, 2], [N.C5, 2],
      [N.B4, 6], [N.C5, 2], [N.D5, 4], [N.E5, 4],
      [N.C5, 4], [N.A4, 4], [N.A4, 4], [N.REST, 4],

      // Part B
      [N.E4, 8], [N.C4, 8], [N.D4, 8], [N.B3, 8],
      [N.C4, 8], [N.A3, 8], [N.GS3 || 207.65, 8], [N.B3, 8],
      [N.E4, 8], [N.C4, 8], [N.D4, 8], [N.B3, 8],
      [N.C4, 4], [N.E4, 4], [N.A4, 8], [N.GS4, 12], [N.REST, 4]
    ];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /* ================= Sound Effects (SFX) ================= */

  playMove() {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.03);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  playRotate() {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  playDrop() {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  playLineClear() {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        const start = this.ctx.currentTime + idx * 0.045;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.085);
      });
    } catch (e) {}
  }

  playTetrisClear() {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      // Fanfare: C5, G5, C6, E6
      const fanfare = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      fanfare.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        const start = this.ctx.currentTime + idx * 0.06;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch (e) {}
  }

  playGameOver() {
    if (this.sfxMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const sadNotes = [440, 392, 349.23, 293.66, 220, 164.81];
      sadNotes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        const start = this.ctx.currentTime + idx * 0.12;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      });
    } catch (e) {}
  }

  /* ================= Background Music (Korobeiniki) ================= */

  startBgm() {
    if (this.bgmMuted || this.bgmPlaying) return;
    this.init();
    if (!this.ctx) return;
    this.bgmPlaying = true;
    this.stepIndex = 0;
    this.scheduleNextNote();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  toggleBgm() {
    this.bgmMuted = !this.bgmMuted;
    if (this.bgmMuted) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
    return !this.bgmMuted;
  }

  scheduleNextNote() {
    if (!this.bgmPlaying || this.bgmMuted || !this.ctx) return;

    const [freq, durationSteps] = this.melody[this.stepIndex];
    const stepDurationMs = 135; // ~110 BPM 16th note
    const durationMs = durationSteps * stepDurationMs;

    if (freq > 0) {
      try {
        const now = this.ctx.currentTime;
        const durSec = (durationMs * 0.85) / 1000;

        // Lead Melody (Square wave with 25% style pulse emulation)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + durSec);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + durSec + 0.02);

        // Bass harmonic (1 octave down, triangle wave)
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(freq / 2, now);
        bassGain.gain.setValueAtTime(0.04, now);
        bassGain.gain.exponentialRampToValueAtTime(0.002, now + durSec);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + durSec + 0.02);
      } catch (e) {}
    }

    this.stepIndex = (this.stepIndex + 1) % this.melody.length;
    this.timer = setTimeout(() => {
      this.scheduleNextNote();
    }, durationMs);
  }
}

// Global instance for Tetris Game
window.tetrisAudio = new TetrisAudio();
