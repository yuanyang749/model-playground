// 星空渲染器：Canvas 2D + 加色混合发光

import { TAU, wrap, RING_COUNT, RING_INNER, PALETTE, SLOTS, ringNorm } from './music.js';

const HALF_PI = Math.PI / 2;
const SUN = '#ffe2a8';

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function makeGlow(hex, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, rgba(hex, 1));
  grd.addColorStop(0.16, rgba(hex, 0.55));
  grd.addColorStop(0.45, rgba(hex, 0.12));
  grd.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

export class Sky {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.glows = PALETTE.map((c) => makeGlow(c));
    this.sunGlow = makeGlow(SUN, 256);
    this.particles = [];
    this.ripples = [];
    this.meteors = [];
    this.ringFlash = new Float32Array(RING_COUNT);
    this.meridianFlash = new Float32Array(4);
    this.sunPulse = 0;
    this.nextMeteor = 5;
    this.hasConic = typeof this.ctx.createConicGradient === 'function';
    this.resize();
  }

  resize() {
    const w = (this.w = window.innerWidth);
    const h = (this.h = window.innerHeight);
    // 超大屏时限制总像素数（约 600 万），保证帧率
    const dpr = (this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6 / (w * h)))));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const avail = h - (w < 760 ? 190 : 96);
    this.cx = w / 2;
    this.cy = avail / 2 + (w < 760 ? 24 : 10);
    this.R = Math.max(110, Math.min(w * 0.45, avail / 2 - 30));
    this.sunR = Math.max(9, this.R * 0.07);
    this.scale = Math.min(1.25, Math.max(0.7, this.R / 360));
    this.vignette = this.ctx.createRadialGradient(this.cx, this.cy, this.R * 0.7, this.cx, this.cy, Math.hypot(w, h) * 0.62);
    this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
    this.vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
    this.buildNebula();
    this.buildStars();
  }

  buildNebula() {
    const D = Math.ceil(Math.hypot(this.w, this.h));
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(D * 0.5); // 半分辨率，放大后自然柔化
    const g = c.getContext('2d');
    const m = c.width / 2;
    const hues = ['#4b2f9a', '#1f4f95', '#7a2f78', '#145e6e', '#5a2a66', '#2a3a8a'];
    const rnd = mulberry32(7);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TAU;
      const d = rnd() * m * 0.75;
      const x = m + Math.cos(a) * d;
      const y = m + Math.sin(a) * d;
      const r = m * (0.22 + rnd() * 0.45);
      const col = hues[i % hues.length];
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(col, 0.2));
      grd.addColorStop(0.5, rgba(col, 0.07));
      grd.addColorStop(1, rgba(col, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, c.width, c.height);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd() * 0.07})`;
      g.fillRect(rnd() * c.width, rnd() * c.height, 1, 1);
    }
    this.nebula = c;
    this.nebD = D;
  }

  buildStars() {
    const rnd = mulberry32(42);
    const n = Math.min(650, Math.floor((this.w * this.h) / 2400));
    const tints = ['#ffffff', '#ffffff', '#ffffff', '#ffe9c4', '#cfe0ff', '#ffd0e0'];
    this.stars = Array.from({ length: n }, () => ({
      x: rnd() * this.w,
      y: rnd() * this.h,
      r: rnd() < 0.92 ? 0.6 + rnd() * 0.8 : 1.4 + rnd() * 0.9,
      a: 0.15 + rnd() * 0.7,
      s: 0.4 + rnd() * 2.2,
      ph: rnd() * TAU,
      c: tints[Math.floor(rnd() * tints.length)],
    }));
  }

  // ---------- 几何与拾取 ----------

  pos(ring, angle) {
    const r = this.R * ringNorm(ring);
    return [this.cx + Math.sin(angle) * r, this.cy - Math.cos(angle) * r];
  }

  planetRadius(size) {
    return (3 + size * 2.4) * this.scale;
  }

  pick(x, y, planets) {
    let best = null;
    let bd = Infinity;
    for (const p of planets) {
      if (p.sx === undefined) continue;
      const d = Math.hypot(x - p.sx, y - p.sy);
      if (d < this.planetRadius(p.size) + 9 && d < bd) {
        best = p;
        bd = d;
      }
    }
    return best;
  }

  nearestRing(x, y, loose = false) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const n = Math.hypot(dx, dy) / this.R;
    const gap = (1 - RING_INNER) / (RING_COUNT - 1);
    const ring = Math.min(RING_COUNT - 1, Math.max(0, Math.round((n - RING_INNER) / gap)));
    if (Math.abs(n - ringNorm(ring)) > gap * (loose ? 1.5 : 0.5)) return null;
    return { ring, angle: wrap(Math.atan2(dx, -dy)) };
  }

  // ---------- 特效 ----------

  trigger(p, m) {
    this.ringFlash[p.ring] = 1;
    this.meridianFlash[m] = 1;
    p.flash = 1;
    this.sunPulse = Math.min(1.6, this.sunPulse + 0.16 + p.size * 0.08);
    if (p.sx === undefined) return;
    const rad = this.planetRadius(p.size);
    this.ripples.push({ x: p.sx, y: p.sy, r: rad, max: rad * 7 + 18, life: 1, col: PALETTE[p.ring] });
    this.burst(p.sx, p.sy, this.glows[p.ring], 5 + Math.round(p.size * 4), 30 + p.size * 30);
  }

  burst(x, y, glow, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1,
        decay: 0.6 + Math.random() * 0.9,
        size: 1.5 + Math.random() * 2.5,
        glow,
      });
    }
    if (this.particles.length > 800) this.particles.splice(0, this.particles.length - 800);
  }

  shatter(p) {
    if (p.sx === undefined) return;
    const rad = this.planetRadius(p.size);
    this.ripples.push({ x: p.sx, y: p.sy, r: rad, max: rad * 12 + 30, life: 1, col: PALETTE[p.ring] });
    this.burst(p.sx, p.sy, this.glows[p.ring], 36, 160);
  }

  bigBang() {
    this.ripples.push({ x: this.cx, y: this.cy, r: this.sunR, max: this.R * 1.2, life: 1, col: SUN });
    for (const g of this.glows) this.burst(this.cx, this.cy, g, 14, 260);
    this.sunPulse = 1.6;
  }

  // ---------- 绘制 ----------

  draw(f) {
    const { ctx, dt } = { ctx: this.ctx, dt: f.dt };
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, 0, this.w, this.h);

    // 衰减
    const fade = (arr, k) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, arr[i] - dt * k);
    };
    fade(this.ringFlash, 1.6);
    fade(this.meridianFlash, 2.5);
    this.sunPulse *= Math.exp(-dt * 3);
    for (const p of f.planets) p.flash = Math.max(0, p.flash - dt * 2.2);

    this.drawBackdrop(f);
    this.drawRings(f);
    this.drawMeridians(f);
    this.drawSun(f);
    this.drawPlanets(f);
    this.drawFx(f);
    this.drawOverlay(f);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawBackdrop(f) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(f.wall * 0.006);
    ctx.drawImage(this.nebula, -this.nebD / 2, -this.nebD / 2, this.nebD, this.nebD);
    ctx.restore();

    for (const s of this.stars) {
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(f.wall * s.s + s.ph));
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // 流星
    if (f.wall > this.nextMeteor) {
      this.nextMeteor = f.wall + 6 + Math.random() * 10;
      const left = Math.random() < 0.5;
      const a = left ? 0.3 + Math.random() * 0.4 : Math.PI - 0.3 - Math.random() * 0.4;
      const v = 520 + Math.random() * 380;
      this.meteors.push({
        x: left ? Math.random() * this.w * 0.5 : this.w * (0.5 + Math.random() * 0.5),
        y: Math.random() * this.h * 0.35,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1,
      });
    }
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * f.dt;
      m.y += m.vy * f.dt;
      m.life -= f.dt * 0.9;
      if (m.life <= 0) {
        this.meteors.splice(i, 1);
        continue;
      }
      const tx = m.x - m.vx * 0.14;
      const ty = m.y - m.vy * 0.14;
      const g = ctx.createLinearGradient(tx, ty, m.x, m.y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,240,220,${0.75 * m.life})`);
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }
  }

  drawRings(f) {
    const { ctx, cx, cy, R } = this;
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = `500 ${Math.round(9 * this.scale + 1)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < RING_COUNT; i++) {
      const r = R * ringNorm(i);
      const fl = this.ringFlash[i];
      const hov = f.hoverRing === i ? 1 : 0;
      ctx.strokeStyle = rgba(PALETTE[i], 0.07 + fl * 0.4 + hov * 0.2);
      ctx.lineWidth = 1 + fl * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();

      // 左侧音名刻度（轨道太密时只显示悬停的那条）
      if (hov || R * ((1 - RING_INNER) / (RING_COUNT - 1)) > 22) {
        ctx.fillStyle = rgba(PALETTE[i], 0.28 + fl * 0.6 + hov * 0.4);
        ctx.fillText(f.noteNames[i], cx - r, cy - 4);
      }

      // 吸附槽位：随轨道参考系一起旋转
      if (hov && f.snap) {
        const base = f.ringAngle(i);
        ctx.strokeStyle = rgba(PALETTE[i], 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < SLOTS; k++) {
          const a = base + (k * TAU) / SLOTS;
          const s = Math.sin(a);
          const c = Math.cos(a);
          const l = k % 4 === 0 ? 6 : 3;
          ctx.moveTo(cx + s * (r - l), cy - c * (r - l));
          ctx.lineTo(cx + s * (r + l), cy - c * (r + l));
        }
        ctx.stroke();
      }
    }
  }

  drawMeridians(f) {
    const { ctx, cx, cy, R } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < f.meridians; m++) {
      const a = (m * TAU) / f.meridians;
      const fl = this.meridianFlash[m];
      const s = Math.sin(a);
      const c = Math.cos(a);
      const x1 = cx + s * this.sunR * 1.8;
      const y1 = cy - c * this.sunR * 1.8;
      const x2 = cx + s * (R + 16);
      const y2 = cy - c * (R + 16);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, 'rgba(255,226,170,0)');
      g.addColorStop(0.2, `rgba(255,226,170,${0.22 + fl * 0.5})`);
      g.addColorStop(1, `rgba(255,226,170,${0.06 + fl * 0.3})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1 + fl * 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // 端点菱形
      const d = 3.5 + fl * 2;
      ctx.fillStyle = `rgba(255,226,170,${0.45 + fl * 0.55})`;
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(a + Math.PI / 4);
      ctx.fillRect(-d / 2, -d / 2, d, d);
      ctx.restore();
    }
  }

  drawSun(f) {
    const { ctx, cx, cy, sunR } = this;
    ctx.globalCompositeOperation = 'lighter';

    // 示波器光环：实时音频波形环绕太阳
    if (f.wave) {
      const N = 180;
      const step = Math.floor(f.wave.length / N);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        // 窗口平均 = 低通，让光环更柔和
        const j0 = (i % N) * step;
        let v = 0;
        for (let j = 0; j < step; j++) v += f.wave[j0 + j];
        v /= step;
        const a = (i / N) * TAU;
        const r = sunR * 2 + v * sunR * 3;
        const x = cx + Math.sin(a) * r;
        const y = cy - Math.cos(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,214,160,${0.18 + f.level * 0.5})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const size = sunR * (7 + f.level * 10 + this.sunPulse * 2.2);
    ctx.drawImage(this.sunGlow, cx - size / 2, cy - size / 2, size, size);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 1.1);
    core.addColorStop(0, '#fffaf0');
    core.addColorStop(0.55, 'rgba(255,224,160,0.95)');
    core.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR * 1.1, 0, TAU);
    ctx.fill();
  }

  drawPlanets(f) {
    const { ctx, cx, cy, R } = this;
    ctx.lineCap = 'round';
    for (const p of f.planets) {
      const col = PALETTE[p.ring];
      const r = R * ringNorm(p.ring);
      const a = f.angle(p);
      if (p.dragging) {
        p.sx = p.dx;
        p.sy = p.dy;
      } else {
        p.sx = cx + Math.sin(a) * r;
        p.sy = cy - Math.cos(a) * r;
      }
      const age = f.wall - (p.bornWall ?? -10);
      const grow = age < 0.6 ? Math.max(0, easeOutBack(age / 0.6)) : 1;
      const rad = this.planetRadius(p.size) * grow;
      ctx.globalCompositeOperation = 'lighter';

      // 彗尾：一段锥形渐变的圆弧，长度正比于角速度
      if (!p.dragging && grow > 0) {
        const L = Math.min(f.omega(p.ring) * 0.9, 1.6);
        const th = a - HALF_PI;
        if (this.hasConic) {
          const g = ctx.createConicGradient(th - L, cx, cy);
          g.addColorStop(0, rgba(col, 0));
          g.addColorStop(L / TAU, rgba(col, 0.55));
          g.addColorStop(Math.min(1, L / TAU + 0.001), rgba(col, 0));
          ctx.strokeStyle = g;
        } else {
          ctx.strokeStyle = rgba(col, 0.25);
        }
        ctx.lineWidth = rad * 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, th - L, th);
        ctx.stroke();
      }

      const gs = rad * (6 + p.flash * 7);
      ctx.drawImage(this.glows[p.ring], p.sx - gs / 2, p.sy - gs / 2, gs, gs);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rad, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.55 + p.flash * 0.45})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rad * 0.5, 0, TAU);
      ctx.fill();
    }
  }

  drawFx(f) {
    const { ctx } = this;
    const dt = f.dt;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.life -= dt * 1.4;
      if (rp.life <= 0) {
        this.ripples.splice(i, 1);
        continue;
      }
      const k = 1 - rp.life;
      const rr = rp.r + (rp.max - rp.r) * (1 - Math.pow(1 - k, 3));
      ctx.strokeStyle = rgba(rp.col, rp.life * 0.6);
      ctx.lineWidth = 1.5 * rp.life + 0.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rr, 0, TAU);
      ctx.stroke();
    }
    const drag = Math.exp(-dt * 2.2);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt * q.decay;
      if (q.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      q.vx *= drag;
      q.vy *= drag;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const s = q.size * 4 * q.life;
      ctx.globalAlpha = q.life;
      ctx.drawImage(q.glow, q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawOverlay(f) {
    const { ctx } = this;
    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (f.ghost) {
      const g = f.ghost;
      const [x, y] = this.pos(g.ring, g.angle);
      const rad = this.planetRadius(g.size);
      const col = PALETTE[g.ring];
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      const gs = rad * 7;
      ctx.drawImage(this.glows[g.ring], x - gs / 2, y - gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(col, 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, rad + 5, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(g.label, x, y - rad - 10);
    }
    if (f.label) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(f.label.text, f.label.x, f.label.y);
    }
  }
}
