/* ==========================================================================
   Tetris 1989 - Playfield Board, Matrix Mechanics & 7-Bag Randomizer
   ========================================================================== */

const COLS = 10;
const ROWS = 20;

// Tetromino 4x4 matrix shapes
const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [2, 2],
    [2, 2]
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0]
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0]
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0]
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0]
  ]
};

// Distinct Retro DMG Green and Arcade Colors
const BLOCK_COLORS = {
  0: null,
  1: { base: '#00f0f0', dark: '#00a0a0', light: '#b0ffff', pattern: 'dot' },   // I - Cyan
  2: { base: '#f0f000', dark: '#a0a000', light: '#ffffb0', pattern: 'box' },   // O - Yellow
  3: { base: '#a000f0', dark: '#6000a0', light: '#e0b0ff', pattern: 'cross' }, // T - Purple
  4: { base: '#00f000', dark: '#00a000', light: '#b0ffb0', pattern: 'hatch' }, // S - Green
  5: { base: '#f00000', dark: '#a00000', light: '#ffb0b0', pattern: 'dash' },  // Z - Red
  6: { base: '#0000f0', dark: '#0000a0', light: '#b0b0ff', pattern: 'grid' },  // J - Blue
  7: { base: '#f0a000', dark: '#a06000', light: '#ffe0b0', pattern: 'strip' }  // L - Orange
};

class TetrisBoard {
  constructor() {
    this.cols = COLS;
    this.rows = ROWS;
    this.grid = this.createEmptyGrid();
    this.bag = [];
    this.currentPiece = null;
    this.nextPiece = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.isClearingLines = false;
    this.clearingRows = [];
    this.clearAnimationTimer = 0;

    this.reset();
  }

  createEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  reset() {
    this.grid = this.createEmptyGrid();
    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.isClearingLines = false;
    this.clearingRows = [];
    this.nextPiece = this.spawnRandomPiece();
    this.spawnNext();
  }

  // 7-Bag Randomizer
  refillBag() {
    const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    // Fisher-Yates Shuffle
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.bag = types;
  }

  spawnRandomPiece() {
    if (this.bag.length === 0) {
      this.refillBag();
    }
    const type = this.bag.pop();
    const matrix = SHAPES[type].map(row => [...row]);
    return {
      type,
      matrix,
      x: Math.floor((this.cols - matrix[0].length) / 2),
      y: 0
    };
  }

  spawnNext() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.spawnRandomPiece();

    // Check game over upon spawning
    if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.gameOver = true;
    }
  }

  // Check collision between a piece matrix and playfield
  checkCollision(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const newX = px + c;
          const newY = py + r;

          // Out of horizontal bounds
          if (newX < 0 || newX >= this.cols) return true;
          // Floor collision
          if (newY >= this.rows) return true;
          // Placed block collision (above ceiling newY < 0 is allowed)
          if (newY >= 0 && this.grid[newY][newX] !== 0) return true;
        }
      }
    }
    return false;
  }

  // Rotate matrix 90 degrees (dir: 1 for clockwise, -1 for counter-clockwise)
  rotateMatrix(matrix, dir = 1) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (dir > 0) {
          result[c][N - 1 - r] = matrix[r][c];
        } else {
          result[N - 1 - c][r] = matrix[r][c];
        }
      }
    }
    return result;
  }

  // Move current piece horizontally
  move(dir) {
    if (this.gameOver || !this.currentPiece || this.isClearingLines) return false;
    const newX = this.currentPiece.x + dir;
    if (!this.checkCollision(this.currentPiece.matrix, newX, this.currentPiece.y)) {
      this.currentPiece.x = newX;
      return true;
    }
    return false;
  }

  // Rotate with wall kicks
  rotate(dir = 1) {
    if (this.gameOver || !this.currentPiece || this.isClearingLines) return false;
    const newMatrix = this.rotateMatrix(this.currentPiece.matrix, dir);
    
    // Test basic positions & kicks (0, +1, -1, +2, -2)
    const kicks = [0, 1, -1, 2, -2];
    for (const offset of kicks) {
      if (!this.checkCollision(newMatrix, this.currentPiece.x + offset, this.currentPiece.y)) {
        this.currentPiece.matrix = newMatrix;
        this.currentPiece.x += offset;
        return true;
      }
    }
    return false;
  }

  // Soft drop (1 row down)
  drop() {
    if (this.gameOver || !this.currentPiece || this.isClearingLines) return false;
    const newY = this.currentPiece.y + 1;
    if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, newY)) {
      this.currentPiece.y = newY;
      return true;
    } else {
      this.lockPiece();
      return false;
    }
  }

  // Calculate ghost piece drop position
  getGhostPosition() {
    if (!this.currentPiece) return null;
    let ghostY = this.currentPiece.y;
    while (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    return {
      x: this.currentPiece.x,
      y: ghostY,
      matrix: this.currentPiece.matrix
    };
  }

  // Hard drop (immediately slam piece to bottom and lock)
  hardDrop() {
    if (this.gameOver || !this.currentPiece || this.isClearingLines) return 0;
    let dropDist = 0;
    while (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
      dropDist++;
    }
    this.score += dropDist * 2; // Hard drop bonus points
    this.lockPiece();
    return dropDist;
  }

  // Lock current piece into playfield grid
  lockPiece() {
    if (!this.currentPiece) return;
    const { matrix, x, y } = this.currentPiece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardY = y + r;
          const boardX = x + c;
          if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
            this.grid[boardY][boardX] = matrix[r][c];
          }
        }
      }
    }

    // Check for filled lines
    this.checkLines();
  }

  // Check lines and trigger clear animation
  checkLines() {
    const fullRows = [];
    for (let r = 0; r < this.rows; r++) {
      if (this.grid[r].every(val => val !== 0)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      this.isClearingLines = true;
      this.clearingRows = fullRows;
      this.clearAnimationTimer = 12; // 12 frames flash animation
    } else {
      this.spawnNext();
    }
  }

  // Complete line clear after animation frames finish
  finalizeLineClear() {
    const count = this.clearingRows.length;
    if (count === 0) return 0;

    // Filter out full rows and unshift new empty rows at top
    for (const r of this.clearingRows) {
      this.grid.splice(r, 1);
      this.grid.unshift(Array(this.cols).fill(0));
    }

    // Classic Nintendo Scoring System
    const linePoints = [0, 100, 300, 500, 800]; // 1, 2, 3, 4 (Tetris) lines
    this.score += (linePoints[count] || 0) * this.level;
    this.lines += count;
    this.level = Math.floor(this.lines / 10) + 1;

    this.isClearingLines = false;
    this.clearingRows = [];
    this.spawnNext();
    return count;
  }
}

// Global export for Tetris Board
window.TetrisBoard = TetrisBoard;
window.BLOCK_COLORS = BLOCK_COLORS;
