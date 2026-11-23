/**
 * Flight's `afterFlightMove`: the last safe spot (rock, never a puff cloud, under both bottom
 * corners, with rock under every column within 2 tiles) and falling out of the bottom of the sky and
 * coming back there. Raced through `createWorld` on small inline courses, where the rivals start in
 * their own lane walled off above the player's.
 */
import { describe, expect, it } from 'vitest';
import { eventsIn, hold, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { TILE } from '../../types.ts';
import { flightWorld, RIVAL_LANE_ROWS, ticksOfRacer } from './test-kit.ts';
import { FLIGHT_TUNING } from './tuning.ts';

const RIGHT = hold({ x: 1, y: 0 });
const { respawnTicks, respawnInvulnTicks } = FLIGHT_TUNING.extra;

/** A floor with a gap open out of the bottom of the sky from GAP_COLUMN; the player starts at col 1. */
const GAP_LANE = ['...................F', '...................F', '.1.................F', '#####........#######'];
const GAP_COLUMN = 5;
/** Level row of the floor in `GAP_LANE` and the lanes built like it. */
const FLOOR_ROW = RIVAL_LANE_ROWS + 3;

/** Steps `input` until the player falls out; returns the world tick it fell on. */
function untilFallen(race: ReturnType<typeof flightWorld>, input = RIGHT): number {
  for (let tick = 0; tick < 300; tick++) {
    step(race.world, race.log, 1, input);
    if (race.player.status.fallen > 0) return race.world.tick;
  }
  throw new Error(
    `The player never fell out in 300 ticks (ended at y ${Math.round(race.player.body.y)}, x ${Math.round(race.player.body.x)})`,
  );
}

/** Stands the player on the floor at tile column `column` for 10 ticks. */
function standOn(race: ReturnType<typeof flightWorld>, column: number): void {
  placeOnTile(race.player, column, FLOOR_ROW - 1);
  step(race.world, race.log, 10, IDLE);
}

describe('falling out of the sky', () => {
  it('waits out of play with no input or gravity, then comes back on the last safe spot at rest and briefly invulnerable', () => {
    const race = flightWorld(GAP_LANE);
    const { world, log, player } = race;
    untilFallen(race);
    const parkedAt = { ...player.body };
    for (let tick = 1; tick < respawnTicks; tick++) {
      step(world, log, 1, hold({ x: 1, y: -1 }));
      expect(player.body).toEqual(parkedAt);
    }
    step(world, log, 1, RIGHT);
    const back = { x: player.body.x, y: player.body.y };

    expect(eventsIn(log, 'racer.fell', 'racer.respawned')).toEqual([
      { type: 'racer.fell', id: 'player' },
      { type: 'racer.respawned', id: 'player', ...back },
    ]);
    // Rock under every column within 2 tiles: the spot ends at least 2 columns short of the gap.
    expect(back.x + player.body.w).toBeLessThanOrEqual((GAP_COLUMN - 2) * TILE);
    expect([player.body.vx, player.body.vy, player.status.fallen]).toEqual([0, 0, 0]);
    // Statuses tick at the end of the respawn tick, so one tick of it has already run.
    expect(player.status.invulnerable).toBe(respawnInvulnTicks - 1);
  });

  it('lands on rock after coming back with no input, and never falls again', () => {
    const race = flightWorld(GAP_LANE);
    const { world, log, player } = race;
    untilFallen(race);
    step(world, log, respawnTicks + 120, IDLE);

    expect(eventsIn(log, 'racer.fell')).toEqual([{ type: 'racer.fell', id: 'player' }]);
    expect(player.body.y + player.body.h).toBe(FLOOR_ROW * TILE);
    expect(player.body.x + player.body.w).toBeLessThanOrEqual(GAP_COLUMN * TILE);
  });

  it('never saves a spot over rock with a gap within 2 tiles of it', () => {
    // Rock at cols 0-4, a gap at 5-6, a rock island at 7-9, then a wide gap.
    const race = flightWorld([
      '...................F',
      '...................F',
      '.1.................F',
      '#####..###.....#####',
    ]);
    standOn(race, 8);
    placeOnTile(race.player, 12, FLOOR_ROW - 1);
    untilFallen(race, IDLE);
    step(race.world, race.log, respawnTicks);

    expect(race.player.body.x + race.player.body.w).toBeLessThanOrEqual(3 * TILE);
  });

  it('never saves a spot over a puff cloud, since it can be popped for good', () => {
    // Rock at cols 0-4, puff clouds at 5-11, then a gap.
    const race = flightWorld([
      '...................F',
      '...................F',
      '.1.................F',
      '#####CCCCCCC.....###',
    ]);
    standOn(race, 8);
    placeOnTile(race.player, 14, FLOOR_ROW - 1);
    untilFallen(race, IDLE);
    step(race.world, race.log, respawnTicks);

    expect(race.player.body.x + race.player.body.w).toBeLessThanOrEqual(3 * TILE);
  });

  it('never saves a spot in a sideways gust, which would blow an idle flyer into the gap', () => {
    // A gust over cols 2-9 blows right from the top of the sky down to the floor, ending at the gap.
    const gustRow = `..${'>'.repeat(8)}.........F`;
    const gustFloorRow = RIVAL_LANE_ROWS + 19;
    const race = flightWorld([
      ...Array.from({ length: 18 }, () => gustRow),
      `.1${'>'.repeat(8)}.........F`,
      '##########.....#####',
    ]);
    const { world, log, player } = race;
    placeOnTile(player, 6, RIVAL_LANE_ROWS + 2);
    step(world, log, 5, IDLE);
    placeOnTile(player, 12, gustFloorRow);
    untilFallen(race, IDLE);
    step(world, log, respawnTicks + 180, IDLE);

    expect(eventsIn(log, 'racer.fell')).toEqual([{ type: 'racer.fell', id: 'player' }]);
    expect(player.body.y + player.body.h).toBe(gustFloorRow * TILE);
    expect(player.body.x + player.body.w).toBeLessThanOrEqual(10 * TILE);
  });

  it('needs a fresh Up press to flap after coming back, even with Up held all through the wait', () => {
    const race = flightWorld(GAP_LANE);
    const { world, log } = race;
    const fellOn = untilFallen(race);
    step(world, log, respawnTicks + 10, hold({ x: 0, y: -1 }));

    expect(ticksOfRacer(log, 'racer.flapped').filter((tick) => tick > fellOn)).toEqual([]);
    step(world, log, 1, IDLE);
    step(world, log, 1, hold({ x: 0, y: -1 }));
    expect(ticksOfRacer(log, 'racer.flapped').filter((tick) => tick > fellOn)).toEqual([world.tick]);
  });

  it('brings a rival back the same way', () => {
    const { world, log } = flightWorld(GAP_LANE);
    const tess = racerOf(world, 'tess');
    const start = { x: tess.body.x, y: tess.body.y };
    placeOnTile(tess, GAP_COLUMN + 3, FLOOR_ROW);
    // Already through the gap's bottom edge, so no pilot can flap it back in.
    tess.body.y = (FLOOR_ROW + 1) * TILE;
    tess.body.vy = 100;
    for (let tick = 0; tick < 200 && eventsIn(log, 'racer.respawned').length === 0; tick++) step(world, log, 1, IDLE);

    expect(eventsIn(log, 'racer.fell', 'racer.respawned')).toEqual([
      { type: 'racer.fell', id: 'tess' },
      { type: 'racer.respawned', id: 'tess', ...start },
    ]);
  });
});
