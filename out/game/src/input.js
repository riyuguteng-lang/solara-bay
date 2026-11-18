// Solara Bay — keyboard and mouse. WASD move, mouse looks (pointer lock),
// Shift run, Space jump, E enter/exit car, F punch, 1/2 fists/pistol,
// R reload, P or Esc pause, M mute, Enter confirm on menus.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_INTERACT = 'interact';
export const ACTION_PUNCH = 'punch';
export const ACTION_JUMP = 'jump';
export const ACTION_RUN = 'run';
export const ACTION_RELOAD = 'reload';
export const ACTION_MUTE = 'mute';

const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
  KeyE: 'interact',
  KeyF: 'punch',
  Digit1: 'fists', Digit2: 'pistol',
  KeyR: 'reload',
  KeyM: 'mute',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const keys = {};
  const pressed = {};   // true only on the frame the key went down
  const mouse = { dx: 0, dy: 0, down: false, clicked: false };
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    const action = KEYMAP[e.code];
    if (!action) return;
    keys[action] = true;
    pressed[action] = true;
    if (action === 'jump' || action === 'pause') e.preventDefault();
  }
  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) keys[action] = false;
  }
  function onMouseMove(e) {
    if (!locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  }
  function onMouseDown(e) {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  }
  function onMouseUp(e) { if (e.button === 0) mouse.down = false; }
  function onLockChange() { locked = document.pointerLockElement === canvas; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    keys, pressed, mouse,
    get locked() { return locked; },
    lock() { if (!locked) canvas.requestPointerLock?.(); },
    unlock() { if (locked) document.exitPointerLock?.(); },
    /** Call once per frame: edge-triggered presses and mouse deltas clear. */
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      mouse.dx = 0; mouse.dy = 0; mouse.clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
