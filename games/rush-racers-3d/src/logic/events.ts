/** Everything observable that happens in a race. Tests and `arcade see` read these. */
import type { RacerId } from './types.ts';

export type GameEvent =
  | { type: 'race.countdown'; n: 3 | 2 | 1 }
  | { type: 'race.started' }
  | { type: 'race.ended'; ticks: number }
  | { type: 'racer.jumped'; id: RacerId }
  | { type: 'racer.landed'; id: RacerId }
  | { type: 'racer.dashed'; id: RacerId; charges: number }
  | { type: 'racer.dashRecharged'; id: RacerId; charges: number }
  | { type: 'racer.bumped'; id: RacerId; s: number }
  | { type: 'racer.fell'; id: RacerId; s: number }
  | { type: 'racer.respawned'; id: RacerId; s: number; d: number }
  | { type: 'racer.finished'; id: RacerId; ticks: number };
