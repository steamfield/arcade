/**
 * The art loader over the real `art.ts` modules, drawn on a recording scene after the global art and
 * the UI kit as boot draws them. Only the imports are wrapped, to count them, hold them open or make
 * one fail as a 404'd chunk does.
 */
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { BRAMBLE_RUN } from '../../logic/courses/bramble-run.ts';
import { SUNLIT_SHALLOWS } from '../../logic/courses/sunlit-shallows.ts';
import { buildTextures } from '../art/index.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import { THEME_ART } from '../themes/index.ts';
import { WORLD_ART } from './index.ts';
import { type ArtImport, type ArtSources, createArtLoader } from './load.ts';
import { recordingScene } from './recording-scene.ts';
import { REEF_ITEM_ICON_FRAMES } from './reef/sprites/icons.ts';
import { THORNWOOD_SKIN } from './thornwood.ts';

/** A recording scene with the global art and UI kit drawn, and loops it remembers, as the boot scene is when the loader runs. */
function bootedScene(): { scene: Phaser.Scene; textures: Map<string, unknown> } {
  const art = recordingScene();
  const loops = new Set<string>();
  Object.assign(art.scene, {
    anims: { create: ({ key }: { key: string }) => loops.add(key), exists: (key: string) => loops.has(key) },
  });
  buildTextures(art.scene);
  buildUiTextures(art.scene, REEF_ITEM_ICON_FRAMES);
  return { scene: art.scene, textures: art.built };
}

/** The real sources, each import counted by id. */
function countedSources(): { sources: ArtSources; imports: string[] } {
  const imports: string[] = [];
  const counted = <Id extends string>(map: Readonly<Record<Id, ArtImport>>) =>
    Object.fromEntries(
      Object.entries<ArtImport>(map).map(([id, load]) => [
        id,
        () => {
          imports.push(id);
          return load();
        },
      ]),
    ) as Record<Id, ArtImport>;
  return { sources: { worlds: counted(WORLD_ART), themes: counted(THEME_ART) }, imports };
}

describe('the art loader', () => {
  it("registers a course's theme and world art once, and nothing else", async () => {
    const { scene, textures } = bootedScene();
    const { sources, imports } = countedSources();
    const loader = createArtLoader(sources);
    const before = textures.size;
    expect(loader.hasCourseArt(BRAMBLE_RUN)).toBe(false);

    await loader.ensureCourseArt(scene, BRAMBLE_RUN);
    const after = textures.size;
    await loader.ensureCourseArt(scene, BRAMBLE_RUN);

    expect(imports).toEqual(['forest', 'thornwood']);
    expect(loader.loadedArt()).toEqual(['forest', 'thornwood']);
    expect(loader.hasCourseArt(BRAMBLE_RUN)).toBe(true);
    expect(loader.hasCourseArt(SUNLIT_SHALLOWS)).toBe(false);
    expect(after).toBeGreaterThan(before);
    expect(textures.size).toBe(after);
    expect(textures.has(THORNWOOD_SKIN.cast.racers.rudy)).toBe(true);
  });

  it('starts every import at once, and registers the theme first whichever arrives first', async () => {
    const { scene } = bootedScene();
    const requested: string[] = [];
    const arrive = new Map<string, () => void>();
    const held =
      (id: string, importArt: ArtImport): ArtImport =>
      () => {
        requested.push(id);
        return new Promise((resolve) => arrive.set(id, () => resolve(importArt())));
      };
    const loader = createArtLoader({
      worlds: { ...WORLD_ART, thornwood: held('thornwood', WORLD_ART.thornwood) },
      themes: { ...THEME_ART, forest: held('forest', THEME_ART.forest) },
    });

    const loading = loader.ensureCoursesArt(scene, [BRAMBLE_RUN, SUNLIT_SHALLOWS]);
    expect(requested).toEqual(['forest', 'thornwood']);
    arrive.get('thornwood')?.();
    arrive.get('forest')?.();
    await loading;

    expect(loader.loadedArt()).toEqual(['forest', 'ocean', 'thornwood', 'reef']);
  });

  it('shares one load between calls made while it runs', async () => {
    const { scene } = bootedScene();
    const { sources, imports } = countedSources();
    const loader = createArtLoader(sources);

    await Promise.all([loader.ensureCourseArt(scene, BRAMBLE_RUN), loader.ensureCourseArt(scene, BRAMBLE_RUN)]);

    expect(imports).toEqual(['forest', 'thornwood']);
  });

  it('rejects naming the world when its chunk fails to load, and loads it on the next call', async () => {
    const { scene } = bootedScene();
    const { sources, imports } = countedSources();
    const chunk404 = new TypeError('Failed to fetch dynamically imported module: /assets/art-x.js');
    let fail = true;
    const loader = createArtLoader({
      ...sources,
      worlds: {
        ...sources.worlds,
        thornwood: () => (fail ? Promise.reject(chunk404) : sources.worlds.thornwood()),
      },
    });

    const failed = await loader.ensureCourseArt(scene, BRAMBLE_RUN).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(Error);
    expect((failed as Error).message).toBe(
      "Couldn't load the art for world 'thornwood': Failed to fetch dynamically imported module: /assets/art-x.js",
    );
    expect((failed as Error).cause).toBe(chunk404);
    expect(loader.loadedArt()).toEqual([]);

    fail = false;
    await loader.ensureCourseArt(scene, BRAMBLE_RUN);
    expect(loader.loadedArt()).toEqual(['forest', 'thornwood']);
    expect(imports).toEqual(['forest', 'thornwood']);
  });

  it('loads every theme, then every world', async () => {
    const { scene } = bootedScene();
    const { sources } = countedSources();
    const loader = createArtLoader(sources);
    await loader.ensureCourseArt(scene, SUNLIT_SHALLOWS);
    expect(loader.hasAllArt()).toBe(false);

    await loader.ensureAllArt(scene);

    expect(loader.loadedArt()).toEqual([
      'ocean',
      'reef',
      'forest',
      'space',
      'sky',
      'thornwood',
      'cloudreach',
      'farside',
    ]);
    expect(loader.hasAllArt()).toBe(true);
  });
});
