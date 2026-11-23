/**
 * The sky theme's contract: Sky Test is drawn with it, it draws the bounce cloud, and its colours
 * (`sky/palettes.ts`) grade the way the plan fixes and keep hazards and terrain readable. Every racer
 * and all global art holding 3:1 off its contrast bands is checked in `art/sprites/sprites.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import { songs } from '../audio/songs/index.ts';
import { THEMES, themeFor } from './index.ts';
import { SKY_BANDS, SkyBackdropPalette, SkyHazardPalette, SkyTerrainPalette } from './sky/palettes.ts';
import { SKY_THEME } from './sky.ts';

/** The three 0-255 channels of a 0xRRGGBB colour. */
const channels = (colour: number) => [16, 8, 0].map((shift) => (colour >> shift) & 0xff) as [number, number, number];

/** WCAG relative luminance of a 0xRRGGBB colour. */
function luminance(colour: number): number {
  const [r, g, b] = channels(colour).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two 0xRRGGBB colours. */
function contrast(a: number, b: number): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** HSV saturation, 0 for grey to 1 for a pure hue: how far a colour is from haze. */
function saturation(colour: number): number {
  const values = channels(colour);
  const max = Math.max(...values);
  return max === 0 ? 0 : (max - Math.min(...values)) / max;
}

describe('the sky theme', () => {
  it('draws Sky Test, which plays the Cloudreach song', () => {
    const skyTest = COURSES['sky-test'];
    expect(THEMES.sky).toBe(SKY_THEME);
    expect(themeFor(skyTest).id).toBe('sky');
    expect(songs[skyTest.song].name).toBe('cloudreach');
  });

  it('draws a bounce cloud', () => {
    expect(SKY_THEME.terrain.tiles.bounce).toBeDefined();
  });

  it('grades seven sky bands from a deep blue overhead to a paler, hazier band at the bottom', () => {
    expect(SKY_BANDS).toHaveLength(7);
    const lightness = SKY_BANDS.map(luminance);
    expect(lightness).toEqual([...lightness].sort((a, b) => a - b));
    const [r, g, b] = channels(SKY_BANDS[0] ?? 0);
    expect(b).toBeGreaterThan(Math.max(r, g));
    expect(saturation(SKY_BANDS.at(-1) ?? 0)).toBeLessThan(saturation(SKY_BANDS[0] ?? 0));
  });

  it('counts every sky band and both cloud banks as contrast bands, since racers fly in front of all of them', () => {
    const colours = SKY_THEME.contrastBands.map((band) => band.colour);
    expect(colours).toEqual([...SKY_BANDS, ...SkyBackdropPalette.far, ...SkyBackdropPalette.near]);
  });

  it.each([
    ['spark cloud', SkyHazardPalette.sparkCloud[1]],
    ['static wisp', SkyHazardPalette.staticWisp[1]],
  ])("keeps the %s's body 3:1 off every sky contrast band", (_, body) => {
    const weakest = Math.min(...SKY_THEME.contrastBands.map((band) => contrast(body, band.colour)));
    expect(weakest).toBeGreaterThanOrEqual(3);
  });

  it('makes a puff cloud tell apart from a thunderhead at a glance, and a bounce cloud warm where the puff is cool', () => {
    expect(contrast(SkyTerrainPalette.puffCloud[2], SkyTerrainPalette.thunderhead[1])).toBeGreaterThanOrEqual(3);
    const [puffR, , puffB] = channels(SkyTerrainPalette.puffCloud[1]);
    const [rimR, , rimB] = channels(SkyTerrainPalette.bounceCloud[2]);
    expect(puffB).toBeGreaterThan(puffR);
    expect(rimR).toBeGreaterThan(rimB);
  });
});
