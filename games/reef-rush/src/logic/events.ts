/**
 * Everything observable that happens in a race. Tests, `arcade see`, effects and
 * audio all read these; logic emits each one on the tick it happens, once.
 */
import type { RacerId } from './types.ts';

export type GameEvent =
  | { type: 'race.countdown'; n: 3 | 2 | 1 }
  | { type: 'race.started' }
  | { type: 'racer.kicked'; id: RacerId }
  | { type: 'racer.bumped'; a: RacerId; b: RacerId }
  | { type: 'player.place'; place: number }
  | { type: 'racer.finished'; id: RacerId; place: number; ticks: number }
  | { type: 'race.finished'; standings: RacerId[]; playerPlace: number; playerTicks: number | null };
