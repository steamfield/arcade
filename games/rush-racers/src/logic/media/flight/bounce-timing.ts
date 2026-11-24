/**
 * How long a climb takes a flyer, flapping all the way or springing off a bounce pad first: the
 * estimate a flight rival judges a bounce by. Flying across at cruise and climbing happen at once, so
 * each leg takes the longer of the two. Plain arithmetic over px and px/s.
 */
import type { Vec } from '../../types.ts';

/** The speeds a climb is timed with, px/s and px/s². */
export interface ClimbSpeeds {
  /** Horizontal flying speed. */
  cruise: number;
  /** Upward speed that flapping averages. */
  climb: number;
  /** Upward speed at which the flyer starts flapping again after a spring. */
  flapAgain: number;
  /** Downward pull. */
  gravity: number;
  /** Upward speed a bounce pad springs a flyer up at. */
  bounce: number;
}

/** Seconds from `from` to `top` flapping all the way. */
export function secondsByFlapping(from: Vec, top: Vec, speeds: ClimbSpeeds): number {
  return Math.max(Math.abs(top.x - from.x) / speeds.cruise, Math.max(0, from.y - top.y) / speeds.climb);
}

/**
 * Seconds from `from` to `top` by dropping onto the pad top at `landing`, springing up until the rise
 * slows to the flapping speed, then flapping the rest.
 */
export function secondsByBounce(from: Vec, landing: Vec, top: Vec, speeds: ClimbSpeeds): number {
  const drop = Math.max(0, landing.y - from.y);
  const reach = Math.max(Math.abs(landing.x - from.x) / speeds.cruise, Math.sqrt((2 * drop) / speeds.gravity));
  const springSeconds = (speeds.bounce - speeds.flapAgain) / speeds.gravity;
  const springRise = speeds.bounce * springSeconds - (speeds.gravity * springSeconds * springSeconds) / 2;
  const flapRest = Math.max(0, landing.y - top.y - springRise) / speeds.climb;
  return reach + Math.max(Math.abs(top.x - landing.x) / speeds.cruise, springSeconds + flapRest);
}
