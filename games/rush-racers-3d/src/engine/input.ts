import { createInput } from '@arcade/input';

/** Every action the game understands. Scenarios are typed against this. `fire` also confirms on screens. */
export type Action = 'left' | 'right' | 'forward' | 'back' | 'jump' | 'dash' | 'fire' | 'prev' | 'next';

export const input = createInput<Action, 'move'>({
  actions: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    forward: ['ArrowUp', 'KeyW'],
    back: ['ArrowDown', 'KeyS'],
    jump: ['Space'],
    dash: ['ShiftLeft', 'ShiftRight', 'KeyX'],
    fire: ['KeyZ', 'Enter'],
    prev: ['KeyQ'],
    next: ['KeyE', 'Tab'],
  },
  vectors: { move: { left: 'left', right: 'right', up: 'forward', down: 'back' } },
  touch: {
    dpad: { left: 'left', right: 'right', up: 'forward', down: 'back' },
    buttons: [
      { action: 'jump', label: 'A' },
      { action: 'dash', label: 'B' },
      { action: 'fire', label: '★' },
      { action: 'next', label: '⇄' },
    ],
  },
});
