import { createRng } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { FOREST_THEME } from '../themes/forest.ts';
import { createParticleField, type Particle } from './particles.ts';
import { createRecipePlayer } from './recipe-player.ts';
import type { Recipe } from './recipe-types.ts';
import { FxFrame } from './textures.ts';

const SPARK_RING: Recipe = [
  {
    pattern: 'ring',
    look: { frame: FxFrame.spark, tint: 0xffffff, alpha: 1 },
    motion: 'coast',
    count: 8,
    radius: 3,
    speed: 2,
    life: 20,
    layer: 'front',
  },
];
const FLAME_STREAK: Recipe = [{ ...(SPARK_RING[0] as Recipe[number]), pattern: 'streak', radius: 12, layer: 'back' }];

/** Plays `recipe` at (100, 100) pointing right, steps the fields `ticks` times and returns the live particles of each. */
function play(recipe: Recipe, reducedMotion: boolean, ticks = 0) {
  const back = createParticleField(32);
  const front = createParticleField(32);
  createRecipePlayer(back, front, createRng(1), FOREST_THEME, reducedMotion).play(recipe, 100, 100, 1, 0);
  for (let tick = 0; tick < ticks; tick++) {
    back.step();
    front.step();
  }
  const live = (particles: readonly Particle[]) => particles.filter((particle) => particle.live);
  return { back: live(back.particles), front: live(front.particles) };
}

const distance = (particle: Particle) => Math.hypot(particle.x - 100, particle.y - 100);

describe('recipe player', () => {
  it('flies a ring outward from the point, drawn above the racers in its look', () => {
    const { front, back } = play(SPARK_RING, false, 5);

    expect(back).toEqual([]);
    expect(front).toHaveLength(8);
    for (const particle of front) {
      expect(distance(particle)).toBeGreaterThan(8);
      expect(particle.frame).toBe(FxFrame.spark);
    }
  });

  it('trails a streak behind the way the moment points', () => {
    const { back } = play(FLAME_STREAK, false, 2);

    expect(back).toHaveLength(8);
    for (const particle of back) expect(particle.x).toBeLessThan(100);
  });

  it('under reduced motion spawns half as many, standing still where the full burst would reach', () => {
    const { front } = play(SPARK_RING, true);
    const later = play(SPARK_RING, true, 10).front;

    expect(front).toHaveLength(4);
    for (const particle of front) {
      expect([particle.vx, particle.vy]).toEqual([0, 0]);
      expect(distance(particle)).toBeGreaterThan(8);
    }
    expect(later.map(({ x, y }) => [x, y])).toEqual(front.map(({ x, y }) => [x, y]));
  });
});
