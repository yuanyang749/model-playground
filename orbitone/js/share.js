// 把星系编码进 URL hash，便于分享

import { TAU, clamp, RING_COUNT, SCALES, KEYS, TIMBRES } from './music.js';

const int = (v, lo, hi, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? clamp(n, lo, hi) : d;
};

/** 每颗行星 4 个 base36 字符：轨道(1) + 角度(2) + 质量(1) */
export function encodeScene(s) {
  const p = s.planets
    .map(({ ring, angle, size }) =>
      ring.toString(36) +
      (Math.round((angle / TAU) * 1296) % 1296).toString(36).padStart(2, '0') +
      Math.round(((clamp(size, 0.6, 3) - 0.6) / 2.4) * 35).toString(36))
    .join('');
  const q = new URLSearchParams({
    bpm: s.bpm,
    mode: s.mode === 'kepler' ? 'k' : 'h',
    mer: s.meridians,
    sc: s.scale,
    key: s.key,
    tim: s.timbre,
    rev: Math.round(s.reverb * 100),
    p,
  });
  return '#' + q.toString();
}

export function decodeScene(hash) {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const str = q.get('p');
  if (!str) return null;
  const planets = [];
  for (let i = 0; i + 4 <= str.length; i += 4) {
    const ring = parseInt(str[i], 36);
    const angle = (parseInt(str.slice(i + 1, i + 3), 36) / 1296) * TAU;
    const size = 0.6 + (parseInt(str[i + 3], 36) / 35) * 2.4;
    if (ring < RING_COUNT && Number.isFinite(angle) && Number.isFinite(size)) planets.push({ ring, angle, size });
  }
  return {
    bpm: int(q.get('bpm'), 40, 160, 76),
    mode: q.get('mode') === 'k' ? 'kepler' : 'harmonic',
    meridians: int(q.get('mer'), 1, 4, 1),
    scale: int(q.get('sc'), 0, SCALES.length - 1, 0),
    key: int(q.get('key'), 0, KEYS.length - 1, 1),
    timbre: int(q.get('tim'), 0, TIMBRES.length - 1, 0),
    reverb: int(q.get('rev'), 0, 100, 45) / 100,
    planets,
  };
}
