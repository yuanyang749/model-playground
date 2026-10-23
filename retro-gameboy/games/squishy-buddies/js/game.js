/* ==========================================================================
   Squishy Buddies 2006 - Main Game Engine, Canvas Renderer & Controller Bridge
   Chunky Pixel Visuals, Mochi Follower Train & Game Boy Console Bridge
   ========================================================================== */

class SquishyGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.width = CANVAS_W; // 320 (logical units; back-buffer is scaled up for crisp vectors)
    this.height = CANVAS_H; // 240
    this.renderScale = 0;
    this.layers = null;
    this.fxTime = 0;
    this.fx = [];
    this.resizeBackbuffer();
    window.addEventListener('resize', () => this.resizeBackbuffer());
    window.addEventListener('orientationchange', () => this.resizeBackbuffer());

    this.audio = window.squishyAudio;
    this.hapticsEnabled = 'vibrate' in navigator;

    // Game state
    this.state = 'TITLE'; // 'TITLE', 'PLAYING', 'PAUSED', 'ROOM_CLEAR', 'VICTORY', 'GAME_OVER'
    this.maxLives = 5;
    this.lives = 5;
    this.secret99Mode = false;
    this.secretHeartTapCount = 0;
    this.lastHeartTapTime = 0;
    this.secretBannerTimer = 0;
    this.invincibleTimer = 0;
    this.levelIndex = 0;
    this.currentLevel = null;
    this.grid = null;
    this.player = null;
    this.bubbles = [];
    this.dews = [];
    this.sludges = [];
    this.particles = [];

    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      a: false,
      b: false
    };

    this.lastTime = 0;
    this.stateTimer = 0;
    this.roomClearBannerTimer = 0;
    this.storySlideIndex = 0;
    this.storyTimer = 0;

    this.initControls();
    this.initGameBoyBridge();
    this.loadLevel(0);

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  vibrate(pattern) {
    if (this.hapticsEnabled) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  loadLevel(index) {
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    this.currentLevel = LEVELS[this.levelIndex];
    // Deep clone the 2D grid
    this.grid = this.currentLevel.grid.map(row => [...row]);

    // Init player
    this.player = new PlayerBuddy(this.currentLevel.playerStart.x, this.currentLevel.playerStart.y);

    // Init dews
    this.dews = this.currentLevel.dews.map(d => new DewDrop(d.x, d.y));

    // Init sludges
    this.sludges = this.currentLevel.sludges.map(s => new SludgeCreep(s.x, s.y, s.range));

    // Init boss if present in level
    if (this.currentLevel.boss) {
      this.boss = new SludgeBoss(this.currentLevel.boss.x, this.currentLevel.boss.y, this.currentLevel.boss.hp, {
        variant: this.currentLevel.boss.variant,
        name: this.currentLevel.boss.name
      });
    } else {
      this.boss = null;
    }
    this.sludgeProjectiles = [];
    this.sludgeShockwaves = [];
    this.screenShakeTimer = 0;

    this.bubbles = [];
    this.particles = [];
    this.fx = [];
    this.roomClearBannerTimer = 0;
    this.invincibleTimer = 0;
  }

  damagePlayer(respawnAtStart = false, knockVx = 0, knockVy = -120) {
    if (this.state !== 'PLAYING') return;

    if (respawnAtStart) {
      this.player.x = this.currentLevel.playerStart.x;
      this.player.y = this.currentLevel.playerStart.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.onHazard = false;
    } else {
      this.player.vx = knockVx;
      this.player.vy = knockVy;
    }

    if (this.invincibleTimer > 0) return;

    this.lives = Math.max(0, this.lives - 1);
    this.invincibleTimer = 1.4;
    this.screenShakeTimer = Math.max(this.screenShakeTimer || 0, 0.22);
    this.vibrate([40, 30, 50]);
    if (this.audio && this.audio.playPop) this.audio.playPop();
    this.spawnPopParticles(this.player.x, this.player.y, '#FF4D6D');

    if (this.lives <= 0) {
      this.state = 'GAME_OVER';
      this.invincibleTimer = 0;
      if (this.audio && this.audio.stopBgm) this.audio.stopBgm();
      this.vibrate([60, 40, 80, 40, 120]);
    }
  }

  startStory() {
    this.audio.init();
    this.audio.playSwitch();
    this.state = 'STORY';
    this.storySlideIndex = 0;
    this.storyTimer = 0;
    this.vibrate(12);
  }

  nextStorySlide() {
    if (this.storySlideIndex < 3) {
      this.storySlideIndex++;
      this.storyTimer = 0;
      this.audio.playSwitch();
      this.vibrate(10);
    } else {
      // Final slide: Press A to officially begin!
      this.startGame();
    }
  }

  prevStorySlide() {
    if (this.storySlideIndex > 0) {
      this.storySlideIndex--;
      this.storyTimer = 0;
      this.audio.playSwitch();
      this.vibrate(10);
    }
  }

  startGame() {
    this.audio.init();
    this.audio.startBgm();
    this.maxLives = this.secret99Mode ? 99 : 5;
    this.lives = this.maxLives;
    this.invincibleTimer = 0;
    this.loadLevel(0);
    this.state = 'PLAYING';
    this.vibrate([15, 30, 20]);
  }

  activateSecret99Lives() {
    this.secret99Mode = true;
    this.maxLives = 99;
    this.lives = 99;
    this.secretHeartTapCount = 0;
    this.secretBannerTimer = 2.4;
    if (this.audio && this.audio.playRoomClear) this.audio.playRoomClear();
    this.vibrate([25, 35, 25, 35, 70]);
    this.spawnDewBurst(124, 12);
    if (this.player) {
      this.spawnPopParticles(this.player.x, this.player.y, '#FFD454');
    }
  }

  handleHeartZoneTap(clientX, clientY) {
    let lx = clientX, ly = clientY;
    if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
      const rect = this.canvas.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        lx = ((clientX - rect.left) / rect.width) * this.width;
        ly = ((clientY - rect.top) / rect.height) * this.height;
      }
    }
    // Top center heart HUD zone: x in [60, 188], y in [0, 38]
    if (lx >= 60 && lx <= 188 && ly >= 0 && ly <= 38) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - this.lastHeartTapTime > 1500) {
        this.secretHeartTapCount = 1;
      } else {
        this.secretHeartTapCount++;
      }
      this.lastHeartTapTime = now;
      this.vibrate(10);
      if (this.audio && this.audio.playDew) this.audio.playDew();
      this.spawnPopParticles(124, 10, '#FF4D6D', false);

      if (this.secretHeartTapCount >= 5) {
        this.activateSecret99Lives();
      }
      return true;
    }
    return false;
  }

  togglePause() {
    const now = performance.now();
    if (this._lastPauseToggle && now - this._lastPauseToggle < 200) return;
    this._lastPauseToggle = now;

    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.audio.stopBgm();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.audio.startBgm();
    }
  }

  /* ================= Input Handling & Hardware Bridge ================= */

  initGameBoyBridge() {
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'GB_INPUT') return;
      this.audio.init();
      const { key, pressed } = event.data;

      if (this.state === 'TITLE') {
        if (pressed && (key === 'A' || key === 'START')) {
          this.startStory();
        }
        return;
      }

      if (this.state === 'STORY') {
        if (pressed) {
          if (key === 'A') {
            this.nextStorySlide();
          } else if (key === 'B') {
            this.prevStorySlide();
          } else if (key === 'START') {
            if (this.storySlideIndex < 3) {
              this.storySlideIndex = 3;
              this.storyTimer = 0;
              this.audio.playSwitch();
            } else {
              this.startGame();
            }
          }
        }
        return;
      }

      if (this.state === 'VICTORY' || this.state === 'GAME_OVER') {
        if (pressed && (key === 'A' || key === 'START')) {
          this.startGame();
        }
        return;
      }

      switch (key) {
        case 'LEFT':
          this.input.left = pressed;
          break;
        case 'RIGHT':
          this.input.right = pressed;
          break;
        case 'UP':
          this.input.up = pressed;
          break;
        case 'DOWN':
          this.input.down = pressed;
          break;
        case 'A':
          this.input.a = pressed;
          if (pressed && this.state === 'PLAYING') {
            this.player.jump(this.input);
            this.vibrate(10);
          }
          break;
        case 'B':
          this.input.b = pressed;
          if (pressed && this.state === 'PLAYING') {
            const b = this.player.spitBubble();
            if (b) {
              this.pushBubble(b);
              this.vibrate(8);
            }
          }
          break;
        case 'SELECT':
          if (pressed && this.state === 'PLAYING') {
            this.player.nextBuddy();
            this.audio.playSwitch();
            this.vibrate([10, 20, 10]);
            this.spawnSwitchSparkles();
          }
          break;
        case 'START':
          if (pressed) this.togglePause();
          break;
      }
    });
  }

  initControls() {
    // Canvas click / tap support for direct mobile interaction + 5-tap top heart zone secret 99 lives
    let lastTouchTapTime = 0;
    if (this.canvas && this.canvas.addEventListener) {
      this.canvas.addEventListener('touchstart', (e) => {
        if (!e.touches || !e.touches[0]) return;
        this.audio.init();
        const t = e.touches[0];
        if (this.handleHeartZoneTap(t.clientX, t.clientY)) {
          lastTouchTapTime = Date.now();
          if (e.preventDefault) e.preventDefault();
        }
      }, { passive: false });
    }

    this.canvas.addEventListener('click', (e) => {
      this.audio.init();
      if (Date.now() - lastTouchTapTime < 450) return;
      if (e && typeof e.clientX === 'number' && this.handleHeartZoneTap(e.clientX, e.clientY)) {
        return;
      }
      if (this.state === 'TITLE') {
        this.startStory();
      } else if (this.state === 'STORY') {
        this.nextStorySlide();
      } else if (this.state === 'VICTORY' || this.state === 'GAME_OVER') {
        this.startGame();
      }
    });

    // Keyboard support for standalone mode
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'Enter', 'Backspace'].includes(e.code) && e.preventDefault) {
        e.preventDefault();
      }
      this.audio.init();
      if (this.state === 'TITLE' && (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter')) {
        this.startStory();
        return;
      }
      if ((this.state === 'VICTORY' || this.state === 'GAME_OVER') && (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter')) {
        this.startGame();
        return;
      }
      if (this.state === 'STORY') {
        if (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter') {
          this.nextStorySlide();
          return;
        }
        if (e.code === 'KeyX' || e.code === 'Backspace') {
          this.prevStorySlide();
          return;
        }
      }
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.input.left = true; break;
        case 'ArrowRight': case 'KeyD': this.input.right = true; break;
        case 'ArrowDown': case 'KeyS': this.input.down = true; break;
        case 'ArrowUp': case 'KeyW': this.input.up = true; break;
        case 'KeyZ': case 'Space':
          this.input.a = true;
          if (this.state === 'PLAYING') this.player.jump(this.input);
          break;
        case 'KeyX': case 'KeyJ': case 'KeyK':
          this.input.b = true;
          if (this.state === 'PLAYING') {
            const b = this.player.spitBubble();
            if (b) this.pushBubble(b);
          }
          break;
        case 'ShiftLeft': case 'ShiftRight': case 'KeyC': case 'Tab':
          if (this.state === 'PLAYING') {
            this.player.nextBuddy();
            this.audio.playSwitch();
            this.spawnSwitchSparkles();
          }
          break;
        case 'Enter':
          if (this.state === 'STORY') this.nextStorySlide();
          else this.togglePause();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.input.left = false; break;
        case 'ArrowRight': case 'KeyD': this.input.right = false; break;
        case 'ArrowDown': case 'KeyS': this.input.down = false; break;
        case 'ArrowUp': case 'KeyW': this.input.up = false; break;
        case 'KeyZ': case 'Space': this.input.a = false; break;
        case 'KeyX': case 'KeyJ': case 'KeyK': this.input.b = false; break;
      }
    });

    // Touch controls for standalone deck
    const bindBtn = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.audio.init(); onDown(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { this.audio.init(); onDown(); });
      el.addEventListener('mouseup', (e) => { onUp(); });
    };

    bindBtn('btn-left', () => this.input.left = true, () => this.input.left = false);
    bindBtn('btn-right', () => this.input.right = true, () => this.input.right = false);
    bindBtn('btn-down', () => this.input.down = true, () => this.input.down = false);
    bindBtn('btn-up', () => this.input.up = true, () => this.input.up = false);
    bindBtn('btn-jump', () => {
      if (this.state === 'TITLE') this.startStory();
      else if (this.state === 'STORY') this.nextStorySlide();
      else if (this.state === 'VICTORY' || this.state === 'GAME_OVER') this.startGame();
      else if (this.state === 'PLAYING') this.player.jump(this.input);
      this.input.a = true;
    }, () => this.input.a = false);
    bindBtn('btn-spit', () => {
      if (this.state === 'STORY') this.prevStorySlide();
      else if (this.state === 'PLAYING') {
        const b = this.player.spitBubble();
        if (b) this.pushBubble(b);
      }
      this.input.b = true;
    }, () => this.input.b = false);
    bindBtn('btn-switch', () => {
      if (this.state === 'PLAYING') {
        this.player.nextBuddy();
        this.audio.playSwitch();
        this.spawnSwitchSparkles();
      }
    }, () => {});
    bindBtn('btn-pause', () => {
      if (this.state === 'TITLE') this.startStory();
      else if (this.state === 'STORY') {
        if (this.storySlideIndex < 3) this.storySlideIndex = 3;
        else this.startGame();
      } else if (this.state === 'VICTORY' || this.state === 'GAME_OVER') {
        this.startGame();
      } else {
        this.togglePause();
      }
    }, () => {});
    bindBtn('btn-sound', () => {
      const en = this.audio.toggleSound();
      const el = document.getElementById('btn-sound');
      if (el) el.textContent = `🔊 声音: ${en ? '开' : '关'}`;
    }, () => {});
  }

  spawnSwitchSparkles() {
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(this.player.x, this.player.y, this.player.type.color));
    }
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(this.player.x, this.player.y, '#FFFFFF', { kind: 'star', life: 0.45 + Math.random() * 0.2, radius: 2.4, gravity: -30 }));
    }
    this.fx.push(new FxRing(this.player.x, this.player.y, this.player.type.color, 24, 0.45, 2));
  }

  spawnPopParticles(x, y, color, ring = true) {
    for (let i = 0; i < 6; i++) {
      this.particles.push(new Particle(x, y, color));
    }
    for (let i = 0; i < 3; i++) {
      this.particles.push(new Particle(x, y, '#FFFFFF', { kind: 'spark', life: 0.26 + Math.random() * 0.14, radius: 1.6 }));
    }
    if (ring) this.fx.push(new FxRing(x, y, color, 15 + Math.random() * 5, 0.38, 1.8));
  }

  // Puffs of dust kicked up at the feet (takeoff, landing, footsteps, slides)
  spawnDust(x, y, count = 4, power = 1) {
    const col = this.player ? this.player.type.highlight : '#FFFFFF';
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      this.particles.push(new Particle(x + dir * Math.random() * 4, y - 1, col, {
        kind: 'dust',
        vx: dir * (14 + Math.random() * 34) * power,
        vy: -(4 + Math.random() * 14),
        life: 0.32 + Math.random() * 0.2,
        radius: 1.5 + Math.random() * 1.6,
        gravity: -6,
        drag: 4
      }));
    }
  }

  spawnDewBurst(x, y) {
    for (let i = 0; i < 7; i++) {
      this.particles.push(new Particle(x, y, i % 2 ? '#7FF0FF' : '#FFFFFF'));
    }
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(x, y, '#FFFFFF', { kind: 'star', life: 0.5 + Math.random() * 0.25, radius: 2.6, gravity: -24 }));
    }
    this.fx.push(new FxRing(x, y, '#7FF0FF', 20, 0.45, 2));
  }

  // Spit puff + a little ripple where the bubble is born
  pushBubble(b) {
    // A bubble spat straight into a wall must not be born inside the stone: slide it back out toward the buddy
    if (this.grid && this.player) {
      const blocked = (x, y) => { const t = Physics.getTileAt(this.grid, x, y); return t === T_SOLID || t === T_GATE; };
      for (let guard = 0; guard < 60 && blocked(b.x, b.y); guard++) {
        b.x += (this.player.x > b.x ? 1 : -1) * 0.75;
      }
    }
    this.bubbles.push(b);
    this.fx.push(new FxRing(b.x, b.y, b.buddyType.color, 13, 0.3, 1.6));
    for (let i = 0; i < 3; i++) {
      this.particles.push(new Particle(b.x, b.y, b.buddyType.highlight, {
        kind: 'dust', vx: b.vx * 0.2 + (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
        life: 0.28, radius: 1.4, gravity: 0, drag: 4
      }));
    }
  }

  // Boss slam: debris spray + ground ripples (called from SludgeBoss on landing)
  onBossLand(boss, groundY) {
    for (let i = 0; i < 12; i++) {
      const dir = i < 6 ? -1 : 1;
      this.particles.push(new Particle(boss.x + dir * (6 + Math.random() * 14), groundY - 2, i % 3 ? '#8D7BA8' : '#B98CFF', {
        vx: dir * (30 + Math.random() * 90), vy: -(30 + Math.random() * 80),
        life: 0.5 + Math.random() * 0.3, radius: 1.5 + Math.random() * 2, gravity: 300
      }));
    }
    this.fx.push(new FxRing(boss.x, groundY - 3, '#B98CFF', 66, 0.6, 2.4, 0.22));
    this.fx.push(new FxRing(boss.x, groundY - 3, '#FF3B6B', 48, 0.5, 1.8, 0.22));
  }

  // Cosmetic per-frame effects driven by the player's physical state (never affects gameplay)
  updatePlayerFx() {
    const p = this.player;
    const feetY = p.y + p.radius * (p.isCrouched ? 0.4 : 0.85);
    if (p.justJumped) {
      p.justJumped = false;
      this.spawnDust(p.x, feetY, 5, 0.7);
    }
    if (p.justLanded) {
      p.justLanded = false;
      const k = p.lastImpact;
      this.spawnDust(p.x, feetY, 3 + Math.round(k * 6), 0.6 + k);
      if (k > 0.35) this.fx.push(new FxRing(p.x, feetY - 1, p.type.highlight, 10 + k * 14, 0.32, 1.6, 0.3));
    }
    if (p.onGround && !p.isSliding && Math.abs(p.vx) > 25) {
      const step = Math.floor(p.walkCycle / Math.PI);
      if (step !== this._lastStep) {
        this._lastStep = step;
        this.spawnDust(p.x - p.facing * p.radius * 0.6, feetY, 1, 0.4);
      }
    }
  }

  /* ================= Update Logic ================= */

  update(dt) {
    if (this.state === 'STORY') {
      this.storyTimer += dt;
      return;
    }
    if (this.state !== 'PLAYING') return;

    // Screen shake & invincibility timers decay
    if (this.screenShakeTimer > 0) this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
    if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

    // 1. Update Player
    this.player.update(dt, this.input, this.grid, this.audio);
    this.updatePlayerFx();

    // Slide dust particles
    if (this.player.isSliding && Math.random() < 0.45) {
      this.spawnDust(
        this.player.x - this.player.facing * (this.player.radius * 0.8),
        this.player.y + this.player.radius * 0.4,
        1, 0.5
      );
    }

    // Hazard respawn check
    if (this.player.onHazard || this.player.y > CANVAS_H - 8) {
      this.damagePlayer(true, 0, 0);
      if (this.state !== 'PLAYING') return;
    }

    // 2. Update Bubbles
    for (let b of this.bubbles) {
      b.update(dt, this.grid, this.bubbles);

      // Purple CHAIN_POP bubble detonates on impact with cracked rocks (T_CRACKED)
      if (b.alive && b.type === 'CHAIN_POP') {
        const bCol = Math.floor(b.x / TILE_SIZE);
        const bRow = Math.floor(b.y / TILE_SIZE);
        let hitCracked = false;
        for (let r = Math.max(0, bRow - 1); r <= Math.min(GRID_ROWS - 1, bRow + 1); r++) {
          for (let c = Math.max(0, bCol - 1); c <= Math.min(GRID_COLS - 1, bCol + 1); c++) {
            if (this.grid[r][c] === T_CRACKED) {
              const cx = c * TILE_SIZE + 10;
              const cy = r * TILE_SIZE + 10;
              if (Math.hypot(b.x - cx, b.y - cy) < b.radius + 12) {
                hitCracked = true;
                break;
              }
            }
          }
          if (hitCracked) break;
        }
        if (hitCracked) {
          b.alive = false;
          this.audio.playPop();
          this.spawnPopParticles(b.x, b.y, b.buddyType.color);
          this.triggerChainPop(b.x, b.y);
          continue;
        }
      }

      // Player jump interaction on bubble
      if (b.alive) {
        const dist = Math.hypot(this.player.x - b.x, (this.player.y + this.player.radius * 0.7) - b.y);
        if (dist < this.player.radius + b.radius) {
          if (b.type === 'BOUNCY') {
            // Super Trampoline Bounce!
            this.player.vy = -380;
            this.player.squashY = 1.6;
            this.audio.playJump();
            this.vibrate(18);
            if (!(b.jiggle > 0.4)) {
              b.jiggle = 1; // jelly jiggle + a single burst per bounce
              this.spawnPopParticles(b.x, b.y, b.buddyType.color);
            }
          } else if (b.type === 'SOLID') {
            // Firm solid ledge
            if (this.player.vy > 0 && this.player.y < b.y) {
              this.player.y = b.y - b.radius - this.player.radius * 0.7;
              this.player.vy = 0;
              this.player.onGround = true;
            }
          } else if (b.type === 'FLOAT') {
            // Ride float bubble upward
            if (this.player.vy > 0 && this.player.y < b.y) {
              this.player.y = b.y - b.radius - this.player.radius * 0.5;
              this.player.vy = b.vy;
              this.player.onGround = true;
            }
          } else if (b.type === 'STICKY') {
            // Sticky climb peg (catches a falling / standing buddy, never one that is jumping up off it)
            if (this.player.vy >= 0 && this.player.y < b.y) {
              this.player.y = b.y - b.radius - this.player.radius * 0.6;
              this.player.vy = 0;
              this.player.onGround = true;
            }
          } else if (b.type === 'CHAIN_POP') {
            // Detonate!
            b.alive = false;
            this.audio.playPop();
            this.spawnPopParticles(b.x, b.y, b.buddyType.color);
            this.triggerChainPop(b.x, b.y);
          }
        }
      }
    }
    // Bubbles that pop on their own (timeout / spikes) still get a pop effect
    for (let b of this.bubbles) {
      if (!b.alive && b.popFx) {
        b.popFx = false;
        this.spawnPopParticles(b.x, b.y, b.buddyType.color);
      }
    }
    this.bubbles = this.bubbles.filter(b => b.alive);

    // 3. Update Dews
    for (let d of this.dews) {
      const wasCollected = d.collected;
      d.update(dt, this.player, this.audio);
      if (!wasCollected && d.collected) this.spawnDewBurst(d.x, d.y);
    }

    // Check if all dews collected to unlock gate (or boss defeated if boss present)
    const remainingDews = this.dews.filter(d => !d.collected).length;
    const bossBlocking = (this.boss && this.boss.alive && this.boss.state !== 'DEFEATED');
    if (remainingDews === 0 && !bossBlocking) {
      // Open Gate (turn T_GATE into T_AIR)
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (this.grid[r][c] === T_GATE) {
            this.grid[r][c] = T_AIR;
            this.spawnPopParticles(c * TILE_SIZE + 10, r * TILE_SIZE + 10, '#ffd700');
          }
        }
      }
    }

    // 4. Update Sludge Creeps
    for (let s of this.sludges) {
      s.update(dt, this.grid);
      if (s.alive && !s.isEncased) {
        // Check collision with player
        if (Physics.checkCircle(this.player.x, this.player.y, this.player.radius, s.x, s.y, s.radius)) {
          this.damagePlayer(false, (this.player.x > s.x ? 1 : -1) * 120, -120);
          if (this.state !== 'PLAYING') return;
        }

        // Check collision with Blue Float bubbles (Encase enemy!)
        for (let b of this.bubbles) {
          if (b.alive && b.type === 'FLOAT') {
            if (Physics.checkCircle(b.x, b.y, b.radius, s.x, s.y, s.radius)) {
              s.isEncased = true;
              s.encasedTimer = 6.0;
              b.alive = false;
              this.audio.playPop();
              this.spawnPopParticles(s.x, s.y, '#75c8f8');
            }
          }
        }
      }
    }

    // 4b. Update Sludge Boss
    if (this.boss && this.boss.alive) {
      this.boss.update(dt, this.player, this.grid, this.audio, this);

      // Check collision with bubbles
      for (let b of this.bubbles) {
        if (!b.alive) continue;
        if (Physics.checkCircle(b.x, b.y, b.radius, this.boss.x, this.boss.y, this.boss.radius)) {
          if (b.type === 'FLOAT') {
            // Blue Float bubble encasing stun
            this.boss.isEncased = true;
            this.boss.encasedTimer = 3.5;
            this.boss.vx = 0;
            this.boss.vy = 0;
            b.alive = false;
            this.audio.playPop();
            this.spawnPopParticles(this.boss.x, this.boss.y, '#75c8f8');
            this.vibrate(20);
          } else if (b.type === 'CHAIN_POP') {
            // Purple explosive detonation on boss contact
            b.alive = false;
            this.audio.playPop();
            this.spawnPopParticles(b.x, b.y, b.buddyType.color);
            this.triggerChainPop(b.x, b.y);
          }
        }
      }

      // Check collision with player / Aerial Stomp
      if (this.boss.state !== 'DEFEATED' && Physics.checkCircle(this.player.x, this.player.y, this.player.radius, this.boss.x, this.boss.y, this.boss.radius)) {
        const isStomp = (this.player.vy > 0 && this.player.y < this.boss.y - this.boss.radius * 0.35);
        if (isStomp) {
          // Aerial stomp bounce
          this.player.vy = -210;
          this.player.squashY = 0.45;
          this.player.squashVelY = -12;
          this.audio.playJump();

          const hit = this.boss.takeDamage(1);
          if (hit) {
            this.audio.playBossHit();
            this.vibrate([35, 55]);
            this.spawnPopParticles(this.boss.x, this.boss.y - 12, '#b060ff');
            if (this.boss.hp <= 0) {
              this.triggerBossDefeated();
            }
          }
        } else if (!this.boss.isEncased) {
          // Side / bottom body collision knocks player back & deducts 1 life
          this.damagePlayer(false, (this.player.x > this.boss.x ? 1 : -1) * 140, -120);
          if (this.state !== 'PLAYING') return;
        }
      }
    }

    // 4c. Update Boss Projectiles
    for (let proj of this.sludgeProjectiles) {
      proj.update(dt, this.grid);
      if (proj.alive) {
        // Collide with bubbles
        for (let b of this.bubbles) {
          if (b.alive && Physics.checkCircle(b.x, b.y, b.radius, proj.x, proj.y, proj.radius)) {
            b.alive = false;
            proj.alive = false;
            this.audio.playPop();
            this.spawnPopParticles(proj.x, proj.y, '#75c8f8');
            break;
          }
        }
        // Collide with player
        if (proj.alive && Physics.checkCircle(this.player.x, this.player.y, this.player.radius, proj.x, proj.y, proj.radius)) {
          proj.alive = false;
          this.spawnPopParticles(proj.x, proj.y, '#5c1c7a');
          this.damagePlayer(false, (this.player.x > proj.x ? 1 : -1) * 100, -100);
          if (this.state !== 'PLAYING') return;
        }
      }
    }
    this.sludgeProjectiles = this.sludgeProjectiles.filter(p => p.alive);

    // 4d. Update Boss Shockwaves
    for (let sw of this.sludgeShockwaves) {
      sw.update(dt, this.grid);
      if (sw.alive) {
        if (Math.abs(this.player.x - sw.x) < 14 && this.player.y >= 202) {
          this.spawnPopParticles(sw.x, 215, '#5c1c7a');
          this.damagePlayer(false, sw.dir * 80, -115);
          if (this.state !== 'PLAYING') return;
        }
      }
    }
    this.sludgeShockwaves = this.sludgeShockwaves.filter(sw => sw.alive);

    // 5. Update Particles & FX rings
    for (let p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);
    for (let f of this.fx) f.update(dt);
    this.fx = this.fx.filter(f => f.life > 0);

    // 6. Check Goal Reached
    const pCol = Math.floor(this.player.x / TILE_SIZE);
    const pRow = Math.floor(this.player.y / TILE_SIZE);
    if (this.grid[pRow] && this.grid[pRow][pCol] === T_GOAL) {
      this.audio.playRoomClear();
      this.vibrate([30, 40, 50]);
      if (this.levelIndex < LEVELS.length - 1) {
        this.loadLevel(this.levelIndex + 1);
        this.roomClearBannerTimer = 2.0;
      } else {
        this.state = 'VICTORY';
      }
    }

    if (this.roomClearBannerTimer > 0) this.roomClearBannerTimer -= dt;
  }

  triggerChainPop(cx, cy) {
    for (let b of this.bubbles) {
      if (b.alive && Math.hypot(b.x - cx, b.y - cy) < 45) {
        b.alive = false;
        this.audio.playPop();
        this.spawnPopParticles(b.x, b.y, b.buddyType.color);
      }
    }

    // Damage boss if near explosion
    if (this.boss && this.boss.alive && Math.hypot(this.boss.x - cx, this.boss.y - cy) < 48) {
      const hit = this.boss.takeDamage(1);
      if (hit) {
        this.audio.playBossHit();
        this.vibrate([35, 55]);
        this.spawnPopParticles(this.boss.x, this.boss.y, '#d060ff');
        if (this.boss.hp <= 0) {
          this.triggerBossDefeated();
        }
      }
    }

    // Check adjacent cracked blocks
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === T_CRACKED) {
          const bx = c * TILE_SIZE + 10;
          const by = r * TILE_SIZE + 10;
          if (Math.hypot(bx - cx, by - cy) < 40) {
            this.grid[r][c] = T_AIR;
            this.spawnPopParticles(bx, by, '#c8b090');
          }
        }
      }
    }
  }

  triggerBossDefeated() {
    if (this.audio && this.audio.playRoomClear) this.audio.playRoomClear();
    this.vibrate([40, 60, 80]);
    this.screenShakeTimer = 0.55;

    // Open Gate (T_GATE -> T_AIR) and shatter cracked blocks
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === T_GATE) {
          this.grid[r][c] = T_AIR;
          this.spawnPopParticles(c * TILE_SIZE + 10, r * TILE_SIZE + 10, '#ffd700');
        }
        if (this.grid[r][c] === T_CRACKED) {
          this.grid[r][c] = T_AIR;
          this.spawnPopParticles(c * TILE_SIZE + 10, r * TILE_SIZE + 10, '#c8b090');
        }
      }
    }

    // Auto collect all dews in Room 5
    for (let d of this.dews) {
      d.collected = true;
    }

    // Big fireworks across the room
    for (let i = 0; i < 20; i++) {
      const rx = 100 + Math.random() * 140;
      const ry = 80 + Math.random() * 120;
      const color = ['#ffd454', '#75c8f8', '#ff8cb8', '#68e290', '#c284f8'][i % 5];
      this.spawnPopParticles(rx, ry, color);
    }
  }

  /* ================= Canvas Graphics & Rendering ================= */

  // The back-buffer follows the real on-screen size (up to 4x the 320x240 logical grid)
  // so every outline, bubble highlight and eye sparkle stays razor sharp on phones.
  resizeBackbuffer() {
    let s = 4;
    try {
      const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      if (rect && rect.width > 0 && rect.height > 0) {
        s = Math.ceil(Math.min(rect.width / this.width, rect.height / this.height) * dpr);
      }
    } catch (e) { /* fall back to 4x */ }
    s = Math.max(2, Math.min(4, s));
    if (s !== this.renderScale) {
      this.renderScale = s;
      this.canvas.width = this.width * s;
      this.canvas.height = this.height * s;
      this.layers = null;
    }
  }

  // Cached map layers: backdrop, merged tile terrain, vignette (rebuilt only when needed)
  getLayers(th) {
    const S = this.renderScale;
    let sig = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) sig = (Math.imul(sig, 31) + this.grid[r][c] + 1) | 0;
    }
    if (!this.layers || this.layers.S !== S || this.layers.themeId !== th.id) {
      this.layers = {
        S, themeId: th.id, sig: null, tiles: null,
        backdrop: SquishyFX.buildBackdrop(th, S),
        vignette: SquishyFX.buildVignette(th, S)
      };
    }
    if (this.layers.sig !== sig) {
      this.layers.tiles = SquishyFX.buildTileLayer(this.grid, th, S);
      this.layers.sig = sig;
    }
    return this.layers;
  }

  // y of the first walkable surface below (x, y) - used for soft ground shadows
  groundBelow(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    if (col < 0 || col >= GRID_COLS) return null;
    for (let r = Math.max(0, Math.floor(y / TILE_SIZE)); r < GRID_ROWS; r++) {
      const t = this.grid[r][col];
      if (t === T_SOLID || t === T_CRACKED || t === T_GATE || t === T_CRAWLWAY) {
        const top = r * TILE_SIZE;
        if (top >= y - 1) return top;
      }
    }
    return CANVAS_H - 4;
  }

  drawGroundShadow(ctx, th, x, feetY, halfWidth, strength = 1) {
    const gy = this.groundBelow(x, feetY);
    if (gy == null) return;
    const h = Math.max(0, gy - feetY);
    SquishyFX.drawShadow(ctx, x, gy, halfWidth * (1 - Math.min(0.45, h / 220)), strength * (1 - h / 110), th);
  }

  render() {
    const ctx = this.ctx;
    const FX = SquishyFX;
    const S = this.renderScale || 1;
    const t = this.fxTime || 0;
    const th = FX.themeFor(this.levelIndex);

    if (ctx.setTransform) ctx.setTransform(S, 0, 0, S, 0, 0);
    // canvas state persists between frames - always start from a clean slate
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.clearRect(0, 0, this.width, this.height);

    const L = this.getLayers(th);

    ctx.save();
    // Screen shake: smooth decaying wobble (timer counts down in update)
    if (this.screenShakeTimer > 0) {
      const k = Math.min(1, this.screenShakeTimer / 0.5);
      ctx.translate(Math.sin(t * 85) * 3.6 * k * k, Math.cos(t * 67) * 2.8 * k * k);
    }

    // 1. Themed backdrop + drifting ambience
    ctx.fillStyle = th.skyBot;
    ctx.fillRect(-8, -8, this.width + 16, this.height + 16);
    ctx.drawImage(L.backdrop, 0, 0, this.width, this.height);
    FX.drawAmbient(ctx, th, t);

    // 2. Tilemap (cached) + animated tiles
    this.renderTiles(ctx, L, th, t);

    // 3. Soft ground shadows
    this.renderShadows(ctx, th);

    // 4. Bubbles
    for (let b of this.bubbles) {
      this.drawBubble(ctx, b);
    }

    // 5. Dew Drops
    for (let d of this.dews) {
      if (!d.collected) this.drawDewDrop(ctx, d);
    }

    // 6. Sludge Creeps & Boss
    for (let s of this.sludges) {
      if (s.alive) this.drawSludge(ctx, s);
    }

    if (this.boss && (this.boss.alive || this.boss.defeatedTimer > 0)) {
      this.drawSludgeBoss(ctx, this.boss);
    }

    for (let proj of this.sludgeProjectiles) {
      this.drawSludgeProjectile(ctx, proj);
    }

    for (let sw of this.sludgeShockwaves) {
      this.drawSludgeShockwave(ctx, sw);
    }

    // 7. Trailing Mochi Parade (Followers)
    this.renderFollowers(ctx);

    // 8. Active Player Buddy
    this.drawPlayer(ctx);

    // 9. Impact rings & particles
    for (let f of this.fx || []) FX.drawRing(ctx, f);
    for (let p of this.particles) FX.drawParticle(ctx, p);

    // End Screen Shake transformation before rendering HUD
    ctx.restore();

    ctx.drawImage(L.vignette, 0, 0, this.width, this.height);

    // 10. Floating Micro HUD
    this.renderMicroHud(ctx);

    // 11. Overlays
    if (this.state === 'TITLE') this.renderTitleOverlay(ctx);
    else if (this.state === 'STORY') this.renderStoryOverlay(ctx);
    else if (this.state === 'PAUSED') this.renderPauseOverlay(ctx);
    else if (this.state === 'VICTORY') this.renderVictoryOverlay(ctx);
    else if (this.state === 'GAME_OVER') this.renderGameOverOverlay(ctx);

    // Room clear toast
    if (this.state === 'PLAYING' && this.roomClearBannerTimer > 0) {
      const p = FX.outBack(FX.seg(2.0 - this.roomClearBannerTimer, 0, 0.3), 1.8);
      const fade = FX.clamp(this.roomClearBannerTimer / 0.35);
      const msg = this.levelIndex === 5
        ? '★ 第二阶段开启：星渊秘境！ ★'
        : '★ 泉眼净化成功！进入下一关 ★';
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(this.width / 2, 118);
      ctx.scale(p, p);
      FX.panel(ctx, -150, -19, 300, 38, { r: 10, lw: 1.6 });
      FX.text(ctx, msg, 0, 5, { size: 12, color: '#FFD454', align: 'center' });
      ctx.restore();
    }

    // Secret 99-Lives activation toast
    if (this.secretBannerTimer > 0) {
      const p = FX.outBack(FX.seg(2.4 - this.secretBannerTimer, 0, 0.3), 1.8);
      const fade = FX.clamp(this.secretBannerTimer / 0.35);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(this.width / 2, 46);
      ctx.scale(p, p);
      FX.panel(ctx, -146, -15, 292, 30, {
        r: 8,
        lw: 1.6,
        border: '#FFD454',
        top: 'rgba(68, 42, 14, 0.96)',
        bottom: 'rgba(32, 18, 6, 0.96)'
      });
      FX.text(ctx, '★ 隐藏秘籍激活：黄金水滴 ❤️ × 99 命！ ★', 0, 4, {
        size: 10.5,
        color: '#FFD454',
        align: 'center'
      });
      ctx.restore();
    }
  }

  renderTiles(ctx, L, th, t) {
    ctx.drawImage(L.tiles, 0, 0, this.width, this.height);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.grid[r][c];
        if (tile === T_GOAL) {
          SquishyFX.drawGoal(ctx, c * TILE_SIZE, r * TILE_SIZE, t, true);
        } else if (tile === T_GATE) {
          // pulsing seal glow around the lock
          const gx = c * TILE_SIZE + 10, gy = r * TILE_SIZE + 10;
          const a = 0.18 + 0.12 * Math.sin(t * 4 + r);
          const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, 14);
          g.addColorStop(0, `rgba(255,212,84,${a * 2})`);
          g.addColorStop(1, 'rgba(255,212,84,0)');
          ctx.fillStyle = g;
          ctx.fillRect(gx - 14, gy - 14, 28, 28);
        }
      }
    }
  }

  renderShadows(ctx, th) {
    const p = this.player;
    const feetY = p.y + p.radius * (p.isCrouched ? 0.4 : 0.85);
    this.drawGroundShadow(ctx, th, p.x, feetY, SquishyFX.ACTIVE_S * 0.95 * p.squashX, 1);

    for (let s of this.sludges) {
      if (s.alive && !s.isEncased) this.drawGroundShadow(ctx, th, s.x, s.y + s.radius, s.radius * 1.15, 0.9);
    }
    const boss = this.boss;
    if (boss && (boss.alive || boss.defeatedTimer > 0)) {
      this.drawGroundShadow(ctx, th, boss.x, boss.y + boss.radius, boss.radius * 1.1 * boss.squashX, 1);
    }
  }

  // Active player: jelly squash anchored at the feet, lean into motion, expressive face
  drawPlayer(ctx) {
    const p = this.player;
    const t = this.fxTime || 0;
    const halfH = p.radius * (p.isCrouched ? 0.4 : 0.85);
    const feet = p.y + halfH;

    let sx = p.squashX, sy = p.squashY;
    let rot = Math.max(-1, Math.min(1, p.vx / (p.type.speed || 120))) * 0.12;
    if (p.onGround && Math.abs(p.vx) > 10 && !p.isSliding) rot += Math.sin(p.walkCycle * 0.5) * 0.035;
    if (p.onGround && !p.isCrouched && !p.isSliding && Math.abs(p.vx) < 10) {
      // idle breathing
      const b = 1 + Math.sin(t * 3.2) * 0.022;
      sy *= b;
      sx /= Math.sqrt(b);
    }

    let eyes = p.isBlinking ? 'closed' : 'open';
    let mouth = 'smile';
    if (p.isSliding || p.isCrouched) eyes = 'squint';
    else if (p.onGround && p.squashY < 0.82) eyes = 'happy';
    if (p.spitCooldown > 0.2) mouth = 'puff';
    else if (p.spitCooldown > 0.08 || (!p.onGround && p.vy < -80)) mouth = 'o';

    // Whoever is selected is drawn at the same (biggest) size; a fresh switch pops up with overshoot
    const pop = p.switchT == null ? 1 : SquishyFX.outBack(SquishyFX.clamp(p.switchT / 0.28), 2.2);
    const size = SquishyFX.ACTIVE_S * (0.72 + 0.28 * pop);

    // Blinking transparency during post-hit invincibility frames
    const hurtBlink = (this.invincibleTimer > 0 && Math.floor(t * 16) % 2 === 0) ? 0.38 : 1.0;

    this.drawDropletBuddy(ctx, p.x, p.y, p.type, sx, sy, p.facing, false, hurtBlink, {
      feet, rot, eyes, mouth, s: size
    });
  }

  // Draw the iconic water-droplet / mochi (jelly look ported from the promo film)
  // y is the (legacy) centre of the droplet; pass opts.feet to anchor the contact point exactly.
  drawDropletBuddy(ctx, x, y, type, sx = 1.0, sy = 1.0, facing = 1, isBlinking = false, alpha = 1.0, opts = {}) {
    const size = opts.s != null ? opts.s : SquishyFX.ACTIVE_S * 0.92;
    const feet = opts.feet != null ? opts.feet : y + 13;
    SquishyFX.drawBuddy(ctx, x, feet, size, type, {
      sx, sy, alpha,
      rot: opts.rot,
      look: facing * 0.8,
      eyes: opts.eyes || (isBlinking ? 'closed' : 'open'),
      mouth: opts.mouth,
      cheeks: opts.cheeks
    });
  }

  // The four unselected buddies are shown as translucent after-images that trail behind the hero while
  // it moves or jumps (and fade away completely when it stands still), so they never cover the hero.
  renderFollowers(ctx) {
    const FX = SquishyFX;
    const p = this.player;
    const trailingKeys = BUDDY_KEYS.filter(k => k !== p.typeKey);
    const pFeet = p.y + p.radius * (p.isCrouched ? 0.4 : 0.85);
    const spacing = 7; // frames between two after-images

    // farthest ghost first so the nearer ones overlap on top of it
    for (let idx = trailingKeys.length - 1; idx >= 0; idx--) {
      const tr = p.trail[(idx + 1) * spacing];
      if (!tr) continue;
      const feet = tr.feet != null ? tr.feet : tr.y + 10;
      const dist = Math.hypot(tr.x - p.x, feet - pFeet);
      const vis = FX.clamp((dist - 7) / 16); // still overlapping the hero => invisible
      if (vis <= 0.01) continue;
      const prev = p.trail[(idx + 1) * spacing + 3] || tr;
      const stretch = Math.min(0.3, Math.abs(tr.y - prev.y) * 0.05);
      FX.drawBuddy(ctx, tr.x, feet, FX.GHOST_S, BUDDY_TYPES[trailingKeys[idx]], {
        sx: 1 / Math.sqrt(1 + stretch), sy: 1 + stretch,
        alpha: 0.5 * vis * (1 - idx * 0.14),
        look: tr.facing * 0.8, eyes: 'happy'
      });
    }
  }

  drawBubble(ctx, b) {
    const FX = SquishyFX;
    const th = FX.themeFor(this.levelIndex);
    const wob = Math.sin(b.wobble);
    let sx = 1 + wob * 0.035, sy = 1 - wob * 0.035;
    // trampoline / hit jiggle
    if (b.jiggle > 0) {
      const sp = Math.cos((1 - b.jiggle) * 22) * b.jiggle * 0.3;
      sy *= 1 - sp;
      sx *= 1 + sp * 0.8;
    }
    // pop-in with overshoot + warning blink right before it fades away
    const pop = b.age < 0.28 ? Math.max(0.05, FX.outBack(b.age / 0.28, 2.2)) : 1;
    const left = b.lifetime - b.age;
    const alpha = left < 2.5 ? 0.5 + 0.5 * Math.abs(Math.sin(left * 9)) : 1;
    FX.drawBubble(ctx, b.x, b.y, b.radius * pop, {
      tint: b.buddyType.color,
      rim: th.light ? b.buddyType.dark : b.buddyType.color,
      type: b.type,
      t: this.fxTime || 0,
      sx, sy, alpha
    });
  }

  drawDewDrop(ctx, d) {
    SquishyFX.drawDew(ctx, d.x, d.y, this.fxTime || 0, d.sparkleTimer);
  }

  drawSludge(ctx, s) {
    const t = this.fxTime || 0;
    SquishyFX.drawCreep(ctx, s.x, s.y + s.radius, s.radius * 1.15, t, { phase: s.startX * 0.31, facing: s.vx >= 0 ? 1 : -1 });
    if (s.isEncased) {
      // Encased in transparent blue bubble
      const w = Math.sin(t * 6);
      SquishyFX.drawBubble(ctx, s.x, s.y, 14, { tint: '#75C8F8', sx: 1 + w * 0.04, sy: 1 - w * 0.04, t });
    }
  }

  drawSludgeBoss(ctx, boss) {
    const FX = SquishyFX;
    const t = this.fxTime || 0;
    const R = boss.radius * 1.08;
    const sx = boss.squashX, sy = boss.squashY;
    const feet = boss.y + boss.radius;
    const cy = feet - R * 0.85 * sy;

    const flashing = (boss.hurtTimer > 0 || boss.state === 'DEFEATED') && (Math.floor(boss.animTimer * 20) % 2 === 0);
    const fade = boss.state === 'DEFEATED' ? FX.clamp(boss.defeatedTimer / 0.6) : 1;

    ctx.save();
    ctx.globalAlpha *= fade;
    const isCrystal = boss.variant === 'CRYSTAL';
    const rage = boss.hp <= (isCrystal ? 4 : 2);
    FX.drawBoss(ctx, boss.x, cy, R, boss.animTimer, {
      sx, sy,
      flash: flashing ? 0.85 : 0,
      rage,
      charge: boss.state === 'CHARGE_SPIT',
      facing: boss.facing,
      variant: boss.variant
    });

    // Blue Bubble encasing (harmless stun visual)
    if (boss.isEncased) {
      const w = Math.sin(t * 8);
      FX.drawBubble(ctx, boss.x, cy, R + 9, { tint: '#75C8F8', sx: 1 + w * 0.03, sy: 1 - w * 0.03, t });
    }

    // Floating segmented micro armor bar right above the Boss in the arena
    if (boss.alive && boss.state !== 'DEFEATED') {
      const barW = 56, barH = 4.5;
      const bx = boss.x - barW / 2;
      const by = Math.max(24, cy - R - 11);
      FX.rr(ctx, bx - 1.5, by - 1.5, barW + 3, barH + 3, 2.5);
      ctx.fillStyle = 'rgba(18, 8, 28, 0.85)';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = rage ? '#FF3B5C' : (isCrystal ? '#58E4FF' : '#B98CFF');
      ctx.stroke();

      const totalCells = boss.maxHp || 10;
      const cellGap = 0.9;
      const cellW = (barW - (totalCells - 1) * cellGap) / totalCells;
      for (let i = 0; i < totalCells; i++) {
        const cx = bx + i * (cellW + cellGap);
        ctx.fillStyle = i < boss.hp
          ? (rage ? '#FF3B5C' : (isCrystal ? '#58E4FF' : '#C864FF'))
          : 'rgba(70, 50, 95, 0.45)';
        ctx.fillRect(cx, by, cellW, barH);
      }
    }
    ctx.restore();
  }

  drawSludgeProjectile(ctx, proj) {
    SquishyFX.drawProjectile(ctx, proj, this.fxTime || 0);
  }

  drawSludgeShockwave(ctx, sw) {
    SquishyFX.drawShockwave(ctx, sw, this.fxTime || 0);
  }

  // HUD lives entirely inside the top wall band (y 0..20) so it never covers the playfield
  renderMicroHud(ctx) {
    const FX = SquishyFX;
    const t = this.fxTime || 0;
    const p = this.player;
    const dewsLeft = this.dews.filter(d => !d.collected).length;
    const dewsTotal = this.dews.length;
    const dewCount = `${dewsTotal - dewsLeft}/${dewsTotal}`;
    const PY = 2, PH = 16, TY = 13.2; // panel top / height / text baseline

    const buddyIcon = (x) => FX.drawBuddy(ctx, x, 15.2, 3.7, p.type, { eyes: p.isBlinking ? 'closed' : 'open' });

    // 1. Left Panel (x=4, w=68): Collected Water Droplets ("水滴 0/3")
    FX.panel(ctx, 4, PY, 68, PH, { r: 5, border: this.boss ? '#6A5A8A' : undefined });
    FX.dropIcon(ctx, 13, 10, 5);
    FX.text(ctx, '水滴', 21, TY, { size: 8.5, color: '#FFFFFF' });
    FX.text(ctx, dewCount, 43, TY, { size: 8.5, color: '#7FF0FF' });

    // 2. Center Panel (x=75, w=98): Active Buddy Mini-Icon + Player Lives (5 Hearts OR Golden "❤️ × 99" Badge)
    const is99 = this.maxLives > 5 || this.lives > 5;
    FX.panel(ctx, 75, PY, 98, PH, {
      r: 5,
      border: is99 ? '#FFD454' : (this.boss ? '#6A5A8A' : undefined),
      lw: is99 ? 1.4 : 1.2
    });
    buddyIcon(86);

    if (is99) {
      // Golden 99-Lives Badge: 1 pulsing heart + "× 99" counter
      const pulse = 1 + 0.1 * Math.sin(t * 7);
      ctx.save();
      ctx.translate(107, 10);
      ctx.scale(pulse * 0.92, pulse * 0.92);
      FX.heart(ctx, 0, 0, 5.5);
      const g = ctx.createLinearGradient(0, -5, 0, 4);
      g.addColorStop(0, '#FFE878');
      g.addColorStop(0.45, '#FF5C8A');
      g.addColorStop(1, '#E01040');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = '#3A0814';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.ellipse(-2.2, -2.3, 1.0, 0.6, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      FX.text(ctx, `× ${this.lives}`, 118, TY, {
        size: 9.5,
        color: '#FFD454',
        stroke: '#3A1808',
        strokeW: 2.2
      });
    } else {
      const lowLife = this.lives <= 1;
      for (let i = 0; i < this.maxLives; i++) {
        const hx = 98 + i * 15;
        const filled = i < this.lives;
        const pulse = filled && lowLife ? 1 + 0.14 * Math.sin(t * 12) : 1;
        ctx.save();
        ctx.translate(hx, 10);
        ctx.scale(pulse * 0.78, pulse * 0.78);
        FX.heart(ctx, 0, 0, 5.2);
        if (filled) {
          const g = ctx.createLinearGradient(0, -5, 0, 4);
          g.addColorStop(0, '#FF7A9A');
          g.addColorStop(1, '#FF2255');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = '#3A0814';
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.beginPath();
          ctx.ellipse(-2.2, -2.3, 0.95, 0.55, -0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(70, 58, 82, 0.45)';
          ctx.fill();
          ctx.lineWidth = 0.85;
          ctx.strokeStyle = 'rgba(130, 110, 150, 0.55)';
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 3. Right Panel (x=176, w=140): Boss Segmented Armor HP Bar (Room 5 & Room 10) OR Room Badge
    if (this.boss) {
      const bx = 176, bw = 140;
      const isCrystal = this.boss.variant === 'CRYSTAL';
      const rageHud = this.boss.hp <= (isCrystal ? 4 : 3);
      FX.panel(ctx, bx, PY, bw, PH, {
        r: 5,
        lw: 1.4,
        border: rageHud ? '#FF2244' : (isCrystal ? '#58E4FF' : '#FFD454'),
        top: isCrystal ? 'rgba(18,38,68,.95)' : 'rgba(40,24,60,.95)',
        bottom: isCrystal ? 'rgba(8,18,36,.95)' : 'rgba(20,10,32,.95)'
      });

      // Tiny Boss emblem
      const bgr = ctx.createRadialGradient(bx + 7, 8, 0.5, bx + 9, 10, 4.8);
      bgr.addColorStop(0, isCrystal ? '#78F0FF' : '#7A42B0');
      bgr.addColorStop(1, isCrystal ? '#0E2240' : '#1A0B27');
      ctx.fillStyle = bgr;
      ctx.beginPath();
      ctx.arc(bx + 9, 10, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#0A0510';
      ctx.stroke();
      ctx.fillStyle = '#FF3B4E';
      ctx.beginPath();
      ctx.arc(bx + 7.6, 9.5, 0.95, 0, Math.PI * 2);
      ctx.arc(bx + 10.4, 9.5, 0.95, 0, Math.PI * 2);
      ctx.fill();

      const shortBossName = isCrystal ? '霜晶' : '巨霸';
      FX.text(ctx, shortBossName, bx + 15, TY, {
        size: 8,
        color: rageHud ? '#FF8A98' : (isCrystal ? '#78F0FF' : '#FFD454')
      });

      // Auto-scaled Segmented Boss Armor Gauge (supports 10 HP or 12 HP cleanly)
      const totalCells = this.boss.maxHp || 10;
      const segStartX = bx + 35;
      const availW = 66;
      const segGap = 1.2;
      const segW = (availW - (totalCells - 1) * segGap) / totalCells;
      const segY = 6.2;
      const segH = 7.6;

      for (let i = 0; i < totalCells; i++) {
        const sx = segStartX + i * (segW + segGap);
        const filled = i < this.boss.hp;
        FX.rr(ctx, sx, segY, segW, segH, 1.2);
        if (filled) {
          const sg = ctx.createLinearGradient(0, segY, 0, segY + segH);
          if (rageHud) {
            sg.addColorStop(0, '#FF7A9A');
            sg.addColorStop(1, '#E01035');
          } else if (isCrystal) {
            sg.addColorStop(0, '#98F8FF');
            sg.addColorStop(1, '#2288E8');
          } else {
            sg.addColorStop(0, '#DF88FF');
            sg.addColorStop(1, '#8A22D8');
          }
          ctx.fillStyle = sg;
          ctx.fill();
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = '#140828';
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(65, 50, 88, 0.45)';
          ctx.fill();
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = '#4B3968';
          ctx.stroke();
        }
      }

      // Numeric Boss HP readout (e.g. "10/10" or "12/12")
      FX.text(ctx, `${this.boss.hp}/${totalCells}`, bx + bw - 4, TY, {
        size: 7.5,
        color: rageHud ? '#FF8A98' : (isCrystal ? '#B8F6FF' : '#E5C6FF'),
        align: 'right'
      });
      return;
    }

    // Standard Rooms 1-4 Right Panel: Room Title Badge
    FX.panel(ctx, 176, PY, 140, PH, { r: 5 });
    FX.text(ctx, this.currentLevel.title, 246, TY, { size: 8.5, color: '#FFD454', align: 'center' });
  }

  renderTitleOverlay(ctx) {
    const FX = SquishyFX;
    const t = this.fxTime || 0;
    ctx.fillStyle = 'rgba(20, 12, 8, 0.35)';
    ctx.fillRect(0, 0, this.width, this.height);
    FX.panel(ctx, 20, 32, this.width - 40, 176, { r: 12, lw: 2, top: 'rgba(70,50,34,.98)', bottom: 'rgba(36,26,18,.98)' });

    FX.text(ctx, '软乎乎大冒险 2006', this.width / 2, 68, { size: 18, color: '#FFD454', align: 'center', stroke: '#3B2A1C', strokeW: 3.5 });
    FX.text(ctx, 'SQUISHY BUDDIES · 5 COLOR POP', this.width / 2, 87, { size: 10, weight: 'normal', color: '#E8D7B8', align: 'center' });

    // Draw all 5 buddies hopping in a row (squash on takeoff/landing)
    BUDDY_KEYS.forEach((k, i) => {
      const type = BUDDY_TYPES[k];
      const ph = (t * 1.5 + i * 0.17) % 1;
      const hop = Math.sin(ph * Math.PI) * 9;
      const sy = (ph < 0.12 || ph > 0.9) ? 0.82 : 1.08;
      FX.drawShadow(ctx, this.width / 2 + (i - 2) * 34, 140, 11 * (1 - hop / 28), 0.6 * (1 - hop / 18), FX.themeFor(this.levelIndex));
      FX.drawBuddy(ctx, this.width / 2 + (i - 2) * 34, 140 - hop, FX.ACTIVE_S * 0.95, type, {
        sx: 1 / Math.sqrt(sy), sy, look: 0.4, eyes: ph > 0.9 || ph < 0.12 ? 'happy' : 'open'
      });
    });

    const pulse = 0.78 + 0.22 * Math.sin(t * 5);
    FX.text(ctx, '👉 按 A 键 观看故事与开始 👈', this.width / 2, 168, { size: 12, color: '#FFFFFF', align: 'center', alpha: pulse });
    FX.text(ctx, '十字键:滚动  A:跳跃/确认  B:吐泡泡  SEL:切人', this.width / 2, 192, { size: 9, weight: 'normal', color: '#CDB88F', align: 'center' });
  }

  /* ================= Story Cutscene & Gameplay Guide Overlays ================= */

  renderStoryOverlay(ctx) {
    const t = this.storyTimer;
    const slide = this.storySlideIndex;

    // Full screen background for story
    ctx.fillStyle = '#0f1424';
    ctx.fillRect(0, 0, this.width, this.height);

    if (slide === 0) {
      this.renderStoryAct1(ctx, t);
    } else if (slide === 1) {
      this.renderStoryAct2(ctx, t);
    } else if (slide === 2) {
      this.renderStoryAct3(ctx, t);
    } else if (slide === 3) {
      this.renderGameplayGuide(ctx, t);
    }
  }

  // Act 1: Peaceful Haven (彩虹泉林)
  renderStoryAct1(ctx, t) {
    // Top Act Ribbon
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.fillRect(70, 7, 180, 18);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect(70, 7, 180, 18);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('✦ 第一幕 · 彩虹泉林 [ 1/3 ] ✦', this.width / 2, 20);

    // Background Rainbow Arcs
    const colors = [
      'rgba(255,100,130,0.25)',
      'rgba(255,180,60,0.25)',
      'rgba(255,230,60,0.25)',
      'rgba(60,220,130,0.25)',
      'rgba(60,180,255,0.25)',
      'rgba(180,100,255,0.25)'
    ];
    colors.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(160, 136, 75 + i * 5, Math.PI, 0);
      ctx.stroke();
    });

    // Central Rainbow Fountain
    ctx.fillStyle = '#2a3550';
    ctx.fillRect(144, 116, 32, 14);
    ctx.fillStyle = '#485880';
    ctx.fillRect(142, 114, 36, 4);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(158, 104, 4, 12);
    // Water droplets jetting up
    for (let k = 0; k < 3; k++) {
      const dropY = 100 - Math.abs(Math.sin(t * 5 + k * 1.5)) * 14;
      const dropX = 160 + (k - 1) * 8;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(dropX, dropY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5 Buddies happily bouncing in a row
    const startX = 60;
    const spacing = 50;
    BUDDY_KEYS.forEach((key, i) => {
      const bx = startX + i * spacing;
      const bounce = Math.abs(Math.sin(t * 3.5 + i * 1.3)) * 6;
      const sqY = 1.0 + Math.sin(t * 3.5 + i * 1.3) * 0.15;
      const sqX = 1 / Math.sqrt(sqY);
      const isBlink = Math.sin(t * 2.5 + i) > 0.94;
      this.drawDropletBuddy(ctx, bx, 126 - bounce, BUDDY_TYPES[key], sqX, sqY, 1, isBlink);
    });

    // Story Narrative Box
    this.drawStoryBox(ctx, [
      '很久很久以前，在彩虹之森深处……',
      '生活着5只无忧无虑的水滴精灵【软乎乎】。',
      '它们没有手脚，却拥有如果冻般弹滑的身体与神奇泡泡！'
    ], '[START] 速读指南', '👉 按 [A] 键 继续 ▶');
  }

  // Act 2: Sludge Incursion (暗影泥浆入侵)
  renderStoryAct2(ctx, t) {
    // Top Act Ribbon
    ctx.fillStyle = 'rgba(255, 60, 90, 0.15)';
    ctx.fillRect(70, 7, 180, 18);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 1;
    ctx.strokeRect(70, 7, 180, 18);

    ctx.fillStyle = '#ff5577';
    ctx.font = 'bold 10px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('✦ 第二幕 · 暗影突袭 [ 2/3 ] ✦', this.width / 2, 20);

    // Ominous lightning flash
    if (Math.sin(t * 3) > 0.94) {
      ctx.fillStyle = 'rgba(180, 40, 90, 0.12)';
      ctx.fillRect(0, 0, this.width, 140);
    }

    // Sludge Monster on Right
    const sludgeX = 240;
    const sludgeY = 114;
    ctx.fillStyle = '#220d30';
    ctx.beginPath();
    ctx.ellipse(sludgeX, sludgeY + 4, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pulsing spikes
    ctx.fillStyle = '#481560';
    for (let s = 0; s < 5; s++) {
      const ang = (s / 5) * Math.PI + Math.PI;
      const spikeR = 24 + Math.sin(t * 6 + s) * 5;
      const sx = sludgeX + Math.cos(ang) * spikeR;
      const sy = sludgeY + Math.sin(ang) * (spikeR * 0.7);
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glowing red menacing eyes
    ctx.fillStyle = '#ff1133';
    ctx.beginPath();
    ctx.arc(sludgeX - 10, sludgeY - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(sludgeX + 5, sludgeY - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Locked Ancient Gate in Center
    ctx.fillStyle = '#442220';
    ctx.fillRect(146, 75, 8, 48);
    ctx.fillRect(174, 75, 8, 48);
    ctx.fillRect(142, 70, 48, 8);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 8px ' + SquishyFX.FONT;
    ctx.fillText('⛩️封印', 164, 98);

    // Floating Stolen Dew Drops trapped in purple bubbles
    for (let d = 0; d < 3; d++) {
      const dewX = 188 + d * 18 + Math.sin(t * 3 + d) * 4;
      const dewY = 55 + d * 18 + Math.cos(t * 3 + d) * 4;
      ctx.fillStyle = 'rgba(160, 60, 240, 0.4)';
      ctx.beginPath();
      ctx.arc(dewX, dewY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b060ff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(dewX, dewY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5 Buddies shivering on the Left
    const startX = 30;
    const spacing = 27;
    BUDDY_KEYS.forEach((key, i) => {
      const shiv = Math.sin(t * 32 + i * 2) * 1.5;
      const bx = startX + i * spacing + shiv;
      this.drawDropletBuddy(ctx, bx, 126, BUDDY_TYPES[key], 1.15, 0.75, 1, false);
      // Small tear drop popping
      if (Math.sin(t * 4 + i) > 0.5) {
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(bx + 6, 114, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Story Narrative Box
    this.drawStoryBox(ctx, [
      '突如其来！贪婪的【暗影泥浆怪】掠夺了泉林！',
      '守护生机的【彩虹露珠】被抢夺封印，古代泉门紧闭……',
      '泉水干涸，森林正失去斑斓色彩，陷入了巨大的危机！'
    ], '[B] 上一页', '👉 按 [A] 键 继续 ▶');
  }

  // Act 3: Fellowship Assembles (全员集结出征)
  renderStoryAct3(ctx, t) {
    // Top Act Ribbon
    ctx.fillStyle = 'rgba(0, 255, 200, 0.12)';
    ctx.fillRect(70, 7, 180, 18);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1;
    ctx.strokeRect(70, 7, 180, 18);

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 10px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('✦ 第三幕 · 全员集结 [ 3/3 ] ✦', this.width / 2, 20);

    // Radiant Dawn Rays
    for (let r = 0; r < 7; r++) {
      const rayX = 30 + r * 45 + Math.sin(t + r) * 10;
      ctx.strokeStyle = 'rgba(255, 235, 160, 0.08)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(160, 0);
      ctx.lineTo(rayX, 140);
      ctx.stroke();
    }

    // 5 Buddies in a Bold Heroic Lineup
    const startX = 40;
    const spacing = 60;
    BUDDY_KEYS.forEach((key, i) => {
      const bx = startX + i * spacing;
      const bType = BUDDY_TYPES[key];
      // Heroic breathing
      const sqY = 1.05 + Math.sin(t * 3 + i * 0.8) * 0.08;
      const sqX = 1 / Math.sqrt(sqY);
      this.drawDropletBuddy(ctx, bx, 126, bType, sqX, sqY, 1, false);

      // Signature Elemental Bubble hovering & pulsing overhead
      const bubY = 90 + Math.sin(t * 3 + i * 1.5) * 4;
      ctx.fillStyle = bType.color;
      ctx.beginPath();
      ctx.arc(bx, bubY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bType.highlight;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bubble highlight shine
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx - 3, bubY - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Story Narrative Box
    this.drawStoryBox(ctx, [
      '“家园由我们守护！”软乎乎五兄弟毅然集结出发！',
      '没有手脚又何妨？翻滚、压扁、弹跳，活用五大元素泡泡，',
      '誓要寻回全部彩虹露珠，解开古代泉门，驱散暗影！'
    ], '[B] 上一页', '👉 按 [A] 键 查看操作指南 ▶');
  }

  // Universal Story Dialogue Box
  drawStoryBox(ctx, lines, leftHint, rightHint) {
    const boxX = 10;
    const boxY = 144;
    const boxW = 300;
    const boxH = 86;

    SquishyFX.panel(ctx, boxX, boxY, boxW, boxH, { r: 8, lw: 1.6, top: 'rgba(34,26,44,.96)', bottom: 'rgba(16,12,24,.96)' });

    // Text Lines
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px ' + SquishyFX.FONT;
    ctx.textAlign = 'left';
    ctx.fillText(lines[0], boxX + 10, boxY + 20);
    ctx.fillText(lines[1], boxX + 10, boxY + 36);
    ctx.fillText(lines[2], boxX + 10, boxY + 52);

    // Bottom Navigation Hint Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    SquishyFX.rr(ctx, boxX + 3, boxY + 63, boxW - 6, 20, 5);
    ctx.fill();

    ctx.fillStyle = '#8f9cb8';
    ctx.font = '9px ' + SquishyFX.FONT;
    ctx.fillText(leftHint, boxX + 10, boxY + 77);

    // Pulsing right prompt
    const pulse = 0.7 + 0.3 * Math.sin(this.storyTimer * 6);
    ctx.fillStyle = `rgba(0, 255, 200, ${pulse})`;
    ctx.font = 'bold 9.5px ' + SquishyFX.FONT;
    ctx.textAlign = 'right';
    ctx.fillText(rightHint, boxX + boxW - 10, boxY + 77);
  }

  // Final Slide: Key Gameplay Handbook (核心玩法指南)
  renderGameplayGuide(ctx, t) {
    // Top Title Banner
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.fillRect(35, 5, 250, 18);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect(35, 5, 250, 18);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 11px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('✦ 软乎乎大冒险 · 核心玩法指南 ✦', this.width / 2, 18);

    // 4 Clean Gameplay Feature Cards
    const drawCard = (x, y, w, h, borderColor, title, desc1, desc2) => {
      ctx.fillStyle = 'rgba(16, 22, 38, 0.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = borderColor;
      ctx.font = 'bold 9.5px ' + SquishyFX.FONT;
      ctx.textAlign = 'left';
      ctx.fillText(title, x + 8, y + 13);

      ctx.fillStyle = '#d0dcf4';
      ctx.font = '8.5px ' + SquishyFX.FONT;
      ctx.fillText(desc1, x + 8, y + 25);
      if (desc2) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '8px ' + SquishyFX.FONT;
        ctx.fillText(desc2, x + 8, y + 36);
      }
    };

    // Card 1: 滚动与压扁滑行
    drawCard(8, 27, 304, 38, '#00ffcc',
      '◀ ▶ 滚动移动  |  ▼ + A 俯冲滑行',
      '按左右键翻滚前行；按【下+A键】压扁俯冲滑行钻缝！',
      '💡 技巧：遇到1格矮洞按住下+按A即可一滑到底，净空不足自动保持趴姿'
    );

    // Card 2: 跳跃与踩泡二段跳
    drawCard(8, 69, 304, 38, '#ffe040',
      '【A 键】弹性跳跃  |  空中踩泡二段跳',
      '果冻弹力起跳；在空中下落踩在气泡顶端可借力再次高跳！',
      '💡 技巧：踩在绿萌萌的翡翠弹力泡上，可触发超强蓄力火箭跳！'
    );

    // Card 3: 吐属性泡泡与随时换人
    drawCard(8, 111, 304, 46, '#ff80b0',
      '【B 键】吐属性泡泡  |  【SELECT】随时切换队长',
      '🟡大黄:固化跳台 🔵蓝波:升空气囊 🌸粉嘟:爬墙粘梯',
      '🟢绿萌:强力蹦床 🟣紫灵:爆破碎石  根据机关随时按SEL轮换！'
    );

    // Card 4: 通关目标
    drawCard(8, 161, 304, 30, '#ffd700',
      '终极目标：收集全部 💧彩虹露珠，解封泉门通关！',
      '收集齐关卡内所有露珠后，紧闭的石门自动打开，跳入泉水过关！'
    );

    // Bottom Pulsing Call to Action
    const btnPulse = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(0, 255, 180, ${0.15 * btnPulse})`;
    ctx.fillRect(35, 198, 250, 26);
    ctx.strokeStyle = `rgba(0, 255, 180, ${btnPulse})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, 198, 250, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('👉 按 [A] 键 正式开始冒险 👈', this.width / 2, 215);

    ctx.fillStyle = '#8f9cb8';
    ctx.font = '8px ' + SquishyFX.FONT;
    ctx.fillText('( 或点击屏幕任何位置开始 )', this.width / 2, 234);
  }

  renderPauseOverlay(ctx) {
    ctx.fillStyle = 'rgba(20, 12, 8, 0.35)';
    ctx.fillRect(0, 0, this.width, this.height);
    SquishyFX.panel(ctx, 60, 80, this.width - 120, 80, { r: 12, lw: 1.8 });

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('⏸ 游戏已暂停', this.width / 2, 115);
    ctx.font = '10px ' + SquishyFX.FONT;
    ctx.fillStyle = '#ffd700';
    ctx.fillText('按 START 或 点击继续', this.width / 2, 138);
    ctx.textAlign = 'left';
  }

  renderVictoryOverlay(ctx) {
    ctx.fillStyle = 'rgba(20, 12, 8, 0.35)';
    ctx.fillRect(0, 0, this.width, this.height);
    SquishyFX.panel(ctx, 20, 40, this.width - 40, 160, { r: 12, lw: 2, border: '#7CF0B0' });
    // the five buddies celebrate along the top of the card
    const vt = this.fxTime || 0;
    BUDDY_KEYS.forEach((k, i) => {
      const type = BUDDY_TYPES[k];
      const ph = (vt * 1.6 + i * 0.2) % 1;
      const hop = Math.sin(ph * Math.PI) * 8;
      const sy = (ph < 0.12 || ph > 0.9) ? 0.82 : 1.08;
      SquishyFX.drawBuddy(ctx, this.width / 2 + (i - 2) * 36, 190 - hop, SquishyFX.ACTIVE_S * 0.9, type, { sx: 1 / Math.sqrt(sy), sy, eyes: 'happy', look: 0.3 });
    });

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 18px ' + SquishyFX.FONT;
    ctx.textAlign = 'center';
    ctx.fillText('🎉 全员通关·彩虹泉复苏！', this.width / 2, 76);

    ctx.fillStyle = '#ffd700';
    ctx.font = '11px ' + SquishyFX.FONT;
    ctx.fillText('恭喜软乎乎五兄弟找回全部色彩', this.width / 2, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ' + SquishyFX.FONT;
    ctx.fillText('👉 按 A 或 点击重玩 👈', this.width / 2, 126);
    ctx.textAlign = 'left';
  }

  renderGameOverOverlay(ctx) {
    const FX = SquishyFX;
    const t = this.fxTime || 0;
    ctx.fillStyle = 'rgba(18, 8, 16, 0.55)';
    ctx.fillRect(0, 0, this.width, this.height);
    FX.panel(ctx, 26, 42, this.width - 52, 156, {
      r: 12,
      lw: 2,
      border: '#FF4D6D',
      top: 'rgba(54, 22, 36, 0.96)',
      bottom: 'rgba(24, 10, 18, 0.96)'
    });

    FX.text(ctx, '💔 生命耗尽 · 冒险失败', this.width / 2, 74, {
      size: 16,
      color: '#FF6B88',
      align: 'center',
      stroke: '#2A0812',
      strokeW: 3
    });
    FX.text(ctx, '5 颗水滴之心已全部破碎，请重整旗鼓！', this.width / 2, 95, {
      size: 9.5,
      weight: 'normal',
      color: '#F0D8E0',
      align: 'center'
    });

    // Draw squished dizzy droplet buddy in the middle
    const type = this.player ? this.player.type : BUDDY_TYPES.YELLOW;
    const wobble = Math.sin(t * 5) * 0.06;
    FX.drawBuddy(ctx, this.width / 2, 146, FX.ACTIVE_S * 1.05, type, {
      sx: 1.22 + wobble,
      sy: 0.72 - wobble * 0.5,
      eyes: 'squint',
      mouth: 'o',
      look: Math.sin(t * 3) * 0.5
    });

    const pulse = 0.75 + 0.25 * Math.sin(t * 6);
    FX.text(ctx, '👉 按 A / START 从第一关重新开始 👈', this.width / 2, 178, {
      size: 11,
      color: '#FFD454',
      align: 'center',
      alpha: pulse
    });
  }

  animate(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.fxTime += dt; // visual clock - keeps ambience & idle animations alive in every game state
    if (this.secretBannerTimer > 0) this.secretBannerTimer = Math.max(0, this.secretBannerTimer - dt);
    this.update(dt);
    this.render();

    requestAnimationFrame(this.animate);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.squishyApp = new SquishyGame();
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('autostart') === '1') {
    window.squishyApp.startGame();
    if (sp.has('level')) {
      window.squishyApp.loadLevel(parseInt(sp.get('level'), 10));
    }
    if (sp.get('action') === 'bubble') {
      window.squishyApp.player.x = 88;
      window.squishyApp.player.y = 180;
      window.squishyApp.player.facing = 1;
      const b1 = window.squishyApp.player.spitBubble();
      if (b1) {
        b1.x = 130;
        b1.y = 145;
        b1.scale = 1.0;
        window.squishyApp.bubbles.push(b1);
      }
      window.squishyApp.player.nextBuddy();
      const b2 = window.squishyApp.player.spitBubble();
      if (b2) {
        b2.x = 185;
        b2.y = 100;
        b2.scale = 0.95;
        window.squishyApp.bubbles.push(b2);
      }
      window.squishyApp.player.nextBuddy();
    }
  }
});
