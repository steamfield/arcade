/**
 * Crabs and the shared touch rule, through `stepWorld`: a crab walks its floor, hurts a racer that
 * swims into it, and is beaten by one dash bonk for a pearl.
 */

import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { LevelError } from '../../level/parse.ts';
import { centreOf, hitbox } from '../../racers.ts';
import { courseFromLevel, eventsIn, giveItems, hold, placeOnTile, racerOf, step } from '../../test-world.ts';
import { TILE, type Vec } from '../../types.ts';
import { createWorld, toAscii } from '../../world.ts';
import { overlaps } from '../boxes.ts';
import { applyHit } from '../hits.ts';
import { enemyBox } from './contact.ts';
import { ARENA_TOP, arena, enemyAt, swimUntilNear } from './test-arena.ts';
import { CRAB } from './tuning.ts';

const RIGHT: Vec = { x: 1, y: 0 };

/** A crab on a short floor with a drop to its right, and the player on a ledge to its left. */
const FLOOR = ['################', '#..............F', '#1.......K.....F', '#####.######...F', '################'].map(
  (row) => `${row}#`,
);

/** A crab on a floor with rock at both ends of its walk. */
const PEN = ['###########', '#1.......F#', '#..#.K.#.F#', '###########'];

describe('a crab walking', () => {
  it('walks its floor and turns at a drop, never leaving its row', () => {
    const { world, log } = arena(FLOOR);
    const crab = enemyAt(world);
    placeOnTile(racerOf(world, 'player'), 1, ARENA_TOP + 1);
    const xs: number[] = [];
    for (let tick = 0; tick < 1200; tick++) {
      step(world, log);
      xs.push(crab.at.x);
    }

    // The floor under it runs from col 6 to col 11; the drop at col 5 turns it back.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(6 * TILE);
    expect(Math.max(...xs)).toBeLessThanOrEqual(12 * TILE);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(4 * TILE);
    expect(crab.at.y).toBe((ARENA_TOP + 2.5) * TILE);
    expect(crab.mode).toBe('patrol');
  });

  it('turns at rock either side, at walking speed', () => {
    const { world, log } = arena(PEN);
    const crab = enemyAt(world);
    const xs: number[] = [];
    for (let tick = 0; tick < 300; tick++) {
      step(world, log);
      xs.push(crab.at.x);
    }

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(4 * TILE);
    expect(Math.max(...xs)).toBeLessThanOrEqual(7 * TILE);
    expect(Math.abs(crab.vel.x)).toBe(CRAB.walkSpeed);
  });
});

describe('touching a crab', () => {
  it('hurts a racer that swims into it without dashing, and the crab walks on', () => {
    const { world, log } = arena(FLOOR);
    const crab = enemyAt(world);
    swimUntilNear(world, log, crab, 4);
    step(world, log, 2, hold(RIGHT));

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked')).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'crab', by: null },
    ]);
    expect(crab.mode).toBe('patrol');
  });

  it('is beaten by one dash bonk: no hit, bonked to 0, defeated, one pearl bursts for anyone', () => {
    const { world, log } = arena(FLOOR);
    const crab = enemyAt(world);
    swimUntilNear(world, log, crab, 20);
    step(world, log, 1, hold(RIGHT, { kick: true }));
    step(world, log, 11, hold(RIGHT));

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked', 'enemy.defeated', 'pearls.burst')).toEqual([
      { type: 'enemy.bonked', index: 0, kind: 'crab', by: 'player', hpLeft: 0 },
      { type: 'enemy.defeated', index: 0, kind: 'crab', by: 'player' },
      { type: 'pearls.burst', index: 0, count: CRAB.pearls },
    ]);
    expect(toAscii(world)).not.toContain('K');
  });

  it('is not bonked by a racer knocked into it by a hit just after its dash', () => {
    const { world, log } = arena(FLOOR);
    const crab = enemyAt(world);
    const player = racerOf(world, 'player');
    swimUntilNear(world, log, crab, 20);
    step(world, log, 1, hold(RIGHT, { kick: true }));
    // A sting from behind stuns the player (nothing held) and knocks it on toward the crab.
    const centre = centreOf(player);
    applyHit(world, player, 'jelly', null, { x: centre.x - TILE, y: centre.y });
    let touched = false;
    for (let tick = 0; tick < 11; tick++) {
      step(world, log, 1, hold(RIGHT));
      touched ||= overlaps(enemyBox(crab), hitbox(player));
    }

    expect(touched, 'the knocked racer reached the crab').toBe(true);
    expect(eventsIn(log, 'enemy.bonked', 'enemy.defeated')).toEqual([]);
    expect(crab.mode).toBe('patrol');
  });

  it('stays defeated for the race and touches nobody after', () => {
    const { world, log } = arena(FLOOR);
    const crab = enemyAt(world);
    swimUntilNear(world, log, crab, 20);
    step(world, log, 1, hold(RIGHT, { kick: true }));
    step(world, log, 11, hold(RIGHT));
    const at = { ...crab.at };
    placeOnTile(racerOf(world, 'player'), Math.floor(at.x / TILE), Math.floor(at.y / TILE));
    step(world, log, 600);

    expect(crab).toMatchObject({ mode: 'defeated', hp: 0, at });
    expect(eventsIn(log, 'racer.hit', 'enemy.defeated')).toHaveLength(1);
  });

  it.each([
    ['boosting on Jet Fins', 'jetFin'],
    ['inflated as a Puffer', 'puffer'],
  ] as const)('is bonked by a racer %s', (_name, item) => {
    const { world, log } = arena(FLOOR);
    giveItems(racerOf(world, 'player'), [item]);
    const crab = enemyAt(world);
    swimUntilNear(world, log, crab, 20);
    step(world, log, 1, hold(RIGHT, { use: true }));
    step(world, log, 20, hold(RIGHT));

    expect(eventsIn(log, 'racer.hit', 'enemy.defeated')).toEqual([
      { type: 'enemy.defeated', index: 0, kind: 'crab', by: 'player' },
    ]);
  });

  it.each([
    ['invulnerable', 'invulnerable'],
    ['stunned', 'stunned'],
    ['trapped', 'trapped'],
  ] as const)('passes over a racer that is %s', (_name, status) => {
    const { world, log } = arena(FLOOR);
    const player = racerOf(world, 'player');
    const crab = enemyAt(world);
    player.status[status] = 200;
    placeOnTile(player, Math.floor(crab.at.x / TILE) - 1, ARENA_TOP + 2);
    step(world, log, 60);

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked')).toEqual([]);
  });
});

describe('placing a crab', () => {
  it('refuses a crab with no rock directly below it, naming its tile', () => {
    const course = courseFromLevel(`
      ########
      #1.K..F#
      #2....F#
      #3....F#
      #4....F#
      ########
    `);
    const create = () => createWorld(course, new EventLog<GameEvent>(), { seed: 1 });

    expect(create).toThrow(LevelError);
    expect(create).toThrow(expect.objectContaining({ row: 1, col: 3 }));
  });
});
