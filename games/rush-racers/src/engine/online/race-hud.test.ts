import { EventLog, TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { courseById } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import type { World } from '../../logic/types.ts';
import { createWorld, stepRace } from '../../logic/world.ts';
import { IDLE_INPUT } from '../../net/codec.ts';
import { HUD_ROWS_BOTTOM, racerTags, tagTop, waitingLine } from './race-hud.ts';

/** A world on Run Test with `humans` driven by people. */
function worldWith(humans: World['humans']): World {
  const course = courseById('run-test');
  if (!course) throw new Error('Run Test is not a registered course');
  return createWorld(course, new EventLog<GameEvent>(1000), { seed: 3, difficulty: 'normal', humans });
}

describe('player tags in an online race', () => {
  it('labels every racer a person drives, the local one included, and no rival', () => {
    const world = worldWith(['player', 'tess']);

    expect(racerTags(world, { labels: { player: 'P1', tess: 'P2' } })).toEqual([
      { id: 'player', label: 'P1' },
      { id: 'tess', label: 'P2' },
    ]);
  });

  it('drops the tag of a racer the AI took over when its player left', () => {
    const world = worldWith(['player', 'tess']);
    // No input for tess: her player is gone, so the AI takes her over.
    stepRace(world, { player: IDLE_INPUT }, 1 / TICK_HZ);

    expect(racerTags(world, { labels: { player: 'P1', tess: 'P2' } })).toEqual([{ id: 'player', label: 'P1' }]);
  });

  it('tags nobody in a race with no lobby labels, as offline', () => {
    expect(racerTags(worldWith(['player']), { labels: {} })).toEqual([]);
  });
});

describe('the waiting line', () => {
  it.each([
    ['on time', { stalledMs: 0, waitingOn: [] }, null],
    ['stalled under half a second', { stalledMs: 499, waitingOn: ['P2'] }, null],
    ['stalled half a second on one player', { stalledMs: 500, waitingOn: ['P2'] }, 'WAITING FOR P2'],
    ['stalled on three players', { stalledMs: 2000, waitingOn: ['P2', 'P3', 'P4'] }, 'WAITING FOR\nP2 P3 P4'],
    ['stalled on two players', { stalledMs: 2000, waitingOn: ['P2', 'P3'] }, 'WAITING FOR P2 P3'],
    ['stalled with no one named', { stalledMs: 900, waitingOn: [] }, null],
    ['stepping again after a stall', { stalledMs: 0, waitingOn: ['P2'] }, null],
  ])('reads %s', (_case, race, line) => {
    expect(waitingLine(race)).toBe(line);
  });
});

describe('where a player tag sits', () => {
  it('sits 2 px above a racer well clear of the HUD', () => {
    expect(tagTop({ top: 100, bottom: 116 })).toBe(91);
  });

  it('stays above while its outline just clears the HUD rows', () => {
    expect(tagTop({ top: HUD_ROWS_BOTTOM + 10, bottom: HUD_ROWS_BOTTOM + 26 })).toBe(HUD_ROWS_BOTTOM + 1);
  });

  it('moves under a racer near the top of the screen, so it never covers a well', () => {
    expect(tagTop({ top: 40, bottom: 56 })).toBe(58);
  });

  it('hides when the racer itself is up among the HUD rows', () => {
    expect(tagTop({ top: 10, bottom: 26 })).toBeNull();
  });
});
