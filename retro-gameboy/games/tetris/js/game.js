/* ==========================================================================
   Tetris 1989 - Main Game Engine, Canvas Renderer & Controller Bridge
   ========================================================================== */

class TetrisGame {
  constructor() {
    this.canvas = document.getElementById('tetrisCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.board = new TetrisBoard();
    
    // Display scaling
    this.width = 360;
    this.height = 400;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Playfield layout parameters on 360x400 canvas (Enlarged Playfield Width)
    this.blockW = 21;
    this.blockH = 18;
    this.blockSize = 21; // Backward compatibility for any helper
    this.boardX = 12;
    this.boardY = 28;
    this.boardW = this.board.cols * this.blockW; // 210 px (Enlarged from 160px: +31.25% wider)
    this.boardH = this.board.rows * this.blockH; // 360 px

    // Game state
    this.state = 'TITLE'; // 'TITLE', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.lastTime = 0;
    this.dropCounter = 0;
    this.dropInterval = 800; // ms per drop at Level 1
    this.fastDrop = false;

    // Delayed Auto-Shift (DAS) for smooth sliding
    this.keyState = {
      left: false,
      right: false,
      down: false,
      a: false,
      b: false
    };
    this.dasTimer = { left: 0, right: 0 };
    this.dasDelay = 180; // initial delay before repeating
    this.dasRepeat = 50; // repeat interval

    // High Score
    this.highScore = parseInt(localStorage.getItem('gb_tetris_hi') || '10000', 10);

    // Audio & Haptics
    this.audio = window.tetrisAudio;
    this.hapticsEnabled = 'vibrate' in navigator;

    this.initControls();
    this.initGameBoyBridge();
    if (typeof URLSearchParams !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1') {
      this.startGame();
    }
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  vibrate(ms) {
    if (this.hapticsEnabled) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  startGame() {
    this.board.reset();
    this.state = 'PLAYING';
    this.dropCounter = 0;
    this.dropInterval = this.getSpeedForLevel(this.board.level);
    this.audio.init();
    this.audio.startBgm();
    this.updateDomHud();
  }

  getSpeedForLevel(lvl) {
    // Level 1: 800ms -> Level 10: 170ms -> Level 15+: 80ms
    return Math.max(80, 800 - (lvl - 1) * 70);
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

  /* ================= Input Bridge (Game Boy Controller & Standalone) ================= */

  initGameBoyBridge() {
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'GB_INPUT') return;
      this.audio.init();
      const { key, pressed } = event.data;

      if (this.state === 'TITLE') {
        if (pressed && (key === 'A' || key === 'START')) {
          this.startGame();
        }
        return;
      }

      if (this.state === 'GAMEOVER') {
        if (pressed && (key === 'A' || key === 'START')) {
          this.startGame();
        }
        return;
      }

      switch (key) {
        case 'LEFT':
          this.keyState.left = pressed;
          if (pressed) {
            if (this.board.move(-1)) {
              this.audio.playMove();
              this.vibrate(8);
            }
            this.dasTimer.left = performance.now() + this.dasDelay;
          }
          break;

        case 'RIGHT':
          this.keyState.right = pressed;
          if (pressed) {
            if (this.board.move(1)) {
              this.audio.playMove();
              this.vibrate(8);
            }
            this.dasTimer.right = performance.now() + this.dasDelay;
          }
          break;

        case 'DOWN':
          this.fastDrop = pressed;
          if (pressed) {
            if (this.board.drop()) {
              this.audio.playMove();
            }
          }
          break;

        case 'UP':
          // Hard drop on UP press
          if (pressed) {
            const dropDist = this.board.hardDrop();
            if (dropDist > 0) {
              this.audio.playDrop();
              this.vibrate([15, 20, 15]);
              this.dropCounter = 0;
            }
          }
          break;

        case 'A':
          // Rotate Clockwise
          if (pressed) {
            if (this.board.rotate(1)) {
              this.audio.playRotate();
              this.vibrate(10);
            }
          }
          break;

        case 'B':
          // Rotate Counter-Clockwise
          if (pressed) {
            if (this.board.rotate(-1)) {
              this.audio.playRotate();
              this.vibrate(10);
            }
          }
          break;

        case 'START':
          if (pressed) this.togglePause();
          break;

        case 'SELECT':
          if (pressed) {
            const bgmOn = this.audio.toggleBgm();
            const btn = document.getElementById('btn-sound');
            if (btn) btn.textContent = bgmOn ? '🔊 音乐' : '🔇 静音';
          }
          break;
      }
    });
  }

  initControls() {
    // Keyboard controls for standalone preview
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }
      this.handleVirtualKey(this.mapKeyCode(e.code), true);
    });

    window.addEventListener('keyup', (e) => {
      this.handleVirtualKey(this.mapKeyCode(e.code), false);
    });

    // Touch controls on canvas
    this.canvas.addEventListener('click', () => {
      this.audio.init();
      if (this.state === 'TITLE' || this.state === 'GAMEOVER') {
        this.startGame();
      }
    });

    // Standalone deck buttons
    const bindBtn = (id, keyName) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onDown = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        this.audio.init();
        this.handleVirtualKey(keyName, true);
      };
      const onUp = (e) => {
        this.handleVirtualKey(keyName, false);
      };
      el.addEventListener('touchstart', onDown, { passive: false });
      el.addEventListener('touchend', onUp);
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);
    };

    bindBtn('btn-left', 'LEFT');
    bindBtn('btn-right', 'RIGHT');
    bindBtn('btn-down', 'DOWN');
    bindBtn('btn-hard-drop', 'UP');
    bindBtn('btn-rot-cw', 'A');
    bindBtn('btn-rot-ccw', 'B');

    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const on = this.audio.toggleBgm();
        soundBtn.textContent = on ? '🔊 音乐' : '🔇 静音';
      });
    }

    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.startGame());
    }
  }

  mapKeyCode(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'LEFT';
      case 'ArrowRight': case 'KeyD': return 'RIGHT';
      case 'ArrowDown': case 'KeyS': return 'DOWN';
      case 'ArrowUp': case 'KeyW': case 'Space': return 'UP';
      case 'KeyJ': case 'KeyX': return 'A';
      case 'KeyK': case 'KeyZ': return 'B';
      case 'Enter': return 'START';
      case 'ShiftLeft': return 'SELECT';
      default: return null;
    }
  }

  handleVirtualKey(key, pressed) {
    if (!key) return;
    window.postMessage({ type: 'GB_INPUT', key, pressed }, '*');
  }

  /* ================= Game Loop & Logic Update ================= */

  update(deltaTime) {
    if (this.state !== 'PLAYING') return;

    // Handle line clear flash animation
    if (this.board.isClearingLines) {
      this.board.clearAnimationTimer--;
      if (this.board.clearAnimationTimer <= 0) {
        const cleared = this.board.finalizeLineClear();
        if (cleared === 4) {
          this.audio.playTetrisClear();
          this.vibrate([30, 40, 50, 40, 80]);
        } else if (cleared > 0) {
          this.audio.playLineClear();
          this.vibrate(25);
        }
        this.dropInterval = this.getSpeedForLevel(this.board.level);
        this.updateDomHud();
      }
      return;
    }

    // Check game over
    if (this.board.gameOver) {
      this.state = 'GAMEOVER';
      this.audio.stopBgm();
      this.audio.playGameOver();
      this.vibrate([100, 50, 100]);
      if (this.board.score > this.highScore) {
        this.highScore = this.board.score;
        localStorage.setItem('gb_tetris_hi', this.highScore.toString());
      }
      return;
    }

    // Handle DAS auto-shift for left/right smooth gliding
    const now = performance.now();
    if (this.keyState.left && now > this.dasTimer.left) {
      if (this.board.move(-1)) {
        this.audio.playMove();
        this.vibrate(5);
      }
      this.dasTimer.left = now + this.dasRepeat;
    }
    if (this.keyState.right && now > this.dasTimer.right) {
      if (this.board.move(1)) {
        this.audio.playMove();
        this.vibrate(5);
      }
      this.dasTimer.right = now + this.dasRepeat;
    }

    // Gravity drop timing
    const currentInterval = this.fastDrop ? Math.min(60, this.dropInterval / 8) : this.dropInterval;
    this.dropCounter += deltaTime;

    if (this.dropCounter >= currentInterval) {
      const moved = this.board.drop();
      if (!moved) {
        // Locked
        this.audio.playDrop();
        this.vibrate(12);
        this.updateDomHud();
      }
      this.dropCounter = 0;
    }
  }

  updateDomHud() {
    const elScore = document.getElementById('hudScore');
    const elLines = document.getElementById('hudLines');
    const elLevel = document.getElementById('hudLevel');
    const elHi = document.getElementById('hudHi');
    if (elScore) elScore.textContent = this.board.score;
    if (elLines) elLines.textContent = this.board.lines;
    if (elLevel) elLevel.textContent = this.board.level;
    if (elHi) elHi.textContent = Math.max(this.board.score, this.highScore);
  }

  /* ================= Graphics & Canvas Rendering ================= */

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. CRT / LCD Dot-Matrix Background
    ctx.fillStyle = '#9bbc0f'; // Authentic Game Boy LCD Light Green
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle LCD Scanline Pattern
    ctx.fillStyle = 'rgba(15, 56, 15, 0.05)';
    for (let y = 0; y < this.height; y += 3) {
      ctx.fillRect(0, y, this.width, 1);
    }

    // 2. Playfield Border & Frame
    this.renderPlayfieldFrame(ctx);

    // 3. Grid Cells & Fixed Blocks
    this.renderPlacedBlocks(ctx);

    // 4. Ghost Piece (Placement Projection Shadow)
    if (this.state === 'PLAYING' && !this.board.isClearingLines) {
      this.renderGhostPiece(ctx);
    }

    // 5. Active Falling Tetromino
    if (this.state === 'PLAYING' && this.board.currentPiece && !this.board.isClearingLines) {
      this.renderPiece(ctx, this.board.currentPiece, this.boardX, this.boardY);
    }

    // 6. Right Side Information Panel (HUD)
    this.renderSideHud(ctx);

    // 7. Overlay States (Title / Pause / Game Over)
    if (this.state === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.state === 'PAUSED') {
      this.renderPauseOverlay(ctx);
    } else if (this.state === 'GAMEOVER') {
      this.renderGameOverOverlay(ctx);
    }
  }

  renderPlayfieldFrame(ctx) {
    const bx = this.boardX;
    const by = this.boardY;
    const bw = this.boardW;
    const bh = this.boardH;

    // Darker LCD Playfield Inner Well
    ctx.fillStyle = '#8bac0f';
    ctx.fillRect(bx, by, bw, bh);

    // Outer Dual Inset Border
    ctx.strokeStyle = '#0f380f';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.strokeStyle = '#306230';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8);

    // Top Header Banner
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(0, 0, this.width, 24);

    ctx.fillStyle = '#9bbc0f';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText('★ TETRIS 1989 ★', 12, 17);

    ctx.fillStyle = '#8bac0f';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('GAME BOY DMG', this.width - 96, 17);
  }

  renderPlacedBlocks(ctx) {
    const grid = this.board.grid;
    for (let r = 0; r < this.board.rows; r++) {
      // Line Clear Flash Effect (invert color)
      const isClearing = this.board.isClearingLines && this.board.clearingRows.includes(r);
      for (let c = 0; c < this.board.cols; c++) {
        const val = grid[r][c];
        if (val !== 0) {
          const px = this.boardX + c * this.blockW;
          const py = this.boardY + r * this.blockH;
          if (isClearing && Math.floor(this.board.clearAnimationTimer / 2) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px, py, this.blockW, this.blockH);
          } else {
            this.drawSingleBlock(ctx, px, py, val, this.blockW, this.blockH);
          }
        }
      }
    }
  }

  renderGhostPiece(ctx) {
    const ghost = this.board.getGhostPosition();
    if (!ghost) return;
    const matrix = ghost.matrix;
    ctx.save();
    ctx.strokeStyle = 'rgba(15, 56, 15, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const px = this.boardX + (ghost.x + c) * this.blockW;
          const py = this.boardY + (ghost.y + r) * this.blockH;
          ctx.strokeRect(px + 1, py + 1, this.blockW - 2, this.blockH - 2);
        }
      }
    }
    ctx.restore();
  }

  renderPiece(ctx, piece, offsetX, offsetY) {
    const matrix = piece.matrix;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        const val = matrix[r][c];
        if (val !== 0) {
          const px = offsetX + (piece.x + c) * this.blockW;
          const py = offsetY + (piece.y + r) * this.blockH;
          this.drawSingleBlock(ctx, px, py, val, this.blockW, this.blockH);
        }
      }
    }
  }

  drawSingleBlock(ctx, x, y, typeId, w = this.blockW, h = this.blockH) {
    const palette = BLOCK_COLORS[typeId] || { base: '#306230', light: '#8bac0f', dark: '#0f380f' };

    // Base fill
    ctx.fillStyle = palette.base;
    ctx.fillRect(x, y, w, h);

    // 3D Beveled Highlight (Top & Left)
    ctx.fillStyle = palette.light;
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y, 2, h);

    // 3D Beveled Shadow (Bottom & Right)
    ctx.fillStyle = palette.dark;
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);

    // Inner Dot / Retro Texture
    ctx.fillStyle = palette.dark;
    ctx.fillRect(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2) - 1, 3, 3);
  }

  renderSideHud(ctx) {
    const hx = 232;
    const hw = 116;

    const drawCard = (y, h, title, val) => {
      ctx.fillStyle = '#8bac0f';
      ctx.fillRect(hx, y, hw, h);
      ctx.strokeStyle = '#0f380f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx, y, hw, h);

      ctx.fillStyle = '#0f380f';
      ctx.font = 'bold 8.5px "Courier New", monospace';
      ctx.fillText(title, hx + 6, y + 13);

      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toString(), hx + hw - 6, y + h - 6);
      ctx.textAlign = 'left';
    };

    // 1. Score Card
    drawCard(28, 38, 'SCORE 得分', this.board.score);

    // 2. Lines Card
    drawCard(72, 38, 'LINES 消行', this.board.lines);

    // 3. Level Card
    drawCard(116, 38, 'LEVEL 等级', this.board.level);

    // 4. Next Piece Preview Box
    const ny = 160;
    const nh = 74;
    ctx.fillStyle = '#8bac0f';
    ctx.fillRect(hx, ny, hw, nh);
    ctx.strokeStyle = '#0f380f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx, ny, hw, nh);

    ctx.fillStyle = '#0f380f';
    ctx.font = 'bold 8.5px "Courier New", monospace';
    ctx.fillText('NEXT 下一块', hx + 6, ny + 13);

    // Draw Next Piece Centered in Preview Box with crisp 15x15 preview blocks
    if (this.board.nextPiece) {
      const np = this.board.nextPiece;
      const m = np.matrix;
      const pw = 15;
      const ph = 15;
      const pieceW = m[0].length * pw;
      const pieceH = m.length * ph;
      const startX = hx + Math.floor((hw - pieceW) / 2);
      const startY = ny + 18 + Math.floor((nh - 22 - pieceH) / 2);

      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c] !== 0) {
            this.drawSingleBlock(ctx, startX + c * pw, startY + r * ph, m[r][c], pw, ph);
          }
        }
      }
    }

    // 5. Hi-Score Card
    drawCard(240, 38, 'TOP 最高分', Math.max(this.board.score, this.highScore));

    // 6. Retro Controls & System Helper Card
    const cy = 284;
    const ch = 104;
    ctx.fillStyle = '#8bac0f';
    ctx.fillRect(hx, cy, hw, ch);
    ctx.strokeStyle = '#0f380f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx, cy, hw, ch);

    ctx.fillStyle = '#0f380f';
    ctx.font = 'bold 8.5px "Courier New", monospace';
    ctx.fillText('CONTROLS 操作', hx + 6, cy + 13);
    ctx.font = '7.5px "Courier New", monospace';
    ctx.fillText('◀ ▶: 左右移动', hx + 6, cy + 30);
    ctx.fillText('▲  : 硬降落底', hx + 6, cy + 46);
    ctx.fillText('▼  : 软降加速', hx + 6, cy + 62);
    ctx.fillText('A  : 顺时旋转', hx + 6, cy + 78);
    ctx.fillText('B  : 逆时旋转', hx + 6, cy + 94);
  }

  renderTitleOverlay(ctx) {
    const tw = this.width - 40;
    ctx.fillStyle = 'rgba(15, 56, 15, 0.88)';
    ctx.fillRect(20, 95, tw, 210);
    ctx.strokeStyle = '#9bbc0f';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 97, tw - 4, 206);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TETRIS 1989', this.width / 2, 140);

    ctx.fillStyle = '#9bbc0f';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('GAME BOY RETRO EDITION', this.width / 2, 165);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('👉 按 A 或 点击开始 👈', this.width / 2, 210);

    ctx.fillStyle = '#8bac0f';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('十字键: 移动/速降  A/B: 旋转', this.width / 2, 240);
    ctx.fillText('SELECT: 音乐开关  START: 暂停', this.width / 2, 260);
    ctx.textAlign = 'left';
  }

  renderPauseOverlay(ctx) {
    ctx.fillStyle = 'rgba(15, 56, 15, 0.75)';
    ctx.fillRect(this.boardX, this.boardY + 100, this.boardW, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSED', this.boardX + this.boardW / 2, this.boardY + 145);
    ctx.textAlign = 'left';
  }

  renderGameOverOverlay(ctx) {
    const gw = this.width - 50;
    ctx.fillStyle = 'rgba(15, 56, 15, 0.9)';
    ctx.fillRect(25, 120, gw, 160);
    ctx.strokeStyle = '#f00000';
    ctx.lineWidth = 2;
    ctx.strokeRect(27, 122, gw - 4, 156);

    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.width / 2, 165);

    ctx.fillStyle = '#ffffff';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`FINAL SCORE: ${this.board.score}`, this.width / 2, 195);
    ctx.fillText(`LINES: ${this.board.lines}`, this.width / 2, 215);

    ctx.fillStyle = '#9bbc0f';
    ctx.fillText('按 A 或 点击重玩', this.width / 2, 250);
    ctx.textAlign = 'left';
  }

  animate(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(delta);
    this.render();

    requestAnimationFrame(this.animate);
  }
}

// Start Game Engine when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.tetrisApp = new TetrisGame();
});
