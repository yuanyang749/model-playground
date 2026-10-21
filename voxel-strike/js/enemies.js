// 敌人：方块生物模型、AI（追击 / 跳跃 / 拆墙 / 自爆 / 射箭 / Boss 技能）、投射物

import * as THREE from 'three';
import { moveBody, rayAABB } from './physics.js';
import { pixelTexture, B } from './blocks.js';

export const TYPES = {
  zombie: {
    name: '腐尸', hp: 70, speed: 2.8, w: 0.32, h: 1.95, headFrac: 0.74, score: 100,
    dmg: 12, reach: 1.5, attackCd: 1.0, digs: true, digPower: 1.2, blood: new THREE.Color('#5a8f3a'),
  },
  creeper: {
    name: 'TNT 爆破怪', hp: 45, speed: 3.9, w: 0.42, h: 1.45, headFrac: 0.62, score: 150,
    dmg: 60, fuse: 1.1, radius: 3.2, blood: new THREE.Color('#d8402c'),
  },
  skeleton: {
    name: '骷髅射手', hp: 50, speed: 2.5, w: 0.3, h: 1.95, headFrac: 0.74, score: 150,
    dmg: 11, range: 26, prefer: 13, attackCd: 1.8, blood: new THREE.Color('#e2e2d6'),
  },
  golem: {
    name: '方块巨像', hp: 1400, speed: 2.1, w: 0.95, h: 4.3, headFrac: 0.8, score: 2500,
    dmg: 32, reach: 3.2, attackCd: 2.4, digs: true, digPower: 8, boss: true, blood: new THREE.Color('#8a8c92'),
  },
};

// ---------- 像素贴图 ----------

function faceTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  draw((x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  });
  return pixelTexture(c);
}

const FACES = {
  zombie: () => faceTexture((r) => {
    r(0, 0, 8, 8, '#5c9a43');
    r(0, 0, 8, 2, '#3f6e2e');
    r(1, 3, 2, 1, '#14240f');
    r(5, 3, 2, 1, '#14240f');
    r(3, 4, 2, 1, '#467a33');
    r(2, 6, 4, 1, '#2a4a1f');
  }),
  skeleton: () => faceTexture((r) => {
    r(0, 0, 8, 8, '#d8d8cc');
    r(1, 3, 2, 2, '#1a1a1a');
    r(5, 3, 2, 2, '#1a1a1a');
    r(3, 5, 2, 1, '#555555');
    r(1, 6, 6, 1, '#777777');
    r(2, 6, 1, 1, '#d8d8cc');
    r(5, 6, 1, 1, '#d8d8cc');
  }),
  tnt: () => faceTexture((r) => {
    r(0, 0, 8, 8, '#d23b28');
    r(0, 0, 1, 8, '#a62c1d');
    r(4, 0, 1, 8, '#a62c1d');
    r(0, 3, 8, 3, '#f2efe6');
    r(1, 4, 1, 1, '#111111');
    r(6, 4, 1, 1, '#111111');
    r(3, 4, 2, 1, '#111111');
  }),
  tntSide: () => faceTexture((r) => {
    r(0, 0, 8, 8, '#d23b28');
    r(1, 0, 1, 8, '#a62c1d');
    r(5, 0, 1, 8, '#a62c1d');
    r(0, 3, 8, 3, '#f2efe6');
    r(2, 4, 4, 1, '#333333');
  }),
  golem: () => faceTexture((r) => {
    r(0, 0, 8, 8, '#8a8c92');
    r(0, 0, 8, 1, '#6c6e74');
    r(1, 6, 2, 1, '#5d7a3a');
    r(6, 1, 1, 2, '#5d7a3a');
    r(3, 4, 2, 2, '#6c6e74');
    r(1, 7, 6, 1, '#5a5c62');
  }),
};

// ---------- 模型 ----------

