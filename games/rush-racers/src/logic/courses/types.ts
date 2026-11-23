/**
 * What a course is: a level plus the world (and so the movement style), look and song it races with, and any course
 * tuning. Ids are plain strings so test courses can register alongside shipped ones; the unions
 * below name the shipped ones. The engine maps theme and song ids to art and music, never the reverse.
 */
import type { CatchUpBounds } from '../difficulty-level.ts';
import type { MediumTuning } from '../media/types.ts';
import type { Difficulty, LevelDef } from '../types.ts';

/** Shipped courses. Grows with each course: 'kelp-forest', 'sky-test', ... */
export type ShippedCourseId = 'sunlit-shallows';
/** Shipped movement styles. Grows: 'run', later 'flight' or 'space'. */
export type ShippedMediumId = 'swim';
/** Looks the engine draws a course with. */
export type ThemeId = 'ocean';
/** Songs the engine can play for a race, by the soundtrack's names. */
export type SongId = 'race';

export interface Course {
  /** Stable id: saves, `?course=` and the registry key. */
  id: string;
  /** Shown on course select and results. */
  name: string;
  level: LevelDef;
  /** A key of `WORLDS` (or a world registered for tests); the course is raced in that world's medium. */
  world: string;
  theme: ThemeId;
  song: SongId;
  /** False: reachable only by `?course=` and tests; never written to `lastCourse` and never given a best. */
  listed: boolean;
  /** A good swimmer's finish on Hard, in ticks. Difficulty bars derive from it. */
  parTicks: number;
  /** Course overrides of the medium's numbers. */
  tuning?: Partial<MediumTuning>;
  /**
   * Per-level overrides of the rivals' catch-up bounds, merged field by field onto that level's own
   * bounds (`rivalCatchUpFor`). A level the course doesn't name keeps the table's bounds.
   */
  catchUp?: Partial<Record<Difficulty, Partial<CatchUpBounds>>>;
}
