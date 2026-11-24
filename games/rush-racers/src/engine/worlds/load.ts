/**
 * Builds a world's skin and theme textures the first time a screen needs them, from the `art.ts`
 * chunks `WORLD_ART` and `THEME_ART` import on demand. Each world and theme registers once; callers
 * asking for the same one while it loads share that load, and a failed load is forgotten so the
 * next call tries again. Themes register before worlds, as boot always did.
 */
import type Phaser from 'phaser';
import type { Course, ThemeId } from '../../logic/courses/types.ts';
import type { ShippedWorldId } from '../../logic/worlds/types.ts';
import { THEME_ART, THEMES } from '../themes/index.ts';
import { assertSkinTextures, SKINS, skinFor, WORLD_ART } from './index.ts';

/** Loads one world's or theme's `art.ts`. */
export type ArtImport = () => Promise<{ registerArt(scene: Phaser.Scene): void }>;

/** Where a loader gets each world's and theme's art. */
export interface ArtSources {
  worlds: Readonly<Record<ShippedWorldId, ArtImport>>;
  themes: Readonly<Record<ThemeId, ArtImport>>;
}

/** A world's and theme's art on demand; see `createArtLoader`. */
export interface ArtLoader {
  /**
   * Registers `course`'s theme art, then its world art, and checks every texture its skin names.
   * Resolves at once for art already in.
   *
   * @throws {Error} Rejects when an import fails, naming the world or theme with the failure as its
   *   cause, or when registering or the texture check throws.
   */
  ensureCourseArt(scene: Phaser.Scene, course: Course): Promise<void>;
  /**
   * Registers every theme's art, then every world's.
   *
   * @throws {Error} Rejects as `ensureCourseArt` does, for the first world or theme that fails.
   */
  ensureAllArt(scene: Phaser.Scene): Promise<void>;
  /** Whether `course`'s world and theme art are both registered. */
  hasCourseArt(course: Course): boolean;
  /** Whether every world's and theme's art is registered. */
  hasAllArt(): boolean;
  /** The world and theme ids whose art is registered, in the order they registered. */
  loadedArt(): readonly string[];
}

/** Creates a loader over `sources`, with nothing loaded yet. */
export function createArtLoader(sources: ArtSources): ArtLoader {
  const pending = new Map<string, Promise<void>>();
  /** Keys (`world:<id>`, `theme:<id>`) of the art registered, in order. */
  const loaded: string[] = [];

  /** Imports and registers one world's or theme's art once; a failure clears its entry so a later call retries. */
  function ensureOne(key: string, importArt: ArtImport, scene: Phaser.Scene, check: () => void): Promise<void> {
    const known = pending.get(key);
    if (known) return known;
    const load = importArt()
      .catch((cause: unknown) => {
        throw new Error(`Couldn't load the art for ${describe(key)}: ${messageOf(cause)}`, { cause });
      })
      .then(({ registerArt }) => {
        registerArt(scene);
        check();
        loaded.push(key);
      })
      .catch((error: unknown) => {
        pending.delete(key);
        throw error;
      });
    pending.set(key, load);
    return load;
  }

  const ensureTheme = (scene: Phaser.Scene, id: ThemeId) =>
    ensureOne(`theme:${id}`, sources.themes[id], scene, () => {});
  const ensureWorld = (scene: Phaser.Scene, id: ShippedWorldId) =>
    ensureOne(`world:${id}`, sources.worlds[id], scene, () =>
      assertSkinTextures(scene.textures, SKINS[id], scene.anims),
    );
  const has = (key: string) => loaded.includes(key);

  return {
    async ensureCourseArt(scene, course) {
      // skinFor names the course when its world has no skin; past it the world is a shipped one.
      skinFor(course);
      await ensureTheme(scene, course.theme);
      await ensureWorld(scene, course.world as ShippedWorldId);
    },
    async ensureAllArt(scene) {
      for (const id of Object.keys(THEMES) as ThemeId[]) await ensureTheme(scene, id);
      for (const id of Object.keys(SKINS) as ShippedWorldId[]) await ensureWorld(scene, id);
    },
    hasCourseArt: (course) => has(`theme:${course.theme}`) && has(`world:${course.world}`),
    hasAllArt: () => loaded.length === ALL_ART_COUNT,
    loadedArt: () => loaded.map((key) => key.slice(key.indexOf(':') + 1)),
  };
}

/** How many worlds and themes there are to load. */
const ALL_ART_COUNT = Object.keys(THEMES).length + Object.keys(SKINS).length;

/** A loader key as an error names it, e.g. "world 'thornwood'". */
function describe(key: string): string {
  const [kind, id] = key.split(':');
  return `${kind} '${id}'`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const shared = createArtLoader({ worlds: WORLD_ART, themes: THEME_ART });

/** The game's loader's `ensureCourseArt`: registers `course`'s theme and world art once. */
export const ensureCourseArt = shared.ensureCourseArt;
/** The game's loader's `ensureAllArt`: registers every theme's and world's art once. */
export const ensureAllArt = shared.ensureAllArt;
/** The game's loader's `hasCourseArt`. */
export const hasCourseArt = shared.hasCourseArt;
/** The game's loader's `hasAllArt`. */
export const hasAllArt = shared.hasAllArt;
/** The game's loader's `loadedArt`: world and theme ids registered so far, for `debugSummary`. */
export const loadedArt = shared.loadedArt;
