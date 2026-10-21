// Orbitone 主程序：时钟、调度、交互与界面

import {
  TAU, wrap, clamp, RING_COUNT, SLOTS, SCALES, KEYS, TIMBRES,
  ringMidi, midiToFreq, midiName,
} from './music.js';
import { Orrery } from './orrery.js';
import { AudioEngine } from './audio.js';
import { Sky } from './sky.js';
import { encodeScene, decodeScene } from './share.js';

const LOOKAHEAD = 0.15; // 音频预排程窗口（秒）
const MAX_PLANETS = 60;
const SLOT = TAU / SLOTS;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#sky');

const orrery = new Orrery();
const audio = new AudioEngine();
const sky = new Sky(canvas);

const settings = { scale: 0, key: 1, timbre: 0, reverb: 0.45, drone: true, snap: true };
// sim 为“音乐时间”：播放时与 AudioContext 时钟锁定，暂停时冻结
const clock = { sim: 0, simAnchor: 0, ctxAnchor: 0, playing: false, scheduled: 0 };
const events = []; // 等待视觉触发的音符
const pointer = { x: -1, y: -1, inside: false };
let hold = null; // 正在按住放置的行星
let drag = null; // 正在拖动的行星
let level = 0;

// ---------- 时钟 ----------

const simNow = () =>
  clock.playing ? clock.simAnchor + (audio.ctx.currentTime - clock.ctxAnchor) : clock.sim;
const simToCtx = (t) => clock.ctxAnchor + (t - clock.simAnchor);

function play() {
  if (!audio.ready) return;
  audio.ctx.resume();
  clock.simAnchor = clock.sim;
  clock.ctxAnchor = audio.ctx.currentTime;
  clock.scheduled = clock.sim;
  clock.playing = true;
  audio.setDrone(settings.drone);
  $('#playBtn').classList.add('playing');
}

function pause() {
  clock.sim = simNow();
  clock.playing = false;
  events.length = 0;
  audio.setDrone(false);
  $('#playBtn').classList.remove('playing');
}

const togglePlay = () => (clock.playing ? pause() : play());

// ---------- 音乐 ----------

const ringFreq = (ring) => midiToFreq(ringMidi(ring, SCALES[settings.scale], KEYS[settings.key].midi));
const ringName = (ring) => midiName(ringMidi(ring, SCALES[settings.scale], KEYS[settings.key].midi));

function sound(p, time, pan) {
  if (!audio.ready) return;
  audio.note({ time, freq: ringFreq(p.ring), size: p.size, pan, sub: p.ring >= RING_COUNT - 2 });
}

function schedule() {
  const now = clock.sim;
  if (now - clock.scheduled > 0.25) clock.scheduled = now; // 标签页休眠后不补奏
  const until = now + LOOKAHEAD;
  orrery.crossings(clock.scheduled, until, (p, t, m) => {
    const pan = Math.sin((m * TAU) / orrery.meridians) * 0.65 + (p.ring % 2 ? 0.12 : -0.12);
    sound(p, simToCtx(t), pan);
    events.push({ t, p, m });
  });
  clock.scheduled = until;
}

function flushEvents(now) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.t > now) continue;
    if (!e.p.dead) sky.trigger(e.p, e.m);
    events.splice(i, 1);
  }
}

// ---------- 星系操作 ----------

function addPlanet(ring, phi, size, preview = true) {
  const p = orrery.add(ring, phi, size);
  p.bornWall = performance.now() / 1000;
  if (preview) {
    [p.sx, p.sy] = sky.pos(ring, orrery.angle(p, clock.sim));
    sound(p, 0, (p.sx / sky.w) * 1.4 - 0.7);
    sky.trigger(p, 0);
  }
  updateHud();
  return p;
}

function removePlanet(p) {
  sky.shatter(p);
  orrery.remove(p);
  updateHud();
}

function clearAll() {
  for (const p of orrery.planets) sky.shatter(p);
  orrery.clear();
  orrery.resetPhases(clock.sim);
  updateHud();
}

// 默认星系：九条轨道各一颗，构成一首缓慢的复合节奏
const PRESET = [
  [8, 0, 3], [8, 8, 2.4], [7, 4, 2.2], [6, 0, 1.6], [5, 2, 1.4],
  [4, 10, 1.2], [3, 6, 1.3], [2, 12, 1], [1, 3, 1], [0, 14, 0.9],
];

function loadSlots(list) {
  orrery.clear();
  orrery.resetPhases(clock.sim);
  for (const [ring, slot, size] of list) addPlanet(ring, slot * SLOT, size, false);
  for (const p of orrery.planets) p.bornWall = performance.now() / 1000 + Math.random() * 0.5;
  updateHud();
}

