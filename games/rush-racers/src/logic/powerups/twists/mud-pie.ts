/**
 * Thornwood's Mud Pie: lobbed forward in an arc, it splats where it lands on the ground and leaves a mud patch that slows runners crossing it for a few seconds.
 */
import type { Racer, Twist, Vec, World } from '../../types.ts';
import type { TwistRules } from './index.ts';

/** How this reworked item is used, how it plays out and when rivals use it. */
export const MUD_PIE: TwistRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    throw new Error(`mud-pie fire not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
  advance(world: World, twist: Twist, racing: readonly Racer[], dt: number): boolean {
    throw new Error(`mud-pie advance not implemented (${world.tick}, ${twist.owner}, ${racing.length}, ${dt})`);
  },
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    throw new Error(`mud-pie rivalWants not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
};
