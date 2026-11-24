/**
 * Reads movement moments that logic emits no event for out of world state, by comparing each
 * racer's body with the tick before: a runner landing, a runner turning hard on the ground, a flyer
 * diving and a drifter burning its thrusters. Media keep their own state private (`media/types.ts`),
 * so everything here comes from the body alone. A body standing on a floor has its vertical speed
 * zeroed by the move every tick, which is what tells ground from air.
 */
import type { Racer, World } from '../../logic/types.ts';

/** A movement moment one racer had this tick. */
export type SensedMoment = 'land' | 'skid' | 'dive' | 'thrust';

/** What a racer's body was doing the tick before, as `sense` remembers it. */
export interface BodyBefore {
  vx: number;
  vy: number;
  facing: 1 | -1;
}

/** A runner falling slower than this (px/s) the tick before it stops shows no landing: a step down, not a fall. */
const LAND_MIN_FALL = 60;
/** A runner turning round on the ground faster than this (px/s) the old way skids. */
const SKID_SPEED = 50;
/** A flyer falling faster than this (px/s) is diving. */
const DIVE_SPEED = 150;
/**
 * A drifter whose speed fell by less than this (px/s) in a tick is holding or gaining speed, so it is
 * burning: idle drag alone takes about 0.37 px/s a tick off, a burn at cruise none.
 */
const THRUST_HOLD = 0.3;
/** Below this speed (px/s) a drifter is at rest and shows no burn. */
const THRUST_MIN_SPEED = 10;
/** A change of velocity smaller than this (px/s) in a tick is a steady burn, which points along the velocity. */
const TURNING_BURN = 0.5;

/** True when a body that was falling at `before` px/s came to rest on something this tick. */
export function hasLanded(beforeVy: number, nowVy: number): boolean {
  return beforeVy > LAND_MIN_FALL && nowVy === 0;
}

/** True when `racer`, a runner on the ground, turned to face against the way it is still sliding. */
export function isSkidding(before: BodyBefore, racer: Racer): boolean {
  const { vx, vy } = racer.body;
  return vy === 0 && racer.facing !== before.facing && Math.sign(vx) === -racer.facing && Math.abs(vx) > SKID_SPEED;
}

/** True when a flyer falling at `vy` px/s is diving. */
export function isDiving(vy: number): boolean {
  return vy > DIVE_SPEED;
}

/**
 * The unit direction a drifter is burning toward, from its velocity the tick before and now, or
 * null when it is coasting. Well pull and solar wind also add speed, so they read as a burn too.
 */
export function burnDirection(before: BodyBefore, racer: Racer): { x: number; y: number } | null {
  const { vx, vy } = racer.body;
  const speed = Math.hypot(vx, vy);
  if (speed < THRUST_MIN_SPEED || speed < Math.hypot(before.vx, before.vy) - THRUST_HOLD) return null;
  const changeX = vx - before.vx;
  const changeY = vy - before.vy;
  const change = Math.hypot(changeX, changeY);
  if (change > TURNING_BURN) return { x: changeX / change, y: changeY / change };
  return { x: vx / speed, y: vy / speed };
}

/** Which moments a racer moving in `medium` can have; swimmers have none here (they keep their trail). */
const MOMENTS_BY_MEDIUM: Readonly<Record<string, readonly SensedMoment[]>> = {
  run: ['land', 'skid'],
  flight: ['dive'],
  drift: ['thrust'],
};

/** The moments racers in `medium` are watched for. */
export function momentsFor(medium: string): readonly SensedMoment[] {
  return MOMENTS_BY_MEDIUM[medium] ?? [];
}

/** True when `racer` is moving under its own power this tick: in play, not finished, not held in a bubble. */
export function isMovingFreely(racer: Racer): boolean {
  return !racer.finished && racer.status.fallen === 0 && racer.status.trapped === 0;
}

/** Remembers every racer's body between ticks and reports the moments each had. */
export interface MovementSense {
  /**
   * Calls `visit` for each moment a racer in `world` had since the last call, with the direction it
   * points (a burn's direction, a dive's velocity, a skid's slide), then remembers the bodies.
   */
  sense(world: World, visit: (racer: Racer, moment: SensedMoment, dirX: number, dirY: number) => void): void;
}

/** Creates a sense that has seen no tick yet, so the first call reports nothing. */
export function createMovementSense(): MovementSense {
  const before = new Map<Racer, BodyBefore>();
  return {
    sense(world, visit) {
      const watched = momentsFor(world.medium);
      for (const racer of world.racers) {
        const seen = before.get(racer);
        if (seen && isMovingFreely(racer)) for (const moment of watched) report(moment, seen, racer, visit);
        remember(before, racer);
      }
    },
  };
}

/** Calls `visit` when `racer` had `moment` since `seen`. */
function report(
  moment: SensedMoment,
  seen: BodyBefore,
  racer: Racer,
  visit: (racer: Racer, moment: SensedMoment, dirX: number, dirY: number) => void,
): void {
  const { vx, vy } = racer.body;
  if (moment === 'land' && hasLanded(seen.vy, vy)) visit(racer, moment, Math.sign(vx), 0);
  if (moment === 'skid' && isSkidding(seen, racer)) visit(racer, moment, Math.sign(vx), 0);
  if (moment === 'dive' && isDiving(vy)) {
    const speed = Math.hypot(vx, vy);
    visit(racer, moment, vx / speed, vy / speed);
  }
  if (moment === 'thrust') {
    const burn = burnDirection(seen, racer);
    if (burn) visit(racer, moment, burn.x, burn.y);
  }
}

/** Stores `racer`'s body as it is now, reusing its record. */
function remember(before: Map<Racer, BodyBefore>, racer: Racer): void {
  const record = before.get(racer);
  if (!record) {
    before.set(racer, { vx: racer.body.vx, vy: racer.body.vy, facing: racer.facing });
    return;
  }
  record.vx = racer.body.vx;
  record.vy = racer.body.vy;
  record.facing = racer.facing;
}
