// 体素世界：数据、地形生成、分块网格（含顶点 AO）、射线检测、爆炸

import * as THREE from 'three';
import { B, BLOCKS, isSolid, tileUV } from './blocks.js';
import { createNoise2D, fbm, mulberry32, clamp, smoothstep } from './noise.js';

export const SX = 96;
export const SY = 48;
export const SZ = 96;
export const CS = 16;
export const SEA = 12;
export const WATER_Y = SEA + 0.88; // 海面高度
const NCX = SX / CS;
const NCZ = SZ / CS;

// 六个面：法线、四角（位置 + UV），切线轴 u/v 用于 AO 采样
const FACES = [
  { dir: [-1, 0, 0], tile: 'side', corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], tile: 'side', corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], tile: 'bottom', corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], tile: 'top', corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], tile: 'side', corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], tile: 'side', corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
for (const f of FACES) {
  const n = f.dir.findIndex((v) => v !== 0);
  [f.u, f.v] = [0, 1, 2].filter((a) => a !== n);
}
const AO_LEVELS = [0.4, 0.6, 0.8, 1];

export class World {
  constructor(scene, material) {
    this.scene = scene;
    this.material = material;
    this.data = new Uint8Array(SX * SY * SZ);
    this.damage = new Map();
    this.meshes = new Array(NCX * NCZ).fill(null);
    this.dirty = new Set();
    this.version = 0;
    this.spawn = new THREE.Vector3(SX / 2, 20, SZ / 2);
  }

  index(x, y, z) {
    return (y * SZ + z) * SX + x;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ;
  }

  get(x, y, z) {
    return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : B.AIR;
  }

  /** 碰撞用：世界水平边界与底部视为实体（隐形墙） */
  solidAt(x, y, z) {
    if (y < 0) return true;
    if (y >= SY) return false;
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
    return isSolid(this.data[this.index(x, y, z)]);
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    if (this.data[i] === id) return;
    this.data[i] = id;
    this.damage.delete(i);
    this.version++;
    this.markDirty(x, z);
  }

  markDirty(x, z) {
    const add = (cx, cz) => {
      if (cx >= 0 && cx < NCX && cz >= 0 && cz < NCZ) this.dirty.add(cz * NCX + cx);
    };
    const cx = x >> 4;
    const cz = z >> 4;
    add(cx, cz);
    if ((x & 15) === 0) add(cx - 1, cz);
    if ((x & 15) === 15) add(cx + 1, cz);
    if ((z & 15) === 0) add(cx, cz - 1);
    if ((z & 15) === 15) add(cx, cz + 1);
  }

  topY(x, z) {
    for (let y = SY - 1; y >= 0; y--) if (isSolid(this.get(x, y, z))) return y;
    return -1;
  }

  /** 地面高度（忽略树叶与树干，用于敌人生成与掉落物落地） */
  groundY(x, z) {
    for (let y = SY - 1; y >= 0; y--) {
      const b = this.get(x, y, z);
      if (isSolid(b) && b !== B.LEAVES && b !== B.LOG) return y;
    }
    return -1;
  }

  // ---------- 地形生成 ----------

