/**
 * The one-off moments a racer's sprite plays from events: the kick squash-and-stretch, the flap's
 * wing-stroke squash, the bounce's squash against the wall it hit and, for the local racer (the slot the screen follows), the white flash on
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

/**
 * A bounce squashes the sprite against the wall along the axis the wall stopped it on (a negative
 * stretch on that axis) for BOUNCE_HOLD_TICKS, then eases back to rest by BOUNCE_TICKS.
 */
const BOUNCE_HOLD_TICKS = 2;
const BOUNCE_TICKS = 9;
const BOUNCE_SQUASH_AMOUNT = 0.2;

/** The place-up flash fills the sprite white for this many ticks, once. */
export const PLACE_FLASH_TICKS = 4;

/** What the sprite shows at a world tick. */
interface RacerLook {
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

/** Tracks one racer's kick, flap, bounce and place-up moments. */
interface RacerMoments {
  /**
   * Records a `racer.kicked`, `racer.flapped` or `racer.rebounded` for this racer and its own `player.place` that gains a
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
  let bouncedAt = Number.NEGATIVE_INFINITY;
  let bounceAxis: 'x' | 'y' = 'x';
  let placeGainedAt = Number.NEGATIVE_INFINITY;
  let current = place;
  return {
    onEvents(events, tick) {
      for (const event of events) {
        if (event.type === 'racer.kicked' && event.id === id) kickedAt = tick;
        if (event.type === 'racer.flapped' && event.id === id) flappedAt = tick;
        if (event.type === 'racer.rebounded' && event.id === id) {
          bouncedAt = tick;
          bounceAxis = event.axis;
        }
        if (event.type === 'player.place' && event.id === id && id === local) {
          if (event.place < current) placeGainedAt = tick;
          current = event.place;
        }
      }
    },
    look(tick, reducedMotion) {
      if (reducedMotion) return { stretch: 0, axis: null, flashing: false };
      const sinceFlash = tick - placeGainedAt;
      const flashing = sinceFlash >= 0 && sinceFlash < PLACE_FLASH_TICKS;
      // The latest of a kick, a flap and a bounce shapes the sprite, so a new moment shows at once.
      // A bounce wins a tie: within a tick the wall stops the racer after its intent kicked or
      // flapped, so a dash into a wall ends in the squash.
      if (bouncedAt >= kickedAt && bouncedAt >= flappedAt) {
        const stretch = bounceStretchAt(tick - bouncedAt);
        return { stretch, axis: stretch === 0 ? null : bounceAxis, flashing };
      }
      const stretch = flappedAt > kickedAt ? flapStretchAt(tick - flappedAt) : kickStretchAt(tick - kickedAt);
      return { stretch, axis: null, flashing };
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

/**
 * Stretch along the bounce's axis `ticksSinceBounce` after a bounce: squashed against the wall for
 * BOUNCE_HOLD_TICKS, easing back to nothing by BOUNCE_TICKS.
 */
function bounceStretchAt(ticksSinceBounce: number): number {
  if (ticksSinceBounce < 0 || ticksSinceBounce >= BOUNCE_TICKS) return 0;
  if (ticksSinceBounce < BOUNCE_HOLD_TICKS) return -BOUNCE_SQUASH_AMOUNT;
  return -BOUNCE_SQUASH_AMOUNT * (1 - (ticksSinceBounce - BOUNCE_HOLD_TICKS) / (BOUNCE_TICKS - BOUNCE_HOLD_TICKS));
}
