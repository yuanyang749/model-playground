/* ==========================================================================
   Main Game Engine & Controller Router
   ========================================================================== */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.stage = 1;
    this.score = 0;
    this.playerLives = 3;
    this.state = 'TITLE';

    this.map = generateMap(this.stage);
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.particles = [];
    this.explosions = [];

    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.freezeTimer = 0;
    this.shovelTimer = 0;

    // Movement & fire inputs
    this.touchDir = null;
    this.isFiringA = false;
    this.isFiringB = false;

    this.keyState = {
      up: false,
      down: false,
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

  initEnvironment() {
    if (window.self !== window.top || new URLSearchParams(window.location.search).get('embedded') === '1') {
      document.body.classList.add('embedded');
    }
    if (new URLSearchParams(window.location.search).get('autostart') === '1') {
      this.startStage(1);
    }
  }

  initMobileControls() {
    const unlockAudio = () => {
      sound.init();
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });

    const dpadZone = document.getElementById('dpadZone');
    const dpadDot = document.getElementById('dpadDot');
    const armUp = document.getElementById('arm-up');
    const armDown = document.getElementById('arm-down');
    const armLeft = document.getElementById('arm-left');
    const armRight = document.getElementById('arm-right');

    if (dpadZone && dpadDot) {
      let isTouchingDpad = false;
      let dpadCenterX = 0;
      let dpadCenterY = 0;
      const maxRadius = 38;

      const setDirection = (dir, dx = 0, dy = 0) => {
        if (this.touchDir !== dir && dir !== null) {
          sound.vibrate(10);
        }
        this.touchDir = dir;

        if (armUp) armUp.classList.toggle('active', dir === DIR_UP);
        if (armDown) armDown.classList.toggle('active', dir === DIR_DOWN);
        if (armLeft) armLeft.classList.toggle('active', dir === DIR_LEFT);
        if (armRight) armRight.classList.toggle('active', dir === DIR_RIGHT);

        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * clamped;
        const ky = Math.sin(angle) * clamped;
        dpadDot.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      };

      const resetDpad = () => {
        isTouchingDpad = false;
        this.touchDir = null;
        if (armUp) armUp.classList.remove('active');
        if (armDown) armDown.classList.remove('active');
        if (armLeft) armLeft.classList.remove('active');
        if (armRight) armRight.classList.remove('active');
        dpadDot.style.transform = `translate(-50%, -50%)`;
      };

      const handleDpadCoord = (clientX, clientY) => {
        const dx = clientX - dpadCenterX;
        const dy = clientY - dpadCenterY;
        const dist = Math.hypot(dx, dy);
        const deadzone = 12;

        if (dist < deadzone) {
          setDirection(null, dx, dy);
          return;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          setDirection(dx > 0 ? DIR_RIGHT : DIR_LEFT, dx, dy);
        } else {
          setDirection(dy > 0 ? DIR_DOWN : DIR_UP, dx, dy);
        }
      };

      dpadZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sound.init();
        const rect = dpadZone.getBoundingClientRect();
        dpadCenterX = rect.left + rect.width / 2;
        dpadCenterY = rect.top + rect.height / 2;
        isTouchingDpad = true;

        const touch = e.touches[0];
        handleDpadCoord(touch.clientX, touch.clientY);
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        if (!isTouchingDpad) return;
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          const dx = touch.clientX - dpadCenterX;
          const dy = touch.clientY - dpadCenterY;
          if (Math.hypot(dx, dy) < maxRadius * 3.0) {
            handleDpadCoord(touch.clientX, touch.clientY);
            break;
          }
        }
      }, { passive: false });

      window.addEventListener('touchend', (e) => {
        if (isTouchingDpad && e.touches.length === 0) resetDpad();
      });
      window.addEventListener('touchcancel', () => resetDpad());
    }

    const btnFire = document.getElementById('btn-fire');
    const btnTurbo = document.getElementById('btn-turbo');

    const bindBtn = (el, onStart, onEnd) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sound.init();
        el.classList.add('active');
        onStart();
      }, { passive: false });
      const end = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        onEnd();
      };
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
    };

    bindBtn(btnFire, () => { this.isFiringA = true; }, () => { this.isFiringA = false; });
    bindBtn(btnTurbo, () => { this.isFiringB = true; }, () => { this.isFiringB = false; });

    // Touch screen canvas actions
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sound.init();
      this.handleScreenAction();
    }, { passive: false });

    // System button listeners
    const btnSound = document.getElementById('btn-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        sound.init();
        sound.enabled = !sound.enabled;
        btnSound.innerText = `🔊 声音: ${sound.enabled ? '开' : '关'}`;
      });
    }
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => this.togglePause());

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        sound.init();
        this.startStage(1);
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
      sound.init();
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.keyState.up = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.keyState.down = true;
          e.preventDefault();
          break;
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
        case 'KeyR':
          this.startStage(1);
          e.preventDefault();
          break;
        case 'KeyP':
          this.togglePause();
          e.preventDefault();
          break;
      }
      this.syncKeyboardToDirection();
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.keyState.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.keyState.down = false;
          break;
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
      this.syncKeyboardToDirection();
    });
  }

  syncKeyboardToDirection() {
    if (this.keyState.up) this.touchDir = DIR_UP;
    else if (this.keyState.down) this.touchDir = DIR_DOWN;
    else if (this.keyState.left) this.touchDir = DIR_LEFT;
    else if (this.keyState.right) this.touchDir = DIR_RIGHT;
    else this.touchDir = null;

    this.isFiringA = this.keyState.fireA;
    this.isFiringB = this.keyState.fireB;
  }

  initGameBoyBridge() {
    // Inter-window communication from Game Boy host chassis
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'GB_INPUT') return;
      sound.init();
      const { key, pressed } = event.data;

      switch (key) {
        case 'UP':
          this.keyState.up = pressed;
          break;
        case 'DOWN':
          this.keyState.down = pressed;
          break;
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
            sound.enabled = !sound.enabled;
            const btnSound = document.getElementById('btn-sound');
            if (btnSound) btnSound.innerText = `🔊 声音: ${sound.enabled ? '开' : '关'}`;
          }
          break;
      }
      this.syncKeyboardToDirection();
    });
  }

  handleScreenAction() {
    if (this.state === 'TITLE' || this.state === 'GAMEOVER') {
      this.startStage(1);
    } else if (this.state === 'STAGECLEAR') {
      this.startStage(this.stage + 1);
    } else if (this.state === 'PAUSED') {
      this.togglePause();
    }
  }

  handleStartAction() {
    if (this.state === 'TITLE' || this.state === 'GAMEOVER') {
      this.startStage(1);
    } else if (this.state === 'STAGECLEAR') {
      this.startStage(this.stage + 1);
    } else if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.togglePause();
    }
  }

  startStage(stageNum) {
    this.stage = stageNum;
    this.map = generateMap(this.stage);
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.explosions = [];
    this.freezeTimer = 0;
    this.shovelTimer = 0;

    this.spawnQueue = [];
    for (let i = 0; i < 20; i++) {
      if (i === 4 || i === 11 || i === 18) this.spawnQueue.push('bonus');
      else if (i % 4 === 1) this.spawnQueue.push('fast');
      else if (i % 4 === 3) this.spawnQueue.push('armor');
      else this.spawnQueue.push('basic');
    }

    this.respawnPlayer();
    this.state = 'PLAYING';
    this.stageBannerTimer = 2.2;
    sound.playStageStart();
    this.updateHUD();
  }

  respawnPlayer() {
    this.player = new PlayerTank(8 * TILE_SIZE, 24 * TILE_SIZE);
  }

  togglePause() {
    const now = performance.now();
    if (this._lastPauseToggle && now - this._lastPauseToggle < 200) return;
    this._lastPauseToggle = now;
    if (this.state === 'PLAYING') this.state = 'PAUSED';
    else if (this.state === 'PAUSED') this.state = 'PLAYING';
  }

  destroyBase() {
    this.map[24][12] = T_BASE_RUIN;
    this.map[24][13] = T_BASE_RUIN;
    this.map[25][12] = T_BASE_RUIN;
    this.map[25][13] = T_BASE_RUIN;
    this.spawnExplosion(13 * TILE_SIZE, 25 * TILE_SIZE, true);
    sound.playExplosion();
    this.gameOver();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    sound.playGameOver();
  }

  checkStageClear() {
    if (this.spawnQueue.length === 0 && this.enemies.filter(e => e.alive).length === 0) {
      this.state = 'STAGECLEAR';
      sound.playPowerup();
    }
  }

  spawnPowerup(x, y) {
    const types = ['star', 'bomb', 'timer', 'shield', 'shovel'];
    const chosen = types[Math.floor(Math.random() * types.length)];
    this.powerups.push(new Powerup(x, y, chosen));
  }

  spawnExplosion(x, y, isBig = false) {
    this.explosions.push(new Explosion(x, y, isBig));
  }

  spawnSparks(x, y, color = '#ffeb3b') {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 60 + 20;
      this.particles.push(new Particle(
        x, y, color, 2,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        0.15 + Math.random() * 0.1
      ));
    }
  }

  updateHUD() {
    const elLives = document.getElementById('hudLives');
    const elScore = document.getElementById('hudScore');
    const elStage = document.getElementById('hudStage');
    const elEnemies = document.getElementById('hudEnemies');
    if (elLives) elLives.innerText = this.playerLives;
    if (elScore) elScore.innerText = this.score;
    if (elStage) elStage.innerText = this.stage;
    if (elEnemies) elEnemies.innerText = this.spawnQueue.length + this.enemies.filter(e => e.alive).length;
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    if (this.stageBannerTimer > 0) this.stageBannerTimer -= dt;
    if (this.freezeTimer > 0) this.freezeTimer -= dt;

    if (this.shovelTimer > 0) {
      this.shovelTimer -= dt;
      if (this.shovelTimer <= 0) {
        for (let r = 23; r <= 25; r++) {
          for (let c = 11; c <= 14; c++) {
            if (!(r >= 24 && (c === 12 || c === 13))) this.map[r][c] = T_BRICK;
          }
        }
      }
    }

    // Active Overlap Depenetration Physics
    Physics.resolveAllTankOverlaps(this);

    // Player Movement & Weapons
    if (this.player && this.player.alive) {
      this.player.shieldTimer = Math.max(0, this.player.shieldTimer - dt);
      this.player.reloadTimer -= dt;

      if (this.touchDir !== null) {
        this.player.move(dt, this.touchDir, this);
      }

      if (this.isFiringA || this.isFiringB) {
        if (this.isFiringB) {
          this.player.reloadTimer = Math.min(this.player.reloadTimer, 0.18);
        }
        this.player.fire(this);
      }
    }

    // Spawn Enemies
    this.spawnTimer += dt;
    if (this.spawnTimer > 2.5 && this.spawnQueue.length > 0 && this.enemies.filter(e => e.alive).length < 4) {
      const spawnCols = [0, 12, 24];
      const allActiveTanks = [...this.enemies];
      if (this.player && this.player.alive) allActiveTanks.push(this.player);

      const validCols = spawnCols.filter(col => {
        const sx = col * TILE_SIZE;
        const sy = 0;
        for (let t of allActiveTanks) {
          if (t.alive && Physics.checkAABB(sx, sy, 28, 28, t.x, t.y, t.size, t.size)) {
            return false;
          }
        }
        return true;
      });

      if (validCols.length > 0) {
        this.spawnTimer = 0;
        const sc = validCols[Math.floor(Math.random() * validCols.length)];
        const type = this.spawnQueue.shift();
        this.enemies.push(new EnemyTank(sc * TILE_SIZE, 0, type));
        this.updateHUD();
      }
    }

    for (let enemy of this.enemies) {
      if (enemy.alive) enemy.update(dt, this);
    }

    for (let bullet of this.bullets) {
      if (bullet.alive) bullet.update(dt, this);
    }
    this.bullets = this.bullets.filter(b => b.alive);

    for (let p of this.powerups) {
      p.update(dt);
      if (p.alive && this.player && this.player.alive) {
        if (Physics.checkAABB(this.player.x, this.player.y, this.player.size, this.player.size, p.x, p.y, p.size, p.size)) {
          p.alive = false;
          sound.playPowerup();
          this.score += 500;
          this.updateHUD();

          if (p.type === 'star') {
            this.player.speed = Math.min(145, this.player.speed + 15);
            this.player.reloadTime = Math.max(0.2, this.player.reloadTime - 0.08);
          } else if (p.type === 'shield') {
            this.player.shieldTimer = 8.0;
          } else if (p.type === 'bomb') {
            for (let enemy of this.enemies) {
              if (enemy.alive) enemy.hit(999, this);
            }
          } else if (p.type === 'timer') {
            this.freezeTimer = 8.0;
          } else if (p.type === 'shovel') {
            this.shovelTimer = 12.0;
            for (let r = 23; r <= 25; r++) {
              for (let c = 11; c <= 14; c++) {
                if (!(r >= 24 && (c === 12 || c === 13))) this.map[r][c] = T_STEEL;
              }
            }
          }
        }
      }
    }
    this.powerups = this.powerups.filter(p => p.alive);

    for (let pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(pt => pt.life > 0);

    for (let ex of this.explosions) ex.update(dt);
    this.explosions = this.explosions.filter(ex => ex.alive);
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Map tiles
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.map[r][c];
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        if (tile === T_BRICK) {
          ctx.fillStyle = '#b7410e';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#3e1808';
          ctx.fillRect(px, py + 7, TILE_SIZE, 2);
          ctx.fillRect(px + 7, py, 2, 8);
          ctx.fillRect(px + 3, py + 8, 2, 8);
        } else if (tile === T_STEEL) {
          ctx.fillStyle = '#cfd8dc';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = '#90a4ae';
          ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else if (tile === T_WATER) {
          ctx.fillStyle = '#1e88e5';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#64b5f6';
          const wave = Math.floor(Date.now() / 250) % 2 * 3;
          ctx.fillRect(px + wave, py + 4, 8, 2);
          ctx.fillRect(px + 6 - wave, py + 10, 8, 2);
        } else if (tile === T_BASE) {
          if (r === 24 && c === 12) {
            ctx.fillStyle = '#ffb300';
            ctx.fillRect(px, py, TILE_SIZE * 2, TILE_SIZE * 2);
            ctx.fillStyle = '#d32f2f';
            ctx.fillRect(px + 4, py + 4, 24, 24);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(px + 16, py + 14, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff8f00';
            ctx.fillRect(px + 10, py + 18, 12, 10);
          }
        } else if (tile === T_BASE_RUIN) {
          if (r === 24 && c === 12) {
            ctx.fillStyle = '#424242';
            ctx.fillRect(px, py, TILE_SIZE * 2, TILE_SIZE * 2);
            ctx.fillStyle = '#ff5722';
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀', px + 16, py + 22);
          }
        }
      }
    }

    for (let p of this.powerups) p.draw(ctx);
    if (this.player && this.player.alive) this.player.draw(ctx);
    for (let enemy of this.enemies) {
      if (enemy.alive) enemy.draw(ctx);
    }
    for (let bullet of this.bullets) bullet.draw(ctx);

    // Forest canopy renders on top of tanks
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        if (this.map[r][c] === T_TREE) {
          const px = c * TILE_SIZE;
          const py = r * TILE_SIZE;
          ctx.fillStyle = '#2e7d32';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#4caf50';
          ctx.fillRect(px + 2, py + 2, 5, 5);
          ctx.fillRect(px + 9, py + 8, 5, 5);
        }
      }
    }

    for (let pt of this.particles) pt.draw(ctx);
    for (let ex of this.explosions) ex.draw(ctx);

    // Overlay Screens
    if (this.state === 'TITLE') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('像素坦克大战', CANVAS_WIDTH / 2, 135);

      ctx.fillStyle = '#bbb';
      ctx.font = '14px sans-serif';
      ctx.fillText('RETRO TANK 1990', CANVAS_WIDTH / 2, 170);

      ctx.fillStyle = '#ff3344';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('👉 按 A 或 点击屏幕 开始 👈', CANVAS_WIDTH / 2, 255);

      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('十字键移动 | A / B 键开火', CANVAS_WIDTH / 2, 320);
    } else if (this.state === 'PAUSED') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ 游戏已暂停', CANVAS_WIDTH / 2, 190);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('按 START 或 轻触继续', CANVAS_WIDTH / 2, 235);
    } else if (this.state === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(180, 0, 0, 0.55)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 160);

      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`最终得分: ${this.score}`, CANVAS_WIDTH / 2, 210);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('👉 按 A 或 点击屏幕重新挑战 👈', CANVAS_WIDTH / 2, 270);
    } else if (this.state === 'STAGECLEAR') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#4caf50';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${this.stage} 关 胜利!`, CANVAS_WIDTH / 2, 145);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText(`★ NEXT: ${getStageName(this.stage + 1)} ★`, CANVAS_WIDTH / 2, 190);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('👉 按 A 或 点击屏幕进入下一关 👈', CANVAS_WIDTH / 2, 245);
    }

    // Temporary Stage Start Banner
    if (this.state === 'PLAYING' && this.stageBannerTimer > 0) {
      ctx.save();
      const alpha = Math.min(1, this.stageBannerTimer * 1.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(24, 180, CANVAS_WIDTH - 48, 56);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 180, CANVAS_WIDTH - 48, 56);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`★ STAGE ${this.stage} ★`, CANVAS_WIDTH / 2, 203);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText(getStageName(this.stage), CANVAS_WIDTH / 2, 224);
      ctx.restore();
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
  window.gameInstance = new Game();
  window.gameInstance.run();
});
