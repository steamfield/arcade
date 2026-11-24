/**
 * The sky theme's contract: Sky Test is drawn with it, its colours (`sky/palettes.ts`) grade the way
 * the plan fixes and keep terrain readable, its art is well formed under keys of its own,
 * its tiles tell thunderhead, puff, bounce and fog apart by shape, and Cloudreach's song is its own.
 * Every racer and all global art holding 3:1 off its contrast bands is checked in
 * `art/sprites/sprites.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { COURSES, levelOf } from '../../logic/courses/index.ts';
import { Tex } from '../art/keys.ts';
import { measureFrames, type NamedFrame } from '../art/pixel.ts';
import type { NoteEvent, Song } from '../audio/notation.ts';
import { songs } from '../audio/songs/index.ts';
import { FxFrame } from '../fx/textures.ts';
import { STORM_TEXTURE } from '../view/set-pieces/lightning-view.ts';
import { RING_TEXTURE } from '../view/set-pieces/ring-view.ts';
import { tileAt } from '../view/terrain-tile.ts';
import { SkyItemTex, SkyRacerTex, SkyTex } from '../worlds/cloudreach/keys.ts';
import { SKY_HAZARD_LOOPS, SKY_HAZARD_SHEETS } from '../worlds/cloudreach/sprites/hazards.ts';
import { ReefItemTex, ReefRacerTex, ReefTex } from '../worlds/reef/keys.ts';
import { REEF_HAZARD_LOOPS, REEF_HAZARD_SHEETS } from '../worlds/reef/sprites/hazards.ts';
import { ThornItemTex, ThornRacerTex, ThornTex } from '../worlds/thornwood/keys.ts';
import { THORN_HAZARD_LOOPS, THORN_HAZARD_SHEETS } from '../worlds/thornwood/sprites/hazards.ts';
import { assertCourseAssets } from './course-assets.ts';
import { FOREST_SHEETS } from './forest/sprites/index.ts';
import { FOREST_THEME } from './forest.ts';
import { THEMES, themeFor } from './index.ts';
import { OCEAN_SHEETS } from './ocean/sprites/index.ts';
import { OCEAN_THEME } from './ocean.ts';
import { SkyThemeAnim, SkyThemeTex, SkyThemeTile } from './sky/keys.ts';
import { EVENING_HAZE, SKY_BANDS, SkyBackdropPalette, SkyTerrainPalette, STORM_TINT } from './sky/palettes.ts';
import { SKY_SHEETS } from './sky/sprites/index.ts';
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

  it('grades seven sky bands from twilight indigo overhead to a paler, hazier band at the bottom', () => {
    expect(SKY_BANDS).toHaveLength(7);
    const lightness = SKY_BANDS.map(luminance);
    expect(lightness).toEqual([...lightness].sort((a, b) => a - b));
    const [r, g, b] = channels(SKY_BANDS[0] ?? 0);
    expect(b).toBeGreaterThan(Math.max(r, g));
    expect(saturation(SKY_BANDS.at(-1) ?? 0)).toBeLessThan(saturation(SKY_BANDS[0] ?? 0));
  });

  it('counts every sky band, every band seen through the haze, and the cloud banks and sun as contrast bands, since racers fly in front of all of them', () => {
    const haze = SKY_THEME.backdrop.haze;
    const alpha = haze?.alpha ?? 0;
    const hazeChannels = channels(haze?.colour ?? 0);
    const throughHaze = (band: number) =>
      channels(band)
        .map((channel, index) => Math.round(channel * (1 - alpha) + (hazeChannels[index] ?? 0) * alpha))
        .reduce((colour, channel) => (colour << 8) | channel, 0);
    const colours = SKY_THEME.contrastBands.map((band) => band.colour);
    expect(haze?.colour).toBe(EVENING_HAZE);
    expect(colours).toEqual([
      ...SKY_BANDS,
      ...SKY_BANDS.map(throughHaze),
      ...SkyBackdropPalette.far,
      ...SkyBackdropPalette.near,
    ]);
  });

  it('makes a puff cloud tell apart from a thunderhead at a glance, and a bounce cloud warm where the puff is cool', () => {
    expect(contrast(SkyTerrainPalette.puffCloud[2], SkyTerrainPalette.thunderhead[1])).toBeGreaterThanOrEqual(3);
    const [puffR, , puffB] = channels(SkyTerrainPalette.puffCloud[1]);
    const [rimR, , rimB] = channels(SkyTerrainPalette.bounceCloud[2]);
    expect(puffB).toBeGreaterThan(puffR);
    expect(rimR).toBeGreaterThan(rimB);
  });
});

const sheetFor = (key: string) => SKY_SHEETS.find((sheet) => sheet.key === key);
const tileFrame = (name: string) => sheetFor(SkyThemeTex.tiles)?.frames.find((frame) => frame.name === name);

/** Every pixel of a frame, row by row, as the characters its rows are written in. */
const pixelsOf = (frame: NamedFrame | undefined) => [...(frame?.rows.join('') ?? '')];

