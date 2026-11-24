/**
 * Whirlpools, Reef's set piece: swirls of water that push racers inside them round their centres
 * (`LevelDef.whirlpools`). Reading them from the course and the push they give live here.
 */
import { errorAt } from '../level/level-error.ts';
import { length } from '../num.ts';
import { centreOf } from '../racers.ts';
import { type Cell, type Racer, TILE, type Vec, type WhirlpoolDef, type World } from '../types.ts';

/** Bound authored force at vent strength, with an inward pull well below swim thrust. */
export const WHIRLPOOL = { minRadius: 2, maxRadius: 10, maxPush: 480, inwardShare: 0.1, maxInward: 24 } as const;

/**
 * Checks a level's whirlpools against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a centre off the map or not open water, a radius outside 2-10, a push that
 *   isn't finite and in (0, 480], a spin other than 1 or -1, or two pools whose discs overlap.
 */
export function parseWhirlpools(defs: readonly WhirlpoolDef[], cells: readonly (readonly Cell[])[]): WhirlpoolDef[] {
  const pools: WhirlpoolDef[] = [];
  for (const def of defs) {
    const { col, row, radius, spin, push } = def;
    const cell = cells[row]?.[col];
    if (cell === undefined) throw errorAt('Whirlpool centre is off the map', row, col);
    if (cell !== 'water') throw errorAt('Whirlpool centre must be in open water', row, col);
    if (!(radius >= WHIRLPOOL.minRadius && radius <= WHIRLPOOL.maxRadius)) {
      throw errorAt(`Whirlpool radius ${radius} must be ${WHIRLPOOL.minRadius}–${WHIRLPOOL.maxRadius} tiles`, row, col);
    }
    if (!Number.isFinite(push) || push <= 0 || push > WHIRLPOOL.maxPush) {
      throw errorAt(`Whirlpool push ${push} must be positive and at most ${WHIRLPOOL.maxPush} px/s²`, row, col);
    }
    if (spin !== 1 && spin !== -1) throw errorAt(`Whirlpool spin ${spin} must be 1 or -1`, row, col);
    const overlap = pools.findIndex((pool) => length(col - pool.col, row - pool.row) < radius + pool.radius);
    if (overlap >= 0) throw errorAt(`Whirlpool disc overlaps whirlpool ${overlap}`, row, col);
    pools.push({ col, row, radius, spin, push });
  }
  return pools;
}

/**
 * Flow acceleration (px/s²) at a world point, or null at and beyond the rim. The same sample works
 * for swimming and for tile prices. The parabola peaks halfway out, easing to zero at the eye and rim.
 */
export function whirlpoolFlowAt(pool: WhirlpoolDef, point: Vec): Vec | null {
  const dx = point.x - (pool.col + 0.5) * TILE;
  const dy = point.y - (pool.row + 0.5) * TILE;
  const distance = length(dx, dy);
  const fraction = distance / (pool.radius * TILE);
  if (fraction >= 1) return null;
  if (distance === 0) return { x: 0, y: 0 };
  const profile = 4 * fraction * (1 - fraction);
  const tangent = profile * pool.push * pool.spin;
  const inward = profile * Math.min(pool.push * WHIRLPOOL.inwardShare, WHIRLPOOL.maxInward);
  const x = dx / distance;
  const y = dy / distance;
  return { x: -y * tangent - x * inward, y: x * tangent - y * inward };
}

/** Pushes swimmers round their pool, announcing each entry on its first tick. */
export function swirlWhirlpools(world: World, racing: readonly Racer[], dt: number): void {
  const pools = world.level.whirlpools;
  if (pools.length === 0) return;
  const occupants: NonNullable<World['whirlpoolOccupants']> = {};
  for (const racer of racing) {
    if (racer.finished !== null || racer.status.fallen > 0) continue;
    const point = centreOf(racer);
    for (const [index, pool] of pools.entries()) {
      const flow = whirlpoolFlowAt(pool, point);
      if (!flow) continue;
      occupants[racer.id] = index;
      if (world.whirlpoolOccupants?.[racer.id] !== index) {
        world.events.emit({ type: 'whirlpool.caught', racer: racer.id, pool: index });
      }
      if (racer.status.trapped === 0) {
        racer.body.vx += flow.x * dt;
        racer.body.vy += flow.y * dt;
      }
      break;
    }
  }
  world.whirlpoolOccupants = occupants;
}
