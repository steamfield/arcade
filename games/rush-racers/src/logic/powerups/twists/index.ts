/**
 * World-specific reworked items. A world whose `WorldDef.itemTwists` names a style for an item kind
 * uses that style in place of the shared effect; its state is held in `world.twists` and advanced
 * here once per tick. Each style's rules live in its own module.
 */
import { courseOf } from '../../courses/index.ts';
import type { ItemTwistStyle, PowerUpKind, Racer, Twist, Vec, World } from '../../types.ts';
import { worldOf } from '../../worlds/index.ts';
import { GRAVITY_BOMB } from './gravity-bomb.ts';
import { HEADWIND } from './headwind.ts';
import { MUD_PIE } from './mud-pie.ts';

/** One reworked item's rules. */
export interface TwistRules {
  /** Uses the item for `racer` along the unit `aim`: pushes onto `world.twists`, emits `twist.launched`. */
  fire(world: World, racer: Racer, aim: Vec): void;
  /** Moves `twist` one tick and applies its effect. Returns false once it has ended (`twist.ended` emitted). */
  advance(world: World, twist: Twist, racing: readonly Racer[], dt: number): boolean;
  /** True when a rival holding the item has a use for it this tick (`ai/items.ts`). */
  rivalWants(world: World, racer: Racer, aim: Vec): boolean;
}

const RULES: Readonly<Record<ItemTwistStyle, TwistRules>> = {
  mudPie: MUD_PIE,
  headwind: HEADWIND,
  gravityBomb: GRAVITY_BOMB,
};

/** The style the world uses for item `kind`, or null for the shared effect. */
export function twistStyleOf(world: World, kind: PowerUpKind): ItemTwistStyle | null {
  return worldOf(courseOf(world)).itemTwists?.[kind] ?? null;
}

/** The rules for `style`. */
export function twistRules(style: ItemTwistStyle): TwistRules {
  return RULES[style];
}

/** The reworked items slot of `stepRace`: advances every twist in play and drops the ones that ended. */
export function advanceTwists(world: World, racing: readonly Racer[], dt: number): void {
  if (world.twists.length === 0) return;
  world.twists = world.twists.filter((twist) => RULES[twist.style].advance(world, twist, racing, dt));
}
