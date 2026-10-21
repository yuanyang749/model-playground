/**
 * 《隔代夺蛋：2026》程序化矢量纸偶角色引擎 (王大妈 & 大孙子) + 4态颜艺状态机 + 同构掉落物绘制
 * 严格对照概念效果图 1:1 还原：爆炸头碎花马甲红塑料袋 vs 猫耳耳机电光粉卫衣全息篮+RGB鼠标
 */

import { Spring, drawFourPointStar } from './effects.js';

export const EXPR = {
  NORMAL: 'NORMAL',
  ECSTATIC: 'ECSTATIC',
  SHOCKED: 'SHOCKED',
  AWAKENED: 'AWAKENED'
};

export class DualCharacterRig {
  constructor() {
    // 归一化水平位置 (0.15 ~ 0.85)，分别映射到左半屏和右半屏
    this.normX = 0.5;
    this.targetNormX = 0.5;

    // 弹簧物理：用于 Squash & Stretch (挤压拉伸) 与移动倾角
    this.scaleX = new Spring(1, 300, 15);
    this.scaleY = new Spring(1, 300, 15);
    this.tilt = new Spring(0, 220, 16);
    this.armLift = new Spring(0, 280, 14);

    // 颜艺状态机
    this.expression = EXPR.ECSTATIC;
    this.exprTimer = 0;

    // 护盾状态
    this.shieldTimer = 0;

    // 彩虹残影队列 (Fever / 觉醒模式)
    this.afterimages = [];
    this.afterimageTick = 0;
  }

  setExpression(expr, duration = 0.9) {
    this.expression = expr;
    this.exprTimer = duration;

    if (expr === EXPR.ECSTATIC) {
      this.scaleX.impulse(3.2);
      this.scaleY.impulse(-2.8);
      this.armLift.impulse(4.5);
    } else if (expr === EXPR.SHOCKED) {
      this.scaleX.impulse(-3.5);
      this.scaleY.impulse(3.8);
    }
  }

  moveBy(deltaNorm) {
    const prev = this.targetNormX;
    this.targetNormX = Math.max(0.14, Math.min(0.86, this.targetNormX + deltaNorm));
    const diff = this.targetNormX - prev;
    this.tilt.impulse(diff * 18);
  }

  setNormalizedX(val) {
    const clamped = Math.max(0.14, Math.min(0.86, val));
    const diff = clamped - this.targetNormX;
    this.targetNormX = clamped;
    this.tilt.impulse(diff * 8);
  }

  triggerMashBounce() {
    this.scaleX.velocity = Math.min(2.2, this.scaleX.velocity + 1.4);
    this.scaleY.velocity = Math.max(-2.0, this.scaleY.velocity - 1.2);
    this.armLift.velocity = Math.min(4.0, this.armLift.velocity + 2.5);
    this.setExpression(EXPR.ECSTATIC, 0.45);
  }

