/**
 * 《隔代夺蛋：2026》(Cyber Eggs: Generational Rush) 主游戏循环与轻量状态机
 * 包含：多巴胺浓度计控制器、瓦里奥制造式四关串烧调度、基因诊断书海报导出、以及自动化测试钩子
 */

import { audio } from './audio.js';
import { EffectsManager, drawDualStageBackground } from './effects.js';
import { DualCharacterRig, EXPR } from './characters.js';
import { StageController, STAGE_CONFIGS } from './stages.js';

class CyberEggsGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;   // 1280
    this.height = this.canvas.height; // 580

    this.audio = audio;
    this.effects = new EffectsManager();
    this.rig = new DualCharacterRig();
    this.stageCtrl = new StageController(this);

    // 游戏核心状态: 'MENU' | 'PLAYING' | 'RESULT'
    this.mode = 'MENU';
    this.currentStageIndex = 0;
    this.stageTimeLeft = STAGE_CONFIGS[0].duration;
    this.bannerTimer = 0;

    // 多巴胺与计分指标
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.feverPct = 35.0;
    this.isFever = false;
    this.feverTimer = 0;
    this.eggsCollected = 0;
    this.popupsSmashed = 0;

    // 输入状态
    this.keys = { left: false, right: false };
    this.elapsedTime = 0;
    this.lastFrameTime = performance.now();

    // 绑定 DOM 引用
    this.dom = {
      container: document.getElementById('game-container'),
      score: document.getElementById('hud-score'),
      combo: document.getElementById('hud-combo'),
      comboBurst: document.getElementById('hud-combo-burst'),
      feverPct: document.getElementById('hud-fever-pct'),
      feverFill: document.getElementById('hud-fever-fill'),
      feverPointer: document.getElementById('hud-fever-pointer'),
      burstEn: document.getElementById('hud-burst-en'),
      burstZh: document.getElementById('hud-burst-zh'),
      speechBurst: document.getElementById('hud-speech-burst'),
      timer: document.getElementById('hud-timer'),
      timerUnit: document.getElementById('hud-timer-unit'),
      grandmaAvatar: document.getElementById('hud-grandma-avatar'),
      grandsonAvatar: document.getElementById('hud-grandson-avatar'),
      stageBanner: document.getElementById('stage-banner'),
      bannerStageNum: document.getElementById('banner-stage-num'),
      bannerTitle: document.getElementById('banner-action-title'),
      bannerSub: document.getElementById('banner-sub-desc'),
      startScreen: document.getElementById('start-screen'),
      resultScreen: document.getElementById('result-screen'),
      startBtn: document.getElementById('start-btn'),
      restartBtn: document.getElementById('restart-btn'),
      exportPngBtn: document.getElementById('export-png-btn'),
      muteBtn: document.getElementById('mute-btn'),
      stageJumpBtn: document.getElementById('stage-jump-btn'),
      mashPromptBtn: document.getElementById('mash-prompt-btn')
    };

    // 初始化静态预览场景与事件
    this.stageCtrl.seedStage1InitialItems();
    this.bindEvents();
    this.syncHud();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.right = true;
      }
      if (e.code === 'Space') {
        if (this.mode === 'PLAYING') {
          e.preventDefault();
          if (this.currentStageIndex === 1) {
            this.stageCtrl.triggerQuickStage2Action();
          } else if (this.currentStageIndex === 2) {
            this.stageCtrl.handleMashInput();
          } else {
            this.rig.triggerMashBounce();
          }
        }
      }
      if (e.key === 'Tab') {
        if (this.mode === 'PLAYING') {
          e.preventDefault();
          this.nextStage();
        }
      }
      if (e.key === 'm' || e.key === 'M') {
        this.toggleAudioMute();
      }
      if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.right = false;
      }
    });

    // 鼠标/触控在画布上滑动时同步映射祖孙走位
    const handlePointerMove = (clientX) => {
      if (this.mode !== 'PLAYING') return;
      const rect = this.canvas.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      // 无论鼠标在左半屏还是右半屏，都映射到 0~1 的同构位置
      const halfRel = relX < 0.5 ? (relX * 2) : ((relX - 0.5) * 2);
      this.rig.setNormalizedX(halfRel);
    };

    this.canvas.addEventListener('pointermove', (e) => {
      handlePointerMove(e.clientX);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      handlePointerMove(e.clientX);
      if (this.mode === 'PLAYING' && this.currentStageIndex === 2) {
        this.stageCtrl.handleMashInput();
      }
    });

    if (this.dom.mashPromptBtn) {
      this.dom.mashPromptBtn.addEventListener('click', () => {
        this.stageCtrl.handleMashInput();
      });
    }

    this.dom.startBtn.addEventListener('click', () => this.startGame());
    this.dom.restartBtn.addEventListener('click', () => this.startGame());
    this.dom.exportPngBtn.addEventListener('click', () => this.exportDiagnosisPoster());
    this.dom.muteBtn.addEventListener('click', () => this.toggleAudioMute());
    this.dom.stageJumpBtn.addEventListener('click', () => {
      if (this.mode === 'PLAYING') {
        this.nextStage();
      } else {
        this.startGame();
      }
    });
  }

  toggleAudioMute() {
    const muted = this.audio.toggleMute();
    const labelEl = document.getElementById('mute-btn-label');
    const wavePath = document.getElementById('sound-wave-path');
    if (labelEl) {
      labelEl.textContent = muted ? '音效 OFF' : '音效 ON';
    }
    if (wavePath) {
      wavePath.style.display = muted ? 'none' : 'block';
    }
    if (!muted && this.mode === 'PLAYING') {
      const cfg = STAGE_CONFIGS[this.currentStageIndex];
      this.audio.startBGM(cfg.bpm);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.dom.container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  /**
   * 开启新一局《隔代夺蛋：2026》
   */
  startGame() {
    this.audio.init();
    this.mode = 'PLAYING';
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.feverPct = 28.0;
    this.isFever = false;
    this.feverTimer = 0;
    this.eggsCollected = 0;
    this.popupsSmashed = 0;

    this.dom.startScreen.classList.add('hidden');
    this.dom.resultScreen.classList.add('hidden');
    this.dom.container.classList.remove('fever-overdrive', 'withdraw-shock');

    this.loadStage(0);
  }

  loadStage(index) {
    if (index >= STAGE_CONFIGS.length) {
      this.finishGame();
      return;
    }

    this.currentStageIndex = index;
    const cfg = STAGE_CONFIGS[index];
    this.stageTimeLeft = cfg.duration;

    // 更新 HUD 中央爆炸口号与转场横幅
    this.dom.burstEn.textContent = cfg.burstEn;
    this.dom.burstZh.textContent = cfg.burstZh;
    this.triggerClassPop(this.dom.speechBurst, 'burst-pop');

    this.dom.bannerStageNum.textContent = cfg.code;
    this.dom.bannerTitle.textContent = cfg.title;
    this.dom.bannerSub.textContent = cfg.sub;
    this.dom.stageBanner.classList.remove('hidden');
    this.bannerTimer = 1.45;

    this.audio.playFeverFanfare();
    this.audio.startBGM(cfg.bpm);
    this.stageCtrl.enterStage(cfg.id);
    this.syncHud();
  }

  nextStage() {
    this.loadStage(this.currentStageIndex + 1);
  }

  /**
   * 获得好蛋/撕掉套路弹窗：注入多巴胺！
   */
  addScore(points, x, y, label = '+100!', color = '#CCFF00') {
    const mult = Math.min(8, Math.floor(1 + this.combo * 0.25));
    const finalPoints = points * mult;
    this.score += finalPoints;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    // 爬升多巴胺浓度
    this.feverPct = Math.min(99.9, this.feverPct + 7.2);
    if (this.feverPct >= 99.0 && !this.isFever) {
      this.activateFeverOverdrive();
    }

    this.audio.playPickup(this.combo, this.isFever);
    this.rig.setExpression(
      this.currentStageIndex === 3 ? EXPR.AWAKENED : EXPR.ECSTATIC,
      0.85
    );

    this.effects.spawnBurst(x, y);
    this.effects.spawnPopText(x, y - 16, label, color, 1.08);

    this.triggerClassPop(this.dom.score, 'score-pop');
    this.triggerClassPop(this.dom.comboBurst, 'combo-pop');
    this.triggerClassPop(
      x < this.width * 0.5 ? this.dom.grandmaAvatar : this.dom.grandsonAvatar,
      'pop-bounce'
    );

    this.syncHud();
  }

  activateFeverOverdrive() {
    this.isFever = true;
    this.feverTimer = 6.0;
    this.feverPct = 99.9;
    this.dom.container.classList.add('fever-overdrive');
    this.dom.burstEn.textContent = 'FEVER 99.9%!!';
    this.dom.burstZh.textContent = '多巴胺暴走!';
    this.triggerClassPop(this.dom.speechBurst, 'burst-pop');
    this.audio.playFeverFanfare();
    this.effects.triggerFlash('#FFBE0B', 0.45);
  }

  /**
   * 踩中套路陷阱：触发“多巴胺戒断”黑白反差与红温颜艺
   */
  triggerTrapPenalty(x, y, label = '被套路了!') {
    this.combo = 1;
    this.isFever = false;
    this.feverPct = Math.max(12.0, this.feverPct - 24.0);
    this.dom.container.classList.remove('fever-overdrive');

    // 0.35 秒黑白抽色反差滤镜
    this.dom.container.classList.add('withdraw-shock');
    setTimeout(() => {
      this.dom.container.classList.remove('withdraw-shock');
    }, 360);

    this.audio.playTrap();
    this.rig.setExpression(EXPR.SHOCKED, 0.9);
    this.effects.triggerShake(14, 0.32);
    this.effects.spawnBurst(x, y, ['#FF2A54', '#111111', '#FFFFFF'], 14);
    this.effects.spawnPopText(x, y - 14, `!! ${label}`, '#FF2A54', 1.15);

    this.syncHud();
  }

  triggerClassPop(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 180);
  }

  syncHud() {
    this.dom.score.textContent = this.score.toLocaleString('en-US');
    this.dom.combo.textContent = `x${this.combo}`;
    this.dom.feverPct.textContent = `${this.feverPct.toFixed(1)}%`;
    this.dom.feverFill.style.width = `${this.feverPct}%`;
    this.dom.feverPointer.style.left = `${this.feverPct}%`;
    this.dom.timer.textContent = `${Math.max(0, this.stageTimeLeft).toFixed(1)}s`;
    this.dom.timerUnit.classList.toggle('timer-danger', this.stageTimeLeft <= 4.0);
  }

  /**
   * 结算并生成《赛博领蛋多巴胺基因诊断书》
   */
  finishGame() {
    this.mode = 'RESULT';
    this.audio.stopBGM();
    this.audio.playFeverFanfare();
    this.stageCtrl.clearDomLayer();

    const mashOverlay = document.getElementById('mash-overlay');
    if (mashOverlay) mashOverlay.classList.add('hidden');
    this.dom.stageBanner.classList.add('hidden');

    // 计算与王大妈基因重合度与称号
    const dnaMatch = Math.min(99.99, (88 + Math.min(11.99, this.score / 8500))).toFixed(2);
    let stamp = '绝世赛博老太太';
    let comment = `“短短 60 秒内，你的大脑因为‘免费’二字分泌了相当于 3 顿火锅的多巴胺！你一共抢到了 ${this.eggsCollected} 份免费鸡蛋与喜加一大作，手撕了 ${this.popupsSmashed} 个 99.99% 套路弹窗。虽然抢到的游戏你可能一辈子不会打开，但你已经彻底成为了你曾经最不理解的早市大妈。”`;

    if (this.score >= 60000) {
      stamp = '传世多巴胺白嫖战神';
    } else if (this.score < 12000) {
      stamp = '善良的互联网大冤种';
      comment = `“你在菜市场和互联网的套路迷宫里稍微犹豫了一下，只抢到了 ${this.eggsCollected} 颗鸡蛋。记住王大妈的箴言：可以不吃，可以不玩，但只要写着 FREE 就绝不能放过！”`;
    }

    document.getElementById('result-stamp').textContent = stamp;
    document.getElementById('res-score').textContent = this.score.toLocaleString('en-US');
    document.getElementById('res-dna').textContent = `${dnaMatch}%`;
    document.getElementById('res-eggs').textContent = `${this.eggsCollected} 颗`;
    document.getElementById('res-popups').textContent = `${this.popupsSmashed} 个`;
    document.getElementById('res-comment').textContent = comment;

    this.dom.resultScreen.classList.remove('hidden');
  }

  /**
   * 一键导出波普漫画风《赛博领蛋基因诊断书》PNG 海报 (纯矢量图标，零 Emoji)
   */
  exportDiagnosisPoster() {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 800;
    outCanvas.height = 520;
    const c = outCanvas.getContext('2d');

    // 奶油多巴胺背景与粗黑框
    c.fillStyle = '#FFF8E7';
    c.fillRect(0, 0, 800, 520);
    c.strokeStyle = '#111111';
    c.lineWidth = 12;
    c.strokeRect(12, 12, 776, 496);

    // 顶部红底标题栏
    c.fillStyle = '#FF2A54';
    c.fillRect(24, 24, 752, 76);
    c.fillStyle = '#FFFFFF';
    c.font = '900 32px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.fillText('2026 赛博领蛋多巴胺基因诊断书', 400, 74);

    // 核心指标与左侧波普菱形子弹头
    const metrics = [
      { text: `多巴胺总积分：${this.score.toLocaleString('en-US')}`, color: '#111111', bullet: '#FFBE0B' },
      { text: `与王大妈基因重合度：${document.getElementById('res-dna').textContent}`, color: '#FF0055', bullet: '#FF007F' },
      { text: `囤积免费土鸡蛋 / 喜加一：${this.eggsCollected} 颗`, color: '#111111', bullet: '#06D6A0' },
      { text: `手撕 99.99% 套路弹窗：${this.popupsSmashed} 个`, color: '#111111', bullet: '#00F0FF' }
    ];

    c.font = '900 24px "PingFang SC", sans-serif';
    c.textAlign = 'left';
    metrics.forEach((m, idx) => {
      const my = 160 + idx * 50;
      c.fillStyle = m.bullet;
      c.strokeStyle = '#111111';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(68, my - 18);
      c.lineTo(80, my - 6);
      c.lineTo(68, my + 6);
      c.lineTo(56, my - 6);
      c.closePath();
      c.fill();
      c.stroke();

      c.fillStyle = m.color;
      c.fillText(m.text, 94, my);
    });

    // 印章
    c.save();
    c.translate(610, 210);
    c.rotate(0.15);
    c.strokeStyle = '#FF0055';
    c.lineWidth = 6;
    c.strokeRect(-125, -36, 250, 72);
    c.fillStyle = '#FF0055';
    c.font = '900 24px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.fillText(document.getElementById('result-stamp').textContent, 0, 9);
    c.restore();

    // 底部金句
    c.fillStyle = '#FFBE0B';
    c.fillRect(50, 355, 700, 110);
    c.strokeStyle = '#111';
    c.lineWidth = 4;
    c.strokeRect(50, 355, 700, 110);
    c.fillStyle = '#111';
    c.font = 'bold 18px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.fillText('“质疑大妈，理解大妈，成为大妈 —— 一代人有一代人的鸡蛋要领！”', 400, 405);
    c.fillText('《隔代夺蛋：2026 | Cyber Eggs: Generational Rush》', 400, 440);

    const link = document.createElement('a');
    link.download = `cyber-eggs-diagnosis-${this.score}.png`;
    link.href = outCanvas.toDataURL('image/png');
    link.click();
  }

  /**
   * 逻辑帧更新 (支持确定性步进 advanceTime)
   */
  update(dt) {
    this.elapsedTime += dt;

    // 键盘左右移动控制
    if (this.keys.left) {
      this.rig.moveBy(-0.92 * dt);
    }
    if (this.keys.right) {
      this.rig.moveBy(0.92 * dt);
    }

    if (this.mode === 'PLAYING') {
      // 转场大字横幅倒计时
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) {
          this.dom.stageBanner.classList.add('hidden');
        }
      }

      // Fever 暴走倒计时
      if (this.isFever) {
        this.feverTimer -= dt;
        if (this.feverTimer <= 0) {
          this.isFever = false;
          this.feverPct = 45.0;
          this.dom.container.classList.remove('fever-overdrive');
          const cfg = STAGE_CONFIGS[this.currentStageIndex];
          this.dom.burstEn.textContent = cfg.burstEn;
          this.dom.burstZh.textContent = cfg.burstZh;
        }
      }

      // 关卡倒计时
      this.stageTimeLeft -= dt;
      if (this.stageTimeLeft <= 0) {
        this.nextStage();
        return;
      }

      const stageId = STAGE_CONFIGS[this.currentStageIndex].id;
      this.stageCtrl.update(dt, stageId, this.elapsedTime);
      this.syncHud();
    }

    const isMerged = this.mode === 'PLAYING' && this.currentStageIndex === 3;
    this.rig.update(dt, this.isFever || isMerged);
    this.effects.update(dt);
  }

  /**
   * 渲染主舞台画面
   */
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // 屏幕震动偏移
    this.effects.applyShake(ctx);

    const isMerged = this.mode === 'PLAYING' && this.currentStageIndex === 3;
    const stageId = STAGE_CONFIGS[this.currentStageIndex]?.id || 1;

    // 1. 绘制双时空多巴胺背景与中央锯齿闪电分割线
    drawDualStageBackground(ctx, this.width, this.height, this.elapsedTime, isMerged, this.isFever);

    // 2. 绘制关卡掉落物、卷帘门/99.99%壁垒与复古装饰弹窗
    this.stageCtrl.render(ctx, this.width, this.height, stageId, this.elapsedTime, this.isFever);

    // 3. 绘制王大妈与大孙子矢量纸偶
    this.rig.render(ctx, this.width, this.height, this.elapsedTime, isMerged);

    // 4. 绘制多巴胺粒子与波普浮动文字 (+100 / +500! 等)
    this.effects.render(ctx, this.width, this.height);

    ctx.restore();
  }

  startLoop() {
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// 启动游戏实例并挂载测试与调试钩子
const game = new CyberEggsGame();
game.startLoop();
window.__game = game;

/**
 * 供自动化测试脚本推进确定性帧时间
 */
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) {
    game.update(1 / 60);
  }
  game.render();
};

