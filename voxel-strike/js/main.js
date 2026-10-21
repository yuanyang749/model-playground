// VOXEL STRIKE 主程序：渲染器、游戏状态机、波次、掉落物、爆炸、菜单与设置

import * as THREE from 'three';
import { createAtlas } from './blocks.js';
import { World, SX, SZ, SEA } from './world.js';
import { Sky } from './sky.js';
import { Player } from './player.js';
import { Arsenal } from './weapons.js';
import { Enemies, TYPES } from './enemies.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Hud } from './hud.js';
import { input, initInput, endFrame } from './input.js';

const $ = (id) => document.getElementById(id);
const TEST = new URLSearchParams(location.search).has('test');

// ---------- 设置 ----------

const DEFAULTS = { sens: 1, fov: 78, shadows: 'high', scale: 1, volume: 0.8 };
const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('voxelstrike.settings') || '{}') };
const saveSettings = () => localStorage.setItem('voxelstrike.settings', JSON.stringify(settings));

// ---------- 渲染器与场景 ----------

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: TEST });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 600);
camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
const vmHemi = new THREE.HemisphereLight(0xffffff, 0x555566, 1.6);
const vmSun = new THREE.DirectionalLight(0xffffff, 1.6);
vmSun.position.set(1, 2, 1.5);
vmScene.add(vmHemi, vmSun);

const atlas = createAtlas();
atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();
const worldMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });

const game = {
  settings, scene, camera, vmScene, renderer,
  state: 'menu', shake: 0, score: 0, kills: 0, headshots: 0, pickups: [], time: 0,
};
game.world = new World(scene, worldMat);
game.sky = new Sky(scene);
game.sfx = new Sfx();
game.hud = new Hud(game);
game.fx = new Effects(scene, game.world);
game.player = new Player(game);
game.enemies = new Enemies(game);
game.arsenal = new Arsenal(game);
window.game = game; // 调试用

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * settings.scale);
  renderer.setSize(w, h, false);
  camera.aspect = vmCamera.aspect = w / h;
  camera.updateProjectionMatrix();
  vmCamera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
initInput(canvas);
input.freeLook = TEST;

// ---------- 世界 ----------

function newWorld(seed) {
  game.world.generate(seed);
  game.world.buildAll();
  game.fx.clear();
}
newWorld(Math.floor(Math.random() * 1e9));

// ---------- 波次 ----------

const waves = { n: 0, queue: [], spawnT: 0, intermission: 0, active: false };

function composeWave(n) {
  const list = [];
  const count = 5 + Math.floor(n * 2.2);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let type = 'zombie';
    if (n >= 2 && r < 0.2) type = 'creeper';
    else if (n >= 3 && r < 0.45) type = 'skeleton';
    list.push(type);
  }
  if (n % 5 === 0) list.splice(1, 0, 'golem');
  return list;
}

function startWave() {
  waves.n++;
  waves.queue = composeWave(waves.n);
  waves.active = true;
  waves.spawnT = 0.5;
  const boss = waves.n % 5 === 0;
  game.hud.banner(`第 ${waves.n} 波`, boss ? '⚠ 方块巨像来袭' : `${waves.queue.length} 个敌人正在逼近`, boss);
  game.sfx.play(boss ? 'roar' : 'wave');
}

function waveCleared() {
  waves.active = false;
  waves.intermission = 12;
  const bonus = 250 * waves.n;
  game.score += bonus;
  game.arsenal.addAmmo(0.5);
  game.player.heal(25);
  game.player.blocks += 8;
  game.hud.setWeapon(game.arsenal);
  game.hud.banner('波次清除', `+${bonus} 分 · 弹药补给 · 生命恢复`);
  game.sfx.play('clear');
}

function findSpawn(type) {
  const p = game.player.pos;
  const w = game.world;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 22 + Math.random() * 16;
    const x = Math.floor(SX / 2 + Math.cos(a) * r * (0.6 + Math.random() * 0.5));
    const z = Math.floor(SZ / 2 + Math.sin(a) * r * (0.6 + Math.random() * 0.5));
    if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) continue;
    const y = w.groundY(x, z);
    if (y < SEA) continue;
    if (w.solidAt(x, y + 1, z) || w.solidAt(x, y + 2, z)) continue;
    if (Math.hypot(x - p.x, z - p.z) < (type === 'golem' ? 20 : 16)) continue;
    const pos = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    if (type === 'golem') {
      // 巨像需要上方净空：直接清理出空间
      for (let dy = 1; dy <= 5; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.set(x + dx, y + dy, z + dz, 0);
    }
    return pos;
  }
  return null;
}

