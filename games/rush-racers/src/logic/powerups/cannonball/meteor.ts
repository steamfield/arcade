/**
 * Cloudreach's Meteor: fired, it marks the race leader (never its owner) with a shadow for a warning, then falls on them from the top of the sky, hitting them (cause 'meteor') unless they dodge out from under it.
 *
 * A Meteor shot's fields: `target` is the racer it marks; `phase` counts the warning ticks left
 * (`METEOR.warnTicks` down to 0, falling at 0). While warning, (`x`, `y`) is the shadow's mark: where
 * the target will be when the meteor reaches its height if it keeps its speed, followed each tick
 * until the last `METEOR.lockTicks`, which hold it still. Falling, (`x`, `y`) is the meteor's centre
 * and `vy` its fall speed. `ttl` is a backstop; a meteor always lands first.
 */
import { TICK_DT } from '@arcade/core';
import { mayAttack } from '../../difficulty-level.ts';
import { applyHit } from '../../hazards/hits.ts';
import { isSolid } from '../../level/query.ts';
import { length } from '../../num.ts';
import { breakCoral } from '../../race/coral.ts';
import { centreOf } from '../../racers.ts';
import { type Racer, type Shot, TILE, type Vec, type World } from '../../types.ts';
import type { CannonballShotRules } from './index.ts';

/** The Meteor's numbers. */
export const METEOR_TUNING = {
  /** Ticks the shadow shows before the meteor falls. */
  warnTicks: 60,
  /** The last ticks of the warning, in which the shadow stops following its target. */
  lockTicks: 15,
  /** Fall speed, px/s. */
  fallSpeed: 600,
  /** A racer whose centre comes within this of the meteor's centre is hit, px. */
  hitRadius: 1.5 * TILE,
  /** Ticks after firing at which a meteor still in the air ends anyway. */
  ttlTicks: 600,
} as const;

/** How the meteor style fires, flies and is chosen by rivals. */
export const METEOR: CannonballShotRules = {
  fire: fireMeteor,
  advance: advanceMeteor,
  breaksCoral: false,
  rivalWants(world: World, racer: Racer): boolean {
    const target = meteorTarget(world, racer);
    return target !== null && target.place < racer.place;
  },
};

/**
 * The racer a meteor fired by `owner` marks: the best placed racer other than the owner that is
 * still in play (not finished, not fallen out of the sky) and that the owner may attack
 * (`mayAttack`, so an Easy rival never marks a human). Null when there is none.
 */
export function meteorTarget(world: World, owner: Racer): Racer | null {
  const candidates = world.racers.filter(
    (racer) =>
      racer.id !== owner.id && !racer.finished && racer.status.fallen === 0 && mayAttack(world, owner.id, racer.id),
  );
  return candidates.reduce<Racer | null>((best, racer) => (best && best.place <= racer.place ? best : racer), null);
}

/**
 * Marks the leader for a meteor (`meteorTarget`): pushes the shot with its shadow on the target and
 * emits `shot.launched` then `shot.warned`. With no one to mark it fizzles: `shot.ended` at the
 * owner's centre and nothing else; the charge is spent either way.
 */
function fireMeteor(world: World, racer: Racer): void {
  const target = meteorTarget(world, racer);
  const owner = racer.id;
  if (!target) {
    world.events.emit({ type: 'shot.ended', owner, style: 'meteor', ...centreOf(racer) });
    return;
  }
  const mark = centreOf(target);
  world.shots.push({
    style: 'meteor',
    owner,
    ...mark,
    vx: 0,
    vy: 0,
    ttl: METEOR_TUNING.ttlTicks,
    target: target.id,
    phase: METEOR_TUNING.warnTicks,
  });
  world.events.emit({ type: 'shot.launched', owner, style: 'meteor', target: target.id });
  world.events.emit({ type: 'shot.warned', owner, style: 'meteor', target: target.id });
}

/** One tick of a meteor: the warning, or the fall. Returns false once it has ended. */
function advanceMeteor(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
  shot.ttl -= 1;
  if (shot.ttl <= 0) return endMeteor(world, shot);
  if (shot.phase > 0) {
    warn(world, shot);
    return true;
  }
  return fall(world, shot, racing, dt);
}

/** A warning tick: the shadow follows its target unless locked, then the meteor starts falling once the warning is over. */
function warn(world: World, shot: Shot): void {
  if (shot.phase > METEOR_TUNING.lockTicks) followTarget(world, shot);
  shot.phase -= 1;
  if (shot.phase > 0) return;
  shot.y = skyTopAbove(world, shot.x, shot.y);
  shot.vy = METEOR_TUNING.fallSpeed;
}

/**
 * Moves the shadow's mark to where the target will be when the meteor reaches it (`ledMark`). A
 * target that has fallen out of the sky or finished leaves the mark where it was.
 */
function followTarget(world: World, shot: Shot): void {
  const target = world.racers.find((racer) => racer.id === shot.target);
  if (!target || target.finished || target.status.fallen > 0) return;
  const at = centreOf(target);
  shot.x = ledMark(world, at, target.body.vx);
  shot.y = at.y;
}

