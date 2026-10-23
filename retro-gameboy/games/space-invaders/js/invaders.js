/* ==========================================================================
   Space Invaders: Alien Grid, Mystery UFO, and Enemy Bombs
   ========================================================================== */

class AlienBomb {
  constructor(x, y, type = 0) {
    this.x = x;
    this.y = y;
    this.width = 3;
    this.height = 7;
    this.speed = 175;
    this.type = type;
    this.frame = 0;
    this.frameTimer = 0;
    this.alive = true;
  }
  update(dt) {
    this.y += this.speed * dt;
    this.frameTimer += dt;
    if (this.frameTimer > 0.08) {
      this.frame = 1 - this.frame;
      this.frameTimer = 0;
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#ff3366';
    if (this.type === 0) {
      // Straight needle laser
      ctx.fillRect(this.x, this.y, 2, this.height);
    } else {
      // Squiggly lightning bomb
      if (this.frame === 0) {
        ctx.fillRect(this.x, this.y, 2, 3);
        ctx.fillRect(this.x + 2, this.y + 2, 2, 3);
        ctx.fillRect(this.x, this.y + 4, 2, 3);
      } else {
        ctx.fillRect(this.x + 2, this.y, 2, 3);
        ctx.fillRect(this.x, this.y + 2, 2, 3);
        ctx.fillRect(this.x + 2, this.y + 4, 2, 3);
      }
    }
  }
}

class MysteryUfo {
  constructor(gameWidth) {
    this.gameWidth = gameWidth;
    this.width = 36;
    this.height = 14;
    this.y = 22;
    this.speed = 110;
    this.alive = false;
    this.score = 200;
    this.dir = 1;
    this.x = -this.width;
    this.showScoreTimer = 0;
    this.lastScoreX = 0;
    this.lastScoreVal = 0;
  }

  spawn() {
    this.alive = true;
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.x = this.dir === 1 ? -this.width : this.gameWidth + 5;
    const scores = [100, 150, 200, 300];
    this.score = scores[Math.floor(Math.random() * scores.length)];
    invadersSound.startUfo();
  }

  update(dt) {
    if (this.showScoreTimer > 0) {
      this.showScoreTimer -= dt;
    }
    if (!this.alive) return;

    this.x += this.dir * this.speed * dt;
    if ((this.dir === 1 && this.x > this.gameWidth + 20) ||
        (this.dir === -1 && this.x < -this.width - 20)) {
      this.alive = false;
      invadersSound.stopUfo();
    }
  }

  hit() {
    this.alive = false;
    this.showScoreTimer = 0.9;
    this.lastScoreX = this.x;
    this.lastScoreVal = this.score;
    invadersSound.playUfoHit();
    return this.score;
  }