function part(parent, mats, w, h, d, material, x, y, z, pivotY = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  (Array.isArray(material) ? material : [material]).forEach((m) => mats.add(m));
  if (pivotY === null) {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  // 关节：枢轴在顶部，便于摆动
  const pivot = new THREE.Group();
  pivot.position.set(x, pivotY, z);
  mesh.position.y = y - pivotY;
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

function buildModel(type, tex) {
  const root = new THREE.Group();
  const mats = new Set();
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const m = {};
  if (type === 'zombie' || type === 'skeleton') {
    const sk = type === 'skeleton';
    const skin = L(sk ? '#d8d8cc' : '#5c9a43');
    const shirt = L(sk ? '#c8c8bc' : '#2f6f8f');
    const pants = L(sk ? '#bdbdb0' : '#3b3b8a');
    const limb = sk ? 0.14 : 0.24;
    m.legL = part(root, mats, limb, 0.75, limb, pants, -0.12, 0.375, 0, 0.75);
    m.legR = part(root, mats, limb, 0.75, limb, pants, 0.12, 0.375, 0, 0.75);
    part(root, mats, 0.5, 0.72, sk ? 0.18 : 0.26, shirt, 0, 1.11, 0);
    const face = new THREE.MeshLambertMaterial({ map: tex[type] });
    m.head = part(root, mats, 0.5, 0.5, 0.5, [skin, skin, skin, skin, face, skin], 0, 1.72, 0);
    m.armL = part(root, mats, limb, 0.72, limb, skin, -0.36, 1.14, 0, 1.44);
    m.armR = part(root, mats, limb, 0.72, limb, skin, 0.36, 1.14, 0, 1.44);
    if (sk) {
      const bow = L('#7a5230');
      part(m.armL, mats, 0.04, 0.7, 0.04, bow, 0, -0.62, 0.12);
    }
  } else if (type === 'creeper') {
    const side = new THREE.MeshLambertMaterial({ map: tex.tntSide });
    const front = new THREE.MeshLambertMaterial({ map: tex.tnt });
    const top = L('#e0d6c2');
    m.body = part(root, mats, 0.84, 0.84, 0.84, [side, side, top, top, front, side], 0, 0.82, 0);
    const legMat = L('#7a2a1e');
    m.legs = [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]].map(([x, z]) =>
      part(root, mats, 0.2, 0.42, 0.2, legMat, x, 0.21, z, 0.42));
    part(root, mats, 0.06, 0.22, 0.06, L('#3a3a3a'), 0, 1.34, 0);
    m.spark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd060 }));
    m.spark.position.y = 1.48;
    root.add(m.spark);
  } else if (type === 'golem') {
    const stone = L('#8a8c92');
    const dark = L('#6c6e74');
    const face = new THREE.MeshLambertMaterial({ map: tex.golem });
    m.legL = part(root, mats, 0.62, 1.4, 0.62, dark, -0.42, 0.7, 0, 1.4);
    m.legR = part(root, mats, 0.62, 1.4, 0.62, dark, 0.42, 0.7, 0, 1.4);
    part(root, mats, 1.7, 1.6, 0.95, stone, 0, 2.2, 0);
    m.head = part(root, mats, 0.9, 0.9, 0.9, [stone, stone, stone, stone, face, stone], 0, 3.45, 0.05);
    const eye = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
    for (const x of [-0.2, 0.2]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.02), eye);
      e.position.set(x, 0.06, 0.46);
      m.head.add(e);
    }
    m.armL = part(root, mats, 0.52, 1.9, 0.52, stone, -1.12, 1.95, 0, 2.9);
    m.armR = part(root, mats, 0.52, 1.9, 0.52, stone, 1.12, 1.95, 0, 2.9);
  }
  return { root, mats: [...mats], ...m };
}

// ---------- 敌人 ----------

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

class Enemy {
  constructor(game, type, pos, mult, tex) {
    this.game = game;
    this.type = type;
    this.def = TYPES[type];
    this.hp = this.maxHp = this.def.hp * mult;
    this.speed = this.def.speed * Math.min(1.35, 0.9 + mult * 0.1);
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.w = this.def.w;
    this.h = this.def.h;
    this.yaw = Math.random() * Math.PI * 2;
    this.cd = 1 + Math.random();
    this.walk = Math.random() * 10;
    this.flash = 0;
    this.fuse = 0;
    this.dig = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.slamT = 0;
    this.dead = false;
    this.model = buildModel(type, tex);
    this.model.root.position.copy(this.pos);
    game.enemies.group.add(this.model.root);
  }

  hurt(amount, dir, head) {
    if (this.dead) return false;
    this.hp -= amount;
    this.flash = 0.12;
    if (dir && !this.def.boss) {
      this.vel.x += dir.x * Math.min(6, amount * 0.08);
      this.vel.z += dir.z * Math.min(6, amount * 0.08);
    }
    if (this.hp <= 0) {
      this.die(true, head);
      return true;
    }
    if (Math.random() < 0.5) this.game.sfx.play('grunt', this.pos, 0.6);
    return false;
  }

