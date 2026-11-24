/**
 * The medium registry: every shipped movement style by id, the lookups the world goes through (its
 * medium, and that medium's tuning with the course's overrides and the difficulty's multipliers), and
 * the one place generic code asks for navigation to be rebuilt. Tests add media (the conformance
 * suite's glide) with `registerMedium`; game code never does.
 */

import { courseOf } from '../courses/index.ts';
import type { Course, ShippedMediumId } from '../courses/types.ts';
import type { Difficulty, World } from '../types.ts';
import { FLIGHT_MEDIUM } from './flight/index.ts';
import { RUN_MEDIUM } from './run/index.ts';
import { SWIM_MEDIUM } from './swim/index.ts';
import type { Medium, MediumTuning } from './types.ts';

/** Every shipped medium by id. */
export const MEDIA: Readonly<Record<ShippedMediumId, Medium>> = {
  swim: SWIM_MEDIUM,
  run: RUN_MEDIUM,
  flight: FLIGHT_MEDIUM,
};

const registered = new Map<string, Medium>();

function isShipped(id: string): id is ShippedMediumId {
  return Object.hasOwn(MEDIA, id);
}

/** The medium with `id`, shipped or registered, or null. */
export function mediumById(id: string): Medium | null {
  if (isShipped(id)) return MEDIA[id];
  return registered.get(id) ?? null;
}

/**
 * Adds a medium that isn't shipped, for tests, so a course and a world can name it.
 *
 * @throws {Error} When `medium.id` is a shipped medium's id or already registered to another medium.
 */
export function registerMedium(medium: Medium): void {
  if (isShipped(medium.id)) throw new Error(`Medium id '${medium.id}' belongs to a shipped medium`);
  const existing = registered.get(medium.id);
  if (existing && existing !== medium) throw new Error(`Medium id '${medium.id}' is already registered`);
  registered.set(medium.id, medium);
}

/**
 * The medium a world races in.
 *
 * @throws {Error} When the world holds an id that is neither shipped nor registered.
 */
export function mediumOf(world: Pick<World, 'medium'>): Medium {
  const medium = mediumById(world.medium);
  if (!medium) throw new Error(`Unknown medium '${world.medium}'`);
  return medium;
}

const tunings = new WeakMap<Course, Map<Difficulty, MediumTuning>>();

/**
 * The tuning a world races with: its medium's, with the course's overrides on top (`extra` merged
 * key by key), then the medium's multipliers for the world's difficulty (`byDifficulty`) over
 * `extra`. The result carries no `byDifficulty`, since its multipliers are already in. Worked out
 * once per course object and difficulty and cached, so a course object must not change after its
 * first use.
 *
 * @throws {Error} When the world names a course or medium that is neither shipped nor registered.
 * @throws {Error} When the course's `tuning.extra` names a key the medium's `extra` doesn't have,
 *   naming the course, the key and the medium's valid extra keys.
 * @throws {Error} When the medium's multipliers for the world's difficulty name a key the merged
 *   `extra` doesn't have, naming the medium, the difficulty and the key.
 */
export function effectiveTuning(world: Pick<World, 'course' | 'medium' | 'difficulty'>): MediumTuning {
  const course = courseOf(world);
  let byLevel = tunings.get(course);
  if (!byLevel) {
    byLevel = new Map();
    tunings.set(course, byLevel);
  }
  const cached = byLevel.get(world.difficulty);
  if (cached) return cached;
  const { byDifficulty, ...base } = mediumOf(world).tuning;
  const overrides = course.tuning ?? {};
  assertKnownExtras(course, world.medium, base.extra, overrides.extra ?? {});
  const extra = { ...base.extra, ...overrides.extra };
  const multipliers = byDifficulty?.[world.difficulty] ?? {};
  const tuning = { ...base, ...overrides, extra: scaleExtras(world.medium, world.difficulty, extra, multipliers) };
  byLevel.set(world.difficulty, tuning);
  return tuning;
}

/**
 * `extra` with each key in `multipliers` multiplied by it.
 *
 * @throws {Error} When a multiplier names a key `extra` doesn't have, since it would otherwise do nothing.
 */
function scaleExtras(
  mediumId: string,
  difficulty: Difficulty,
  extra: MediumTuning['extra'],
  multipliers: MediumTuning['extra'],
): MediumTuning['extra'] {
  const scaled: Record<string, number> = { ...extra };
  for (const [key, multiplier] of Object.entries(multipliers)) {
    const value = scaled[key];
    if (value === undefined) {
      const valid = Object.keys(extra).join(', ') || 'none';
      throw new Error(
        `Medium '${mediumId}' scales unknown extra '${key}' on difficulty '${difficulty}' (valid extras: ${valid})`,
      );
    }
    scaled[key] = value * multiplier;
  }
  return scaled;
}

/** Throws on a course extra the medium doesn't read, since a misspelt key would otherwise do nothing. */
function assertKnownExtras(
  course: Course,
  mediumId: string,
  mediumExtra: MediumTuning['extra'],
  courseExtra: MediumTuning['extra'],
): void {
  const unknown = Object.keys(courseExtra).find((key) => !Object.hasOwn(mediumExtra, key));
  if (unknown === undefined) return;
  const valid = Object.keys(mediumExtra).join(', ') || 'none';
  throw new Error(
    `Course '${course.id}' tunes unknown extra '${unknown}' for medium '${mediumId}' (valid extras: ${valid})`,
  );
}

/**
 * Rebuilds the world's navigation through its medium, for the level with `world.broken` coral gone
 * and the world's effective tuning.
 *
 * @throws {Error} When the world names a course or medium that is neither shipped nor registered.
 */
export function rebuildNav(world: World): void {
  world.nav = mediumOf(world).buildNav(world.level, world.broken, effectiveTuning(world));
}
