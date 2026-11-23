/**
 * A race on a real course (Sunlit Shallows unless a course id is given) where the player is a scripted child: a bot steers, but for a stretch
 * mid-race the child stops swimming altogether, then holds right (into whatever wall is there).
 * Reports how fast the rivals swam while the child sat still. Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { length } from '../num.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import type { CharacterId, Difficulty, RacerId, TickInput } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };
const HOLD_RIGHT: TickInput = { move: { x: 1, y: 0 }, kick: false, use: false, cycle: 0 };

/** When the child stops (race ticks after the GO), for how long, and how long it then holds right. */
export const SCRIPT = { idleFrom: 1500, idleTicks: 600, holdTicks: 300 } as const;

/** What a scripted race reports. */
export interface ScriptedRun {
  playerPlace: number;
  finish: Record<RacerId, number | null>;
  /** Each rival's mean speed in px/s while the child sat idle, over the ticks it was still racing. */
  rivalSpeedWhileIdle: Record<'tess' | 'squib' | 'bo', number>;
}

/**
 * Races the toddler bot as `character` on the course with `courseId`, with the idle-then-hold-right
 * interruption of `SCRIPT`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function scriptedRace(
  character: CharacterId,
  seed: number,
  difficulty: Difficulty,
  courseId: string = DEFAULT_COURSE.id,
): ScriptedRun {
  const world = createWorld(courseOf({ course: courseId }), new EventLog<GameEvent>(100_000), {
    seed,
    difficulty,
    playerBot: BOT_PROFILES.toddler,
    endsWhen: 'everyone',
    character,
  });
  const player = world.racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('createWorld made no player racer');
  const botMemory = player.ai;
  const rivals = world.racers.filter((racer) => racer.id !== 'player');
  const speeds = new Map(rivals.map((racer) => [racer.id, { sum: 0, ticks: 0 }]));
  const end = SCRIPT.idleFrom + SCRIPT.idleTicks;

  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) {
    const t = world.race.phase === 'racing' ? world.race.raceTick : -1;
    const scripted = t >= SCRIPT.idleFrom && t < end + SCRIPT.holdTicks;
    // A racer without AI memory takes the input we pass, so the script drives the child for its window.
    player.ai = scripted ? null : botMemory;
    stepWorld(world, t < end ? IDLE : HOLD_RIGHT, TICK_DT);
    if (t >= SCRIPT.idleFrom && t < end) {
      for (const racer of rivals) {
        const sample = speeds.get(racer.id);
        if (sample && !racer.finished) {
          sample.sum += length(racer.body.vx, racer.body.vy);
          sample.ticks++;
        }
      }
    }
  }
  const mean = (id: 'tess' | 'squib' | 'bo') => {
    const sample = speeds.get(id);
    return sample && sample.ticks > 0 ? sample.sum / sample.ticks : 0;
  };
  return {
    playerPlace: world.race.result?.playerPlace ?? 4,
    finish: Object.fromEntries(world.racers.map((r) => [r.id, r.finished?.tick ?? null])) as ScriptedRun['finish'],
    rivalSpeedWhileIdle: { tess: mean('tess'), squib: mean('squib'), bo: mean('bo') },
  };
}
