/** Everything observable that happens in a race. Tests and `arcade see` read these. */
import type { ItemKind, RacerId } from './types.ts';

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
  | { type: 'racer.finished'; id: RacerId; ticks: number; place: number }
  /** `crate` is the crate's index in `World.crates`. */
  | { type: 'crate.opened'; id: RacerId; crate: number; kind: ItemKind }
  | { type: 'item.selected'; id: RacerId; slot: number }
  | { type: 'item.fired'; id: RacerId; kind: ItemKind }
  /** `kind` is what hit them; `outcome` is what the hit did. */
  | { type: 'racer.hit'; id: RacerId; by: RacerId; kind: ItemKind; outcome: 'shielded' | 'dropped' | 'stunned' }
  | { type: 'racer.trapped'; id: RacerId; by: RacerId }
  | { type: 'pie.splatted'; owner: RacerId; s: number; d: number };
