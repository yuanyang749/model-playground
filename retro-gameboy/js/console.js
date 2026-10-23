/* ==========================================================================
   Antigravity Game Boy Console OS & Hardware Bridging Controller
   Authentic DMG-01 Multi-Cart & Hardware Utility Integration
   ========================================================================== */

class GameBoyConsole {
  constructor() {
    this.powerOn = true;
    this.audioCtx = null;
    this.currentCartridge = 'tank-battle';
    this.paletteMode = 'true'; // 'true' (原彩无扫描线), 'color' (复古扫描线), 'dmg', 'bw'
    this.inMenu = true; // Authentic Game Boy starts at the Multi-Cartridge game list!
    this.menuIndex = 0;
    this.games = ['tank-battle', 'space-invaders', 'tetris', 'squishy-buddies', 'tutorial'];
    this.pressedKeys = new Set();
    
    // Core Hardware Elements
    this.iframe = document.getElementById('game-screen');
    this.screenFrame = document.getElementById('gb-screen-frame');
    this.batteryLed = document.getElementById('battery-led');
    this.screenOff = document.getElementById('screen-off-overlay');
    this.menuView = document.getElementById('gb-menu-view');
    this.inGameMenuBtn = document.getElementById('in-game-menu-btn');
    this.paletteLabel = document.getElementById('palette-label');
    
    // Utility Buttons
    this.btnPower = document.getElementById('btn-power') || document.getElementById('top-btn-power');
    this.btnPalette = document.getElementById('btn-palette') || document.getElementById('top-btn-palette');
    this.btnFullscreen = document.getElementById('btn-fullscreen') || document.getElementById('top-btn-fullscreen');

    this.activeTouchDir = null;

    this.initAudio();
    this.initHardwareButtons();
    this.initDpadTouchSliding();
    this.initKeyboardBridge();
    this.initMenuView();
    this.initUtilityDock();

    // Boot up with authentic Game Boy chime
    this.playBootChime();

    // Auto-launch cartridge if ?game=<id> is provided in URL
    const reqGame = (typeof URLSearchParams !== 'undefined' && window.location && window.location.search)
      ? new URLSearchParams(window.location.search).get('game')
      : null;
    if (reqGame && this.games.includes(reqGame)) {
      this.menuIndex = this.games.indexOf(reqGame);
      this.updateMenuSelection();
      this.loadCartridge(reqGame);
    }
  }

