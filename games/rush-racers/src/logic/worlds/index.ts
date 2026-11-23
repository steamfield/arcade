/**
 * The world registry: every shipped world by id, the lookups courses and views go through (a course's
 * world and medium, a slot's name in a world), and test registration. The only file that imports a
 * world file. Tests add worlds (one per test medium, through `test-world.ts`) with `registerWorld`;
 * game code never does.
 */
import type { Course } from '../courses/types.ts';
import type { CharacterId } from '../types.ts';
import { REEF } from './reef.ts';
import type { ShippedWorldId, WorldDef } from './types.ts';

/** Every shipped world by id, in course-select order. */
export const WORLDS: Readonly<Record<ShippedWorldId, WorldDef>> = {
  reef: REEF,
};

const registered = new Map<string, WorldDef>();

function isShipped(id: string): id is ShippedWorldId {
  return Object.hasOwn(WORLDS, id);
}

/** The world with `id`, shipped or registered, or null. */
export function worldById(id: string): WorldDef | null {
  if (isShipped(id)) return WORLDS[id];
  return registered.get(id) ?? null;
}

/**
 * Adds a world that isn't shipped, for tests, so a test course can race in a test medium.
 *
 * @throws {Error} When `world.id` is a shipped world's id or already registered to another world.
 */
export function registerWorld(world: WorldDef): void {
  if (isShipped(world.id)) throw new Error(`World id '${world.id}' belongs to a shipped world`);
  const existing = registered.get(world.id);
  if (existing && existing !== world) throw new Error(`World id '${world.id}' is already registered`);
  registered.set(world.id, world);
}

/**
 * The world a course is raced in.
 *
 * @throws {Error} When the course names a world that is neither shipped nor registered, naming both.
 */
export function worldOf(course: Pick<Course, 'id' | 'world'>): WorldDef {
  const world = worldById(course.world);
  if (!world) throw new Error(`Course '${course.id}' names unknown world '${course.world}'`);
  return world;
}

/**
 * The id of the medium a course is raced in: its world's.
 *
 * @throws {Error} When the course names an unknown world (see `worldOf`).
 */
export function mediumIdOf(course: Pick<Course, 'id' | 'world'>): string {
  return worldOf(course).medium;
}

/** The name `character`'s slot goes by in `world`. */
export function castName(world: WorldDef, character: CharacterId): string {
  return world.cast[character];
}
