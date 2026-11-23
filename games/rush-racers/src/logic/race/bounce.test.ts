/**
 * Bounce clouds (`B`) in a flight race: a flyer coming down onto one springs up at the medium's
 * `effects.bounceSpeed`, and from any other side one is just a wall. Raced through `createWorld` on
 * small inline courses, where the rivals start in their own lane walled off above the player's.
 * Parsing, `toAscii`, the LevelError for other media and nav closure are `media/bounce.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { flightWorld, RIVAL_LANE_ROWS, ticksOfRacer } from '../media/flight/test-kit.ts';
import { FLIGHT_EFFECTS } from '../media/flight/tuning.ts';
import { eventsIn, hold, IDLE, placeOnTile, step } from '../test-world.ts';
import { TILE } from '../types.ts';

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
