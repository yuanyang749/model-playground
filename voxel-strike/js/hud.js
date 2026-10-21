// HUD：生命、弹药、快捷栏、波次、小地图、命中反馈、受击方向

import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { SX, SZ, SY } from './world.js';

const $ = (id) => document.getElementById(id);

// 16×16 像素图标（每个字符一个像素）
const ICONS = [
  // 步枪
  [
    '................', '................', '................', '.............o..',
    '.dddddddddddddd.', 'ddddddddddggg...', 'dddd.mmd........', 'ddd..mm.d.......',
    'dd...mm..d......', '.....mm.........', '................', '................',
  ],
  // 霰弹枪
  [
    '................', '................', '................', '................',
    '.bbbbbbbbbbbb...', '.bbbbbbbbbbbbb..', 'wwwwgggg.wwww...', 'www.g..........',
    'ww..............', '................', '................', '................',
  ],
  // 火箭筒
  [
    '................', '................', '................', 'kkk.........kkk.',
    'rvvvvvvvvvvvvvvk', 'rvvvvvvvvvvvvvvk', 'kkk...k.k...kkk.', '......k.........',
    '......k.........', '................', '................', '................',
  ],
  // 工兵镐
  [
    '..cccccccc......', '.cc......cc.....', 'c....ww....c....', '.....ww.........',
    '.....ww.........', '.....ww.........', '.....ww.........', '.....ww.........',
    '.....ww.........', '.....ww.........', '.....ww.........', '................',
  ],
];
const ICON_COLORS = {
  d: '#4a5058', g: '#ff9a3c', m: '#2b2f35', o: '#ff9a3c', b: '#2c2d32', w: '#8b5a2b',
  k: '#2d3a22', v: '#6a8c4a', r: '#d64535', c: '#5fe3d6',
};

function drawIcon(canvas, rows) {
  const g = canvas.getContext('2d');
  const s = canvas.width / 16;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const oy = ((16 - rows.length) / 2) * s;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = ICON_COLORS[ch];
      g.fillRect(x * s, oy + y * s, s, s);
    });
  });
}

