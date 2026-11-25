/**
 * The course registry: every course the game can race. Only this file imports course files;
 * `logic/architecture.test.ts` guards that, so adding a course means adding it here.
 */
import type { Course } from '../types.ts';
import { THORNWOOD_TRAIL } from './thornwood-trail.ts';

/** Every course, in the order a course select would list them. */
export const COURSES: readonly Course[] = [THORNWOOD_TRAIL];

/** The course a launch without `?course=` races. */
export const DEFAULT_COURSE: Course = THORNWOOD_TRAIL;

/** The course with this id, or null when none has it. */
export function courseById(_id: string): Course | null {
  throw new Error('not implemented');
}
