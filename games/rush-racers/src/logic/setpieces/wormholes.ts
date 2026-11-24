/**
 * Wormholes, Farside's set piece: paired mouths that carry a racer from one to the other with its
 * velocity kept (`LevelDef.wormholes`). Cooldowns live in `World.warps`.
 */
import { tileCentre, tileOf } from '../ai/steer.ts';
import { errorAt } from '../level/level-error.ts';
import { centreOf } from '../racers.ts';
import { isInvulnerable } from '../status.ts';
import { type Cell, type Racer, TILE, type World, type WormholeDef } from '../types.ts';

/** The ring fits its tile. The whole tile catches a racer's centre, including the corners. */
export const WORMHOLE = { mouthRadius: TILE / 2, cooldownTicks: 45 } as const;

type Mouth = WormholeDef['a'];

function separationSquared([ax, ay]: Mouth, [bx, by]: Mouth): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Checks a level's wormholes against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a mouth off the map or not on an open tile, a hole's mouths under 4 tiles
 *   apart, or mouths of different holes under 3 tiles apart.
 */
export function parseWormholes(defs: readonly WormholeDef[], cells: readonly (readonly Cell[])[]): WormholeDef[] {
  const earlierMouths: Mouth[] = [];
  return defs.map((def, index) => {
    const { a, b } = def;
    for (const [col, row] of [a, b]) {
      const cell = cells[row]?.[col];
      if (!cell) throw errorAt(`Wormhole ${index}'s mouth is off the map`, row, col);
      if (cell === 'rock' || cell === 'coral' || cell === 'bounce' || cell === 'ledge') {
        throw errorAt(`Wormhole ${index}'s mouth needs an open tile`, row, col);
      }
    }
    if (separationSquared(a, b) < 16) {
      throw errorAt(`Wormhole ${index}'s mouths must be at least 4 tiles apart`, b[1], b[0]);
    }
    for (const mouth of [a, b]) {
      if (earlierMouths.some((earlier) => separationSquared(earlier, mouth) < 9)) {
        throw errorAt(`Wormhole ${index}'s mouth must be at least 3 tiles from another pair`, mouth[1], mouth[0]);
      }
      earlierMouths.push(mouth);
    }
    return def;
  });
}

/** The wormholes slot of `stepRace`: warps racers that enter a mouth; emits `wormhole.warped`. */
export function warpWormholes(world: World, racing: readonly Racer[]): void {
  const { wormholes } = world.level;
  if (wormholes.length === 0) return;
  if (world.warps.length > 0) world.warps = world.warps.filter((warp) => --warp.ticks > 0);

  for (const racer of racing) {
    if (racer.finished || racer.status.fallen > 0 || racer.status.trapped > 0 || isInvulnerable(racer)) continue;
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
