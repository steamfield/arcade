import { createRng, EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { racerOf } from '../../logic/test-world.ts';
import { createWorld } from '../../logic/world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { FOREST_THEME } from '../themes/forest.ts';
import { SKY_THEME } from '../themes/sky.ts';
import type { Theme } from '../themes/types.ts';
import { createMovementEffects } from './movement-effects.ts';
import { createParticleField } from './particles.ts';
import { createRecipePlayer } from './recipe-player.ts';
import { FxFrame } from './textures.ts';

/** The live particles movement effects leave after one tick's `events` on `course`, drawn in `theme`. */
function particlesAfter(course: 'run-test' | 'sky-test', theme: Theme, events: GameEvent[]) {
  const world = createWorld(COURSES[course], new EventLog<GameEvent>(), { seed: 1 });
  const back = createParticleField(32);
  const front = createParticleField(32);
  const effects = createMovementEffects(world, theme.id, createRecipePlayer(back, front, createRng(1), theme, false));
  effects.onTick(events.map((event, seq) => ({ ...event, tick: 300, seq }) as Stamped<RuntimeEvent>));
  return { world, shed: [...back.particles, ...front.particles].filter((particle) => particle.live) };
}

describe('movement effects', () => {
  it("kicks up dust at a runner's feet when it jumps", () => {
    const { world, shed } = particlesAfter('run-test', FOREST_THEME, [{ type: 'racer.jumped', id: 'tess' }]);
    const tess = racerOf(world, 'tess');

    expect(shed.map((particle) => particle.frame)).toEqual(Array(4).fill(FxFrame.puff));
    for (const particle of shed) expect(particle.y).toBe(tess.body.y + tess.body.h);
  });

  it('sheds feathers from a flap in Cloudreach', () => {
    const { shed } = particlesAfter('sky-test', SKY_THEME, [{ type: 'racer.flapped', id: 'tess' }]);

    expect(shed.map((particle) => particle.frame)).toEqual(Array(3).fill(FxFrame.feather));
  });
});
