/**
 * The course's storm zones (`level.lightning`) on the race screen: a darkening cloud band and a
 * column shimmer during a zone's warning and a bolt during its strike, read from each zone's phase
 * (`lightningPhase`) on the race tick, plus a screen flash on `lightning.struck` that reduced motion
 * skips. Code-drawn global art until a sky theme restyles it.
 *
 * Scaffold stub: cloudreach phase 2 lane c fills it in, keeping `createLightningView`'s parameters
 * and the `LightningView` members. Until then it draws nothing.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';

/** The storm zones; `sync` redraws them from the world, `onEvents` hears warnings and strikes drained on world tick `tick`. */
export interface LightningView {
  sync(world: World, tick: number): void;
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
}

/** Adds the storm zones of `world`'s level to `scene`; under `reducedMotion` strikes flash nothing. */
export function createLightningView(_scene: Phaser.Scene, _world: World, _reducedMotion: boolean): LightningView {
  return {
    sync() {},
    onEvents() {},
  };
}
