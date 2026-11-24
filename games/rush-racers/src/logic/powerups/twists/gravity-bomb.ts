/**
 * Farside's Gas Bomb as a gravity bomb: dropped behind its owner, it pulls the racers chasing it in toward itself for a few seconds.
 */
import type { Racer, Twist, Vec, World } from '../../types.ts';
import type { TwistRules } from './index.ts';

/** How this reworked item is used, how it plays out and when rivals use it. */
export const GRAVITY_BOMB: TwistRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    throw new Error(`gravity-bomb fire not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
  advance(world: World, twist: Twist, racing: readonly Racer[], dt: number): boolean {
    throw new Error(`gravity-bomb advance not implemented (${world.tick}, ${twist.owner}, ${racing.length}, ${dt})`);
  },
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    throw new Error(`gravity-bomb rivalWants not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
};
