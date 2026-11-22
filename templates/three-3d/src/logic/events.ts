/** Everything observable that happens in a run. Tests and `arcade see` read these. */
export type GameEvent =
  | { type: 'player.jumped' }
  | { type: 'player.landed' }
  | { type: 'orb.collected'; index: number; total: number }
  | { type: 'field.cleared'; ticks: number };
