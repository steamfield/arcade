/**
 * Everything observable that happens in a race. Tests, `arcade see`, effects and
 * audio all read these; logic emits each one on the tick it happens, once.
 *
 * Phase 3 events, in brief: `clam.opened.index` and `pearl.collected.index` index
 * `level.clams` / `level.pearls`, and `pearl.collected.total` is the racer's count
 * after it. `powerup.lost` is `full` when a fourth power-up pushes the oldest off and
 * `hit` when a hit knocks one loose. `burst.fired.kinds` lists the held power-ups
 * oldest first and `combo` is the first matching named pair. `bubble.popped.by` is
 * null when a bubble hits a wall or runs out of time. `racer.hit` is only emitted for
 * hits that land (invulnerable racers ignore hits); `shield.popped` means a Bubble
 * Shield absorbed one.
 */
import type { ComboName, HitCause, PowerUpKind, RacerId } from './types.ts';

export type GameEvent =
  | { type: 'race.countdown'; n: 3 | 2 | 1 }
  | { type: 'race.started' }
  | { type: 'racer.kicked'; id: RacerId }
  | { type: 'racer.bumped'; a: RacerId; b: RacerId }
  | { type: 'coral.broken'; tx: number; ty: number; by: RacerId }
  | { type: 'player.place'; place: number }
  | { type: 'racer.finished'; id: RacerId; place: number; ticks: number }
  | { type: 'race.finished'; standings: RacerId[]; playerPlace: number; playerTicks: number | null }
  | { type: 'clam.opened'; id: RacerId; index: number; kind: PowerUpKind }
  | { type: 'powerup.gained'; id: RacerId; kind: PowerUpKind }
  | { type: 'powerup.lost'; id: RacerId; kind: PowerUpKind; cause: 'hit' | 'full' }
  | { type: 'loose.spawned'; kind: PowerUpKind }
  | { type: 'loose.grabbed'; id: RacerId; kind: PowerUpKind }
  | { type: 'pearl.collected'; id: RacerId; index: number; total: number }
  | { type: 'burst.fired'; id: RacerId; kinds: PowerUpKind[]; combo: ComboName | null }
  | { type: 'ink.spawned'; owner: RacerId }
  | { type: 'bubble.spawned'; owner: RacerId }
  | { type: 'bubble.popped'; by: RacerId | null }
  | { type: 'racer.trapped'; id: RacerId; by: RacerId }
  | { type: 'flash.fired'; id: RacerId }
  | { type: 'racer.hit'; id: RacerId; cause: HitCause; by: RacerId | null }
  | { type: 'shield.popped'; id: RacerId }
  | { type: 'racer.stunned'; id: RacerId };
