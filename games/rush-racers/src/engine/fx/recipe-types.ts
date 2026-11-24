/**
 * The shape of an effect recipe: plain data saying which particles a moment spawns, in what
 * pattern, how they look and how they move. Item fires, impacts and movement moments are all
 * recipes (`item-recipes.ts`, `movement-recipes.ts`), and one player spawns any of them
 * (`recipe-player.ts`), so a new effect is a table row rather than new spawning code.
 */

/** How one particle looks: a frame of the fx sheet (`FxFrame`), tinted, at an opacity from 0 to 1. */
export interface ParticleLook {
  frame: string;
  tint: number;
  alpha: number;
}

/**
 * Where a part's particles start and which way they go, around the point the effect plays at:
 * - `ring`: evenly round a circle, flying outward.
 * - `scatter`: at random angles and distances, at uneven speeds (spikes, clouds, zaps).
 * - `streak`: along a line trailing behind the effect's direction, moving further back (a negative
 *   speed sends them forward instead, with the flow).
 * - `inward`: round a circle, flying in toward the centre (a pull).
 * - `twinkle`: dotted about the area, nearly still, each living a different time (a shimmer).
 * - `kickup`: at the point, flung out to both sides and a little up (dust off the ground).
 */
export type Pattern = 'ring' | 'scatter' | 'streak' | 'inward' | 'twinkle' | 'kickup';

/**
 * How a part's particles move after they spawn. The first four follow the theme's particle physics
 * (`ParticlePhysics`: `rise` floats up, `fall` sinks, `drift` hangs, `splash` is a short burst);
 * `coast` is the same everywhere: quick to slow, no weight, for sparks, flames and streaks.
 */
export type Motion = 'rise' | 'fall' | 'drift' | 'splash' | 'coast';

/** Which particle field a part spawns into: behind the racers or above them. */
export type FxLayer = 'back' | 'front';

/** One group of particles in a recipe. Distances are px, speeds px per tick, lives ticks. */
export interface RecipePart {
  pattern: Pattern;
  look: ParticleLook;
  motion: Motion;
  count: number;
  /** How far from the point the particles start (a streak's length, an inward ring's size). */
  radius: number;
  speed: number;
  life: number;
  layer: FxLayer;
}

/** Everything one moment spawns, in order. */
export type Recipe = readonly RecipePart[];
