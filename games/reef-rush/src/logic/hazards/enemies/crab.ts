/**
 * Crabs: walk their floor back and forth along their home row at CRAB.walkSpeed, turning at rock
 * ahead or at a drop (no solid floor under the next step). Mode 'patrol' until beaten. Deterministic.
 */
import { TICK_DT } from '@arcade/core';
import { LevelError } from '../../level/parse.ts';
import { cellAt, isSolid } from '../../level/query.ts';
import { type Enemy, type Level, TILE, type Vec, type World } from '../../types.ts';
import { CRAB } from './tuning.ts';

/**
 * Checks a crab placed at `home` stands on rock.
 *
 * @throws {LevelError} With the tile's row and col when the tile below isn't rock.
 */
export function requireCrabFloor(level: Level, home: Vec): void {
  if (cellAt(level, home.x, home.y + 1) === 'rock') return;
  throw new LevelError(`Crab at row ${home.y}, col ${home.x} needs rock directly below it to walk on`, home.y, home.x);
}

/** One crab's tick: a step along its facing, or a turn when the step would meet rock or a drop. */
export function stepCrab(world: World, crab: Enemy): void {
  crab.modeTicks += 1;
  const step = CRAB.walkSpeed * TICK_DT;
  const lead = crab.at.x + crab.facing * (CRAB.size / 2 + step);
  const tx = Math.floor(lead / TILE);
  const ty = crab.home.y;
  const blocked = isSolid(world.level, world.broken, tx, ty) || !isSolid(world.level, world.broken, tx, ty + 1);
  if (blocked) {
    crab.facing = crab.facing === 1 ? -1 : 1;
    crab.vel = { x: 0, y: 0 };
    return;
  }
  crab.vel = { x: crab.facing * CRAB.walkSpeed, y: 0 };
  crab.at = { x: crab.at.x + step * crab.facing, y: crab.at.y };
}
