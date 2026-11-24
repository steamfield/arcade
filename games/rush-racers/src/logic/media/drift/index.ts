/**
 * Drifting as a medium: thrust that changes velocity in a vacuum where almost nothing slows a
 * racer, a cruise speed thrust can't push past, a dash whose speed lasts, and walls that bounce.
 * This file only assembles the members: physics in `physics.ts`, surroundings in `env.ts`, the
 * bounce in `bounce.ts`, navigation in `nav.ts` and `way.ts`, the rival pilot in `pilot.ts`, numbers
 * and rules in `tuning.ts`, and data shapes in `data.ts` and `way-data.ts`.
 */
import type { Medium } from '../types.ts';
import { afterDriftMove } from './after-move.ts';
import { sampleDriftEnvironment } from './env.ts';
import { buildDriftNav, driftCost, validateDriftLevel } from './nav.ts';
import { applyDriftIntent, createDriftMotion } from './physics.ts';
import { createDriftPilot, steerDrifter } from './pilot.ts';
import { DRIFT_EFFECTS, DRIFT_KICK_RULES, DRIFT_TUNING } from './tuning.ts';
import { driftAimFrom, driftDistanceAt, driftIceAhead, driftNextTile } from './way.ts';

/** The drift medium. */
export const DRIFT_MEDIUM: Medium = {
  id: 'drift',
  tuning: DRIFT_TUNING,
  createMotion: createDriftMotion,
  createPilot: createDriftPilot,
  sampleEnvironment: sampleDriftEnvironment,
  applyIntent: applyDriftIntent,
  buildNav: buildDriftNav,
  steer: steerDrifter,
  enterCost: driftCost,
  aimFrom: driftAimFrom,
  nextTile: driftNextTile,
  distanceAt: driftDistanceAt,
  coralAhead: driftIceAhead,
  ramsCoral: () => false,
  validateLevel: validateDriftLevel,
  afterMove: afterDriftMove,
  racerCollision: 'solid',
  effects: DRIFT_EFFECTS,
  kickRules: DRIFT_KICK_RULES,
};
