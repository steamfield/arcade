/**
 * Whirlpools, Reef's set piece: swirls of water that push racers inside them round their centres
 * (`LevelDef.whirlpools`). Reading them from the course and the push they give live here.
 */
import { errorAt, requireTile } from '../level/level-error.ts';
import { length } from '../num.ts';
import { centreOf } from '../racers.ts';
import { type Cell, type Racer, TILE, type Vec, type WhirlpoolDef, type World } from '../types.ts';

export const WHIRLPOOL = {
  /** Smallest allowed radius, in tiles. */
  minRadius: 2,
  /** Largest allowed radius, in tiles. */
  maxRadius: 10,
  /**
   * Peak tangential acceleration in px/s², a vent's push. Escape alone doesn't bound it: a very strong
   * pool flings a swimmer out of its rim, so the cap keeps authored pools within what steering can
   * read. The escape test holds one outward direction as Baron at this bound.
   */
  maxPush: 480,
  /** Inward fraction of the tangential push, enough to make the current feel like a drain. */
  inwardShare: 0.1,
  /** Peak inward acceleration in px/s², capped well below the weakest swimmer's thrust so it can steer out. */
  maxInward: 24,
} as const;

/**
 * Checks a level's whirlpools against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a fractional, off-map or non-water centre, a radius or push outside
 *   the allowed bounds, a spin other than 1 or -1, or two pools whose discs overlap.
 */
export function parseWhirlpools(defs: readonly WhirlpoolDef[], cells: readonly (readonly Cell[])[]): WhirlpoolDef[] {
  const pools: WhirlpoolDef[] = [];
  for (const [index, def] of defs.entries()) {
    const { col, row, radius, spin, push } = def;
    const name = `Whirlpool ${index}`;
    const cell = requireTile(cells, `${name} tile`, row, col);
    if (cell !== 'water') throw errorAt(`${name} centre: expected open water, got ${cell}`, row, col);
    if (!(radius >= WHIRLPOOL.minRadius && radius <= WHIRLPOOL.maxRadius)) {
      throw errorAt(
        `${name} radius: expected ${WHIRLPOOL.minRadius}–${WHIRLPOOL.maxRadius} tiles, got ${radius}`,
        row,
        col,
      );
    }
    if (!Number.isFinite(push) || push <= 0 || push > WHIRLPOOL.maxPush) {
      throw errorAt(`${name} push: expected more than 0 and at most ${WHIRLPOOL.maxPush} px/s², got ${push}`, row, col);
    }
    if (spin !== 1 && spin !== -1) throw errorAt(`${name} spin: expected 1 or -1, got ${spin}`, row, col);
    for (const [other, pool] of pools.entries()) {
      const distance = length(col - pool.col, row - pool.row);
      const separation = radius + pool.radius;
      if (distance >= separation) continue;
      throw errorAt(
        `${name} separation from whirlpool ${other}: expected at least ${separation} tiles, got ${distance} tiles`,
        row,
        col,
      );
    }
    pools.push({ col, row, radius, spin, push });
  }
  return pools;
}

/**
 * Flow acceleration (px/s²) at a world point, or null at and beyond the rim.
 * The `tangent` component lets navigation price how much the spin helps or hinders a move.
 */
export function whirlpoolFlowAt(pool: WhirlpoolDef, point: Vec, component: 'total' | 'tangent' = 'total'): Vec | null {
  const dx = point.x - (pool.col + 0.5) * TILE;
  const dy = point.y - (pool.row + 0.5) * TILE;
  const distance = length(dx, dy);
  const fraction = distance / (pool.radius * TILE);
  if (fraction >= 1) return null;
  if (distance === 0) return { x: 0, y: 0 };
  // The parabola 4u(1-u) keeps a strong band halfway out and eases the force to zero at the eye and rim.
  const profile = 4 * fraction * (1 - fraction);
  const tangent = profile * pool.push * pool.spin;
  const inward =
    component === 'tangent' ? 0 : profile * Math.min(pool.push * WHIRLPOOL.inwardShare, WHIRLPOOL.maxInward);
  const x = dx / distance;
  const y = dy / distance;
  return { x: -y * tangent - x * inward, y: x * tangent - y * inward };
}

/** Pushes swimmers round their pool, announcing each entry on its first tick. */
export function swirlWhirlpools(world: World, racing: readonly Racer[], dt: number): void {
  const pools = world.level.whirlpools;
  if (pools.length === 0) return;
  const riders: World['whirlpoolRiders'] = {};
  for (const racer of racing) {
    if (racer.finished !== null || racer.status.fallen > 0) continue;
    const point = centreOf(racer);
    for (const [index, pool] of pools.entries()) {
      const flow = whirlpoolFlowAt(pool, point);
      if (!flow) continue;
      riders[racer.id] = index;
      if (world.whirlpoolRiders[racer.id] !== index) {
        world.events.emit({ type: 'whirlpool.caught', racer: racer.id, pool: index });
      }
      if (racer.status.trapped === 0) {
        racer.body.vx += flow.x * dt;
        racer.body.vy += flow.y * dt;
      }
      break;
    }
  }
  world.whirlpoolRiders = riders;
}
