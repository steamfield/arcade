/**
 * World-specific Cannonballs. Reef's Cannonball is the swim dash in `powerups/use.ts`; a world whose
 * `WorldDef.cannonball` names a shot style fires that style's projectile instead, held in
 * `world.shots` and advanced here once per tick. Each style's rules live in its own module.
 */
import { courseOf } from '../../courses/index.ts';
import type { CannonballShotStyle, Racer, Shot, Vec, World } from '../../types.ts';
import { worldOf } from '../../worlds/index.ts';
import { BOULDER } from './boulder.ts';
import { COMET } from './comet.ts';
import { METEOR } from './meteor.ts';

/** One shot style's rules. */
export interface CannonballShotRules {
  /** Fires the shot for `racer` along the unit `aim`: pushes onto `world.shots`, emits `shot.launched`. */
  fire(world: World, racer: Racer, aim: Vec): void;
  /** Moves `shot` one tick and applies what it hits. Returns false once it has ended (`shot.ended` emitted). */
  advance(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean;
  /** True when the shot opens coral (cracked stone, ice) ahead of its owner, so rivals fire it at coral. */
  breaksCoral: boolean;
  /** True when a rival holding this Cannonball has a use for it this tick (`ai/items.ts`). */
  rivalWants(world: World, racer: Racer, aim: Vec): boolean;
}

const RULES: Readonly<Record<CannonballShotStyle, CannonballShotRules>> = {
  boulder: BOULDER,
  meteor: METEOR,
  comet: COMET,
};

/** The shot style the world's Cannonball fires, or null for the swim dash. */
export function shotStyleOf(world: World): CannonballShotStyle | null {
  return worldOf(courseOf(world)).cannonball ?? null;
}

/** The rules for `style`. */
export function shotRules(style: CannonballShotStyle): CannonballShotRules {
  return RULES[style];
}

/** The shots slot of `stepRace`: advances every shot in flight and drops the ones that ended. */
export function advanceShots(world: World, racing: readonly Racer[], dt: number): void {
  if (world.shots.length === 0) return;
  world.shots = world.shots.filter((shot) => RULES[shot.style].advance(world, shot, racing, dt));
}