function updateWaves(dt) {
  if (!waves.active) {
    waves.intermission -= dt;
    game.hud.setWave(waves.n === 0 ? '准备' : `第 ${waves.n} 波 已清除`, `下一波 ${Math.max(0, Math.ceil(waves.intermission))} 秒`);
    if (waves.intermission <= 0) startWave();
    return;
  }
  waves.spawnT -= dt;
  const cap = 10 + waves.n;
  if (waves.queue.length && waves.spawnT <= 0 && game.enemies.alive < cap) {
    const type = waves.queue[0];
    const pos = findSpawn(type);
    if (pos) {
      waves.queue.shift();
      const mult = type === 'golem' ? 1 + (waves.n / 5 - 1) * 0.6 : 1 + (waves.n - 1) * 0.1;
      game.enemies.spawn(type, pos, mult);
      game.fx.smoke(pos.x, pos.y + 0.5, pos.z, 8, 0.8, 0.4);
    }
    waves.spawnT = Math.max(0.35, 1.6 - waves.n * 0.08) * (0.6 + Math.random() * 0.8);
  }
  const remaining = waves.queue.length + game.enemies.alive;
  game.hud.setWave(`第 ${waves.n} 波`, `剩余敌人 ${remaining}`);
  if (remaining === 0) waveCleared();
}

// ---------- 掉落物 ----------

const PICKUP = {
  health: { color: 0xe3262c, label: '+25 生命' },
  ammo: { color: 0xffc23d, label: '弹药补给' },
  blocks: { color: 0xa0463a, label: '+6 方块' },
};
const pickupGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);

function dropPickup(pos) {
  const r = Math.random();
  const kind = r < 0.4 ? 'ammo' : r < 0.7 ? 'health' : 'blocks';
  const mesh = new THREE.Mesh(pickupGeo, new THREE.MeshLambertMaterial({ color: PICKUP[kind].color, emissive: PICKUP[kind].color, emissiveIntensity: 0.35 }));
  mesh.castShadow = true;
  scene.add(mesh);
  game.pickups.push({ kind, pos: pos.clone().setY(pos.y + 0.5), vy: 4, mesh, t: 0 });
}

function updatePickups(dt) {
  const p = game.player;
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.t += dt;
    // 下落到地面
    pk.vy -= 20 * dt;
    pk.pos.y += pk.vy * dt;
    const ground = game.world.groundY(Math.floor(pk.pos.x), Math.floor(pk.pos.z)) + 1.3;
    if (pk.pos.y < ground) {
      pk.pos.y = ground;
      pk.vy = 0;
    }
    const d = pk.pos.distanceTo(tmpV.set(p.pos.x, p.pos.y + 0.9, p.pos.z));
    if (d < 3.5) pk.pos.lerp(tmpV, Math.min(1, dt * 8));
    if (d < 1.1) {
      if (pk.kind === 'health') p.heal(25);
      if (pk.kind === 'ammo') game.arsenal.addAmmo(0.25);
      if (pk.kind === 'blocks') p.blocks += 6;
      game.hud.setWeapon(game.arsenal);
      game.hud.popup(PICKUP[pk.kind].label, 'pick');
      game.sfx.play('pickup');
    }
    if (d < 1.1 || pk.t > 30) {
      scene.remove(pk.mesh);
      pk.mesh.material.dispose();
      game.pickups.splice(i, 1);
      continue;
    }
    pk.mesh.position.copy(pk.pos).setY(pk.pos.y + Math.sin(pk.t * 3) * 0.12);
    pk.mesh.rotation.y += dt * 2;
    pk.mesh.visible = pk.t < 25 || Math.sin(pk.t * 20) > 0;
  }
}

// ---------- 战斗回调 ----------

const tmpV = new THREE.Vector3();

game.explode = (at, r, dmg, source) => {
  const pos = at.clone();
  const removed = game.world.explode(pos.x, pos.y, pos.z, r);
  for (let i = 0; i < removed.length; i += Math.max(1, Math.floor(removed.length / 40))) {
    const b = removed[i];
    game.fx.blockBreak(b.x, b.y, b.z, b.id, 3);
  }
  game.fx.explosion(pos, r);
  game.sfx.play('explosion', pos, 1.2);
  for (const e of [...game.enemies.list]) {
    const d = tmpV.set(e.pos.x, e.pos.y + e.h * 0.5, e.pos.z).distanceTo(pos);
    if (d < r * 1.7) {
      const k = 1 - d / (r * 1.7);
      const dir = tmpV.sub(pos).normalize();
      if (!e.def.boss) {
        e.vel.addScaledVector(dir, 12 * k);
        e.vel.y += 6 * k;
      }
      const killed = e.hurt(dmg * k * (source === 'enemy' ? 0.5 : 1), null, false);
      if (source === 'player') game.hud.hitmarker(false, killed);
    }
  }
  const p = game.player;
  const pd = tmpV.set(p.pos.x, p.pos.y + 0.9, p.pos.z).distanceTo(pos);
  if (pd < r * 1.7) {
    const k = 1 - pd / (r * 1.7);
    p.damage(dmg * k * (source === 'player' ? 0.3 : 1), pos);
    p.knock(tmpV.sub(pos).normalize(), 10 * k);
  }
  game.shake = Math.min(1, game.shake + Math.max(0, 1 - pd / 30) * 0.8);
};

