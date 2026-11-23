/**
 * Everything observable that happens in a race. Tests, `arcade see`, effects and
 * audio all read these; logic emits each one on the tick it happens, once.
 *
 * Item events, in brief: `clam.opened.index` and `pearl.collected.index` index
 * `level.clams` / `level.pearls`, and `pearl.collected.total` is the racer's count
 * after it. `powerup.gained.slot` is the inventory slot it went into and `charges`
 * the uses it came with. `item.used` is one press firing the item in `slot`, with
 * `chargesLeft` after it; at 0 the slot empties with `powerup.lost {cause: 'used'}`.
 * `powerup.lost` cause `hit` is the selected item knocked loose by a hit, and
 * `loose.spawned.charges` / `loose.grabbed.charges` are the uses that loose item
 * carries. `item.selected` is a change of selected slot (a cycle, or a rival firing
 * another slot). `bubble.popped.by` is null when a bubble hits a wall or runs out of
 * time. `racer.hit` is only emitted for hits that land (invulnerable racers ignore
 * hits); `shield.popped` means a Bubble Shield absorbed one.
 *
 * Attack item events: `squid.spawned.target`
 * is the racer it locked on at launch, or null when it swims straight or locked a decoy; `squid.locked` fires on
 * every new lock including the one at launch and retargets, with `target` 'decoy' when it picked a Mimic decoy;
 * `squid.latched {id, by}` is a contact that landed on racer `id`; `squid.dodged` is a kick that
 * made it miss; `squid.lost` is a squid that expired, hit a wall, lost its lock in ink or was
 * absorbed by a shield; `racer.shaken` ends a latch early from kicks. `undertow.fired.pulled`
 * lists the racers given `status.undertow`. `decoy.popped.by` is null when the decoy simply
 * expires.
 */
import type { EnemyKind, HitCause, PowerUpKind, RacerId } from './types.ts';

export type GameEvent =
  | { type: 'race.countdown'; n: 3 | 2 | 1 }
  | { type: 'race.started' }
  | { type: 'racer.kicked'; id: RacerId }
  /** A racer left the ground on a jump (a jumping medium only; never spends a dash charge). */
  | { type: 'racer.jumped'; id: RacerId }
  /** A racer flapped on a fresh Up press (a flying medium only; never spends a dash charge). */
  | { type: 'racer.flapped'; id: RacerId }
  /**
   * A racer bounced off a tile hard enough to notice (a bouncing medium only); `speed` is how fast it
   * went in (px/s) and `axis` the axis the tile stopped it on (the harder one in a corner).
   */
  | { type: 'racer.bounced'; id: RacerId; speed: number; axis: 'x' | 'y' }
  /** A racer fell out of the level through a pit. */
  | { type: 'racer.fell'; id: RacerId }
  /** A racer that fell is back on the last safe ground it stood on. */
  | { type: 'racer.respawned'; id: RacerId; x: number; y: number }
  /** A racer's centre left the water for the air above a surface. */
  | { type: 'racer.breached'; id: RacerId }
  /** A racer that breached came back down, its centre `SPLASH_DEPTH` px under the surface. */
  | { type: 'racer.splashed'; id: RacerId }
  | { type: 'racer.bumped'; a: RacerId; b: RacerId }
  | { type: 'coral.broken'; tx: number; ty: number; by: RacerId }
  /** A human's place changed; `id` is that human's slot. */
  | { type: 'player.place'; id: RacerId; place: number }
  /** The AI took over a human slot whose input stopped arriving. */
  | { type: 'racer.takeover'; id: RacerId }
  | { type: 'racer.finished'; id: RacerId; place: number; ticks: number }
  | { type: 'race.finished'; standings: RacerId[]; playerPlace: number; playerTicks: number | null }
  | { type: 'clam.opened'; id: RacerId; index: number; kind: PowerUpKind }
  | { type: 'powerup.gained'; id: RacerId; kind: PowerUpKind; slot: number; charges: number }
  | { type: 'powerup.lost'; id: RacerId; kind: PowerUpKind; cause: 'hit' | 'used' }
  | { type: 'loose.spawned'; kind: PowerUpKind; charges: number }
  | { type: 'loose.grabbed'; id: RacerId; kind: PowerUpKind; charges: number }
  | { type: 'pearl.collected'; id: RacerId; index: number; total: number }
  | { type: 'loosePearl.collected'; id: RacerId; total: number }
  | { type: 'pearls.dropped'; id: RacerId; count: number }
  | { type: 'racer.dashRecharged'; id: RacerId; charges: number }
  | { type: 'enemy.telegraphed'; index: number; kind: EnemyKind }
  | { type: 'enemy.charged'; index: number; kind: EnemyKind; target: RacerId }
  | { type: 'enemy.bonked'; index: number; kind: EnemyKind; by: RacerId; hpLeft: number; how: 'dash' | 'stomp' }
  | { type: 'enemy.defeated'; index: number; kind: EnemyKind; by: RacerId }
  | { type: 'pearls.burst'; index: number; count: number }
  | { type: 'item.used'; id: RacerId; kind: PowerUpKind; slot: number; chargesLeft: number }
  | { type: 'item.selected'; id: RacerId; slot: number; kind: PowerUpKind }
  | { type: 'ink.spawned'; owner: RacerId }
  | { type: 'bubble.spawned'; owner: RacerId }
  | { type: 'bubble.popped'; by: RacerId | null }
  | { type: 'racer.trapped'; id: RacerId; by: RacerId }
  | { type: 'flash.fired'; id: RacerId }
  | { type: 'racer.hit'; id: RacerId; cause: HitCause; by: RacerId | null }
  | { type: 'shield.popped'; id: RacerId }
  | { type: 'racer.stunned'; id: RacerId }
  | { type: 'squid.spawned'; owner: RacerId; target: RacerId | null }
  | { type: 'squid.locked'; owner: RacerId; target: RacerId | 'decoy' }
  | { type: 'squid.latched'; id: RacerId; by: RacerId }
  | { type: 'squid.dodged'; id: RacerId }
  | { type: 'squid.lost'; owner: RacerId }
  | { type: 'racer.shaken'; id: RacerId }
  | { type: 'riptide.spawned'; owner: RacerId }
  | { type: 'undertow.fired'; id: RacerId; pulled: RacerId[] }
  | { type: 'decoy.spawned'; owner: RacerId }
  | { type: 'decoy.popped'; owner: RacerId; by: RacerId | null };
