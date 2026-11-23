/**
 * Run's rival pilot for phase 2: run along the way, and jump (holding Up for a while) when a wall is
 * ahead or the way climbs. When the generic backstop sends `forceRecover`, run the other way for a
 * moment. Scaffold baseline; phase 2 lane b owns this file, and phase 4 replaces it with a pilot
 * that follows jump links.
 */
import { isSolid } from '../../level/query.ts';
import { type MoveModifiers, type Racer, TILE, type World } from '../../types.ts';
import type { AiDraws, Steering } from '../types.ts';
import { runAimFrom, runNextTile } from './simple-way.ts';
import { type RunPilot, runPilot } from './way-data.ts';

/** Ticks Up is held for one jump: long enough for most of a full jump's height. */
const HOLD_UP_TICKS = 14;
/** Ticks a forced recovery runs the other way. */
const RECOVER_TICKS = 30;

/** A run rival's pilot memory at the start line. */
export function createRunPilot(): RunPilot {
  return { kind: 'run', holdUpTicks: 0, recoverTicks: 0, recoverDir: 1 };
}

/**
 * A run rival's steering this tick. Mutates only its pilot memory.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory or the world's nav isn't run's.
 */
export function steerRunner(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`run.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = runPilot(ai.pilot);
  const aim = runAimFrom(world, racer.body, 1);
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = draws.side < 0.5 ? 1 : -1;
  }
  if (memory.recoverTicks > 0) {
    memory.recoverTicks--;
    return { move: { x: memory.recoverDir, y: -1 }, kick: false, kickHeld: false, aim, recovering: true };
  }
  const x = aim.x === 0 ? racer.facing : aim.x;
  if (memory.holdUpTicks === 0 && wantsJump(world, racer, x)) memory.holdUpTicks = HOLD_UP_TICKS;
  const up = memory.holdUpTicks > 0;
  if (up) memory.holdUpTicks--;
  return { move: { x, y: up ? -1 : 0 }, kick: false, kickHeld: false, aim, recovering: false };
}

/** A wall in the tile ahead, or the way going up from here. */
function wantsJump(world: World, racer: Racer, x: number): boolean {
  const { body } = racer;
  const tile = { x: Math.floor((body.x + body.w / 2) / TILE), y: Math.floor((body.y + body.h / 2) / TILE) };
  if (isSolid(world.level, world.broken, tile.x + Math.sign(x), tile.y)) return true;
  const step = runNextTile(world, tile);
  return step !== null && step.y < 0;
}
