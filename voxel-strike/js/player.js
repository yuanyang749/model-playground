// 玩家：第一人称移动、视角、生命值

import * as THREE from 'three';
import { moveBody } from './physics.js';
import { B } from './blocks.js';
import { WATER_Y } from './world.js';
import { input } from './input.js';

const GRAVITY = 26;
const tmp = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.w = 0.3;
    this.h = 1.8;
    this.eye = 1.62;
    this.maxHp = 100;
    this.reset(new THREE.Vector3());
  }

  reset(spawn) {
    this.pos.copy(spawn);
    this.vel.set(0, 0, 0);
    this.yaw = Math.PI * 0.25;
    this.pitch = -0.05;
    this.recoil = 0;
    this.hp = this.maxHp;
    this.blocks = 32;
    this.onGround = false;
    this.inWater = false;
    this.sinceHurt = 99;
    this.stepDist = 0;
    this.bobPhase = 0;
    this.bob = 0;
    this.sprinting = false;
    this.fallSpeed = 0;
    this.dead = false;
    this.fov = 75;
  }

  get eyePos() {
    return tmp.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  damage(amount, from) {
    if (this.dead || amount <= 0) return;
    this.hp -= amount;
    this.sinceHurt = 0;
    this.game.sfx.play('hurt', null, 0.8);
    this.game.hud.hurt(amount, from, this);
    this.game.shake = Math.min(1, this.game.shake + amount / 40);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt) {
    const g = this.game;
    const settings = g.settings;
    const ads = g.arsenal.ads;

    // 视角
    const sens = 0.0022 * settings.sens * (1 - ads * 0.45);
    this.yaw -= input.dx * sens;
    this.pitch -= input.dy * sens;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));

    // 移动意图
    const k = input.keys;
    let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let mz = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }
    this.sprinting = k.has('ShiftLeft') && mz < 0 && ads < 0.3 && !g.arsenal.reloading;
    const head = this.pos.y + this.eye;
    this.inWater = g.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z)) === B.WATER;
    this.underwater = head < WATER_Y && g.world.get(Math.floor(this.pos.x), Math.floor(head), Math.floor(this.pos.z)) === B.WATER;
    let speed = this.sprinting ? 8.2 : 5.4;
    if (ads > 0.5) speed = 3.4;
    if (this.inWater) speed *= 0.6;
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    const wx = (mx * c + mz * s) * speed;
    const wz = (-mx * s + mz * c) * speed;
    const accel = this.onGround ? 14 : this.inWater ? 6 : 3;
    const t = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx - this.vel.x) * t;
    this.vel.z += (wz - this.vel.z) * t;

    // 跳跃 / 游泳 / 重力
    if (this.inWater) {
      this.vel.y -= GRAVITY * 0.3 * dt;
      this.vel.y *= Math.exp(-2.5 * dt);
      if (k.has('Space')) this.vel.y = Math.min(this.vel.y + 22 * dt, 4.2);
    } else {
      this.vel.y -= GRAVITY * dt;
      if (k.has('Space') && this.onGround) this.vel.y = 8.6;
    }
    this.vel.y = Math.max(this.vel.y, -40);

    const wasGround = this.onGround;
    const vyBefore = this.vel.y;
    moveBody(g.world, this, dt);

    // 落地：音效与摔落伤害
    if (this.onGround && !wasGround) {
      if (vyBefore < -6) g.sfx.play('land', null, Math.min(1, -vyBefore / 16));
      if (vyBefore < -15 && !this.inWater) this.damage(Math.round((-vyBefore - 15) * 3.5), null);
    }

    // 脚步
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 1) {
      this.stepDist += hs * dt;
      this.bobPhase += hs * dt * 1.9;
      if (this.stepDist > 2.3) {
        this.stepDist = 0;
        const under = g.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z));
        g.sfx.play(under === B.STONE || under === B.BRICK || under === B.COAL ? 'stepStone' : 'step', null, 0.6);
      }
    }
    this.bob += ((this.onGround ? Math.min(1, hs / 6) : 0) - this.bob) * (1 - Math.exp(-10 * dt));

    // 回血：6 秒未受伤后每秒 +4
    this.sinceHurt += dt;
    if (this.sinceHurt > 6 && this.hp < this.maxHp) this.heal(4 * dt);

    // 掉出世界
    if (this.pos.y < -20) this.damage(999, null);

    // 后坐力回落
    this.recoil *= Math.exp(-dt * 9);

    // 相机
    const cam = g.camera;
    const bobY = Math.abs(Math.cos(this.bobPhase)) * 0.06 * this.bob;
    const bobX = Math.sin(this.bobPhase) * 0.035 * this.bob;
    const shake = g.shake * g.shake;
    cam.position.set(
      this.pos.x + Math.cos(this.yaw) * bobX,
      this.pos.y + this.eye + bobY,
      this.pos.z - Math.sin(this.yaw) * bobX,
    );
    cam.rotation.set(
      this.pitch + this.recoil + (Math.random() - 0.5) * shake * 0.08,
      this.yaw + (Math.random() - 0.5) * shake * 0.08,
      (Math.random() - 0.5) * shake * 0.04,
    );
    const targetFov = settings.fov * (this.sprinting ? 1.08 : 1) * (1 - ads * (1 - g.arsenal.def.zoom));
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-14 * dt));
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  /** 爆炸冲击 */
  knock(dir, force) {
    this.vel.addScaledVector(dir, force);
    this.vel.y += force * 0.4;
  }
}
