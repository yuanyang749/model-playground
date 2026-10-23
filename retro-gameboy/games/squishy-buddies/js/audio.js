/* ==========================================================================
   Squishy Buddies 2006 - Web Audio 8-Bit Chiptune Synthesizer
   Bouncy, Plucky, Watery Sound Effects & Pentatonic BGM
   ========================================================================== */

class SquishyAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'square', duration = 0.1, gainVal = 0.1, freqRamp = null) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqRamp) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqRamp), now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  // Jump Boing (Frequency upward sweep)
  playJump() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(220, 'sine', 0.18, 0.14, 520);
  }

  // Soft Land Duang (Damped low thump)
  playLand() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(160, 'triangle', 0.12, 0.16, 60);
  }

  // Squishy Slide Swoosh (Glide whoosh sound)
  playSlide() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(320, 'triangle', 0.16, 0.14, 180);
  }

  // Spit Bubble: Pew-Plop!
  playSpit() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(660, 'sine', 0.12, 0.15, 1200);
  }

  // Bubble Pop: Crisp White Noise + High Ping
  playPop() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(980, 'triangle', 0.08, 0.15, 120);

    // Filtered noise pop
    try {
      const bufSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  // Leader Switch: Sparkle Arpeggio
  playSwitch() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.08, 0.08);
      }, idx * 35);
    });
  }

  // Dew Collected Chime
  playDew() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(880, 'sine', 0.1, 0.1, 1320);
    setTimeout(() => this.playTone(1320, 'sine', 0.15, 0.1, 1760), 70);
  }

  // Room Clear Victory Fanfare
  playRoomClear() {
    if (!this.enabled || !this.ctx) return;
    const melody = [
      { f: 523, d: 0.12 }, { f: 659, d: 0.12 }, { f: 783, d: 0.12 },
      { f: 1046, d: 0.25 }, { f: 880, d: 0.15 }, { f: 1046, d: 0.4 }
    ];
    let offset = 0;
    melody.forEach(m => {
      setTimeout(() => {
        this.playTone(m.f, 'triangle', m.d, 0.14);
      }, offset);
      offset += m.d * 1000 + 40;
    });
  }

  // Boss Menacing Roar
  playBossRoar() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(180, 'sawtooth', 0.28, 0.18, 55);
  }

  // Boss Impact Hit
  playBossHit() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(140, 'square', 0.15, 0.2, 40);
    this.playPop();
  }

  // Boss Heavy Ground Stomp Boom
  playBossStomp() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(95, 'triangle', 0.22, 0.22, 25);
    this.playLand();
  }

  // Cheerful Bubble Pop Chiptune BGM
  startBgm() {
    if (!this.enabled || this.bgmPlaying || !this.ctx) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;

    // Sweet pentatonic bouncy melody
    const notes = [
      523.25, 0, 659.25, 523.25, 783.99, 0, 659.25, 0,
      880.00, 0, 783.99, 659.25, 523.25, 0, 587.33, 0,
      659.25, 0, 587.33, 523.25, 440.00, 0, 523.25, 0,
      587.33, 0, 659.25, 783.99, 1046.5, 0, 0, 0
    ];

    const playNext = () => {
      if (!this.bgmPlaying) return;
      const freq = notes[this.bgmStep];
      if (freq > 0) {
        this.playTone(freq, 'sine', 0.14, 0.035);
        // Bass accompaniment on alternate beats
        if (this.bgmStep % 2 === 0) {
          this.playTone(freq / 2, 'triangle', 0.12, 0.025);
        }
      }
      this.bgmStep = (this.bgmStep + 1) % notes.length;
      this.bgmTimer = setTimeout(playNext, 160);
    };

    playNext();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopBgm();
    else if (this.enabled) this.startBgm();
    return this.enabled;
  }
}

window.squishyAudio = new SquishyAudioEngine();
