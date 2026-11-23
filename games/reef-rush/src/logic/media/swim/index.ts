/**
 * Swimming as a medium: free 8-direction swimming with momentum and drag, an idle sink, currents and
 * kelp, a kick, and a breach into the air above a surface that gravity brings back down. This file
 * only assembles the members; each lives in its own module: physics in `physics.ts`, navigation in
 * `nav.ts` and `way.ts`, the rival pilot in `pilot.ts`, numbers and rules in `tuning.ts`, and swim's
 * data shapes with their accessors in `data.ts`.
 */
import { isAirAt, sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { centreOf } from '../../racers.ts';
import type { Medium } from '../types.ts';
import type { SwimEnv, SwimMotion } from './data.ts';
import { buildSwimNav, steerCost, validateSwimLevel } from './nav.ts';
import { applyIntent } from './physics.ts';
import { createSwimPilot, steerSwimmer } from './pilot.ts';
import { SPLASH_DEPTH, SWIM_EFFECTS, SWIM_KICK_RULES, SWIM_TUNING } from './tuning.ts';
import { coralOnSmashPath, swimAimFrom, swimDistanceAt, swimNextTile } from './way.ts';

/** The swim medium. */
export const SWIM_MEDIUM: Medium = {
  id: 'swim',
  tuning: SWIM_TUNING,
  createMotion: (): SwimMotion => ({ kind: 'swim', airborne: false }),
  createPilot: createSwimPilot,
  sampleEnvironment(world, racer) {
    const water = sampleEnvironment(world.level, racer.body);
    const centre = centreOf(racer);
    // A Riptide lane over the racer replaces the tile's current, and holding one strengthens either.
    const env: SwimEnv = {
      kind: 'swim',
      ...water,
      current: feltCurrent(world, racer, water.current),
      nearSurface: isAirAt(world.level, centre.x, centre.y - SPLASH_DEPTH),
    };
    return env;
  },
  applyIntent,
  buildNav: buildSwimNav,
  steer: steerSwimmer,
  enterCost: steerCost,
  aimFrom: swimAimFrom,
  nextTile: swimNextTile,
  distanceAt: swimDistanceAt,
  coralAhead: coralOnSmashPath,
  validateLevel: validateSwimLevel,
  racerCollision: 'solid',
  effects: SWIM_EFFECTS,
  kickRules: SWIM_KICK_RULES,
};
