// 武器系统：数据、开火（命中扫描 / 火箭弹）、工兵镐挖掘与放置、第一人称视图模型

import * as THREE from 'three';
import { input } from './input.js';
import { B, isSolid } from './blocks.js';

export const WEAPONS = [
  {
    id: 'rifle', name: '方块步枪', auto: true, rpm: 600, dmg: 24, head: 2, mag: 30, reserve: 240, reload: 1.6,
    spread: 0.014, adsSpread: 0.002, recoil: 0.014, pellets: 1, range: 140, blockDmg: 0.4, zoom: 0.62,
    vm: [0.24, -0.25, -0.52], adsVm: [0, -0.165, -0.42], muzzle: [0, 0.015, -0.56], sound: 'rifle',
  },
  {
    id: 'shotgun', name: '霰弹枪', auto: false, rpm: 75, dmg: 14, head: 1.5, mag: 6, reserve: 42, reload: 2.1,
    spread: 0.075, adsSpread: 0.05, recoil: 0.06, pellets: 9, range: 45, blockDmg: 0.9, zoom: 0.85,
    vm: [0.24, -0.26, -0.5], adsVm: [0, -0.17, -0.42], muzzle: [0, 0.02, -0.62], sound: 'shotgun',
  },
  {
    id: 'rocket', name: '火箭筒', auto: false, rpm: 50, dmg: 160, head: 1, mag: 1, reserve: 12, reload: 2.0,
    spread: 0.004, adsSpread: 0.001, recoil: 0.07, projectile: true, speed: 42, radius: 3.4, zoom: 0.8,
    vm: [0.26, -0.24, -0.45], adsVm: [0.06, -0.2, -0.38], muzzle: [0, 0.02, -0.75], sound: 'rocket',
  },
  {
    id: 'pick', name: '工兵镐', melee: true, rpm: 230, dmg: 40, reach: 4.6, blockDmg: 1.7, zoom: 1,
    vm: [0.32, -0.34, -0.52], adsVm: [0.32, -0.34, -0.52], muzzle: [0, 0, 0],
  },
];

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

// ---------- 视图模型（方块拼装） ----------

