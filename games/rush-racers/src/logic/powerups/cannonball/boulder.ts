/**
 * Thornwood's Boulder: fired, it rolls along the ground ahead of its owner under gravity, drops into pits, breaks cracked stone and hits racers it runs into (cause 'boulder').
 */
import type { Racer, Shot, Vec, World } from '../../types.ts';
import type { CannonballShotRules } from './index.ts';

/** How the boulder style fires, flies and is chosen by rivals. */
export const BOULDER: CannonballShotRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    throw new Error(`boulder fire not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
  advance(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
    throw new Error(`boulder advance not implemented (${world.tick}, ${shot.owner}, ${racing.length}, ${dt})`);
  },
  breaksCoral: true,
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    throw new Error(`boulder rivalWants not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
};
