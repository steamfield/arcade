import { describe, expect, it } from 'vitest';
import type { ThemeId } from '../../logic/courses/types.ts';
import { type HitCause, POWER_UP_KINDS } from '../../logic/types.ts';
import { fireRecipe, impactRecipe, shieldPopRecipe } from './item-recipes.ts';
import type { Recipe } from './recipe-types.ts';
import { FxFrame } from './textures.ts';

const THEMES: readonly ThemeId[] = ['ocean', 'forest', 'sky', 'space'];
const SHEET_FRAMES = new Set<string>(Object.values(FxFrame));
const BUBBLE_FRAMES = new Set<string>([FxFrame.bubble, FxFrame.bubbleSmall]);

/** What a recipe looks like on screen, ignoring the numbers: each part's pattern, frame and tint. */
const lookOf = (recipe: Recipe) => recipe.map(({ pattern, look }) => `${pattern}:${look.frame}:${look.tint}`).join(' ');
const framesOf = (recipe: Recipe) => recipe.map((part) => part.look.frame);

describe('item fire recipes', () => {
  it.each(THEMES)('give every power-up its own fire in %s, drawn from the particle sheet', (theme) => {
    const fires = POWER_UP_KINDS.map((kind) => fireRecipe(kind, theme));

    for (const fire of fires) {
      expect(fire.length).toBeGreaterThan(0);
      for (const frame of framesOf(fire)) expect(SHEET_FRAMES).toContain(frame);
    }
    expect(new Set(fires.map(lookOf)).size).toBe(POWER_UP_KINDS.length);
  });

  it.each(['forest', 'sky', 'space'] as const)('shed no bubbles in %s, where nothing is underwater', (theme) => {
    const frames = POWER_UP_KINDS.flatMap((kind) => framesOf(fireRecipe(kind, theme)));

    expect(frames.filter((frame) => BUBBLE_FRAMES.has(frame))).toEqual([]);
  });

  it('look different in every world for the same power-up', () => {
    for (const kind of POWER_UP_KINDS) {
      expect(new Set(THEMES.map((theme) => lookOf(fireRecipe(kind, theme)))).size).toBe(THEMES.length);
    }
  });
});

describe('impact recipes', () => {
  it('tell urchin spikes, a jelly zap, a bubble pop, a flash and an enemy thump apart', () => {
    const causes: HitCause[] = ['urchin', 'jelly', 'bubble', 'flash', 'shark'];
    for (const theme of THEMES) {
      expect(new Set(causes.map((cause) => lookOf(impactRecipe(cause, theme)))).size).toBe(causes.length);
    }
  });

  it('break a Bubble Shield into a ring of shards', () => {
    for (const theme of THEMES) {
      expect(shieldPopRecipe(theme).map(({ pattern, look }) => [pattern, look.frame])).toEqual([
        ['ring', FxFrame.shard],
      ]);
    }
  });
});
