/**
 * The one-off moments a racer's sprite plays from events: the kick squash-and-stretch, the flap's
 * wing-stroke squash and, for the local racer (the slot the screen follows), the white flash on
 * gaining a place. Timed in world ticks, the same clock `sync`
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

/**
 * A flap squashes the sprite short and wide (a positive stretch on the view's default horizontal
 * axis) for FLAP_HOLD_TICKS, the wings' downstroke, then eases back to rest by FLAP_TICKS.
 */
const FLAP_HOLD_TICKS = 2;
const FLAP_TICKS = 8;
const FLAP_SQUASH_AMOUNT = 0.15;

/** The place-up flash fills the sprite white for this many ticks, once. */
export const PLACE_FLASH_TICKS = 4;

/** What the sprite shows at a world tick. */
export interface RacerLook {
  /** Stretch along the kick's axis: negative while squashed, positive while stretched, 0 at rest. */
  stretch: number;
  /**
   * The axis the stretch runs along when a bounce set it ('x' off a wall, 'y' off a floor or
   * ceiling); null for every other moment, where the view uses the axis the racer kicked on.
   */
  axis: 'x' | 'y' | null;
  /** True while the place-up flash fills the sprite white. */
  flashing: boolean;
}

/** Tracks one racer's kick, flap and place-up moments. */
export interface RacerMoments {
  /**
   * Records a `racer.kicked` or `racer.flapped` for this racer and its own `player.place` that gains a
   * place, at world tick `tick`.
   */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /** The look at world tick `tick`. Reduced motion drops the stretch and the flash. */
  look(tick: number, reducedMotion: boolean): RacerLook;
}

/**
 * Moments for racer `id`, starting in `place`. Only the local racer flashes.
 *
 * @param local The slot the screen follows; 'player' when omitted.
 */
export function createRacerMoments(id: RacerId, place: number, local: RacerId = 'player'): RacerMoments {
  let kickedAt = Number.NEGATIVE_INFINITY;
  let flappedAt = Number.NEGATIVE_INFINITY;
  let placeGainedAt = Number.NEGATIVE_INFINITY;
  let current = place;
  return {
    onEvents(events, tick) {
      for (const event of events) {
        if (event.type === 'racer.kicked' && event.id === id) kickedAt = tick;
        if (event.type === 'racer.flapped' && event.id === id) flappedAt = tick;
        if (event.type === 'player.place' && event.id === id && id === local) {
          if (event.place < current) placeGainedAt = tick;
          current = event.place;
        }
      }
    },
    look(tick, reducedMotion) {
      if (reducedMotion) return { stretch: 0, axis: null, flashing: false };
      const sinceFlash = tick - placeGainedAt;
      // The latest of a kick and a flap shapes the sprite, so a flap mid-kick shows at once.
      const stretch = flappedAt > kickedAt ? flapStretchAt(tick - flappedAt) : kickStretchAt(tick - kickedAt);
      return { stretch, axis: null, flashing: sinceFlash >= 0 && sinceFlash < PLACE_FLASH_TICKS };
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

/**
 * Stretch `ticksSinceFlap` after a flap: a short, wide squash for FLAP_HOLD_TICKS as the wings beat
 * down, easing back to nothing by FLAP_TICKS.
 */
function flapStretchAt(ticksSinceFlap: number): number {
  if (ticksSinceFlap < 0 || ticksSinceFlap >= FLAP_TICKS) return 0;
  if (ticksSinceFlap < FLAP_HOLD_TICKS) return FLAP_SQUASH_AMOUNT;
  return FLAP_SQUASH_AMOUNT * (1 - (ticksSinceFlap - FLAP_HOLD_TICKS) / (FLAP_TICKS - FLAP_HOLD_TICKS));
}
