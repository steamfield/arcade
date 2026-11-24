/**
 * The typed scenario kit and the presets scenarios and smoke tests share: input that gets from one
 * screen to another, and save fixtures built from the current `SAVE_VERSION`, so a save change
 * updates them in one place.
 */
import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';
import { SAVE_VERSION, type SaveData } from '../src/logic/save.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/**
 * From the title to the level's first tick of play: confirm the selected row (Continue when the
 * save has progress, else New game), then let two ticks pass so the confirm press is released.
 */
export const TITLE_TO_PLAY = [tap('jump'), wait(2)];

/** A save with the two coins on the first ledge (indices 5 and 6) collected, as the store's save envelope. */
export const TWO_COINS_SAVE = {
  version: SAVE_VERSION,
  savedAt: '2026-11-22T00:00:00.000Z',
  data: { collected: [5, 6], completed: false } satisfies SaveData,
};
