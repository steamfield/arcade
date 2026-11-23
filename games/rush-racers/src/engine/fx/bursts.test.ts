import { createRng } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { OCEAN_THEME } from '../themes/ocean.ts';
import { SKY_THEME } from '../themes/sky.ts';
import type { Theme } from '../themes/types.ts';
import { REEF_OBJECTS } from '../worlds/reef/objects.ts';
import { type Bursts, createBursts } from './bursts.ts';
import { createParticleField } from './particles.ts';
import { FX_TEXTURE, FxFrame } from './textures.ts';

/** The ocean theme shedding a puff for its large bubbles and a spark for its small ones, so the two are told apart. */
const PUFF_AND_SPARK: Theme = { ...OCEAN_THEME, bubbleFrames: { large: FxFrame.puff, small: FxFrame.spark } };

/**
 * The effect particles (not the debris chunks, which come from the terrain) one burst of a race in
 * `theme` leaves on screen, as how many of each frame.
 */
function framesShed(theme: Theme, burst: (bursts: Bursts) => void): Record<string, number> {
  const back = createParticleField(64);
  const front = createParticleField(64);
  burst(createBursts(back, front, createRng(1), theme, false, REEF_OBJECTS.itemTextures));
  const shed = [...back.particles, ...front.particles].filter(
    (particle) => particle.live && particle.texture === FX_TEXTURE,
  );
  const counts: Record<string, number> = {};
  for (const { frame } of shed) counts[frame] = (counts[frame] ?? 0) + 1;
  return counts;
}

const kick = (bursts: Bursts) => bursts.kickPuff(100, 100, 120, 0, 1);
const debris = (bursts: Bursts) => bursts.coralDebris(100, 100);
const finish = (bursts: Bursts) => bursts.finishBurst(100, 100);

describe('burst frames', () => {
  it("shed a theme's own bubble frames from a kick, breaking debris and the finish", () => {
    expect(framesShed(PUFF_AND_SPARK, kick)).toEqual({ [FxFrame.puff]: 2, [FxFrame.spark]: 2 });
    expect(framesShed(PUFF_AND_SPARK, debris)).toEqual({ [FxFrame.spark]: 3 });
    expect(framesShed(PUFF_AND_SPARK, finish)).toEqual({ [FxFrame.puff]: 14, [FxFrame.spark]: 8 });
  });

  it('shed cloud puffs in the sky, where nothing bubbles', () => {
    expect(framesShed(SKY_THEME, kick)).toEqual({ [FxFrame.puff]: 4 });
    expect(framesShed(SKY_THEME, debris)).toEqual({ [FxFrame.puff]: 3 });
    expect(framesShed(SKY_THEME, finish)).toEqual({ [FxFrame.puff]: 22 });
  });

  it('shed the ocean bubbles, as races always have, for a theme that leaves its frames out', () => {
    expect(OCEAN_THEME.bubbleFrames).toBeUndefined();
    expect(framesShed(OCEAN_THEME, kick)).toEqual({ [FxFrame.bubble]: 2, [FxFrame.bubbleSmall]: 2 });
    expect(framesShed(OCEAN_THEME, debris)).toEqual({ [FxFrame.bubbleSmall]: 3 });
    expect(framesShed(OCEAN_THEME, finish)).toEqual({ [FxFrame.bubble]: 14, [FxFrame.bubbleSmall]: 8 });
  });
});
