/**
 * The section callout: which section a column is in, and the rule that each later section the local
 * racer reaches is called out once, for about 2 s, sliding in and out unless motion is reduced.
 */
import { describe, expect, it } from 'vitest';
import type { CourseSection } from '../../logic/courses/types.ts';
import { RACER_SIZE, type RacerId, TILE, type World } from '../../logic/types.ts';
import { setLocalRacer } from '../local-racer.ts';
import { CALLOUT_TICKS, sectionAt, trackSections } from './section-callout.ts';

const SECTIONS: readonly CourseSection[] = [
  { fromCol: 0, name: 'THE REEF' },
  { fromCol: 10, name: 'JELLY FIELD' },
  { fromCol: 20, name: 'THE DARK CAVE' },
];

/**
 * A stand-in world holding just what the callout reads: the tick and the racers' bodies. Every racer
 * starts in column 0; `move` puts one's body centre in a column.
 */
function fakeRace(): { world: World; move(id: RacerId, col: number, tick: number): World } {
  const racer = (id: RacerId) => ({ id, body: { x: 0, y: 0, w: RACER_SIZE.width, h: RACER_SIZE.height } });
  const state = { tick: 0, racers: [racer('player'), racer('tess')] };
  const world = state as unknown as World;
  return {
    world,
    move(id, col, tick) {
      const body = state.racers.find((each) => each.id === id)?.body;
      if (!body) throw new Error(`No racer '${id}' in the fake race`);
      body.x = col * TILE + TILE / 2 - body.w / 2;
      state.tick = tick;
      return world;
    },
  };
}

describe('sectionAt', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [19, 1],
    [20, 2],
    [500, 2],
  ])('puts column %i in section %i', (col, index) => {
    expect(sectionAt(SECTIONS, col)).toBe(index);
  });

  it('is -1 before the first section and for a course with none', () => {
    expect(sectionAt([{ fromCol: 5, name: 'LATE START' }], 4)).toBe(-1);
    expect(sectionAt([], 30)).toBe(-1);
  });
});

describe('the section callout', () => {
  it('calls out a section from the tick the racer enters it, for about 2 s', () => {
    const race = fakeRace();
    const tracker = trackSections(SECTIONS, true);
    tracker.step(race.move('player', 9, 300));
    tracker.step(race.move('player', 10, 301));

    expect(tracker.frame(300)).toEqual({ text: '', dx: 0 });
    expect(tracker.frame(301)).toEqual({ text: 'JELLY FIELD', dx: 0 });
    expect(tracker.frame(301 + CALLOUT_TICKS - 1).text).toBe('JELLY FIELD');
    expect(tracker.frame(301 + CALLOUT_TICKS).text).toBe('');
  });

  it('never calls out the section the race starts in', () => {
    const race = fakeRace();
    const tracker = trackSections(SECTIONS, true);
    for (const [col, tick] of [
      [0, 0],
      [5, 60],
      [9, 120],
    ] as const)
      tracker.step(race.move('player', col, tick));

    expect([0, 60, 120].map((tick) => tracker.frame(tick).text)).toEqual(['', '', '']);
  });

  it('calls each later section out once, however often the racer crosses back over its boundary', () => {
    const race = fakeRace();
    const tracker = trackSections(SECTIONS, true);
    // Each stop is far enough from the last for any earlier callout to have gone.
    const shownAt = (col: number, tick: number) => {
      tracker.step(race.move('player', col, tick));
      return tracker.frame(tick).text;
    };
    const route = [
      [10, 100],
      [9, 400],
      [10, 500],
      [20, 700],
      [19, 1000],
      [21, 1100],
    ] as const;

    expect(route.map(([col, tick]) => shownAt(col, tick))).toEqual(['JELLY FIELD', '', '', 'THE DARK CAVE', '', '']);
  });

  it('replaces a callout still showing when the racer reaches the next section', () => {
    const race = fakeRace();
    const tracker = trackSections(SECTIONS, true);
    tracker.step(race.move('player', 10, 100));
    tracker.step(race.move('player', 20, 130));

    expect(tracker.frame(130).text).toBe('THE DARK CAVE');
  });

  it('follows the local racer, not slot player', () => {
    const race = fakeRace();
    setLocalRacer(race.world, 'tess');
    const tracker = trackSections(SECTIONS, true);
    tracker.step(race.move('player', 15, 100));
    expect(tracker.frame(100).text).toBe('');

    tracker.step(race.move('tess', 12, 101));
    expect(tracker.frame(101).text).toBe('JELLY FIELD');
  });

  it('shows nothing on a course without sections', () => {
    const race = fakeRace();
    const tracker = trackSections([], false);
    tracker.step(race.move('player', 300, 100));

    expect(tracker.frame(100)).toEqual({ text: '', dx: 0 });
  });

  it('slides in from the left over 12 ticks, holds, and slides back out over the last 12', () => {
    const race = fakeRace();
    const tracker = trackSections(SECTIONS, false);
    tracker.step(race.move('player', 10, 0));
    const offsets = [0, 6, 12, 60, 108, 114, 119].map((tick) => tracker.frame(tick).dx);

    expect(offsets).toEqual([-12, -6, 0, 0, 0, -6, -11]);
  });

  it('appears and goes in place under reduced motion', () => {
    const race = fakeRace();
    const tracker = trackSections(SECTIONS, true);
    tracker.step(race.move('player', 10, 0));

    expect([0, 6, 60, 114, 119].map((tick) => tracker.frame(tick).dx)).toEqual([0, 0, 0, 0, 0]);
  });
});
