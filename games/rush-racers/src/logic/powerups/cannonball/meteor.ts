/**
 * Cloudreach's Meteor: fired, it marks the race leader (never its owner) with a shadow for a warning, then falls on them from the top of the sky, hitting them (cause 'meteor') unless they dodge out from under it.
 */
import type { Racer, Shot, Vec, World } from '../../types.ts';
import type { CannonballShotRules } from './index.ts';

/** How the meteor style fires, flies and is chosen by rivals. */
export const METEOR: CannonballShotRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    throw new Error(`meteor fire not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
  advance(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
    throw new Error(`meteor advance not implemented (${world.tick}, ${shot.owner}, ${racing.length}, ${dt})`);
  },
  breaksCoral: false,
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    throw new Error(`meteor rivalWants not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
};
