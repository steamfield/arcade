/**
 * The world an online race runs in, built from the host's start message alone so every peer builds
 * the same one: its course, seed, level, and a human in each slot the start names, with the start's
 * characters.
 */
import type { EventSink } from '@arcade/core';
import { courseById } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { RACER_IDS, type World } from '../../logic/types.ts';
import { createWorld } from '../../logic/world.ts';
import type { StartMessage } from '../../net/messages.ts';

/**
 * A world for `start`, its events going to `events`. `humans` are the start's slots in `RACER_IDS`
 * order, which is how `createWorld` and the lockstep session both expect them.
 *
 * @throws {Error} When the start names a course this build lacks; `StartSchema` refuses such a start, so this is a bug.
 */
export function createOnlineWorld(start: StartMessage, events: EventSink<GameEvent>): World {
  const course = courseById(start.course);
  if (!course) throw new Error(`An online start names course '${start.course}', which this build does not have`);
  const raced = new Set(Object.values(start.slots));
  return createWorld(course, events, {
    seed: start.seed,
    difficulty: start.difficulty,
    humans: RACER_IDS.filter((slot) => raced.has(slot)),
    characters: start.characters,
  });
}
