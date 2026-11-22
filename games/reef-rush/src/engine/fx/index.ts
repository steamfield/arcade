/**
 * Juice for the race scene: particles, screen shake, hit-stop and flashes driven by drained
 * events and world state. Render-only: nothing here may change logic state or the tick rate,
 * so a race plays out the same with effects on or off. Lane 5/c fills this in behind this seam.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';

export interface Fx {
  /** Reacts to one tick's drained events; `tick` is the world tick they happened on. */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /** Called every rendered frame with the current world. */
  sync(world: World): void;
}

/**
 * Builds the race scene's effects. With `reducedMotion` on, effects keep their information
 * (a hit still reads as a hit) without shake, flashing or large motion.
 */
export function createFx(scene: Phaser.Scene, world: World, reducedMotion: boolean): Fx {
  void scene;
  void world;
  void reducedMotion;
  return { onEvents: () => {}, sync: () => {} };
}