/**
 * Where along its tile row a target at `at` moving at `vx` px/s will be when a meteor marked there
 * reaches its height. How long the meteor takes depends on the column it falls in (a roof shortens
 * the fall), so each open column the target could reach is tried: the target's position when a meteor
 * over that column arrives (`leadSeconds`), kept inside the column. The column where that comes
 * closest to the target's own position wins, the nearest on a tie. The search stops short of the
 * first solid tile on the row (`markAlongRow`), which the target can't fly through.
 */
function ledMark(world: World, at: Vec, vx: number): number {
  if (vx === 0) return at.x;
  const furthest = markAlongRow(world, at, vx * (METEOR_TUNING.lockTicks * TICK_DT + at.y / METEOR_TUNING.fallSpeed));
  const [near, far] = vx > 0 ? [at.x, furthest] : [furthest, at.x];
  let best = { x: at.x, miss: Number.POSITIVE_INFINITY };
  for (let column = Math.floor(near / TILE); column <= Math.floor(far / TILE); column++) {
    const lo = Math.max(near, column * TILE);
    const hi = Math.min(far, (column + 1) * TILE - 1);
    const arrives = at.x + vx * leadSeconds(world, (lo + hi) / 2, at.y);
    const x = Math.min(hi, Math.max(lo, arrives));
    const miss = Math.abs(arrives - x);
    // Scanning toward the target when it flies left, so the nearest column wins ties either way.
    if (miss < best.miss || (miss === best.miss && vx < 0)) best = { x, miss };
  }
  return best.x;
}

/** Seconds until a meteor marked over (`x`, `y`) reaches that height: the lock, then the fall from the sky's top above it. */
function leadSeconds(world: World, x: number, y: number): number {
  const dropPx = y - skyTopAbove(world, x, y);
  return METEOR_TUNING.lockTicks * TICK_DT + dropPx / METEOR_TUNING.fallSpeed;
}

/**
 * `at.x` moved `shiftPx` along `at`'s tile row, stopped in the last open tile before the first solid
 * one on the way. Off the grid's sides is rock, so the mark always stays on the map.
 */
function markAlongRow(world: World, at: Vec, shiftPx: number): number {
  const step = Math.sign(shiftPx);
  const row = Math.floor(at.y / TILE);
  const goal = at.x + shiftPx;
  const lastColumn = Math.floor(goal / TILE);
  for (let column = Math.floor(at.x / TILE); column !== lastColumn; column += step) {
    const next = column + step;
    if (!isSolid(world.level, world.broken, next, row)) continue;
    // The edge of the open tile `column` that faces the solid one.
    return step > 0 ? next * TILE - 1 : column * TILE;
  }
  return goal;
}

/**
 * A falling tick: drops the meteor, hits every racer within `hitRadius` but its owner, and ends it on
 * the first solid tile it reaches, popping that tile if it is a puff cloud.
 */
function fall(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
  shot.y += shot.vy * dt;
  const tx = Math.floor(shot.x / TILE);
  const ty = Math.floor(shot.y / TILE);
  const landed = isSolid(world.level, world.broken, tx, ty);
  if (landed) shot.y = ty * TILE;
  strike(world, shot, racing);
  if (!landed) return true;
  breakCoral(world, tx, ty, shot.owner);
  return endMeteor(world, shot);
}

/** Hits every racer in `racing` other than the owner whose centre is within `hitRadius`; `applyHit` skips the invulnerable, the fallen and anyone the owner may not attack. */
function strike(world: World, shot: Shot, racing: readonly Racer[]): void {
  for (const racer of racing) {
    if (racer.id === shot.owner) continue;
    const at = centreOf(racer);
    if (length(at.x - shot.x, at.y - shot.y) > METEOR_TUNING.hitRadius) continue;
    applyHit(world, racer, 'meteor', shot.owner, { x: shot.x, y: shot.y });
  }
}

function endMeteor(world: World, shot: Shot): false {
  world.events.emit({ type: 'shot.ended', owner: shot.owner, style: 'meteor', x: shot.x, y: shot.y });
  return false;
}

/**
 * The top of the open sky straight above (`x`, `y`), px: the top edge of the highest tile in the
 * unbroken run of open tiles from (`x`, `y`) up. A point inside a solid tile, such as a tower, first
 * climbs out through the solid run above it, so a meteor marked there falls onto the tower's top. A
 * column solid all the way up gives the level's top edge.
 */
export function skyTopAbove(world: World, x: number, y: number): number {
  const tx = Math.floor(x / TILE);
  const solid = (ty: number) => isSolid(world.level, world.broken, tx, ty);
  let ty = Math.floor(y / TILE);
  while (ty > 0 && solid(ty)) ty -= 1;
  if (solid(ty)) return 0;
  while (ty > 0 && !solid(ty - 1)) ty -= 1;
  return ty * TILE;
}

/**
 * Where a meteor over `x` falling from `y` will land, px: the top edge of the first solid tile at or
 * below (`x`, `y`). The level's bottom edge when nothing solid lies under it, as off the grid is rock.
 */
export function groundBelow(world: World, x: number, y: number): Vec {
  const tx = Math.floor(x / TILE);
  let ty = Math.floor(y / TILE);
  while (!isSolid(world.level, world.broken, tx, ty)) ty += 1;
  return { x, y: ty * TILE };
}
