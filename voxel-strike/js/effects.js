// 视觉特效：体素碎屑（InstancedMesh）、弹道曳光、闪光灯

import * as THREE from 'three';
import { BLOCKS } from './blocks.js';

const MAX = 2400;
const tmpColor = new THREE.Color();

export class Effects {
  constructor(scene, world) {
    this.world = world;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, tmpColor.set(1, 1, 1));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // 发光粒子（火焰、火花），不受光照影响
    this.glowMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      800,
    );
    this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.glowMesh.setColorAt(0, tmpColor.set(1, 1, 1));
    this.glowMesh.count = 0;
    this.glowMesh.frustumCulled = false;
    scene.add(this.glowMesh);

    // 烟雾：半透明、不受光照，避免看起来像石块
    this.smokeMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false }),
      900,
    );
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smokeMesh.setColorAt(0, tmpColor.set(1, 1, 1));
    this.smokeMesh.count = 0;
    this.smokeMesh.frustumCulled = false;
    scene.add(this.smokeMesh);

    this.parts = [];
    this.glows = [];
    this.smokes = [];
    this.dummy = new THREE.Object3D();

    this.tracers = [];
    const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
    tracerGeo.translate(0, 0, -0.5);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(
        tracerGeo,
        new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      m.visible = false;
      m.life = 0;
      scene.add(m);
      this.tracers.push(m);
    }

    this.flash = new THREE.PointLight(0xffb060, 0, 22, 1.6);
    scene.add(this.flash);
    this.flashDecay = 20;
  }

  clear() {
    this.parts.length = 0;
    this.glows.length = 0;
    this.smokes.length = 0;
  }

  spawn(list, max, x, y, z, vx, vy, vz, color, size, life, grav) {
    if (list.length >= max) list.splice(0, 1);
    list.push({
      x, y, z, vx, vy, vz, size, life, maxLife: life, grav,
      color: color.clone ? color.clone() : new THREE.Color(color),
      rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
    });
  }

  debris(x, y, z, color, n, speed, size = 0.16, life = 1.4) {
    for (let i = 0; i < n; i++) {
      const c = tmpColor.copy(color).multiplyScalar(0.8 + Math.random() * 0.4);
      this.spawn(
        this.parts, MAX, x, y, z,
        (Math.random() - 0.5) * speed, Math.random() * speed * 0.9 + 1, (Math.random() - 0.5) * speed,
        c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), 22,
      );
    }
  }

  blockBreak(x, y, z, id, n = 10) {
    const blk = BLOCKS[id];
    if (blk) this.debris(x + 0.5, y + 0.5, z + 0.5, blk.color, n, 5, 0.18);
  }

  chips(point, id, n = 3) {
    const blk = BLOCKS[id];
    if (blk) this.debris(point.x, point.y, point.z, blk.color, n, 3, 0.08, 0.6);
  }

  smoke(x, y, z, n, spread = 1, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const g = 0.55 + Math.random() * 0.3;
      this.spawn(
        this.smokes, 900,
        x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 1.5,
        tmpColor.setRGB(g, g, g), size * (0.5 + Math.random() * 0.7), 0.8 + Math.random() * 0.9, -1.2,
      );
    }
  }

  sparks(x, y, z, n, color = 0xffc040, speed = 8) {
    for (let i = 0; i < n; i++) {
      this.spawn(
        this.glows, 800, x, y, z,
        (Math.random() - 0.5) * speed, (Math.random() - 0.3) * speed, (Math.random() - 0.5) * speed,
        tmpColor.set(color), 0.06 + Math.random() * 0.1, 0.2 + Math.random() * 0.3, 10,
      );
    }
  }

  explosion(pos, r) {
    this.flash.position.copy(pos);
    this.flash.intensity = 60 * r;
    this.flash.distance = r * 9;
    this.flashDecay = 6;
    const fire = [0xffe070, 0xff9a30, 0xff5a20];
    for (let i = 0; i < 40 * r; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI;
      const v = (2 + Math.random() * 6) * r * 0.6;
      this.spawn(
        this.glows, 800, pos.x, pos.y, pos.z,
        Math.cos(a) * Math.sin(b) * v, Math.cos(b) * v + 2, Math.sin(a) * Math.sin(b) * v,
        tmpColor.set(fire[i % 3]), 0.25 + Math.random() * 0.45 * r * 0.5, 0.3 + Math.random() * 0.4, 2,
      );
    }
    this.smoke(pos.x, pos.y, pos.z, 12 * r, r, 0.6);
  }

  muzzle(pos) {
    this.flash.position.copy(pos);
    this.flash.intensity = Math.max(this.flash.intensity, 6);
    this.flash.distance = 10;
    this.flashDecay = 40;
  }

  tracer(from, to) {
    const m = this.tracers.find((t) => !t.visible) || this.tracers[0];
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(0.025, 0.025, len);
    m.material.opacity = 0.9;
    m.life = 0.07;
    m.visible = true;
  }

  updateList(list, mesh, dt, collide) {
    const d = this.dummy;
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      p.vy -= p.grav * dt;
      if (p.grav < 0) {
        p.vx *= 0.97;
        p.vz *= 0.97;
        p.vy *= 0.97;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (collide && p.grav > 0 && this.world.solidAt(Math.floor(p.x), Math.floor(p.y - p.size * 0.5), Math.floor(p.z))) {
        p.y = Math.floor(p.y - p.size * 0.5) + 1 + p.size * 0.5;
        p.vy *= -0.25;
        p.vx *= 0.55;
        p.vz *= 0.55;
        p.spin *= 0.5;
      }
      p.rx += p.spin * dt;
      p.ry += p.spin * 0.7 * dt;
      const s = p.size * Math.min(1, (p.life / p.maxLife) * 3);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, 0);
      d.scale.set(s, s, s);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      mesh.setColorAt(n, p.color);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    this.updateList(this.parts, this.mesh, dt, true);
    this.updateList(this.glows, this.glowMesh, dt, false);
    this.updateList(this.smokes, this.smokeMesh, dt, false);
    this.flash.intensity *= Math.exp(-dt * this.flashDecay);
    for (const t of this.tracers) {
      if (!t.visible) continue;
      t.life -= dt;
      t.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) t.visible = false;
    }
  }
}