const matCache = new Map();
function mat(color, emissive = false) {
  const key = color + (emissive ? 'e' : '');
  if (!matCache.has(key)) {
    matCache.set(key, emissive
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshLambertMaterial({ color }));
  }
  return matCache.get(key);
}
function box(parent, w, h, d, color, x, y, z, emissive = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function arm(parent) {
  const g = new THREE.Group();
  box(g, 0.11, 0.11, 0.3, '#e0ac7d', 0, 0, 0);
  box(g, 0.125, 0.125, 0.2, '#2f6f8f', 0, 0, 0.24);
  g.position.set(0.07, -0.12, 0.14);
  g.rotation.set(0.25, 0.12, 0);
  parent.add(g);
  return g;
}

function buildModels() {
  const models = [];
  // 步枪
  {
    const g = new THREE.Group();
    box(g, 0.07, 0.09, 0.42, '#3a3f47', 0, 0, -0.05);
    box(g, 0.035, 0.035, 0.26, '#1e2126', 0, 0.015, -0.38);
    box(g, 0.065, 0.065, 0.18, '#5a6575', 0, -0.005, -0.27);
    const magz = box(g, 0.05, 0.15, 0.07, '#2b2f35', 0, -0.11, -0.08);
    magz.rotation.x = 0.15;
    box(g, 0.06, 0.085, 0.2, '#3a3f47', 0, -0.015, 0.25);
    box(g, 0.03, 0.035, 0.09, '#ff9a3c', 0, 0.065, -0.06);
    box(g, 0.012, 0.03, 0.012, '#ff9a3c', 0, 0.06, -0.47);
    const grip = box(g, 0.045, 0.1, 0.05, '#2b2f35', 0, -0.085, 0.07);
    grip.rotation.x = -0.3;
    arm(g);
    models.push(g);
  }
  // 霰弹枪
  {
    const g = new THREE.Group();
    box(g, 0.08, 0.09, 0.26, '#4a4f57', 0, 0, 0);
    box(g, 0.035, 0.035, 0.5, '#26272b', -0.019, 0.02, -0.34);
    box(g, 0.035, 0.035, 0.5, '#26272b', 0.019, 0.02, -0.34);
    box(g, 0.075, 0.06, 0.16, '#8b5a2b', 0, -0.04, -0.28);
    const stock = box(g, 0.07, 0.1, 0.28, '#8b5a2b', 0, -0.035, 0.25);
    stock.rotation.x = 0.1;
    box(g, 0.02, 0.02, 0.02, '#ffcc33', 0, 0.045, -0.56);
    arm(g);
    models.push(g);
  }
  // 火箭筒
  {
    const g = new THREE.Group();
    box(g, 0.13, 0.13, 0.82, '#56743d', 0, 0.02, -0.08);
    box(g, 0.155, 0.155, 0.06, '#2d3a22', 0, 0.02, -0.48);
    box(g, 0.155, 0.155, 0.06, '#2d3a22', 0, 0.02, 0.32);
    box(g, 0.05, 0.12, 0.06, '#2d3a22', 0, -0.09, -0.05);
    box(g, 0.04, 0.06, 0.1, '#ffcc33', -0.08, 0.08, -0.15);
    const tip = box(g, 0.08, 0.08, 0.1, '#d64535', 0, 0.02, -0.52);
    g.userData.tip = tip;
    arm(g);
    models.push(g);
  }
  // 工兵镐
  {
    const g = new THREE.Group();
    const p = new THREE.Group();
    box(p, 0.045, 0.52, 0.045, '#8b5a2b', 0, 0.1, 0);
    box(p, 0.4, 0.07, 0.07, '#5fe3d6', 0, 0.34, 0);
    box(p, 0.07, 0.07, 0.07, '#3fb8ad', 0.2, 0.31, 0);
    box(p, 0.07, 0.07, 0.07, '#3fb8ad', -0.2, 0.31, 0);
    p.rotation.set(-0.5, 0.2, 0.35);
    p.scale.setScalar(0.72);
    g.add(p);
    const a = arm(g);
    a.position.set(0.03, -0.08, 0.2);
    models.push(g);
  }
  return models;
}

// ---------- 武器系统 ----------

export class Arsenal {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.models = buildModels();
    for (const m of this.models) {
      m.visible = false;
      this.root.add(m);
    }
    // 枪口火焰
    this.flashMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.flashMesh.visible = false;
    game.vmScene.add(this.root);

    // 方块选取框
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
    );
    this.outline.visible = false;
    game.scene.add(this.outline);

    this.rocketGeo = new THREE.BoxGeometry(0.14, 0.14, 0.5);
    this.rocketMat = new THREE.MeshLambertMaterial({ color: 0x56743d });
    this.rockets = [];
    this.reset();
  }

  reset() {
    this.slots = WEAPONS.map((d) => ({ def: d, mag: d.mag ?? 0, reserve: d.reserve ?? 0 }));
    this.cur = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.switching = 0.4;
    this.ads = 0;
    this.kick = 0;
    this.swing = 0;
    this.flashT = 0;
    this.bloom = 0;
    this.swayX = 0;
    this.swayY = 0;
    for (const r of this.rockets) this.game.scene.remove(r.mesh);
    this.rockets.length = 0;
    this.showModel();
  }

  get slot() {
    return this.slots[this.cur];
  }

  get def() {
    return this.slots[this.cur].def;
  }

  showModel() {
    this.models.forEach((m, i) => (m.visible = i === this.cur));
    const d = this.def;
    this.models[this.cur].add(this.flashMesh);
    this.flashMesh.position.set(d.muzzle[0], d.muzzle[1], d.muzzle[2] - 0.05);
    this.game.hud.setWeapon(this);
  }

  select(i) {
    if (i === this.cur || i < 0 || i >= this.slots.length) return;
    this.cur = i;
    this.reloading = 0;
    this.switching = 0.35;
    this.cooldown = Math.max(this.cooldown, 0.2);
    this.game.sfx.play('equip');
    this.showModel();
  }

  reload() {
    const s = this.slot;
    const d = s.def;
    if (d.melee || this.reloading > 0 || s.mag >= d.mag || s.reserve <= 0) return;
    this.reloading = d.reload;
    this.game.sfx.play('reload');
  }

  addAmmo(fraction) {
    for (const s of this.slots) {
      if (s.def.melee) continue;
      s.reserve = Math.min(s.def.reserve * 1.5, s.reserve + Math.ceil(s.def.reserve * fraction));
    }
    this.game.hud.setWeapon(this);
  }

  update(dt) {
    const g = this.game;
    const d = this.def;
    this.cooldown -= dt;
    this.switching = Math.max(0, this.switching - dt);
    this.flashT -= dt;
    this.kick *= Math.exp(-dt * 12);
    this.swing = Math.max(0, this.swing - dt * 4);
    this.bloom *= Math.exp(-dt * 6);

    // 切换武器
    for (let i = 0; i < 4; i++) if (input.pressed.has('Digit' + (i + 1))) this.select(i);
    if (input.wheel) this.select((this.cur + (input.wheel > 0 ? 1 : 3)) % 4);
    if (input.pressed.has('KeyR')) this.reload();

    // 换弹
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const s = this.slot;
        const take = Math.min(d.mag - s.mag, s.reserve);
        s.mag += take;
        s.reserve -= take;
        g.hud.setWeapon(this);
      }
    }

    // 瞄准
    const wantAds = !d.melee && input.mouse[2] && this.reloading <= 0 && !g.player.sprinting;
    this.ads += ((wantAds ? 1 : 0) - this.ads) * (1 - Math.exp(-dt * 16));

    // 开火
    const trigger = d.auto ? input.mouse[0] : input.clicked[0];
    if (trigger && this.cooldown <= 0 && this.switching <= 0 && this.reloading <= 0) this.fire();
    if (d.melee && input.clicked[2] && this.cooldown <= 0.15) this.placeBlock();

    this.updateRockets(dt);
    this.updateOutline();
    this.updateViewmodel(dt);
  }

  aimRay() {
    const cam = this.game.camera;
    cam.getWorldDirection(fwd);
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    return { origin: cam.position.clone(), dir: fwd.clone() };
  }

  muzzleWorld() {
    const cam = this.game.camera;
    return cam.position.clone().addScaledVector(right, 0.16).addScaledVector(up, -0.12).addScaledVector(fwd, 0.7);
  }

  fire() {
    const g = this.game;
    const s = this.slot;
    const d = s.def;
    if (d.melee) return this.swingPick();
    if (s.mag <= 0) {
      g.sfx.play('empty');
      this.cooldown = 0.25;
      this.reload();
      return;
    }
    s.mag--;
    this.cooldown = 60 / d.rpm;
    const { origin, dir } = this.aimRay();
    const muzzle = this.muzzleWorld();

    if (d.projectile) {
      const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      mesh.castShadow = true;
      const start = origin.clone().addScaledVector(dir, 0.8);
      mesh.position.copy(start);
      g.scene.add(mesh);
      this.rockets.push({ pos: start, vel: dir.clone().multiplyScalar(d.speed), mesh, life: 5, def: d });
    } else {
      const moving = Math.min(1, Math.hypot(g.player.vel.x, g.player.vel.z) / 6);
      const spread = THREE.MathUtils.lerp(d.spread, d.adsSpread, this.ads) + moving * 0.02 * (1 - this.ads * 0.7) + this.bloom;
      for (let i = 0; i < d.pellets; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        const pd = dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
        this.hitscan(origin, pd, d, muzzle, i === 0 || d.pellets <= 3 || Math.random() < 0.4);
      }
      this.bloom = Math.min(0.05, this.bloom + d.recoil * 0.4);
    }

    g.player.recoil += d.recoil;
    g.player.yaw += (Math.random() - 0.5) * d.recoil * 0.5;
    this.kick = 1;
    this.flashT = 0.05;
    g.fx.muzzle(muzzle);
    g.sfx.play(d.sound);
    if (d.id === 'rocket') this.models[2].userData.tip.visible = false;
    g.hud.setWeapon(this);
    if (s.mag === 0 && s.reserve > 0) setTimeout(() => this.cur === this.slots.indexOf(s) && this.reload(), 250);
  }

  hitscan(origin, dir, d, muzzle, tracer) {
    const g = this.game;
    const bh = g.world.raycast(origin, dir, d.range);
    const maxT = bh ? bh.t : d.range;
    const eh = g.enemies.raycast(origin, dir, maxT);
    const end = origin.clone();
    if (eh) {
      end.addScaledVector(dir, eh.t);
      const dmg = d.dmg * (eh.head ? d.head : 1) * (d.pellets > 1 ? Math.max(0.35, 1 - eh.t / d.range) : 1);
      const killed = eh.enemy.hurt(dmg, dir, eh.head);
      g.hud.hitmarker(eh.head, killed);
      g.sfx.play(killed ? 'kill' : eh.head ? 'headshot' : 'hit');
      g.fx.debris(end.x, end.y, end.z, eh.enemy.def.blood, 3, 3, 0.07, 0.5);
    } else if (bh) {
      end.addScaledVector(dir, bh.t);
      const r = g.world.damageBlock(bh.x, bh.y, bh.z, d.blockDmg);
      if (r === 'broken') {
        g.fx.blockBreak(bh.x, bh.y, bh.z, bh.id, 8);
        g.sfx.play('break', end, 0.7);
      } else g.fx.chips(end, bh.id, 3);
    } else end.addScaledVector(dir, d.range);
    if (tracer) g.fx.tracer(muzzle, end);
  }

  swingPick() {
    const g = this.game;
    const d = this.def;
    this.cooldown = 60 / d.rpm;
    this.swing = 1;
    g.sfx.play('swing', null, 0.6);
    const { origin, dir } = this.aimRay();
    const bh = g.world.raycast(origin, dir, d.reach);
    const eh = g.enemies.raycast(origin, dir, bh ? bh.t : d.reach);
    if (eh) {
      const killed = eh.enemy.hurt(d.dmg * (eh.head ? 1.5 : 1), dir, eh.head);
      eh.enemy.vel.addScaledVector(dir, 6);
      eh.enemy.vel.y += 3;
      g.hud.hitmarker(eh.head, killed);
      g.sfx.play(killed ? 'kill' : 'hit');
      return;
    }
    if (!bh) return;
    const point = origin.clone().addScaledVector(dir, bh.t);
    const r = g.world.damageBlock(bh.x, bh.y, bh.z, d.blockDmg);
    if (r === 'broken') {
      g.fx.blockBreak(bh.x, bh.y, bh.z, bh.id, 12);
      g.sfx.play('break', point);
      if (bh.id !== B.LEAVES) {
        g.player.blocks = Math.min(999, g.player.blocks + 1);
        g.hud.setWeapon(this);
      }
    } else {
      g.fx.chips(point, bh.id, 5);
      g.sfx.play('dig', point);
    }
  }

  placeBlock() {
    const g = this.game;
    const p = g.player;
    if (p.blocks <= 0) {
      g.hud.popup('方块不足：用镐挖掘获取');
      return;
    }
    const { origin, dir } = this.aimRay();
    const bh = g.world.raycast(origin, dir, this.def.reach + 0.5);
    if (!bh) return;
    const x = bh.x + bh.nx;
    const y = bh.y + bh.ny;
    const z = bh.z + bh.nz;
    if (!g.world.inBounds(x, y, z) || isSolid(g.world.get(x, y, z))) return;
    // 不能把自己或敌人埋进去
    const blocked = (b) => x + 1 > b.pos.x - b.w && x < b.pos.x + b.w && y + 1 > b.pos.y && y < b.pos.y + b.h && z + 1 > b.pos.z - b.w && z < b.pos.z + b.w;
    if (blocked(p) || g.enemies.list.some((e) => !e.dead && blocked(e))) return;
    g.world.set(x, y, z, B.BRICK);
    p.blocks--;
    this.swing = 0.6;
    this.cooldown = 0.18;
    g.sfx.play('place', tmpV.set(x + 0.5, y + 0.5, z + 0.5));
    g.hud.setWeapon(this);
  }

  updateRockets(dt) {
    const g = this.game;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.vel.y -= 1.5 * dt;
      const dist = r.vel.length() * dt;
      const dir = tmpV.copy(r.vel).normalize();
      const bh = g.world.raycast(r.pos, dir, dist);
      const eh = g.enemies.raycast(r.pos, dir, bh ? bh.t : dist);
      let hitT = null;
      if (eh) hitT = eh.t;
      else if (bh) hitT = bh.t;
      if (hitT !== null || r.life <= 0 || r.pos.y < -5) {
        const at = r.pos.clone().addScaledVector(dir, Math.max(0, (hitT ?? 0) - 0.15));
        g.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
        g.explode(at, r.def.radius, r.def.dmg, 'player');
        continue;
      }
      r.pos.addScaledVector(dir, dist);
      r.mesh.position.copy(r.pos);
      r.mesh.lookAt(tmpV2.copy(r.pos).add(r.vel));
      g.fx.smoke(r.pos.x, r.pos.y, r.pos.z, 1, 0.1, 0.25);
      g.fx.sparks(r.pos.x, r.pos.y, r.pos.z, 1, 0xffa040, 2);
    }
  }

  updateOutline() {
    const g = this.game;
    if (!this.def.melee) {
      this.outline.visible = false;
      return;
    }
    const { origin, dir } = this.aimRay();
    const bh = g.world.raycast(origin, dir, this.def.reach);
    this.outline.visible = !!bh;
    if (bh) this.outline.position.set(bh.x + 0.5, bh.y + 0.5, bh.z + 0.5);
  }

  updateViewmodel(dt) {
    const g = this.game;
    const d = this.def;
    const p = g.player;
    const m = this.models[this.cur];
    const k = 1 - Math.exp(-dt * 10);
    this.swayX += (Math.max(-0.06, Math.min(0.06, -input.dx * 0.0007)) - this.swayX) * k;
    this.swayY += (Math.max(-0.06, Math.min(0.06, input.dy * 0.0007)) - this.swayY) * k;
    const a = this.ads;
    const free = 1 - a * 0.85;
    let x = THREE.MathUtils.lerp(d.vm[0], d.adsVm[0], a);
    let y = THREE.MathUtils.lerp(d.vm[1], d.adsVm[1], a);
    let z = THREE.MathUtils.lerp(d.vm[2], d.adsVm[2], a);
    x += Math.sin(p.bobPhase) * 0.014 * p.bob * free + this.swayX * free;
    y += Math.abs(Math.cos(p.bobPhase)) * 0.016 * p.bob * free + this.swayY * free;
    z += this.kick * (d.melee ? 0 : 0.07);
    let rx = this.kick * 0.12 + this.swayY;
    let ry = this.swayX * 1.5;
    let rz = 0;
    if (p.sprinting) {
      ry += 0.6;
      rx -= 0.2;
      x -= 0.05;
      y -= 0.04;
    }
    if (this.reloading > 0) {
      const t = 1 - this.reloading / d.reload;
      const dip = Math.sin(t * Math.PI);
      y -= dip * 0.16;
      rx -= dip * 0.7;
      rz += dip * 0.35;
      if (d.id === 'rocket' && t > 0.6) this.models[2].userData.tip.visible = true;
    }
    if (d.id === 'rocket' && this.reloading <= 0) this.models[2].userData.tip.visible = this.slot.mag > 0;
    y -= (this.switching / 0.35) * 0.4;
    if (this.swing > 0) {
      const s = Math.sin(this.swing * Math.PI);
      rx -= s * 1.1;
      z -= s * 0.12;
      y += s * 0.05;
    }
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    this.flashMesh.visible = this.flashT > 0;
    this.flashMesh.rotation.z = Math.random() * Math.PI;
  }
}
