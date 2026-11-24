/**
 * Drift's numbers and rules as data: the tuning its physics reads, what drifting does in the generic
 * rules that push racers around, and how those rules read a dash. Values are shared by the player
 * and rivals; profiles, power-ups and abilities scale them through MoveModifiers, and Easy scales
 * the idle brake through `byDifficulty`. The keys are fixed: the pilot reads them by name.
 */
import { ABILITY } from '../../abilities.ts';
import type { KickRules, MediumEffects, MediumTuning } from '../types.ts';

/**
 * Drift tuning in pixels and seconds. `force` is thrust acceleration (px/s²); `drag` a small
 * constant deceleration everywhere (px/s²), the thin dust that makes a coasting racer lose a little
 * speed; `maxSpeed` the hard cap on speed on both axes (px/s); `kick` the speed a dash adds along
 * the stick (px/s). In `extra`: `cruise`, the speed thrust alone reaches before forceMul and dust
 * (px/s); `overDrag` (px/s²), added to drag while the racer is over its cruise, so a dash's speed
 * lasts a second or two and no longer; `idleBrake` (px/s²), added to drag while the stick is idle; `bounce`, the share of the
 * speed into a wall that comes back; `bounceMinSpeed` (px/s), the slowest impact that emits
 * `racer.rebounded`; `dustCruiseMul`, cruise's multiplier in nebula dust, and `dustDrag` (px/s²),
 * added to drag there; `dustThrustShare`, the most of a thrusting racer's thrust that drag may take below dust cruise, so even a slowed racer makes headway in dust. `windForce` (px/s²) is a solar wind
 * cell's push. `wellPull` multiplies every gravity well's pull. `respawnTicks` is how long a racer
 * a black hole swallowed is out, and `respawnInvulnTicks` is how long it can't be hit once it is back.
 */
export const DRIFT_TUNING = {
  base: { forceMul: 1, kickMul: 1, kickCooldownTicks: 36, dragMul: 1 },
  force: 260,
  drag: 16,
  maxSpeed: 210,
  kick: 90,
  extra: {
    cruise: 115,
    overDrag: 44,
    idleBrake: 6,
    bounce: 0.5,
    bounceMinSpeed: 40,
    dustCruiseMul: 0.45,
    dustDrag: 150,
    dustThrustShare: 0.75,
    windForce: 200,
    wellPull: 1,
    respawnTicks: 60,
    respawnInvulnTicks: 60,
  },
  /** Easy's stabilisers brake a racer whose stick is idle, and gravity wells pull less. */
  byDifficulty: { easy: { idleBrake: 10, wellPull: 0.6 } },
} as const satisfies MediumTuning;

/** The extras drift reads from `tuning.extra`. */
export type DriftExtras = Record<keyof typeof DRIFT_TUNING.extra, number>;

/**
 * Drift's extras from `tuning`, the one place they are read.
 *
 * @throws {Error} When `tuning.extra` lacks one, which means the tuning isn't drift's.
 */
export function driftExtras(tuning: MediumTuning): DriftExtras {
  const extras: Partial<DriftExtras> = {};
  for (const key of Object.keys(DRIFT_TUNING.extra) as (keyof DriftExtras)[]) {
    const value = tuning.extra[key];
    if (value === undefined) {
      throw new Error(`Drift tuning has no extra '${key}'; pass drift's tuning (effectiveTuning)`);
    }
    extras[key] = value;
  }
  return extras as DriftExtras;
}

/** Share of what forceMul adds to thrust that it also adds to cruise. */
const CRUISE_SHARE_OF_FORCE = 0.5;

/**
 * The speed thrust alone reaches for a racer with `forceMul`: `cruise`, raised by half of what
 * forceMul adds, and lowered to `dustCruiseMul` of that in nebula dust.
 */
export function driftCruise(extras: DriftExtras, forceMul: number, inDust: boolean): number {
  const boosted = extras.cruise * (1 + (forceMul - 1) * CRUISE_SHARE_OF_FORCE);
  return inDust ? boosted * extras.dustCruiseMul : boosted;
}

/**
 * A dash, knockback or decoy holds velocity on both axes; a trapped racer floats still and a loose
 * power-up stays where it dropped; enemies can't be stomped; pods open on touch; the level is walled
 * all round; no ledges or bounce clouds; levels may have gravity wells. The Easy assist slides both stick axes.
 */
export const DRIFT_EFFECTS: MediumEffects = {
  dashAxes: 'both',
  trappedDrift: 0,
  looseDrift: 0,
  stompBounce: null,
  solidClams: false,
  pitBelow: false,
  allowsLedges: false,
  assistAxes: 'both',
  gravityWells: true,
  bounceSpeed: null,
};

/**
 * A dash dodges a Homing Probe, shakes a latch and counters a Tractor Beam. Gil's slot gets its
 * spring on a dash aimed steeply up or down, since space has no up.
 */
export const DRIFT_KICK_RULES: KickRules = {
  dodgesSquid: true,
  shakesLatch: true,
  countersUndertow: true,
  springKick: (aim) => Math.abs(aim.y) >= ABILITY.springKick.minUp,
};
