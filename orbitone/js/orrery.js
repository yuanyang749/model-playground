// 天体仪：纯数学的轨道时钟。角度 0 指向正上方，顺时针递增。
// 每条轨道有自己的旋转参考系（ringAngle），行星以相对该参考系的偏移 phi 存储，
// 因此改变速度时只需重定基准，行星间的相对位置（即节奏关系）保持不变。

import { TAU, wrap, RING_COUNT, BEATS_PER_CYCLE, SLOTS, ringRevs } from './music.js';

const SLOT = TAU / SLOTS;

export class Orrery {
  constructor() {
    this.planets = [];
    this.bpm = 76;
    this.mode = 'harmonic';
    this.meridians = 1;
    this.uid = 1;
    this.t0 = 0;
    this.phase0 = new Float64Array(RING_COUNT);
  }

  get cycle() {
    return (BEATS_PER_CYCLE * 60) / this.bpm;
  }

  omega(ring) {
    return (TAU * ringRevs(ring, this.mode)) / this.cycle;
  }

  ringAngle(ring, t) {
    return this.phase0[ring] + this.omega(ring) * (t - this.t0);
  }

  angle(p, t) {
    return this.ringAngle(p.ring, t) + p.phi;
  }

  /** 在时刻 t 冻结各轨道相位，再应用改变（速度/模式），保证运动连续 */
  retime(t, change) {
    for (let i = 0; i < RING_COUNT; i++) this.phase0[i] = wrap(this.ringAngle(i, t));
    this.t0 = t;
    change();
  }

  /** 所有轨道参考系在时刻 t 对齐（用于新星系：所有轨道同时起拍） */
  resetPhases(t) {
    this.phase0.fill(0);
    this.t0 = t;
  }

  /** 把屏幕角度换算成轨道参考系内的偏移；吸附时对齐到随轨道旋转的槽位 */
  offsetFor(ring, angle, t, snap) {
    const phi = wrap(angle - this.ringAngle(ring, t));
    return snap ? wrap(Math.round(phi / SLOT) * SLOT) : phi;
  }

  add(ring, phi, size) {
    const p = { id: this.uid++, ring, phi: wrap(phi), size, flash: 1 };
    this.planets.push(p);
    return p;
  }

  remove(p) {
    const i = this.planets.indexOf(p);
    if (i >= 0) this.planets.splice(i, 1);
    p.dead = true;
  }

  clear() {
    for (const p of this.planets) p.dead = true;
    this.planets.length = 0;
  }

  /** 精确求出 (t1, t2] 内每颗行星穿越子午线的时刻 */
  crossings(t1, t2, cb) {
    if (t2 <= t1) return;
    const M = this.meridians;
    const seg = TAU / M;
    for (const p of this.planets) {
      if (p.dragging) continue;
      const w = this.omega(p.ring);
      const base = this.phase0[p.ring] + p.phi;
      const k1 = Math.floor(this.angle(p, t1) / seg) + 1;
      const k2 = Math.floor(this.angle(p, t2) / seg);
      for (let k = k1; k <= k2; k++) {
        cb(p, this.t0 + (k * seg - base) / w, ((k % M) + M) % M);
      }
    }
  }
}
