/**
 * Save format. To change it: bump SAVE_VERSION, add migrations[old] that
 * upgrades old to old+1, and commit tests/fixtures/save-v<old>.json captured
 * from the old code. The fixture test proves every old save still loads.
 */
import type { Migrations } from '@arcade/core';
import { z } from 'zod';
import { CHARACTER_IDS, type CharacterId, DIFFICULTIES, type Difficulty } from './types.ts';

export const SAVE_VERSION = 5;

/** A fastest finish with the place it earned. */
const BestSchema = z.object({ ticks: z.number().int().positive(), place: z.number().int().min(1).max(4) });

export const SaveSchema = z.object({
  /** Fastest finish on each level, with the place it earned there; null until the level has a finish. Only finished races count. */
  best: z.object({ easy: BestSchema.nullable(), normal: BestSchema.nullable(), hard: BestSchema.nullable() }),
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

export const NEW_GAME: SaveData = {
  best: { easy: null, normal: null, hard: null },
  races: 0,
  settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
  character: 'rudy',
};

/** The v4 shape, before a best time per level: one best, whatever the level. */
type SaveDataV4 = Omit<SaveData, 'best'> & { best: SaveData['best'][Difficulty] };
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
  4: (old): SaveData => {
    const { best, ...rest } = old as SaveDataV4;
    return { ...rest, best: { ...NEW_GAME.best, [rest.settings.difficulty]: best } };
  },
};
