/**
 * Stomps: in a medium with a stomp bounce, landing on an enemy from above bonks it and bounces the
 * racer up; meeting it any other way is the usual hit. In swim nothing changes.
 */
import { describe, expect, it } from 'vitest';
import { PLATFORM_STOMP_BOUNCE, platformArena } from '../../conformance/platform-medium.ts';
import { eventsIn, placeAt, racerOf, step } from '../../test-world.ts';
import type { Racer, World } from '../../types.ts';
import { enemyBox } from './contact.ts';
import { arena, enemyAt } from './test-arena.ts';

/** A crab on a floor (row 3 of the player area), the player start well to its left. */
const FLOOR = ['################', '#..............F', '#..............F', '#1.......K.....F', '################'].map(
  (row) => `${row}#`,
);

/** Puts `racer` just above the world's first enemy, `gap` px clear of its top, falling at `vy`. */
function dropOnto(world: World, racer: Racer, gap: number, vy: number): void {
  const box = enemyBox(enemyAt(world));
  placeAt(racer, { x: box.x + box.w / 2, y: box.y - gap - racer.body.h / 2 });
  racer.body.vy = vy;
}

describe('stomping an enemy', () => {
  it('bonks it as a stomp and bounces the racer up when it lands on it from above', () => {
    const { world, log } = platformArena(FLOOR);
    const player = racerOf(world, 'player');
    dropOnto(world, player, 1, 120);

    // One tick: on the next, glide's speed cap (150 px/s) would clip the bounce.
    step(world, log, 1);

    expect(eventsIn(log, 'enemy.bonked')).toEqual([
      expect.objectContaining({ by: 'player', kind: 'crab', how: 'stomp' }),
    ]);
    expect(player.body.vy).toBeLessThan(-PLATFORM_STOMP_BOUNCE * 0.8);
    expect(eventsIn(log, 'racer.hit')).toEqual([]);
  });

  it('hurts a racer that walks into it from the side', () => {
    const { world, log } = platformArena(FLOOR);
    const player = racerOf(world, 'player');
    const box = enemyBox(enemyAt(world));
    placeAt(player, { x: box.x - player.body.w / 2 - 1, y: box.y + box.h / 2 });
    player.body.vx = 120;

    step(world, log, 3);

    expect(eventsIn(log, 'enemy.bonked')).toEqual([]);
    expect(eventsIn(log, 'racer.hit')).toEqual([expect.objectContaining({ id: 'player' })]);
  });

  it('hurts a racer rising into it from below', () => {
    // A shark, since a crab needs a floor under it.
    const { world, log } = platformArena([
      '##################',
      '#...............F#',
      '#........S......F#',
      '#1..............F#',
      '##################',
    ]);
    const player = racerOf(world, 'player');
    const box = enemyBox(enemyAt(world));
    placeAt(player, { x: box.x + box.w / 2, y: box.y + box.h + player.body.h / 2 + 1 });
    player.body.vy = -120;

    step(world, log, 3);

    expect(eventsIn(log, 'enemy.bonked')).toEqual([]);
    expect(eventsIn(log, 'racer.hit')).toEqual([expect.objectContaining({ id: 'player' })]);
  });

  it('is only a hit in a medium without a stomp bounce (swim)', () => {
    const { world, log } = arena(FLOOR);
    const player = racerOf(world, 'player');
    dropOnto(world, player, 1, 120);

    step(world, log, 2);

    expect(eventsIn(log, 'enemy.bonked')).toEqual([]);
    expect(eventsIn(log, 'racer.hit')).toEqual([expect.objectContaining({ id: 'player' })]);
  });
});
