/**
 * Which sound the attack power-ups' events make. What happens to a racer (a lock-on, a latch, a
 * dodge, a shake-off, an Undertow pull) is heard only when that racer is the player, so the cue
 * always means "this is about you". What other racers do (firing a squid, laying a lane, leaving a
 * decoy) is heard only when they are within about a screen of the player, so a fight at the other
 * end of the course is silent. The lock-on cue sounds at most once per `LOCK_CUE_GAP_TICKS`, so a
 * squid that keeps retargeting does not turn into an alarm. Pure but for that one timer.
 */
import { playerOf } from '../../logic/racers.ts';
import type { RacerId, World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { SfxKey } from './sfx.ts';

/** The lock-on cue repeats no sooner than this many ticks after the last one. */
export const LOCK_CUE_GAP_TICKS = 90;
/** How far from the player another racer's attack is still heard: about a screen. */
export const HEARING_PX = 320;

/** Decides each attack event's sound. `audibleFromPlayer(id)` says whether racer `id` is near enough to hear. */
export interface AttackSfx {
  /** The sound for `event` drained on world tick `tick`, or null when it makes none. */
  forEvent(event: RuntimeEvent, tick: number): SfxKey | null;
}

/** Builds the decider; each one keeps its own lock-on timer. */
export function createAttackSfx(audibleFromPlayer: (id: RacerId) => boolean = () => true): AttackSfx {
  let lastLockCue = Number.NEGATIVE_INFINITY;
  return {
    forEvent(event, tick) {
      switch (event.type) {
        case 'squid.spawned':
          return audibleFromPlayer(event.owner) ? 'squid.fire' : null;
        case 'squid.locked':
          if (event.target !== 'player' || tick - lastLockCue < LOCK_CUE_GAP_TICKS) return null;
          lastLockCue = tick;
          return 'squid.lock';
        case 'squid.latched':
          return event.id === 'player' ? 'squid.latch' : null;
        case 'squid.dodged':
          return event.id === 'player' ? 'squid.dodge' : null;
        case 'racer.shaken':
          return event.id === 'player' ? 'squid.shake' : null;
        case 'squid.lost':
          return event.owner === 'player' ? 'squid.lost' : null;
        case 'riptide.spawned':
          return audibleFromPlayer(event.owner) ? 'riptide' : null;
        case 'undertow.fired':
          return event.id === 'player' || event.pulled.includes('player') ? 'undertow' : null;
        case 'decoy.spawned':
          return audibleFromPlayer(event.owner) ? 'decoy.spawn' : null;
        case 'decoy.popped':
          return audibleFromPlayer(event.owner) ? 'decoy.pop' : null;
        default:
          return null;
      }
    },
  };
}

/** Whether racer `id` is within `HEARING_PX` of the player in `world`. */
export function withinHearing(world: World, id: RacerId): boolean {
  const player = playerOf(world);
  const racer = world.racers.find((candidate) => candidate.id === id);
  if (!racer) return false;
  const dx = racer.body.x - player.body.x;
  const dy = racer.body.y - player.body.y;
  return Math.hypot(dx, dy) <= HEARING_PX;
}
