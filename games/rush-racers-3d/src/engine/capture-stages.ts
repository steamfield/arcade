/**
 * Capture stages: `?stage=<name>` puts the world into a state worth looking at, so a screenshot or
 * `arcade see` run doesn't have to play up to it. A stage only writes plain world state. It is
 * honoured only with `?debug=1` or in test mode, and the runtime refuses to save a staged world.
 *
 * The names, each derived from the course so it follows a retuned layout: `mid-course` puts the
 * player halfway from start to finish; `near-finish` 30 m before the finish line; `before-pit` 25 m
 * before the first full-width pit; `before-log` 20 m before the first log. Every stage skips the
 * countdown.
 */
import type { Logger } from '@arcade/core';
import { groundY } from '../logic/course.ts';
import type { Course, World } from '../logic/types.ts';
import { playerOf } from '../logic/world.ts';

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

/** Writes the stage's state into `world`: the race already running, the player at the stage's spot. Call it once, right after the world is built. */
export function applyStage(world: World, stage: StageName): void {
  const player = playerOf(world);
  world.phase = 'racing';
  world.tick = 180;
  world.raceTicks = 1;
  player.s = stageS(world.course, stage);
  player.safeS = player.s;
  player.y = groundY(world.course, player.s);
}
