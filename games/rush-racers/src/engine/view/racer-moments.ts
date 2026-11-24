/**
 * The one-off moments a racer's sprite plays: the kick squash-and-stretch, the flap's wing-stroke
 * squash, the bounce's squash against the wall it hit, a jump's stretch tall, a landing's squat
 * and, for the local racer (the slot the screen follows), the white flash on gaining a place. All
 * come from events except the landing, which the view reads from world state and reports. Timed in world ticks, the same clock `sync`
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

/** A jump stretches the sprite tall and thin by JUMP_STRETCH_AMOUNT, easing back to rest by JUMP_TICKS. */
const JUMP_TICKS = 10;
const JUMP_STRETCH_AMOUNT = 0.2;

/** A landing squats the sprite short and wide for LAND_HOLD_TICKS, then eases back to rest by LAND_TICKS. */
const LAND_HOLD_TICKS = 2;
const LAND_TICKS = 9;
const LAND_SQUASH_AMOUNT = 0.25;

/** The place-up flash fills the sprite white for this many ticks, once. */
export const PLACE_FLASH_TICKS = 4;

/** What the sprite shows at a world tick. */
export interface RacerLook {
  /** Stretch along the kick's axis: negative while squashed, positive while stretched, 0 at rest. */
  stretch: number;
  /**
   * The axis the stretch runs along when the moment names one: a bounce ('x' off a wall, 'y' off a
   * floor or ceiling), a jump or a landing ('y'). Null for a kick or a flap, where the view uses the
   * axis the racer kicked on, and at rest.
   */
  axis: 'x' | 'y' | null;
  /** True while the place-up flash fills the sprite white. */
  flashing: boolean;
}

/** Tracks one racer's kick, flap, bounce, jump, landing and place-up moments. */
export interface RacerMoments {
  /**
   * Records a `racer.kicked`, `racer.flapped`, `racer.rebounded` or `racer.jumped` for this racer and
   * its own `player.place` that gains a place, at world tick `tick`.
   */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /** Records that this racer came down onto the ground at world tick `tick`. */
  onLanded(tick: number): void;
  /** The look at world tick `tick`. Reduced motion drops the stretch and the flash. */
  look(tick: number, reducedMotion: boolean): RacerLook;
}

/**
 * Moments for racer `id`, starting in `place`. Only the local racer flashes.
 *
 * @param local The slot the screen follows; 'player' when omitted.
 */
export function createRacerMoments(id: RacerId, place: number, local: RacerId = 'player'): RacerMoments {
  const startedAt: Record<Shape, number> = {
    bounce: Number.NEGATIVE_INFINITY,
    land: Number.NEGATIVE_INFINITY,
    jump: Number.NEGATIVE_INFINITY,
    kick: Number.NEGATIVE_INFINITY,
    flap: Number.NEGATIVE_INFINITY,
  };
  let bounceAxis: 'x' | 'y' = 'x';
  let placeGainedAt = Number.NEGATIVE_INFINITY;
  let current = place;
  return {
    onEvents(events, tick) {
      for (const event of events) {
        if (event.type === 'player.place' && event.id === id && id === local) {
          if (event.place < current) placeGainedAt = tick;
          current = event.place;
        }
        if (!('id' in event) || event.id !== id) continue;
        if (event.type === 'racer.kicked') startedAt.kick = tick;
        if (event.type === 'racer.flapped') startedAt.flap = tick;
        if (event.type === 'racer.jumped') startedAt.jump = tick;
        if (event.type === 'racer.rebounded') {
          startedAt.bounce = tick;
          bounceAxis = event.axis;
        }
      }
    },
    onLanded(tick) {
      startedAt.land = tick;
    },
    look(tick, reducedMotion) {
      if (reducedMotion) return { stretch: 0, axis: null, flashing: false };
      const sinceFlash = tick - placeGainedAt;
      const flashing = sinceFlash >= 0 && sinceFlash < PLACE_FLASH_TICKS;
      const shape = latestShape(startedAt);
      const stretch = SHAPES[shape].stretchAt(tick - startedAt[shape]);
      const axis = stretch === 0 ? null : shape === 'bounce' ? bounceAxis : SHAPES[shape].axis;
      return { stretch, axis, flashing };
    },
  };
}

/** The moments that shape the sprite, in the order that wins a tie on one tick. */
type Shape = 'bounce' | 'land' | 'jump' | 'kick' | 'flap';

/**
 * A bounce wins a tie: within a tick the wall stops the racer after its intent kicked or flapped,
 * so a dash into a wall ends in the squash. A kick wins over a flap fired on the same tick.
 */
const TIE_ORDER: readonly Shape[] = ['bounce', 'land', 'jump', 'kick', 'flap'];

/** Each moment's stretch over time and the axis it runs along (null: the view's kick axis; a bounce names its own). */
const SHAPES: Readonly<Record<Shape, { stretchAt: (ticksSince: number) => number; axis: 'y' | null }>> = {
  bounce: { stretchAt: bounceStretchAt, axis: null },
  land: { stretchAt: landStretchAt, axis: 'y' },
  jump: { stretchAt: jumpStretchAt, axis: 'y' },
  kick: { stretchAt: kickStretchAt, axis: null },
  flap: { stretchAt: flapStretchAt, axis: null },
};

/** The moment that started last, so a new moment shows at once; ties go by TIE_ORDER. */
function latestShape(startedAt: Readonly<Record<Shape, number>>): Shape {
  let latest: Shape = 'bounce';
  for (const shape of TIE_ORDER) if (startedAt[shape] > startedAt[latest]) latest = shape;
  return latest;
}

/** Stretch `ticksSinceJump` after a jump: tall and thin at take-off, easing back to nothing by JUMP_TICKS. */
function jumpStretchAt(ticksSinceJump: number): number {
  if (ticksSinceJump < 0 || ticksSinceJump >= JUMP_TICKS) return 0;
  return JUMP_STRETCH_AMOUNT * (1 - ticksSinceJump / JUMP_TICKS);
}

/** Stretch `ticksSinceLanding` after a landing: squatting for LAND_HOLD_TICKS, easing back by LAND_TICKS. */
function landStretchAt(ticksSinceLanding: number): number {
  if (ticksSinceLanding < 0 || ticksSinceLanding >= LAND_TICKS) return 0;
  if (ticksSinceLanding < LAND_HOLD_TICKS) return -LAND_SQUASH_AMOUNT;
  return -LAND_SQUASH_AMOUNT * (1 - (ticksSinceLanding - LAND_HOLD_TICKS) / (LAND_TICKS - LAND_HOLD_TICKS));
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
