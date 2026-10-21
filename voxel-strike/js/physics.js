// 轴分离 AABB 体素碰撞。body: { pos(脚底中心), vel, w(半宽), h(高) }

const EPS = 1e-3;

function overlaps(world, b) {
  const p = b.pos;
  const x0 = Math.floor(p.x - b.w);
  const x1 = Math.floor(p.x + b.w - 1e-6);
  const y0 = Math.floor(p.y);
  const y1 = Math.floor(p.y + b.h - 1e-6);
  const z0 = Math.floor(p.z - b.w);
  const z1 = Math.floor(p.z + b.w - 1e-6);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) if (world.solidAt(x, y, z)) return true;
    }
  }
  return false;
}

function moveAxis(world, b, axis, d) {
  if (d === 0) return;
  const p = b.pos;
  if (axis === 0) p.x += d;
  else if (axis === 1) p.y += d;
  else p.z += d;
  if (!overlaps(world, b)) return;
  if (axis === 0) {
    p.x = d > 0 ? Math.floor(p.x + b.w) - b.w - EPS : Math.floor(p.x - b.w) + 1 + b.w + EPS;
    b.vel.x = 0;
    b.hitX = true;
  } else if (axis === 2) {
    p.z = d > 0 ? Math.floor(p.z + b.w) - b.w - EPS : Math.floor(p.z - b.w) + 1 + b.w + EPS;
    b.vel.z = 0;
    b.hitZ = true;
  } else {
    if (d > 0) {
      p.y = Math.floor(p.y + b.h) - b.h - EPS;
    } else {
      p.y = Math.floor(p.y) + 1;
      b.onGround = true;
    }
    b.vel.y = 0;
  }
}

export function moveBody(world, b, dt) {
  const dx = b.vel.x * dt;
  const dy = b.vel.y * dt;
  const dz = b.vel.z * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
  b.onGround = false;
  b.hitX = false;
  b.hitZ = false;
  for (let i = 0; i < steps; i++) {
    moveAxis(world, b, 1, dy / steps);
    moveAxis(world, b, 0, dx / steps);
    moveAxis(world, b, 2, dz / steps);
  }
}

/** 射线与 AABB 求交，返回进入距离或 null */
export function rayAABB(o, d, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0;
  let tmax = Infinity;
  const os = [o.x, o.y, o.z];
  const ds = [d.x, d.y, d.z];
  const mins = [minX, minY, minZ];
  const maxs = [maxX, maxY, maxZ];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(ds[a]) < 1e-9) {
      if (os[a] < mins[a] || os[a] > maxs[a]) return null;
      continue;
    }
    const inv = 1 / ds[a];
    let t1 = (mins[a] - os[a]) * inv;
    let t2 = (maxs[a] - os[a]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return null;
  }
  return tmin;
}
