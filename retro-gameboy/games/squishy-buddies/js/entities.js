/* ==========================================================================
   Squishy Buddies 2006 - Character, Bubble & Monster Entities
   The 5 Color Droplet IP Roster + 5 Elemental Bubble Types
   ========================================================================== */

const BUDDY_TYPES = {
  YELLOW: {
    id: 0,
    name: '黄圆圆 (大黄)',
    role: '坚固重装',
    color: '#ffd454',
    dark: '#d89c20',
    highlight: '#fff3a8',
    blush: '#ff8a9a',
    radius: 13,
    gravity: 660,
    jumpPower: -260,
    speed: 105,
    bubbleType: 'SOLID'
  },
  BLUE: {
    id: 1,
    name: '蓝波波',
    role: '浮水气囊',
    color: '#75c8f8',
    dark: '#3896e8',
    highlight: '#bce4fd',
    blush: '#e88ab8',
    radius: 10.5,
    gravity: 520,
    jumpPower: -275,
    speed: 120,
    bubbleType: 'FLOAT'
  },
  PINK: {
    id: 2,
    name: '粉嘟嘟',
    role: '糖胶粘附',
    color: '#ff8cb8',
    dark: '#d85088',
    highlight: '#ffc4dc',
    blush: '#ff6088',
    radius: 9.5,
    gravity: 460,
    jumpPower: -285,
    speed: 125,
    bubbleType: 'STICKY'
  },
  GREEN: {
    id: 3,
    name: '绿萌萌',
    role: '高弹跳跃',
    color: '#70d8a8',
    dark: '#38a878',
    highlight: '#bcf4dc',
    blush: '#e88ab8',
    radius: 10,
    gravity: 560,
    jumpPower: -320,
    speed: 130,
    bubbleType: 'BOUNCY'
  },
  PURPLE: {
    id: 4,
    name: '紫灵灵',
    role: '星光裂变',
    color: '#b898ec',
    dark: '#8860c8',
    highlight: '#dec8f8',
    blush: '#e88ab8',
    radius: 8.5,
    gravity: 540,
    jumpPower: -280,
    speed: 140,
    bubbleType: 'CHAIN_POP'
  }
};

const BUDDY_KEYS = ['YELLOW', 'BLUE', 'PINK', 'GREEN', 'PURPLE'];

