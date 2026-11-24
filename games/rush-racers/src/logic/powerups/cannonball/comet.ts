/**
 * Farside's Comet: fired along its owner's aim, it flies straight but every gravity well bends it, breaking ice and hitting the first racer it touches (cause 'comet').
 */
import type { Racer, Shot, Vec, World } from '../../types.ts';
import type { CannonballShotRules } from './index.ts';

/** How the comet style fires, flies and is chosen by rivals. */
export const COMET: CannonballShotRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    throw new Error(`comet fire not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
  advance(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
    throw new Error(`comet advance not implemented (${world.tick}, ${shot.owner}, ${racing.length}, ${dt})`);
  },
  breaksCoral: true,
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    throw new Error(`comet rivalWants not implemented (${world.tick}, ${racer.id}, ${aim.x})`);
  },
};
