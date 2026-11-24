import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PROGRESS_BACKSTOP_TICKS } from '../ai/rival.ts';
import type { GameEvent } from '../events.ts';
import { LevelError, parseLevel } from '../level/parse.ts';
import { DRIFT_MEDIUM } from '../media/drift/index.ts';
import { centreOf } from '../racers.ts';
import { courseFromLevel, eventsIn, hold, placeAt, placeOnTile, racerOf, step, tileCentre } from '../test-world.ts';
import { type LevelDef, TILE, type WormholeDef } from '../types.ts';
import { createWorld } from '../world.ts';

const ROOM = `
  ########################
  #1....................F#
  #2....................F#
  #3....................F#
  #4....................F#
  #.....................F#
  ########################
`;
const PAIR = { a: [6, 2], b: [16, 2], oneWay: false } as const satisfies WormholeDef;

function belt(wormholes: readonly WormholeDef[], ascii = ROOM): LevelDef {
  return { name: 'wormhole belt', ascii, wormholes };
}

function raceOn(wormholes: readonly WormholeDef[], ascii = ROOM) {
  const log = new EventLog<GameEvent>(1000);
  const world = createWorld(courseFromLevel(belt(wormholes, ascii), 'drift'), log, { seed: 1, endsWhen: 'everyone' });
  world.race.phase = 'racing';
  return { world, log, player: racerOf(world, 'player') };
}

function playerWarps(log: EventLog<GameEvent>) {
  return log.all().filter((event) => event.type === 'wormhole.warped' && event.racer === 'player');
}

describe('parsing wormholes', () => {
  it.each([
    ['off the map', [{ ...PAIR, a: [-1, 2] }], 2, -1],
    ['on rock', [{ ...PAIR, b: [16, 0] }], 0, 16],
    ['under four tiles from its pair', [{ ...PAIR, b: [9, 2] }], 2, 9],
    ['under three tiles from another pair', [PAIR, { a: [7, 3], b: [19, 4], oneWay: true }], 3, 7],
  ] satisfies [string, WormholeDef[], number, number][])('locates a mouth %s', (_name, defs, row, col) => {
    const parse = () => parseLevel(belt(defs));
    expect(parse).toThrow(LevelError);
    expect(parse).toThrow(expect.objectContaining({ row, col }));
  });
});

describe('drifting through wormholes', () => {
  it('warps on entering the mouth tile and keeps the velocity the racer would have had that tick', () => {
    const { world, log, player } = raceOn([PAIR]);
    const control = raceOn([]);
    for (const racer of [player, control.player]) {
      placeAt(racer, { x: PAIR.a[0] * TILE - 1, y: tileCentre(...PAIR.a).y });
      racer.body.vx = 110;
      racer.body.vy = 36;
    }

    step(world, log, 1, hold({ x: 1, y: 0 }));
    step(control.world, control.log, 1, hold({ x: 1, y: 0 }));

    expect(centreOf(player)).toEqual(tileCentre(...PAIR.b));
    expect([player.body.vx, player.body.vy]).toEqual([control.player.body.vx, control.player.body.vy]);
    expect(eventsIn(log, 'wormhole.warped')).toEqual([
      { type: 'wormhole.warped', racer: 'player', hole: 0, from: 'a' },
    ]);
  });

  it.each([
    [false, 'b', PAIR.a],
    [true, 'a', PAIR.b],
  ] as const)('allows travel with oneWay %s from mouth %s', (oneWay, from, exit) => {
    const { world, log, player } = raceOn([{ ...PAIR, oneWay }]);
    placeOnTile(player, PAIR[from][0], PAIR[from][1]);
    step(world, log);

    expect(centreOf(player)).toEqual(tileCentre(exit[0], exit[1]));
    expect(eventsIn(log, 'wormhole.warped')).toEqual([{ type: 'wormhole.warped', racer: 'player', hole: 0, from }]);
  });

  it('leaves a racer drifting through the exit of a one-way hole in local space', () => {
    const { world, log, player } = raceOn([{ ...PAIR, oneWay: true }]);
    placeOnTile(player, ...PAIR.b);
    step(world, log);

    expect(centreOf(player)).toEqual(tileCentre(...PAIR.b));
    expect(eventsIn(log, 'wormhole.warped')).toEqual([]);
  });

  it('keeps a slow racer at the exit for 45 ticks before it can warp back', () => {
    const { world, log, player } = raceOn([PAIR]);
    placeOnTile(player, ...PAIR.a);
    step(world, log);
    step(world, log, 44);

    expect(centreOf(player)).toEqual(tileCentre(...PAIR.b));
    expect(playerWarps(log)).toHaveLength(1);

    step(world, log);
    expect(centreOf(player)).toEqual(tileCentre(...PAIR.a));
    expect(playerWarps(log)).toHaveLength(2);
  });

  it('finishes a racer crossing the line through a mouth', () => {
    const { world, log, player } = raceOn([{ a: [22, 2], b: [6, 2], oneWay: true }]);
    placeAt(player, { x: world.level.finishX * TILE - 1, y: tileCentre(22, 2).y });
    player.body.vx = 110;
    step(world, log);

    expect(player.finished).not.toBeNull();
    expect(playerWarps(log)).toEqual([]);
  });

  it('warps an unprotected stunned racer', () => {
    const { world, log, player } = raceOn([PAIR]);
    placeOnTile(player, ...PAIR.a);
    player.status.stunned = 30;
    step(world, log);

    expect(centreOf(player)).toEqual(tileCentre(...PAIR.b));
    expect(player.status.stunned).toBe(29);
  });

  it.each(['invulnerable', 'fallen', 'trapped', 'finished'] as const)('skips a %s racer', (status) => {
    const { world, log, player } = raceOn([PAIR]);
    placeOnTile(player, ...PAIR.a);
    if (status === 'finished') player.finished = { tick: 0, place: 1, overshoot: 0 };
    else player.status[status] = 30;
    step(world, log);

    expect(eventsIn(log, 'wormhole.warped')).toEqual([]);
  });
});

