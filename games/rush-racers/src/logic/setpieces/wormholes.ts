/**
 * Wormholes, Farside's set piece: paired mouths that carry a racer from one to the other with its
 * velocity kept (`LevelDef.wormholes`). Cooldowns live in `World.warps`.
 */
import { tileCentre, tileOf } from '../ai/steer.ts';
import { errorAt } from '../level/level-error.ts';
import { length } from '../num.ts';
import { centreOf } from '../racers.ts';
import { type Cell, type Racer, type RacerId, TILE, type World, type WormholeDef } from '../types.ts';

/** The ring fits the mouth tile. A racer is caught when its centre is anywhere in that tile. */
export const WORMHOLE = { ringRadius: TILE / 2, cooldownTicks: 45 } as const;

type Mouth = WormholeDef['a'];

function separation([ax, ay]: Mouth, [bx, by]: Mouth): number {
  return length(ax - bx, ay - by);
}

/**
 * Checks a level's wormholes against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a mouth off the map or not on an open tile, a hole's mouths under 4 tiles
 *   apart, or mouths of different holes under 3 tiles apart.
 */
export function parseWormholes(defs: readonly WormholeDef[], cells: readonly (readonly Cell[])[]): WormholeDef[] {
  const earlierMouths: { at: Mouth; hole: number }[] = [];
  return defs.map((def, index) => {
    const { a, b } = def;
    for (const [col, row] of [a, b]) {
      const cell = cells[row]?.[col];
      if (!cell) throw errorAt(`Wormhole ${index}'s mouth is off the map`, row, col);
      if (cell === 'rock' || cell === 'coral' || cell === 'bounce' || cell === 'ledge') {
        throw errorAt(`Wormhole ${index}'s mouth needs an open tile`, row, col);
      }
    }
    const apart = separation(a, b);
    if (apart < 4) {
      throw errorAt(`Wormhole ${index}'s mouths are ${apart.toFixed(1)} tiles apart and need at least 4`, b[1], b[0]);
    }
    for (const mouth of [a, b]) {
      for (const { at, hole } of earlierMouths) {
        const distance = separation(at, mouth);
        if (distance < 3) {
          throw errorAt(
            `Wormhole ${index}'s mouth is ${distance.toFixed(1)} tiles from wormhole ${hole}'s and needs at least 3`,
            mouth[1],
            mouth[0],
          );
        }
      }
    }
    earlierMouths.push({ at: a, hole: index }, { at: b, hole: index });
    return def;
  });
}

/** Before the warp step, only cooldowns above 1 block this tick because the step decrements first. */
export function isWarpCoolingDown(world: World, racer: RacerId): boolean {
  return world.warps.some((warp) => warp.racer === racer && warp.ticks > 1);
}

/** The wormholes slot of `stepRace`: warps racers that enter a mouth; emits `wormhole.warped`. */
export function warpWormholes(world: World, racing: readonly Racer[]): void {
  const { wormholes } = world.level;
  if (wormholes.length === 0) return;
  if (world.warps.length > 0) world.warps = world.warps.filter((warp) => --warp.ticks > 0);

  for (const racer of racing) {
    if (racer.finished || racer.status.fallen > 0 || racer.status.trapped > 0) continue;
    if (world.warps.some((warp) => warp.racer === racer.id)) continue;
    const { x, y } = tileOf(centreOf(racer));
    // Crossing the line counts as finishing even before stepRace records it at the end of the tick.
    if (x >= world.level.finishX) continue;
    for (const [hole, { a, b, oneWay }] of wormholes.entries()) {
      const atA = x === a[0] && y === a[1];
      const atB = x === b[0] && y === b[1];
      if (!atA && (oneWay || !atB)) continue;

      const [tx, ty] = atA ? b : a;
      const exit = tileCentre({ x: tx, y: ty });
      racer.body.x = exit.x - racer.body.w / 2;
      racer.body.y = exit.y - racer.body.h / 2;
      world.warps.push({ racer: racer.id, ticks: WORMHOLE.cooldownTicks });
      world.events.emit({ type: 'wormhole.warped', racer: racer.id, hole, from: atA ? 'a' : 'b' });
      break;
    }
  }
}
