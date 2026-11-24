/**
 * Reef's object art: the items, attack art, pickups and enemies have the frames and sizes their views
 * ask for. Every other world is held to Reef's by `worlds/skins.test.ts`, so these are the baseline.
 */
import { describe, expect, it } from 'vitest';
import { POWER_UP_KINDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { measureFrames } from '../../art/pixel.ts';
import { ReefTex } from './keys.ts';
import { REEF_OBJECT_SHEETS, REEF_OBJECTS } from './objects.ts';
import { RIPTIDE_TILE } from './sprites/attack.ts';
import { REEF_MARK_SIZE } from './sprites/marks.ts';

const sheetFor = (key: string) => REEF_OBJECT_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);
const sizeOf = (key: string) => measureFrames(key, sheetFor(key)?.frames ?? []);

describe('Reef object art', () => {
  it('lists each texture once, since drawing skips a key it already drew', () => {
    const keys = REEF_OBJECT_SHEETS.map((sheet) => sheet.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('draws every held power-up as a 12x12 sprite, the attack kinds included', () => {
    const { itemTextures } = REEF_OBJECTS;
    for (const kind of POWER_UP_KINDS) {
      expect(frameNames(itemTextures[kind]), kind).toEqual([Frame.a]);
      expect(sizeOf(itemTextures[kind]), kind).toEqual({ width: 12, height: 12 });
    }
  });

  it('gives the clam, the squid and the attack streaks the frames their views ask for', () => {
    expect(frameNames(ReefTex.clam)).toEqual([Frame.clamClosed, Frame.clamOpen]);
    expect(frameNames(ReefTex.squid)).toEqual([Frame.a, Frame.b, Frame.squidLatched]);
    expect(frameNames(ReefTex.riptideStreak)).toEqual([Frame.a]);
    expect(frameNames(ReefTex.undertowStreak)).toEqual([Frame.a, Frame.b]);
  });

  it('sizes the squid and its latched pose like a racer, and the lane tile to the grid', () => {
    expect(sizeOf(ReefTex.squid)).toEqual({ width: 16, height: 12 });
    expect(sizeOf(ReefTex.riptideStreak)).toEqual({ width: RIPTIDE_TILE, height: RIPTIDE_TILE });
  });

  it('gives each enemy the poses its view asks for, at its size', () => {
    expect(frameNames(ReefTex.shark)).toEqual([Frame.a, Frame.b, Frame.enemyBite, Frame.enemyStagger]);
    expect(sizeOf(ReefTex.shark)).toEqual({ width: 24, height: 14 });
    expect(frameNames(ReefTex.eelHead)).toEqual([Frame.a, Frame.b]);
    // The body tile is as tall as the head, so the two join row for row.
    expect(sizeOf(ReefTex.eelHead)).toEqual({ width: 16, height: 10 });
    expect(sizeOf(ReefTex.eelBody)).toEqual({ width: 8, height: 10 });
    expect(frameNames(ReefTex.crab)).toEqual([Frame.a, Frame.b, Frame.enemyStagger]);
    expect(sizeOf(ReefTex.crab)).toEqual({ width: 16, height: 12 });
    expect(frameNames(ReefTex.marks)).toEqual([
      Frame.markHole,
      Frame.markEyes,
      Frame.markAlert,
      Frame.markBubble,
      Frame.markStar,
      Frame.markPop,
    ]);
    expect(sizeOf(ReefTex.marks)).toEqual({ width: REEF_MARK_SIZE, height: REEF_MARK_SIZE });
  });
});
