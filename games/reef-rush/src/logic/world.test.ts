import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { OCEAN_LEVEL } from './level/levels.ts';
import { LevelError, parseLevel } from './level/parse.ts';
import { COUNTDOWN_TICKS, DNF_GRACE_TICKS, RACE_LIMIT_TICKS } from './race/standings.ts';
import type { TickInput } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, burst: false };

/** A race on the ocean course with an idle player, stepped up to `ticks` times or until it ends. */
function idleRace(seed: number, ticks: number) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(parseLevel(OCEAN_LEVEL), log, { seed });
  for (let i = 0; i < ticks && world.race.phase !== 'finished'; i++) {
    log.tick = world.tick;
    stepWorld(world, IDLE, TICK_DT);
  }
  return { world, log };
}

describe('a full race', () => {
  it('ends by DNF for an idle player once all three rivals have finished', () => {
    const { world, log } = idleRace(1, COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 1);
    const rivals = world.racers.filter((r) => r.id !== 'player');

    expect(world.race.phase).toBe('finished');
    expect(rivals.every((r) => r.finished !== null)).toBe(true);
    expect(world.race.raceTick).toBe((world.race.rivalsDoneAt ?? Number.NaN) + DNF_GRACE_TICKS);
    expect(world.race.result).toMatchObject({ playerPlace: 4, playerTicks: null });
    expect(world.race.result?.standings.at(-1)).toBe('player');
    expect(log.all().filter((e) => e.type === 'racer.finished')).toHaveLength(3);
    expect(log.all().filter((e) => e.type === 'race.finished')).toMatchObject([
      { type: 'race.finished', ...world.race.result },
    ]);
  });
});

describe('determinism', () => {
  it('repeats the same event stream for the same seed', () => {
    expect(idleRace(3, 1200).log.all()).toEqual(idleRace(3, 1200).log.all());
  });

  it('plays out differently for a different seed', () => {
    expect(idleRace(3, 1200).log.all()).not.toEqual(idleRace(4, 1200).log.all());
  });
});

describe('level checks', () => {
  it('refuses a level whose player start is walled in by coral, naming the start tile', () => {
    const level = parseLevel({
      name: 'sealed',
      ascii: `
        ########
        #CC...F#
        #1C...F#
        #CC...F#
        #2.3.4F#
        ########
      `,
    });
    const create = () => createWorld(level, new EventLog<GameEvent>(), { seed: 1 });

    expect(create).toThrow(LevelError);
    expect(create).toThrow(expect.objectContaining({ row: 2, col: 1 }));
  });
});
