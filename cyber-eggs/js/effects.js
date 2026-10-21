/**
 * 《隔代夺蛋：2026》弹簧物理、双时空背景舞台、锯齿闪电分屏与波普粒子特效引擎
 */

/**
 * 二阶阻尼弹簧振子 (用于角色 Squash & Stretch 挤压拉伸和 UI Q弹反馈)
 */
export class Spring {
  constructor(initial = 1, stiffness = 260, damping = 16) {
    this.value = initial;
    this.target = initial;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  impulse(force) {
    this.velocity += force;
  }

  setTarget(t) {
    this.target = t;
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    const accel = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += accel * safeDt;
    this.value += this.velocity * safeDt;
    return this.value;
  }
}

/**
 * 粒子与波普浮动文字管理器
 */
export class EffectsManager {
  constructor() {
    this.particles = [];
    this.popTexts = [];
    this.shakeTime = 0;
    this.shakeMagnitude = 0;
    this.flashAlpha = 0;
    this.flashColor = '#FFFFFF';
  }

  triggerShake(magnitude = 10, duration = 0.25) {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  triggerFlash(color = '#FFFFFF', alpha = 0.5) {
    this.flashColor = color;
    this.flashAlpha = alpha;
  }

  /**
   * 爆出多巴胺彩色粒子 (星星 / 纸屑 / 闪电碎屑)
   */
  spawnBurst(x, y, colorPalette = ['#FFBE0B', '#FF2A54', '#06D6A0', '#00F0FF', '#FF007F'], count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 120 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: 6 + Math.random() * 8,
        color: colorPalette[i % colorPalette.length],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.8,
        shape: i % 3 === 0 ? 'star' : 'rect'
      });
    }
  }

  /**
   * 弹出波普漫画浮动字 (如 "+100", "+500!", "血赚!", "好家伙!")
   */
  spawnPopText(x, y, text, color = '#CCFF00', scale = 1.0) {
    this.popTexts.push({
      x,
      y,
      text,
      color,
      scale,
      vy: -95,
      life: 0.85,
      maxLife: 0.85,
      tilt: (Math.random() - 0.5) * 0.26
    });
  }

  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt; // 重力
      p.rotation += p.vRot * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.popTexts.length - 1; i >= 0; i--) {
      const t = this.popTexts[i];
      t.y += t.vy * dt;
      t.vy *= 0.94;
      t.life -= dt;
      if (t.life <= 0) this.popTexts.splice(i, 1);
    }
  }

  applyShake(ctx) {
    if (this.shakeTime > 0) {
      const dx = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
      const dy = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
      ctx.translate(dx, dy);
    }
  }

  render(ctx, width, height) {
    // 渲染粒子
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;

      if (p.shape === 'star') {
        drawFourPointStar(ctx, 0, 0, p.size * 1.3);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      }
      ctx.restore();
    }

    // 渲染波普浮动大字 (+100 / +500! 等)
    for (const t of this.popTexts) {
      const progress = 1 - t.life / t.maxLife;
      const popScale = progress < 0.2 ? (0.5 + (progress / 0.2) * 0.75) : (1.25 - (progress - 0.2) * 0.3);
      const alpha = t.life < 0.25 ? t.life / 0.25 : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(t.x, t.y);
      ctx.rotate(t.tilt);
      ctx.scale(popScale * t.scale, popScale * t.scale);

      ctx.font = 'italic 900 34px "Impact", "PingFang SC", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 粗黑阴影与描边
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#111111';
      ctx.strokeText(t.text, 3, 4);
      ctx.strokeText(t.text, 0, 0);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }

    // 渲染全屏闪光
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}

/**
 * 绘制四角星光工具函数
 */
export function drawFourPointStar(ctx, cx, cy, r) {
  ctx.beginPath();
  const inner = r * 0.35;
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + inner, cy - inner);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx + inner, cy + inner);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - inner, cy + inner);
  ctx.lineTo(cx - r, cy);
  ctx.lineTo(cx - inner, cy - inner);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * 1:1 对照概念图绘制左右双屏背景 + 中央粉黑锯齿闪电分割线
 */
