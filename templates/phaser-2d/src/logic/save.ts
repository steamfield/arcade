import type { Migrations } from '@arcade/core';
import { z } from 'zod';

/**
 * Save format. To change it: bump SAVE_VERSION, add migrations[old] that
 * upgrades old → old+1, and commit a fixture tests/fixtures/save-v<old>.json
 * captured from the old code. The fixture test proves every old save still loads.
 */
export const SAVE_VERSION = 1;

export const SaveSchema = z.object({
  /** Indices into level.coins. */
  collected: z.array(z.number().int().nonnegative()),
  completed: z.boolean(),
});

export type SaveData = z.infer<typeof SaveSchema>;

export const migrations: Migrations = {};

export const NEW_GAME: SaveData = { collected: [], completed: false };
