/**
 * Every shipped world's skin names art and words for every character slot, item, enemy and pickup,
 * and a course resolves to its world's skin.
 */
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import { CHARACTER_IDS } from '../../logic/types.ts';
import { assertSkinAssets, SKINS, skinFor } from './index.ts';
import { REEF_SKIN } from './reef.ts';
import type { WorldSkin } from './types.ts';

describe('world skins', () => {
  it.each(Object.values(SKINS))('$id covers every key', (skin) => {
    expect(() => assertSkinAssets(skin)).not.toThrow();
  });

  it('names the world and the missing key when a skin has a gap', () => {
    const { gil: _gil, ...racers } = REEF_SKIN.cast.racers;
    const broken = {
      ...REEF_SKIN,
      id: 'broken',
      cast: { ...REEF_SKIN.cast, racers },
    } as unknown as WorldSkin;
    expect(() => assertSkinAssets(broken)).toThrow("World 'broken' skin has no racer for 'gil'");
  });

  it('gives each slot its own racer texture', () => {
    for (const skin of Object.values(SKINS)) {
      const textures = CHARACTER_IDS.map((id) => skin.cast.racers[id]);
      expect(new Set(textures).size).toBe(CHARACTER_IDS.length);
    }
  });

  it('draws Sunlit Shallows with the reef skin', () => {
    expect(skinFor(COURSES['sunlit-shallows'])).toBe(REEF_SKIN);
  });

  it('names the course and world when a course has no skin', () => {
    expect(() => skinFor({ id: 'nowhere', world: 'moon' })).toThrow(
      "Course 'nowhere' names world 'moon', which the engine has no skin for",
    );
  });
});
