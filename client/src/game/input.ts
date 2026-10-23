// Movement input lives outside React: the joystick and keyboard write to it,
// and the per-frame movement code reads it. Values are -1..1 on each axis
// (x: left/right, z: up/down the screen).

export const joystick = { x: 0, z: 0 };

const keys = new Set<string>();

const KEY_DIRS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e.target) || !(e.code in KEY_DIRS)) return;
    keys.add(e.code);
    e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const clear = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
  };
}

/** Combined direction from keys and joystick, length at most 1. */
export function readDirection(): { x: number; z: number } {
  let x = joystick.x;
  let z = joystick.z;
  for (const code of keys) {
    x += KEY_DIRS[code][0];
    z += KEY_DIRS[code][1];
  }
  const len = Math.hypot(x, z);
  return len > 1 ? { x: x / len, z: z / len } : { x, z };
}
