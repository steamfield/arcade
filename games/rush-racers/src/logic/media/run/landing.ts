/**
 * Where a runner in the air comes down if it flies on as it is going: the pilot's check that a jump
 * still lands somewhere it can stand. Links are planned at `plannedSpeed`, so a runner that took off
 * faster (out of a dash, or at a quicker pace) flies further than its link says.
 */
import { TICK_DT } from '@arcade/core';
import { type Body, TILE } from '../../types.ts';
import { stepFallSpeed } from './physics.ts';

/** The most ticks ahead a landing is looked for: longer than any jump's fall. */
const LOOKAHEAD_TICKS = 120;

/** The parts of run's extras a flight reads: gravity and how air slows a runner over its pace. */
export interface AirRules {
  gravity: number;
  cutGravityMul: number;
  maxFall: number;
  airFriction: number;
}

/** A runner in the air, and how it is flying. */
export interface Flying {
  body: Body;
  /** Ticks, from this one, that Up stays held: gravity is stronger while rising once it is let go. */
  holdTicks: number;
  /** Horizontal speed, px/s, the runner keeps up in the air; faster than this it slows at `airFriction`. */
  cruise: number;
}

/**
 * The x of the runner's middle when its feet next come down through `feetY` (px), flying on with
 * the stick held the way it is going.
 *
 * @returns null when the flight doesn't come down to `feetY` within LOOKAHEAD_TICKS (it never rises that high).
 */
export function landingX({ body, holdTicks, cruise }: Flying, feetY: number, rules: AirRules): number | null {
  const dir = Math.sign(body.vx);
  let speed = Math.abs(body.vx);
  let x = body.x + body.w / 2;
  let feet = body.y + body.h;
  let vy = body.vy;
  for (let tick = 1; tick <= LOOKAHEAD_TICKS; tick++) {
    if (speed > cruise) speed = Math.max(cruise, speed - rules.airFriction * TICK_DT);
    x += dir * speed * TICK_DT;
    vy = stepFallSpeed(vy, tick > holdTicks, 0, rules, TICK_DT);
    feet += vy * TICK_DT;
    if (vy > 0 && feet >= feetY) return x;
  }
  return null;
}

/** The top of row `row + 1`, px: where the feet of a runner standing in row `row` are. */
export function feetOnRow(row: number): number {
  return (row + 1) * TILE;
}
