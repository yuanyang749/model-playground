// 方块定义与程序化像素贴图图集

import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  WATER: 7, PLANKS: 8, BEDROCK: 9, SNOW: 10, COAL: 11, BRICK: 12,
};

// 图集中的贴图索引（4×4，每格 16px）
const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  WATER: 8, PLANKS: 9, BEDROCK: 10, SNOW: 11, SNOW_SIDE: 12, COAL: 13, BRICK: 14,
};

const ATLAS = 4;
const TILE = 16;
const SIZE = ATLAS * TILE;

export const BLOCKS = [];
function def(id, name, [top, side, bottom], hp, color) {
  BLOCKS[id] = { id, name, top, side, bottom, hp, color: new THREE.Color(color) };
}
def(B.GRASS, '草方块', [T.GRASS_TOP, T.GRASS_SIDE, T.DIRT], 2, '#5f9e3c');
def(B.DIRT, '泥土', [T.DIRT, T.DIRT, T.DIRT], 2, '#86603f');
def(B.STONE, '石头', [T.STONE, T.STONE, T.STONE], 5, '#808080');
def(B.SAND, '沙子', [T.SAND, T.SAND, T.SAND], 1.5, '#dccf9f');
def(B.LOG, '原木', [T.LOG_TOP, T.LOG_SIDE, T.LOG_TOP], 4, '#6b5230');
def(B.LEAVES, '树叶', [T.LEAVES, T.LEAVES, T.LEAVES], 0.6, '#3a7828');
def(B.WATER, '水', [T.WATER, T.WATER, T.WATER], Infinity, '#3064c8');
def(B.PLANKS, '木板', [T.PLANKS, T.PLANKS, T.PLANKS], 3, '#a88450');
def(B.BEDROCK, '基岩', [T.BEDROCK, T.BEDROCK, T.BEDROCK], Infinity, '#444444');
def(B.SNOW, '雪', [T.SNOW, T.SNOW_SIDE, T.DIRT], 1.5, '#f0f6fc');
def(B.COAL, '煤矿', [T.COAL, T.COAL, T.COAL], 5, '#555555');
def(B.BRICK, '砖块', [T.BRICK, T.BRICK, T.BRICK], 6, '#a0463a');

export const isSolid = (id) => id !== B.AIR && id !== B.WATER;

const INSET = 0.0006;
export function tileUV(tile) {
  const tx = tile % ATLAS;
  const ty = Math.floor(tile / ATLAS);
  const u0 = tx / ATLAS + INSET;
  const u1 = (tx + 1) / ATLAS - INSET;
  const v1 = 1 - ty / ATLAS - INSET;
  const v0 = 1 - (ty + 1) / ATLAS + INSET;
  return [u0, v0, u1, v1];
}

// ---------- 像素画师 ----------

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function makePainters(rnd) {
  const vary = (rgb, amt) => {
    const k = 1 + (rnd() - 0.5) * amt;
    return rgb.map((v) => clamp255(v * k));
  };
  const dirt = () => (rnd() < 0.1 ? vary([100, 70, 48], 0.2) : vary([134, 96, 67], 0.3));
  const stone = () => (rnd() < 0.09 ? vary([95, 95, 95], 0.15) : vary([128, 128, 128], 0.22));
  const coalSpots = new Set();
  for (let i = 0; i < 6; i++) {
    const cx = 2 + Math.floor(rnd() * 12);
    const cy = 2 + Math.floor(rnd() * 12);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]]) coalSpots.add((cy + dy) * 16 + cx + dx);
  }
  return {
    [T.GRASS_TOP]: () => (rnd() < 0.12 ? vary([120, 190, 70], 0.2) : vary([92, 156, 54], 0.32)),
    [T.GRASS_SIDE]: (x, y) => (y < 3 + ((x * 7 + 3) % 3 === 0 ? 1 : 0) ? vary([92, 156, 54], 0.3) : dirt()),
    [T.DIRT]: dirt,
    [T.STONE]: stone,
    [T.SAND]: () => vary([220, 208, 160], 0.12),
    [T.LOG_SIDE]: (x) => vary(x % 4 === 0 ? [84, 64, 38] : [110, 84, 50], 0.18),
    [T.LOG_TOP]: (x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.5) return vary([96, 72, 42], 0.15);
      return vary(Math.floor(d) % 2 ? [176, 140, 90] : [150, 116, 72], 0.1);
    },
    [T.LEAVES]: () => (rnd() < 0.14 ? vary([30, 72, 22], 0.2) : vary([58, 122, 40], 0.45)),
    [T.WATER]: () => vary([52, 104, 205], 0.14),
    [T.PLANKS]: (x, y) => {
      const row = Math.floor(y / 4);
      if (y % 4 === 3 || x === (row % 2 ? 3 : 11)) return vary([110, 82, 48], 0.1);
      return vary([170, 134, 82], 0.12);
    },
    [T.BEDROCK]: () => [[38, 38, 38], [86, 86, 86], [128, 128, 128]][Math.floor(rnd() * 3)],
    [T.SNOW]: () => vary([240, 246, 252], 0.06),
    [T.SNOW_SIDE]: (x, y) => (y < 4 + ((x * 5) % 3 === 0 ? 1 : 0) ? vary([240, 246, 252], 0.06) : dirt()),
    [T.COAL]: (x, y) => (coalSpots.has(y * 16 + x) ? vary([34, 34, 34], 0.3) : stone()),
    [T.BRICK]: (x, y) => {
      const row = Math.floor(y / 4);
      if (y % 4 === 3 || x % 8 === (row % 2 ? 0 : 4)) return vary([196, 188, 176], 0.08);
      return vary([164, 72, 56], 0.18);
    },
  };
}

export function createAtlas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const img = g.createImageData(SIZE, SIZE);
  const painters = makePainters(mulberry32(1337));
  for (const [tile, paint] of Object.entries(painters)) {
    const tx = (tile % ATLAS) * TILE;
    const ty = Math.floor(tile / ATLAS) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const [r, gg, b] = paint(x, y);
        const i = ((ty + y) * SIZE + tx + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return pixelTexture(c);
}

/** 单张可平铺的水面贴图，用于无限海洋 */
export function createWaterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  const rnd = mulberry32(77);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const k = 1 + (rnd() - 0.5) * 0.16 + (Math.sin((x + y * 0.5) * 0.8) > 0.85 ? 0.18 : 0);
      g.fillStyle = `rgb(${clamp255(52 * k)},${clamp255(110 * k)},${clamp255(205 * k)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = pixelTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function pixelTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
