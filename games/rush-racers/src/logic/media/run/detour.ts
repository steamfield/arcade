/** Live route choices over Run's static links while crumbling branches are down. */
import { TICK_DT } from '@arcade/core';
import { PriorityQueue } from '../../race/priority-queue.ts';
import { CRUMBLE } from '../../setpieces/crumbles.ts';
import { TILE, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import { plannedSpeed } from './links.ts';
import type { RunLink, RunNav } from './way-data.ts';

/** Support changes replace the set. Coral can rebuild the graph without changing that set. */
const routesByFallen = new WeakMap<ReadonlySet<number>, { nav: RunNav; links: Map<number, RunLink | null> }>();

/** Whether a stand tile in the static graph still has support beneath it. */
export function supportRemains(world: World, nav: RunNav, stand: number): boolean {
  return !world.fallen.has(stand + nav.width);
}

/** The next link from a stand, cached for the current fallen tiles and navigation graph. */
export function availableLink(world: World, nav: RunNav, stand: number): RunLink | null {
  const best = nav.best[stand] ?? null;
  if (!best || world.fallen.size === 0) return best;

  let cached = routesByFallen.get(world.fallen);
  if (cached?.nav !== nav) {
    cached = { nav, links: new Map() };
    routesByFallen.set(world.fallen, cached);
  }
  const known = cached.links.get(stand);
  if (known !== undefined) return known;

  const next = routeLosesSupport(world, nav, best) ? detourLink(world, nav, stand) : best;
  cached.links.set(stand, next);
  return next;
}

/** Always check the first landing. Look further only as far as a runner could go before regrowth. */
function routeLosesSupport(world: World, nav: RunNav, first: RunLink): boolean {
  let ticks = 0;
  for (let link: RunLink | null = first; link; link = nav.best[link.to] ?? null) {
    ticks += link.ticks;
    if (link !== first && ticks > CRUMBLE.fallenTicks) break;
    if (!supportRemains(world, nav, link.to)) return true;
  }
  return false;
}

interface DetourStep {
  stand: number;
  ticks: number;
  first: RunLink | null;
}

/**
 * Finds a route over the existing links with live support, including drops through missing
 * landings. A lower way can start by turning back, so the intact route's distance can't rank it.
 */
function detourLink(world: World, nav: RunNav, stand: number): RunLink | null {
  const visited = new Set<number>();
  const pending = new PriorityQueue<DetourStep>();
  const ticksPerTile = TILE / (plannedSpeed(effectiveTuning(world)) * TICK_DT);
  pending.push(0, { stand, ticks: 0, first: null });
  for (let step = pending.pop(); step; step = pending.pop()) {
    if (visited.has(step.stand)) continue;
    if (step.stand % nav.width >= world.level.finishX) return step.first;
    visited.add(step.stand);
    for (const planned of nav.links.get(step.stand) ?? []) {
      const link = supportRemains(world, nav, planned.to) ? planned : dropPastBranch(world, nav, planned, ticksPerTile);
      if (!link || visited.has(link.to)) continue;
      const ticks = step.ticks + link.ticks;
      pending.push(ticks, { stand: link.to, ticks, first: step.first ?? link });
    }
  }
  return null;
}

/** A blocked walk or drop can still walk off its lip to the low road below the missing landing. */
function dropPastBranch(world: World, nav: RunNav, link: RunLink, ticksPerTile: number): RunLink | null {
  if (link.kind !== 'walk' && link.kind !== 'drop') return null;
  for (let to = link.to + nav.width; to < nav.distance.length; to += nav.width) {
    if (nav.anchor[to] === -1) return null;
    if (nav.anchor[to] === to && supportRemains(world, nav, to)) {
      // Price the extra fall at the same scale as travel over one tile of ground.
      return { ...link, kind: 'drop', to, ticks: link.ticks + ((to - link.to) / nav.width) * ticksPerTile };
    }
  }
  return null;
}