  draw(ctx) {
    if (this.showScoreTimer > 0) {
      ctx.fillStyle = '#ff2255';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${this.lastScoreVal}`, this.lastScoreX + this.width / 2, this.y + 10);
    }

    if (!this.alive) return;

    // Classic Red Mystery Saucer Sprite
    ctx.fillStyle = '#ff2255';
    const x = this.x;
    const y = this.y;

    // Dome
    ctx.fillRect(x + 12, y, 12, 3);
    // Upper hull
    ctx.fillRect(x + 6, y + 3, 24, 4);
    // Main disc
    ctx.fillRect(x + 2, y + 7, 32, 4);
    // Underside pods
    ctx.fillRect(x + 4, y + 11, 4, 3);
    ctx.fillRect(x + 16, y + 11, 4, 3);
    ctx.fillRect(x + 28, y + 11, 4, 3);

    // Cyan glowing portholes
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(x + 8, y + 5, 3, 2);
    ctx.fillRect(x + 16, y + 5, 3, 2);
    ctx.fillRect(x + 24, y + 5, 3, 2);
  }
}

class InvaderGrid {
  constructor(gameWidth, gameHeight) {
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;

    this.rows = 5;
    this.cols = 8;
    this.invaderWidth = 22;
    this.invaderHeight = 16;
    this.gapX = 14;
    this.gapY = 14;

    this.aliens = [];
    this.bombs = [];
    this.ufo = new MysteryUfo(gameWidth);

    this.dir = 1; // 1 = right, -1 = left
    this.marchTimer = 0;
    this.marchStepIndex = 0;
    this.stepInterval = 0.75; // speeds up as aliens die
    this.stepX = 9;
    this.stepY = 16;

    this.ufoTimer = 18 + Math.random() * 10;
    this.bombDropTimer = 1.2;

    this.reset();
  }

  reset() {
    this.aliens = [];
    this.bombs = [];
    this.dir = 1;
    this.marchTimer = 0;
    this.marchStepIndex = 0;
    this.stepInterval = 0.75;

    const startX = 24;
    const startY = 46;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let type = 0; // Squid (top)
        let points = 30;
        let color = '#ff3366';

        if (r === 1 || r === 2) {
          type = 1; // Crab (middle)
          points = 20;
          color = '#ff9900';
        } else if (r >= 3) {
          type = 2; // Octopus (bottom)
          points = 10;
          color = '#00ff88';
        }

        this.aliens.push({
          row: r,
          col: c,
          x: startX + c * (this.invaderWidth + this.gapX),
          y: startY + r * (this.invaderHeight + this.gapY),
          type,
          points,
          color,
          alive: true,
          frame: 0
        });
      }
    }
  }

  getAliveCount() {
    return this.aliens.filter(a => a.alive).length;
  }

  update(dt, playerY) {
    const aliveCount = this.getAliveCount();
    if (aliveCount === 0) return;

    // UFO Timer
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0) {
      if (!this.ufo.alive) this.ufo.spawn();
      this.ufoTimer = 22 + Math.random() * 14;
    }
    this.ufo.update(dt);

    // Alien Bombs Update
    this.bombDropTimer -= dt;
    if (this.bombDropTimer <= 0) {
      this.bombDropTimer = Math.max(0.6, 1.8 - (40 - aliveCount) * 0.03);
      this.dropRandomBomb();
    }
    for (let b of this.bombs) b.update(dt);
    this.bombs = this.bombs.filter(b => b.alive && b.y < this.gameHeight + 20);

    // March Movement Logic
    this.stepInterval = Math.max(0.08, 0.08 + (aliveCount / 40) * 0.65);
    this.marchTimer += dt;

    if (this.marchTimer >= this.stepInterval) {
      this.marchTimer = 0;
      this.marchStepIndex++;
      invadersSound.playMarch(this.marchStepIndex);

      // Check if grid hits horizontal bounds
      let hitEdge = false;
      for (let a of this.aliens) {
        if (!a.alive) continue;
        const nextX = a.x + this.dir * this.stepX;
        if (nextX < 10 || nextX + this.invaderWidth > this.gameWidth - 10) {
          hitEdge = true;
          break;
        }
      }

      if (hitEdge) {
        this.dir *= -1;
        for (let a of this.aliens) {
          if (!a.alive) continue;
          a.y += this.stepY;
          a.frame = 1 - a.frame;
        }
      } else {
        for (let a of this.aliens) {
          if (!a.alive) continue;
          a.x += this.dir * this.stepX;
          a.frame = 1 - a.frame;
        }
      }
    }
  }

  // Drop bomb from lowest alive invader in a random active column
  dropRandomBomb() {
    const colsWithAliens = {};
    for (let a of this.aliens) {
      if (a.alive) {
        if (!colsWithAliens[a.col] || colsWithAliens[a.col].y < a.y) {
          colsWithAliens[a.col] = a;
        }
      }
    }
    const candidates = Object.values(colsWithAliens);
    if (candidates.length > 0) {
      const shooter = candidates[Math.floor(Math.random() * candidates.length)];
      const bombType = Math.random() > 0.5 ? 1 : 0;
      this.bombs.push(new AlienBomb(shooter.x + this.invaderWidth / 2 - 1, shooter.y + this.invaderHeight + 2, bombType));
    }
  }

  // Check if any alien reached the ground level / player
  hasInvasionReachedBottom(floorY) {
    for (let a of this.aliens) {
      if (a.alive && a.y + this.invaderHeight >= floorY) {
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    this.ufo.draw(ctx);
    for (let b of this.bombs) b.draw(ctx);

    for (let a of this.aliens) {
      if (!a.alive) continue;
      this.drawInvader(ctx, a);
    }
  }

  drawInvader(ctx, a) {
    ctx.fillStyle = a.color;
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    const f = a.frame;

    if (a.type === 0) {
      // Squid (Top row, 30 pts)
      ctx.fillRect(x + 7, y, 8, 2);
      ctx.fillRect(x + 5, y + 2, 12, 3);
      ctx.fillRect(x + 3, y + 5, 16, 5);
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 6, y + 6, 2, 2);
      ctx.fillRect(x + 14, y + 6, 2, 2);
      ctx.fillStyle = a.color;
      // Tentacles
      if (f === 0) {
        ctx.fillRect(x + 3, y + 10, 3, 5);
        ctx.fillRect(x + 8, y + 10, 6, 3);
        ctx.fillRect(x + 16, y + 10, 3, 5);
      } else {
        ctx.fillRect(x + 1, y + 10, 3, 4);
        ctx.fillRect(x + 6, y + 10, 3, 5);
        ctx.fillRect(x + 13, y + 10, 3, 5);
        ctx.fillRect(x + 18, y + 10, 3, 4);
      }
    } else if (a.type === 1) {
      // Crab (Middle rows, 20 pts)
      ctx.fillRect(x + 3, y + 2, 16, 4);
      ctx.fillRect(x + 1, y + 6, 20, 4);
      ctx.fillRect(x + 5, y + 10, 12, 3);
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 5, y + 6, 3, 2);
      ctx.fillRect(x + 14, y + 6, 3, 2);
      ctx.fillStyle = a.color;
      // Claws & legs
      if (f === 0) {
        ctx.fillRect(x + 1, y, 3, 3);
        ctx.fillRect(x + 18, y, 3, 3);
        ctx.fillRect(x + 1, y + 12, 3, 4);
        ctx.fillRect(x + 18, y + 12, 3, 4);
      } else {
        ctx.fillRect(x + 1, y + 1, 3, 3);
        ctx.fillRect(x + 18, y + 1, 3, 3);
        ctx.fillRect(x + 5, y + 13, 3, 3);
        ctx.fillRect(x + 14, y + 13, 3, 3);
      }
    } else {
      // Octopus (Bottom rows, 10 pts)
      ctx.fillRect(x + 5, y, 12, 2);
      ctx.fillRect(x + 3, y + 2, 16, 4);
      ctx.fillRect(x + 1, y + 6, 20, 5);
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 5, y + 5, 3, 2);
      ctx.fillRect(x + 14, y + 5, 3, 2);
      ctx.fillStyle = a.color;
      // Tentacles
      if (f === 0) {
        ctx.fillRect(x + 1, y + 11, 4, 4);
        ctx.fillRect(x + 8, y + 11, 6, 3);
        ctx.fillRect(x + 17, y + 11, 4, 4);
      } else {
        ctx.fillRect(x + 4, y + 11, 4, 4);
        ctx.fillRect(x + 14, y + 11, 4, 4);
        ctx.fillRect(x + 9, y + 12, 4, 3);
      }
    }
  }
}
