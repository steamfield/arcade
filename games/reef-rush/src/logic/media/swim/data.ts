/**
 * Swim's shapes of the data a medium keeps in the world (nav, environment, pilot memory, racer
 * motion), each extending the opaque base in `media/types.ts` with `kind: 'swim'`, and the accessors
 * swim code reads them through. An accessor checks `kind` and throws on another medium's data, so a
 * mix-up fails at the read instead of racing on the wrong numbers.
 */
import type { Environment, FlowFields, Vec } from '../../types.ts';
import type { MediumEnv, MediumNav, PilotMemory, RacerMotion } from '../types.ts';

/** Swim's navigation: the steer, smash and ram flow fields (see FlowFields). */
export interface SwimNav extends MediumNav, FlowFields {
  readonly kind: 'swim';
}

/**
 * What the water does to a racer this tick: the tile's current (or a Riptide's) and kelp, whether
 * its centre is in the air, and whether the surface is within SPLASH_DEPTH above its centre.
 */
export interface SwimEnv extends MediumEnv, Environment {
  readonly kind: 'swim';
  /** True when the point SPLASH_DEPTH px above the body's centre is in air: it is just under a surface, or above one. */
  nearSurface: boolean;
}

/** A swim rival's memory: wobble, speed-based stuck count, recovery, aim and replan timer. */
export interface SwimPilot extends PilotMemory {
  readonly kind: 'swim';
  /** Current steering wobble in radians. */
  wobble: number;
  /** Racing ticks in a row spent below the stuck speed. */
  stuckTicks: number;
  /** Ticks left of a sideways recovery swim; 0 when not recovering. */
  recoverTicks: number;
  recoverDir: Vec;
  /** Unit aim from the last field read. */
  aim: Vec;
  /** Ticks until the field is read again. */
  replanIn: number;
}

/** A swimmer's movement state: whether it was in the air above a surface when last sampled. */
export interface SwimMotion extends RacerMotion {
  readonly kind: 'swim';
  /** True from the tick its sampled environment reads air until the tick it reads water again. */
  airborne: boolean;
}

/**
 * The world's nav as swim's flow fields.
 *
 * @throws {Error} When the nav was built by another medium.
 */
export function swimNav(nav: MediumNav): SwimNav {
  if (nav.kind !== 'swim') throw wrongKind('nav', nav.kind);
  return nav as SwimNav;
}

/**
 * A sampled environment as swim's water.
 *
 * @throws {Error} When the environment was sampled by another medium.
 */
export function swimEnv(env: MediumEnv): SwimEnv {
  if (env.kind !== 'swim') throw wrongKind('environment', env.kind);
  return env as SwimEnv;
}

/**
 * A rival's pilot memory as swim's.
 *
 * @throws {Error} When the memory was created by another medium.
 */
export function swimPilot(memory: PilotMemory): SwimPilot {
  if (memory.kind !== 'swim') throw wrongKind('pilot memory', memory.kind);
  return memory as SwimPilot;
}

/**
 * A racer's motion as swim's.
 *
 * @throws {Error} When the motion was created by another medium.
 */
export function swimMotion(motion: RacerMotion): SwimMotion {
  if (motion.kind !== 'swim') throw wrongKind('motion', motion.kind);
  return motion as SwimMotion;
}

function wrongKind(what: string, kind: string): Error {
  return new Error(`Swim read ${what} of kind '${kind}'; it can only read its own ('swim') data`);
}