class PlayerBuddy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 for right, -1 for left
    this.onGround = false;
    this.isCrouched = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.onHazard = false;
    
    // Spring Squash & Stretch variables
    this.squashY = 1.0;
    this.squashX = 1.0;
    this.squashVelY = 0;
    this.targetSquashY = 1.0;

    // Active buddy selection (default Yellow)
    this.typeKey = 'YELLOW';
    this.type = BUDDY_TYPES[this.typeKey];
    this.radius = this.type.radius;
    this.gravity = this.type.gravity;

    // Follower buddies trail history for cute mochi parade
    this.trail = [];
    this.maxTrail = 60;

    // Cosmetic juice flags (read by the renderer / FX spawner, never by game logic)
    this.switchT = 1;        // seconds since the last buddy switch (drives the grow-pop)
    this.lastImpact = 0;     // 0..1 strength of the most recent landing
    this.justLanded = false;
    this.justJumped = false;

    // Animation & Emotion Timers
    this.blinkTimer = Math.random() * 3 + 2;
    this.isBlinking = false;
    this.walkCycle = 0;
    this.spitCooldown = 0;
  }

  setType(key) {
    const oldRadius = this.radius || 10;
    this.typeKey = key;
    this.type = BUDDY_TYPES[key];
    this.radius = this.type.radius;
    this.gravity = this.type.gravity;
    // Ground alignment when radius changes so character feet stay planted on floor
    if (this.onGround && this.radius > oldRadius) {
      this.y -= (this.radius - oldRadius) * (this.isCrouched ? 0.4 : 0.85);
    }
    // Pop switch spring
    this.squashY = 0.65;
    this.squashVelY = 14;
    this.switchT = 0;
  }

  nextBuddy() {
    const currIdx = BUDDY_KEYS.indexOf(this.typeKey);
    const nextIdx = (currIdx + 1) % BUDDY_KEYS.length;
    this.setType(BUDDY_KEYS[nextIdx]);
  }

  jump(input) {
    const isDownPressed = Boolean(this.isCrouched || (input && input.down));
    if (this.onGround && isDownPressed) {
      // Crouch + A -> Squishy Slide (俯冲滑行)!
      this.slide(input);
      return;
    }

    if (this.onGround && !this.isCrouched && !this.isSliding) {
      this.vy = this.type.jumpPower;
      this.onGround = false;
      this.squashY = 1.45; // Launch stretch
      this.squashVelY = -8;
      this.justJumped = true;
      if (window.squishyAudio) window.squishyAudio.playJump();
    }
  }

  slide(input) {
    if (input) {
      if (input.right) this.facing = 1;
      else if (input.left) this.facing = -1;
    }
    this.isSliding = true;
    this.slideTimer = 0.55; // 0.55s slide duration covers ~90px
    this.isCrouched = true;
    this.targetSquashY = 0.30; // Pressed extra flat
    this.squashY = 0.32;
    this.squashVelY = 8;
    const slideSpeed = Math.max(180, (this.type.speed || 120) * 1.4);
    this.vx = this.facing * slideSpeed;
    if (window.squishyAudio && window.squishyAudio.playSlide) {
      window.squishyAudio.playSlide();
    } else if (window.squishyAudio && window.squishyAudio.playJump) {
      window.squishyAudio.playJump();
    }
  }

  spitBubble() {
    if (this.spitCooldown > 0) return null;
    this.spitCooldown = 0.28;

    // Inhale & recoil
    this.squashY = 0.75;
    this.squashVelY = 10;
    this.vx -= this.facing * 35; // Slight physics recoil pushback!

    const bubbleX = this.x + this.facing * (this.radius + 12);
    const bubbleY = this.y - 2;
    const bubble = new BubbleEntity(bubbleX, bubbleY, this.facing, this.type.bubbleType, this.type);
    
    if (window.squishyAudio) window.squishyAudio.playSpit();
    return bubble;
  }

  update(dt, input, grid, audio) {
    // 1. Handle Cooldowns & Timers
    if (this.spitCooldown > 0) this.spitCooldown -= dt;
    if (this.switchT < 1) this.switchT += dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = !this.isBlinking;
      this.blinkTimer = this.isBlinking ? 0.12 : (Math.random() * 4 + 2);
    }
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // 2. Handle Inputs
    // Check if headroom is blocked by ceiling or crawlway
    let ceilingAbove = false;
    if (grid) {
      const standingHalfH = (this.radius || 10) * 0.85;
      const headRow = Math.floor((this.y - standingHalfH) / TILE_SIZE);
      const isSquished = this.isCrouched || this.isSliding;
      // When squished and moving horizontally toward an obstacle, look ahead into the tunnel entrance
      const lookahead = (isSquished && (input.right || (this.isSliding && this.facing === 1))) ? 8 : 
                        ((isSquished && (input.left || (this.isSliding && this.facing === -1))) ? -8 : 0);
      const checkX = this.x + lookahead;
      const leftCol = Math.floor((Math.min(this.x, checkX) - this.radius * 0.7) / TILE_SIZE);
      const rightCol = Math.floor((Math.max(this.x, checkX) + this.radius * 0.7) / TILE_SIZE);
      if (headRow >= 0 && headRow < GRID_ROWS) {
        for (let c = Math.max(0, leftCol); c <= Math.min(GRID_COLS - 1, rightCol); c++) {
          const t = grid[headRow][c];
          if (t === T_SOLID || t === T_CRAWLWAY || t === T_GATE || t === T_CRACKED) {
            ceilingAbove = true;
            break;
          }
        }
      }
    }

    const wantsCrouch = Boolean(input.down || ceilingAbove || this.isSliding);
    if (wantsCrouch !== this.isCrouched) {
      const standingHalfH = (this.radius || 10) * 0.85;
      const crouchHalfH = (this.radius || 10) * 0.4;
      const diff = standingHalfH - crouchHalfH;
      if (wantsCrouch) {
        if (this.onGround) this.y += diff;
        this.isCrouched = true;
      } else if (!ceilingAbove) {
        if (this.onGround) this.y -= diff;
        this.isCrouched = false;
      }
    }

    if (this.isSliding) {
      this.targetSquashY = 0.30; // Pressed extra flat during slide
      const slideSpeed = Math.max(180, (this.type.speed || 120) * 1.4);
      const progress = Math.max(0, this.slideTimer / 0.55);
      this.vx = this.facing * (slideSpeed * (0.65 + 0.35 * progress));
    } else if (this.isCrouched) {
      this.targetSquashY = 0.38; // Pressed flat into a thin pancake
      this.vx *= 0.85; // Slower glide
    } else {
      // Airborne: stretch along the direction of travel (faster = longer jelly)
      this.targetSquashY = this.onGround ? 1.0 : 1.0 + Math.min(0.3, Math.abs(this.vy) / 1000);
    }

    if (!this.isSliding) {
      if (input.left) {
        this.facing = -1;
        this.vx = -this.type.speed * (this.isCrouched ? 0.5 : 1);
        this.walkCycle += dt * 14;
      } else if (input.right) {
        this.facing = 1;
        this.vx = this.type.speed * (this.isCrouched ? 0.5 : 1);
        this.walkCycle += dt * 14;
      } else {
        this.vx *= 0.7; // Smooth damping
      }
    }

    // Walking rhythmic mini-squash (bouncy roll gait)
    if (this.onGround && Math.abs(this.vx) > 10 && !this.isCrouched && !this.isSliding) {
      this.targetSquashY = 1.0 + Math.sin(this.walkCycle) * 0.12;
    }

    const wasOnGround = this.onGround;
    const preVy = this.vy; // fall speed right before touching down (drives squash depth)

    // 3. Tile Move & Physics
    Physics.resolveTileMove(this, grid, dt);

    // Cancel slide if blocked by solid wall
    if (this.isSliding && Math.abs(this.vx) < 1.0) {
      this.isSliding = false;
      this.slideTimer = 0;
    }

    // Landing impact detection: harder falls squash deeper and wobble harder
    if (!wasOnGround && this.onGround) {
      const impact = Math.max(0, Math.min(1, preVy / 520));
      if (preVy > 40) {
        this.squashY = 0.78 - 0.28 * impact; // 0.78 (soft) .. 0.50 (hard slam)
        this.squashVelY = 6 + 8 * impact;
      }
      this.lastImpact = impact;
      this.justLanded = true;
      if (audio) audio.playLand();
    }

    // Update spring oscillator
    Physics.updateSquashSpring(this, dt);

    // 4. Save Trail History for Trailing Buddies
    const halfH = (this.radius || 10) * (this.isCrouched ? 0.4 : 0.85);
    this.trail.unshift({ x: this.x, y: this.y, facing: this.facing, feet: this.y + halfH });
    if (this.trail.length > this.maxTrail) this.trail.pop();
  }
}

