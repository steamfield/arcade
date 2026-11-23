/**
 * The course registry: every shipped course by id, the listed ones in menu order, and the lookups
 * the world, saves and URLs go through. The only file that imports a course file. Tests and
 * previews add courses with `registerCourse`; game code never does.
 */
import { parseLevel } from '../level/parse.ts';
import type { Level, World } from '../types.ts';
import { BRAMBLE_RUN } from './bramble-run.ts';
import { DRIFT_TEST } from './drift-test.ts';
import { RUN_TEST } from './run-test.ts';
import { SKY_TEST } from './sky-test.ts';
import { SUNLIT_SHALLOWS } from './sunlit-shallows.ts';
import type { Course, ShippedCourse, ShippedCourseId } from './types.ts';

/** Every shipped course by id, in menu order: course select lists the `listed` ones in this order. */
export const COURSES: Readonly<Record<ShippedCourseId, ShippedCourse>> = {
  'sunlit-shallows': SUNLIT_SHALLOWS,
  'bramble-run': BRAMBLE_RUN,
  'run-test': RUN_TEST,
  'sky-test': SKY_TEST,
  'drift-test': DRIFT_TEST,
};

/**
 * Courses shown on course select, in menu order: the shipped courses whose `listed` flag is set, so
 * the menu and the save rules (bests, `lastCourse`) can never disagree about which courses are listed.
 */
export const LISTED_COURSES: readonly Course[] = Object.values(COURSES).filter((course) => course.listed);

/** The course a new player, an unknown `?course=` and an unlisted `lastCourse` fall back to. */
export const DEFAULT_COURSE: Course = SUNLIT_SHALLOWS;

const registered = new Map<string, Course>();
const parsed = new WeakMap<Course, Level>();

function isShipped(id: string): id is ShippedCourseId {
  return Object.hasOwn(COURSES, id);
}

/**
 * The course with `id`, shipped or registered, or null. Takes any string because ids arrive from
 * saves and URLs.
 */
export function courseById(id: string): Course | null {
  if (isShipped(id)) return COURSES[id];
  return registered.get(id) ?? null;
}

/**
 * Adds a course that isn't shipped, for tests and previews, so a world can hold its id.
 *
 * @throws {Error} When `course.id` is a shipped course's id or already registered to another course.
 */
export function registerCourse(course: Course): void {
  if (isShipped(course.id)) throw new Error(`Course id '${course.id}' belongs to a shipped course`);
  const existing = registered.get(course.id);
  if (existing && existing !== course) throw new Error(`Course id '${course.id}' is already registered`);
  registered.set(course.id, course);
}

/**
 * The course a world is racing.
 *
 * @throws {Error} When the world holds an id that is neither shipped nor registered.
 */
export function courseOf(world: Pick<World, 'course'>): Course {
  const course = courseById(world.course);
  if (!course) throw new Error(`Unknown course '${world.course}'`);
  return course;
}

/**
 * The course's level, parsed once per course object.
 *
 * @throws {LevelError} When the course's level data is malformed (see `parseLevel`).
 */
export function levelOf(course: Course): Level {
  const cached = parsed.get(course);
  if (cached) return cached;
  const level = parseLevel(course.level);
  parsed.set(course, level);
  return level;
}