  die(byPlayer, head = false) {
    if (this.dead) return;
    this.dead = true;
    const g = this.game;
    // 碎成方块
    this.model.root.updateMatrixWorld(true);
    this.model.root.traverse((o) => {
      if (!o.isMesh) return;
      o.getWorldPosition(tmp);
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const c = mat.map ? this.def.blood : mat.color;
      const n = this.def.boss ? 14 : 5;
      g.fx.debris(tmp.x, tmp.y, tmp.z, c, n, 6, this.def.boss ? 0.35 : 0.16, 1.8);
    });
    g.enemies.group.remove(this.model.root);
    this.model.root.traverse((o) => o.isMesh && o.geometry.dispose());
    for (const m of this.model.mats) m.dispose();
    g.sfx.play('die', this.pos, 0.8);
    g.onKill(this, byPlayer, head);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const d = this.def;
    const world = g.world;
    const to = tmp.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
    const dist = to.length();
    to.normalize();
    const dy = p.pos.y - this.pos.y;
    let move = 1;
    let dirX = to.x;
    let dirZ = to.z;
    this.cd -= dt;

    if (this.type === 'zombie' || this.type === 'golem') {
      if (dist < d.reach && Math.abs(dy) < 2.5) {
        move = this.type === 'golem' ? 0 : 0.2;
        if (this.cd <= 0) {
          this.cd = d.attackCd;
          if (this.type === 'golem') this.slam();
          else {
            p.damage(d.dmg, this.pos);
            p.knock(tmp2.set(to.x, 0, to.z), 4);
            this.model.armL.rotation.x = -2.4;
            this.model.armR.rotation.x = -2.4;
          }
        }
      }
      if (this.type === 'golem' && dist > 9 && this.cd <= 0) {
        this.cd = 3.5;
        this.throwBoulder();
      }
    } else if (this.type === 'creeper') {
      if (this.fuse > 0 || (dist < 2.4 && Math.abs(dy) < 2)) {
        if (this.fuse === 0) g.sfx.play('fuse', this.pos);
        this.fuse += dt;
        move = 0.15;
        if (dist > 5) this.fuse = 0; // 玩家逃脱，熄火
        if (this.fuse >= d.fuse) {
          g.explode(tmp2.set(this.pos.x, this.pos.y + 0.8, this.pos.z), d.radius, d.dmg, 'enemy');
          this.die(false);
          return;
        }
      }
    } else if (this.type === 'skeleton') {
      const eye = new THREE.Vector3(this.pos.x, this.pos.y + 1.7, this.pos.z);
      const target = p.eyePos.clone();
      target.y -= 0.35;
      const los = dist < d.range && this.hasLOS(eye, target);
      if (los) {
        if (dist < d.prefer - 4) {
          dirX = -to.x;
          dirZ = -to.z;
        } else if (dist < d.prefer + 4) {
          // 侧移
          dirX = -to.z * this.strafe;
          dirZ = to.x * this.strafe;
          move = 0.7;
        }
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafeT = 1.5 + Math.random() * 2;
          this.strafe *= -1;
        }
        if (this.cd <= 0) {
          this.cd = d.attackCd * (0.8 + Math.random() * 0.4);
          this.shoot(eye, target, dist);
        }
      }
    }

    // 面朝玩家
    const targetYaw = Math.atan2(to.x, to.z);
    let dyaw = targetYaw - this.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.yaw += dyaw * Math.min(1, dt * 8);