  /* ================= 8-Bit Web Audio Engine ================= */
  initAudio() {
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Authentic DMG-01 "ba-ding!" Chime
  playBootChime() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    
    // Step 1: Fast ascending chromatic slide
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.linearRampToValueAtTime(1046.50, now + 0.18); // C6
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.linearRampToValueAtTime(0, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(this.audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.19);

    // Step 2: High crystalline chime bell
    const osc2 = this.audioCtx.createOscillator();
    const gain2 = this.audioCtx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2093, now + 0.20); // C7
    gain2.gain.setValueAtTime(0.22, now + 0.20);
    gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.70);
    osc2.connect(gain2);
    gain2.connect(this.audioCtx.destination);
    osc2.start(now + 0.20);
    osc2.stop(now + 0.72);
  }

  // 8-bit Menu Navigation Blip
  playMenuBlip() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 8-bit Game Launch Start Sound
  playGameStartSound() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1760, now + 0.06);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  vibrate(ms = 8) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  /* ================= Game Boy Menu List Operations ================= */
  initMenuView() {
    const items = document.querySelectorAll('.menu-item');
    items.forEach((item, index) => {
      const selectAndLaunch = (e) => {
        if (e && e.type === 'touchstart') e.preventDefault();
        this.menuIndex = index;
        this.updateMenuSelection();
        this.launchSelectedGame();
      };
      item.addEventListener('touchstart', selectAndLaunch, { passive: false });
      item.addEventListener('click', selectAndLaunch);
    });

    // In-game Bezel Return Button
    if (this.inGameMenuBtn) {
      const triggerReturn = (e) => {
        if (e && e.type === 'touchstart') e.preventDefault();
        this.returnToMenu();
      };
      this.inGameMenuBtn.addEventListener('touchstart', triggerReturn, { passive: false });
      this.inGameMenuBtn.addEventListener('click', triggerReturn);
    }

    // Hardware RESET button on lower deck (Silkscreen button)
    const btnReset = document.getElementById('gb-btn-reset');
    if (btnReset) {
      const triggerReset = (e) => {
        if (e && (e.type === 'touchstart' || e.type === 'pointerdown')) e.preventDefault();
        btnReset.classList.add('active');
        setTimeout(() => btnReset.classList.remove('active'), 180);
        this.returnToMenu();
      };
      btnReset.addEventListener('touchstart', triggerReset, { passive: false });
      btnReset.addEventListener('pointerdown', triggerReset);
      btnReset.addEventListener('click', triggerReset);
    }

    // Listen for postMessage from nested iframes (games / docs)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'GB_RESET') {
        this.returnToMenu();
      }
    });

    this.updateMenuSelection();
  }

  navigateMenu(delta) {
    if (!this.inMenu || !this.powerOn) return;
    const total = this.games.length;
    this.menuIndex = (this.menuIndex + delta + total) % total;
    this.updateMenuSelection();
    this.playMenuBlip();
    this.vibrate(8);
  }

  updateMenuSelection() {
    const items = document.querySelectorAll('.menu-item');
    items.forEach((item, index) => {
      const isActive = index === this.menuIndex;
      item.classList.toggle('active', isActive);
      if (isActive) {
        try {
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) {
          item.scrollIntoView();
        }
      }
    });
    this.currentCartridge = this.games[this.menuIndex];
  }

  launchSelectedGame() {
    if (!this.powerOn) return;
    const gameId = this.games[this.menuIndex] || 'tank-battle';
    this.playGameStartSound();
    this.vibrate(14);
    this.loadCartridge(gameId);
  }

  // Load game into screen
  loadCartridge(gameId) {
    this.currentCartridge = gameId;
    this.inMenu = false;
    this.lastSelectTime = 0;
    this.lastStartTime = 0;

    // Ensure no chassis button retains keyboard focus on PC (prevents Space/Enter from clicking Reset)
    if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (e) {}
    }

    // Hide Menu View
    if (this.menuView) {
      this.menuView.classList.remove('active');
      this.menuView.classList.add('hidden');
    }

    // Show In-Game Return Shortcut Badge
    if (this.inGameMenuBtn) {
      this.inGameMenuBtn.classList.remove('hidden');
    }

    let url = '';
    if (gameId === 'tank-battle') {
      url = 'games/tank-battle/index.html?embedded=1';
    } else if (gameId === 'space-invaders') {
      url = 'games/space-invaders/index.html?embedded=1';
    } else if (gameId === 'tetris') {
      url = 'games/tetris/index.html?embedded=1';
    } else if (gameId === 'squishy-buddies') {
      url = 'games/squishy-buddies/index.html?embedded=1';
    } else if (gameId === 'tutorial') {
      url = 'docs/gb-tutorial.html';
    }

    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const parentParams = new URLSearchParams(window.location.search);
      if (parentParams.get('autostart') === '1') {
        url += (url.includes('?') ? '&' : '?') + 'autostart=1';
        if (parentParams.has('level')) {
          url += '&level=' + parentParams.get('level');
        }
        if (parentParams.has('action')) {
          url += '&action=' + parentParams.get('action');
        }
      }
    }

    if (this.iframe) {
      this.iframe.classList.remove('hidden');
      this.iframe.src = url;
    }
  }

  // Soft-reset back to the authentic Game Boy Menu List
  returnToMenu() {
    if (this.inMenu) return;
    this.inMenu = true;
    this.playMenuBlip();
    this.vibrate(12);

    // Stop and hide game iframe
    if (this.iframe) {
      this.iframe.classList.add('hidden');
      this.iframe.src = 'about:blank';
    }

    // Hide In-Game Return Badge
    if (this.inGameMenuBtn) {
      this.inGameMenuBtn.classList.add('hidden');
    }

    // Display LCD Menu View
    if (this.menuView) {
      this.menuView.classList.remove('hidden');
      this.menuView.classList.add('active');
    }

    this.updateMenuSelection();
  }

  /* ================= Input Handling & Console Bridge ================= */
  sendInput(key, pressed) {
    if (!this.powerOn) return;

    const now = Date.now();
    if (pressed) {
      this.pressedKeys.add(key);
      this.vibrate(10);
      if (key === 'SELECT') this.lastSelectTime = now;
      if (key === 'START') this.lastStartTime = now;
    } else {
      this.pressedKeys.delete(key);
    }

    // Authentic Soft-Reset: SELECT + START pressed together, or SELECT -> START sequentially
    // Note: In squishy-buddies, SELECT is used constantly in-game to switch characters, so only simultaneous hold resets there.
    const isComboPressed = this.pressedKeys.has('SELECT') && this.pressedKeys.has('START');
    const isComboSequential = (
      this.currentCartridge !== 'squishy-buddies' &&
      key === 'START' &&
      this.lastSelectTime &&
      (now - this.lastSelectTime) < 800
    );

    if (isComboPressed || (pressed && isComboSequential)) {
      this.lastSelectTime = 0;
      this.lastStartTime = 0;
      this.returnToMenu();
      return;
    }

    // When at the Game Boy Menu: Use D-Pad and Buttons to navigate!
    if (this.inMenu) {
      if (pressed) {
        if (key === 'UP') {
          this.navigateMenu(-1);
          return;
        } else if (key === 'DOWN') {
          this.navigateMenu(1);
          return;
        } else if (key === 'A' || key === 'START') {
          this.launchSelectedGame();
          return;
        }
      }
      return;
    }

    // When playing a game: Bridge input cleanly to iframe via official GB_INPUT message
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({
        type: 'GB_INPUT',
        key,
        pressed
      }, '*');
    }
  }

  /* ================= Hardware Physical Controls ================= */
  initHardwareButtons() {
    const btnA = document.getElementById('gb-btn-a');
    const btnB = document.getElementById('gb-btn-b');

    const bindButton = (el, key) => {
      if (!el) return;
      let activeTouchId = null;
      let isTouching = false;

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isTouching = true;
        if (e.changedTouches && e.changedTouches.length > 0) {
          activeTouchId = e.changedTouches[0].identifier;
        }
        el.classList.add('active');
        this.sendInput(key, true);
      }, { passive: false });

      const onEnd = (e) => {
        if (activeTouchId !== null && e.changedTouches) {
          let found = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              found = true;
              break;
            }
          }
          if (!found) return; // Ignore touch ends from other fingers!
        }
        e.preventDefault();
        activeTouchId = null;
        el.classList.remove('active');
        this.sendInput(key, false);
        setTimeout(() => { isTouching = false; }, 300);
      };

      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onEnd, { passive: false });

      // Window fallback to ensure release if finger leaves button
      window.addEventListener('touchend', (e) => {
        if (activeTouchId !== null && e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              activeTouchId = null;
              el.classList.remove('active');
              this.sendInput(key, false);
              setTimeout(() => { isTouching = false; }, 300);
              break;
            }
          }
        }
      });
      window.addEventListener('touchcancel', (e) => {
        if (activeTouchId !== null && e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              activeTouchId = null;
              el.classList.remove('active');
              this.sendInput(key, false);
              setTimeout(() => { isTouching = false; }, 300);
              break;
            }
          }
        }
      });

      let isMouseDown = false;
      el.addEventListener('mousedown', () => {
        if (isTouching) return;
        isMouseDown = true;
        el.classList.add('active');
        this.sendInput(key, true);
      });
      window.addEventListener('mouseup', () => {
        if (isTouching || !isMouseDown) return;
        isMouseDown = false;
        el.classList.remove('active');
        this.sendInput(key, false);
      });
    };

    bindButton(btnA, 'A');
    bindButton(btnB, 'B');

    // SELECT & START Buttons
    const btnSelect = document.getElementById('gb-btn-select');
    const btnStart = document.getElementById('gb-btn-start');
    bindButton(btnSelect, 'SELECT');
    bindButton(btnStart, 'START');
  }

  // Multi-Touch Safe Cross D-Pad on the Game Boy chassis
  initDpadTouchSliding() {
    const dpadContainer = document.getElementById('gb-dpad');
    const armUp = document.getElementById('dpad-up');
    const armDown = document.getElementById('dpad-down');
    const armLeft = document.getElementById('dpad-left');
    const armRight = document.getElementById('dpad-right');

    if (!dpadContainer) return;

    let activeTouchId = null;
    let centerX = 0;
    let centerY = 0;
    const activeDirs = { UP: false, DOWN: false, LEFT: false, RIGHT: false };

    const updateCenter = () => {
      const rect = dpadContainer.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    };
    updateCenter();
    window.addEventListener('resize', updateCenter);
    window.addEventListener('scroll', updateCenter);

    const applyDirections = (newDirs) => {
      const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      dirs.forEach(dir => {
        const shouldBeActive = Boolean(newDirs && newDirs[dir]);
        if (activeDirs[dir] !== shouldBeActive) {
          activeDirs[dir] = shouldBeActive;
          this.sendInput(dir, shouldBeActive);
        }
      });

      if (armUp) armUp.classList.toggle('active', activeDirs.UP);
      if (armDown) armDown.classList.toggle('active', activeDirs.DOWN);
      if (armLeft) armLeft.classList.toggle('active', activeDirs.LEFT);
      if (armRight) armRight.classList.toggle('active', activeDirs.RIGHT);
    };

    const handleCoords = (clientX, clientY) => {
      if (centerX === 0 && centerY === 0) updateCenter();
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        applyDirections(null);
        return;
      }

      // Calculate angle in degrees: 0° is RIGHT, 90° is DOWN, -90° is UP, ±180° is LEFT
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const dirs = { UP: false, DOWN: false, LEFT: false, RIGHT: false };

      if (angle >= -22.5 && angle <= 22.5) {
        dirs.RIGHT = true;
      } else if (angle > 22.5 && angle < 67.5) {
        dirs.DOWN = true;
        dirs.RIGHT = true;
      } else if (angle >= 67.5 && angle <= 112.5) {
        dirs.DOWN = true;
      } else if (angle > 112.5 && angle < 157.5) {
        dirs.DOWN = true;
        dirs.LEFT = true;
      } else if (angle >= 157.5 || angle <= -157.5) {
        dirs.LEFT = true;
      } else if (angle > -157.5 && angle < -112.5) {
        dirs.UP = true;
        dirs.LEFT = true;
      } else if (angle >= -112.5 && angle <= -67.5) {
        dirs.UP = true;
      } else if (angle > -67.5 && angle < -22.5) {
        dirs.UP = true;
        dirs.RIGHT = true;
      }

      applyDirections(dirs);
    };

    const findDpadTouch = (touchList) => {
      if (activeTouchId === null || !touchList) return null;
      for (let i = 0; i < touchList.length; i++) {
        if (touchList[i].identifier === activeTouchId) {
          return touchList[i];
        }
      }
      return null;
    };

    // Touch start on D-Pad: Bind strictly to this specific finger
    dpadContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      updateCenter();

      // Use the touch that triggered this event (changedTouches), NOT e.touches[0]!
      const touch = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : null);
      if (touch) {
        activeTouchId = touch.identifier;
        handleCoords(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Touch move: Track ONLY the finger bound to D-Pad (ignore other fingers like B button!)
    window.addEventListener('touchmove', (e) => {
      if (activeTouchId === null) return;
      const touch = findDpadTouch(e.touches);
      if (touch) {
        e.preventDefault();
        handleCoords(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Touch end: Release D-Pad when touch lifts
    const onTouchEnd = (e) => {
      if (activeTouchId === null) return;
      const touch = findDpadTouch(e.changedTouches);
      if (touch || !e.touches || e.touches.length === 0) {
        activeTouchId = null;
        applyDirections(null);
      }
    };
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mouseup', () => {
      applyDirections(null);
    });

    // Direct click/touch support on individual arms for fast discrete tapping
    const bindDirectArm = (armEl, dir) => {
      if (!armEl) return;
      let isTouching = false;

      const handlePress = (e) => {
        if (e && e.cancelable && e.type !== 'mousedown') e.preventDefault();
        updateCenter();
        isTouching = true;
        const touch = e.changedTouches ? e.changedTouches[0] : null;
        if (touch) activeTouchId = touch.identifier;
        applyDirections({ [dir]: true });
      };

      const handleRelease = (e) => {
        if (e && e.cancelable && e.type !== 'mouseup') e.preventDefault();
        activeTouchId = null;
        applyDirections(null);
        setTimeout(() => { isTouching = false; }, 300);
      };

      armEl.addEventListener('touchstart', handlePress, { passive: false });
      armEl.addEventListener('touchend', handleRelease, { passive: false });
      armEl.addEventListener('touchcancel', handleRelease, { passive: false });

      armEl.addEventListener('mousedown', (e) => {
        if (isTouching) return;
        applyDirections({ [dir]: true });
      });
      armEl.addEventListener('mouseup', (e) => {
        if (isTouching) return;
        applyDirections(null);
      });

      armEl.addEventListener('click', (e) => {
        if (isTouching) return;
        e.preventDefault();
        setDir(dir);
        setTimeout(() => setDir(null), 50);
      });
    };

    bindDirectArm(armUp, 'UP');
    bindDirectArm(armDown, 'DOWN');
    bindDirectArm(armLeft, 'LEFT');
    bindDirectArm(armRight, 'RIGHT');
  }

  initKeyboardBridge() {
    window.addEventListener('keydown', (e) => {
      // Never let Space/Enter activate a focused hardware button on PC
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement.tagName === 'BUTTON') {
        try { document.activeElement.blur(); } catch (err) {}
      }
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          this.sendInput('UP', true);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this.sendInput('DOWN', true);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this.sendInput('LEFT', true);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this.sendInput('RIGHT', true);
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          e.preventDefault();
          this.sendInput('A', true);
          break;
        case 'KeyK':
        case 'KeyX':
          e.preventDefault();
          this.sendInput('B', true);
          break;
        case 'Enter':
          e.preventDefault();
          this.sendInput('START', true);
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
        case 'Tab':
          e.preventDefault();
          this.sendInput('SELECT', true);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.sendInput('UP', false);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.sendInput('DOWN', false);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.sendInput('LEFT', false);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.sendInput('RIGHT', false);
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          this.sendInput('A', false);
          break;
        case 'KeyK':
        case 'KeyX':
          this.sendInput('B', false);
          break;
        case 'Enter':
          this.sendInput('START', false);
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
        case 'Tab':
          this.sendInput('SELECT', false);
          break;
      }
    });
  }

  /* ================= 3 SVG Hardware Utility Operations ================= */
  initUtilityDock() {
    // 1. Power Action
    if (this.btnPower) {
      this.btnPower.addEventListener('click', () => this.togglePower());
    }

    // 2. Palette Action
    if (this.btnPalette) {
      this.btnPalette.addEventListener('click', () => this.cyclePalette());
    }

    // 3. Fullscreen Action
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }
  }

  togglePower() {
    this.powerOn = !this.powerOn;
    this.vibrate(12);

    if (this.btnPower) {
      this.btnPower.classList.toggle('active', this.powerOn);
    }
    if (this.batteryLed) {
      this.batteryLed.classList.toggle('powered', this.powerOn);
    }
    if (this.screenOff) {
      this.screenOff.classList.toggle('hidden', this.powerOn);
    }

    if (this.powerOn) {
      this.playBootChime();
      if (this.inMenu) {
        if (this.menuView) {
          this.menuView.classList.remove('hidden');
          this.menuView.classList.add('active');
        }
      } else {
        this.loadCartridge(this.currentCartridge);
      }
    } else {
      if (this.iframe) this.iframe.src = 'about:blank';
      if (this.inGameMenuBtn) this.inGameMenuBtn.classList.add('hidden');
    }
  }

  cyclePalette() {
    const palettes = ['true', 'color', 'dmg', 'bw'];
    const labels = { 'true': '原彩', 'color': 'COLOR', 'dmg': 'DMG', 'bw': 'B&W' };

    const idx = palettes.indexOf(this.paletteMode);
    this.paletteMode = palettes[(idx + 1) % palettes.length];
    
    if (this.screenFrame) {
      this.screenFrame.classList.remove('palette-true', 'palette-dmg', 'palette-bw', 'palette-color');
      this.screenFrame.classList.add(`palette-${this.paletteMode}`);
    }
    if (this.paletteLabel) {
      this.paletteLabel.innerText = labels[this.paletteMode];
    }
    if (this.btnPalette) {
      this.btnPalette.classList.toggle('true-color-active', this.paletteMode === 'true');
      this.btnPalette.classList.add('active');
      setTimeout(() => this.btnPalette.classList.remove('active'), 200);
    }
    this.vibrate(10);
  }

  toggleFullscreen() {
    this.vibrate(10);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        if (this.btnFullscreen) this.btnFullscreen.classList.add('active');
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        if (this.btnFullscreen) this.btnFullscreen.classList.remove('active');
      }).catch(() => {});
    }
  }
}

window.addEventListener('load', () => {
  window.consoleInstance = new GameBoyConsole();
});
