/**
 * Flight's numbers and rules as data: the tuning its physics reads, what flying does in the generic
 * rules that push racers around, and how those rules read a dash. Values are shared by the player
 * and rivals; profiles, power-ups and abilities scale them through MoveModifiers, and Easy scales
 * gravity and the flap through `byDifficulty`. The keys are fixed: the pilot reads them by name.
 */
import type { KickRules, MediumEffects, MediumTuning } from '../types.ts';

/**
 * Flight tuning in pixels and seconds, run's split between a hard cap and a cruise speed. `force`
 * is horizontal acceleration toward cruise (px/s²); `drag` air friction (px/s²), which bleeds speed
 * over cruise (a dash, a dive's carry) and slows a flyer coasting with no stick; `maxSpeed` the
 * hard cap on horizontal speed that nothing passes (px/s); `kick` the speed a dash sets along facing
 * (px/s). In `extra`: `cruise`, top flying speed before forceMul and fog (px/s); `gravity` (px/s²);
 * `maxFall` (px/s), which also caps how fast an updraft lifts a flyer; `flapLift`, the upward speed a flap leaves at least (px/s, times `jumpMulFor`);
 * `flapCooldownTicks`, the shortest gap between flaps; `glideFall`, the fall speed Up held caps
 * (px/s); `diveAccel` (px/s², in place of gravity while Down is held) and `diveMaxFall` (px/s);
 * `diveCarry`, the share of the fall speed added to forward speed on letting go of Down; `dashTicks`,
 * the ticks after a dash in which it pops puff clouds; `respawnTicks` and `respawnInvulnTicks`;
 * `windSpeed` (px/s) a gust adds to the speed a flyer settles at; `draftForce` (px/s²) an updraft or
 * downdraft pushes with; `fogCruiseMul`, cruise's multiplier in fog.
 *
 * `drag` is low next to `force` so speed over cruise lasts: a dash's 110 px/s surplus takes about
 * 1.6 s to bleed off and a 1 s dive's carry about 2 s, so both are worth using, while steering back
 * the other way still turns a flyer round at `force`. `diveCarry` keeps a short dive's carry small
 * and a full one just under the cap.
 */
export const FLIGHT_TUNING = {
  base: { forceMul: 1, kickMul: 1, kickCooldownTicks: 36, dragMul: 1 },
  force: 300,
  drag: 70,
  maxSpeed: 260,
  kick: 230,
  extra: {
    cruise: 120,
    gravity: 420,
    maxFall: 240,
    flapLift: 150,
    flapCooldownTicks: 12,
    glideFall: 50,
    diveAccel: 520,
    diveMaxFall: 340,
    diveCarry: 0.4,
    dashTicks: 10,
    respawnTicks: 60,
    respawnInvulnTicks: 60,
    windSpeed: 60,
    draftForce: 600,
    fogCruiseMul: 0.6,
  },
  /** Easy flies every racer under lighter gravity with stronger flaps. */
  byDifficulty: { easy: { gravity: 0.75, flapLift: 1.15 } },
} as const satisfies MediumTuning;

/**
 * Gravity keeps vertical speed through a dash or knockback; trapped racers and loose power-ups sink
 * slowly (px/s); enemies can't be stomped; balloons open on touch; the sky has no floor below the last
 * row; no ledges. The Easy assist slides only the horizontal stick, so it never flaps or ends a glide.
 */
export const FLIGHT_EFFECTS: MediumEffects = {
  dashAxes: 'horizontal',
  trappedDrift: 20,
  looseDrift: 20,
  stompBounce: null,
  solidClams: false,
  pitBelow: true,
  allowsLedges: false,
  assistAxes: 'horizontal',
};

/** A dash dodges a Homing Gull, shakes a latch and counters a Headwind; Gil's slot flaps harder (`jumpMulFor`) instead of a spring kick. */
export const FLIGHT_KICK_RULES: KickRules = {
  dodgesSquid: true,
  shakesLatch: true,
  countersUndertow: true,
  springKick: () => false,
};
