/** Everything observable that happens in a race. Tests and `arcade see` read these. */
import type { RacerId } from './types.ts';

export type GameEvent =
  | { type: 'race.countdown'; n: 3 | 2 | 1 }
  | { type: 'race.started' }
  | { type: 'race.ended'; ticks: number; reason: 'player-finished' | 'rivals-finished' | 'limit' }
  | { type: 'racer.jumped'; id: RacerId }
  | { type: 'racer.landed'; id: RacerId }
  | { type: 'racer.dashed'; id: RacerId; charges: number }
  | { type: 'racer.dashRecharged'; id: RacerId; charges: number }
  /** `by` is the racer bumped into, or null for a log. */
  | { type: 'racer.bumped'; id: RacerId; s: number; by: RacerId | null }
  | { type: 'racer.fell'; id: RacerId; s: number }
  | { type: 'racer.respawned'; id: RacerId; s: number; d: number }
  /** `place` is 1-based, the racer's place in the standings on the tick it finished. */
  | { type: 'racer.finished'; id: RacerId; ticks: number; place: number };