function randomGalaxy() {
  for (const p of orrery.planets) sky.shatter(p);
  const list = [];
  const used = new Set();
  const n = 7 + Math.floor(Math.random() * 8);
  const step = Math.random() < 0.5 ? 2 : 4; // 槽位粒度，越粗节奏越规整
  while (list.length < n) {
    const ring = Math.floor(Math.pow(Math.random(), 0.8) * RING_COUNT);
    const slot = Math.floor((Math.random() * SLOTS) / step) * step;
    const key = ring * SLOTS + slot;
    if (used.has(key)) continue;
    used.add(key);
    list.push([ring, slot, 0.8 + Math.random() * (ring > 5 ? 2 : 1.2)]);
    // 偶尔叠一个三度/五度“和弦”
    if (Math.random() < 0.25 && ring + 2 < RING_COUNT && !used.has(key + 2 * SLOTS)) {
      used.add(key + 2 * SLOTS);
      list.push([ring + 2, slot, 1 + Math.random()]);
    }
  }
  loadSlots(list);
  sky.bigBang();
}

// ---------- 设置 ----------

function setBpm(v) {
  orrery.retime(simNow(), () => (orrery.bpm = v));
  if (clock.playing) clock.sim = simNow();
  audio.setTempo(v);
  $('#bpm').value = v;
  $('#bpmVal').textContent = v;
  paintRange($('#bpm'));
}

function setMode(v) {
  orrery.retime(simNow(), () => (orrery.mode = v));
  segSelect('mode', v);
}

function setMeridians(v) {
  orrery.meridians = v;
  segSelect('mer', String(v));
}

function setReverb(v) {
  settings.reverb = v;
  audio.setReverb(v);
  $('#reverb').value = Math.round(v * 100);
  paintRange($('#reverb'));
}

function setKey() {
  audio.setDroneRoot(midiToFreq(KEYS[settings.key].midi - 12));
}

function applyScene(s) {
  setBpm(s.bpm);
  setMode(s.mode);
  setMeridians(s.meridians);
  settings.scale = s.scale;
  settings.key = s.key;
  settings.timbre = s.timbre;
  $('#scale').value = s.scale;
  $('#key').value = s.key;
  $('#timbre').value = s.timbre;
  setReverb(s.reverb);
  orrery.clear();
  orrery.resetPhases(clock.sim);
  for (const p of s.planets) addPlanet(p.ring, p.angle, p.size, false);
}

function shareLink() {
  const hash = encodeScene({
    bpm: orrery.bpm,
    mode: orrery.mode,
    meridians: orrery.meridians,
    scale: settings.scale,
    key: settings.key,
    timbre: settings.timbre,
    reverb: settings.reverb,
    planets: orrery.planets.map((p) => ({ ring: p.ring, angle: wrap(orrery.angle(p, simNow())), size: p.size })),
  });
  history.replaceState(null, '', hash);
  navigator.clipboard?.writeText(location.href).then(
    () => toast('星系链接已复制，发给朋友听听'),
    () => toast('链接已写入地址栏'),
  ) ?? toast('链接已写入地址栏');
}