const HEART = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    this.hearts = $('hearts');
    this.minimap = $('minimap');
    this.dmgCanvas = $('dmgIndicator');
    this.indicators = [];
    this.lastHp = -1;
    this.mapImage = null;
    this.mapVersion = -1;
    this.mapTimer = 0;
    this.hitT = 0;
    this.hurtT = 0;

    // 快捷栏
    const bar = $('hotbar');
    this.slots = ICONS.map((rows, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const c = document.createElement('canvas');
      c.width = c.height = 48;
      drawIcon(c, rows);
      slot.innerHTML = `<span class="key">${i + 1}</span><span class="count"></span>`;
      slot.prepend(c);
      bar.appendChild(slot);
      return slot;
    });
  }

  show(on) {
    this.el.classList.toggle('hidden', !on);
  }

  setWeapon(arsenal) {
    const s = arsenal.slot;
    const d = s.def;
    this.slots.forEach((el, i) => {
      el.classList.toggle('active', i === arsenal.cur);
      const sl = arsenal.slots[i];
      el.querySelector('.count').textContent = sl.def.melee ? this.game.player.blocks : sl.mag + sl.reserve;
    });
    $('weaponName').textContent = d.name;
    if (d.melee) {
      $('ammoMag').textContent = this.game.player.blocks;
      $('ammoRes').textContent = '方块';
      $('hint').textContent = '左键 挖掘 · 右键 放置砖块';
    } else {
      $('ammoMag').textContent = s.mag;
      $('ammoRes').textContent = '/ ' + s.reserve;
      $('hint').textContent = '';
    }
    $('ammoMag').classList.toggle('low', !d.melee && s.mag <= Math.ceil(d.mag * 0.25));
  }

  setWave(text, sub) {
    $('wave').textContent = text;
    $('waveSub').textContent = sub;
  }

  setScore(score, kills) {
    $('scoreVal').textContent = score.toLocaleString();
    $('killsVal').textContent = `击杀 ${kills}`;
  }

  banner(title, sub = '', boss = false) {
    const el = $('banner');
    el.innerHTML = `<div class="t">${title}</div><div class="s">${sub}</div>`;
    el.classList.toggle('boss', boss);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  popup(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.textContent = text;
    $('feed').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  hitmarker(head, kill) {
    const el = $('hitmarker');
    el.className = kill ? 'kill' : head ? 'head' : '';
    el.style.opacity = 1;
    this.hitT = kill ? 0.35 : 0.18;
  }

  hurt(amount, from, player) {
    this.hurtT = Math.min(1, this.hurtT + amount / 30);
    if (from) this.indicators.push({ x: from.x, z: from.z, t: 1.5 });
  }

  drawHearts(hp, max) {
    const c = this.hearts;
    const g = c.getContext('2d');
    const s = 2;
    g.clearRect(0, 0, c.width, c.height);
    const per = max / 10;
    for (let i = 0; i < 10; i++) {
      const fill = Math.max(0, Math.min(1, (hp - i * per) / per));
      const ox = i * 18;
      HEART.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          if (ch !== 'x') return;
          g.fillStyle = '#1a0a0a';
          g.fillRect(ox + x * s + 1, y * s + 1, s + 1, s + 1);
        });
      });
      HEART.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          if (ch !== 'x') return;
          const on = fill >= 1 || (fill > 0.25 && x < 4) || (fill > 0.75);
          g.fillStyle = on ? (y === 1 && x === 1 ? '#ff9a9a' : '#e3262c') : '#3b2626';
          g.fillRect(ox + x * s, y * s, s, s);
        });
      });
    }
  }

  buildMap() {
    const world = this.game.world;
    const img = new ImageData(SX, SZ);
    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        let y = SY - 1;
        let id = 0;
        for (; y >= 0; y--) {
          id = world.get(x, y, z);
          if (id) break;
        }
        const c = BLOCKS[id]?.color || new THREE.Color(0, 0, 0);
        const shade = 0.55 + (y / SY) * 0.9;
        const i = (z * SX + x) * 4;
        img.data[i] = Math.min(255, c.r * 255 * shade);
        img.data[i + 1] = Math.min(255, c.g * 255 * shade);
        img.data[i + 2] = Math.min(255, c.b * 255 * shade);
        img.data[i + 3] = 255;
      }
    }
    if (!this.mapCanvas) {
      this.mapCanvas = document.createElement('canvas');
      this.mapCanvas.width = SX;
      this.mapCanvas.height = SZ;
    }
    this.mapCanvas.getContext('2d').putImageData(img, 0, 0);
    this.mapVersion = world.version;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (Math.round(p.hp) !== this.lastHp) {
      this.lastHp = Math.round(p.hp);
      this.drawHearts(p.hp, p.maxHp);
      $('hpVal').textContent = this.lastHp;
    }

    // 命中标记
    this.hitT -= dt;
    if (this.hitT <= 0) $('hitmarker').style.opacity = 0;

    // 准星扩散
    const a = g.arsenal;
    const moving = Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 6);
    const spread = a.def.melee ? 4 : 6 + (a.def.spread * 300 + moving * 10 + a.bloom * 400) * (1 - a.ads * 0.8);
    const ch = $('crosshair');
    ch.style.setProperty('--gap', spread.toFixed(1) + 'px');
    ch.style.opacity = a.ads > 0.6 && a.def.id === 'rifle' ? 0.35 : 1;
    $('scope').style.opacity = a.def.id === 'rifle' ? Math.max(0, a.ads * 2 - 1) : 0;

    // 受伤暗角
    this.hurtT = Math.max(0, this.hurtT - dt * 1.2);
    const low = p.hp < 35 ? (1 - p.hp / 35) * (0.55 + Math.sin(performance.now() * 0.006) * 0.15) : 0;
    $('vignette').style.opacity = Math.min(1, this.hurtT + low);
    $('water').style.opacity = p.underwater ? 1 : 0;

    // Boss 血条
    const boss = g.enemies.boss;
    $('bossbar').classList.toggle('hidden', !boss);
    if (boss) $('bossFill').style.width = (Math.max(0, boss.hp / boss.maxHp) * 100).toFixed(1) + '%';

    this.drawMinimap(dt);
    this.drawIndicators(dt);
  }

  drawMinimap(dt) {
    const g = this.game;
    const p = g.player;
    this.mapTimer -= dt;
    if (!this.mapCanvas || (this.mapVersion !== g.world.version && this.mapTimer <= 0)) {
      this.buildMap();
      this.mapTimer = 1;
    }
    const c = this.minimap;
    const ctx = c.getContext('2d');
    const W = c.width;
    const S = 3; // 每格像素
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1d4f8f';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.rotate(p.yaw);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapCanvas, -p.pos.x * S, -p.pos.z * S, SX * S, SZ * S);
    for (const pk of g.pickups) {
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect((pk.pos.x - p.pos.x) * S - 2, (pk.pos.z - p.pos.z) * S - 2, 4, 4);
    }
    for (const e of g.enemies.list) {
      ctx.fillStyle = e.def.boss ? '#ff3df2' : e.type === 'creeper' ? '#ff8a2a' : '#ff3b3b';
      const r = e.def.boss ? 5 : 3;
      ctx.fillRect((e.pos.x - p.pos.x) * S - r, (e.pos.z - p.pos.z) * S - r, r * 2, r * 2);
    }
    ctx.restore();
    // 玩家箭头（始终朝上）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(W / 2, W / 2 - 7);
    ctx.lineTo(W / 2 + 5, W / 2 + 5);
    ctx.lineTo(W / 2, W / 2 + 2);
    ctx.lineTo(W / 2 - 5, W / 2 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawIndicators(dt) {
    const p = this.game.player;
    const c = this.dmgCanvas;
    const ctx = c.getContext('2d');
    const W = c.width;
    ctx.clearRect(0, 0, W, W);
    this.indicators = this.indicators.filter((d) => (d.t -= dt) > 0);
    for (const d of this.indicators) {
      const rx = d.x - p.pos.x;
      const rz = d.z - p.pos.z;
      // 与小地图同一旋转：视线方向朝上
      const cs = Math.cos(p.yaw);
      const sn = Math.sin(p.yaw);
      const x = rx * cs - rz * sn;
      const y = rx * sn + rz * cs;
      const ang = Math.atan2(y, x);
      ctx.strokeStyle = `rgba(255,40,40,${Math.min(1, d.t) * 0.85})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(W / 2, W / 2, W / 2 - 12, ang - 0.32, ang + 0.32);
      ctx.stroke();
    }
  }
}
