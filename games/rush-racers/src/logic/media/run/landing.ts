/**
 * Where a runner in the air comes down if it flies on as it is going: the pilot's check that a jump
 * still lands somewhere it can stand. Links are planned at `plannedSpeed`, so a runner that took off
 * faster (out of a dash, at a quicker pace, out of a tailwind) flies further than its link says. The
 * flight is stepped with the physics' own horizontal and vertical steps (`stepRunSpeed`,
 * `stepFall`) and the surroundings sampled where the body is each tick, so the prediction is what
 * the physics will do while the stick stays held that way, short of what it runs into on the way.
 */
import { TICK_DT } from '@arcade/core';
import { type Body, type MoveModifiers, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import type { RunEnv } from './data.ts';
import { type RunExtra, stepFall, stepRunSpeed } from './physics.ts';

/** The most ticks ahead a landing is looked for: longer than any jump's fall. */
const LOOKAHEAD_TICKS = 120;

/** A runner in the air, and how it is flying. */
export interface Flying {
  body: Body;
  /** The speed its dash still glides down from (`RunMotion.dashGlide`). */
  dashGlide: number;
  /** True in a jump (`RunMotion.jumping`): only a jump's rise is cut short when Up is let go. */
  jumping: boolean;
  /** Ticks, from this one, that Up stays held. */
  holdTicks: number;
  /** The runner's move modifiers this tick: forceMul sets its pace, dragMul its air friction. */
  mods: MoveModifiers;
}

/** The rules a flight follows: run's tuning and its extras, and the surroundings a body at a spot feels. */
export interface AirRules {
  tuning: MediumTuning;
  extra: RunExtra;
  /** What the surroundings do to a body where it is (wind, drafts, mud), sampled as the medium samples a racer. */
  envAt: (body: Body) => RunEnv;
}

/**
 * The x of the runner's middle when its feet next come down through `feetY` (px), flying on with
 * the stick held at `stick` (-1, 0 or 1) the whole way. Walls, crates and racers on the way aren't
 * traced: the pilot only asks what lies under the spot it comes down.
 *
 * @returns null when the flight doesn't come down to `feetY` within LOOKAHEAD_TICKS (it never rises that high).
 */
export function landingX(flying: Flying, stick: number, feetY: number, rules: AirRules): number | null {
  const { tuning, extra, envAt } = rules;
  const body = { ...flying.body };
  const motion = { dashGlide: flying.dashGlide };
  for (let tick = 1; tick <= LOOKAHEAD_TICKS; tick++) {
    const env = { ...envAt(body), grounded: false };
    stepRunSpeed(body, motion, stick, env, tuning, extra, flying.mods, TICK_DT);
    body.vx = Math.min(tuning.maxSpeed, Math.max(-tuning.maxSpeed, body.vx));
    stepFall(body, flying.jumping && tick > flying.holdTicks, env, extra, TICK_DT);
    body.x += body.vx * TICK_DT;
    body.y += body.vy * TICK_DT;
    if (body.vy > 0 && body.y + body.h >= feetY) return body.x + body.w / 2;
  }
  return null;
}

/** The top of row `row + 1`, px: where the feet of a runner standing in row `row` are. */
export function feetOnRow(row: number): number {
  return (row + 1) * TILE;
}
