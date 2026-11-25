/**
 * Capture stages: `?stage=<name>` puts the world into a state worth looking at, so a screenshot or
 * `arcade see` run doesn't have to play up to it. A stage only writes plain world state. It is
 * honoured only with `?debug=1` or in test mode, and the runtime refuses to save a staged world.
 *
 * The names, each derived from the course so it follows a retuned layout: `mid-course` puts the
 * racers halfway from start to finish; `near-finish` 30 m before the finish line; `before-pit` 25 m
 * before the first full-width pit; `before-log` 20 m before the first log. Every stage skips the
 * countdown.
 *
 * Also parses the `?character=` and `?course=` launch params.
 */
import type { Logger } from '@arcade/core';
import { groundY } from '../logic/course.ts';
import { RACE } from '../logic/tuning.ts';
import { CHARACTER_IDS, type CharacterId, type Course, type World } from '../logic/types.ts';

/** Every stage name `applyStage` knows. */
export const STAGES = ['mid-course', 'near-finish', 'before-pit', 'before-log'] as const;

/** One of the names in {@link STAGES}. */
export type StageName = (typeof STAGES)[number];

/** The launch flags that decide whether a stage may be used. */
export interface StageGate {
  debug: boolean;
  testMode: boolean;
}

/**
 * The `?stage=` the page was opened with: null unless it names a known stage and the launch is a
 * debug or test-mode one, so a stray or shared link cannot stage a real game. An unknown name is
 * logged as a warning that lists the valid ones.
 */
export function stageFor(gate: StageGate, search: string, log: Logger): StageName | null {
  if (!gate.debug && !gate.testMode) return null;
  const name = new URLSearchParams(search).get('stage');
  const stage = STAGES.find((candidate) => candidate === name);
  if (name !== null && !stage) log.warn(`unknown ?stage=${name}; valid stages: ${STAGES.join(', ')}`);
  return stage ?? null;
}

/** The character override from `?character=`, or null to use the save. Unknown ids log a warning. */
export function characterFor(search: string, log: Logger): CharacterId | null {
  const name = new URLSearchParams(search).get('character');
  if (name === null) return null;
  const character = CHARACTER_IDS.find((id) => id === name);
  if (!character) log.warn(`unknown ?character=${name}; valid characters: ${CHARACTER_IDS.join(', ')}`);
  return character ?? null;
}

/** The course named by `?course=`, or the first in the list. Unknown ids log a warning. */
export function courseFor(search: string, courses: readonly Course[], log: Logger): Course {
  const first = courses[0];
  if (!first) throw new Error('at least one course is required');
  const name = new URLSearchParams(search).get('course');
  if (name === null) return first;
  const course = courses.find((candidate) => candidate.id === name);
  if (!course) log.warn(`unknown ?course=${name}; valid courses: ${courses.map(({ id }) => id).join(', ')}`);
  return course ?? first;
}

/** Where `stage` puts the player along `s` on `course`. */
export function stageS(course: Course, stage: StageName): number {
  switch (stage) {
    case 'mid-course':
      return (course.startS + course.finishS) / 2;
    case 'near-finish':
      return course.finishS - 30;
    case 'before-pit': {
      const pit = course.features.find(
        (f) => f.kind === 'pit' && f.d0 <= -course.halfWidth && f.d1 >= course.halfWidth,
      );
      return pit && pit.kind === 'pit' ? pit.s0 - 25 : course.startS;
    }
    case 'before-log': {
      const log = course.features.find((f) => f.kind === 'log');
      return log && log.kind === 'log' ? log.s - 20 : course.startS;
    }
  }
}

/**
 * Writes the stage's state into `world`: the race already running, every racer at the stage's spot
 * in its own grid lane. Call it once, right after the world is built.
 */
export function applyStage(world: World, stage: StageName): void {
  world.phase = 'racing';
  world.tick = RACE.countdownTicks;
  world.raceTicks = 1;
  const s = stageS(world.course, stage);
  for (const racer of world.racers) {
    racer.s = s;
    racer.safeS = s;
    racer.safeD = racer.d;
    racer.y = groundY(world.course, s);
  }
}
