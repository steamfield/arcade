/**
 * Save format. To change it: bump SAVE_VERSION, add migrations[old] that
 * upgrades old to old+1, and commit tests/fixtures/save-v<old>.json captured
 * from the old code. The fixture test proves every old save still loads.
 */
import type { Migrations } from '@arcade/core';
import { z } from 'zod';
import { CHARACTER_IDS, type CharacterId } from './types.ts';

export const SAVE_VERSION = 3;

export const SaveSchema = z.object({
  /** Fastest finish, with the place it earned. Only finished races count. */
  best: z.object({ ticks: z.number().int().positive(), place: z.number().int().min(1).max(4) }).nullable(),
  /** Races run to the results screen. */
  races: z.number().int().nonnegative(),
  settings: z.object({
    muted: z.boolean(),
    /** Null follows the OS prefers-reduced-motion setting. */
    reducedMotion: z.boolean().nullable(),
  }),
  /** The character picked last on the select screen; races and the select cursor start from it. */
  character: z.enum(CHARACTER_IDS as [CharacterId, ...CharacterId[]]),
});

export type SaveData = z.infer<typeof SaveSchema>;

export const NEW_GAME: SaveData = {
  best: null,
  races: 0,
  settings: { muted: false, reducedMotion: null },
  character: 'rudy',
};

/** The v2 shape, before the roster: everything in v3 but the picked character. */
type SaveDataV2 = Omit<SaveData, 'character'>;

export const migrations: Migrations = {
  // v1 was the template's coin-collecting save. Nothing in it carries over to a race.
  1: (): SaveDataV2 => ({ best: null, races: 0, settings: { muted: false, reducedMotion: null } }),
  // v2 predates the roster; everyone raced as the hero, Rudy.
  2: (old): SaveData => ({ ...(old as SaveDataV2), character: 'rudy' }),
};
