/**
 * The platformer seams go through the medium: generic code asks the course's medium whether stomps
 * bounce, crates are solid, pits open, ledges exist and racers bump only sideways, and calls its
 * `afterMove` once per racer per tick. Swim answers no to all of them; the test-only platform medium
 * answers yes, so each seam is seen working without any shipped platform medium.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { mediumById } from '../media/index.ts';
import { spawnDecoy } from '../powerups/decoys.ts';
import { courseFromLevel, placeAt, racerOf, step } from '../test-world.ts';
import { RACER_IDS, TILE } from '../types.ts';
import { createWorld } from '../world.ts';
import { afterMoveCalls, PLATFORM_ARENA_TOP, platformArena, platformRace } from './platform-medium.ts';

const OPEN = ['##########', '#1.......F', '#........F', '##########'].map((row) => `${row}#`);

describe('afterMove', () => {
  it('runs once per unfinished racer per tick, in RACER_IDS order', () => {
    const { world, log } = platformArena(OPEN);

    step(world, log, 3);

    const ticks = [...new Set(afterMoveCalls.map((call) => call.tick))];
    expect(ticks).toHaveLength(3);
    for (const tick of ticks) {
      expect(afterMoveCalls.filter((call) => call.tick === tick).map((call) => call.id)).toEqual([...RACER_IDS]);
    }
  });

  it('sees the racer after this tick move', () => {
    const { world, log } = platformArena(OPEN);
    const player = racerOf(world, 'player');
    player.body.vx = 120;

    step(world, log, 1);

    const call = afterMoveCalls.find((entry) => entry.id === 'player');
    expect(call?.at).toEqual({ x: player.body.x, y: player.body.y });
  });

  it('reports a floor contact for a racer resting on the floor', () => {
    const { world, log } = platformArena(OPEN);
    const player = racerOf(world, 'player');
    placeAt(player, { x: 2.5 * TILE, y: (PLATFORM_ARENA_TOP + 3) * TILE - player.body.h / 2 });
    player.body.vy = 60;

    step(world, log, 1);

    expect(afterMoveCalls.find((entry) => entry.id === 'player')?.contacts.floor).toBe(true);
  });
});

describe('swim answers no to every platformer seam', () => {
  it('has no stomp, no solid crates, no pits, no ledges, and solid racer collision', () => {
    const swim = mediumById('swim');
    expect(swim?.effects).toMatchObject({
      stompBounce: null,
      solidClams: false,
      pitBelow: false,
      allowsLedges: false,
    });
    expect(swim?.racerCollision).toBe('solid');
  });

  it('rejects a course with a ledge', () => {
    const course = courseFromLevel(['#########', '#1..===.F', '#.......F', '#########'].join('\n'), 'swim');
    expect(() => createWorld(course, new EventLog<GameEvent>(100), { seed: 1 })).toThrow(/ledge/i);
  });
});

describe('horizontal racer collision', () => {
  it('lets a racer dropping onto another pass through it', () => {
    const { world, log } = platformRace(
      ['########', '#......F', '#......F', '#1....2F', '########', '#3....4F', '########'].join('\n'),
    );
    const player = racerOf(world, 'player');
    const rival = racerOf(world, 'tess');
    // The rival stands in open water two tiles left of its start, the player right on top of it.
    placeAt(rival, { x: 3.5 * TILE, y: 3 * TILE + TILE / 2 });
    placeAt(player, { x: 3.5 * TILE, y: 3 * TILE + TILE / 2 - player.body.h });
    rival.body.vx = 0;
    player.body.vy = 200;
    const startY = player.body.y;

    step(world, log, 2);

    expect(player.body.y).toBeGreaterThan(startY + 4);
  });
});

describe('decoys move under the medium rules', () => {
  it('stop at a solid crate in a solid-crate medium', () => {
    const { world, log } = platformArena(['##########', '#1..?....F', '##########'].map((row) => `${row}#`));
    const player = racerOf(world, 'player');
    spawnDecoy(world, player);

    step(world, log, 60);

    const decoy = world.decoys[0];
    expect(decoy).toBeDefined();
    expect(decoy?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(4 * TILE);
  });
});
