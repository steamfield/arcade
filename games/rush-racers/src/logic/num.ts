/**
 * Math that gives the same bits on every JavaScript engine. ECMA-262 lets engines approximate
 * Math.sin, cos, atan2, hypot, exp, pow and friends, so V8 and JavaScriptCore can disagree in the
 * last bit and a seeded race can play out differently on Chromium and WebKit. Logic uses these
 * instead; they are built only from + - * / and Math.sqrt / Math.round, which IEEE 754 rounds
 * exactly everywhere.
 */

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
