/**
 * Juice for the race scene: particles and screen shake driven by drained events and world
 * state. Render-only: nothing here may change logic state or the tick rate, so a race plays
 * out the same with effects on or off.
 *
 * Everything advances once per world tick in `onEvents` (particles move, trauma drains, trail
 * bubbles are shed) and `sync` only draws, so a capture at tick N looks the same however the
 * ticks were split across rendered frames. Racer-level juice (kick squash and stretch, the
 * invulnerability flicker, the place-up flash) lives in `view/racer-view.ts`, and held
 * power-up overlays in `view/powerup-view.ts`.
 */
import { createRng, type Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { courseOf } from '../../logic/courses/index.ts';
import type { World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { Theme } from '../themes/types.ts';
import { Layer } from '../view/layers.ts';
import { cameraSpan } from '../view/set-pieces/storm-reach.ts';
import { skinFor } from '../worlds/index.ts';
import { createBubbleTracker } from './bubble-tracker.ts';
import { createBursts } from './bursts.ts';
import { createCameraNudge } from './camera-nudge.ts';
import { createEventEffects } from './event-effects.ts';
import { createParticleLayer } from './particle-layer.ts';
import { createParticleField } from './particles.ts';
import { createShake } from './shake.ts';
import { ensureFxTextures } from './textures.ts';
import { trailFor } from './trail.ts';

interface Fx {
  /** Reacts to one tick's drained events; `tick` is the world tick they happened on. */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /** Called every rendered frame with the current world. */
  sync(world: World): void;
}

/** Particles behind the racers: trails, kick puffs and coral debris (a smashed gate uses about 40). */
const BACK_CAPACITY = 160;
/** Particles above the racers: everything else that marks an event. */
const FRONT_CAPACITY = 96;
/** Seeds the cosmetic rng; a constant, so a race's particles scatter the same way on every run. */
const COSMETIC_SEED = 0x5eaf00d;

/**
 * Builds the race scene's effects, moving particles by `theme`'s physics. With `reducedMotion` on,
 * effects keep their information (a hit still reads as a hit) without shake, flashing or large motion.
 */
export function createFx(scene: Phaser.Scene, world: World, theme: Theme, reducedMotion: boolean): Fx {
  ensureFxTextures(scene);
  const back = createParticleField(BACK_CAPACITY);
  const front = createParticleField(FRONT_CAPACITY);
  const layers = [
    createParticleLayer(scene, back, Layer.racers - 0.75),
    createParticleLayer(scene, front, Layer.player + 0.75),
  ];
  const bursts = createBursts(
    back,
    front,
    createRng(COSMETIC_SEED),
    theme,
    reducedMotion,
    skinFor(courseOf(world)).objects.itemTextures,
  );
  const trail = trailFor(theme, world.racers.length, reducedMotion);
  const shake = createShake();
  const nudge = createCameraNudge(scene.cameras.main);
  const effects = createEventEffects(
    world,
    bursts,
    createBubbleTracker(),
    (trauma) => {
      if (!reducedMotion) shake.add(trauma);
    },
    () => cameraSpan(scene.cameras.main),
  );

  return {
    onEvents(events) {
      back.step();
      front.step();
      shake.step();
      effects.onTick(events);
      trail?.step(world, bursts);
    },
    sync(current) {
      for (const layer of layers) layer.render();
      nudge.apply(current.tick, shake.offsetX(current.tick), shake.offsetY(current.tick));
    },
  };
}