  generate(seed) {
    this.data.fill(0);
    this.damage.clear();
    const n1 = createNoise2D(seed);
    const n2 = createNoise2D(seed + 11);
    const n3 = createNoise2D(seed + 23);
    const rnd = mulberry32(seed + 99);
    const heights = new Int16Array(SX * SZ);
    const put = (x, y, z, id) => {
      if (this.inBounds(x, y, z)) this.data[this.index(x, y, z)] = id;
    };

    const cx = SX / 2;
    const cz = SZ / 2;
    const rawHeight = (x, z) => {
      const d = Math.hypot(x / SX - 0.5, z / SZ - 0.5) * 2;
      const island = 1 - smoothstep(0.58, 0.95, d + n3(x * 0.04, z * 0.04) * 0.1);
      const hills = fbm(n1, x * 0.025, z * 0.025, 4);
      const ridge = Math.pow(Math.max(0, fbm(n2, x * 0.017, z * 0.017, 3)), 1.5) * 34 * smoothstep(0.18, 0.42, d);
      return SEA - 7 + island * (10 + hills * 4 + ridge);
    };
    const hc = Math.max(SEA + 2, Math.round(rawHeight(cx, cz)));

    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        // 中央前哨站周围平滑过渡到平地
        const blend = smoothstep(7, 16, Math.hypot(x + 0.5 - cx, z + 0.5 - cz));
        const h = Math.round(clamp(hc + (rawHeight(x, z) - hc) * blend, 2, SY - 12));
        heights[z * SX + x] = h;
        const beach = h <= SEA + 1;
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y <= h) {
            const depth = h - y;
            if (depth === 0) id = beach ? B.SAND : h >= 31 ? B.SNOW : h >= 27 ? B.STONE : B.GRASS;
            else if (depth < 4) id = beach ? B.SAND : h >= 27 ? B.STONE : B.DIRT;
            else id = rnd() < 0.035 ? B.COAL : B.STONE;
          } else id = B.WATER;
          put(x, y, z, id);
        }
      }
    }

    // 中央前哨站：木板地台 + 带缺口的矮砖墙
    for (let dz = -6; dz <= 6; dz++) {
      for (let dx = -6; dx <= 6; dx++) {
        const x = cx + dx;
        const z = cz + dz;
        const r = Math.max(Math.abs(dx), Math.abs(dz));
        if (r <= 3) put(x, hc, z, B.PLANKS);
        if (r === 5 && Math.abs(dx) > 1 && Math.abs(dz) > 1) put(x, hc + 1, z, B.BRICK);
      }
    }
    this.spawn.set(cx + 0.5, hc + 1, cz + 0.5);

    // 树木
    for (let gz = 3; gz < SZ - 3; gz += 5) {
      for (let gx = 3; gx < SX - 3; gx += 5) {
        if (rnd() > 0.42) continue;
        const x = gx + Math.floor(rnd() * 4);
        const z = gz + Math.floor(rnd() * 4);
        if (x >= SX - 3 || z >= SZ - 3) continue;
        const h = heights[z * SX + x];
        if (this.get(x, h, z) !== B.GRASS || Math.hypot(x - cx, z - cz) < 9) continue;
        const th = 4 + Math.floor(rnd() * 3);
        for (let i = 1; i <= th; i++) put(x, h + i, z, B.LOG);
        const top = h + th;
        for (let dy = -2; dy <= 1; dy++) {
          const r = dy >= 0 ? 1 : 2;
          for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && (dy >= 0 || rnd() < 0.5)) continue;
              if (this.get(x + dx, top + dy, z + dz) === B.AIR) put(x + dx, top + dy, z + dz, B.LEAVES);
            }
          }
        }
        put(x, top + 2, z, B.LEAVES);
      }
    }
    this.version++;
  }

  // ---------- 网格 ----------

  buildAll() {
    for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) this.buildChunk(cx, cz);
    this.dirty.clear();
  }

  update() {
    for (const key of this.dirty) this.buildChunk(key % NCX, Math.floor(key / NCX));
    this.dirty.clear();
  }

  solidN(x, y, z) {
    return isSolid(this.get(x, y, z)) ? 1 : 0;
  }

  buildChunk(cx, cz) {
    const pos = [];
    const nor = [];
    const uv = [];
    const col = [];
    const idx = [];
    const ao = [0, 0, 0, 0];
    const o = [0, 0, 0];
    const x0 = cx * CS;
    const z0 = cz * CS;
    for (let y = 0; y < SY; y++) {
      for (let z = z0; z < z0 + CS; z++) {
        for (let x = x0; x < x0 + CS; x++) {
          const id = this.data[this.index(x, y, z)];
          if (!isSolid(id)) continue;
          const blk = BLOCKS[id];
          for (const f of FACES) {
            const [dx, dy, dz] = f.dir;
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            if (ny < 0 || isSolid(this.get(nx, ny, nz))) continue;
            const [u0, v0, u1, v1] = tileUV(blk[f.tile]);
            const base = pos.length / 3;
            for (let k = 0; k < 4; k++) {
              const c = f.corners[k];
              pos.push(x + c[0], y + c[1], z + c[2]);
              nor.push(dx, dy, dz);
              uv.push(c[3] ? u1 : u0, c[4] ? v1 : v0);
              // 顶点 AO：采样面外侧那一层的两条边与一个角
              o[0] = nx; o[1] = ny; o[2] = nz;
              const su = c[f.u] ? 1 : -1;
              const sv = c[f.v] ? 1 : -1;
              o[f.u] += su;
              const s1 = this.solidN(o[0], o[1], o[2]);
              o[f.v] += sv;
              const s3 = this.solidN(o[0], o[1], o[2]);
              o[f.u] -= su;
              const s2 = this.solidN(o[0], o[1], o[2]);
              const a = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
              ao[k] = a;
              const l = AO_LEVELS[a];
              col.push(l, l, l);
            }
            // 按 AO 选择对角线，避免各向异性伪影
            if (ao[0] + ao[3] > ao[1] + ao[2]) idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
            else idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const key = cz * NCX + cx;
    let mesh = this.meshes[key];
    if (!mesh) {
      mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes[key] = mesh;
    } else {
      mesh.geometry.dispose();
      mesh.geometry = geo;
    }
  }

  // ---------- 交互 ----------

  /** 体素 DDA 射线（Amanatides & Woo）。dir 需归一化；返回进入方块的距离 t 与命中面法线 */
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const sx = dir.x > 0 ? 1 : -1;
    const sy = dir.y > 0 ? 1 : -1;
    const sz = dir.z > 0 ? 1 : -1;
    const tdx = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tdy = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tdz = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tmx = dir.x !== 0 ? (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tdx : Infinity;
    let tmy = dir.y !== 0 ? (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tdy : Infinity;
    let tmz = dir.z !== 0 ? (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tdz : Infinity;
    let t = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    while (t <= maxDist) {
      if (isSolid(this.get(x, y, z))) return { x, y, z, nx, ny, nz, t, id: this.get(x, y, z) };
      if (tmx < tmy && tmx < tmz) {
        x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0;
      } else if (tmy < tmz) {
        y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0;
      } else {
        z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz;
      }
      if (y < -1 || y > SY + 1) break;
    }
    return null;
  }

  /** 移除方块：海平面以下且邻接水体时灌入海水 */
  removeBlock(x, y, z) {
    let fill = B.AIR;
    if (y <= SEA) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
        if (this.get(x + dx, y + dy, z + dz) === B.WATER) fill = B.WATER;
      }
    }
    this.set(x, y, z, fill);
  }

  /** 累积伤害方块；返回 'broken' | 'hit' | null */
  damageBlock(x, y, z, amount) {
    const id = this.get(x, y, z);
    if (!isSolid(id)) return null;
    const hp = BLOCKS[id].hp;
    if (!Number.isFinite(hp)) return 'hit';
    const i = this.index(x, y, z);
    const d = (this.damage.get(i) || 0) + amount;
    if (d >= hp) {
      this.removeBlock(x, y, z);
      return 'broken';
    }
    this.damage.set(i, d);
    return 'hit';
  }

  /** 球形爆炸，返回被摧毁的方块列表 */
  explode(cx, cy, cz, r) {
    const removed = [];
    const R = Math.ceil(r);
    const bx = Math.floor(cx);
    const by = Math.floor(cy);
    const bz = Math.floor(cz);
    for (let dy = R; dy >= -R; dy--) {
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > r * r * (0.7 + Math.random() * 0.3)) continue;
          const x = bx + dx;
          const y = by + dy;
          const z = bz + dz;
          const id = this.get(x, y, z);
          if (!isSolid(id) || id === B.BEDROCK) continue;
          removed.push({ x, y, z, id });
          this.removeBlock(x, y, z);
        }
      }
    }
    return removed;
  }
}
