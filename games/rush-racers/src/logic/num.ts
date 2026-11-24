/**
 * Math that gives the same bits on every JavaScript engine. ECMA-262 lets engines approximate
 * Math.sin, cos, atan2, hypot, exp, pow and friends, so V8 and JavaScriptCore can disagree in the
 * last bit and a seeded race can play out differently on Chromium and WebKit. Logic uses these
 * instead; they are built only from + - * /, Math.sqrt, Math.round, Math.min and Math.max, which IEEE 754 rounds
 * exactly everywhere. The small vector and scalar helpers several media share live here too.
 */
import type { Vec } from './types.ts';

const TAU = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

/** Length of the vector (x, y). Use in place of Math.hypot. */
export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Sine of `rad`, within 1e-9 of Math.sin for any finite input. Use in place of Math.sin. */
export function sin(rad: number): number {
  // Reduce to [-pi, pi], then fold to [-pi/2, pi/2] where the series converges fast.
  let x = rad - TAU * Math.round(rad / TAU);
  if (x > HALF_PI) x = Math.PI - x;
  else if (x < -HALF_PI) x = -Math.PI - x;
  const x2 = x * x;
  // Taylor series to x^17: error below 1e-13 on [-pi/2, pi/2].
  let term = x;
  let sum = x;
  for (let n = 1; n <= 8; n++) {
    term *= -x2 / (2 * n * (2 * n + 1));
    sum += term;
  }
  return sum;
}

/** Cosine of `rad`, with the same accuracy as `sin`. Use in place of Math.cos. */
export function cos(rad: number): number {
  return sin(rad + HALF_PI);
}

/** The vector scaled to length 1, or zero when it has no length. */
export function unit(v: Vec): Vec {
  const size = length(v.x, v.y);
  return size === 0 ? { x: 0, y: 0 } : { x: v.x / size, y: v.y / size };
}

/** `value` held within `low` and `high`. */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** `value` moved toward `target` by at most `step`, never past it. */
export function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
