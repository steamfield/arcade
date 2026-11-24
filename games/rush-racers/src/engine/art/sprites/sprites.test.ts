import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { THEMES } from '../../themes/index.ts';
import { CloudreachPalette } from '../../worlds/cloudreach/sprites/palette.ts';
import { CLOUDREACH_RACER_SHEETS } from '../../worlds/cloudreach/sprites/racers.ts';
import { FarsidePalette } from '../../worlds/farside/sprites/palette.ts';
import { FARSIDE_RACER_SHEETS } from '../../worlds/farside/sprites/racers.ts';
import { ReefEnemyPalette } from '../../worlds/reef/sprites/enemies.ts';
import { ReefItemPalette } from '../../worlds/reef/sprites/items.ts';
import { ReefPalette } from '../../worlds/reef/sprites/palette.ts';
import { REEF_RACER_SHEETS } from '../../worlds/reef/sprites/racers.ts';
import { ThornwoodPalette } from '../../worlds/thornwood/sprites/palette.ts';
import { THORNWOOD_RACER_SHEETS } from '../../worlds/thornwood/sprites/racers.ts';
import { Frame, Tex } from '../keys.ts';
import { measureFrames, type NamedFrame } from '../pixel.ts';
import { GUIDE_SIZE } from './guide.ts';
import { ART_SHEETS } from './index.ts';

const sheetFor = (key: string) => ART_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);

describe('global art data', () => {
  it('draws only the HUD kick pip and the guide arrow, each once', () => {
    const keys = ART_SHEETS.map((sheet) => sheet.key);
    expect([...keys].sort()).toEqual([Tex.guideArrow, Tex.kickPip].sort());
  });

  it.each(ART_SHEETS.map((sheet) => [sheet.key, sheet] as const))('%s is well-formed pixel text', (key, sheet) => {
    expect(() => measureFrames(key, sheet.frames)).not.toThrow();
    for (const frame of sheet.frames) expect(frame.palette.length).toBeLessThanOrEqual(4);
  });

  it('gives the pip and the arrow the frame names their views ask for', () => {
    expect(frameNames(Tex.kickPip)).toEqual([Frame.pipReady, Frame.pipCooling]);
    expect(frameNames(Tex.guideArrow)).toEqual([Frame.guideStraight, Frame.guideDiagonal]);
  });

  it('draws the guide arrow on a square frame, so quarter turns land on the same pixels', () => {
    expect(measureFrames(Tex.guideArrow, sheetFor(Tex.guideArrow)?.frames ?? [])).toEqual({
      width: GUIDE_SIZE,
      height: GUIDE_SIZE,
    });
  });
});

describe('world art palettes', () => {
  /** WCAG relative luminance of a 0xRRGGBB colour. */
  const luminance = (colour: number) => {
    const linear = [16, 8, 0].map((shift) => {
      const c = ((colour >> shift) & 0xff) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const contrast = (a: number, b: number) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };
  // Global art goes on every course, so it stands off every theme's contrast bands.
  const behind = Object.values(THEMES).flatMap((theme) => theme.contrastBands.map((band) => band.colour));
  const readable = (colour: number) => Math.min(...behind.map((water) => contrast(colour, water))) >= 3;
  // Each world's cast is drawn on every course, so every skin's racers stand off every theme.
  const castPalettes = {
    reef: ReefPalette,
    thornwood: ThornwoodPalette,
    cloudreach: CloudreachPalette,
    farside: FarsidePalette,
  };
  const mainColours = [
    ...Object.entries(castPalettes).flatMap(([world, palettes]) =>
      CHARACTER_IDS.map((character) => [`${world} ${character}`, palettes[character][1]] as const),
    ),
    ['homing squid', ReefItemPalette.homingSquid[1]] as const,
    ['shark', ReefEnemyPalette.shark[1]] as const,
    ['eel', ReefEnemyPalette.eel[1]] as const,
    ['crab', ReefEnemyPalette.crab[1]] as const,
  ];

  it.each(mainColours)("%s main colour stands 3:1 off every theme's contrast bands", (_, colour) => {
    const weakest = Math.min(...behind.map((water) => contrast(colour, water)));
    expect(weakest).toBeGreaterThanOrEqual(3);
  });

  const racerFrames = [
    ...REEF_RACER_SHEETS,
    ...THORNWOOD_RACER_SHEETS,
    ...CLOUDREACH_RACER_SHEETS,
    ...FARSIDE_RACER_SHEETS,
  ].flatMap((sheet) => sheet.frames.map((frame) => [sheet.key, frame.name, frame] as const));
  const isBright = (frame: NamedFrame, pixel: string) => pixel !== '.' && readable(frame.palette[Number(pixel)] ?? 0);

  it.each(racerFrames)(
    '%s frame %s draws at least a quarter of its pixels in colours that stand 3:1 off the water',
    (_, __, frame) => {
      const pixels = [...frame.rows.join('')].filter((pixel) => pixel !== '.');
      const bright = pixels.filter((pixel) => isBright(frame, pixel));
      expect(bright.length / pixels.length).toBeGreaterThanOrEqual(0.25);
    },
  );

  // A racer whose readable pixels sit in one thin stripe reads as a line, not a body.
  it.each(racerFrames)('%s frame %s spreads its 3:1 colours over most of its height', (_, __, frame) => {
    const drawn = frame.rows.flatMap((row, y) => ([...row].some((pixel) => pixel !== '.') ? [y] : []));
    const bright = frame.rows.flatMap((row, y) => ([...row].some((pixel) => isBright(frame, pixel)) ? [y] : []));
    const span = Math.max(...bright) - Math.min(...bright) + 1;
    expect(span / (Math.max(...drawn) - Math.min(...drawn) + 1)).toBeGreaterThanOrEqual(0.6);
  });
});

describe('measureFrames', () => {
  const palette = [0x000000, 0xffffff];

  it('names the key, frame and row of a ragged row', () => {
    const frames = [{ name: 'a', palette, rows: ['01', '0', '10'] }];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" frame "a" row 1 is 1 px wide; expected 2. Pad or trim the row.',
    );
  });

  it('names the pixel that uses a colour the palette lacks', () => {
    const frames = [{ name: 'b', palette, rows: ['01', '02'] }];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" frame "b" row 1 col 1 uses "2", but its palette has 2 colours. Use "." or a digit from 0 to 1.',
    );
  });

  it('rejects characters that are neither "." nor a digit', () => {
    const frames = [{ name: 'a', palette, rows: ['0 '] }];
    expect(() => measureFrames('blob', frames)).toThrow('row 0 col 1 uses " "');
  });

  it('rejects two frames with the same name, which would overwrite each other in the texture', () => {
    const frames = [
      { name: 'a', palette, rows: ['01'] },
      { name: 'a', palette, rows: ['10'] },
    ];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" has two frames named "a"; give each frame its own name.',
    );
  });

  it('rejects frames of different heights in one sheet', () => {
    const frames = [
      { name: 'a', palette, rows: ['01', '10'] },
      { name: 'b', palette, rows: ['01'] },
    ];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" frame "b" is 1 rows tall; every frame must be 2 like the first.',
    );
  });
});
