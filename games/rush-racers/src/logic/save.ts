/**
 * Save format. To change it: bump SAVE_VERSION, add migrations[old] that
 * upgrades old to old+1, and commit tests/fixtures/save-v<old>.json captured
 * from the old code. The fixture test proves every old save still loads.
 */
import type { Migrations } from '@arcade/core';
import { z } from 'zod';
import { CHARACTER_IDS, type CharacterId, DIFFICULTIES, type Difficulty } from './types.ts';

export const SAVE_VERSION = 7;

/** A fastest finish with the place it earned. */
const BestSchema = z.object({ ticks: z.number().int().positive(), place: z.number().int().min(1).max(4) });

/** Fastest finish on each level, with the place it earned there; null until the level has a finish. Only finished races count. */
const LevelBestsSchema = z.object({
  easy: BestSchema.nullable(),
  normal: BestSchema.nullable(),
  hard: BestSchema.nullable(),
});

export const SaveSchema = z.object({
  /**
   * Bests per course id, then per level. Keys are plain strings so a save naming a course the game
   * no longer has still loads; such keys are kept and never shown. Only listed courses get a best.
   */
  bests: z.record(z.string(), LevelBestsSchema),
  /** The listed course raced last; null until one is. Choosing a course ignores it when it isn't listed. */
  lastCourse: z.string().nullable(),
  /** Races run to the results screen. */
  races: z.number().int().nonnegative(),
  settings: z.object({
    muted: z.boolean(),
    /** Null follows the OS prefers-reduced-motion setting. */
    reducedMotion: z.boolean().nullable(),
    /** How hard the rivals race; a new save starts on easy. */
    difficulty: z.enum(DIFFICULTIES as [Difficulty, ...Difficulty[]]),
  }),
  /** The character picked last on the select screen; races and the select cursor start from it. */
  character: z.enum(CHARACTER_IDS as [CharacterId, ...CharacterId[]]),
});

export type SaveData = z.infer<typeof SaveSchema>;

/** Bests on every level of one course before any finish. */
export const NO_BESTS: SaveData['bests'][string] = { easy: null, normal: null, hard: null };

export const NEW_GAME: SaveData = {
  bests: {},
  lastCourse: null,
  races: 0,
  settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
  character: 'rudy',
};

/** The v5 shape, before courses: bests per level for the one course there was. */
type SaveDataV5 = Omit<SaveData, 'bests' | 'lastCourse'> & { best: SaveData['bests'][string] };
/** The v4 shape, before a best time per level: one best, whatever the level. */
type SaveDataV4 = Omit<SaveDataV5, 'best'> & { best: SaveDataV5['best'][Difficulty] };
/** The v3 shape, before difficulty levels: settings had only sound and motion. */
type SaveDataV3 = Omit<SaveDataV4, 'settings'> & { settings: Omit<SaveData['settings'], 'difficulty'> };
/** The v2 shape, before the roster: everything in v3 but the picked character. */
type SaveDataV2 = Omit<SaveDataV3, 'character'>;

export const migrations: Migrations = {
  // v1 was the template's coin-collecting save. Nothing in it carries over to a race.
  1: (): SaveDataV2 => ({ best: null, races: 0, settings: { muted: false, reducedMotion: null } }),
  // v2 predates the roster; everyone raced as the hero, Rudy.
  2: (old): SaveDataV3 => ({ ...(old as SaveDataV2), character: 'rudy' }),
  // v3 predates difficulty levels. Everyone starts on easy, like a new save; the title screen changes it.
  3: (old): SaveDataV4 => {
    const v3 = old as SaveDataV3;
    return { ...v3, settings: { ...v3.settings, difficulty: 'easy' } };
  },
  // v4 kept one best whatever the level. It stays, under the level the save was on, so the title shows it where it was set.
  4: (old): SaveDataV5 => {
    const { best, ...rest } = old as SaveDataV4;
    return { ...rest, best: { ...NO_BESTS, [rest.settings.difficulty]: best } };
  },
  // v5 predates courses. Its bests were all set on the ocean course, Sunlit Shallows.
  5: (old): SaveData => {
    const { best, ...rest } = old as SaveDataV5;
    return { ...rest, bests: { 'sunlit-shallows': best }, lastCourse: null };
  },
  // v6 bests were set on the short layouts of the four listed courses; v7 lengthened every one of them
  // to about two and a half minutes, so those times could never be beaten. Other keys are kept.
  6: (old): SaveData => {
    const v6 = old as SaveData;
    const bests = Object.fromEntries(Object.entries(v6.bests).filter(([id]) => !LENGTHENED_IN_V7.has(id)));
    return { ...v6, bests };
  },
};

/** The courses whose layouts v7 lengthened, so their v6 bests no longer compare. */
const LENGTHENED_IN_V7: ReadonlySet<string> = new Set([
  'sunlit-shallows',
  'bramble-run',
  'thunderhead-pass',
  'slingshot-alley',
]);
