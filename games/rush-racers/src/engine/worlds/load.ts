/**
 * Builds a world's skin and theme textures the first time a screen needs them, from the `art.ts`
 * chunks `WORLD_ART` and `THEME_ART` import on demand. A call starts every import it needs at once,
 * then registers in order, themes before worlds, as boot always did. Each world and theme imports
 * and registers once; callers asking for the same one while it loads share that import, and a
 * failed import is forgotten so the next call tries again.
 */
import type Phaser from 'phaser';
import type { Course, ThemeId } from '../../logic/courses/types.ts';
import type { ShippedWorldId } from '../../logic/worlds/types.ts';
import { THEME_ART, THEMES } from '../themes/index.ts';
import { assertSkinTextures, SKINS, skinFor, WORLD_ART } from './index.ts';

/** A world's or theme's `art.ts` once imported. */
type ArtModule = { registerArt(scene: Phaser.Scene): void };

/** Loads one world's or theme's `art.ts`. */
export type ArtImport = () => Promise<ArtModule>;

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
   * `ensureCourseArt` for several courses with their imports started together: their themes
   * register first, then their worlds.
   *
   * @throws {Error} Rejects as `ensureCourseArt` does, for the first world or theme that fails.
   */
  ensureCoursesArt(scene: Phaser.Scene, courses: readonly Course[]): Promise<void>;
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

/** One world's or theme's art to load: its key (`world:<id>`, `theme:<id>`), its import and what to check once it is drawn. */
interface ArtEntry {
  key: string;
  importArt: ArtImport;
  check(scene: Phaser.Scene): void;
}

/** Creates a loader over `sources`, with nothing loaded yet. */
export function createArtLoader(sources: ArtSources): ArtLoader {
  const imports = new Map<string, Promise<ArtModule>>();
  /** Keys of the art registered, in order. */
  const loaded: string[] = [];

  /** Starts `entry`'s import unless one is under way or done; a failure is forgotten so a later call retries. */
  function importOnce({ key, importArt }: ArtEntry): Promise<ArtModule> {
    const known = imports.get(key);
    if (known) return known;
    const load = importArt().catch((cause: unknown) => {
      imports.delete(key);
      throw new Error(`Couldn't load the art for ${describe(key)}: ${messageOf(cause)}`, { cause });
    });
    imports.set(key, load);
    return load;
  }

  /** Imports every entry at once, then registers and checks those not yet in, in `entries` order. */
  async function ensure(scene: Phaser.Scene, entries: readonly ArtEntry[]): Promise<void> {
    const modules = await Promise.all(entries.map(importOnce));
    entries.forEach((entry, index) => {
      if (loaded.includes(entry.key)) return;
      modules[index]?.registerArt(scene);
      entry.check(scene);
      loaded.push(entry.key);
    });
  }

  const themeEntry = (id: ThemeId): ArtEntry => ({
    key: `theme:${id}`,
    importArt: sources.themes[id],
    check: () => {},
  });
  const worldEntry = (id: ShippedWorldId): ArtEntry => ({
    key: `world:${id}`,
    importArt: sources.worlds[id],
    check: (scene) => assertSkinTextures(scene.textures, SKINS[id], scene.anims),
  });
  /** Each course's theme, then each course's world, once each. */
  const courseEntries = (courses: readonly Course[]): ArtEntry[] => {
    // skinFor names the course when its world has no skin; past it each world is a shipped one.
    for (const course of courses) skinFor(course);
    const themes = new Set(courses.map((course) => course.theme));
    const worlds = new Set(courses.map((course) => course.world as ShippedWorldId));
    return [...[...themes].map(themeEntry), ...[...worlds].map(worldEntry)];
  };
  const has = (key: string) => loaded.includes(key);

  return {
    ensureCourseArt: (scene, course) => ensure(scene, courseEntries([course])),
    ensureCoursesArt: (scene, courses) => ensure(scene, courseEntries(courses)),
    ensureAllArt: (scene) =>
      ensure(scene, [
        ...(Object.keys(THEMES) as ThemeId[]).map(themeEntry),
        ...(Object.keys(SKINS) as ShippedWorldId[]).map(worldEntry),
      ]),
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
/** The game's loader's `ensureCoursesArt`: registers several courses' theme and world art once. */
export const ensureCoursesArt = shared.ensureCoursesArt;
/** The game's loader's `ensureAllArt`: registers every theme's and world's art once. */
export const ensureAllArt = shared.ensureAllArt;
/** The game's loader's `hasCourseArt`. */
export const hasCourseArt = shared.hasCourseArt;
/** The game's loader's `hasAllArt`. */
export const hasAllArt = shared.hasAllArt;
/** The game's loader's `loadedArt`: world and theme ids registered so far, for `debugSummary`. */
export const loadedArt = shared.loadedArt;
