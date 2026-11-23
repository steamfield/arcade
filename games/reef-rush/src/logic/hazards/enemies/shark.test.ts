/**
 * Sharks through `stepWorld`: a patrol around home, a telegraphed wind-up on a racer it sees, a charge
 * at where that racer was, and two dash bonks (or one Homing Squid) to beat it.
 */
import { describe, expect, it } from 'vitest';
import { eventsIn, giveItems, hold, placeOnTile, racerOf, step, ticksOf, tileCentre } from '../../test-world.ts';
import { TILE, type Vec } from '../../types.ts';
import { ARENA_TOP, arena, enemyAt, swimUntilNear, towardEnemy } from './test-arena.ts';
import { SHARK } from './tuning.ts';

const RIGHT: Vec = { x: 1, y: 0 };

/** Open water with a shark at col 12 (facing left, toward the player's start), and a pillar at col 6. */
const SEA = [
  '######################',
  '#...................F#',
  '#.....#.............F#',
  '#1..........S.......F#',
  '#...................F#',
  '######################',
];

const SHARK_ROW = ARENA_TOP + 3;

/** A race on SEA with the player held on tile (`col`, `row` of the level) by `pin` before each step. */
function sea(difficulty?: 'easy') {
  const { world, log } = arena(SEA, difficulty ? { difficulty } : {});
  return { world, log, shark: enemyAt(world), player: racerOf(world, 'player') };
}

/** Steps `ticks` times, putting the player back on tile (`col`, `row`) before each. */
function pinned(
  world: ReturnType<typeof sea>['world'],
  log: ReturnType<typeof sea>['log'],
  col: number,
  ticks: number,
) {
  for (let tick = 0; tick < ticks; tick++) {
    placeOnTile(racerOf(world, 'player'), col, SHARK_ROW);
    step(world, log);
  }
}

