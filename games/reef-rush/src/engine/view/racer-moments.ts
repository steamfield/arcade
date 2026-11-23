/**
 * The one-off moments a racer's sprite plays from events: the kick squash-and-stretch and, for
 * the player, the white flash on gaining a place. Timed in world ticks, the same clock `sync`
 * is given, never the tick stamped on the event: that stamp is the runtime's step count, which
 * keeps running through menus, so mixing the two left the flash on for the whole race.
 */
import type { Stamped } from '@arcade/core';
import type { RacerId } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';

/** A kick squashes the sprite along the axis it kicked on for SQUASH_TICKS, then stretches it and eases back by KICK_TICKS. */
const SQUASH_TICKS = 3;
const KICK_TICKS = 11;
const SQUASH_AMOUNT = 0.2;
const STRETCH_AMOUNT = 0.25;

/** The place-up flash fills the sprite white for this many ticks, once. */
export const PLACE_FLASH_TICKS = 4;

/** What the sprite shows at a world tick. */
export interface RacerLook {
  /** Stretch along the kick's axis: negative while squashed, positive while stretched, 0 at rest. */
  stretch: number;
  /** True while the place-up flash fills the sprite white. */
  flashing: boolean;
}

/** Tracks one racer's kick and place-up moments. */
export interface RacerMoments {
  /** Records a `racer.kicked` for this racer and a `player.place` that gains a place, at world tick `tick`. */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /** The look at world tick `tick`. Reduced motion drops the stretch and the flash. */
  look(tick: number, reducedMotion: boolean): RacerLook;
}

/** Moments for racer `id`, starting in `place`. Only the player flashes. */
export function createRacerMoments(id: RacerId, place: number): RacerMoments {
  let kickedAt = Number.NEGATIVE_INFINITY;
  let placeGainedAt = Number.NEGATIVE_INFINITY;
  let current = place;
  return {
    onEvents(events, tick) {
      for (const event of events) {
        if (event.type === 'racer.kicked' && event.id === id) kickedAt = tick;
        if (event.type === 'player.place' && id === 'player') {
          if (event.place < current) placeGainedAt = tick;
          current = event.place;
        }
      }
    },
    look(tick, reducedMotion) {
      if (reducedMotion) return { stretch: 0, flashing: false };
      const sinceFlash = tick - placeGainedAt;
      return { stretch: kickStretchAt(tick - kickedAt), flashing: sinceFlash >= 0 && sinceFlash < PLACE_FLASH_TICKS };
    },
  };
}

/**
 * Stretch along the kick's axis `ticksSinceKick` after a kick (the other axis moves the other way):
 * negative (squashed short and tall, gathering) for SQUASH_TICKS, then a stretch long and thin
 * that eases back to nothing by KICK_TICKS.
 */
function kickStretchAt(ticksSinceKick: number): number {
  if (ticksSinceKick < 0 || ticksSinceKick >= KICK_TICKS) return 0;
  if (ticksSinceKick < SQUASH_TICKS) return -SQUASH_AMOUNT;
  return STRETCH_AMOUNT * (1 - (ticksSinceKick - SQUASH_TICKS) / (KICK_TICKS - SQUASH_TICKS));
}
