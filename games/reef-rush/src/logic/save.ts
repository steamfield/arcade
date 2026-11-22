/**
 * Save format. To change it: bump SAVE_VERSION, add migrations[old] that
 * upgrades old to old+1, and commit tests/fixtures/save-v<old>.json captured
 * from the old code. The fixture test proves every old save still loads.
 */
import type { Migrations } from '@arcade/core';
import { z } from 'zod';

export const SAVE_VERSION = 2;

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
});

export type SaveData = z.infer<typeof SaveSchema>;

export const NEW_GAME: SaveData = { best: null, races: 0, settings: { muted: false, reducedMotion: null } };

export const migrations: Migrations = {
  // v1 was the template's coin-collecting save. Nothing in it carries over to a race.
  1: (): SaveData => ({ ...NEW_GAME, settings: { ...NEW_GAME.settings } }),
};
