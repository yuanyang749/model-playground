/**
 * 《隔代夺蛋：2026》四大《瓦里奥制造》式快节奏微操关卡控制器
 * Stage 1: 同屏走位接蛋 | Stage 2: 手撕99.99%套路弹窗 | Stage 3: 卷帘门vs小数点连点PK | Stage 4: 祖孙合体暴风吸入
 */

import { EXPR, drawStageItem } from './characters.js';

export const STAGE_CONFIGS = [
  {
    id: 1,
    code: 'STAGE 01',
    burstEn: 'FREE LOOT!!',
    burstZh: '白嫖狂欢!',
    title: '左右移动！接住免费好蛋！',
    sub: '方向键 ← → / A D / 鼠标移动同时控制祖孙，躲开带刺假床垫与弹窗炸弹！',
    duration: 15.0,
    bpm: 132
  },
  {
    id: 2,
    code: 'STAGE 02',
    burstEn: 'KILL POPUPS!',
    burstZh: '手撕套路!',
    title: '看准再点！叉掉弹窗抢鸡蛋！',
    sub: '点击绿色 [✕ 关闭] 撕碎 99.99% 传单弹窗，狂点暴露出来的免费鸡蛋！',
    duration: 15.0,
    bpm: 144
  },
  {
    id: 3,
    code: 'STAGE 03',
    burstEn: 'BREAK 99.99%!',
    burstZh: '拼手速!!',
    title: '疯狂连点！掀开卷帘门 & 砸碎99.99%！',
    sub: '狂按【空格键】或【鼠标左键连点】，用物理手速冲破最后 0.01% 套路壁垒！',
    duration: 12.0,
    bpm: 156
  },
  {
    id: 4,
    code: 'FINAL BOSS',
    burstEn: 'DNA AWAKENED!',
    burstZh: '祖孙合体!',
    title: '终极奥义：理解大妈，成为大妈！',
    sub: '分屏界限破碎！左右移动开启全屏【磁吸暴风吸入】，轰碎大数据杀熟BOSS！',
    duration: 14.0,
    bpm: 168
  }
];

export class StageController {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.spawnTimer = 0;
    this.waveCount = 0;

    // Stage 2 弹窗状态
    this.domPopups = [];
    this.domLootNodes = [];
    this.popupSpawnTimer = 0;

    // Stage 3 卷帘门与 99.99% 壁垒状态
    this.mashProgress = 0; // 0 ~ 100
    this.barrierBroken = false;
    this.decimalString = '99.99%';

