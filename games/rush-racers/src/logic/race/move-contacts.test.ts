/**
 * What `moveBody` reports it ran into: floors, ceilings with the tiles a head hit, walls, and the
 * extra solid tiles a medium adds (ready crates).
 */
import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../level/parse.ts';
import { tileIndex } from '../level/query.ts';
import { type Body, type Level, type MoveContacts, type MoveRules, RACER_SIZE } from '../types.ts';
import { moveBody } from './collide.ts';

/** A room 10 wide: rock round the edge, one rock tile at column 4, row 2. */
const ROOM: Level = parseLevel({
  name: 'room',
  ascii: `
    ##########
    #........F
    #...#....F
    #........F
    #1234....F
    ##########
  `,
});

const OPEN: MoveRules = { pitBelow: false, solidTiles: new Set() };

const body = (x: number, y: number, vx: number, vy: number): Body => ({
  x,
  y,
  vx,
  vy,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

/** Moves `target` for `ticks` ticks and returns the contacts of every tick. */
function contactsOver(target: Body, level: Level, ticks: number, rules: MoveRules = OPEN): MoveContacts[] {
  return Array.from({ length: ticks }, () => moveBody(target, level, new Set(), TICK_DT, rules));
}

const anyOf = (all: MoveContacts[], key: 'floor' | 'ceiling' | 'wallLeft' | 'wallRight') => all.some((c) => c[key]);

describe('move contacts', () => {
  it('reports a floor on the tick a falling body lands, and nothing else', () => {
    const falling = body(100, 50, 0, 80);
    const all = contactsOver(falling, ROOM, 30);

    const landed = all.findIndex((c) => c.floor);
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(all.slice(0, landed).every((c) => !c.floor)).toBe(true);
    expect(anyOf(all, 'ceiling') || anyOf(all, 'wallLeft') || anyOf(all, 'wallRight')).toBe(false);
    expect(falling.vy).toBe(0);
  });

  it('reports a ceiling and the tile the head hit when a body rises into rock', () => {
    // Under the rock at column 4, row 2 (pixels 64..80 by 32..48).
    const rising = body(66, 60, 0, -80);
    const all = contactsOver(rising, ROOM, 20);

    const bump = all.find((c) => c.ceiling);
    expect(bump?.ceilingTiles).toEqual([tileIndex(ROOM, 4, 2)]);
    expect(all.filter((c) => !c.ceiling).every((c) => c.ceilingTiles.length === 0)).toBe(true);
  });

  it('lists every tile the head spans, left to right', () => {
    // Straddling columns 4 and 5 under a two-tile roof.
    const level = parseLevel({
      name: 'roof',
      ascii: `
        ##########
        #........F
        #...##...F
        #........F
        #1234....F
        ##########
      `,
    });
    const rising = body(74, 60, 0, -80);
    const bump = contactsOver(rising, level, 20).find((c) => c.ceiling);

    expect(bump?.ceilingTiles).toEqual([tileIndex(level, 4, 2), tileIndex(level, 5, 2)]);
  });

  it('reports the wall a body runs into on its side', () => {
    expect(anyOf(contactsOver(body(40, 35, 80, 0), ROOM, 20), 'wallRight')).toBe(true);
    expect(anyOf(contactsOver(body(90, 35, -80, 0), ROOM, 20), 'wallLeft')).toBe(true);
  });

  it('treats a rule-given solid tile like rock and reports the head bump on it', () => {
    const crate = tileIndex(ROOM, 6, 2);
    const rising = body(98, 60, 0, -80);
    const all = contactsOver(rising, ROOM, 20, { pitBelow: false, solidTiles: new Set([crate]) });

    expect(all.find((c) => c.ceiling)?.ceilingTiles).toEqual([crate]);
    expect(rising.y).toBeGreaterThanOrEqual(48);
  });
});