    // 移动
    const sp = this.speed * move;
    const inWater = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z)) === B.WATER;
    const k = 1 - Math.exp(-(this.onGround ? 10 : 2) * dt);
    this.vel.x += (dirX * sp * (inWater ? 0.6 : 1) - this.vel.x) * k;
    this.vel.z += (dirZ * sp * (inWater ? 0.6 : 1) - this.vel.z) * k;
    if (inWater) {
      this.vel.y = Math.min(this.vel.y + 30 * dt, 3);
    } else this.vel.y -= 26 * dt;
    moveBody(world, this, dt);

    // 被挡住：一格高就跳，否则拆墙
    if ((this.hitX || this.hitZ) && move > 0.3) {
      const fx = Math.floor(this.pos.x + dirX * (this.w + 0.5));
      const fz = Math.floor(this.pos.z + dirZ * (this.w + 0.5));
      const fy = Math.floor(this.pos.y);
      const clear = !world.solidAt(fx, fy + 1, fz) && !world.solidAt(fx, fy + 2, fz);
      if (clear && this.onGround && this.type !== 'golem') this.vel.y = 8.4;
      else if (d.digs) {
        this.dig += dt;
        if (this.dig > (this.type === 'golem' ? 0.3 : 0.55)) {
          this.dig = 0;
          const top = this.type === 'golem' ? 4 : 1;
          for (let y = fy + top; y >= fy; y--) {
            if (!world.solidAt(fx, y, fz) || !world.inBounds(fx, y, fz)) continue;
            const id = world.get(fx, y, fz);
            const r = world.damageBlock(fx, y, fz, d.digPower);
            if (r === 'broken') {
              g.fx.blockBreak(fx, y, fz, id, 8);
              g.sfx.play('break', this.pos, 0.8);
            } else g.fx.chips(tmp2.set(fx + 0.5, y + 0.5, fz + 0.5), id, 4);
            if (this.type !== 'golem') break;
          }
          this.model.armL && (this.model.armL.rotation.x = -2.2);
        }
      } else if (this.onGround) {
        this.vel.y = 8.4;
        this.strafe *= -1;
      }
    }
    if (this.pos.y < -10) this.die(false);

    this.animate(dt, Math.hypot(this.vel.x, this.vel.z));
  }

  hasLOS(from, to) {
    const dir = tmp2.copy(to).sub(from);
    const len = dir.length();
    dir.divideScalar(len);
    const origin = from.clone();
    return !this.game.world.raycast(origin, dir, len);
  }

  shoot(from, target, dist) {
    const g = this.game;
    const speed = 28;
    const t = dist / speed;
    const aim = target.clone().addScaledVector(g.player.vel, t * 0.6);
    aim.y += 0.5 * 9 * t * t; // 抛物线补偿
    const dir = aim.sub(from).normalize();
    dir.x += (Math.random() - 0.5) * 0.04;
    dir.y += (Math.random() - 0.5) * 0.04;
    g.enemies.addProjectile('arrow', from.clone(), dir.multiplyScalar(speed), this.def.dmg);
    g.sfx.play('bow', this.pos);
    this.model.armL.rotation.x = -1.6;
  }

  throwBoulder() {
    const g = this.game;
    const from = this.pos.clone();
    from.y += 4.6;
    const target = g.player.pos.clone();
    const dist = from.distanceTo(target);
    const speed = 20;
    const t = dist / speed;
    const v = target.sub(from).divideScalar(t);
    v.y += 0.5 * 18 * t;
    g.enemies.addProjectile('boulder', from, v, this.def.dmg * 0.8);
    this.model.armR.rotation.x = -3;
    g.sfx.play('swing', this.pos, 1);
  }

  slam() {
    const g = this.game;
    const p = g.player;
    this.slamT = 0.5;
    this.model.armL.rotation.x = -3;
    this.model.armR.rotation.x = -3;
    g.sfx.play('slam', this.pos, 1.2);
    g.shake = Math.min(1, g.shake + 0.7);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      g.fx.debris(this.pos.x + Math.cos(a) * 2.5, this.pos.y + 0.2, this.pos.z + Math.sin(a) * 2.5, this.def.blood, 1, 4, 0.25, 1);
    }
    const d = p.pos.distanceTo(this.pos);
    if (d < 5.5) {
      p.damage(this.def.dmg * (1 - d / 8), this.pos);
      p.knock(tmp2.copy(p.pos).sub(this.pos).setY(0).normalize(), 9);
    }
  }

  animate(dt, hs) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    this.walk += hs * dt * (this.def.boss ? 1.6 : 3.2);
    const sw = Math.sin(this.walk) * Math.min(1, hs / 2) * 0.8;
    if (m.legL) {
      m.legL.rotation.x = sw;
      m.legR.rotation.x = -sw;
    }
    if (m.legs) m.legs.forEach((l, i) => (l.rotation.x = (i % 3 === 0 ? sw : -sw) * 1.2));
    const restArm = this.type === 'zombie' ? -1.45 : this.type === 'skeleton' ? -0.2 : 0;
    const kk = 1 - Math.exp(-dt * 5);
    if (m.armL) {
      const swing = this.type === 'zombie' ? sw * 0.15 : -sw * 0.6;
      m.armL.rotation.x += (restArm + swing - m.armL.rotation.x) * kk;
      m.armR.rotation.x += (restArm - swing - m.armR.rotation.x) * kk;
    }
    // 爆破怪：引信闪烁膨胀
    if (this.type === 'creeper') {
      const f = this.fuse / this.def.fuse;
      const s = 1 + f * 0.25 + (f > 0 ? Math.sin(this.fuse * 30) * 0.03 : 0);
      m.root.scale.set(s, 1 + f * 0.12, s);
      m.spark.visible = Math.sin(performance.now() * 0.03) > -0.3;
      if (f > 0) this.flash = Math.max(this.flash, Math.sin(this.fuse * (8 + f * 20)) > 0 ? 0.12 : 0);
    }
    this.flash = Math.max(0, this.flash - dt);
    const e = this.flash > 0 ? (this.type === 'creeper' && this.fuse > 0 ? 0.9 : 0.6) : 0;
    for (const mat of m.mats) {
      if (mat.emissive) mat.emissive.setRGB(e, this.type === 'creeper' && this.fuse > 0 ? e : 0, this.type === 'creeper' && this.fuse > 0 ? e : 0);
    }
  }
}