class BubbleEntity {
  constructor(x, y, facing, type, buddyType) {
    this.x = x;
    this.y = y;
    this.vx = facing * 90;
    this.vy = -18; // Slight initial lift
    this.radius = 12;
    this.type = type; // 'SOLID', 'FLOAT', 'STICKY', 'BOUNCY', 'CHAIN_POP'
    this.buddyType = buddyType;
    this.alive = true;
    this.lifetime = 14; // seconds before fading
    this.age = 0;
    this.isStuck = false;
    this.wobble = Math.random() * Math.PI * 2;
    this.jiggle = 0;     // cosmetic: trampoline / hit jelly jiggle (1 -> 0)
    this.popFx = false;  // cosmetic: set when the bubble pops by itself (timeout / spikes)
  }

  update(dt, grid, bubbles) {
    this.age += dt;
    this.wobble += dt * 5;
    if (this.jiggle > 0) this.jiggle = Math.max(0, this.jiggle - dt * 2.4);
    if (this.age > this.lifetime) {
      this.alive = false;
      this.popFx = true;
      return;
    }

    if (this.isStuck) return;

    // Behavior per bubble element
    if (this.type === 'FLOAT') {
      this.vy = Math.max(-45, this.vy - 35 * dt); // Floats upward like a balloon
      this.vx *= 0.95;
    } else if (this.type === 'BOUNCY') {
      this.vy += 80 * dt; // Slight gravity
    } else if (this.type === 'STICKY') {
      this.vx *= 0.9;
      this.vy *= 0.9;
    } else {
      this.vx *= 0.92;
      this.vy += 40 * dt;
    }

    const prevX = this.x;
    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collision with solid blocks
    const col = Math.floor(this.x / TILE_SIZE);
    const row = Math.floor(this.y / TILE_SIZE);
    const t = Physics.getTileAt(grid, this.x, this.y);

    if (t === T_SOLID || t === T_GATE) {
      if (this.type === 'STICKY') {
        // Glue onto the surface it touched (not buried inside the stone) so the buddy can really stand on it
        this.x = prevX;
        this.y = prevY;
        this.isStuck = true;
        this.vx = 0;
        this.vy = 0;
      } else if (this.type === 'SOLID') {
        this.x = prevX;
        this.y = prevY;
        this.vx = 0;
        this.vy = 0;
        this.isStuck = true; // Firmly docks as a stepping platform
      } else {
        this.vx = -this.vx * 0.5;
        this.vy = -this.vy * 0.5;
      }
    } else if (t === T_SPIKE) {
      this.alive = false; // Pops on spikes
      this.popFx = true;
    }

    // Screen bounds
    if (this.x < this.radius) { this.x = this.radius; this.vx = -this.vx; }
    if (this.x > CANVAS_W - this.radius) { this.x = CANVAS_W - this.radius; this.vx = -this.vx; }
    if (this.y < this.radius + 18) { this.y = this.radius + 18; this.vy = 0; }
    if (this.y > CANVAS_H - this.radius) { this.y = CANVAS_H - this.radius; this.vy = -this.vy * 0.4; }
  }
}

