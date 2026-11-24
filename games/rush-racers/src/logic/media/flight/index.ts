/**
 * Flying as a medium: gravity always on, a flap on a fresh Up press, a glide with Up held, a dive
 * with Down held whose speed carries into level flight, and a forward dash that pops puff clouds.
 * This file only assembles the members: physics in `physics.ts`, surroundings in `env.ts`, the last
 * safe spot and falls in `fall.ts`, navigation in `nav.ts` and `way.ts`, the rival pilot in
 * `pilot.ts`, numbers and rules in `tuning.ts`, and data shapes in `data.ts` and `way-data.ts`.
 */
import type { Medium } from '../types.ts';
import { sampleFlightEnvironment } from './env.ts';
import { afterFlightMove } from './fall.ts';
import { buildFlightNav, flightEnterCost, validateFlightLevel } from './nav.ts';
import { applyFlightIntent, createFlightMotion, flightRamsCoral } from './physics.ts';
import { createFlightPilot, steerFlyer } from './pilot.ts';
import { FLIGHT_EFFECTS, FLIGHT_KICK_RULES, FLIGHT_TUNING } from './tuning.ts';
import { flightAimFrom, flightCoralAhead, flightDistanceAt, flightNextTile } from './way.ts';

/** The flight medium. */
export const FLIGHT_MEDIUM: Medium = {
  id: 'flight',
  tuning: FLIGHT_TUNING,
  createMotion: createFlightMotion,
  createPilot: createFlightPilot,
  sampleEnvironment: sampleFlightEnvironment,
  applyIntent: applyFlightIntent,
  buildNav: buildFlightNav,
  steer: steerFlyer,
  enterCost: flightEnterCost,
  aimFrom: flightAimFrom,
  nextTile: flightNextTile,
  distanceAt: flightDistanceAt,
  coralAhead: flightCoralAhead,
  ramsCoral: flightRamsCoral,
  validateLevel: validateFlightLevel,
  afterMove: afterFlightMove,
  racerCollision: 'solid',
  effects: FLIGHT_EFFECTS,
  kickRules: FLIGHT_KICK_RULES,
};
