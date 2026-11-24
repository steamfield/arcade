/**
 * Crumbling branches, Thornwood's set piece: ledge runs that shake when a racer stands on them, fall
 * away, and grow back (`LevelDef.crumbles`). The only writer of `World.fallen`.
 */
import { errorAt } from '../level/level-error.ts';
import { tileIndex } from '../level/query.ts';
import { type Cell, type CrumbleDef, type CrumbleState, type Level, type Racer, TILE, type World } from '../types.ts';

/** Warning, fallen, and sprout durations in logic ticks. */
export const CRUMBLE = { shakeTicks: 40, fallenTicks: 300, sproutTicks: 18 } as const;

const MAX_LENGTH = 12;

/**
 * Checks a level's crumbling branches against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a run off the map, a tile in it that isn't a ledge, a length outside 1-12,
 *   or two runs sharing a tile.
 */
export function parseCrumbles(defs: readonly CrumbleDef[], cells: readonly (readonly Cell[])[]): CrumbleDef[] {
  const claimed = new Set<number>();
  const width = cells[0]?.length ?? 0;
  return defs.map(({ col, row, length }, index) => {
    const name = `Crumbling branch ${index}`;
    if (!Number.isInteger(length) || length < 1 || length > MAX_LENGTH) {
      throw errorAt(`${name} length must be an integer from 1 to ${MAX_LENGTH}, got ${length},`, row, col);
    }
    const last = col + length - 1;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= cells.length || col < 0 || col >= width) {
      throw errorAt(`${name} starts off the map`, row, col);
    }
    if (last >= width) throw errorAt(`${name} runs off the map`, row, width);
    for (let x = col; x <= last; x++) {
      if (cells[row]?.[x] !== 'ledge') throw errorAt(`${name} must be on a ledge`, row, x);
      const tile = row * width + x;
      if (claimed.has(tile)) throw errorAt(`${name} overlaps another crumbling branch`, row, x);
      claimed.add(tile);
    }
    return { col, row, length };
  });
}

/** Every branch of `level` solid, as a race starts. */
export function createCrumbles(level: Level): CrumbleState[] {
  return level.crumbles.map(() => ({ phase: 'solid', ticks: 0 }));
}

/** The crumbling branches slot of `stepRace`: shakes, drops and regrows branches; emits `crumble.*`. */
export function crumbleBranches(world: World, racing: readonly Racer[]): void {
  world.level.crumbles.forEach((branch, crumble) => {
    const state = world.crumbles[crumble];
    if (!state) return;
    const left = branch.col * TILE;
    const right = left + branch.length * TILE;
    const top = branch.row * TILE;
    const acrossBranch = ({ body, status }: Racer) => status.fallen === 0 && body.x < right && body.x + body.w > left;

    if (state.ticks > 0) state.ticks--;
    if (state.phase === 'solid') {
      const supported = racing.some(
        (racer) =>
          acrossBranch(racer) &&
          racer.status.trapped === 0 &&
          racer.body.y + racer.body.h === top &&
          racer.body.vy === 0,
      );
      if (!supported) return;
      world.crumbles[crumble] = { phase: 'shaking', ticks: CRUMBLE.shakeTicks };
      world.events.emit({ type: 'crumble.shook', crumble });
      return;
    }
    if (state.ticks > 0) return;
    if (state.phase === 'shaking') {
      setFallen(world, branch, true);
      world.crumbles[crumble] = { phase: 'fallen', ticks: CRUMBLE.fallenTicks };
      world.events.emit({ type: 'crumble.fell', crumble });
    } else {
      const occupied = racing.some(
        (racer) => acrossBranch(racer) && racer.body.y < top + TILE && racer.body.y + racer.body.h > top,
      );
      if (occupied) return;
      setFallen(world, branch, false);
      world.crumbles[crumble] = { phase: 'solid', ticks: CRUMBLE.sproutTicks };
      world.events.emit({ type: 'crumble.regrew', crumble });
    }
  });
}

/** Move rules see the new support on the next move, with no change to static navigation. */
function setFallen(world: World, { col, row, length }: CrumbleDef, fallen: boolean): void {
  const tiles = new Set(world.fallen);
  for (let x = col; x < col + length; x++) {
    const tile = tileIndex(world.level, x, row);
    if (fallen) tiles.add(tile);
    else tiles.delete(tile);
  }
  world.fallen = tiles;
}
