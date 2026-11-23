/**
 * The medium registry: every shipped movement style by id, and the lookup the world goes through.
 * Tests add media (the conformance suite's glide) with `registerMedium`; game code never does.
 */

import type { ShippedMediumId } from '../courses/types.ts';
import type { World } from '../types.ts';
import { SWIM_MEDIUM } from './swim/index.ts';
import type { Medium } from './types.ts';

/** Every shipped medium by id. */
export const MEDIA: Readonly<Record<ShippedMediumId, Medium>> = {
  swim: SWIM_MEDIUM,
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
