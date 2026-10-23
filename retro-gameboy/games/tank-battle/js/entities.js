/* ==========================================================================
   Tank Battle Game Entities
   ========================================================================== */

class Bullet {
  constructor(x, y, dir, speed, isPlayer, power = 1) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = speed;
    this.isPlayer = isPlayer;
    this.power = power;
    this.alive = true;
    this.size = 4;
  }
  update(dt, game) {
    const dist = this.speed * dt;
    if (this.dir === DIR_UP) this.y -= dist;
    else if (this.dir === DIR_DOWN) this.y += dist;
    else if (this.dir === DIR_LEFT) this.x -= dist;
    else if (this.dir === DIR_RIGHT) this.x += dist;

    if (this.x < 0 || this.x > CANVAS_WIDTH - this.size ||
        this.y < 0 || this.y > CANVAS_HEIGHT - this.size) {
      this.alive = false;
      game.spawnSparks(this.x, this.y);
      if (this.isPlayer) sound.playHitSteel();
      return;
    }

    const centerCol = Math.floor((this.x + this.size / 2) / TILE_SIZE);
    const centerRow = Math.floor((this.y + this.size / 2) / TILE_SIZE);

    if (centerRow >= 0 && centerRow < MAP_ROWS && centerCol >= 0 && centerCol < MAP_COLS) {
      const tile = game.map[centerRow][centerCol];
      if (tile === T_BRICK) {
        this.alive = false;
        game.map[centerRow][centerCol] = T_EMPTY;
        game.spawnSparks(this.x, this.y, '#c35832');
        sound.playHitBrick();
        return;
      } else if (tile === T_STEEL) {
        this.alive = false;
        if (this.power >= 2) game.map[centerRow][centerCol] = T_EMPTY;
        game.spawnSparks(this.x, this.y, '#ffffff');
        sound.playHitSteel();
        return;
      } else if (tile === T_BASE) {
        this.alive = false;
        game.destroyBase();
        return;
      }
    }

    if (this.isPlayer) {
      for (let enemy of game.enemies) {
        if (enemy.alive && Physics.checkAABB(this.x, this.y, this.size, this.size, enemy.x, enemy.y, enemy.size, enemy.size)) {
          this.alive = false;
          enemy.hit(this.power, game);
          return;
        }
      }
    } else {
      if (game.player && game.player.alive) {
        if (Physics.checkAABB(this.x, this.y, this.size, this.size, game.player.x, game.player.y, game.player.size, game.player.size)) {
          this.alive = false;
          game.player.hit(game);
          return;
        }
      }
    }

    for (let other of game.bullets) {
      if (other !== this && other.alive && other.isPlayer !== this.isPlayer) {
        if (Math.abs(this.x - other.x) < 8 && Math.abs(this.y - other.y) < 8) {
          this.alive = false;
          other.alive = false;
          game.spawnSparks(this.x, this.y, '#ffff00');
          return;
        }
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x + this.size/2, this.y + this.size/2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Tank {
  constructor(x, y, dir, speed, color, isPlayer = false) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = speed;
    this.color = color;
    this.isPlayer = isPlayer;
    this.size = 28;
    this.alive = true;
    this.trackFrame = 0;
    this.trackTimer = 0;
    this.reloadTime = 0.42;
    this.reloadTimer = 0;
    this.shieldTimer = 0;
  }
  move(dt, dir, game) {
    this.dir = dir;
    const dist = this.speed * dt;
    let nx = this.x;
    let ny = this.y;

    if (dir === DIR_UP) ny -= dist;
    else if (dir === DIR_DOWN) ny += dist;
    else if (dir === DIR_LEFT) nx -= dist;
    else if (dir === DIR_RIGHT) nx += dist;

    this.trackTimer += dt;
    if (this.trackTimer > 0.08) {
      this.trackFrame = 1 - this.trackFrame;
      this.trackTimer = 0;
    }

    if (nx < 0) nx = 0;
    if (nx > CANVAS_WIDTH - this.size) nx = CANVAS_WIDTH - this.size;
    if (ny < 0) ny = 0;
    if (ny > CANVAS_HEIGHT - this.size) ny = CANVAS_HEIGHT - this.size;

    if (!Physics.checkTankObstacleCollision(nx, ny, this.size, this, game)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    return false;
  }
  fire(game) {
    if (this.reloadTimer <= 0) {
      this.reloadTimer = this.reloadTime;
      let bx = this.x + this.size / 2 - 2;
      let by = this.y + this.size / 2 - 2;
      if (this.dir === DIR_UP) by = this.y - 4;
      else if (this.dir === DIR_DOWN) by = this.y + this.size;
      else if (this.dir === DIR_LEFT) bx = this.x - 4;
      else if (this.dir === DIR_RIGHT) bx = this.x + this.size;

      const bulletSpeed = this.isPlayer ? 245 : 160;
      game.bullets.push(new Bullet(bx, by, this.dir, bulletSpeed, this.isPlayer));
      if (this.isPlayer) sound.playShoot();
      return true;
    }
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
    const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    ctx.rotate(angles[this.dir]);

    const s = this.size;
    const hs = s / 2;

    // Tracks
    ctx.fillStyle = '#222';
    ctx.fillRect(-hs, -hs, 6, s);
    ctx.fillRect(hs - 6, -hs, 6, s);

    ctx.fillStyle = this.trackFrame === 0 ? '#555' : '#888';
    for (let i = -hs + 2; i < hs; i += 6) {
      ctx.fillRect(-hs + 1, i, 4, 3);
      ctx.fillRect(hs - 5, i, 4, 3);
    }

    // Body
    ctx.fillStyle = this.color;
    ctx.fillRect(-hs + 6, -hs + 3, s - 12, s - 6);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-hs + 7, -hs + 4, s - 14, 3);

    // Turret
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, 1, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Barrel
    ctx.fillStyle = '#eee';
    ctx.fillRect(-2, -hs - 2, 4, hs + 3);

    ctx.restore();

    if (this.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = Math.floor(Date.now() / 60) % 2 === 0 ? '#00e5ff' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

class PlayerTank extends Tank {
  constructor(x, y) {
    super(x, y, DIR_UP, 110, '#ffd700', true);
    this.shieldTimer = 3.5;
  }
  hit(game) {
    if (this.shieldTimer > 0) return;
    sound.playExplosion();
    game.spawnExplosion(this.x + this.size / 2, this.y + this.size / 2, true);
    this.alive = false;
    game.playerLives--;
    game.updateHUD();
    if (game.playerLives > 0) {
      setTimeout(() => game.respawnPlayer(), 1000);
    } else {
      game.gameOver();
    }
  }
}

class EnemyTank extends Tank {
  constructor(x, y, type = 'basic') {
    let speed = 65;
    let color = '#ccc';
    let hp = 1;
    if (type === 'fast') {
      speed = 125;
      color = '#81c784';
    } else if (type === 'armor') {
      speed = 55;
      color = '#e57373';
      hp = 3;
    } else if (type === 'bonus') {
      speed = 80;
      color = '#ff4081';
    }
    super(x, y, DIR_DOWN, speed, color, false);
    this.type = type;
    this.hp = hp;
    this.changeDirTimer = Math.random() * 1.5 + 0.5;
    this.shootTimer = Math.random() * 1.8 + 0.6;
  }
  update(dt, game) {
    if (game.freezeTimer > 0) return;

    this.changeDirTimer -= dt;
    if (this.changeDirTimer <= 0) {
      this.changeDirTimer = Math.random() * 2.0 + 1.0;
      const r = Math.random();
      if (r < 0.45) this.dir = DIR_DOWN;
      else if (r < 0.65) this.dir = DIR_LEFT;
      else if (r < 0.85) this.dir = DIR_RIGHT;
      else this.dir = DIR_UP;
    }

    const moved = this.move(dt, this.dir, game);
    if (!moved) {
      const otherDirs = [DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT].filter(d => d !== this.dir);
      this.dir = otherDirs[Math.floor(Math.random() * otherDirs.length)];
      this.changeDirTimer = 0.5 + Math.random() * 0.5;
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = Math.random() * 1.6 + 0.8;
      this.fire(game);
    }
  }
  hit(power, game) {
    this.hp -= power;
    if (this.hp <= 0) {
      this.alive = false;
      sound.playExplosion();
      game.spawnExplosion(this.x + this.size / 2, this.y + this.size / 2);
      game.score += (this.type === 'armor' ? 400 : (this.type === 'fast' ? 200 : 100));
      game.updateHUD();

      if (this.type === 'bonus' || Math.random() < 0.25) {
        game.spawnPowerup(this.x, this.y);
      }
      game.checkStageClear();
    } else {
      this.color = this.hp === 2 ? '#fff59d' : '#ff8a80';
      sound.playHitSteel();
    }
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.size = 20;
    this.type = type;
    this.alive = true;
    this.timer = 15;
  }
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) this.alive = false;
  }
  draw(ctx) {
    if (!this.alive) return;
    if (this.timer < 3 && Math.floor(Date.now() / 150) % 2 === 0) return;

    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x, this.y, this.size, this.size);

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let symbol = '★';
    if (this.type === 'bomb') symbol = '💣';
    else if (this.type === 'timer') symbol = '⏱';
    else if (this.type === 'shield') symbol = '🛡';
    else if (this.type === 'shovel') symbol = '⛏';
    ctx.fillText(symbol, this.x + this.size / 2, this.y + this.size / 2 + 1);
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color = '#ff5722', size = 3, vx = 0, vy = 0, life = 0.3) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

class Explosion {
  constructor(x, y, isBig = false) {
    this.x = x;
    this.y = y;
    this.radius = isBig ? 32 : 18;
    this.duration = 0.32;
    this.timer = 0;
    this.alive = true;
  }
  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration) this.alive = false;
  }
  draw(ctx) {
    const progress = this.timer / this.duration;
    const currentR = this.radius * (0.3 + progress * 0.7);
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentR, 0, Math.PI * 2);
    ctx.fillStyle = progress < 0.4 ? '#ffff00' : (progress < 0.7 ? '#ff5722' : '#777');
    ctx.fill();
    ctx.restore();
  }
}
