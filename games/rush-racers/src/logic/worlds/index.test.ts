/**
 * The world registry's links: every shipped world races in a medium the medium registry has, and
 * every shipped course is raced in a world this registry has, so no shipped course can fail to
 * find how it moves.
 */
import { describe, expect, it } from 'vitest';
import { COURSES } from '../courses/index.ts';
import { mediumById } from '../media/index.ts';
import { WORLDS } from './index.ts';

describe('the shipped worlds', () => {
  it('each race in a medium the medium registry resolves', () => {
    const unresolved = Object.values(WORLDS)
      .filter((world) => mediumById(world.medium) === null)
      .map((world) => `${world.id} -> ${world.medium}`);
    expect(Object.keys(WORLDS)).toEqual(['reef', 'thornwood', 'cloudreach', 'farside']);
    expect(unresolved).toEqual([]);
  });

  it('are where every shipped course is raced', () => {
    const unresolved = Object.values(COURSES)
      .filter((course) => !Object.hasOwn(WORLDS, course.world))
      .map((course) => `${course.id} -> ${course.world}`);
    expect(unresolved).toEqual([]);
  });
});
