/**
 * Swimming as a medium: free 8-direction swimming with momentum and drag, an idle sink, currents and
 * kelp, and a kick. This file only assembles the members; each lives in its own module: physics in
 * `swim/physics.ts`, navigation in `nav.ts` and `way.ts`, the rival pilot in `pilot.ts`, numbers and
 * rules in `tuning.ts`.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { applyIntent } from '../../swim/physics.ts';
import type { Medium } from '../types.ts';
import { buildSwimNav, steerCost, validateSwimLevel } from './nav.ts';
import { createSwimPilot, steerSwimmer } from './pilot.ts';
import { SWIM_EFFECTS, SWIM_KICK_RULES, SWIM_TUNING } from './tuning.ts';
import { swimAimFrom, swimDistanceAt, swimNextTile } from './way.ts';

/** The swim medium. */
export const SWIM_MEDIUM: Medium = {
  id: 'swim',
  tuning: SWIM_TUNING,
  createMotion: () => ({}),
  createPilot: createSwimPilot,
  sampleEnvironment(world, racer) {
    const water = sampleEnvironment(world.level, racer.body);
    // A Riptide lane over the racer replaces the tile's current, and holding one strengthens either.
    return { ...water, current: feltCurrent(world, racer, water.current) };
  },
  applyIntent,
  buildNav: buildSwimNav,
  steer: steerSwimmer,
  enterCost: steerCost,
  aimFrom: swimAimFrom,
  nextTile: swimNextTile,
  distanceAt: swimDistanceAt,
  validateLevel: validateSwimLevel,
  racerCollision: 'solid',
  effects: SWIM_EFFECTS,
  kickRules: SWIM_KICK_RULES,
};