/** The open detour is along the bottom. The loop-back entrance sits directly ahead of Tess. */
const DETOUR = `
  ########################
  #1.........#..........F#
  #2.........#..........F#
  #3.........#..........F#
  #4.........#..........F#
  #.....................F#
  ########################
`;

const CHAMBERS = `
  ##################################
  #1.........#..........#.........F#
  #2.........#..........#.........F#
  #3.........#..........#.........F#
  #4.........#..........#.........F#
  ##################################
`;

describe("drift rivals' wormhole routes", () => {
  it('has finite ways from both sides of a two-way pair and sends a rival through the shortcut', () => {
    const { world, log } = raceOn([PAIR], DETOUR);
    for (const [x, y] of [PAIR.a, PAIR.b]) {
      expect(Number.isFinite(DRIFT_MEDIUM.distanceAt(world, { x, y }))).toBe(true);
    }
    for (let tick = 0; tick < 500 && !racerOf(world, 'tess').finished; tick++) step(world, log);

    expect(eventsIn(log, 'wormhole.warped')).toContainEqual({
      type: 'wormhole.warped',
      racer: 'tess',
      hole: 0,
      from: 'a',
    });
    expect(racerOf(world, 'tess').finished).not.toBeNull();
  });

  it('brakes for a second entrance until its first warp cools down', () => {
    const { world, log } = raceOn(
      [
        { a: [7, 2], b: [16, 2], oneWay: true },
        { a: [19, 2], b: [28, 2], oneWay: true },
      ],
      CHAMBERS,
    );
    const rival = racerOf(world, 'tess');
    placeAt(rival, { x: 7 * TILE - 1, y: tileCentre(7, 2).y });
    rival.body.vx = 110;
    step(world, log);
    expect(centreOf(rival)).toEqual(tileCentre(16, 2));

    step(world, log, 44);
    expect(centreOf(rival).x).toBeLessThan(19 * TILE);
    step(world, log, 80);
    expect(rival.finished).not.toBeNull();
    expect(log.all().filter((event) => event.type === 'wormhole.warped' && event.racer === 'tess')).toMatchObject([
      { hole: 0, from: 'a' },
      { hole: 1, from: 'a' },
    ]);
  });

  it('uses the sideways progress recovery when stalled near an entrance', () => {
    const { world, log } = raceOn([PAIR]);
    const rival = racerOf(world, 'tess');
    placeOnTile(rival, 4, 2);
    if (!rival.ai) throw new Error('Tess needs an AI pilot');
    rival.ai.bestProgress = 0;
    rival.ai.sinceBest = PROGRESS_BACKSTOP_TICKS - 1;

    step(world, log);
    expect(Math.abs(rival.body.vy)).toBeGreaterThan(Math.abs(rival.body.vx));
  });

  it('flies around a loop-back entrance on the way to the finish', () => {
    const { world, log } = raceOn([{ a: [9, 2], b: [3, 2], oneWay: true }]);
    const rival = racerOf(world, 'tess');
    for (let tick = 0; tick < 500 && !rival.finished; tick++) step(world, log);

    expect(eventsIn(log, 'wormhole.warped')).not.toContainEqual(expect.objectContaining({ racer: 'tess' }));
    expect(rival.finished).not.toBeNull();
  });
});
