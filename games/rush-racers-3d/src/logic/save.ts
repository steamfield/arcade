import type { Migrations } from '@arcade/core';
import { z } from 'zod';
import { CHARACTER_IDS, type CharacterId } from './types.ts';

/**
 * Save format. To change it: bump SAVE_VERSION, add migrations[old] that
 * upgrades old → old+1, and commit tests/fixtures/save-v<old>.json captured
 * from the old code. tests/save.test.ts proves every old save still loads.
 *
 * v1 was the three-3d template's orb field (seed, collected); v2 is the racer's.
 */
export const SAVE_VERSION = 2;

export const SaveSchema = z.object({
  /** The character last raced as. */
  character: z.enum(CHARACTER_IDS as [CharacterId, ...CharacterId[]]),
  /** Best finish per course id, in race ticks. */
  bests: z.record(z.string(), z.number().int().positive()),
});

export type SaveData = z.infer<typeof SaveSchema>;

/** A first-time player's save. */
export const NEW_SAVE: SaveData = { character: 'grit', bests: {} };

export const migrations: Migrations = {
  // The template's orb progress means nothing to a race: start fresh.
  1: () => ({ ...NEW_SAVE, bests: {} }),
};
