/**
 * Run's `afterRunMove`: standing on floors, ledges and crates, head bumps, and falling out through a
 * pit and coming back. Raced through `createWorld` on small inline courses, where the rivals start in
 * their own lane walled off above the player's.
 */
import { describe, expect, it } from 'vitest';
import { breakCoral } from '../../race/coral.ts';
import { eventsIn, hold, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { type MoveContacts, TILE, type Vec } from '../../types.ts';
import { laneWorld } from '../test-kit.ts';
import { runMotion } from './data.ts';
import { afterRunMove } from './respawn.ts';
import { RUN_TUNING } from './tuning.ts';

/** A racing run world on `playerRows`; the rivals start in their own lane walled off above. */
const runWorld = (playerRows: readonly string[]) => laneWorld('run', playerRows);

const RIGHT: Vec = { x: 1, y: 0 };
const { respawnTicks, respawnInvulnTicks } = RUN_TUNING.extra;
/** Ticks for a racer at its start to settle onto what's under it. */
const SETTLE = 10;

/** A lane with a pit 2 tiles wide (a jump crosses it under the low ceiling, holding right alone falls in) from PIT_COLUMN; `beforePit` is the floor tile just left of it. */
function pitLane(beforePit: '#' | '?') {
  return ['...............F', '...............F', '.1.............F', `####${beforePit}..#########`];
}
/** Open rows a lane adds above its start, so a jump has room under the rivals' floor. */
const HEADROOM = ['...............F', '...............F', '...............F'];
/** Tile column where the pit starts. */
const PIT_COLUMN = 5;
/** Tiles of run-up a respawn leaves before the pit, ground allowing. */
const RUN_UP_TILES = 2;

/** Holds right until the player falls out; returns the tick it fell on. */
function runIntoPit(world: ReturnType<typeof runWorld>) {
  for (let tick = 0; tick < 300; tick++) {
    step(world.world, world.log, 1, hold(RIGHT));
    if (world.player.status.fallen > 0) return world.world.tick;
  }
  throw new Error('The player never fell into the pit in 300 ticks');
}

describe('grounded', () => {
  it.each([
    ['a floor', '.....'],
    ['a ledge', '.===.'],
    ['a solid crate', '..?..'],
  ])('stands on %s', (_surface, platform) => {
    const { world, log, player } = runWorld(['....F', '..1.F', platform, '....F', '#####']);
    step(world, log, 30);

    expect(runMotion(player.motion).grounded).toBe(true);
    // Under the rivals' 3 rows, the platform is row 5 and the floor row 7.
    const surfaceRow = platform === '.....' ? 7 : 5;
    expect(player.body.y + player.body.h).toBe(surfaceRow * TILE);
  });

  it('stops being grounded after walking off an edge', () => {
    const { world, log, player } = runWorld(['.........F', '.1.......F', '###......F', '###......F', '##########']);
    step(world, log, SETTLE);
    const before = runMotion(player.motion).grounded;
    // About 22 ticks to clear the edge, and 17 more to fall the 2 tiles to the floor.
    step(world, log, 30, hold(RIGHT));

    expect([before, runMotion(player.motion).grounded]).toEqual([true, false]);
  });

  it('loses its rising speed on a head bump', () => {
    const { world, log, player } = runWorld(['....F', '.1..F', '#####']);
    const bump = (ceiling: boolean) => {
      player.body.vy = -200;
      const contacts: MoveContacts = {
        floor: false,
        ceiling,
        wallLeft: false,
        wallRight: false,
        ceilingTiles: [],
        lost: { x: 0, y: 0 },
      };
      afterRunMove(world, player, contacts, log);
      return player.body.vy;
    };

    expect([bump(false), bump(true)]).toEqual([-200, 0]);
  });
});

describe('falling into a pit', () => {
  it('waits out of play, then comes back on the last safe ground at rest and briefly invulnerable', () => {
    const race = runWorld(pitLane('#'));
    const { world, log, player } = race;
    step(world, log, SETTLE);
    runIntoPit(race);
    const parkedAt = { ...player.body };
    const progress = player.progress;
    for (let tick = 1; tick < respawnTicks; tick++) {
      step(world, log, 1, hold(RIGHT));
      expect({ ...player.body, progress: player.progress }).toEqual({ ...parkedAt, progress });
    }
    step(world, log, 1, hold(RIGHT));
    const back = { x: player.body.x, y: player.body.y };

    expect(eventsIn(log, 'racer.fell', 'racer.respawned')).toEqual([
      { type: 'racer.fell', id: 'player' },
      { type: 'racer.respawned', id: 'player', ...back },
    ]);
    expect(back.x + player.body.w).toBeLessThanOrEqual(PIT_COLUMN * TILE);
    expect(back.y + player.body.h).toBe(6 * TILE);
    expect([player.body.vx, player.body.vy, player.status.fallen]).toEqual([0, 0, 0]);
    // Statuses tick at the end of the respawn tick, so one tick of it has already run.
    expect(player.status.invulnerable).toBe(respawnInvulnTicks - 1);
  });

  it('comes back two tiles short of the pit, so a runner still holding right has room to jump', () => {
    const race = runWorld(pitLane('#'));
    step(race.world, race.log, SETTLE);
    runIntoPit(race);
    step(race.world, race.log, respawnTicks);

    expect(race.player.body.x + race.player.body.w).toBeLessThanOrEqual((PIT_COLUMN - RUN_UP_TILES) * TILE);
  });

  it('backs off only as far as open ground goes', () => {
    // A wall in column 1 leaves one tile of run-up between it and the pit at column 4.
    const race = runWorld([...HEADROOM, '.#.............F', '.#1............F', '####..##########']);
    step(race.world, race.log, SETTLE);
    runIntoPit(race);
    step(race.world, race.log, respawnTicks);
    const { x, w } = race.player.body;

    expect({ clearOfWall: x >= 2 * TILE, oneTileShort: x + w <= 3 * TILE }).toEqual({
      clearOfWall: true,
      oneTileShort: true,
    });
  });

  it('never comes back on a crate at the edge of the pit', () => {
    const race = runWorld(pitLane('?'));
    step(race.world, race.log, SETTLE);
    runIntoPit(race);
    step(race.world, race.log, respawnTicks);

    expect(race.player.body.x + race.player.body.w).toBeLessThanOrEqual((PIT_COLUMN - 1) * TILE);
  });

  it('comes back on a ledge it last stood on', () => {
    const race = runWorld([
      ...HEADROOM,
      '.1.............F',
      '.===..====.....F',
      '...............F',
      '#.........######',
    ]);
    step(race.world, race.log, SETTLE);
    runIntoPit(race);
    step(race.world, race.log, respawnTicks);

    // Under the rivals' 3 rows and the headroom, the ledge is the row after the start's.
    expect(race.player.body.y + race.player.body.h).toBe((HEADROOM.length + 4) * TILE);
    // The first ledge, cols 1-3, not the second one it never reached.
    expect(race.player.body.x + race.player.body.w).toBeLessThanOrEqual(4 * TILE);
  });

  it('never counts cracked stone as safe ground, since it can break for good', () => {
    const race = runWorld([...HEADROOM, '.1.............F', '###CCC..########']);
    const { world, log, player } = race;
    step(world, log, SETTLE);
    for (let tick = 0; tick < 120 && player.body.x < 4 * TILE; tick++) step(world, log, 1, hold(RIGHT));
    for (const column of [3, 4, 5]) breakCoral(world, column, HEADROOM.length + 4, 'tess');
    runIntoPit(race);
    step(world, log, respawnTicks + 30);

    expect(eventsIn(log, 'racer.fell')).toEqual([{ type: 'racer.fell', id: 'player' }]);
    expect(runMotion(player.motion).grounded).toBe(true);
  });

  it('stays on its park point while fallen, even with a dash running', () => {
    const race = runWorld(pitLane('#'));
    const { world, log, player } = race;
    step(world, log, SETTLE);
    runIntoPit(race);
    const parkedAt = { x: player.body.x, y: player.body.y };
    Object.assign(player, { dashDir: { x: 1, y: 0 }, dashSpeed: 200 });
    player.status.dashing = respawnTicks;
    for (let tick = 1; tick < respawnTicks; tick++) {
      step(world, log, 1, IDLE);
      expect({ x: player.body.x, y: player.body.y }).toEqual(parkedAt);
    }
  });

  it('brings a rival back the same way', () => {
    const { world, log } = runWorld(pitLane('#'));
    const tess = racerOf(world, 'tess');
    const start = { ...runMotion(tess.motion).lastSafe };
    placeOnTile(tess, PIT_COLUMN, 6);
    for (let tick = 0; tick < 120 && eventsIn(log, 'racer.respawned').length === 0; tick++) step(world, log, 1, IDLE);

    expect(eventsIn(log, 'racer.fell', 'racer.respawned')).toEqual([
      { type: 'racer.fell', id: 'tess' },
      // Its start is the only safe spot it stood on; it backs off the one tile the level's edge allows.
      { type: 'racer.respawned', id: 'tess', ...start, x: start.x - TILE },
    ]);
  });
});
