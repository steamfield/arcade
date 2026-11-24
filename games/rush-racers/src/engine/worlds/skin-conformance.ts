/**
 * The conformance suite for world skins: every world runs the same cast and object checks, and the
 * worlds together must not share a texture or glint key. A world's own rows (its wording, its
 * special art) stay in that world's test files.
 *
 * A world that reuses a key the global art, the UI kit, a theme or another owner drew makes
 * `drawFrames` or `claim` throw while its art is drawn, which fails that world's rows by name, so
 * there is no separate row for it.
 */
import { describe, expect, it } from 'vitest';
import { describeCastArt } from './cast-conformance.ts';
import { lazyDrawnSkin, type SkinFixture } from './drawn-skin.ts';
import { describeObjectArt } from './object-conformance.ts';

/** Runs the cast and object checks for each world, then the checks that compare worlds. */
export function describeSkinConformance(fixtures: readonly SkinFixture[]): void {
  const drawnByWorld = fixtures.map((fixture) => ({ fixture, drawn: lazyDrawnSkin(fixture.skin) }));

  for (const { fixture, drawn } of drawnByWorld) {
    describe(`${fixture.skin.id} skin art`, () => {
      describeCastArt(fixture, drawn);
      describeObjectArt(fixture, drawn);
    });
  }

  describe('keys across worlds', () => {
    it('draws no texture key that another world also draws', () => {
      const owners = new Map<string, string[]>();
      for (const { fixture, drawn } of drawnByWorld) {
        for (const key of drawn().skinKeys) owners.set(key, [...(owners.get(key) ?? []), fixture.skin.id]);
      }
      const shared = [...owners].filter(([, worlds]) => worlds.length > 1).map(([key, worlds]) => `${key}: ${worlds}`);
      expect(shared).toEqual([]);
    });

    it("gives each world's glints keys no other world uses, since the dark view bakes the colour into the texture", () => {
      const owners = new Map<string, string[]>();
      for (const { skin } of fixtures) {
        for (const glint of Object.values(skin.objects.glints)) {
          owners.set(glint.key, [...(owners.get(glint.key) ?? []), skin.id]);
        }
      }
      expect([...owners].filter(([, worlds]) => worlds.length > 1)).toEqual([]);
    });

    it.each(fixtures.filter((fixture) => fixture.keyPrefix))(
      'names every $skin.id texture under its prefix',
      (fixture) => {
        const drawn = drawnByWorld.find((entry) => entry.fixture === fixture)?.drawn;
        const unprefixed = [...(drawn?.().skinKeys ?? [])].filter((key) => !key.startsWith(fixture.keyPrefix ?? ''));
        expect(unprefixed).toEqual([]);
      },
    );
  });
}
