import { describe, expect, it } from 'vitest';
import { baseOffset, stageFor } from './stage.ts';

describe('stageFor', () => {
  it('keeps the base view when the container is an exact multiple of it', () => {
    expect(stageFor({ width: 960, height: 540 })).toEqual({ zoom: 3, width: 320, height: 180 });
  });

  it('grows the view to cover a window of another shape at a whole-number zoom', () => {
    // The 16:10 window from the bug report: 1852x1042 css px left bars at 5x before.
    const stage = stageFor({ width: 1852, height: 1042 });
    expect(stage).toEqual({ zoom: 5, width: 371, height: 209 });
    expect(stage.width * stage.zoom).toBeGreaterThanOrEqual(1852);
    expect(stage.height * stage.zoom).toBeGreaterThanOrEqual(1042);
  });

  it('crops at most one zoom step short of a pixel on each axis', () => {
    for (const [width, height] of [
      [1280, 720],
      [1440, 900],
      [863, 360],
      [2560, 1440],
    ] as const) {
      const stage = stageFor({ width, height });
      expect(stage.width * stage.zoom - width).toBeLessThan(stage.zoom);
      expect(stage.height * stage.zoom - height).toBeLessThan(stage.zoom);
    }
  });

  it('stops growing past 21:9 wide and 4:3 tall, leaving bars there instead', () => {
    expect(stageFor({ width: 3840, height: 1080 })).toEqual({ zoom: 6, width: 420, height: 180 });
    expect(stageFor({ width: 960, height: 960 })).toEqual({ zoom: 3, width: 320, height: 240 });
  });

  it('never goes below the base or zoom 1 in a tiny container', () => {
    expect(stageFor({ width: 200, height: 100 })).toEqual({ zoom: 1, width: 320, height: 180 });
  });
});

describe('baseOffset', () => {
  it('centres the base layout in a larger view', () => {
    expect(baseOffset({ width: 371, height: 209 })).toEqual({ x: 25, y: 14 });
    expect(baseOffset({ width: 320, height: 180 })).toEqual({ x: 0, y: 0 });
  });
});