/** The four corner pixels of a frame. */
function corners(frame: NamedFrame | undefined): string[] {
  const rows = frame?.rows ?? [];
  const first = rows[0] ?? '';
  const last = rows.at(-1) ?? '';
  return [first[0], first.at(-1), last[0], last.at(-1)].map((pixel) => pixel ?? '.');
}

describe('the sky art', () => {
  it('draws every sky key exactly once, as well-formed pixel text, all prefixed sky-theme-', () => {
    expect(SKY_SHEETS.map((sheet) => sheet.key).sort()).toEqual(Object.values(SkyThemeTex).sort());
    for (const sheet of SKY_SHEETS) {
      expect(sheet.key.startsWith('sky-theme-'), sheet.key).toBe(true);
      expect(() => measureFrames(sheet.key, sheet.frames)).not.toThrow();
      for (const frame of sheet.frames) expect(frame.palette.length, sheet.key).toBeLessThanOrEqual(4);
    }
  });

  it("shares no texture or animation key with the other themes, the global art, the ring and storm views or any world's skin", () => {
    const otherTextures = [
      ...OCEAN_SHEETS.map((sheet) => sheet.key),
      ...FOREST_SHEETS.map((sheet) => sheet.key),
      ...Object.values(Tex),
      ...Object.values(ReefTex),
      ...Object.values(ReefRacerTex),
      ...Object.values(ReefItemTex),
      ...Object.values(ThornTex),
      ...Object.values(ThornRacerTex),
      ...Object.values(ThornItemTex),
      ...Object.values(SkyTex),
      ...Object.values(SkyRacerTex),
      ...Object.values(SkyItemTex),
      ...[...REEF_HAZARD_SHEETS, ...THORN_HAZARD_SHEETS, ...SKY_HAZARD_SHEETS].map((sheet) => sheet.key),
      RING_TEXTURE,
      STORM_TEXTURE,
    ];
    const otherAnims = [
      ...[OCEAN_THEME, FOREST_THEME].flatMap((theme) => Object.values(theme.terrain.flowing).map((art) => art.anim)),
      ...[...REEF_HAZARD_LOOPS, ...THORN_HAZARD_LOOPS, ...SKY_HAZARD_LOOPS].map((loop) => loop.key),
    ];
    const skyTextures: string[] = Object.values(SkyThemeTex);
    const skyAnims: string[] = Object.values(SkyThemeAnim);
    expect(otherTextures.filter((key) => skyTextures.includes(key))).toEqual([]);
    expect(otherAnims.filter((key) => skyAnims.includes(key))).toEqual([]);
  });

  it('gives every flowing cell the two frames its loop asks for', () => {
    const looping = Object.values(SKY_THEME.terrain.flowing).map((art) => art.texture);
    expect(looping).toHaveLength(5);
    for (const key of looping)
      expect(
        sheetFor(key)?.frames.map((frame) => frame.name),
        key,
      ).toEqual(['a', 'b']);
  });

  it('lays the tileset out in SkyThemeTile order on the 16 px grid, and leaves open air to the backdrop', () => {
    const tiles = sheetFor(SkyThemeTex.tiles);
    expect(tiles?.frames.map((frame) => frame.name)).toEqual(Object.keys(SkyThemeTile));
    expect(measureFrames(SkyThemeTex.tiles, tiles?.frames ?? [])).toEqual({ width: 16, height: 16 });
    expect(SKY_THEME.terrain).toMatchObject({
      tileset: 'sky-theme-tiles',
      tiles: { rock: 0, coral: 1, ledge: 2, bounce: 4 },
      buriedTiles: { rock: 3 },
    });
    expect(SKY_THEME.terrain.tiles.air).toBeUndefined();
  });

  it('has art for every cell and glyph of Sky Test', () => {
    expect(() => assertCourseAssets(COURSES['sky-test'])).not.toThrow();
  });

  it('draws each new Thunderhead Pass landmark with its own tile', () => {
    const course = COURSES['thunderhead-pass'];
    const level = levelOf(course);
    const legend = course.level.legend ?? {};
    expect(() => assertCourseAssets(course)).not.toThrow();
    for (const [glyph, art, tile, col, row] of [
      ['s', 'sunlit-bank', SkyThemeTile.sunlitBank, 427, 24],
      ['r', 'crow-roost', SkyThemeTile.crowRoost, 862, 5],
      ['g', 'cannon-rigging', SkyThemeTile.cannonRigging, 1239, 10],
    ] as const) {
      expect(level.glyphs[row]?.[col]).toBe(glyph);
      expect(legend[glyph]?.art).toBe(art);
      expect(tileAt(level, SKY_THEME.terrain, legend, col, row)).toBe(tile);
    }
  });

  it('fills a thunderhead to every edge and lights its top row, but rounds a puff cloud off at its corners', () => {
    const thunderhead = tileFrame('rock');
    expect(pixelsOf(thunderhead).filter((pixel) => pixel === '.')).toEqual([]);
    expect([...(thunderhead?.rows[0] ?? '')].every((pixel) => pixel === '2' || pixel === '3')).toBe(true);
    expect(pixelsOf(tileFrame('rockBuried')).filter((pixel) => pixel === '.')).toEqual([]);
    expect(corners(tileFrame('coral'))).toEqual(['.', '.', '.', '.']);
  });

  it('draws a bounce cloud as a full-width bed with a coiled rim open to the sky, unlike the puff or the thunderhead', () => {
    const bounce = tileFrame('bounce');
    const [rimTop = '', rimBand = '', rimLoops = ''] = bounce?.rows ?? [];
    expect(new Set(rimTop.replaceAll('.', ''))).toEqual(new Set(['3']));
    expect(rimBand).toMatch(/^[23]+$/);
    expect(rimLoops).toContain('.');
    expect(bounce?.rows.slice(3).every((row) => !row.includes('.'))).toBe(true);
  });

  it('draws fog over at most a third of each frame, so a fog bank reads as a soft band, not a wall', () => {
    for (const frame of sheetFor(SkyThemeTex.fog)?.frames ?? []) {
      const pixels = pixelsOf(frame);
      const drawn = pixels.filter((pixel) => pixel !== '.');
      expect(drawn.length / pixels.length, frame.name).toBeLessThanOrEqual(1 / 3);
    }
  });

  it('tiles both backdrop layers at the size the theme draws them, over hazy sky bands with no water light', () => {
    const [far, near] = SKY_THEME.backdrop.layers;
    const sizeOf = (key: string) => measureFrames(key, sheetFor(key)?.frames ?? []);
    expect(sizeOf(far?.texture ?? '').height).toBe(far?.height);
    expect(sizeOf(near?.texture ?? '').height).toBe(near?.height);
    expect(SKY_THEME.backdrop).toMatchObject({ bands: SKY_BANDS, caustics: null, rays: null });
    expect(SKY_THEME.backdrop.haze).toBeDefined();
    expect(SKY_THEME.ambient.motes).toBeNull();
  });

  it('veils a dark stretch in the storm tint, and sheds puffs of vapour rather than bubbles', () => {
    const bubbles: string[] = [FxFrame.bubble, FxFrame.bubbleSmall];
    expect(SKY_THEME.dark.colour).toBe(STORM_TINT);
    expect(SKY_THEME.trail).not.toBeNull();
    expect(bubbles).not.toContain(SKY_THEME.trail?.frame);
    expect(bubbles).not.toContain(SKY_THEME.bubbleFrames?.large);
    expect(bubbles).not.toContain(SKY_THEME.bubbleFrames?.small);
  });

  it('moves particles through air: every motion drags less than water does, and nothing floats up', () => {
    for (const [motion, { drag }] of Object.entries(SKY_THEME.particles)) {
      const water = OCEAN_THEME.particles[motion as keyof typeof OCEAN_THEME.particles].drag;
      expect(drag, motion).toBeGreaterThan(water);
    }
    expect(SKY_THEME.particles.rise.ay).toBe(0);
    expect(SKY_THEME.particles.riseStill.ay).toBe(0);
  });
});