game.onKill = (e, byPlayer, head) => {
  if (!byPlayer) return;
  const pts = e.def.score + (head ? 50 : 0);
  game.score += pts;
  game.kills++;
  if (head) game.headshots++;
  game.hud.popup(`+${pts}${head ? ' 爆头' : ''}`, head ? 'head' : '');
  if (e.def.boss) {
    game.hud.banner('巨像倒下了！', `+${pts} 分`, true);
    for (let i = 0; i < 6; i++) dropPickup(e.pos.clone().add(new THREE.Vector3(Math.random() * 2 - 1, 1, Math.random() * 2 - 1)));
  } else if (Math.random() < 0.3) dropPickup(e.pos);
};

// ---------- 状态机 ----------

function lockPointer() {
  if (TEST) return;
  const r = canvas.requestPointerLock?.();
  r?.catch?.(() => {});
}

function startGame() {
  game.sfx.init();
  game.sfx.setVolume(settings.volume);
  newWorld(Math.floor(Math.random() * 1e9));
  game.enemies.clear();
  for (const pk of game.pickups) scene.remove(pk.mesh);
  game.pickups.length = 0;
  game.player.reset(game.world.spawn);
  game.arsenal.reset();
  game.score = game.kills = game.headshots = 0;
  game.time = 0;
  game.sky.time = 0.06;
  waves.n = 0;
  waves.active = false;
  waves.intermission = 8;
  game.hud.lastHp = -1;
  game.hud.mapVersion = -1;
  game.hud.setWeapon(game.arsenal);
  game.hud.setScore(0, 0);
  game.hud.banner('守住前哨站', '敌人将从四面八方涌来');
  setState('playing');
  lockPointer();
}

function setState(s) {
  game.state = s;
  $('menu').classList.toggle('hidden', s !== 'menu');
  $('pause').classList.toggle('hidden', s !== 'paused');
  $('over').classList.toggle('hidden', s !== 'over');
  game.hud.show(s === 'playing' || s === 'paused');
  game.arsenal.root.visible = s === 'playing' || s === 'paused';
  if (s !== 'playing' && document.pointerLockElement) document.exitPointerLock();
}

function pause() {
  if (game.state !== 'playing') return;
  setState('paused');
}

function resume() {
  game.sfx.init();
  setState('playing');
  lockPointer();
}

function gameOver() {
  const best = Math.max(game.score, +(localStorage.getItem('voxelstrike.best') || 0));
  const isBest = game.score >= best && game.score > 0;
  localStorage.setItem('voxelstrike.best', best);
  $('overStats').innerHTML = `
    <div><b>${waves.n}</b><span>坚持波次</span></div>
    <div><b>${game.kills}</b><span>击杀</span></div>
    <div><b>${game.headshots}</b><span>爆头</span></div>
    <div><b>${game.score.toLocaleString()}</b><span>得分</span></div>`;
  $('overBest').textContent = isBest ? '★ 新纪录！' : `最高纪录 ${best.toLocaleString()}`;
  updateBest();
  setState('over');
}

function updateBest() {
  const best = +(localStorage.getItem('voxelstrike.best') || 0);
  $('menuBest').textContent = best ? `最高纪录 ${best.toLocaleString()}` : '';
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.state === 'playing') pause();
});

// ---------- 设置面板 ----------

