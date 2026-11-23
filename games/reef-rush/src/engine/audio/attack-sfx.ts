/**
 * Which sound the attack power-ups' events make. What happens to a racer (a lock-on, a latch, a
 * dodge, a shake-off, an Undertow pull) is heard only when that racer is the local racer (the slot
 * the screen follows), so the cue always means "this is about you". What other racers do (firing a
 * squid, laying a lane, leaving a decoy) is heard only when they are within about a screen of it, so a fight at the other
 * end of the course is silent. The lock-on cue sounds at most once per `LOCK_CUE_GAP_TICKS`, so a
 * squid that keeps retargeting does not turn into an alarm. Pure but for that one timer.
 */
import type { RacerId, World } from '../../logic/types.ts';
import { localOf } from '../local-racer.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { SfxKey } from './sfx.ts';

/** The lock-on cue repeats no sooner than this many ticks after the last one. */
export const LOCK_CUE_GAP_TICKS = 90;
/** How far from the local racer another racer's attack is still heard: about a screen. */
export const HEARING_PX = 320;

/** Decides each attack event's sound. `audibleFromPlayer(id)` says whether racer `id` is near enough to hear. */
export interface AttackSfx {
  /** The sound for `event` drained on world tick `tick`, or null when it makes none. */
  forEvent(event: RuntimeEvent, tick: number): SfxKey | null;
}

/**
 * Builds the decider; each one keeps its own lock-on timer.
 *
 * @param localRacer The slot the screen follows, read per event; 'player' when omitted.
 */
export function createAttackSfx(
  audibleFromPlayer: (id: RacerId) => boolean = () => true,
  localRacer: () => RacerId = () => 'player',
): AttackSfx {
  let lastLockCue = Number.NEGATIVE_INFINITY;
  return {
    forEvent(event, tick) {
      const local = localRacer();
      switch (event.type) {
        case 'squid.spawned':
          return audibleFromPlayer(event.owner) ? 'squid.fire' : null;
        case 'squid.locked':
          if (event.target !== local || tick - lastLockCue < LOCK_CUE_GAP_TICKS) return null;
          lastLockCue = tick;
          return 'squid.lock';
        case 'squid.latched':
          return event.id === local ? 'squid.latch' : null;
        case 'squid.dodged':
          return event.id === local ? 'squid.dodge' : null;
        case 'racer.shaken':
          return event.id === local ? 'squid.shake' : null;
        case 'squid.lost':
          return event.owner === local ? 'squid.lost' : null;
        case 'riptide.spawned':
          return audibleFromPlayer(event.owner) ? 'riptide' : null;
        case 'undertow.fired':
          return event.id === local || event.pulled.includes(local) ? 'undertow' : null;
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

/** Whether racer `id` is within `HEARING_PX` of the local racer in `world`. */
export function withinHearing(world: World, id: RacerId): boolean {
  const local = localOf(world);
  const racer = world.racers.find((candidate) => candidate.id === id);
  if (!racer) return false;
  const dx = racer.body.x - local.body.x;
  const dy = racer.body.y - local.body.y;
  return Math.hypot(dx, dy) <= HEARING_PX;
}
