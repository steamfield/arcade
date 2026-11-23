import { describe, expect, it } from 'vitest';
import { Frame } from '../art/keys.ts';
import { arrowPlacement } from './guide-view.ts';
import { SPLASH_RECT } from './threat-hud.ts';
import { MARKER_BOUNDS } from './threat-math.ts';

const CENTRE = { x: 168, y: 110 };

describe('arrowPlacement', () => {
  it.each([
    [{ x: 1, y: 0 }, Frame.guideStraight, 0],
    [{ x: 0, y: 1 }, Frame.guideStraight, 90],
    [{ x: -1, y: 0 }, Frame.guideStraight, 180],
    [{ x: 0, y: -1 }, Frame.guideStraight, 270],
    [{ x: 1, y: 1 }, Frame.guideDiagonal, 0],
    [{ x: -1, y: 1 }, Frame.guideDiagonal, 90],
    [{ x: -1, y: -1 }, Frame.guideDiagonal, 180],
    [{ x: 1, y: -1 }, Frame.guideDiagonal, 270],
  ])('turns for %j with the %s frame by %i degrees', (dir, frame, degrees) => {
    const placed = arrowPlacement(dir, CENTRE, 0, true);
    expect(placed.frame).toBe(frame);
    expect(Math.round((placed.angle * 180) / Math.PI)).toBe(degrees);
  });

  it('sits ahead of the player in the direction it points', () => {
    const down = arrowPlacement({ x: 0, y: 1 }, CENTRE, 0, true);
    expect([down.x, down.y]).toEqual([CENTRE.x, CENTRE.y + 24]);
    const upLeft = arrowPlacement({ x: -1, y: -1 }, CENTRE, 0, true);
    expect(upLeft.x).toBeLessThan(CENTRE.x);
    expect(upLeft.y).toBeLessThan(CENTRE.y);
  });

  it('bobs outward without reduced motion, and holds still with it', () => {
    const rest = arrowPlacement({ x: 1, y: 0 }, CENTRE, 20, false);
    const bobbing = arrowPlacement({ x: 1, y: 0 }, CENTRE, 0, false);
    expect(bobbing.x).toBeGreaterThan(rest.x);
    expect(arrowPlacement({ x: 1, y: 0 }, CENTRE, 0, true)).toEqual(arrowPlacement({ x: 1, y: 0 }, CENTRE, 20, true));
  });

  it('stays below the HUD and inside the screen, whatever the player position', () => {
    const high = arrowPlacement({ x: 0, y: -1 }, { x: 168, y: 55 }, 0, true);
    expect(high.y).toBeGreaterThanOrEqual(MARKER_BOUNDS.y);
    const edge = arrowPlacement({ x: 1, y: 0 }, { x: 330, y: 110 }, 0, true);
    expect(edge.x).toBeLessThanOrEqual(MARKER_BOUNDS.x + MARKER_BOUNDS.w);
  });

  it('keeps out of the band the countdown and GO banners draw in', () => {
    const up = arrowPlacement({ x: 0, y: -1 }, { x: 168, y: 90 }, 0, true);
    const half = 7;
    expect(up.y - half).toBeGreaterThanOrEqual(SPLASH_RECT.y + SPLASH_RECT.h);
  });

  it('refuses a direction that is not one of the eight offsets', () => {
    expect(() => arrowPlacement({ x: 2, y: 0 }, CENTRE, 0, true)).toThrow('8 neighbour offsets');
  });
});
