import { cornerIsClear, NEIGHBOURS } from '../level/query.ts';
import { length } from '../num.ts';
import type { Level, Vec } from '../types.ts';
import type { NavLink } from './flowfield.ts';

/**
 * One-way holes link straight to their exits. For two-way holes, the cooldown lets racers step
 * out of the exit before it can take them back through, so price the warp and that first step.
 */
export function wormholeLinks(level: Level, stepCost: (tile: Vec, move: Vec) => number, warpCost: number): NavLink[] {
  const open = (x: number, y: number) => Number.isFinite(stepCost({ x, y }, { x: 0, y: 0 }));
  function throughExit(from: Vec, exit: Vec, oneWay: boolean): NavLink[] {
    if (from.x >= level.finishX) return [];
    // Arriving on the finish column ends the race on the warp tick.
    if (oneWay || exit.x === level.finishX) return [{ from, to: exit, cost: warpCost }];

    const links = NEIGHBOURS.flatMap((move) => {
      const to = { x: exit.x + move.x, y: exit.y + move.y };
      const cost = stepCost(to, move);
      if (!Number.isFinite(cost) || !cornerIsClear(exit, move, open)) return [];
      return [{ from, to, cost: warpCost + length(move.x, move.y) * cost }];
    });
    // An enclosed exit has nowhere to go. A self-link keeps the entry forced and unreachable.
    return links.length > 0 ? links : [{ from, to: from, cost: warpCost }];
  }

  return level.wormholes.flatMap(({ a, b, oneWay }) => {
    const first = { x: a[0], y: a[1] };
    const second = { x: b[0], y: b[1] };
    const links = throughExit(first, second, oneWay);
    return oneWay ? links : [...links, ...throughExit(second, first, false)];
  });
}
