/**
 * Gravity wells on the race screen: where each one is, how far it reaches, and for a black hole the
 * horizon not to cross. `wellMarks` says what to draw, in world pixels; `createWellView` draws it.
 */
import type Phaser from 'phaser';
import type { Level, Vec } from '../../logic/types.ts';

/** What to draw for one well: its centre, the ring at its reach, and a horizon disc for a black hole (null for a planet). */
export interface WellMark {
  centre: Vec;
  reach: number;
  horizon: number | null;
}

/** One mark per well of `level`, in the level's order. */
export function wellMarks(_level: Level): WellMark[] {
  return [];
}

/** Draws `level`'s wells in `scene`, behind racers and pickups and in front of the backdrop. A level without wells draws nothing. */
export function createWellView(_scene: Phaser.Scene, _level: Level, _reducedMotion: boolean): void {}