function mountSettings(root) {
  root.innerHTML = `
    <label>鼠标灵敏度 <input type="range" data-k="sens" min="0.2" max="3" step="0.05"><output></output></label>
    <label>视野 FOV <input type="range" data-k="fov" min="60" max="105" step="1"><output></output></label>
    <label>渲染分辨率 <input type="range" data-k="scale" min="0.5" max="1" step="0.05"><output></output></label>
    <label>音量 <input type="range" data-k="volume" min="0" max="1" step="0.05"><output></output></label>
    <label>阴影 <select data-k="shadows"><option value="high">高</option><option value="low">低</option><option value="off">关</option></select></label>`;
  const fmt = { sens: (v) => (+v).toFixed(2), fov: (v) => v + '°', scale: (v) => Math.round(v * 100) + '%', volume: (v) => Math.round(v * 100) + '%' };
  for (const el of root.querySelectorAll('[data-k]')) {
    const k = el.dataset.k;
    el.value = settings[k];
    const out = el.nextElementSibling;
    if (out) out.textContent = fmt[k](el.value);
    el.addEventListener('input', () => {
      settings[k] = el.type === 'range' ? +el.value : el.value;
      if (out) out.textContent = fmt[k](el.value);
      applySettings();
      saveSettings();
      document.querySelectorAll(`[data-k="${k}"]`).forEach((o) => o !== el && (o.value = el.value));
    });
  }
}

function applySettings() {
  resize();
  game.sky.setShadows(settings.shadows);
  game.sfx.setVolume(settings.volume);
}

document.querySelectorAll('.settings').forEach(mountSettings);
applySettings();
updateBest();

$('playBtn').onclick = startGame;
$('resumeBtn').onclick = resume;
$('quitBtn').onclick = () => {
  game.enemies.clear();
  setState('menu');
};
$('againBtn').onclick = startGame;
$('menuBtn').onclick = () => {
  game.enemies.clear();
  setState('menu');
};
canvas.addEventListener('click', () => {
  if (game.state === 'playing' && !document.pointerLockElement) lockPointer();
});

addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && game.state !== 'menu') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  if (e.code === 'KeyP' && game.state === 'playing') pause();
  else if (e.code === 'KeyP' && game.state === 'paused') resume();
  if (e.code === 'Enter' && game.state === 'menu') startGame();
});

// ---------- 主循环 ----------

const right = new THREE.Vector3();

function update(dt) {
  if (game.state === 'playing') {
    game.time += dt;
    game.player.update(dt);
    game.arsenal.update(dt);
    game.enemies.update(dt);
    updatePickups(dt);
    updateWaves(dt);
    game.hud.setScore(game.score, game.kills);
    game.hud.update(dt);
    if (game.player.dead) gameOver();
  } else if (game.state === 'menu') {
    // 主菜单：环绕岛屿的电影镜头
    const t = performance.now() * 0.00005;
    camera.position.set(SX / 2 + Math.cos(t) * 62, 40, SZ / 2 + Math.sin(t) * 62);
    camera.lookAt(SX / 2, 14, SZ / 2);
    if (camera.fov !== 60) {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }
  }
  if (game.state !== 'paused') {
    game.sky.update(dt, camera.position, game.state === 'playing' && game.player.underwater);
    game.fx.update(dt);
    game.world.update();
    game.shake = Math.max(0, game.shake - dt * 1.8);
  }
  right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  game.sfx.setListener(camera.position, right);
  const day = game.sky.dayK;
  vmHemi.intensity = 0.5 + 1.2 * day;
  vmSun.intensity = 0.3 + 1.4 * day;
  endFrame();
}

function render() {
  renderer.clear();
  renderer.render(scene, camera);
  if (game.state === 'playing' || game.state === 'paused') {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }
}

let last = performance.now();
let manual = false;
function loop(now) {
  requestAnimationFrame(loop);
  if (manual) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
}
requestAnimationFrame(loop);

// ---------- 测试钩子 ----------

window.advanceTime = (ms) => {
  manual = true;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) update(1 / 60);
  render();
};

window.render_game_to_text = () => {
  const p = game.player;
  const r = (v) => Math.round(v * 10) / 10;
  return JSON.stringify({
    note: '坐标：x/z 为水平面（0–96），y 向上；yaw=0 时朝 -z',
    mode: game.state,
    wave: { n: waves.n, active: waves.active, queue: waves.queue.length, intermission: r(waves.intermission) },
    player: {
      pos: [r(p.pos.x), r(p.pos.y), r(p.pos.z)], yaw: r(p.yaw), pitch: r(p.pitch), hp: Math.round(p.hp),
      onGround: p.onGround, inWater: p.inWater, blocks: p.blocks,
      weapon: game.arsenal.def.id, mag: game.arsenal.slot.mag, reserve: game.arsenal.slot.reserve,
      reloading: game.arsenal.reloading > 0,
    },
    enemies: game.enemies.list.slice(0, 12).map((e) => ({
      type: e.type, pos: [r(e.pos.x), r(e.pos.y), r(e.pos.z)], hp: Math.round(e.hp),
      dist: r(e.pos.distanceTo(p.pos)),
    })),
    pickups: game.pickups.length,
    score: game.score,
    kills: game.kills,
  });
};
