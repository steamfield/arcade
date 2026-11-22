/**
 * Signature abilities: every hook the race systems consult about a racer's
 * character. Each system calls its hook at one named point, so an ability
 * changes the race only through here. In this scaffold every hook is a no-op
 * that returns the unchanged default; each doc says what the ability will do.
 *
 * | Character | Ability | Effect |
 * | --- | --- | --- |
 * | Rudy | Shake it off | stuns and bubble traps last half as long |
 * | Gil | Spring kick | kicks push harder upward |
 * | Streak | Wind-up | top speed rises the longer it swims without turning hard or being hit |
 * | Onyx | Ambush | bumping a racer from behind takes some of its speed |
 * | Nib | Deep pockets | holds 4 power-ups instead of 3 |
 * | Baron Barnacle | Bulldozer | breaks coral by ramming, barely moves in bumps, accelerates slowly |
 * | Selene | Moonlight | sees through dark zones, immune to jelly stings |
 * | Rook | Frenzy | when a racer near it is hit or loses a power-up, it gets a short speed burst |
 *
 * Abilities keep their per-racer state in `racer.ability` (zeroed at the start line by `noItems`).
 */
import type { GameEvent } from './events.ts';
import { bumpMass } from './powerups/passives.ts';
import { STACK_MAX } from './powerups/tuning.ts';
import type { HitCause, MoveModifiers, Racer, Vec, World } from './types.ts';

/**
 * The racer's swimming modifiers with its ability folded in, called last in `modifiersFor`.
 * Streak (Wind-up) raises forceMul with `ability.windUp`; Baron (Bulldozer) lowers forceMul for
 * slow acceleration; Rook (Frenzy) raises forceMul while `ability.frenzy` runs.
 * Scaffold: returns `mods` unchanged.
 */
export function abilityModifiers(_racer: Racer, mods: MoveModifiers): MoveModifiers {
  return mods;
}

/**
 * Most power-ups the racer holds before a new one pushes out the oldest (`gainPowerUp`).
 * Nib (Deep pockets) holds 4. Scaffold: STACK_MAX for everyone.
 */
export function stackMaxFor(_racer: Racer): number {
  return STACK_MAX;
}

/**
 * Multiplies the ticks of a stun or bubble trap as `applyHit` sets it (rounded to whole ticks).
 * Rudy (Shake it off) gets 0.5 for both. Scaffold: 1.
 */
export function statusDurationMul(_racer: Racer, _status: 'stunned' | 'trapped'): number {
  return 1;
}

/**
 * The mass the racer bumps with in `separateRacers`: `bumpMass` (profile mass, Puffer included)
 * with the ability on top. Baron (Bulldozer) is much heavier, so he barely moves in bumps.
 * Scaffold: `bumpMass(racer)`.
 */
export function bumpMassFor(racer: Racer): number {
  return bumpMass(racer);
}

/**
 * True when a hit of this cause does nothing to the racer, checked in `applyHit` before any effect
 * (no event, no invulnerability). Selene (Moonlight) ignores 'jelly'. Scaffold: false.
 */
export function ignoresHazard(_racer: Racer, _cause: HitCause): boolean {
  return false;
}

/**
 * True when the racer breaks coral by swimming into it: `stepWorld` then breaks every coral tile its
 * body would enter this tick (`ramCoral`) before moving it. Baron (Bulldozer). Scaffold: false.
 */
export function breaksCoralOnContact(_racer: Racer): boolean {
  return false;
}

/**
 * The kick's direction scaled per axis, as `applyIntent` fires it: the kick adds
 * `SWIM.kick * kickMul` times this vector. `dir` is the unit aim. Gil (Spring kick) scales the
 * upward part (dir.y < 0) up. Scaffold: `dir` unchanged.
 */
export function kickImpulse(_racer: Racer, dir: Vec): Vec {
  return dir;
}

/**
 * Called by `separateRacers` when racers `a` and `b` start touching (the tick `racer.bumped`
 * fires), after they're pushed apart. Onyx (Ambush), bumping a racer from behind, takes some of that
 * racer's speed. Scaffold: does nothing.
 */
export function onBump(_world: World, _a: Racer, _b: Racer): void {}

/**
 * Called once per tick in `stepWorld`, after statuses tick, with every event emitted since the
 * previous call (`world.recentEvents`). Rook (Frenzy) starts `ability.frenzy` when a racer near
 * him is hit (`racer.hit`) or loses a power-up (`powerup.lost`). Scaffold: does nothing.
 */
export function onWorldEvents(_world: World, _events: readonly GameEvent[]): void {}

/**
 * Called once per tick in `stepWorld`, right after `onWorldEvents`, for the racers still in play.
 * Runs the ability counters: Streak's `ability.windUp` grows while swimming straight and resets on
 * a hard turn or a hit; Rook's `ability.frenzy` counts down. Scaffold: does nothing.
 */
export function tickAbilities(_world: World, _racing: readonly Racer[]): void {}

/**
 * True when the racer sees through dark zones (`inDark` in level/query.ts) as if lit. Selene
 * (Moonlight). Scaffold: false; nothing reads darkness yet.
 */
export function racerSeesInDark(_racer: Racer): boolean {
  return false;
}
