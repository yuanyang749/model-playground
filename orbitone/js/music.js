// 乐理与轨道常量：轨道 → 音高 / 转速 / 颜色

export const TAU = Math.PI * 2;
export const wrap = (a) => ((a % TAU) + TAU) % TAU;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const RING_COUNT = 9; // 轨道数，0 为最内圈（最高音）
export const RING_INNER = 0.26; // 最内圈半径占最大半径的比例
export const BEATS_PER_CYCLE = 16; // 最外圈公转一周 = 16 拍
export const SLOTS = 16; // 吸附模式下每条轨道的槽位数

// 由高音（暖金）到低音（冷绿）
export const PALETTE = [
  '#ffd27a', '#ffb08a', '#ff8fa3', '#f48fd8', '#c39bff',
  '#9aa6ff', '#78c2ff', '#66e0dc', '#7cefb0',
];

export const SCALES = [
  { name: '五声 · 宫调', steps: [0, 2, 4, 7, 9] },
  { name: '平调子 · 和风', steps: [0, 2, 3, 7, 8] },
  { name: '多利亚', steps: [0, 2, 3, 5, 7, 9, 10] },
  { name: '利底亚', steps: [0, 2, 4, 6, 7, 9, 11] },
  { name: '全音 · 梦境', steps: [0, 2, 4, 6, 8, 10] },
];

// 最外圈（最低音）对应的 MIDI 音高
export const KEYS = [
  { name: 'C', midi: 48 }, { name: 'D', midi: 50 }, { name: 'E', midi: 52 },
  { name: 'F', midi: 53 }, { name: 'G', midi: 55 }, { name: 'A', midi: 45 },
];

export const TIMBRES = [
  { id: 'crystal', name: '水晶钟' },
  { id: 'kalimba', name: '卡林巴' },
  { id: 'glass', name: '玻璃琴' },
];

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const ringNorm = (i) => RING_INNER + ((1 - RING_INNER) * i) / (RING_COUNT - 1);

/** 每个周期内的公转圈数。谐振：外圈 1 圈、内圈 9 圈；开普勒：T² ∝ r³ */
export function ringRevs(i, mode) {
  return mode === 'harmonic' ? RING_COUNT - i : Math.pow(1 / ringNorm(i), 1.5);
}

export function ringMidi(ring, scale, rootMidi) {
  const degree = RING_COUNT - 1 - ring;
  const n = scale.steps.length;
  return rootMidi + scale.steps[degree % n] + 12 * Math.floor(degree / n);
}

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const midiName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
