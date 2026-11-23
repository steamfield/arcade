/**
 * The course's boost rings (`level.rings`) on the race screen, drawn from world state each frame,
 * with a sparkle when the local racer passes one (`ring.passed`). Rings are global art, code-drawn,
 * until a sky theme restyles them.
 *
 * Scaffold stub: cloudreach phase 2 lane c fills it in, keeping `createRingView`'s parameters and
 * the `RingView` members. Until then it draws nothing.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';

/** The rings; `sync` redraws them from the world, `onEvents` hears the passes drained on world tick `tick`. */
export interface RingView {
  sync(world: World, tick: number): void;
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
}

/** Adds the rings of `world`'s level to `scene`; under `reducedMotion` they hold still. */
export function createRingView(_scene: Phaser.Scene, _world: World, _reducedMotion: boolean): RingView {
  return {
    sync() {},
    onEvents() {},
  };
}
