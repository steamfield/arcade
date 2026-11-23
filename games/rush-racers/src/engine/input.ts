/**
 * Every action Rush Racers understands, with its keys and touch controls.
 * Scenarios are typed against `Action`. `fire` uses the selected item and confirms in menus; `dash`
 * kicks and goes back; `prev` and `next` move the item selection.
 */
import { createInput } from '@arcade/input';

export type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'dash' | 'prev' | 'next';

export const input = createInput<Action, 'move'>({
  actions: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    fire: ['Space', 'KeyZ', 'Enter'],
    dash: ['KeyX', 'ShiftLeft', 'ShiftRight'],
    prev: ['KeyQ'],
    next: ['KeyE', 'Tab'],
  },
  vectors: { move: { left: 'left', right: 'right', up: 'up', down: 'down' } },
  touch: {
    dpad: { left: 'left', right: 'right', up: 'up', down: 'down' },
    buttons: [
      { action: 'fire', label: 'A' },
      { action: 'dash', label: 'B' },
      { action: 'next', label: '⇄' },
    ],
  },
});
