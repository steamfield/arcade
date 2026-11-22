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
import { length } from '../num.ts';
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
  /** ...and within 30 degrees of the aim: cos(30°), written out so no engine trig runs. */
  aimConeCos: 0.8660254037844386,
  /**
   * Lantern: a racer just ahead and this close, so a rival saves its flash for a pass instead of
   * firing it whenever anyone is in range.
   */
  lanternTiles: FLASH.rangeTiles / 2,
  /** Puffer: unbroken coral within this many steps down the smash field. */
  pufferCoralSteps: 3,
  /** Jet Fins: this many tiles of clear water straight along the aim. */
  jetClearTiles: 5,
  /**
   * A burst fires everything held, so while Jet Fins are in the stack every burst dashes. A dash
   * from behind is runaway speed, so holding Jet Fins scales the burst chance by this.
   */
  jetChanceMul: 0.02,
} as const;

/**
 * True when the racer should burst this tick: its burst is ready, at least one held kind has a use,
 * and `roll` is under its chance: `profile.itemAggression`, times ITEM_USE.jetChanceMul while it
 * holds Jet Fins. Uses: inkSac, a racer behind (higher progress) within 4
 * tiles; bubbleShield, a racer ahead within 6 tiles inside the aim cone; glowLantern, a racer ahead
 * within 2 tiles; puffer, unbroken coral on the smash-field path within 3 tiles; jetFin, a clear
 * straight path of 5 tiles along the aim.
 *
 * @param aim The unit aim `rivalIntent` chose this tick.
 * @param roll The tick's item draw from the racer's rng, in [0, 1).
 */
export function wantsBurst(world: World, racer: Racer, aim: Vec, roll: number): boolean {
  const chance = racer.profile.itemAggression * (racer.stack.includes('jetFin') ? ITEM_USE.jetChanceMul : 1);
  if (racer.stack.length === 0 || racer.burstCooldown > 0 || roll >= chance) return false;
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
      return othersNear(world, racer, ITEM_USE.lanternTiles).some((other) => other.progress < racer.progress);
    case 'puffer':
      return coralOnSmashPath(world, racer);
    case 'jetFin':
      return clearAhead(world, racer, aim);
    case 'homingSquid':
    case 'riptide':
    case 'undertow':
    case 'mimic':
      // Scaffold: rivals never hold the attack kinds (clam weight 0); lane 7/a adds their uses.
      return false;
  }
}

/**
 * Racers this one would aim at, in play and with centres within `tiles` of its centre. Rivals aim
 * at the player only, so their items land where the player sees them instead of in fights among
 * themselves; a bot driving the player aims at anyone.
 */
function othersNear(world: World, racer: Racer, tiles: number): Racer[] {
  const from = centreOf(racer);
  return activeRacers(world).filter((other) => {
    if (other.id === racer.id) return false;
    if (racer.id !== 'player' && other.id !== 'player') return false;
    const dx = centreOf(other).x - from.x;
    const dy = centreOf(other).y - from.y;
    const reach = tiles * TILE;
    return dx * dx + dy * dy <= reach * reach;
  });
}

function inAimCone(racer: Racer, aim: Vec, other: Racer): boolean {
  const from = centreOf(racer);
  const to = centreOf(other);
  const lengths = length(to.x - from.x, to.y - from.y) * length(aim.x, aim.y);
  if (lengths === 0) return false;
  return ((to.x - from.x) * aim.x + (to.y - from.y) * aim.y) / lengths >= ITEM_USE.aimConeCos;
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
