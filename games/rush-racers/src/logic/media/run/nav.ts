/**
 * Run's navigation: the links between stand tiles (`links.ts`) solved for the least ticks to the
 * finish, the best link out of each stand tile, and the stand tile every other open tile reads its
 * distance from. A tile in the air or over a pit has no links of its own, so progress and the guide
 * read the stand tile it falls to, or the nearest one on its row at a price.
 */
import { TICK_DT } from '@arcade/core';
import { isRockLike } from '../../level/query.ts';
import { PriorityQueue } from '../../race/priority-queue.ts';
import { type Cell, type Level, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { buildLinks, plannedSpeed } from './links.ts';
import { jumpAirTicks } from './physics.ts';
import { isSolidTile, type Terrain, terrainOf } from './terrain.ts';
import type { RunLink, RunNav } from './way-data.ts';

/** Ticks added to a tile over a pit for being in the air with nothing to land on: about a second. */
const OVER_PIT_PENALTY_TICKS = 60;

/** Every open tile costs the same; rock, bounce clouds and unbroken coral are closed. Run's `enterCost`. */
export const runCost = (cell: Cell, isBroken: boolean): number => {
  if (isRockLike(cell)) return Number.POSITIVE_INFINITY;
  if (cell === 'coral' && !isBroken) return Number.POSITIVE_INFINITY;
  return 1;
};

/**
 * Least ticks to the finish from every stand tile: Dijkstra from the stand tiles at or past the
 * finish column over the links, searched backwards.
 *
 * @returns Ticks by tile index, Infinity for tiles that are not stand tiles or can't reach the finish.
 */
function ticksToFinish(level: Level, links: ReadonlyMap<number, readonly RunLink[]>): Float64Array {
  const ticks = new Float64Array(level.width * level.height).fill(Number.POSITIVE_INFINITY);
  const incoming = new Map<number, { from: number; ticks: number }[]>();
  for (const [from, out] of links) {
    for (const link of out) {
      const edges = incoming.get(link.to) ?? [];
      edges.push({ from, ticks: link.ticks });
      incoming.set(link.to, edges);
    }
  }
  const frontier = new PriorityQueue<{ tile: number; cost: number }>();
  for (const tile of links.keys()) {
    if (tile % level.width < level.finishX) continue;
    ticks[tile] = 0;
    frontier.push(0, { tile, cost: 0 });
  }
  for (let next = frontier.pop(); next; next = frontier.pop()) {
    if (next.cost > (ticks[next.tile] ?? 0)) continue;
    for (const edge of incoming.get(next.tile) ?? []) {
      const reached = next.cost + edge.ticks;
      if (reached >= (ticks[edge.from] ?? 0)) continue;
      ticks[edge.from] = reached;
      frontier.push(reached, { tile: edge.from, cost: reached });
    }
  }
  return ticks;
}

/** The link out of each stand tile that gets to the finish soonest; the first of equals, walks before drops before jumps. */
function bestLinks(
  size: number,
  links: ReadonlyMap<number, readonly RunLink[]>,
  ticks: Float64Array,
): (RunLink | null)[] {
  const best = new Array<RunLink | null>(size).fill(null);
  for (const [from, out] of links) {
    if (ticks[from] === 0) continue;
    let least = Number.POSITIVE_INFINITY;
    for (const link of out) {
      const total = link.ticks + (ticks[link.to] ?? Number.POSITIVE_INFINITY);
      if (total >= least) continue;
      least = total;
      best[from] = link;
    }
  }
  return best;
}

/** The nearest stand tile along row `row` from column `col` without passing a solid tile, with how many columns away; null if none. */
function nearestOnRow(terrain: Terrain, stand: ReadonlySet<number>, col: number, row: number) {
  for (let away = 1; away < terrain.width; away++) {
    for (const side of [1, -1]) {
      const at = col + side * away;
      if (isSolidTile(terrain, at, row)) continue;
      if (stand.has(row * terrain.width + at)) return { tile: row * terrain.width + at, away };
    }
  }
  return null;
}

/**
 * The stand tile each open tile reads, by scanning every column upward: a tile reads the nearest stand tile
 * below it in its open run; over a pit, the open tile under it reads the nearest on its own row, and
 * the tiles above take that tile's anchor and price, so the air over a pit's mouth reads it too.
 *
 * @returns The anchor of every tile, and the extra ticks it pays for reading a tile on its row.
 */
function anchorsOf(terrain: Terrain, stand: ReadonlySet<number>, walkTicksPerTile: number) {
  const anchor = new Int32Array(terrain.width * terrain.height).fill(-1);
  const extraTicks = new Float64Array(anchor.length);
  for (let col = 0; col < terrain.width; col++) {
    let below = -1;
    for (let row = terrain.height - 1; row >= 0; row--) {
      const tile = row * terrain.width + col;
      if (isSolidTile(terrain, col, row)) {
        below = -1;
      } else if (stand.has(tile)) {
        below = tile;
        anchor[tile] = tile;
      } else if (below >= 0) {
        anchor[tile] = below;
      } else if (row + 1 < terrain.height && (anchor[tile + terrain.width] ?? -1) >= 0) {
        anchor[tile] = anchor[tile + terrain.width] ?? -1;
        extraTicks[tile] = extraTicks[tile + terrain.width] ?? 0;
      } else {
        const beside = nearestOnRow(terrain, stand, col, row);
        anchor[tile] = beside?.tile ?? -1;
        extraTicks[tile] = beside ? beside.away * walkTicksPerTile + OVER_PIT_PENALTY_TICKS : 0;
      }
    }
  }
  return { anchor, extraTicks };
}

/** Ticks of Up a pilot's hop over another racer holds: enough to clear a racer's height with room to spare. */
export const HOP_HOLD_TICKS = 6;

/**
 * Run's nav for `level` with `broken` coral open; jumps come from `tuning`.
 *
 * @throws {Error} When `tuning` lacks run's extras (see `runExtra`).
 */
export function buildRunNav(level: Level, broken: ReadonlySet<number>, tuning: MediumTuning): RunNav {
  const terrain = terrainOf(level, broken);
  const links = buildLinks(level, broken, tuning);
  const ticks = ticksToFinish(level, links);
  const walkTicksPerTile = TILE / (plannedSpeed(tuning) * TICK_DT);
  const { anchor, extraTicks } = anchorsOf(terrain, new Set(links.keys()), walkTicksPerTile);
  const distance = Float32Array.from(anchor, (tile, index) =>
    tile < 0 ? Number.POSITIVE_INFINITY : (ticks[tile] ?? Number.POSITIVE_INFINITY) + (extraTicks[index] ?? 0),
  );
  return {
    kind: 'run',
    width: level.width,
    height: level.height,
    distance,
    anchor,
    best: bestLinks(distance.length, links, ticks),
    links,
    hopAirTicks: jumpAirTicks(tuning, HOP_HOLD_TICKS, TICK_DT),
  };
}
