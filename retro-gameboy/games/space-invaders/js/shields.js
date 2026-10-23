/* ==========================================================================
   Destructible Bunkers / Shields System (Crater Erosion Physics)
   ========================================================================== */

class ShieldBunker {
  constructor(x, y, width = 42, height = 28) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Create offscreen canvas for pixel-perfect destructible erosion
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.reset();
  }

  reset() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#00e5ff'; // Neon Cyan Shield

    // Classic arcade arch shape
    // Top slope
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(this.width - 8, 0);
    ctx.lineTo(this.width, 8);
    ctx.lineTo(this.width, this.height);
    // Inner arch cutout
    ctx.lineTo(this.width - 12, this.height);
    ctx.lineTo(this.width - 12, this.height - 10);
    ctx.arcTo(this.width / 2, this.height - 16, 12, this.height - 10, 8);
    ctx.lineTo(12, this.height);
    ctx.lineTo(0, this.height);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
  }

  // Check if a point hits non-transparent shield pixel
  hits(px, py) {
    const lx = Math.floor(px - this.x);
    const ly = Math.floor(py - this.y);
    if (lx < 0 || lx >= this.width || ly < 0 || ly >= this.height) return false;

    try {
      const pixel = this.ctx.getImageData(lx, ly, 1, 1).data;
      return pixel[3] > 60; // Alpha > 60 means solid
    } catch (e) {
      return false;
    }
  }

  // Carve out a crater when bullet strikes
  damage(px, py, radius = 6) {
    const lx = px - this.x;
    const ly = py - this.y;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(lx, ly, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Add jagged splinter edges
    for (let i = 0; i < 4; i++) {
      const jx = lx + (Math.random() - 0.5) * (radius * 1.5);
      const jy = ly + (Math.random() - 0.5) * (radius * 1.5);
      this.ctx.fillRect(jx, jy, 2, 2);
    }
    this.ctx.restore();
    invadersSound.playShieldHit();
  }

  draw(ctx) {
    ctx.drawImage(this.canvas, this.x, this.y);
  }
}