  update(dt, isFever = false) {
    // 平滑追踪水平坐标
    const prevX = this.normX;
    this.normX += (this.targetNormX - this.normX) * Math.min(1, dt * 16);
    const vx = (this.normX - prevX) / Math.max(dt, 0.001);

    this.tilt.setTarget(Math.max(-0.22, Math.min(0.22, vx * 0.14)));
    this.scaleX.update(dt);
    this.scaleY.update(dt);
    this.tilt.update(dt);
    this.armLift.update(dt);

    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0) {
        this.expression = isFever ? EXPR.ECSTATIC : EXPR.NORMAL;
      }
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    }

    // 记录残影
    if (isFever || this.expression === EXPR.AWAKENED) {
      this.afterimageTick += dt;
      if (this.afterimageTick > 0.045) {
        this.afterimageTick = 0;
        this.afterimages.push({ normX: this.normX, alpha: 0.45 });
        if (this.afterimages.length > 5) this.afterimages.shift();
      }
    } else if (this.afterimages.length > 0) {
      this.afterimages.pop();
    }

    for (const img of this.afterimages) {
      img.alpha *= 0.88;
    }
  }

  /**
   * 获取左屏王大妈与右屏大孙子的屏幕像素坐标 (及接蛋篮碰撞判定点)
   */
  getPositions(width, height, mergedMode = false) {
    const midX = width * 0.5;
    const baseY = height - 22;

    if (mergedMode) {
      const centerX = width * (0.12 + this.normX * 0.76);
      return {
        grandmaX: centerX - 66,
        grandsonX: centerX + 66,
        mergedX: centerX,
        baseY,
        catchPoints: [
          { side: 'merged', x: centerX, y: baseY - 135, r: 110 }
        ]
      };
    }

    const grandmaX = 75 + this.normX * (midX - 165);
    const grandsonX = midX + 85 + this.normX * (midX - 165);

    return {
      grandmaX,
      grandsonX,
      baseY,
      catchPoints: [
        // 王大妈主体与右手红塑料袋整个上半身均可接蛋
        { side: 'left', x: grandmaX + 28, y: baseY - 130, r: 88 },
        // 大孙子主体与右手全息购物篮整个上半身均可接蛋
        { side: 'right', x: grandsonX - 24, y: baseY - 130, r: 88 }
      ]
    };
  }

  render(ctx, width, height, time, mergedMode = false) {
    const pos = this.getPositions(width, height, mergedMode);
    const bob = Math.sin(time * 9) * 4;

    // 渲染多巴胺彩虹残影
    for (let i = 0; i < this.afterimages.length; i++) {
      const ghost = this.afterimages[i];
      ctx.save();
      ctx.globalAlpha = ghost.alpha * 0.35;
      const gLeftX = 55 + ghost.normX * (width * 0.5 - 125);
      const gRightX = width * 0.5 + 65 + ghost.normX * (width * 0.5 - 125);
      if (!mergedMode) {
        this.drawGrandma(ctx, gLeftX, pos.baseY, time, true);
        this.drawGrandson(ctx, gRightX, pos.baseY, time, true);
      }
      ctx.restore();
    }

    if (mergedMode) {
      // Stage 4：祖孙人神合一觉醒形态 (背靠背合体 + 金色赛博算盘光环)
      ctx.save();
      ctx.translate(pos.mergedX, pos.baseY - 110);
      ctx.rotate(time * 2.5);
      ctx.strokeStyle = '#FFBE0B';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 128, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.fillStyle = i % 2 === 0 ? '#FF007F' : '#00F0FF';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 128, Math.sin(a) * 128, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      this.drawGrandma(ctx, pos.grandmaX, pos.baseY + bob, time, false);
      this.drawGrandson(ctx, pos.grandsonX, pos.baseY - bob, time, false);
    } else {
      this.drawGrandma(ctx, pos.grandmaX, pos.baseY + bob, time, false);
      this.drawGrandson(ctx, pos.grandsonX, pos.baseY + bob, time, false);
    }
  }

  /**
   * 1:1 复刻概念图左屏主角：早市战神【王大妈】
   */
  drawGrandma(ctx, x, y, time, isGhost = false) {
    const sx = this.scaleX.value * 1.25;
    const sy = this.scaleY.value * 1.25;
    const tilt = this.tilt.value;
    const armWave = Math.sin(time * 12) * 6 + this.armLift.value * 3;
    const expr = this.expression;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);

    if (expr === EXPR.SHOCKED) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }

    // 1. 两侧张开的黄色长袖手臂
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#111111';

    // 左画面侧手臂 (挥舞红塑料袋残影)
    ctx.save();
    ctx.translate(-46, -92);
    ctx.rotate(-0.45 - armWave * 0.02);
    ctx.fillStyle = '#FFBE0B';
    drawRoundedLimb(ctx, -62, -14, 68, 28, 12);
    // 手掌
    ctx.fillStyle = '#FFC8A2';
    ctx.beginPath();
    ctx.arc(-66, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 红色挥动残影飘带
    if (!isGhost) {
      ctx.fillStyle = '#FF2A54';
      ctx.beginPath();
      ctx.moveTo(-72, 4);
      ctx.quadraticCurveTo(-50, 56, -24, 98);
      ctx.lineTo(-42, 102);
      ctx.quadraticCurveTo(-70, 58, -78, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 右画面侧手臂 (高举大红塑料袋)
    ctx.save();
    ctx.translate(46, -92);
    ctx.rotate(0.42 + armWave * 0.02);
    ctx.fillStyle = '#FFBE0B';
    drawRoundedLimb(ctx, -6, -14, 68, 28, 12);
    // 手掌
    ctx.fillStyle = '#FFC8A2';
    ctx.beginPath();
    ctx.arc(64, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. 身体躯干：高饱和碎花马甲 (Floral Vest)
    ctx.fillStyle = '#E6196B';
    ctx.beginPath();
    ctx.moveTo(-48, 0);
    ctx.quadraticCurveTo(-54, -68, -40, -104);
    ctx.lineTo(40, -104);
    ctx.quadraticCurveTo(54, -68, 48, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 马甲黄色领口与五彩小碎花图案
    ctx.fillStyle = '#FFBE0B';
    ctx.beginPath();
    ctx.moveTo(-22, -104);
    ctx.lineTo(0, -68);
    ctx.lineTo(22, -104);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isGhost) {
      const flowers = [
        { fx: -26, fy: -72, c: '#FFBE0B' },
        { fx: 25, fy: -74, c: '#06D6A0' },
        { fx: -18, fy: -38, c: '#00BBF9' },
        { fx: 20, fy: -40, c: '#FFBE0B' },
        { fx: 0, fy: -22, c: '#FF9F1C' },
        { fx: -32, fy: -16, c: '#FFBE0B' },
        { fx: 32, fy: -16, c: '#FF5C77' }
      ];
      for (const f of flowers) {
        drawTinyFlower(ctx, f.fx, f.fy, f.c);
      }
    }

    // 3. 头部与蓬松爆炸卷发 (Curly Perm Hair)
    ctx.save();
    ctx.translate(0, -146);

    // 爆炸卷发后层圆簇
    ctx.fillStyle = '#523428';
    const curls = [
      { cx: -38, cy: -14, r: 22 },
      { cx: -24, cy: -38, r: 24 },
      { cx: 0, cy: -44, r: 26 },
      { cx: 24, cy: -38, r: 24 },
      { cx: 38, cy: -14, r: 22 },
      { cx: -42, cy: 10, r: 19 },
      { cx: 42, cy: 10, r: 19 }
    ];
    for (const c of curls) {
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 耳朵与绿宝石耳坠
    ctx.fillStyle = '#FFC8A2';
    ctx.beginPath();
    ctx.arc(-40, 12, 10, 0, Math.PI * 2);
    ctx.arc(40, 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#06D6A0';
    ctx.beginPath();
    ctx.arc(-41, 22, 4.5, 0, Math.PI * 2);
    ctx.arc(41, 22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 脸庞
    ctx.fillStyle = expr === EXPR.SHOCKED ? '#FF8FA3' : '#FFC8A2';
    ctx.beginPath();
    ctx.arc(0, 8, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 额头卷发刘海
    ctx.fillStyle = '#523428';
    ctx.beginPath();
    ctx.arc(-18, -24, 14, 0, Math.PI * 2);
    ctx.arc(0, -26, 15, 0, Math.PI * 2);
    ctx.arc(18, -24, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 圆框老花镜 + 4态颜艺眼睛
    this.drawGlassesAndEyes(ctx, expr, '#B8F2E6', time);

    // 嘴巴颜艺
    this.drawMouth(ctx, expr, 0, 25);

    ctx.restore();

    // 4. 前景高光道具：立体大红塑料购物袋 (Red Plastic Bag)
    ctx.save();
    ctx.translate(78, -96 - armWave * 0.4);
    ctx.rotate(0.08);
    ctx.fillStyle = '#E6192E';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4.5;

    // 左提手与右提手
    ctx.beginPath();
    ctx.moveTo(-26, 18);
    ctx.quadraticCurveTo(-24, -26, -12, -24);
    ctx.quadraticCurveTo(-4, -22, -8, 18);
    ctx.moveTo(8, 18);
    ctx.quadraticCurveTo(4, -22, 14, -24);
    ctx.quadraticCurveTo(26, -26, 26, 18);
    ctx.stroke();

    // 袋身主体
    ctx.beginPath();
    ctx.moveTo(-28, 14);
    ctx.quadraticCurveTo(-48, 56, -34, 92);
    ctx.quadraticCurveTo(0, 102, 34, 92);
    ctx.quadraticCurveTo(48, 56, 28, 14);
    ctx.quadraticCurveTo(0, 26, -28, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 塑料袋高光褶皱
    ctx.strokeStyle = '#FF758F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 36);
    ctx.quadraticCurveTo(-24, 62, -14, 80);
    ctx.moveTo(16, 34);
    ctx.quadraticCurveTo(24, 60, 14, 78);
    ctx.stroke();
    ctx.restore();

    // 护盾光圈
    if (this.shieldTimer > 0) {
      this.drawShieldAura(ctx, 0, -90, time);
    }

    ctx.restore();
  }

  /**
   * 1:1 复刻概念图右屏主角：赛博仓鼠【大孙子】
   */
  drawGrandson(ctx, x, y, time, isGhost = false) {
    const sx = this.scaleX.value * 1.25;
    const sy = this.scaleY.value * 1.25;
    const tilt = this.tilt.value;
    const armWave = Math.sin(time * 12) * 6 + this.armLift.value * 3;
    const expr = this.expression;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);

    if (expr === EXPR.SHOCKED) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }

    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#111111';

    // 1. 两侧张开的荧光青柠袖子手臂
    // 左画面侧手臂 (高提发光全息购物篮)
    ctx.save();
    ctx.translate(-44, -90);
    ctx.rotate(-0.42 - armWave * 0.02);
    ctx.fillStyle = '#CCFF00';
    drawRoundedLimb(ctx, -64, -13, 66, 26, 12);
    ctx.fillStyle = '#FFE0CC';
    ctx.beginPath();
    ctx.arc(-66, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 右画面侧手臂 (托举巨型 RGB 鼠标)
    ctx.save();
    ctx.translate(44, -90);
    ctx.rotate(0.45 + armWave * 0.02);
    ctx.fillStyle = '#CCFF00';
    drawRoundedLimb(ctx, -4, -13, 66, 26, 12);
    ctx.fillStyle = '#FFE0CC';
    ctx.beginPath();
    ctx.arc(64, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. 身体躯干：荧光绿内搭 + 电光粉高领电竞夹克
    ctx.fillStyle = '#FF007F';
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.lineTo(-40, -104);
    ctx.lineTo(40, -104);
    ctx.lineTo(46, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 中央荧光绿内搭 T 恤
    ctx.fillStyle = '#CCFF00';
    ctx.beginPath();
    ctx.moveTo(-18, -104);
    ctx.lineTo(18, -104);
    ctx.lineTo(15, 0);
    ctx.lineTo(-15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. 头部：猫耳发光电竞耳机 + 刺猬头
    ctx.save();
    ctx.translate(0, -146);

    // 猫耳耳机顶梁与发光猫耳朵
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4.5;

    // 左猫耳
    ctx.fillStyle = '#7B2CBF';
    ctx.beginPath();
    ctx.moveTo(-42, -18);
    ctx.lineTo(-32, -62);
    ctx.lineTo(-8, -38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#00F5D4';
    ctx.beginPath();
    ctx.moveTo(-36, -24);
    ctx.lineTo(-30, -50);
    ctx.lineTo(-15, -35);
    ctx.closePath();
    ctx.fill();

    // 右猫耳
    ctx.fillStyle = '#7B2CBF';
    ctx.beginPath();
    ctx.moveTo(42, -18);
    ctx.lineTo(32, -62);
    ctx.lineTo(8, -38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#00F5D4';
    ctx.beginPath();
    ctx.moveTo(36, -24);
    ctx.lineTo(30, -50);
    ctx.lineTo(15, -35);
    ctx.closePath();
    ctx.fill();

    // 刺猬头发后层
    ctx.fillStyle = '#5C3A21';
    ctx.beginPath();
    ctx.moveTo(-42, -6);
    ctx.lineTo(-50, -28);
    ctx.lineTo(-28, -26);
    ctx.lineTo(-22, -52);
    ctx.lineTo(-4, -32);
    ctx.lineTo(6, -56);
    ctx.lineTo(20, -32);
    ctx.lineTo(36, -48);
    ctx.lineTo(34, -24);
    ctx.lineTo(50, -26);
    ctx.lineTo(42, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 脸庞
    ctx.fillStyle = expr === EXPR.SHOCKED ? '#FF8FA3' : '#FFE0CC';
    ctx.beginPath();
    ctx.arc(0, 8, 37, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 刺猬刘海
    ctx.fillStyle = '#5C3A21';
    ctx.beginPath();
    ctx.moveTo(-36, -8);
    ctx.lineTo(-24, -28);
    ctx.lineTo(-12, -10);
    ctx.lineTo(0, -30);
    ctx.lineTo(12, -10);
    ctx.lineTo(26, -28);
    ctx.lineTo(36, -8);
    ctx.quadraticCurveTo(0, -22, -36, -8);
    ctx.fill();
    ctx.stroke();

    // 左右发光耳机耳罩
    ctx.fillStyle = '#7B2CBF';
    ctx.beginPath();
    ctx.ellipse(-41, 10, 9, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(41, 10, 9, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#00F5D4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-41, 10, 4, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(41, 10, 4, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4.5;

    // 眼镜 + 4态颜艺眼睛
    this.drawGlassesAndEyes(ctx, expr, '#A8DADC', time);

    // 嘴巴
    this.drawMouth(ctx, expr, 0, 25);

    // 耳机麦克风软管
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(38, 24);
    ctx.quadraticCurveTo(24, 34, 12, 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(10, 30, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 4. 前景左道具：发光全息网格购物篮 (Holographic Basket)
    ctx.save();
    ctx.translate(-86, -54 - armWave * 0.4);
    ctx.rotate(-0.08);
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#00F0FF';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
    ctx.lineWidth = 3.5;

    // 篮子提手
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-12, -38);
    ctx.lineTo(12, -38);
    ctx.lineTo(26, 0);
    ctx.stroke();

    // 篮框梯形
    ctx.beginPath();
    ctx.moveTo(-48, 0);
    ctx.lineTo(48, 0);
    ctx.lineTo(36, 56);
    ctx.lineTo(-36, 56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 网格线
    ctx.lineWidth = 2;
    for (let gx = -24; gx <= 24; gx += 16) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx * 0.78, 56);
      ctx.stroke();
    }
    for (let gy = 18; gy <= 38; gy += 18) {
      ctx.beginPath();
      ctx.moveTo(-44, gy);
      ctx.lineTo(44, gy);
      ctx.stroke();
    }
    ctx.restore();

    // 5. 前景右道具：巨型无线 RGB 电竞鼠标
    ctx.save();
    ctx.translate(82, -46 - armWave * 0.3);
    ctx.rotate(-0.42);
    ctx.fillStyle = '#2B2D42';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 鼠标滚轮与霓虹灯带
    ctx.fillStyle = '#CCFF00';
    ctx.fillRect(-5, -30, 10, 16);
    ctx.strokeRect(-5, -30, 10, 16);

    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 16, 10, 0.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.restore();

    if (this.shieldTimer > 0) {
      this.drawShieldAura(ctx, 0, -90, time);
    }

    ctx.restore();
  }

  /**
   * 眼镜与 4 态颜艺眼睛渲染
   */
  drawGlassesAndEyes(ctx, expr, lensColor, time) {
    // 眼镜鼻梁
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();

    const eyeOffsets = [-18, 18];
    for (const ex of eyeOffsets) {
      ctx.fillStyle = expr === EXPR.SHOCKED ? '#FFE5EC' : lensColor;
      ctx.beginPath();
      ctx.arc(ex, 0, 15.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (expr === EXPR.ECSTATIC || expr === EXPR.AWAKENED) {
        // 概念图标志性的黄色四角大星星眼！
        ctx.save();
        ctx.translate(ex, 0);
        const pulse = 1 + Math.sin(time * 16) * 0.12;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#FFBE0B';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.5;
        drawFourPointStar(ctx, 0, 0, 12.5);
        ctx.restore();
      } else if (expr === EXPR.SHOCKED) {
        // 触电红温 X_X 眼
        ctx.strokeStyle = '#D90429';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ex - 7, -7);
        ctx.lineTo(ex + 7, 7);
        ctx.moveTo(ex + 7, -7);
        ctx.lineTo(ex - 7, 7);
        ctx.stroke();
        ctx.strokeStyle = '#111111';
      } else {
        // NORMAL 专注大瞳孔
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(ex, -1, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex - 2, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 嘴巴颜艺渲染
   */
  drawMouth(ctx, expr, mx, my) {
    ctx.save();
    ctx.translate(mx, my);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#111111';

    if (expr === EXPR.SHOCKED) {
      // 触电锯齿嘴
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-7, -6);
      ctx.lineTo(0, 2);
      ctx.lineTo(7, -6);
      ctx.lineTo(14, 0);
      ctx.lineTo(7, 8);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 狂喜大笑嘴 (白牙 + 粉红舌头)
      ctx.fillStyle = '#9E1B32';
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.quadraticCurveTo(0, -2, 14, -4);
      ctx.quadraticCurveTo(14, 16, 0, 16);
      ctx.quadraticCurveTo(-14, 16, -14, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 上排白牙
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.rect(-11, -4, 22, 6);
      ctx.fill();
      ctx.stroke();

      // 粉舌头
      ctx.fillStyle = '#FF5C77';
      ctx.beginPath();
      ctx.arc(0, 11, 7, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  drawShieldAura(ctx, cx, cy, time) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#00F0FF';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawRoundedLimb(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function drawTinyFlower(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 1:1 对照概念图绘制所有掉落道具与陷阱
 * (黄金土鸡蛋、大白菜、满减红券、带刺假床垫 vs 赛博电路蛋、-100% FREE礼盒、算力金币、99.99%弹窗炸弹)
 */
export function drawStageItem(ctx, item, time, isFever = false) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rot || 0);

  const scale = isFever && !item.isTrap ? 1.15 : 1.0;
  ctx.scale(scale, scale);

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#111111';

  switch (item.kind) {
    case 'market_egg': {
      // 发光黄金土鸡蛋
      ctx.shadowColor = '#FFBE0B';
      ctx.shadowBlur = 18;
      const eggGrad = ctx.createRadialGradient(-8, -10, 4, 0, 0, 32);
      eggGrad.addColorStop(0, '#FFF3B0');
      eggGrad.addColorStop(0.5, '#FFBE0B');
      eggGrad.addColorStop(1, '#E07A00');
      ctx.fillStyle = eggGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 31, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(-8, -10, 5, 10, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'market_cabbage': {
      // 翠绿大白菜
      ctx.fillStyle = '#9EF01A';
      ctx.beginPath();
      ctx.ellipse(0, 10, 20, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38B000';
      ctx.beginPath();
      ctx.arc(-10, -10, 16, 0, Math.PI * 2);
      ctx.arc(10, -10, 16, 0, Math.PI * 2);
      ctx.arc(0, -16, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 白菜叶脉
      ctx.strokeStyle = '#CCFF33';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(0, -12);
      ctx.moveTo(0, 8);
      ctx.lineTo(-10, -6);
      ctx.moveTo(0, 8);
      ctx.lineTo(10, -6);
      ctx.stroke();
      break;
    }

    case 'market_coupon': {
      // 红色满减代金券
      ctx.fillStyle = '#FF2A54';
      ctx.beginPath();
      ctx.roundRect(-26, -16, 52, 32, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFBE0B';
      ctx.font = '900 12px "Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FREE 券', 0, 4);
      break;
    }

    case 'market_trap': {
      // 概念图同款：带铁刺的假冒保健床垫 ("FAKE HEALTH MATTRESS")
      const spikes = 12;
      ctx.fillStyle = '#ADB5BD';
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-7, -28);
        ctx.lineTo(0, -44);
        ctx.lineTo(7, -28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#FF9F1C';
      ctx.fillRect(-28, -24, 56, 48);
      ctx.strokeRect(-28, -24, 56, 48);

      ctx.fillStyle = '#111';
      ctx.font = '900 10px "Impact", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FAKE床垫', 0, -4);
      ctx.fillText('-999元', 0, 12);
      break;
    }

    case 'cyber_egg': {
      // 概念图同款：电路板纹理霓虹赛博鸡蛋
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 20;
      const cGrad = ctx.createRadialGradient(-6, -10, 4, 0, 0, 32);
      cGrad.addColorStop(0, '#00F5D4');
      cGrad.addColorStop(0.55, '#7B2CBF');
      cGrad.addColorStop(1, '#240046');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 31, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 发光电路纹理
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, -14);
      ctx.lineTo(0, -4);
      ctx.lineTo(12, -4);
      ctx.moveTo(-12, 8);
      ctx.lineTo(4, 8);
      ctx.lineTo(10, 18);
      ctx.stroke();
      break;
    }

    case 'cyber_box': {
      // 概念图同款：-100% FREE 喜加一发光游戏礼盒
      ctx.shadowColor = '#CCFF00';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#1B4332';
      ctx.strokeStyle = '#CCFF00';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-26, -24, 52, 48, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#CCFF00';
      ctx.font = '900 13px "Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('-100%', 0, -3);
      ctx.fillText('FREE', 0, 14);
      break;
    }

    case 'cyber_token': {
      // 算力免费 Token 金币
      ctx.shadowColor = '#FFBE0B';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#FFBE0B';
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF9F1C';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'cyber_trap': {
      // 99.99% 捆绑全家桶错误弹窗炸弹
      ctx.fillStyle = '#D4D0C8';
      ctx.fillRect(-34, -24, 68, 48);
      ctx.strokeRect(-34, -24, 68, 48);

      ctx.fillStyle = '#0A246A';
      ctx.fillRect(-34, -24, 68, 13);

      ctx.fillStyle = '#E63946';
      ctx.beginPath();
      ctx.arc(-18, 4, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.font = '900 13px "Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('99.99%', 10, 9);
      break;
    }

    case 'shield_star': {
      // 消协彩色无敌护盾星
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00F0FF';
      drawFourPointStar(ctx, 0, 0, 28);
      ctx.fillStyle = '#111';
      ctx.font = '900 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('护盾', 0, 4);
      break;
    }
  }

  ctx.restore();
}
