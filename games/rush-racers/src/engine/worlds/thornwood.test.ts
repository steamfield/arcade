import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../logic/types.ts';
import { assertSkinAssets } from './index.ts';
import { REEF_SKIN } from './reef.ts';
import { THORNWOOD_SKIN } from './thornwood.ts';

const longest = (strings: readonly string[]) => Math.max(...strings.map((text) => text.length));

describe('the Thornwood skin', () => {
  it('passes the skin asset check', () => {
    expect(() => assertSkinAssets(THORNWOOD_SKIN)).not.toThrow();
  });

  it('words items, enemies and pickups the Thornwood way', () => {
    const { text } = THORNWOOD_SKIN.objects;
    expect(text.attackCaptions).toEqual({
      homingSquid: 'BEE',
      riptide: 'TAILWIND',
      undertow: 'SNARE VINE',
      mimic: 'COPYCAT',
    });
    expect(text.enemyCaptions).toEqual({
      crab: 'BEETLE WALKS',
      shark: 'BOAR CHARGES',
      eel: 'SNAKE LUNGES',
    });
    expect([text.cratesHeading, text.pearlsHeading, text.slowedBy, text.trapped]).toEqual([
      'HIT CRATES',
      'GRAB ACORNS',
      'SLOWED BY MUD',
      'SAP',
    ]);
    expect(THORNWOOD_SKIN.cast.abilities.gil.name).toBe('SPRING JUMP');
  });

  it("keeps every ability line within the longest of Reef's, so the select card fits", () => {
    const names = (skin: typeof REEF_SKIN) => CHARACTER_IDS.map((id) => skin.cast.abilities[id].name);
    const blurbs = (skin: typeof REEF_SKIN) => CHARACTER_IDS.map((id) => skin.cast.abilities[id].blurb);
    expect(longest(names(THORNWOOD_SKIN))).toBeLessThanOrEqual(longest(names(REEF_SKIN)));
    expect(longest(blurbs(THORNWOOD_SKIN))).toBeLessThanOrEqual(longest(blurbs(REEF_SKIN)));
  });

  it("keeps the HUD and How to Play words within the longest of Reef's", () => {
    const hud = (skin: typeof REEF_SKIN) => [skin.objects.text.slowedBy, skin.objects.text.trapped];
    const enemies = (skin: typeof REEF_SKIN) => Object.values(skin.objects.text.enemyCaptions);
    const headings = (skin: typeof REEF_SKIN) => [skin.objects.text.cratesHeading, skin.objects.text.pearlsHeading];
    for (const group of [hud, enemies, headings]) {
      expect(longest(group(THORNWOOD_SKIN))).toBeLessThanOrEqual(longest(group(REEF_SKIN)));
    }
  });
});