/** The lead line of a song. */
const lead = (song: Song): NoteEvent[] => song.notes.filter((note) => note.channel === 'pulse1');

/** The beat a song's section starts on. */
function sectionStart(song: Song, name: string): number {
  const bar = song.sections.find((section) => section.name === name)?.bar;
  if (bar === undefined) throw new Error(`${song.name} has no section ${name}`);
  return bar * song.beatsPerBar;
}

/** Semitone steps between consecutive pitches. */
const intervals = (pitches: readonly number[]) => pitches.slice(1).map((pitch, i) => pitch - (pitches[i] ?? pitch));

/** The steps between the first four lead notes of a song's section A: the opening cell of its hook. */
function hookCell(song: Song): string {
  const start = sectionStart(song, 'A');
  const opening = lead(song).filter((note) => note.start >= start);
  return intervals(opening.slice(0, 4).map((note) => Number(note.pitch))).join();
}

/** Whether a song's lead plays `cell` anywhere, at any transposition. */
function quotesCell(song: Song, cell: string): boolean {
  const pitches = lead(song).map((note) => Number(note.pitch));
  return pitches.some((_, i) => intervals(pitches.slice(i, i + 4)).join() === cell);
}

/** The pitch class of the bass note on a song's loop downbeat: the key it comes home to. */
function homePitchClass(song: Song): number | undefined {
  const bass = song.notes.find((note) => note.channel === 'triangle' && note.start === song.loopStart);
  return bass === undefined ? undefined : Number(bass.pitch) % 12;
}

describe('the Cloudreach song', () => {
  const { cloudreach, race, thornwood } = songs;

  it('loops back to A on a bar line', () => {
    expect(cloudreach.loopStart).toBe(sectionStart(cloudreach, 'A'));
  });

  it('has its own tempo and its own home key', () => {
    expect([race.bpm, thornwood.bpm]).not.toContain(cloudreach.bpm);
    expect([homePitchClass(race), homePitchClass(thornwood)]).not.toContain(homePitchClass(cloudreach));
  });

  it("has its own hook: it never quotes the race's or Thornwood's opening cell, at any pitch", () => {
    expect(hookCell(cloudreach)).not.toBe(hookCell(race));
    expect(quotesCell(cloudreach, hookCell(race))).toBe(false);
    expect(quotesCell(cloudreach, hookCell(thornwood))).toBe(false);
  });
});