async function toggleRecord() {
  if (!audio.ready) return;
  const btn = $('#recBtn');
  if (!audio.recording) {
    if (!window.MediaRecorder) return toast('当前浏览器不支持录音');
    audio.startRecording();
    btn.classList.add('on');
    if (!clock.playing) play();
    toast('录音中…再次点击结束并下载');
    return;
  }
  btn.classList.remove('on');
  const blob = await audio.stopRecording();
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `orbitone-${stamp}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('录音已保存');
}

// ---------- 界面 ----------

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function paintRange(el) {
  const p = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty('--p', p + '%');
}

function segSelect(group, value) {
  for (const b of $$(`.seg[data-group="${group}"] button`)) b.classList.toggle('on', b.dataset.value === value);
}

function updateHud() {
  $('#count').textContent = `${orrery.planets.length} 颗行星`;
}

function fillSelect(el, items) {
  el.innerHTML = items.map((it, i) => `<option value="${i}">${it.name}</option>`).join('');
}

function bindUi() {
  fillSelect($('#scale'), SCALES);
  fillSelect($('#key'), KEYS.map((k) => ({ name: `${k.name} 调` })));
  fillSelect($('#timbre'), TIMBRES);
  $('#scale').value = settings.scale;
  $('#key').value = settings.key;
  $('#timbre').value = settings.timbre;

  $('#playBtn').onclick = togglePlay;
  $('#bpm').oninput = (e) => setBpm(+e.target.value);
  $('#reverb').oninput = (e) => setReverb(e.target.value / 100);
  $('#scale').onchange = (e) => (settings.scale = +e.target.value);
  $('#key').onchange = (e) => {
    settings.key = +e.target.value;
    setKey();
  };
  $('#timbre').onchange = (e) => {
    settings.timbre = +e.target.value;
    audio.timbre = TIMBRES[settings.timbre].id;
  };
  for (const b of $$('.seg[data-group="mode"] button')) b.onclick = () => setMode(b.dataset.value);
  for (const b of $$('.seg[data-group="mer"] button')) b.onclick = () => setMeridians(+b.dataset.value);

  $('#droneBtn').onclick = (e) => {
    settings.drone = !settings.drone;
    e.currentTarget.classList.toggle('on', settings.drone);
    audio.setDrone(settings.drone && clock.playing);
  };
  $('#snapBtn').onclick = (e) => {
    settings.snap = !settings.snap;
    e.currentTarget.classList.toggle('on', settings.snap);
    toast(settings.snap ? '吸附已开启：行星落入 16 个随轨道旋转的槽位' : '吸附已关闭：自由放置');
  };
  $('#randomBtn').onclick = randomGalaxy;
  $('#clearBtn').onclick = clearAll;
  $('#shareBtn').onclick = shareLink;
  $('#recBtn').onclick = toggleRecord;
  $('#helpBtn').onclick = () => $('#help').classList.toggle('hidden');

  // 鼠标点击后移除按钮焦点，避免空格键再次触发按钮
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && e.detail > 0) b.blur();
  });

  $('#enterBtn').onclick = () => {
    audio.init();
    audio.timbre = TIMBRES[settings.timbre].id;
    audio.setReverb(settings.reverb);
    audio.setTempo(orrery.bpm);
    setKey();
    $('#intro').classList.add('gone');
    sky.bigBang();
    play();
    setTimeout(() => toast('点击轨道放置行星 · 按住越久质量越大'), 1200);
  };

  window.addEventListener('resize', () => sky.resize());
  window.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (!audio.ready || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    togglePlay();
  } else if (k === 'r') randomGalaxy();
  else if (k === 'c') clearAll();
  else if (k === 's') shareLink();
  else if (k === 'm') setMode(orrery.mode === 'harmonic' ? 'kepler' : 'harmonic');
  else if (k === 'h' || k === '?') $('#help').classList.toggle('hidden');
  else if (k === 'arrowup') setBpm(clamp(orrery.bpm + 2, 40, 160));
  else if (k === 'arrowdown') setBpm(clamp(orrery.bpm - 2, 40, 160));
  else if (k >= '1' && k <= '4') setMeridians(+k);
  else return;
}

// ---------- 指针交互 ----------

function bindPointer() {
  canvas.addEventListener('pointerdown', (e) => {
    if (!audio.ready || e.button > 0) return;
    const { clientX: x, clientY: y } = e;
    canvas.setPointerCapture(e.pointerId);
    const hit = sky.pick(x, y, orrery.planets);
    if (hit) {
      drag = { p: hit, x0: x, y0: y, moved: false };
      return;
    }
    const near = sky.nearestRing(x, y);
    if (!near) return;
    if (orrery.planets.length >= MAX_PLANETS) return toast(`星系已满（最多 ${MAX_PLANETS} 颗）`);
    hold = { ring: near.ring, phi: orrery.offsetFor(near.ring, near.angle, clock.sim, settings.snap), start: performance.now() };
  });

  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    if (drag) {
      if (!drag.moved && Math.hypot(pointer.x - drag.x0, pointer.y - drag.y0) > 6) {
        drag.moved = true;
        drag.p.dragging = true;
      }
      drag.p.dx = pointer.x;
      drag.p.dy = pointer.y;
    } else if (hold) {
      const near = sky.nearestRing(pointer.x, pointer.y);
      if (near) {
        hold.ring = near.ring;
        hold.phi = orrery.offsetFor(near.ring, near.angle, clock.sim, settings.snap);
      }
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (drag) {
      const p = drag.p;
      if (!drag.moved) removePlanet(p);
      else {
        p.dragging = false;
        const near = sky.nearestRing(e.clientX, e.clientY, true);
        if (near) {
          p.ring = near.ring;
          p.phi = orrery.offsetFor(near.ring, near.angle, clock.sim, settings.snap);
          sound(p, 0, (e.clientX / sky.w) * 1.4 - 0.7);
          [p.sx, p.sy] = sky.pos(p.ring, orrery.angle(p, clock.sim));
          sky.trigger(p, 0);
        } else removePlanet(p);
      }
      drag = null;
    } else if (hold) {
      addPlanet(hold.ring, hold.phi, holdSize());
      hold = null;
    }
  });

  canvas.addEventListener('pointercancel', () => {
    if (drag) drag.p.dragging = false;
    drag = hold = null;
  });
  canvas.addEventListener('pointerleave', () => (pointer.inside = false));

  // 滚轮调整行星质量
  canvas.addEventListener(
    'wheel',
    (e) => {
      const p = sky.pick(e.clientX, e.clientY, orrery.planets);
      if (!p) return;
      e.preventDefault();
      p.size = clamp(p.size - e.deltaY * 0.003, 0.6, 3);
    },
    { passive: false },
  );
}

const holdSize = () => 1 + Math.min(1, (performance.now() - hold.start) / 1200) * 2;

/** 计算悬停反馈：幽灵行星、标签、光标 */
function hoverState() {
  const out = { hoverRing: -1, ghost: null, label: null };
  if (!audio.ready || !pointer.inside) return out;
  if (hold) {
    out.hoverRing = hold.ring;
    out.ghost = {
      ring: hold.ring,
      angle: orrery.ringAngle(hold.ring, clock.sim) + hold.phi,
      size: holdSize(),
      label: `${ringName(hold.ring)} · 质量 ${holdSize().toFixed(1)}`,
    };
    return out;
  }
  if (drag?.moved) {
    const near = sky.nearestRing(pointer.x, pointer.y, true);
    canvas.style.cursor = 'grabbing';
    if (near) {
      out.hoverRing = near.ring;
      out.label = { x: pointer.x, y: pointer.y - 18, text: `→ ${ringName(near.ring)}` };
    } else out.label = { x: pointer.x, y: pointer.y - 18, text: '松手摘除' };
    return out;
  }
  const hit = sky.pick(pointer.x, pointer.y, orrery.planets);
  if (hit) {
    canvas.style.cursor = 'grab';
    out.hoverRing = hit.ring;
    out.label = {
      x: hit.sx,
      y: hit.sy - sky.planetRadius(hit.size) - 10,
      text: `${ringName(hit.ring)} · 点击摘除 · 拖动换轨`,
    };
    return out;
  }
  const near = sky.nearestRing(pointer.x, pointer.y);
  canvas.style.cursor = near ? 'crosshair' : 'default';
  if (near) {
    out.hoverRing = near.ring;
    const phi = orrery.offsetFor(near.ring, near.angle, clock.sim, settings.snap);
    out.ghost = { ring: near.ring, angle: orrery.ringAngle(near.ring, clock.sim) + phi, size: 1, label: ringName(near.ring) };
  }
  return out;
}

// ---------- 主循环 ----------

let last = performance.now();
let beatShown = -1;

function frame(ms) {
  const dt = Math.min(0.05, (ms - last) / 1000);
  last = ms;

  if (!audio.ready) clock.sim += dt; // 封面阶段：静默公转
  else if (clock.playing) {
    clock.sim = simNow();
    schedule();
    flushEvents(clock.sim);
  }

  const wave = audio.waveform();
  if (wave) {
    let sum = 0;
    for (let i = 0; i < wave.length; i += 4) sum += wave[i] * wave[i];
    const rms = Math.sqrt(sum / (wave.length / 4));
    level += (clamp(rms * 3, 0, 1) - level) * 0.2;
  }

  // 节拍计数：最外圈公转一周 = 16 拍
  const beat = Math.floor((wrap(orrery.ringAngle(RING_COUNT - 1, clock.sim)) / TAU) * 16) + 1;
  if (beat !== beatShown) {
    beatShown = beat;
    $('#beat').textContent = `拍 ${String(beat).padStart(2, '0')} / 16`;
  }

  const t = clock.sim;
  sky.draw({
    dt,
    wall: ms / 1000,
    planets: orrery.planets,
    angle: (p) => orrery.angle(p, t),
    omega: (ring) => orrery.omega(ring),
    ringAngle: (ring) => orrery.ringAngle(ring, t),
    meridians: orrery.meridians,
    noteNames: Array.from({ length: RING_COUNT }, (_, i) => ringName(i)),
    snap: settings.snap,
    wave,
    level,
    ...hoverState(),
  });
  requestAnimationFrame(frame);
}

// ---------- 启动 ----------

bindUi();
bindPointer();
const shared = location.hash.length > 1 ? decodeScene(location.hash) : null;
if (shared && shared.planets.length) {
  applyScene(shared);
  $('#enterBtn').textContent = '聆听这片星系';
} else {
  setBpm(orrery.bpm);
  setReverb(settings.reverb);
  setMode(orrery.mode);
  setMeridians(orrery.meridians);
  loadSlots(PRESET);
}
updateHud();
requestAnimationFrame(frame);
