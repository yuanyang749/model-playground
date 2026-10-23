/* ==========================================================================
   Collision & Vector Decoupling Physics System
   ========================================================================== */
const Physics = {
  checkAABB(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  },

  checkTileCollision(x, y, size, map) {
    if (x < 0 || x > CANVAS_WIDTH - size || y < 0 || y > CANVAS_HEIGHT - size) return true;
    const left = Math.floor(x / TILE_SIZE);
    const right = Math.floor((x + size - 1) / TILE_SIZE);
    const top = Math.floor(y / TILE_SIZE);
    const bottom = Math.floor((y + size - 1) / TILE_SIZE);

    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          const tile = map[r][c];
          if (tile === T_BRICK || tile === T_STEEL || tile === T_WATER || tile === T_BASE || tile === T_BASE_RUIN) {
            return true;
          }
        }
      }
    }
    return false;
  },

  checkTankObstacleCollision(nx, ny, size, selfTank, game) {
    if (this.checkTileCollision(nx, ny, size, game.map)) return true;

    const allTanks = [...game.enemies];
    if (game.player && game.player.alive) allTanks.push(game.player);

    for (let tank of allTanks) {
      if (tank !== selfTank && tank.alive) {
        if (this.checkAABB(nx, ny, size, size, tank.x, tank.y, tank.size, tank.size)) {
          // If already overlapping, allow moving away (vector decoupling mechanism)
          const curDist = Math.hypot(
            (selfTank.x + selfTank.size / 2) - (tank.x + tank.size / 2),
            (selfTank.y + selfTank.size / 2) - (tank.y + tank.size / 2)
          );
          const nextDist = Math.hypot(
            (nx + size / 2) - (tank.x + tank.size / 2),
            (ny + size / 2) - (tank.y + tank.size / 2)
          );

          // If moving increases center-to-center distance, ALLOW it so tanks separate!
          if (curDist < (selfTank.size + tank.size) / 2 && nextDist > curDist) {
            continue;
          }
          return true;
        }
      }
    }
    return false;
  },

  // Active Overlap Depenetration (Gently pushes overlapping tanks apart)
  resolveAllTankOverlaps(game) {
    const allActiveTanks = [...game.enemies];
    if (game.player && game.player.alive) allActiveTanks.push(game.player);

    for (let i = 0; i < allActiveTanks.length; i++) {
      for (let j = i + 1; j < allActiveTanks.length; j++) {
        const t1 = allActiveTanks[i];
        const t2 = allActiveTanks[j];
        if (t1.alive && t2.alive && this.checkAABB(t1.x, t1.y, t1.size, t1.size, t2.x, t2.y, t2.size, t2.size)) {
          let dx = (t1.x + t1.size / 2) - (t2.x + t2.size / 2);
          let dy = (t1.y + t1.size / 2) - (t2.y + t2.size / 2);
          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            dx = Math.random() > 0.5 ? 1 : -1;
            dy = 0;
          }
          const dist = Math.hypot(dx, dy) || 1;
          const overlap = (t1.size + t2.size) / 2 - dist;
          if (overlap > 0) {
            const push = Math.min(overlap / 2 + 0.5, 2.5);
            const px = (dx / dist) * push;
            const py = (dy / dist) * push;
            if (!this.checkTileCollision(t1.x + px, t1.y + py, t1.size, game.map)) {
              t1.x += px;
              t1.y += py;
            }
            if (!this.checkTileCollision(t2.x - px, t2.y - py, t2.size, game.map)) {
              t2.x -= px;
              t2.y -= py;
            }
          }
        }
      }
    }
  }
};