/**
 * 供自动化测试读取当前游戏完整可读状态
 */
window.render_game_to_text = () => {
  const isMerged = game.mode === 'PLAYING' && game.currentStageIndex === 3;
  const pos = game.rig.getPositions(game.width, game.height, isMerged);
  return JSON.stringify({
    coordinateSystem: '1280x580 canvas, origin top-left (0,0), left half [0..640] = Grandma Market, right half [640..1280] = Grandson Cyber Room',
    mode: game.mode,
    stage: STAGE_CONFIGS[game.currentStageIndex]?.code || 'STAGE 01',
    stageTimeLeft: Number(game.stageTimeLeft.toFixed(2)),
    score: game.score,
    combo: game.combo,
    dopamineFeverPct: Number(game.feverPct.toFixed(1)),
    isFever: game.isFever,
    characters: {
      normX: Number(game.rig.normX.toFixed(3)),
      grandmaX: Math.round(pos.grandmaX),
      grandsonX: Math.round(pos.grandsonX),
      expression: game.rig.expression,
      shieldActive: game.rig.shieldTimer > 0
    },
    activeItems: game.stageCtrl.items.slice(0, 10).map((it) => ({
      side: it.side,
      kind: it.kind,
      x: Math.round(it.x),
      y: Math.round(it.y),
      isTrap: Boolean(it.isTrap)
    })),
    stage2DomPopups: game.stageCtrl.domPopups.length,
    stage3MashProgress: Math.round(game.stageCtrl.mashProgress),
    stage4BossHp: Math.round(game.stageCtrl.bossHp)
  });
};