// ---------- 管理器 ----------

export class Enemies {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.list = [];
    this.projectiles = [];
    this.tex = {};
    for (const [k, f] of Object.entries(FACES)) this.tex[k] = f();
    this.arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.7);
    this.arrowMat = new THREE.MeshLambertMaterial({ color: 0xc8b48a });
    this.boulderGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    this.boulderMat = new THREE.MeshLambertMaterial({ color: 0x8a8c92 });
  }

  get alive() {
    return this.list.length;
  }

  get boss() {
    return this.list.find((e) => e.def.boss) || null;
  }

  spawn(type, pos, mult) {
    const e = new Enemy(this.game, type, pos, mult, this.tex);
    this.list.push(e);
    return e;
  }

  clear() {
    for (const e of this.list) {
      this.group.remove(e.model.root);
      for (const m of e.model.mats) m.dispose();
    }
    this.list.length = 0;
    for (const p of this.projectiles) this.game.scene.remove(p.mesh);
    this.projectiles.length = 0;
  }

  addProjectile(kind, pos, vel, dmg) {
    const mesh = new THREE.Mesh(kind === 'arrow' ? this.arrowGeo : this.boulderGeo, kind === 'arrow' ? this.arrowMat : this.boulderMat);
    mesh.castShadow = kind === 'boulder';
    mesh.position.copy(pos);
    this.game.scene.add(mesh);
    this.projectiles.push({ kind, pos, vel, dmg, mesh, life: kind === 'arrow' ? 5 : 6, stuck: false });
  }

  update(dt) {
    for (const e of this.list) e.update(dt);
    this.list = this.list.filter((e) => !e.dead);

    // 互相推开
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i];
        const b = L[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const min = a.w + b.w + 0.1;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5 * Math.min(1, dt * 10);
          a.vel.x -= dx * push * 4;
          a.vel.z -= dz * push * 4;
          b.vel.x += dx * push * 4;
          b.vel.z += dz * push * 4;
        }
      }
    }
    this.updateProjectiles(dt);
  }

  updateProjectiles(dt) {
    const g = this.game;
    const p = g.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        g.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.stuck) continue;
      pr.vel.y -= (pr.kind === 'arrow' ? 9 : 18) * dt;
      const dist = pr.vel.length() * dt;
      const dir = tmp.copy(pr.vel).normalize();
      const bh = g.world.raycast(pr.pos, dir, dist);
      const t = rayAABB(pr.pos, dir, p.pos.x - p.w - 0.15, p.pos.y, p.pos.z - p.w - 0.15, p.pos.x + p.w + 0.15, p.pos.y + p.h, p.pos.z + p.w + 0.15);
      if (t !== null && t <= dist && (!bh || t < bh.t)) {
        if (pr.kind === 'boulder') g.explode(pr.pos.clone().addScaledVector(dir, t), 1.8, pr.dmg, 'enemy');
        else p.damage(pr.dmg, pr.pos.clone().sub(pr.vel));
        g.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (bh) {
        pr.pos.addScaledVector(dir, bh.t);
        if (pr.kind === 'boulder') {
          g.explode(pr.pos.clone(), 1.8, pr.dmg, 'enemy');
          g.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
        pr.stuck = true;
        pr.life = 3;
        pr.mesh.position.copy(pr.pos);
        continue;
      }
      pr.pos.addScaledVector(dir, dist);
      pr.mesh.position.copy(pr.pos);
      if (pr.kind === 'arrow') pr.mesh.lookAt(tmp2.copy(pr.pos).add(pr.vel));
      else pr.mesh.rotation.x += dt * 5;
    }
  }

  raycast(origin, dir, maxT) {
    let best = null;
    for (const e of this.list) {
      if (e.dead) continue;
      const t = rayAABB(origin, dir, e.pos.x - e.w, e.pos.y, e.pos.z - e.w, e.pos.x + e.w, e.pos.y + e.h, e.pos.z + e.w);
      if (t !== null && t < maxT && (!best || t < best.t)) best = { enemy: e, t };
    }
    if (best) {
      const hy = origin.y + dir.y * best.t;
      best.head = hy > best.enemy.pos.y + best.enemy.h * best.enemy.def.headFrac;
    }
    return best;
  }
}
