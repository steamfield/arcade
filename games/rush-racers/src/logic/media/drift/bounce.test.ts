/**
 * Drift's bounce: a tile that stops a drifter sends it back with part of its speed, on the axis it
 * was stopped on, and a hard enough impact emits `racer.rebounded`. Raced through `createWorld` and
 * `stepWorld` on a small inline course with a wall and a floor.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { hold, IDLE, placeOnTile, step } from '../../test-world.ts';
import { driftWorld, RIVAL_LANE_ROWS } from './test-kit.ts';
import { DRIFT_TUNING } from './tuning.ts';

const { bounce, bounceMinSpeed } = DRIFT_TUNING.extra;

/** Open space with a wall at col 9 in the player's two lower rows and rock under them; the top row leads to the finish. */
const WALLED = ['...........F', '.1.......#.F', '.........#.F', '############'];

/** The player on tile (`tx`, player-area row `row`) of WALLED, moving at (`vx`, `vy`). */
function playerAt(tx: number, row: number, vx: number, vy: number) {
  const made = driftWorld(WALLED);
  placeOnTile(made.player, tx, RIVAL_LANE_ROWS + row);
  made.player.body.vx = vx;
  made.player.body.vy = vy;
  return made;
}

const bounces = (events: readonly GameEvent[]) =>
  events.filter((event): event is Extract<GameEvent, { type: 'racer.rebounded' }> => event.type === 'racer.rebounded');

describe('a bounce', () => {
  it('sends a drifter back off a wall with `bounce` of its speed and says how hard it hit', () => {
    const { world, log, player } = playerAt(6, 1, 100, 0);
    step(world, log, 40, IDLE);
    const [hit, ...more] = bounces(log.all());

    expect(more).toEqual([]);
    expect(hit?.id).toBe('player');
    expect(hit?.axis).toBe('x');
    expect(hit?.speed).toBeGreaterThan(90);
    expect(hit?.speed).toBeLessThanOrEqual(100);
    expect(player.body.vx).toBeLessThan(0);
    expect(player.body.vx).toBeGreaterThanOrEqual(-100 * bounce);
    expect(player.body.vx).toBeLessThan(-100 * bounce * 0.6);
    expect(player.body.vy).toBe(0);
  });

  it('keeps the speed along the wall', () => {
    const { world, log, player } = playerAt(6, 1, 100, -20);
    step(world, log, 25, IDLE);

    expect(player.body.vx).toBeLessThan(0);
    expect(player.body.vy).toBeLessThan(-10);
  });

  it('still bounces a slow drifter, without an event', () => {
    const slow = bounceMinSpeed * 0.75;
    const { world, log, player } = playerAt(7, 1, slow, 0);
    step(world, log, 60, IDLE);

    expect(bounces(log.all())).toEqual([]);
    expect(player.body.vx).toBeLessThan(0);
  });

  it('names the axis a floor stopped it on', () => {
    const { world, log } = playerAt(4, 2, 0, 100);
    step(world, log, 30, IDLE);

    expect(bounces(log.all()).map((event) => event.axis)).toEqual(['y']);
  });

  it('reverses both components in a corner', () => {
    const { world, log, player } = playerAt(7, 2, 100, 100);
    step(world, log, 30, IDLE);

    expect(player.body.vx).toBeLessThan(0);
    expect(player.body.vy).toBeLessThan(0);
  });

  it('does not report a racer held against a wall by its thrust tick after tick', () => {
    const { world, log } = playerAt(7, 1, 0, 0);
    step(world, log, 180, hold({ x: 1, y: 0 }));

    expect(bounces(log.all()).length).toBeLessThanOrEqual(1);
  });

  it('leaves a racer an item dash is driving into a wall alone: no bounce and no event until the dash ends', () => {
    const { world, log, player } = playerAt(7, 1, 0, 0);
    player.status.dashing = 24;
    player.dashDir = { x: 1, y: 0 };
    player.dashSpeed = 200;
    step(world, log, 23, IDLE);

    expect(bounces(log.all())).toEqual([]);
    expect(player.body.vx).toBeGreaterThanOrEqual(0);
  });

  it('happens to a rival too', () => {
    const { world, log } = driftWorld(WALLED);
    const tess = world.racers.find((racer) => racer.id === 'tess');
    if (!tess) throw new Error('no tess');
    tess.body.vx = -150;
    step(world, log, 30, IDLE);

    expect(bounces(log.all()).some((event) => event.id === 'tess')).toBe(true);
  });
});
