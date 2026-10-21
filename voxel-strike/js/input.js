// 输入状态：按住 / 本帧按下 / 鼠标增量

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: [false, false, false],
  clicked: [false, false, false],
  dx: 0,
  dy: 0,
  wheel: 0,
  locked: false,
  freeLook: false, // 测试模式：无指针锁定时也接收鼠标增量
};

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => input.keys.delete(e.code));
  addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.fill(false);
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouse[e.button] = true;
    input.clicked[e.button] = true;
  });
  addEventListener('mouseup', (e) => (input.mouse[e.button] = false));
  addEventListener('mousemove', (e) => {
    if (input.locked || input.freeLook) {
      input.dx += e.movementX;
      input.dy += e.movementY;
    }
  });
  addEventListener('wheel', (e) => (input.wheel += Math.sign(e.deltaY)), { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
}

export function endFrame() {
  input.pressed.clear();
  input.clicked.fill(false);
  input.dx = 0;
  input.dy = 0;
  input.wheel = 0;
}
