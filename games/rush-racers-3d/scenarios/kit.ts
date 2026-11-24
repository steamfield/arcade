/**
 * The scenario kit for this game: typed input helpers plus the named sequences that scenarios share,
 * so each scenario reads as what it checks rather than how it gets there. Stages (`start.query.stage`)
 * put the player at a spot on Thornwood Trail with the race already running.
 */
import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';
import { SAVE_VERSION } from '../src/logic/save.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/** Ticks of holding forward that carry the player from a stage's spot well past what lies 20-30 m ahead. */
export const RUN_ON = 240;

/** A save file in the current format, for `start: { save }`. */
export function savedGame(data: { character: string; bests: Record<string, number> }) {
  return { version: SAVE_VERSION, savedAt: '2026-11-24T00:00:00.000Z', data };
}
