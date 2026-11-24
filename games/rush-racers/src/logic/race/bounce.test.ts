/**
 * Bounce cells (`B`): in a flight race a bounce cloud, where a flyer coming down onto one springs up
 * at the medium's `effects.bounceSpeed` and from any other side one is just a wall; in a run race a
 * spring mushroom, which launches a runner higher than any jump, and higher still with Up held as it
 * lands. Raced through `createWorld` on small inline courses; in flight the rivals start in their own
 * lane walled off above the player's, and in run they start to the right and race away from it.
 * Parsing, `toAscii`, the LevelError for other media and nav closure are `media/bounce.test.ts`.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { applyHit } from '../hazards/hits.ts';
import { flightWorld, RIVAL_LANE_ROWS, ticksOfRacer } from '../media/flight/test-kit.ts';
import { FLIGHT_EFFECTS } from '../media/flight/tuning.ts';
import { jumpPeak } from '../media/run/physics.ts';
import { RUN_TUNING } from '../media/run/tuning.ts';
import { centreOf } from '../racers.ts';
import { courseFromLevel, eventsIn, hold, IDLE, placeOnTile, racerOf, step } from '../test-world.ts';
import { TILE, type TickInput } from '../types.ts';
import { createWorld } from '../world.ts';

const BOUNCE_SPEED = FLIGHT_EFFECTS.bounceSpeed ?? Number.NaN;
const BOUNCED: GameEvent = { type: 'racer.bounced', id: 'player' };

/** Open sky over a floor with a bounce cloud at cols 4-6; the player starts at col 1. */
const BOUNCE_FLOOR = [
  '...........F',
  '...........F',
  '...........F',
  '...........F',
  '...........F',
  '.1.........F',
  '####BBB#####',
];
/** Level row of the floor in `BOUNCE_FLOOR`. */
const FLOOR_ROW = RIVAL_LANE_ROWS + 6;

describe('coming down onto a bounce cloud', () => {
  it('leaves that tick at the medium bounce speed, upward, and says so', () => {
    const race = flightWorld(BOUNCE_FLOOR);
    const { world, log, player } = race;
    placeOnTile(player, 5, FLOOR_ROW - 2);
    const vyOnBounce: number[] = [];
    while (vyOnBounce.length === 0 && world.tick < 60) {
      step(world, log, 1, IDLE);
      if (eventsIn(log, 'racer.bounced').length > 0) vyOnBounce.push(player.body.vy);
    }

    expect(BOUNCE_SPEED).toBe(300);
    expect(vyOnBounce).toEqual([-BOUNCE_SPEED]);
    expect(eventsIn(log, 'racer.bounced')).toEqual([BOUNCED]);
    expect(player.body.y + player.body.h).toBe(FLOOR_ROW * TILE);
  });

  it('springs when only one bottom corner is over the cloud', () => {
    const race = flightWorld(BOUNCE_FLOOR);
    const { world, log, player } = race;
    // Body spans cols 3 (rock) and 4 (bounce cloud).
    placeOnTile(player, 4, FLOOR_ROW - 2);
    player.body.x = 4 * TILE - player.body.w / 2;
    step(world, log, 30, IDLE);

    expect(eventsIn(log, 'racer.bounced')).toEqual([BOUNCED]);
  });

  it('bounces again each time it comes back down', () => {
    const race = flightWorld(BOUNCE_FLOOR);
    const { world, log, player } = race;
    placeOnTile(player, 5, FLOOR_ROW - 2);
    step(world, log, 300, IDLE);
    const bounces = ticksOfRacer(log, 'racer.bounced');
    const gaps = bounces.slice(1).map((tick, index) => tick - (bounces[index] ?? 0));

    expect(bounces.length).toBeGreaterThanOrEqual(3);
    // Each spring is a full rise and fall, never a bounce on consecutive ticks.
    expect(Math.min(...gaps)).toBeGreaterThan(30);
  });
});

describe('meeting a bounce cloud any other way', () => {
  it('just blocks a flyer flying into its side', () => {
    // A wall of bounce cloud at col 6 from the rock floor up to one row short of the top.
    const race = flightWorld([
      '...........F',
      '......B....F',
      '......B....F',
      '......B....F',
      '.1....B....F',
      '###########F',
    ]);
    const { world, log, player } = race;
    placeOnTile(player, 4, RIVAL_LANE_ROWS + 2);
    step(world, log, 90, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'racer.bounced')).toEqual([]);
    expect(player.body.x + player.body.w).toBe(6 * TILE);
    expect(player.body.y + player.body.h).toBe((RIVAL_LANE_ROWS + 5) * TILE);
  });

  it('just blocks a flyer rising into it from below', () => {
    const race = flightWorld(['...BBB.....F', '...........F', '.1.........F', '###########F']);
    const { world, log, player } = race;
    placeOnTile(player, 4, RIVAL_LANE_ROWS + 1);
    player.body.vy = -BOUNCE_SPEED;
    step(world, log, 1, IDLE);
    const headAfterBump = player.body.y;
    step(world, log, 60, IDLE);

    expect(headAfterBump).toBe((RIVAL_LANE_ROWS + 1) * TILE);
    expect(eventsIn(log, 'racer.bounced')).toEqual([]);
    expect(player.body.y + player.body.h).toBe((RIVAL_LANE_ROWS + 3) * TILE);
  });
});

