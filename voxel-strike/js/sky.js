// 天空：昼夜循环、日月、星空、方块云、无限海洋

import * as THREE from 'three';
import { createWaterTexture, pixelTexture } from './blocks.js';
import { mulberry32, createNoise2D, clamp, smoothstep } from './noise.js';
import { SX, SZ, WATER_Y } from './world.js';

const DAY_LENGTH = 300; // 一个完整昼夜（秒）
const C_DAY = new THREE.Color('#8ec8ff');
const C_DUSK = new THREE.Color('#f7a46b');
const C_NIGHT = new THREE.Color('#0a1028');
const C_WATER_FOG = new THREE.Color('#1d4f8f');

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.06;
    this.dayK = 1;
    this.center = new THREE.Vector3(SX / 2, 16, SZ / 2);

    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 2.4));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -72;
    sc.right = sc.top = 72;
    sc.near = 1;
    sc.far = 300;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.target.position.copy(this.center);
    scene.add(sun, sun.target);

    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x7a6a4a, 1.1);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(C_DAY.clone(), 40, 140);
    scene.background = C_DAY.clone();
    this.skyColor = new THREE.Color();

    // 方形太阳与月亮
    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0, fog: false, transparent: true, depthWrite: false }),
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false, transparent: true, depthWrite: false }),
    );
    this.sunMesh.renderOrder = this.moonMesh.renderOrder = -1;
    scene.add(this.sunMesh, this.moonMesh);

    // 星空
    const rnd = mulberry32(5);
    const pts = [];
    for (let i = 0; i < 900; i++) {
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pts.push(Math.cos(a) * r * 350, Math.abs(u) * 350, Math.sin(a) * r * 350);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, transparent: true, fog: false, depthWrite: false }),
    );
    scene.add(this.stars);

    // 方块云
    const cc = document.createElement('canvas');
    cc.width = cc.height = 64;
    const cg = cc.getContext('2d');
    const noise = createNoise2D(9);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        // 在环面上采样，保证贴图可无缝平铺
        const ax = (x / 64) * Math.PI * 2;
        const ay = (y / 64) * Math.PI * 2;
        const v = noise(Math.cos(ax) * 2 + Math.cos(ay) * 0.7, Math.sin(ax) * 2 + Math.sin(ay) * 1.9);
        if (v > 0.25) {
          cg.fillStyle = '#ffffff';
          cg.fillRect(x, y, 1, 1);
        }
      }
    }
    this.cloudTex = pixelTexture(cc);
    this.cloudTex.wrapS = this.cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudTex.repeat.set(6, 6);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.set(SX / 2, 72, SZ / 2);
    scene.add(this.clouds);

    // 无限海洋：一张大平面，贴合世界内海平面
    this.waterTex = createWaterTexture();
    this.waterTex.repeat.set(1600, 1600);
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshLambertMaterial({ map: this.waterTex, color: 0xbfd8ff, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(SX / 2, WATER_Y, SZ / 2);
    this.ocean.renderOrder = 2;
    scene.add(this.ocean);
  }

  setShadows(quality) {
    const size = quality === 'high' ? 2048 : 1024;
    this.sun.castShadow = quality !== 'off';
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  update(dt, camPos, underwater) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    const a = this.time * Math.PI * 2;
    // 偏置让白天更长（约 60%）
    const el = Math.sin(a) + 0.22;
    const dir = new THREE.Vector3(Math.cos(a), el, 0.45).normalize();
    const day = (this.dayK = smoothstep(-0.12, 0.25, el));
    const dusk = clamp(1 - Math.abs(el - 0.05) * 4, 0, 1);

    const lightDir = el > 0 ? dir : dir.clone().negate();
    this.sun.position.copy(this.center).addScaledVector(lightDir, 140);
    this.sun.intensity = el > 0 ? 2.5 * smoothstep(0, 0.2, el) : 0.35 * smoothstep(0, 0.2, -el);
    this.sun.color.setRGB(1, 0.85 + 0.15 * (1 - dusk), 0.7 + 0.3 * (1 - dusk));
    if (el <= 0) this.sun.color.setRGB(0.6, 0.7, 1);
    this.hemi.intensity = 0.3 + 0.85 * day;

    this.skyColor.copy(C_NIGHT).lerp(C_DAY, day).lerp(C_DUSK, dusk * 0.55);
    if (underwater) {
      this.scene.fog.color.copy(C_WATER_FOG);
      this.scene.fog.near = 1;
      this.scene.fog.far = 22;
      this.scene.background.copy(C_WATER_FOG);
    } else {
      this.scene.fog.color.copy(this.skyColor);
      this.scene.fog.near = 40;
      this.scene.fog.far = 120 + 30 * day;
      this.scene.background.copy(this.skyColor);
    }

    this.sunMesh.position.copy(camPos).addScaledVector(dir, 300);
    this.sunMesh.lookAt(camPos);
    this.moonMesh.position.copy(camPos).addScaledVector(dir, -300);
    this.moonMesh.lookAt(camPos);
    this.stars.position.copy(camPos);
    this.stars.material.opacity = 1 - day;
    this.clouds.material.opacity = 0.25 + 0.6 * day;
    this.cloudTex.offset.x += dt * 0.0015;
    this.waterTex.offset.set(Math.sin(performance.now() * 0.0003) * 0.15, performance.now() * 0.00004);
  }
}
