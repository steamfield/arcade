/**
 * Course conformance: what every course must satisfy before it can be raced, checked for every
 * shipped course and for a test-only course that uses a legend. A course parses (legend glyphs
 * included), its medium finds nothing wrong with it, and four racers (the expert bot as the player)
 * finish within 1.6x its par on five seeds on Hard without any of them stalling for 10 s. A stall is
 * free swimming without a new best progress; a stun or trap restarts the count (see `Run.longestStall`).
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { COURSES, levelOf, registerCourse } from '../courses/index.ts';
import type { Course } from '../courses/types.ts';
import { race, table } from '../difficulty/race-bots.ts';
import { effectiveTuning, mediumById } from '../media/index.ts';
import type { Level } from '../types.ts';
import { mediumIdOf } from '../worlds/index.ts';

const SEEDS = [1, 2, 3, 4, 5];
/** The slowest finish any racer may post, as a multiple of the course's par. */
const MAX_FINISH_PAR = 1.6;
/** The longest a racer may go without a new best progress: 10 s. */
const MAX_STALL_TICKS = 600;
/** Five whole races on a full course, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 60_000;

/**
 * A short unlisted course with two legend glyphs: a wreck hull (`w`) that is rock and a sand bar
 * (`s`) that is kelp. Par is the expert bot's mean Hard finish on it over seeds 1-5.
 */
const WRECK_COVE: Course = {
  id: 'test-wreck-cove',
  name: 'Wreck Cove',
  level: {
    name: 'Wreck Cove',
    ascii: `
      ##################################################
      #1.......wwwww.......o..o..........ww...........F#
      #2.......w...w...............>>>>>>ww...........F#
      #3.......w.......?......................sss.....F#
      #4.......ww............ssssss.......ww..sss.....F#
      #...........www.........~~~~~~.......ww.........F#
      ##################################################
    `,
    legend: { w: { cell: 'rock', art: 'wreck' }, s: { cell: 'kelp', art: 'sand' } },
  },
  world: 'reef',
  theme: 'ocean',
  song: 'race',
  listed: false,
  parTicks: 583,
};
registerCourse(WRECK_COVE);

const CONFORMING: Course[] = [...Object.values(COURSES), WRECK_COVE];

/** Tiles whose glyph is in the course's legend but whose cell isn't the legend's base cell. */
function legendMismatches(course: Course, level: Level): string[] {
  const legend = course.level.legend ?? {};
  return level.glyphs.flatMap((row, y) =>
    row.flatMap((glyph, x) => {
      const entry = legend[glyph];
      const cell = level.cells[y]?.[x];
      return entry && entry.cell !== cell ? [`${glyph} at row ${y}, col ${x} is ${cell}, not ${entry.cell}`] : [];
    }),
  );
}

describe.each(CONFORMING)('course conformance for $name ($id)', (course) => {
  it('parses, with every legend glyph read as its base cell', () => {
    const level = levelOf(course);

    expect(level.width).toBeGreaterThan(0);
    expect(legendMismatches(course, level)).toEqual([]);
  });

  it('has nothing its medium objects to', () => {
    const medium = mediumById(mediumIdOf(course));
    const level = levelOf(course);

    expect(medium, `course races in unknown medium '${mediumIdOf(course)}'`).not.toBeNull();
    if (!medium) return;
    const tuning = effectiveTuning({ course: course.id, medium: medium.id, difficulty: 'hard' });
    expect(medium.validateLevel(level, medium.buildNav(level, new Set(), tuning))).toEqual([]);
  });

  it(
    `lets four racers finish within ${MAX_FINISH_PAR}x par on Hard, none stalling for ${MAX_STALL_TICKS / 60} s`,
    () => {
      const runs = SEEDS.map((seed) => race(BOT_PROFILES.expert, 'rudy', seed, 'hard', course.id));
      const limit = MAX_FINISH_PAR * course.parTicks;
      const late = runs.flatMap((run) =>
        Object.entries(run.finish)
          .filter(([, tick]) => tick === null || tick > limit)
          .map(([id, tick]) => `seed ${run.seed} ${id} ${tick ?? 'DNF'}`),
      );
      const stalled = runs.flatMap((run) =>
        Object.entries(run.longestStall)
          .filter(([, ticks]) => ticks > MAX_STALL_TICKS)
          .map(([id, ticks]) => `seed ${run.seed} ${id} ${ticks} ticks`),
      );

      expect(late, `finishes past ${limit} ticks:\n${table(runs)}`).toEqual([]);
      expect(stalled, `stalls:\n${table(runs)}`).toEqual([]);
    },
    RACES_TIMEOUT_MS,
  );
});
