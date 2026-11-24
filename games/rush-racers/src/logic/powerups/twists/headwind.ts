/**
 * Cloudreach's Headwind: a gust front that sweeps forward from its owner along the course, shoving back every racer it passes over.
 */
import type { Racer, Twist, Vec, World } from '../../types.ts';
import type { TwistRules } from './index.ts';

/** How this reworked item is used, how it plays out and when rivals use it. */
export const HEADWIND: TwistRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    throw new Error(`headwind fire not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
  advance(world: World, twist: Twist, racing: readonly Racer[], dt: number): boolean {
    throw new Error(`headwind advance not implemented (${world.tick}, ${twist.owner}, ${racing.length}, ${dt})`);
  },
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    throw new Error(`headwind rivalWants not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
};