class DewDrop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 6;
    this.collected = false;
    this.sparkleTimer = Math.random() * Math.PI * 2;
  }

  update(dt, player, audio) {
    if (this.collected) return;
    this.sparkleTimer += dt * 4;

    if (Physics.checkCircle(this.x, this.y, this.radius, player.x, player.y, player.radius)) {
      this.collected = true;
      if (audio) audio.playDew();
    }
  }
}

class SludgeCreep {
  constructor(x, y, range = 60) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.range = range;
    this.vx = 25;
    this.radius = 8;
    this.alive = true;
    this.isEncased = false;
    this.encasedTimer = 0;
  }

  update(dt, grid) {
    if (!this.alive) return;

    if (this.isEncased) {
      this.y -= 25 * dt; // Encased sludge floats upwards harmlessly
      this.encasedTimer -= dt;
      if (this.y < 20 || this.encasedTimer <= 0) {
        this.alive = false;
      }
      return;
    }

    this.x += this.vx * dt;
    if (Math.abs(this.x - this.startX) > this.range) {
      this.vx = -this.vx;
    }
  }
}

class Particle {
  // opts (all optional, purely cosmetic): vx, vy, life, radius, gravity, drag, kind ('dot'|'dust'|'spark'|'star')
  constructor(x, y, color, opts) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 80 + 30;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd - 20;
    this.color = color;
    this.life = 0.35 + Math.random() * 0.2;
    this.maxLife = this.life;
    this.radius = Math.random() * 2.5 + 1.5;
    this.kind = 'dot';
    this.gravity = 120;
    this.drag = 0;
    if (opts) {
      for (const k in opts) this[k] = opts[k];
      this.maxLife = this.life;
    }
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt; // Gravity
    if (this.drag) {
      const f = Math.max(0, 1 - this.drag * dt);
      this.vx *= f;
      if (this.kind === 'dust') this.vy *= f;
    }
    this.life -= dt;
  }
}

// Expanding ring / shock ripple (cosmetic only)
class FxRing {
  constructor(x, y, color, r1 = 20, life = 0.4, lw = 1.6, flat = 1) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.r0 = 1.5;
    this.r1 = r1;
    this.life = life;
    this.maxLife = life;
    this.lw = lw;
    this.flat = flat; // 1 = circle, <1 = ground ellipse
  }

  update(dt) {
    this.life -= dt;
  }
}

class SludgeProjectile {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 6;
    this.alive = true;
    this.life = 3.5;
  }

  update(dt, grid) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vy += 220 * dt; // Gravity arc
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const col = Math.floor(this.x / TILE_SIZE);
    const row = Math.floor(this.y / TILE_SIZE);
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      const t = grid[row][col];
      if (t === T_SOLID || t === T_GATE || t === T_CRACKED) {
        this.alive = false;
      }
    }
    if (this.y > CANVAS_H - 12) this.alive = false;
  }
}

class SludgeShockwave {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.dir = dir; // -1 (left) or 1 (right)
    this.vx = dir * 115;
    this.width = 14;
    this.height = 10;
    this.alive = true;
    this.life = 1.5;
  }

  update(dt, grid) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.x += this.vx * dt;
    const col = Math.floor(this.x / TILE_SIZE);
    const row = Math.floor(this.y / TILE_SIZE);
    if (col < 0 || col >= GRID_COLS) {
      this.alive = false;
      return;
    }
    if (row >= 0 && row < GRID_ROWS && (grid[row][col] === T_SOLID || grid[row][col] === T_GATE)) {
      this.alive = false;
    }
  }
}