describe('a trapped racer', () => {
  it('rests on a bounce cloud without springing until the trap ends, then springs once', () => {
    const race = flightWorld(BOUNCE_FLOOR);
    const { world, log, player } = race;
    placeOnTile(player, 5, FLOOR_ROW - 1);
    const rival = world.racers.find((racer) => racer.id !== 'player');
    applyHit(world, player, 'bubble', rival?.id ?? 'player', centreOf(player));
    const trappedFor = player.status.trapped;
    for (let tick = 0; tick < 300 && player.status.trapped > 0; tick++) step(world, log, 1, IDLE);
    const bouncedWhileTrapped = eventsIn(log, 'racer.bounced');
    const bottomAtRelease = player.body.y + player.body.h;
    step(world, log, 30, IDLE);

    expect(trappedFor).toBeGreaterThan(0);
    expect(bottomAtRelease).toBe(FLOOR_ROW * TILE);
    expect(bouncedWhileTrapped).toEqual([]);
    expect(eventsIn(log, 'racer.bounced')).toEqual([BOUNCED]);
  });
});

describe('a racer that fell out of the sky', () => {
  it('never bounces while parked or after coming back, with bounce cloud just past the gap', () => {
    const race = flightWorld([
      '...................F',
      '...................F',
      '.1.................F',
      '#####.......BB#####F',
    ]);
    const { world, log, player } = race;
    for (let tick = 0; tick < 200 && player.status.fallen === 0; tick++) step(world, log, 1, hold({ x: 1, y: 0 }));
    step(world, log, 180, IDLE);

    expect(eventsIn(log, 'racer.fell', 'racer.respawned', 'racer.bounced').map((event) => event.type)).toEqual([
      'racer.fell',
      'racer.respawned',
    ]);
  });
});

/** Nine rows of air over a floor with a spring mushroom at col 2; the runners start right of it. */
const MUSHROOM_FLOOR = [
  '####################',
  ...Array.from({ length: 9 }, () => '#..................#'),
  '#.....1.2.3.4.....F#',
  '##B#################',
].join('\n');
/** Level row of the floor in `MUSHROOM_FLOOR`. */
const MUSHROOM_ROW = 11;
const UP: TickInput = hold({ x: 0, y: -1 });

/**
 * Drops the player onto the mushroom from two tiles up with `input` held throughout, and returns
 * how high its feet rise above the mushroom's top after the spring (px), with the springs and jumps
 * up to the top of the rise.
 */
function riseOffMushroom(input: TickInput | ((bottom: number) => TickInput)) {
  const log = new EventLog<GameEvent>(10_000);
  const world = createWorld(courseFromLevel(MUSHROOM_FLOOR, 'run'), log, { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  const player = racerOf(world, 'player');
  placeOnTile(player, 2, MUSHROOM_ROW - 3);
  const top = MUSHROOM_ROW * TILE;
  let highest = top;
  let sprung = false;
  for (let tick = 0; tick < 120 && !(sprung && player.body.vy >= 0); tick++) {
    step(world, log, 1, typeof input === 'function' ? input(player.body.y + player.body.h) : input);
    sprung = eventsIn(log, 'racer.bounced').length > 0;
    if (sprung) highest = Math.min(highest, player.body.y + player.body.h);
  }
  return { rise: top - highest, bounces: eventsIn(log, 'racer.bounced'), jumps: eventsIn(log, 'racer.jumped') };
}

describe('a spring mushroom in a run race', () => {
  const fullJump = jumpPeak(RUN_TUNING, 60, TICK_DT);

  it('launches a runner landing on it about 5 tiles up with nothing held, past a full jump', () => {
    const { rise, bounces, jumps } = riseOffMushroom(IDLE);

    expect(bounces).toEqual([BOUNCED]);
    expect(jumps).toEqual([]);
    expect(rise / TILE).toBeGreaterThan(4.5);
    expect(rise / TILE).toBeLessThan(5.5);
    expect(rise).toBeGreaterThan(fullJump * 1.4);
  });

  it('launches about 6 tiles with Up held as it lands, and the press fires no lower jump', () => {
    const free = riseOffMushroom(IDLE);
    const held = riseOffMushroom(UP);

    expect(held.bounces).toEqual([BOUNCED]);
    expect(held.jumps).toEqual([]);
    expect(held.rise / TILE).toBeGreaterThan(5.5);
    expect(held.rise / TILE).toBeLessThan(6.5);
    expect(held.rise).toBeGreaterThan(free.rise + TILE / 2);
  });

  it('takes a fresh press of Up just before it lands as held, never as a jump', () => {
    const top = MUSHROOM_ROW * TILE;
    const pressed = riseOffMushroom((bottom) => (bottom > top - TILE / 2 ? UP : IDLE));

    expect(pressed.jumps).toEqual([]);
    expect(pressed.rise).toBe(riseOffMushroom(UP).rise);
  });
});
