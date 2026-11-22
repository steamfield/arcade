/**
 * Every action Reef Rush understands, with its keys and touch controls.
 * Scenarios are typed against `Action`.
 */
import { createInput } from '@arcade/input';

export type Action = 'left' | 'right' | 'up' | 'down' | 'kick' | 'burst';

export const input = createInput<Action, 'move'>({
  actions: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    kick: ['Space', 'KeyZ', 'Enter'],
    burst: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  },
  vectors: { move: { left: 'left', right: 'right', up: 'up', down: 'down' } },
  touch: {
    dpad: { left: 'left', right: 'right', up: 'up', down: 'down' },
    buttons: [
      { action: 'kick', label: 'A' },
      { action: 'burst', label: 'B' },
    ],
  },
});
