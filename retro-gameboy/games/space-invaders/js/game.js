/* ==========================================================================
   Space Invaders Main Game Engine & Controller Router
   ========================================================================== */

class SpaceInvadersGame {
  constructor() {
    this.canvas = document.getElementById('invadersCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.width = 320;
    this.height = 400;

    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('space_invaders_hi') || '0', 10);
    this.wave = 1;
    this.lives = 3;
    this.state = 'TITLE';

    this.player = new PlayerCannon(this.width, this.height);
    this.grid = new InvaderGrid(this.width, this.height);
    this.shields = [];
    this.initShields();

    this.lasers = [];
    this.particles = [];

    // Controller state
    this.moveDir = 0; // -1, 0, 1
    this.isFiringA = false;
    this.isFiringB = false;
    this.fireCooldown = 0;

    this.keyState = {
      left: false,
      right: false,
      fireA: false,
      fireB: false
    };

    this.lastTime = performance.now();

    this.initEnvironment();
    this.initMobileControls();
    this.initKeyboardControls();
    this.initGameBoyBridge();
    this.updateHUD();
  }

  initShields() {
    this.shields = [];
    const bunkerCount = 4;
    const bunkerW = 42;
    const bunkerH = 26;
    const spacing = (this.width - (bunkerCount * bunkerW)) / (bunkerCount + 1);

    for (let i = 0; i < bunkerCount; i++) {
      const bx = spacing + i * (bunkerW + spacing);
      const by = this.height - 84;
      this.shields.push(new ShieldBunker(bx, by, bunkerW, bunkerH));
    }
  }

  initEnvironment() {
    if (window.self !== window.top || new URLSearchParams(window.location.search).get('embedded') === '1') {
      document.body.classList.add('embedded');
    }
    if (new URLSearchParams(window.location.search).get('autostart') === '1') {
      this.startWave(1);
    }
  }

  initMobileControls() {
    const unlockAudio = () => {
      invadersSound.init();
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });

    // Left / Right direction buttons
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');

