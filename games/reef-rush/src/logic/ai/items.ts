/**
 * When a computer racer bursts its power-ups. `rivalIntent` asks every tick with
 * that tick's item draw (its fourth, taken holding or not); this module only
 * reads the world.
 *
 * Distances are between racer centres, in tiles. "Ahead" and "behind" compare
 * progress (lower is ahead). The bubble's aim cone is ITEM_USE.aimConeCos either
 * side of the aim. Jet Fins need the whole body to slide 5 tiles along the aim.
 */
import { cellAt, isSolid } from '../level/query.ts';
import { FLASH } from '../powerups/tuning.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { type PowerUpKind, type Racer, TILE, type Vec, type World } from '../types.ts';
import { downhillPath, hasClearSweep, openTiles, tileOf } from './steer.ts';

/** How near a use has to be before a rival spends its burst on it. */
export const ITEM_USE = {
  /** Ink: a racer behind within this many tiles. */
  inkBehindTiles: 4,
  /** Bubble: a racer ahead within this many tiles... */
  bubbleAheadTiles: 6,
  /** ...and within about 30 degrees of the aim (cosine of the half-angle). */
  aimConeCos: Math.cos(Math.PI / 6),
  /** Lantern: any racer as close as the flash reaches. */
  lanternTiles: FLASH.rangeTiles,
  /** Puffer: unbroken coral within this many steps down the smash field. */
  pufferCoralSteps: 3,
  /** Jet Fins: this many tiles of clear water straight along the aim. */
  jetClearTiles: 5,
} as const;

/**
 * True when the racer should burst this tick: its burst is ready, `roll < profile.itemAggression`,
 * and at least one held kind has a use. Uses: inkSac, a racer behind (higher progress) within 4
 * tiles; bubbleShield, a racer ahead within 6 tiles inside the aim cone; glowLantern, any racer
 * within 4 tiles; puffer, unbroken coral on the smash-field path within 3 tiles; jetFin, a clear
 * straight path of 5 tiles along the aim.
 *
 * @param aim The unit aim `rivalIntent` chose this tick.
 * @param roll The tick's item draw from the racer's rng, in [0, 1).
 */
export function wantsBurst(world: World, racer: Racer, aim: Vec, roll: number): boolean {
  if (racer.stack.length === 0 || racer.burstCooldown > 0 || roll >= racer.profile.itemAggression) return false;
  return racer.stack.some((kind) => hasUse(world, racer, aim, kind));
}

function hasUse(world: World, racer: Racer, aim: Vec, kind: PowerUpKind): boolean {
  switch (kind) {
    case 'inkSac':
      return othersNear(world, racer, ITEM_USE.inkBehindTiles).some((other) => other.progress > racer.progress);
    case 'bubbleShield':
      return othersNear(world, racer, ITEM_USE.bubbleAheadTiles).some(
        (other) => other.progress < racer.progress && inAimCone(racer, aim, other),
      );
    case 'glowLantern':
      return othersNear(world, racer, ITEM_USE.lanternTiles).length > 0;
    case 'puffer':
      return coralOnSmashPath(world, racer);
    case 'jetFin':
      return clearAhead(world, racer, aim);
  }
}

/** Other racers in play whose centres are within `tiles` of this racer's centre. */
function othersNear(world: World, racer: Racer, tiles: number): Racer[] {
  const from = centreOf(racer);
  return activeRacers(world).filter((other) => {
    if (other.id === racer.id) return false;
    const to = centreOf(other);
    return Math.hypot(to.x - from.x, to.y - from.y) <= tiles * TILE;
  });
}

function inAimCone(racer: Racer, aim: Vec, other: Racer): boolean {
  const from = centreOf(racer);
  const to = centreOf(other);
  const length = Math.hypot(to.x - from.x, to.y - from.y) * Math.hypot(aim.x, aim.y);
  if (length === 0) return false;
  return ((to.x - from.x) * aim.x + (to.y - from.y) * aim.y) / length >= ITEM_USE.aimConeCos;
}

function coralOnSmashPath(world: World, racer: Racer): boolean {
  const { fields, level, broken } = world;
  const start = tileOf(centreOf(racer));
  const path = downhillPath(fields.smash, fields, openTiles(level, broken, true), start, ITEM_USE.pufferCoralSteps);
  return path.some((tile) => cellAt(level, tile.x, tile.y) === 'coral' && isSolid(level, broken, tile.x, tile.y));
}

function clearAhead(world: World, racer: Racer, aim: Vec): boolean {
  if (aim.x === 0 && aim.y === 0) return false;
  const centre = centreOf(racer);
  const reach = ITEM_USE.jetClearTiles * TILE;
  const to = { x: centre.x + aim.x * reach, y: centre.y + aim.y * reach };
  return hasClearSweep(world.level, world.broken, racer.body, to);
}
