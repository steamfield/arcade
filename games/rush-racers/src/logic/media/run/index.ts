/**
 * Running as a medium: run and jump on land with gravity, a horizontal dash, stomps, crates hit from
 * below, ledges and pits. This file only assembles the members: physics in `physics.ts`, surroundings
 * in `env.ts`, falls and respawns in `respawn.ts`, navigation in `simple-way.ts`, the rival pilot in
 * `simple-pilot.ts`, numbers and rules in `tuning.ts`, and data shapes in `data.ts` and `way-data.ts`.
 */
import type { Medium } from '../types.ts';
import { sampleRunEnvironment } from './env.ts';
import { applyRunIntent, createRunMotion } from './physics.ts';
import { afterRunMove } from './respawn.ts';
import { createRunPilot, steerRunner } from './simple-pilot.ts';
import { buildRunNav, runAimFrom, runCost, runDistanceAt, runNextTile, validateRunLevel } from './simple-way.ts';
import { RUN_EFFECTS, RUN_KICK_RULES, RUN_TUNING } from './tuning.ts';

/** The run medium. */
export const RUN_MEDIUM: Medium = {
  id: 'run',
  tuning: RUN_TUNING,
  createMotion: createRunMotion,
  createPilot: createRunPilot,
  sampleEnvironment: sampleRunEnvironment,
  applyIntent: applyRunIntent,
  buildNav: buildRunNav,
  steer: steerRunner,
  enterCost: runCost,
  aimFrom: runAimFrom,
  nextTile: runNextTile,
  distanceAt: runDistanceAt,
  coralAhead: () => false,
  validateLevel: validateRunLevel,
  afterMove: afterRunMove,
  racerCollision: 'horizontal',
  effects: RUN_EFFECTS,
  kickRules: RUN_KICK_RULES,
};