    const bindTouchDir = (el, dir) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        invadersSound.init();
        el.classList.add('active');
        this.moveDir = dir;
      }, { passive: false });

      const onEnd = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        if (this.moveDir === dir) this.moveDir = 0;
      };
      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onEnd, { passive: false });
    };

    bindTouchDir(btnLeft, -1);
    bindTouchDir(btnRight, 1);

    // Fire buttons
    const btnFire = document.getElementById('btn-fire');
    const btnTurbo = document.getElementById('btn-turbo');

    const bindTouchAction = (el, onStart, onEnd) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        invadersSound.init();
        el.classList.add('active');
        onStart();
      }, { passive: false });

      const onDone = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        onEnd();
      };
      el.addEventListener('touchend', onDone, { passive: false });
      el.addEventListener('touchcancel', onDone, { passive: false });
    };

    bindTouchAction(btnFire, () => {
      this.isFiringA = true;
      this.handleScreenAction();
    }, () => { this.isFiringA = false; });

    bindTouchAction(btnTurbo, () => {
      this.isFiringB = true;
    }, () => { this.isFiringB = false; });

    // Screen click to start / resume
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      invadersSound.init();
      this.handleScreenAction();
    }, { passive: false });

    // System buttons
    const btnSound = document.getElementById('btn-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        invadersSound.init();
        invadersSound.enabled = !invadersSound.enabled;
        btnSound.innerText = `🔊 声音: ${invadersSound.enabled ? '开' : '关'}`;
      });
    }

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => this.togglePause());

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        invadersSound.init();
        this.startNewGame();
      });
    }

    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }

  initKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      invadersSound.init();
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keyState.left = true;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keyState.right = true;
          e.preventDefault();
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          this.keyState.fireA = true;
          this.handleScreenAction();
          e.preventDefault();
          break;
        case 'KeyK':
        case 'KeyX':
          this.keyState.fireB = true;
          e.preventDefault();
          break;
        case 'Enter':
          this.handleStartAction();
          e.preventDefault();
          break;
        case 'KeyP':
          this.togglePause();
          e.preventDefault();
          break;
        case 'KeyR':
          this.startNewGame();
          e.preventDefault();
          break;
      }
      this.syncKeyboard();
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keyState.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keyState.right = false;
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          this.keyState.fireA = false;
          break;
        case 'KeyK':
        case 'KeyX':
          this.keyState.fireB = false;
          break;
      }
      this.syncKeyboard();
    });
  }

  syncKeyboard() {
    if (this.keyState.left) this.moveDir = -1;
    else if (this.keyState.right) this.moveDir = 1;
    else this.moveDir = 0;

    this.isFiringA = this.keyState.fireA;
    this.isFiringB = this.keyState.fireB;
  }

  initGameBoyBridge() {
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'GB_INPUT') return;
      invadersSound.init();
      const { key, pressed } = event.data;

      switch (key) {
        case 'LEFT':
          this.keyState.left = pressed;
          break;
        case 'RIGHT':
          this.keyState.right = pressed;
          break;
        case 'A':
          this.keyState.fireA = pressed;
          if (pressed) this.handleScreenAction();
          break;
        case 'B':
          this.keyState.fireB = pressed;
          break;
        case 'START':
          if (pressed) this.handleStartAction();
          break;
        case 'SELECT':
          if (pressed) {
            invadersSound.enabled = !invadersSound.enabled;
            const btnSound = document.getElementById('btn-sound');
            if (btnSound) btnSound.innerText = `🔊 声音: ${invadersSound.enabled ? '开' : '关'}`;
          }
          break;
      }
      this.syncKeyboard();
    });
  }

  handleScreenAction() {
    if (this.state === 'TITLE' || this.state === 'GAMEOVER') {
      this.startNewGame();
    } else if (this.state === 'WAVECLEAR') {
      this.startWave(this.wave + 1);
    } else if (this.state === 'PAUSED') {
      this.togglePause();
    }
  }

  handleStartAction() {
    if (this.state === 'TITLE' || this.state === 'GAMEOVER') {
      this.startNewGame();
    } else if (this.state === 'WAVECLEAR') {
      this.startWave(this.wave + 1);
    } else if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.togglePause();
    }
  }

  startNewGame() {
    this.score = 0;
    this.wave = 1;
    this.lives = 3;
    this.lasers = [];
    this.particles = [];
    this.initShields();
    this.player.reset();
    this.grid.reset();
    this.state = 'PLAYING';
    this.updateHUD();
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.lasers = [];
    this.particles = [];
    this.player.reset();
    this.grid.reset();
    this.state = 'PLAYING';
    this.updateHUD();
  }

  togglePause() {
    const now = performance.now();
    if (this._lastPauseToggle && now - this._lastPauseToggle < 200) return;
    this._lastPauseToggle = now;
    if (this.state === 'PLAYING') this.state = 'PAUSED';
    else if (this.state === 'PAUSED') this.state = 'PLAYING';
  }

  gameOver() {
    this.state = 'GAMEOVER';
    invadersSound.stopUfo();
    invadersSound.playPlayerHit();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('space_invaders_hi', this.highScore.toString());
    }
    this.updateHUD();
  }

  updateHUD() {
    const elScore = document.getElementById('hudScore');
    const elLives = document.getElementById('hudLives');
    const elWave = document.getElementById('hudWave');
    const elHi = document.getElementById('hudHi');

    if (elScore) elScore.innerText = this.score;
    if (elLives) elLives.innerText = this.lives;
    if (elWave) elWave.innerText = this.wave;
    if (elHi) elHi.innerText = Math.max(this.score, this.highScore);
  }

  spawnSparks(x, y, color = '#00ff66', count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 80 + 30;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: Math.random() * 2.5 + 1.5,
        life: 0.25 + Math.random() * 0.15
      });
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Update Player & Lasers
    this.player.update(dt);
    if (this.player.alive && !this.player.isDying) {
      if (this.moveDir !== 0) {
        this.player.move(this.moveDir, dt);
      }

      this.fireCooldown -= dt;
      const canShootNormal = this.isFiringA && this.fireCooldown <= 0 && this.lasers.length === 0;
      const canShootTurbo = this.isFiringB && this.fireCooldown <= 0 && this.lasers.length < 3;

      if (canShootNormal || canShootTurbo) {
        const lx = this.player.x + this.player.width / 2 - 1.5;
        const ly = this.player.y - 4;
        this.lasers.push(new PlayerLaser(lx, ly));
        invadersSound.playShoot();
        this.fireCooldown = canShootTurbo ? 0.18 : 0.28;
      }
    } else if (!this.player.alive && !this.player.isDying) {
      // Player lost a life
      this.lives--;
      this.updateHUD();
      if (this.lives > 0) {
        this.player.reset();
      } else {
        this.gameOver();
        return;
      }
    }

    for (let l of this.lasers) l.update(dt);
    this.lasers = this.lasers.filter(l => l.alive);

    // Update Invaders
    this.grid.update(dt, this.player.y);

    // Check if aliens breached to player bottom
    if (this.grid.hasInvasionReachedBottom(this.height - 40)) {
      this.gameOver();
      return;
    }

    // Check if all aliens killed -> Wave clear!
    if (this.grid.getAliveCount() === 0) {
      this.state = 'WAVECLEAR';
      invadersSound.playUfoHit();
      this.score += 1000;
      this.updateHUD();
      return;
    }

    // ================= COLLISION LOGIC =================
    // 1. Player laser vs Mystery UFO
    for (let l of this.lasers) {
      if (!l.alive) continue;
      const u = this.grid.ufo;
      if (u.alive && l.x > u.x && l.x < u.x + u.width && l.y > u.y && l.y < u.y + u.height) {
        l.alive = false;
        const pts = u.hit();
        this.score += pts;
        this.spawnSparks(l.x, l.y, '#ff2255', 16);
        this.updateHUD();
      }
    }

    // 2. Player laser vs Invaders
    for (let l of this.lasers) {
      if (!l.alive) continue;
      for (let a of this.grid.aliens) {
        if (!a.alive) continue;
        if (l.x > a.x && l.x < a.x + this.grid.invaderWidth &&
            l.y > a.y && l.y < a.y + this.grid.invaderHeight) {
          l.alive = false;
          a.alive = false;
          this.score += a.points;
          this.spawnSparks(a.x + this.grid.invaderWidth / 2, a.y + this.grid.invaderHeight / 2, a.color, 12);
          invadersSound.playInvaderHit();
          this.updateHUD();
          break;
        }
      }
    }

    // 3. Player laser vs Shields (Damage shield from bottom)
    for (let l of this.lasers) {
      if (!l.alive) continue;
      for (let s of this.shields) {
        if (s.hits(l.x, l.y)) {
          l.alive = false;
          s.damage(l.x, l.y, 5);
          this.spawnSparks(l.x, l.y, '#00e5ff', 5);
          break;
        }
      }
    }

    // 4. Alien bombs vs Shields (Damage shield from top)
    for (let b of this.grid.bombs) {
      if (!b.alive) continue;
      for (let s of this.shields) {
        if (s.hits(b.x, b.y + b.height)) {
          b.alive = false;
          s.damage(b.x, b.y + b.height, 6);
          this.spawnSparks(b.x, b.y + b.height, '#00e5ff', 5);
          break;
        }
      }
    }

    // 5. Alien bombs vs Player lasers (Mid-air collision)
    for (let b of this.grid.bombs) {
      if (!b.alive) continue;
      for (let l of this.lasers) {
        if (!l.alive) continue;
        if (Math.abs(b.x - l.x) < 6 && Math.abs(b.y - l.y) < 8) {
          b.alive = false;
          l.alive = false;
          this.spawnSparks(b.x, b.y, '#ffff00', 8);
          break;
        }
      }
    }

    // 6. Alien bombs vs Player Cannon
    for (let b of this.grid.bombs) {
      if (!b.alive) continue;
      if (this.player.alive && !this.player.isDying) {
        if (b.x > this.player.x && b.x < this.player.x + this.player.width &&
            b.y + b.height > this.player.y && b.y < this.player.y + this.player.height) {
          b.alive = false;
          this.player.hit();
          this.spawnSparks(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#ff0055', 20);
          break;
        }
      }
    }

    // Update Particles
    for (let p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#060608';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle CRT scanline effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let y = 0; y < this.height; y += 4) {
      ctx.fillRect(0, y, this.width, 1);
    }

    // Draw Shields
    for (let s of this.shields) s.draw(ctx);

    // Draw Invaders, Bombs & UFO
    this.grid.draw(ctx);

    // Draw Player Lasers
    for (let l of this.lasers) l.draw(ctx);

    // Draw Player
    this.player.draw(ctx);

    // Draw Particles
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // Bottom Defensive Ground Line
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(0, this.height - 12, this.width, 1.5);

    // Overlay Screens
    if (this.state === 'TITLE') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#00ff66';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE INVADERS', this.width / 2, 90);

      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText('1978 RETRO ARCADE DEMO', this.width / 2, 115);

      // Score table preview
      ctx.textAlign = 'left';
      const tx = 76;
      ctx.fillStyle = '#ff2255';
      ctx.fillText('🛸  MYSTERY = ??? PTS', tx, 160);
      ctx.fillStyle = '#ff3366';
      ctx.fillText('👾  SQUID   = 30  PTS', tx, 185);
      ctx.fillStyle = '#ff9900';
      ctx.fillText('🦀  CRAB    = 20  PTS', tx, 210);
      ctx.fillStyle = '#00ff88';
      ctx.fillText('🐙  OCTOPUS = 10  PTS', tx, 235);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff0055';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('👉 按 A 或 点击屏幕 开始 👈', this.width / 2, 290);

      ctx.fillStyle = '#888';
      ctx.font = '11px monospace';
      ctx.fillText('◀ ▶ 移动 | A 单发 | B 极速', this.width / 2, 335);
    } else if (this.state === 'PAUSED') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ 游戏已暂停', this.width / 2, 180);
      ctx.fillStyle = '#00ff66';
      ctx.font = '13px monospace';
      ctx.fillText('按 START 或 轻触继续', this.width / 2, 220);
    } else if (this.state === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(160, 0, 30, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ff0055';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.width / 2, 150);

      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`最终得分: ${this.score}`, this.width / 2, 195);
      ctx.fillStyle = '#00ff66';
      ctx.fillText(`最高记录: ${this.highScore}`, this.width / 2, 225);

      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('👉 按 A 或 点击屏幕重开 👈', this.width / 2, 280);
    } else if (this.state === 'WAVECLEAR') {
      ctx.fillStyle = 'rgba(0, 50, 20, 0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#00ff66';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${this.wave} 波 全歼!`, this.width / 2, 160);

      ctx.fillStyle = '#ffff00';
      ctx.font = '14px monospace';
      ctx.fillText('+1000 战术奖励积分', this.width / 2, 200);

      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('👉 按 A 或 点击屏幕继续 👈', this.width / 2, 260);
    }
  }

  run() {
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(dt);
      this.draw();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener('load', () => {
  window.spaceInvadersInstance = new SpaceInvadersGame();
  window.spaceInvadersInstance.run();
});
