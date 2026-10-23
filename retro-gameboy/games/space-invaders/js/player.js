/* ==========================================================================
   Player Cannon & Laser Missiles
   ========================================================================== */

class PlayerLaser {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 3;
    this.height = 10;
    this.speed = 360;
    this.alive = true;
  }
  update(dt) {
    this.y -= this.speed * dt;
    if (this.y < -10) this.alive = false;
  }
  draw(ctx) {
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    // Glow core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x + 1, this.y + 2, 1, this.height - 4);
  }
}

class PlayerCannon {
  constructor(gameWidth, gameHeight) {
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.width = 28;
    this.height = 16;
    this.x = gameWidth / 2 - this.width / 2;
    this.y = gameHeight - 34;
    this.speed = 190;
    this.alive = true;
    this.isDying = false;
    this.deathTimer = 0;
    this.deathDuration = 0.8;
  }

  reset() {
    this.x = this.gameWidth / 2 - this.width / 2;
    this.alive = true;
    this.isDying = false;
    this.deathTimer = 0;
  }

  move(dir, dt) {
    if (!this.alive || this.isDying) return;
    this.x += dir * this.speed * dt;
    if (this.x < 6) this.x = 6;
    if (this.x > this.gameWidth - this.width - 6) {
      this.x = this.gameWidth - this.width - 6;
    }
  }

  hit() {
    if (!this.alive || this.isDying) return;
    this.isDying = true;
    this.deathTimer = 0;
    invadersSound.playPlayerHit();
  }

  update(dt) {
    if (this.isDying) {
      this.deathTimer += dt;
      if (this.deathTimer >= this.deathDuration) {
        this.isDying = false;
        this.alive = false;
      }
    }
  }

  draw(ctx) {
    if (!this.alive) return;

    if (this.isDying) {
      // Flashing destruction pixel explosion
      const frame = Math.floor(this.deathTimer * 15) % 2;
      ctx.fillStyle = frame === 0 ? '#ff0055' : '#ffff00';
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.fillRect(cx - 12, cy - 2, 24, 4);
      ctx.fillRect(cx - 6, cy - 8, 12, 16);
      ctx.fillRect(cx - 16, cy - 6, 6, 6);
      ctx.fillRect(cx + 10, cy - 6, 6, 6);
      ctx.fillRect(cx - 14, cy + 4, 6, 6);
      ctx.fillRect(cx + 8, cy + 4, 6, 6);
      return;
    }

    // Classic Green Defender Cannon Sprite
    ctx.fillStyle = '#00ff66';

    // Base chassis
    ctx.fillRect(this.x, this.y + 10, this.width, 6);
    // Mid tier
    ctx.fillRect(this.x + 2, this.y + 5, this.width - 4, 5);
    // Turret mount
    ctx.fillRect(this.x + 8, this.y + 2, this.width - 16, 3);
    // Gun nozzle
    ctx.fillRect(this.x + this.width / 2 - 2, this.y, 4, 3);
  }
}