    // Stage 4 Boss 状态
    this.bossHp = 100;
    this.bossX = 640;
  }

  enterStage(stageId) {
    this.items = [];
    this.spawnTimer = 0.2;
    this.waveCount = 0;
    this.clearDomLayer();

    const mashOverlay = document.getElementById('mash-overlay');
    if (mashOverlay) {
      mashOverlay.classList.toggle('hidden', stageId !== 3);
    }

    if (stageId === 1) {
      // 开场立即生成一批与概念效果图一致的标志性掉落物，画面瞬间饱满
      this.seedStage1InitialItems();
    } else if (stageId === 2) {
      this.popupSpawnTimer = 0.1;
      this.spawnStage2Wave();
    } else if (stageId === 3) {
      this.mashProgress = 18;
      this.barrierBroken = false;
      this.decimalString = '99.99%';
    } else if (stageId === 4) {
      this.bossHp = 100;
      this.bossX = 640;
      this.game.rig.setExpression(EXPR.AWAKENED, 15);
      this.seedStage4GalaxyItems();
    }
  }

  clearDomLayer() {
    const layer = document.getElementById('popup-layer');
    if (layer) layer.innerHTML = '';
    this.domPopups = [];
    this.domLootNodes = [];
  }

  /**
   * Stage 1 初始标志性掉落物排布 (复刻概念图构图)
   */
  seedStage1InitialItems() {
    const w = this.game.width;
    const mid = w * 0.5;
    this.items.push(
      // 左屏：黄金土鸡蛋、大白菜、满减红券、假保健床垫
      { side: 'left', kind: 'market_egg', x: 225, y: 120, vy: 155, vx: 0, rot: -0.1, vRot: 0.8, isTrap: false, score: 150, label: '+150 土鸡蛋!' },
      { side: 'left', kind: 'market_cabbage', x: 370, y: 95, vy: 165, vx: -10, rot: 0.2, vRot: -1.1, isTrap: false, score: 200, label: '+200 特价白菜!' },
      { side: 'left', kind: 'market_coupon', x: 140, y: 210, vy: 150, vx: 12, rot: -0.3, vRot: 1.5, isTrap: false, score: 100, label: '+100 满减神券!' },
      { side: 'left', kind: 'market_trap', x: 465, y: 175, vy: 170, vx: 0, rot: 0.15, vRot: 1.8, isTrap: true, label: '假床垫套路!' },
      // 右屏：赛博电路蛋、-100% FREE 喜加一礼盒、算力金币
      { side: 'right', kind: 'cyber_egg', x: mid + 240, y: 130, vy: 160, vx: 0, rot: 0.12, vRot: -0.9, isTrap: false, score: 200, label: '+200 赛博金蛋!' },
      { side: 'right', kind: 'cyber_box', x: mid + 145, y: 215, vy: 150, vx: 8, rot: -0.15, vRot: 0.7, isTrap: false, score: 500, label: '+500 喜加一!' },
      { side: 'right', kind: 'cyber_token', x: mid + 390, y: 85, vy: 175, vx: -12, rot: 0, vRot: 2.0, isTrap: false, score: 300, label: '+300 免费Token!' }
    );
  }

  seedStage4GalaxyItems() {
    for (let i = 0; i < 10; i++) {
      this.spawnBossLoot(true);
    }
  }

  update(dt, stageId, time) {
    if (stageId === 1) {
      this.updateStage1(dt, time);
    } else if (stageId === 2) {
      this.updateStage2(dt, time);
    } else if (stageId === 3) {
      this.updateStage3(dt, time);
    } else if (stageId === 4) {
      this.updateStage4(dt, time);
    }
  }

  // =========================================================================
  // Stage 1: 《天降甘霖·同屏走位接蛋》
  // =========================================================================
  updateStage1(dt, time) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.game.isFever ? 0.42 : 0.62;
      this.waveCount++;
      this.spawnStage1Pair();
    }

    this.updateFallingItems(dt, false);
  }

  spawnStage1Pair() {
    const w = this.game.width;
    const mid = w * 0.5;
    const leftPool = ['market_egg', 'market_egg', 'market_cabbage', 'market_coupon'];
    const rightPool = ['cyber_egg', 'cyber_egg', 'cyber_box', 'cyber_token'];

    // 每隔几波生成消协护盾星或错位陷阱
    const isTrapWave = this.waveCount % 3 === 0;
    const trapOnLeft = (this.waveCount % 2 === 0);

    const normLaneLeft = 0.16 + Math.random() * 0.68;
    const normLaneRight = isTrapWave ? (1 - normLaneLeft) : normLaneLeft;

    const lx = 55 + normLaneLeft * (mid - 125);
    const rx = mid + 65 + normLaneRight * (mid - 125);

    if (this.waveCount === 4 || this.waveCount === 11) {
      this.items.push({
        side: 'left',
        kind: 'shield_star',
        x: lx,
        y: -25,
        vy: 190,
        vx: 0,
        rot: 0,
        vRot: 2.5,
        isTrap: false,
        isShield: true,
        score: 250,
        label: '315消协护盾!'
      });
    } else {
      const leftTrap = isTrapWave && trapOnLeft && !this.game.isFever;
      const lKind = leftTrap ? 'market_trap' : leftPool[Math.floor(Math.random() * leftPool.length)];
      this.items.push({
        side: 'left',
        kind: lKind,
        x: lx,
        y: -30,
        vy: 175 + Math.random() * 55,
        vx: (Math.random() - 0.5) * 24,
        rot: (Math.random() - 0.5) * 0.3,
        vRot: (Math.random() - 0.5) * 2.2,
        isTrap: leftTrap,
        score: lKind === 'market_cabbage' ? 200 : 150,
        label: leftTrap ? '假床垫刺客!' : '+150 领土鸡蛋!'
      });
    }

    const rightTrap = isTrapWave && !trapOnLeft && !this.game.isFever;
    const rKind = rightTrap ? 'cyber_trap' : rightPool[Math.floor(Math.random() * rightPool.length)];
    this.items.push({
      side: 'right',
      kind: rKind,
      x: rx,
      y: -30,
      vy: 180 + Math.random() * 55,
      vx: (Math.random() - 0.5) * 24,
      rot: (Math.random() - 0.5) * 0.3,
      vRot: (Math.random() - 0.5) * 2.2,
      isTrap: rightTrap,
      score: rKind === 'cyber_box' ? 500 : 200,
      label: rightTrap ? '全家桶套路!' : (rKind === 'cyber_box' ? '+500 喜加一!' : '+200 赛博蛋!')
    });
  }

  updateFallingItems(dt, magnetMode = false) {
    const pos = this.game.rig.getPositions(this.game.width, this.game.height, magnetMode);

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];

      // Stage 4 磁吸暴风吸入效果
      if (magnetMode && !it.isTrap) {
        const targetX = pos.mergedX;
        const targetY = pos.baseY - 110;
        const dx = targetX - it.x;
        const dy = targetY - it.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 460) {
          it.vx += (dx / dist) * 1450 * dt;
          it.vy += (dy / dist) * 1450 * dt;
        }
      }

      it.x += (it.vx || 0) * dt;
      it.y += it.vy * dt;
      it.rot = (it.rot || 0) + (it.vRot || 0) * dt;

      // 碰撞检测
      let caught = false;
      for (const cp of pos.catchPoints) {
        if (!magnetMode && cp.side !== it.side) continue;
        const dist = Math.hypot(it.x - cp.x, it.y - cp.y);
        if (dist < cp.r) {
          caught = true;
          this.handleItemCaught(it);
          break;
        }
      }

      if (caught || it.y > this.game.height + 50) {
        this.items.splice(i, 1);
      }
    }
  }

  handleItemCaught(it) {
    if (it.isShield) {
      this.game.rig.shieldTimer = 5.0;
      this.game.addScore(it.score, it.x, it.y, '315消协护盾无敌!', '#00F0FF');
      return;
    }

    if (it.isTrap) {
      if (this.game.rig.shieldTimer > 0) {
        // 护盾反杀陷阱！
        this.game.addScore(350, it.x, it.y, '护盾反杀套路 +350!', '#CCFF00');
      } else {
        this.game.triggerTrapPenalty(it.x, it.y, it.label || '被套路了!');
      }
    } else {
      const bonus = this.game.isFever ? it.score * 2 : it.score;
      const color = it.side === 'left' ? '#FFBE0B' : '#CCFF00';
      this.game.addScore(bonus, it.x, it.y, it.label || `+${bonus}!`, color);
      this.game.eggsCollected++;
    }
  }

  // =========================================================================
  // Stage 2: 《火眼金睛·手撕套路弹窗》 (DOM 流氓弹窗 + 底层免费鸡蛋)
  // =========================================================================
  updateStage2(dt, time) {
    this.popupSpawnTimer -= dt;
    if (this.popupSpawnTimer <= 0) {
      this.popupSpawnTimer = 2.1;
      if (this.domPopups.length < 6) {
        this.spawnSingleRoguePopup(Math.random() < 0.5 ? 'left' : 'right');
      }
      if (this.domLootNodes.length < 4) {
        this.spawnStage2LootNode(Math.random() < 0.5 ? 'left' : 'right');
      }
    }

    // 背景依然有少量鸡蛋飘落烘托气氛
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.9;
      this.spawnStage1Pair();
    }
    this.updateFallingItems(dt, false);
  }

  spawnStage2Wave() {
    this.spawnStage2LootNode('left');
    this.spawnStage2LootNode('right');
    this.spawnStage2LootNode('left');
    this.spawnStage2LootNode('right');
    this.spawnSingleRoguePopup('left');
    this.spawnSingleRoguePopup('right');
    this.spawnSingleRoguePopup('right');
  }

  spawnStage2LootNode(side) {
    const layer = document.getElementById('popup-layer');
    if (!layer) return;

    const node = document.createElement('button');
    node.className = `loot-egg-node ${side === 'left' ? 'market-loot' : 'cyber-loot'}`;
    const leftPct = side === 'left' ? (8 + Math.random() * 30) : (56 + Math.random() * 28);
    const topPct = 18 + Math.random() * 48;
    node.style.left = `${leftPct}%`;
    node.style.top = `${topPct}%`;

    const eggSvg = `<svg class="popup-svg-icon" viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="8" ry="10" fill="#FFF3B0" stroke="#111" stroke-width="2.5"/></svg>`;
    const boxSvg = `<svg class="popup-svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="#1B4332" stroke="#111" stroke-width="2.5"/><path d="M3,10 H21 M12,3 V21" stroke="#CCFF00" stroke-width="2.5"/></svg>`;

    node.innerHTML = side === 'left'
      ? `${eggSvg}<span>免费领2斤土鸡蛋!</span>`
      : `${boxSvg}<span>喜加一 -100% 免费入库!</span>`;

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = node.getBoundingClientRect();
      const stageRect = layer.getBoundingClientRect();
      const cx = ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * this.game.width;
      const cy = ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * this.game.height;

      this.game.eggsCollected++;
      this.game.addScore(400, cx, cy, side === 'left' ? '+400 鸡蛋到手!' : '+400 喜加一入库!', '#CCFF00');
      node.remove();
      this.domLootNodes = this.domLootNodes.filter((n) => n !== node);
      setTimeout(() => {
        if (this.game.currentStageIndex === 1) {
          this.spawnStage2LootNode(side);
        }
      }, 350);
    });

    layer.appendChild(node);
    this.domLootNodes.push(node);
  }

  spawnSingleRoguePopup(side) {
    const layer = document.getElementById('popup-layer');
    if (!layer) return;

    const popup = document.createElement('div');
    const isLeft = side === 'left';
    popup.className = `rogue-popup ${isLeft ? 'market-flyer' : 'cyber-popup'}`;

    const leftPct = isLeft ? (6 + Math.random() * 24) : (54 + Math.random() * 24);
    const topPct = 14 + Math.random() * 42;
    popup.style.left = `${leftPct}%`;
    popup.style.top = `${topPct}%`;

    const closeIconSvg = `<svg class="popup-svg-icon" viewBox="0 0 18 18" style="width:13px;height:13px;margin-right:3px;"><path d="M3,3 L15,15 M15,3 L3,15" stroke="#111" stroke-width="3" stroke-linecap="round"/></svg>`;
    const hornSvg = `<svg class="popup-svg-icon" viewBox="0 0 24 24"><polygon points="3,9 9,9 17,4 17,20 9,15 3,15" fill="#FFBE0B" stroke="#111" stroke-width="2.2"/></svg>`;
    const warnSvg = `<svg class="popup-svg-icon" viewBox="0 0 24 24"><polygon points="12,2 22,20 2,20" fill="#FFBE0B" stroke="#111" stroke-width="2.2"/><rect x="11" y="8" width="2" height="6" fill="#111"/><circle cx="12" cy="17" r="1.4" fill="#111"/></svg>`;

    if (isLeft) {
      popup.innerHTML = `
        <div class="flyer-header">
          <span>${hornSvg}祖传磁疗神床促销</span>
          <button class="btn-real-close" title="撕碎传单">${closeIconSvg}撕掉</button>
        </div>
        <div class="flyer-body">
          <div class="flyer-headline">99.99% 包治百病!</div>
          <div class="win-desc">仅需预存 9998 元即可免费领鸡蛋1颗</div>
          <div class="popup-btn-row">
            <button class="btn-trap">立即掏钱</button>
            <button class="btn-real-close">${closeIconSvg}不听忽悠</button>
          </div>
        </div>
      `;
    } else {
      popup.innerHTML = `
        <div class="win-titlebar">
          <span>${warnSvg}Computer Error - 砍一刀</span>
          <button class="btn-real-close" title="关闭弹窗">${closeIconSvg}关闭</button>
        </div>
        <div class="win-body">
          <div class="win-pct">进度 99.99%</div>
          <div class="win-desc">仅差 0.001 钻石！默认勾选连续包月</div>
          <div class="popup-btn-row">
            <button class="btn-trap">自动续费领奖</button>
            <button class="btn-real-close">${closeIconSvg}残忍拒绝</button>
          </div>
        </div>
      `;
    }

    // 绑定真关闭按钮事件
    popup.querySelectorAll('.btn-real-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.smashPopupElement(popup);
      });
    });

    // 绑定假按钮陷阱事件
    popup.querySelectorAll('.btn-trap').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stageRect = layer.getBoundingClientRect();
        const rect = popup.getBoundingClientRect();
        const cx = ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * this.game.width;
        const cy = ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * this.game.height;
        this.game.triggerTrapPenalty(cx, cy, '点中套路按钮!');
        if (this.domPopups.length < 7) {
          this.spawnSingleRoguePopup(side);
        }
      });
    });

    layer.appendChild(popup);
    this.domPopups.push(popup);
  }

  smashPopupElement(popup) {
    const layer = document.getElementById('popup-layer');
    if (!layer || !popup.parentNode) return;
    const stageRect = layer.getBoundingClientRect();
    const rect = popup.getBoundingClientRect();
    const cx = ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * this.game.width;
    const cy = ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * this.game.height;

    this.game.popupsSmashed++;
    this.game.audio.playPopupClose();
    this.game.addScore(280, cx, cy, '手撕套路 +280!', '#00F0FF');
    popup.remove();
    this.domPopups = this.domPopups.filter((p) => p !== popup);
  }

  /**
   * 供键盘空格或自动化测试快速撕弹窗 & 领蛋
   */
  triggerQuickStage2Action() {
    if (this.domPopups.length > 0) {
      this.smashPopupElement(this.domPopups[0]);
    } else if (this.domLootNodes.length > 0) {
      this.domLootNodes[0].click();
    }
  }

  // =========================================================================
  // Stage 3: 《零点狂潮·卷帘门 vs 99.999%》 (疯狂连点突破壁垒)
  // =========================================================================
  updateStage3(dt, time) {
    if (!this.barrierBroken) {
      this.mashProgress = Math.max(8, this.mashProgress - dt * 9.5);
    } else {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.18;
        this.spawnStage1Pair();
      }
    }
    this.updateFallingItems(dt, true);
  }

  handleMashInput() {
    if (this.game.currentStageIndex !== 2) return;
    this.game.rig.triggerMashBounce();

    if (this.barrierBroken) {
      this.game.addScore(180, 640 + (Math.random() - 0.5) * 400, 260, '+180 秒杀暴击!', '#CCFF00');
      return;
    }

    this.mashProgress = Math.min(100, this.mashProgress + 8.5);
    const ratio = this.mashProgress / 100;
    this.game.audio.playMashHit(ratio);

    if (this.mashProgress < 40) {
      this.decimalString = '99.9%';
    } else if (this.mashProgress < 65) {
      this.decimalString = '99.99%';
    } else if (this.mashProgress < 88) {
      this.decimalString = '99.999%';
    } else if (this.mashProgress < 100) {
      this.decimalString = '99.9999%';
    }

    this.game.addScore(
      120,
      320 + (Math.random() - 0.5) * 140,
      230,
      '大力掀门 +120!',
      '#FFBE0B'
    );
    this.game.effects.spawnPopText(
      960 + (Math.random() - 0.5) * 140,
      230,
      `重锤砸碎 ${this.decimalString}!`,
      '#00F0FF',
      0.9
    );

    if (this.mashProgress >= 100 && !this.barrierBroken) {
      this.barrierBroken = true;
      this.decimalString = '100% 秒杀成功!!';
      this.game.audio.playFeverFanfare();
      this.game.effects.triggerShake(18, 0.45);
      this.game.effects.triggerFlash('#CCFF00', 0.65);
      this.game.addScore(2000, 640, 220, '100% 破壁大爆奖 +2000!!', '#FFBE0B');
      for (let i = 0; i < 8; i++) {
        this.spawnStage1Pair();
      }
    }
  }

  // =========================================================================
  // Stage 4: 《血脉觉醒·多巴胺人神合一》 (全屏磁吸暴风吸入 + 轰碎大数据杀熟BOSS)
  // =========================================================================
  updateStage4(dt, time) {
    this.bossX = 640 + Math.sin(time * 2.2) * 320;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.16;
      this.spawnBossLoot(false);
    }

    this.updateFallingItems(dt, true);
  }

  spawnBossLoot(randomY = false) {
    const kinds = ['market_egg', 'market_cabbage', 'cyber_egg', 'cyber_box', 'cyber_token'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const x = 100 + Math.random() * (this.game.width - 200);
    const y = randomY ? (80 + Math.random() * 240) : 95;

    this.items.push({
      side: x < 640 ? 'left' : 'right',
      kind,
      x,
      y,
      vy: 190 + Math.random() * 90,
      vx: (Math.random() - 0.5) * 120,
      rot: Math.random() * Math.PI,
      vRot: (Math.random() - 0.5) * 4,
      isTrap: false,
      score: 300,
      label: '+300 传家宝入库!'
    });

    this.bossHp = Math.max(0, this.bossHp - 1.8);
  }

  // =========================================================================
  // 渲染各关卡专属前景与掉落物
  // =========================================================================
  render(ctx, width, height, stageId, time, isFever) {
    // Stage 1: 右侧背景绘制概念图同款层叠 Windows 99.99% 窗口装饰
    if (stageId === 1) {
      this.drawConceptCascadingWindows(ctx, width - 275, 195, time);
      this.drawConceptRetroDialog(ctx, width * 0.5 + 48, 128);
    }

    // 渲染所有掉落物
    for (const item of this.items) {
      drawStageItem(ctx, item, time, isFever);
    }

    // Stage 3: 渲染左屏早市铁皮卷帘门 & 右屏 99.999% 砍一刀水晶壁垒
    if (stageId === 3 && !this.barrierBroken) {
      this.renderStage3Barriers(ctx, width, height, time);
    }

    // Stage 4: 渲染顶部【大数据杀熟 BOSS】
    if (stageId === 4) {
      this.renderStage4Boss(ctx, width, height, time);
    }
  }

  /**
   * 复刻概念图右侧的层叠复古 Computer Error 99.99% 窗口群
   */
  drawConceptCascadingWindows(ctx, baseX, baseY, time) {
    for (let i = 0; i < 3; i++) {
      const wx = baseX + i * 18;
      const wy = baseY + i * 22 + Math.sin(time * 4 + i) * 3;
      const w = 195;
      const h = 112;

      ctx.save();
      ctx.fillStyle = '#D4D0C8';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 3.5;
      ctx.fillRect(wx, wy, w, h);
      ctx.strokeRect(wx, wy, w, h);

      // 蓝色标题栏
      ctx.fillStyle = '#1034A6';
      ctx.fillRect(wx + 2, wy + 2, w - 4, 22);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px "Tahoma", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Computer Error', wx + 8, wy + 17);

      // 标题栏小 [X]
      ctx.fillStyle = '#D4D0C8';
      ctx.fillRect(wx + w - 20, wy + 5, 14, 14);
      ctx.strokeRect(wx + w - 20, wy + 5, 14, 14);

      if (i === 2) {
        // 最前层显示红叉与 99.99%
        ctx.fillStyle = '#E63946';
        ctx.beginPath();
        ctx.arc(wx + 32, wy + 52, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wx + 26, wy + 46);
        ctx.lineTo(wx + 38, wy + 58);
        ctx.moveTo(wx + 38, wy + 46);
        ctx.lineTo(wx + 26, wy + 58);
        ctx.stroke();

        ctx.fillStyle = '#111111';
        ctx.font = '900 26px "Impact", "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('99.99%', wx + 115, wy + 60);

        // 底部按钮
        ctx.fillStyle = '#E0DDD5';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.fillRect(wx + 64, wy + 76, 68, 24);
        ctx.strokeRect(wx + 64, wy + 76, 68, 24);

        ctx.fillStyle = '#111';
        ctx.font = 'bold 11px "Tahoma", sans-serif';
        ctx.fillText('砍一刀', wx + 98, wy + 92);
      }
      ctx.restore();
    }
  }

  drawConceptRetroDialog(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#D4D0C8';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, 155, 86);
    ctx.strokeRect(x, y, 155, 86);

    ctx.fillStyle = '#1034A6';
    ctx.fillRect(x + 2, y + 2, 151, 16);

    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('发现免费算力鸡蛋!', x + 78, y + 42);

    ctx.fillStyle = '#E0DDD5';
    ctx.fillRect(x + 52, y + 56, 50, 20);
    ctx.strokeRect(x + 52, y + 56, 50, 20);
    ctx.fillStyle = '#111';
    ctx.fillText('OK', x + 77, y + 70);
    ctx.restore();
  }

  renderStage3Barriers(ctx, width, height, time) {
    const midX = width * 0.5;
    const ratio = this.mashProgress / 100;

    // 左屏：可被往上顶起的铁皮卷帘门
    const doorHeight = Math.max(40, (1 - ratio) * 280);
    ctx.save();
    ctx.fillStyle = '#6C757D';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.fillRect(40, 60, midX - 85, doorHeight);
    ctx.strokeRect(40, 60, midX - 85, doorHeight);

    // 卷帘门横条纹
    for (let y = 80; y < 60 + doorHeight - 15; y += 22) {
      ctx.beginPath();
      ctx.moveTo(44, y);
      ctx.lineTo(midX - 49, y);
      ctx.stroke();
    }

    // 卷帘门上的促销封条
    ctx.fillStyle = '#FFBE0B';
    ctx.fillRect(110, 60 + doorHeight - 52, 340, 42);
    ctx.strokeRect(110, 60 + doorHeight - 52, 340, 42);
    ctx.fillStyle = '#D90429';
    ctx.font = '900 21px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`▲ 早市卷帘门开启度: ${Math.floor(this.mashProgress)}%`, 280, 60 + doorHeight - 23);
    ctx.restore();

    // 右屏：巨大的 99.999% 砍一刀进度壁垒
    ctx.save();
    const bx = midX + 75;
    const by = 110;
    const bw = midX - 140;
    const bh = 160;

    ctx.fillStyle = '#240046';
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 5;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    // 进度条填充
    ctx.fillStyle = '#FF007F';
    ctx.fillRect(bx + 14, by + 92, (bw - 28) * Math.min(0.99, 0.85 + ratio * 0.14), 42);
    ctx.strokeRect(bx + 14, by + 92, bw - 28, 42);

    ctx.fillStyle = '#CCFF00';
    ctx.font = 'italic 900 38px "Impact", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`砍一刀进度: ${this.decimalString}`, bx + bw / 2, by + 62);
    ctx.restore();
  }

  renderStage4Boss(ctx, width, height, time) {
    ctx.save();
    ctx.translate(this.bossX, 95);

    ctx.fillStyle = '#FF0055';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.roundRect(-185, -38, 370, 76, 16);
    ctx.fill();
    ctx.stroke();

    // 绘制左侧赛博全视机械眼矢量图标 (替代原 Emoji)
    ctx.save();
    ctx.translate(-148, -8);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.arc(Math.sin(time * 5) * 4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 21px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('终极BOSS：大数据杀熟算法池', 16, -2);

    // 血条
    ctx.fillStyle = '#111';
    ctx.fillRect(-150, 12, 300, 14);
    ctx.fillStyle = '#CCFF00';
    ctx.fillRect(-148, 14, 296 * (this.bossHp / 100), 10);

    ctx.restore();
  }
}
