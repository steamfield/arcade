import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { type Body, type Level, TILE } from '../../logic/types.ts';
import { followRacer } from './camera.ts';

/** A 320x180 camera that records where it was scrolled to. */
function fakeCamera() {
  const scroll = { x: 0, y: 0 };
  const camera = {
    width: 320,
    height: 180,
    setScroll(x: number, y: number) {
      scroll.x = x;
      scroll.y = y;
    },
  };
  return { camera: camera as unknown as Phaser.Cameras.Scene2D.Camera, scroll };
}

/** Only the size matters to the camera: a 26-row sky, 60 columns wide. */
const LEVEL = { width: 60, height: 26 } as Level;

/** A 12 px racer at rest in tile row `row`, column 20. */
function racerAt(row: number): Body {
  return { x: 20 * TILE, y: row * TILE + 2, w: 12, h: 12, vx: 0, vy: 0 };
}

describe('the race camera', () => {
  it('stops at the level top, so a racer in row 1 sits in the screen rows the HUD covers', () => {
    const { camera, scroll } = fakeCamera();
    followRacer(camera, racerAt(1), LEVEL);
    expect(scroll.y).toBe(0);
  });

  it('with headroom, scrolls above the level top so a racer in row 1 shows below a HUD that tall', () => {
    const { camera, scroll } = fakeCamera();
    const body = racerAt(1);
    followRacer(camera, body, LEVEL, 40);
    expect(scroll.y).toBe(-40);
    expect(body.y - scroll.y).toBeGreaterThanOrEqual(40);
  });

  it('leaves a racer lower in the level framed as before, headroom or not', () => {
    const plain = fakeCamera();
    const roomy = fakeCamera();
    followRacer(plain.camera, racerAt(14), LEVEL).update(1);
    followRacer(roomy.camera, racerAt(14), LEVEL, 40).update(1);
    expect(roomy.scroll).toEqual(plain.scroll);
  });
});