class SludgeBoss {
  constructor(x, y, hp = 10, opts = {}) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.radius = 24;
    this.hp = hp;
    this.maxHp = hp;
    this.variant = opts.variant || 'SLUDGE'; // 'SLUDGE' (Stage 1) or 'CRYSTAL' (Stage 2)
    this.name = opts.name || (this.variant === 'CRYSTAL' ? '霜晶魔偶' : '暗影巨霸');
    this.alive = true;
    this.facing = -1;
    this.vx = -35;
    this.vy = 0;
    this.onGround = true;
    this.state = 'PATROL'; // 'PATROL', 'CHARGE_SPIT', 'PREPARE_STOMP', 'JUMP_STOMP', 'HURT', 'DEFEATED'
    this.stateTimer = 1.8;
    this.hurtTimer = 0;
    this.isEncased = false;
    this.encasedTimer = 0;
    this.squashX = 1.0;
    this.squashY = 1.0;
    this.animTimer = 0;
    this.patrolRange = 65;
    this.defeatedTimer = 0;
  }

  takeDamage(amount = 1) {
    if (this.hurtTimer > 0 || !this.alive || this.state === 'DEFEATED') return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtTimer = 1.1;
    this.isEncased = false;
    this.squashY = 0.6;
    this.squashX = 1.4;

    this.vx = this.facing * -45;
    this.vy = -50;
    this.onGround = false;

    if (this.hp <= 0) {
      this.state = 'DEFEATED';
      this.defeatedTimer = 1.8;
      this.vx = 0;
      this.vy = -40;
    } else {
      this.state = 'HURT';
      this.stateTimer = 0.6;
    }
    return true;
  }

  update(dt, player, grid, audio, game) {
    if (!this.alive) return;
    this.animTimer += dt;

    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    const floorY = 220 - this.radius;
    const ceilingY = 28 + this.radius; // Buffer below Room 5 ceiling blocks and top HUD
    const GRAVITY = 450;

    // Defeated death animation with gravity fall
    if (this.state === 'DEFEATED') {
      this.defeatedTimer -= dt;
      this.squashX = 1.0 + Math.sin(this.animTimer * 28) * 0.22;
      this.squashY = 1.0 + Math.cos(this.animTimer * 28) * 0.22;
      if (this.y < floorY) {
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y < ceilingY) {
          this.y = ceilingY;
          if (this.vy < 0) this.vy = 0;
        }
        if (this.y >= floorY) {
          this.y = floorY;
          this.vy = 0;
        }
      }
      if (this.defeatedTimer <= 0) {
        this.alive = false;
      }
      return;
    }

    // Encased in Blue Float Bubble (harmless stun)
    if (this.isEncased) {
      this.encasedTimer -= dt;
      this.squashX = 1.0 + Math.sin(this.animTimer * 12) * 0.08;
      this.squashY = 1.0 - Math.sin(this.animTimer * 12) * 0.08;
      this.vx = 0;
      this.vy = 0;
      if (this.encasedTimer <= 0) {
        this.isEncased = false;
        this.state = 'PATROL';
        this.stateTimer = 1.5;
        this.onGround = false;
        if (audio && audio.playPop) audio.playPop();
      }
      return;
    }

    this.stateTimer -= dt;

    if (this.state === 'HURT') {
      if (this.stateTimer <= 0 && this.onGround) {
        this.state = 'PATROL';
        this.stateTimer = 1.6;
      }
    } else if (this.state === 'PATROL') {
      if (Math.random() < dt * 1.5) {
        this.facing = player.x < this.x ? -1 : 1;
      }
      const isCrystal = this.variant === 'CRYSTAL';
      const baseSpd = isCrystal ? 42 : 35;
      const rageSpd = isCrystal ? 62 : 55;
      const speed = (this.hp <= (isCrystal ? 4 : 2)) ? rageSpd : baseSpd;
      this.vx = this.facing * speed;

      if (Math.abs(this.x - this.startX) > this.patrolRange) {
        this.facing = this.x > this.startX ? -1 : 1;
        this.vx = this.facing * speed;
      }

      if (this.stateTimer <= 0) {
        const canStomp = isCrystal || (this.hp <= Math.ceil(this.maxHp * 0.6));
        if (canStomp && Math.random() < (isCrystal ? 0.52 : 0.45)) {
          this.state = 'PREPARE_STOMP';
          this.stateTimer = isCrystal ? 0.55 : 0.65;
          this.vx = 0;
          this.squashY = 0.55;
          this.squashX = 1.35;
        } else {
          this.state = 'CHARGE_SPIT';
          this.stateTimer = isCrystal ? 0.55 : 0.65;
          this.vx = 0;
          this.squashY = 0.7;
          this.squashX = 1.25;
          this.facing = player.x < this.x ? -1 : 1;
        }
      }
    } else if (this.state === 'CHARGE_SPIT') {
      this.squashY = 0.7 + Math.sin(this.animTimer * 30) * 0.08;
      this.squashX = 1.25 - Math.sin(this.animTimer * 30) * 0.08;
      if (this.stateTimer <= 0) {
        this.squashY = 1.35;
        this.squashX = 0.75;
        this.facing = player.x < this.x ? -1 : 1;

        const isCrystal = this.variant === 'CRYSTAL';
        const count = isCrystal ? (this.hp <= 4 ? 3 : 2) : ((this.hp <= 2) ? 2 : 1);
        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * (isCrystal ? 26 : 30);
          const targetX = player.x + spread;
          const dx = targetX - this.x;
          const spdX = Math.max(-130, Math.min(130, dx * 1.2));
          const spdY = -120 - Math.random() * 30;
          if (game && game.sludgeProjectiles) {
            game.sludgeProjectiles.push(new SludgeProjectile(this.x + this.facing * 18, this.y - 6, spdX, spdY));
          }
        }
        if (audio && audio.playSpit) audio.playSpit();

        this.state = 'PATROL';
        this.stateTimer = Math.max(1.2, (isCrystal ? 2.2 : 2.6) - (this.maxHp - this.hp) * 0.12);
      }
    } else if (this.state === 'PREPARE_STOMP') {
      this.squashY = 0.55 + Math.sin(this.animTimer * 20) * 0.06;
      this.squashX = 1.35;
      this.vx = 0;
      if (this.stateTimer <= 0) {
        this.state = 'JUMP_STOMP';
        // Controlled arcade leap velocity: apex stays safely at y≈142, well below HUD and ceiling
        this.vy = -220;
        this.squashY = 1.35;
        this.squashX = 0.75;
        this.onGround = false;
        this.vx = (player.x > this.x ? 1 : -1) * 45;
        if (audio && audio.playBossRoar) audio.playBossRoar();
      }
    }

    // Universal gravity whenever in air
    if (!this.onGround || this.y < floorY) {
      this.vy += GRAVITY * dt;
      if (this.vy > 0 && this.state === 'JUMP_STOMP') {
        this.squashY = 0.85;
      }
    } else {
      this.vy = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Strict ceiling boundary clamp - prevents ever leaving screen
    if (this.y < ceilingY) {
      this.y = ceilingY;
      if (this.vy < 0) {
        this.vy = 0;
      }
    }

    // Floor collision & landing logic
    if (this.y >= floorY) {
      this.y = floorY;
      this.vy = 0;
      const wasInAir = !this.onGround;
      this.onGround = true;

      if (this.state === 'JUMP_STOMP' && wasInAir) {
        this.squashY = 0.45;
        this.squashX = 1.45;
        this.state = 'PATROL';
        this.stateTimer = 1.6;

        if (audio && audio.playBossStomp) audio.playBossStomp();
        if (game) {
          game.screenShakeTimer = 0.35;
          game.vibrate([40, 60, 40]);
          if (typeof game.onBossLand === 'function') game.onBossLand(this, floorY + this.radius);
          if (game.sludgeShockwaves) {
            game.sludgeShockwaves.push(new SludgeShockwave(this.x - 12, floorY + this.radius - 8, -1));
            game.sludgeShockwaves.push(new SludgeShockwave(this.x + 12, floorY + this.radius - 8, 1));
          }
        }
      }
    } else {
      this.onGround = false;
    }

    this.squashX += (1.0 - this.squashX) * dt * 8;
    this.squashY += (1.0 - this.squashY) * dt * 8;

    const minX = 75;
    const maxX = 225;
    if (this.x < minX) { this.x = minX; this.facing = 1; }
    if (this.x > maxX) { this.x = maxX; this.facing = -1; }
  }
}
