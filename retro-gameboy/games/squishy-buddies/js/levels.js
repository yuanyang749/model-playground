/* ==========================================================================
   Squishy Buddies 2006 - 5 Handcrafted Single-Screen Puzzle Rooms
   Chunky 16x12 Tile Grid Layout with Minimal Visual Clutter
   ========================================================================== */

const LEVELS = [
  // ================= ROOM 1: 初遇彩虹 (Rainbow Springs) =================
  // Staircase of floating blocks (+40px each) up to a 60px wall: spit a SOLID bubble mid-jump,
  // land on it and step onto the goal ledge. The fountain sits in a sealed chamber whose ONLY
  // door is the 2-tile gate (1,11)+(2,11) - collect all 3 dews to open it.
  {
    id: 1,
    title: 'ROOM 1: 初遇彩虹',
    hint: '按 A 跳跃，按 B 吐固化泡垫脚',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0 (Top wall)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1], // Row 1 (Gate, upper half of the 2-tile door)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 5, 1], // Row 2 (Gate, lower half - the only door; Goal inside)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], // Row 3 (Goal ledge, top y=60)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Row 4 (60px wall)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Row 5
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1], // Row 6 (Block 2, top y=120)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8 (Block 1, top y=160)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1], // Row 10 (Start shelf / right shelf)
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11 (Floor)
    ],
    dews: [
      { x: 90, y: 135 },
      { x: 160, y: 88 },
      { x: 250, y: 172 }
    ],
    sludges: []
  },

  // ================= ROOM 2: 浮力峡谷 (Floating Chasm) =================
  // Spike pit between the start cliff and the goal ledge: switch to Blue (蓝波波), ride a float
  // bubble up and hop onto the ledge. The fountain sits in a sealed chamber; its only door is
  // the 2-tile gate (2,11)+(3,11).
  {
    id: 2,
    title: 'ROOM 2: 浮力峡谷',
    hint: '按 SELECT 切蓝波波，乘浮水泡越深渊',
    playerStart: { x: 30, y: 150 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // Row 1 (Chamber roof)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1], // Row 2 (Gate, upper half of the 2-tile door)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 5, 1], // Row 3 (Gate, lower half - the only door; Goal inside)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], // Row 4 (Goal ledge, top y=80)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 5
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 7
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 8 (Start cliff, top y=160)
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 9
      [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1], // Row 10 (Spikes!)
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 118, y: 108 },
      { x: 158, y: 46 },
      { x: 205, y: 62 }
    ],
    sludges: []
  },

  // ================= ROOM 3: 绝壁粘附 (Sticky Ascent) =================
  // Towering vertical cliff! Switch to Pink (粉嘟嘟) to stick bubbles on wall
  {
    id: 3,
    title: 'ROOM 3: 绝壁粘附',
    hint: '切粉嘟嘟吐粘粘泡，沿绝壁梯级攀爬',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0 (Top ceiling)
      [1, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 1 (Upper half of the 2-tile gate - the only door)
      [1, 5, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 2 (Goal at col 1, Gate at col 3)
      [1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 3 (Ledge cols 1-4, Cliff at col 7)
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 4 (Towering middle cliff at col 7)
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 5
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8 (Base of cliff wall)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9 (Bottom archway connecting left and right)
      [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 10 (Left platform cols 0-4, Right platform cols 12-15)
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11 (Ground floor)
    ],
    dews: [
      { x: 175, y: 165 },
      { x: 175, y: 115 },
      { x: 175, y: 70 }
    ],
    sludges: []
  },

  // ================= ROOM 4: 弹跳苍穹 (Emerald Trampoline) =================
  // High ledge + narrow crawlway. Switch to Green for super bounce + down to squeeze
  {
    id: 4,
    title: 'ROOM 4: 弹跳苍穹',
    hint: '切绿萌萌高弹起飞，按【下+A】俯冲滑行钻缝！',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1], // Row 1
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 6, 5, 1], // Row 2 (3 = crawlway, 6 = gate, 5 = goal)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], // Row 3
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 4
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 5
      [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 10
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 110, y: 90 },
      { x: 190, y: 50 },
      { x: 235, y: 170 }
    ],
    sludges: []
  },

  // ================= ROOM 5: 五彩交响 (Chroma Symphony) =================
  // Boss arena. A staircase (shelf -> A -> B -> walkway, +40/+40/+20px) leads along the walkway to two
  // cracked rocks and the ancient 2-tile gate (3,12)+(4,12). The fountain is sealed in the chamber behind
  // the gate. Defeat the Titan: the gate opens, the rocks shatter and the way is clear.
  {
    id: 5,
    title: 'ROOM 5: 五彩交响',
    hint: '全员协同：破阻击怪，点亮彩虹终局！',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 1
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 2 (Chamber roof / lintel)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 1], // Row 3 (Gate upper half)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 6, 0, 5, 1], // Row 4 (7 = cracked rocks, Gate lower half, Goal)
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1], // Row 5 (Walkway, top y=100)
      [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6 (Step B, top y=120)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8 (Step A, top y=160)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 10
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 130, y: 95 },
      { x: 180, y: 150 },
      { x: 235, y: 60 }
    ],
    sludges: [],
    boss: { x: 190, y: 195, hp: 10 }
  },

  /* ==========================================================================
     STAGE 2: 星渊秘境 (Star-Abyss Sanctuary) — Dual-Slime Relay & Crystal Boss
     Rooms 6–10 require combining multiple slime abilities in sequence.
     ========================================================================== */

  // ================= ROOM 6: 星岩爆破 (Starlight Excavation) =================
  // Synergy: Yellow (SOLID step over 60px cliff) + Blue (FLOAT encase creep) + Purple (CHAIN_POP blast cracked rock)
  {
    id: 6,
    title: 'ROOM 6: 星岩爆破',
    hint: '二阶段开启！黄圆圆筑桥登高，紫灵灵引爆裂石开路！',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 1, 0, 0, 1], // Row 1 (Gate upper at col 11, solid lintel at col 12)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 7, 0, 5, 1], // Row 2 (Gate lower at col 11, Cracked rock at col 12, Goal at col 14)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], // Row 3 (Upper ledge, top y=60)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Row 4 (60px wall)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Row 5
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1], // Row 6 (Mid platform, top y=120)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8 (Low platform, top y=160)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1], // Row 10
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 90, y: 135 },
      { x: 160, y: 88 },
      { x: 250, y: 172 }
    ],
    sludges: [
      { x: 165, y: 212, range: 40 }
    ]
  },

  // ================= ROOM 7: 冰渊浮渡 (Cryo Float & Slide) =================
  // Synergy: Blue (FLOAT bubble elevator over spike chasm) + Squishy Slide (DOWN+A through narrow ice tunnel)
  {
    id: 7,
    title: 'ROOM 7: 冰渊浮渡',
    hint: '切蓝波波乘浮泡越过冰刺深渊，再俯冲滑行钻过冰洞！',
    playerStart: { x: 30, y: 150 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], // Row 1
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 6, 0, 0, 1], // Row 2 (Ice ceiling cols 10-11, Gate upper at col 12)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 6, 0, 5, 1], // Row 3 (Crawlway cols 10-11, Gate lower at col 12, Goal at col 14)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], // Row 4 (Goal ledge, top y=80)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 5
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 7
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 8 (Start cliff, top y=160)
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 9
      [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1], // Row 10 (Spikes)
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 118, y: 108 },
      { x: 158, y: 46 },
      { x: 190, y: 65 }
    ],
    sludges: []
  },

  // ================= ROOM 8: 绝壁双塔 (Twin Candy Towers) =================
  // Synergy: Pink (STICKY wall-climb up central spire) + Purple (CHAIN_POP shatter crystal seal behind gate)
  {
    id: 8,
    title: 'ROOM 8: 绝壁双塔',
    hint: '切粉嘟嘟粘附攀上高塔顶层，再切紫灵灵炸开圣殿晶石！',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 1, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 1 (Solid lintel at col 2, Gate upper at col 3)
      [1, 5, 7, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 2 (Goal at col 1, Cracked crystal at col 2, Gate lower at col 3)
      [1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 3
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 4
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 5
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 10
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 175, y: 165 },
      { x: 175, y: 115 },
      { x: 175, y: 70 }
    ],
    sludges: []
  },

  // ================= ROOM 9: 翡翠云梯 (Emerald Skyway) =================
  // Synergy: Green (BOUNCY high-jump across sky islands) + Crawlway Slide + Purple (CHAIN_POP crystal breaker)
  {
    id: 9,
    title: 'ROOM 9: 翡翠云梯',
    hint: '绿萌萌高弹跃上云端钻过窄道，紫灵灵爆破终门封印！',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1], // Row 1
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 6, 7, 5, 1], // Row 2 (Crawlway cols 10-11, Gate col 12, Cracked col 13, Goal col 14)
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], // Row 3
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 4
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 5
      [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 10
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 110, y: 90 },
      { x: 190, y: 50 },
      { x: 235, y: 170 }
    ],
    sludges: []
  },

  // ================= ROOM 10: 终焉晶核 (Frost-Crystal Core Boss) =================
  // Stage 2 Final Boss: 霜晶魔偶 (Crystal Golem, 12 HP, variant: 'CRYSTAL')
  {
    id: 10,
    title: 'ROOM 10: 终焉晶核',
    hint: '终极决战【霜晶魔偶】：蓝泡冰封定身，紫泡爆破，踩头暴击！',
    playerStart: { x: 30, y: 190 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 1
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 2
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 1], // Row 3
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 6, 0, 5, 1], // Row 4
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1], // Row 5
      [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7
      [1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 8
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 9
      [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], // Row 10
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 11
    ],
    dews: [
      { x: 130, y: 95 },
      { x: 180, y: 150 },
      { x: 235, y: 60 }
    ],
    sludges: [],
    boss: { x: 190, y: 195, hp: 12, variant: 'CRYSTAL', name: '霜晶魔偶' }
  }
];