describe('a shark on patrol', () => {
  it('swims back and forth within its patrol range of home while nobody is in sight', () => {
    const { world, log, shark } = sea();
    const xs: number[] = [];
    const player = racerOf(world, 'player');
    for (let tick = 0; tick < 1200; tick++) {
      // Invulnerable, so the shark never picks it.
      player.status.invulnerable = 2;
      step(world, log);
      xs.push(shark.at.x);
    }
    const home = 12.5 * TILE;

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(home - SHARK.patrolTiles * TILE - 1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(home + SHARK.patrolTiles * TILE + 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5 * TILE);
    expect(shark.at.y).toBe((SHARK_ROW + 0.5) * TILE);
  });

  it.each([
    ['behind it', 15],
    ['beyond its sight', 4],
  ])('ignores a racer %s', (_name, col) => {
    const { world, log } = sea();
    pinned(world, log, col, 20);

    expect(eventsIn(log, 'enemy.telegraphed')).toEqual([]);
  });

  it('ignores a racer behind rock', () => {
    const { world, log, shark } = sea();
    shark.at = { x: 11.5 * TILE, y: (SHARK_ROW - 0.5) * TILE };
    for (let tick = 0; tick < 20; tick++) {
      placeOnTile(racerOf(world, 'player'), 5, SHARK_ROW - 1);
      shark.at.y = (SHARK_ROW - 0.5) * TILE;
      step(world, log);
    }

    expect(eventsIn(log, 'enemy.telegraphed')).toEqual([]);
  });

  it.each([
    ['invulnerable', 'invulnerable'],
    ['stunned', 'stunned'],
  ] as const)('ignores a racer that is %s', (_name, status) => {
    const { world, log, player } = sea();
    player.status[status] = 200;
    pinned(world, log, 8, 20);

    expect(eventsIn(log, 'enemy.telegraphed')).toEqual([]);
  });

  it('swims back to its lane before it hunts again, ignoring a racer it sees on the way', () => {
    const { world, log, shark } = sea();
    shark.at = tileCentre(16, SHARK_ROW);
    shark.facing = -1;
    pinned(world, log, 12, 10);

    expect(eventsIn(log, 'enemy.telegraphed')).toEqual([]);
    expect(shark.at.x).toBeLessThan(16.5 * TILE);
  });

  it('never winds up on the player on Easy', () => {
    const { world, log } = sea('easy');
    pinned(world, log, 8, 120);

    expect(eventsIn(log, 'enemy.telegraphed', 'racer.hit')).toEqual([]);
  });
});

describe('a shark that sees a racer', () => {
  it('winds up for half a second, then charges at where the racer was and hits it', () => {
    const { world, log } = sea();
    pinned(world, log, 8, 60);

    expect(ticksOf(log, 'enemy.telegraphed')).toEqual([1]);
    expect(ticksOf(log, 'enemy.charged')).toEqual([1 + SHARK.windupTicks]);
    expect(eventsIn(log, 'enemy.telegraphed', 'enemy.charged', 'racer.hit')).toEqual([
      { type: 'enemy.telegraphed', index: 0, kind: 'shark' },
      { type: 'enemy.charged', index: 0, kind: 'shark', target: 'player' },
      { type: 'racer.hit', id: 'player', cause: 'shark', by: null },
    ]);
  });

  it('charges at where the racer was when the wind-up ended, not where it goes after', () => {
    const { world, log, shark } = sea();
    pinned(world, log, 8, SHARK.windupTicks + 1);
    const chargedAt = { ...shark.at };
    pinned(world, log, 17, 10);

    expect(shark.mode).toBe('charge');
    expect(shark.at.x).toBeLessThan(chargedAt.x - 10 * SHARK.chargeSpeed * (1 / 60) + 1);
    expect(shark.at.y).toBeCloseTo(chargedAt.y, 0);
  });

  it('is stopped by rock, sits out its recovery, then patrols again', () => {
    const { world, log, shark } = sea();
    Object.assign(shark, { home: { x: 5, y: SHARK_ROW }, at: tileCentre(5, SHARK_ROW) });
    pinned(world, log, 2, SHARK.windupTicks + 1);
    // The player slips away behind it, so the charge runs on into the wall at col 0.
    pinned(world, log, 18, SHARK.chargeTicks);

    expect(shark.at.x).toBeGreaterThanOrEqual(TILE + SHARK.size / 2);
    expect(shark.vel).toEqual({ x: 0, y: 0 });
    pinned(world, log, 18, SHARK.recoverTicks + 2);
    expect(shark.mode).toBe('patrol');
  });
});

describe('beating a shark', () => {
  it('staggers at the first bonk, harmless, and is defeated by the second in a burst of five pearls', () => {
    const { world, log, shark } = sea();
    swimUntilNear(world, log, shark, 20);
    step(world, log, 1, hold(RIGHT, { kick: true }));
    step(world, log, 5, hold(RIGHT));

    expect(shark).toMatchObject({ mode: 'stagger', hp: 1 });
    // Back off out of its sight while the dash cools down, then come in again.
    placeOnTile(racerOf(world, 'player'), 3, SHARK_ROW);
    step(world, log, 40);
    swimUntilNear(world, log, shark, 18);
    step(world, log, 1, hold(towardEnemy(world, shark), { kick: true }));
    step(world, log, 11, hold(towardEnemy(world, shark)));

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked', 'enemy.defeated', 'pearls.burst')).toEqual([
      { type: 'enemy.bonked', index: 0, kind: 'shark', by: 'player', hpLeft: 1 },
      { type: 'enemy.bonked', index: 0, kind: 'shark', by: 'player', hpLeft: 0 },
      { type: 'enemy.defeated', index: 0, kind: 'shark', by: 'player' },
      { type: 'pearls.burst', index: 0, count: SHARK.pearls },
    ]);
  });

  it('is bonked once by one long Jet Fins boost through it', () => {
    const { world, log, shark } = sea();
    giveItems(racerOf(world, 'player'), ['jetFin']);
    swimUntilNear(world, log, shark, 24);
    step(world, log, 1, hold(RIGHT, { use: true }));
    step(world, log, 40, hold(RIGHT));

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked')).toEqual([
      { type: 'enemy.bonked', index: 0, kind: 'shark', by: 'player', hpLeft: 1 },
    ]);
  });

  it('cannot hurt anyone while staggered', () => {
    const { world, log, shark, player } = sea();
    swimUntilNear(world, log, shark, 20);
    step(world, log, 1, hold(RIGHT, { kick: true }));
    step(world, log, 3, hold(RIGHT));
    player.status.bonking = 0;
    // Away for a tick, so the next touch is a new contact rather than the bonk carrying on.
    placeOnTile(player, 2, SHARK_ROW);
    step(world, log);
    for (let tick = 0; tick < SHARK.staggerTicks - 8; tick++) {
      player.body.x = shark.at.x - player.body.w / 2;
      player.body.y = shark.at.y - player.body.h / 2;
      step(world, log);
    }

    expect(shark.mode).toBe('stagger');
    expect(eventsIn(log, 'racer.hit')).toEqual([]);
  });
});