export function drawDualStageBackground(ctx, width, height, time, mergedMode = false, isFever = false) {
  const midX = width * 0.5;

  // ==================== 左半屏：市井多巴胺·红星早市 ====================
  ctx.save();
  if (!mergedMode) {
    ctx.beginPath();
    ctx.rect(0, 0, midX + 35, height);
    ctx.clip();
  }

  // 奶油黄暖光渐变底
  const leftGrad = ctx.createLinearGradient(0, 0, 0, height);
  leftGrad.addColorStop(0, '#FFFDF2');
  leftGrad.addColorStop(1, '#F2F9D8');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, mergedMode ? width * 0.55 : midX + 40, height);

  // 远景早市摊位剪影色块
  ctx.fillStyle = '#CBEAD6';
  ctx.strokeStyle = '#7FB69B';
  ctx.lineWidth = 2;
  const stalls = [
    { x: 18, y: height - 210, w: 75, h: 210 },
    { x: 480, y: height - 190, w: 80, h: 190 },
    { x: 545, y: height - 150, w: 70, h: 150 }
  ];
  for (const s of stalls) {
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  }

  // 半调波普圆点纹理 (Halftone Dots)
  ctx.fillStyle = 'rgba(255, 168, 34, 0.22)';
  for (let gx = 24; gx < midX; gx += 26) {
    for (let gy = 30; gy < height - 60; gy += 26) {
      if ((gx + gy) % 52 === 0) {
        ctx.beginPath();
        ctx.arc(gx, gy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 顶部悬挂红色促销三角吊旗 ("FREE DISCOUNT")
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.quadraticCurveTo(midX * 0.5, 92, midX + 20, 62);
  ctx.stroke();

  const bannerCount = 6;
  for (let i = 0; i < bannerCount; i++) {
    const bx = 12 + i * 98;
    const by = 52 + Math.sin(i * 0.6) * 14 + Math.sin(time * 3 + i) * 2.5;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate((0.12 - i * 0.04) + Math.sin(time * 2.5 + i) * 0.03);

    // 红色五边形吊旗
    ctx.fillStyle = '#FF3B30';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, 0);
    ctx.lineTo(64, 72);
    ctx.lineTo(32, 96);
    ctx.lineTo(0, 72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFBE0B';
    ctx.font = '900 11px "Impact", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FREE', 32, 34);
    ctx.fillText('DISCOUNT', 32, 50);
    ctx.restore();
  }

  // 左右两侧黄色鸡蛋海报 ("FREE EGGS!")
  drawMarketPoster(ctx, 36, 215, -0.06);
  drawMarketPoster(ctx, midX - 88, 220, 0.05);

  // 左屏底部漫画黑色速度线
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const yLine = height - 110 + i * 18;
    ctx.beginPath();
    ctx.moveTo(0, yLine);
    ctx.lineTo(95 - i * 8, yLine + 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX, yLine);
    ctx.lineTo(midX - 95 + i * 8, yLine + 12);
    ctx.stroke();
  }
  ctx.restore();

  // ==================== 右半屏：赛博糖果多巴胺·RGB 电竞房 ====================
  ctx.save();
  if (!mergedMode) {
    ctx.beginPath();
    ctx.rect(midX - 35, 0, width - midX + 35, height);
    ctx.clip();
  }

  const rightGrad = ctx.createLinearGradient(midX, 0, width, height);
  rightGrad.addColorStop(0, '#1B0B36');
  rightGrad.addColorStop(0.5, '#260E4D');
  rightGrad.addColorStop(1, '#120826');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(mergedMode ? width * 0.45 : midX - 40, 0, width, height);

  // 品红赛博透视网格线
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.34)';
  ctx.lineWidth = 1.8;
  const gridOffset = (time * 35) % 44;
  for (let y = 0; y < height; y += 44) {
    const drawY = (y + gridOffset) % height;
    ctx.beginPath();
    ctx.moveTo(midX - 30, drawY);
    ctx.lineTo(width, drawY);
    ctx.stroke();
  }
  for (let x = midX - 20; x < width + 120; x += 68) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (x - (midX + 320)) * 0.35, height);
    ctx.stroke();
  }

  // 赛博荧光故障像素条 (Glitch Bars)
  const glitchBlocks = [
    { x: midX + 40, y: 245, w: 60, h: 10, c: '#00F0FF' },
    { x: midX + 25, y: 265, w: 95, h: 12, c: '#FF007F' },
    { x: midX + 60, y: 390, w: 48, h: 10, c: '#06D6A0' },
    { x: width - 170, y: 95, w: 120, h: 12, c: '#00F0FF' },
    { x: width - 140, y: 118, w: 85, h: 10, c: '#CCFF00' }
  ];
  for (const b of glitchBlocks) {
    const shift = Math.sin(time * 8 + b.y) * 6;
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x + shift, b.y, b.w, b.h);
  }

  // 右下角电路板发光走线
  ctx.strokeStyle = '#00F0FF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width - 28, height);
  ctx.lineTo(width - 28, height - 180);
  ctx.lineTo(width - 68, height - 220);
  ctx.lineTo(width - 68, height - 290);
  ctx.stroke();
  ctx.fillStyle = '#00F0FF';
  ctx.beginPath();
  ctx.arc(width - 68, height - 290, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // ==================== 多巴胺暴走全屏彩虹放射速度线 ====================
  if (isFever || mergedMode) {
    ctx.save();
    ctx.translate(midX, height * 0.55);
    const rayCount = 24;
    for (let i = 0; i < rayCount; i++) {
      const ang = (Math.PI * 2 * i) / rayCount + time * 1.4;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 190, 11, 0.14)' : 'rgba(0, 240, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * 900, Math.sin(ang) * 900);
      ctx.lineTo(Math.cos(ang + 0.06) * 900, Math.sin(ang + 0.06) * 900);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ==================== 正中央：粉黑锯齿闪电分屏线 ====================
  if (!mergedMode) {
    ctx.save();
    const jitter = Math.sin(time * 24) * 2.5;

    // 黑色粗闪电外轮廓底座
    ctx.fillStyle = '#111111';
    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(midX - 8 + jitter, 0);
    ctx.lineTo(midX + 26 + jitter, 0);
    ctx.lineTo(midX - 2 + jitter, height * 0.46);
    ctx.lineTo(midX + 34 + jitter, height * 0.42);
    ctx.lineTo(midX - 8 + jitter, height * 0.72);
    ctx.lineTo(midX + 24 + jitter, height * 0.68);
    ctx.lineTo(midX - 18 + jitter, height);
    ctx.lineTo(midX - 42 + jitter, height);
    ctx.lineTo(midX - 4 + jitter, height * 0.65);
    ctx.lineTo(midX - 34 + jitter, height * 0.69);
    ctx.lineTo(midX + 2 + jitter, height * 0.39);
    ctx.lineTo(midX - 30 + jitter, height * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

function drawMarketPoster(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#FFE082';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.fillRect(-38, -56, 76, 112);
  ctx.strokeRect(-38, -56, 76, 112);

  ctx.fillStyle = '#D90429';
  ctx.font = '900 15px "Impact", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FREE', 0, -30);
  ctx.fillText('EGGS!', 0, -12);

  // 小鸡蛋图案
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.ellipse(-10, 22, 10, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFBE0B';
  ctx.beginPath();
  ctx.ellipse(8, 24, 11, 15, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
