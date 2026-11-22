import { describe, expect, it } from 'vitest';
import { raceOn, racerOf } from '../../logic/test-world.ts';
import { POWER_UP_KINDS } from '../../logic/types.ts';
import { ICON_SHEETS } from '../art/ui/icons.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { PanelPalette } from '../art/ui/palette.ts';
import {
  captionText,
  comboCentreY,
  isPlacePopping,
  NOT_READY_ALPHA,
  type PlaceTrack,
  POWER_UP_ICON,
  trackPlace,
  wellLayout,
} from './hud.ts';
import { promptText } from './threat-hud.ts';

describe('the place panel', () => {
  it('does not pop when the race starts, even though logic re-places everyone at GO', () => {
    const track: PlaceTrack = { shown: null, change: null };
    // Logic reports 1st through the countdown and 4th on the first racing tick.
    for (let tick = 0; tick < 180; tick++) trackPlace(track, 'countdown', 1, tick);
    expect(track.shown).toBeNull();
    trackPlace(track, 'racing', 4, 180);
    expect(track).toEqual({ shown: 4, change: null });
    expect(isPlacePopping(track, 181)).toBe(false);
  });

  it('pops for 30 ticks on each later change, up or down', () => {
    const track: PlaceTrack = { shown: null, change: null };
    trackPlace(track, 'racing', 4, 180);
    trackPlace(track, 'racing', 3, 300);
    expect(track.change).toEqual({ up: true, at: 300 });
    expect([isPlacePopping(track, 300), isPlacePopping(track, 329), isPlacePopping(track, 330)]).toEqual([
      true,
      true,
      false,
    ]);
    trackPlace(track, 'racing', 4, 400);
    expect(track.change).toEqual({ up: false, at: 400 });
    // Holding a place doesn't restart the pop.
    trackPlace(track, 'racing', 4, 410);
    expect(track.change).toEqual({ up: false, at: 400 });
  });
});

describe('the combo name', () => {
  const clearOfPlayer = (playerY: number, height: number) => {
    const centre = comboCentreY(playerY, height);
    const top = centre - Math.ceil(height / 2);
    const bottom = centre + Math.ceil(height / 2);
    return bottom <= playerY - 16 || top >= playerY + 16;
  };

  it.each([
    ['above a player low on screen', 120, 12, 'above'],
    ['below a player high on screen', 60, 12, 'below'],
    ['above a player at the screen centre', 90, 12, 'above'],
    ['above a player at the bottom edge', 170, 7, 'above'],
  ])('sits %s', (_case, playerY, height, side) => {
    const centre = comboCentreY(playerY, height);
    expect(centre < playerY ? 'above' : 'below').toBe(side);
    expect(clearOfPlayer(playerY, height)).toBe(true);
  });

  it('stays under the caption line and above the bottom margin wherever the player is', () => {
    for (let playerY = 0; playerY <= 180; playerY++) {
      for (const height of [7, 12]) {
        const centre = comboCentreY(playerY, height);
        expect(centre - Math.ceil(height / 2), `player at ${playerY}`).toBeGreaterThanOrEqual(50);
        expect(centre + Math.ceil(height / 2), `player at ${playerY}`).toBeLessThanOrEqual(174);
      }
    }
  });
});

describe('the kick and power-up well', () => {
  it('frames three slots after kick and burst for a racer who holds three', () => {
    expect(wellLayout(3)).toEqual({ width: 61, slotX: [92, 103, 114] });
  });

  it('grows by one slot for a racer who holds four, like Nib', () => {
    const { width, slotX } = wellLayout(4);
    expect(slotX).toEqual([92, 103, 114, 125]);
    // The panel keeps 1 px padding and its 3 px frame past the fourth icon (x 125-133).
    expect(66 + width - 1).toBe(137);
    // It stays left of the back link (x 248 and right), and the d-pad zone starts at y 76, below it.
    expect(66 + width).toBeLessThan(248);
  });
});

describe('a dimmed well icon', () => {
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
  /** `colour` drawn at `alpha` over `under`, per channel, as the renderer blends it. */
  const blend = (colour: number, under: number, alpha: number) =>
    [16, 8, 0].reduce((sum, shift) => {
      const c = (colour >> shift) & 0xff;
      const u = (under >> shift) & 0xff;
      return sum | (Math.round(c * alpha + u * (1 - alpha)) << shift);
    }, 0);
  const well = PanelPalette.inset[2];
  const frames = ICON_SHEETS.find((sheet) => sheet.key === UiTex.icons)?.frames ?? [];

  // The silhouette of each icon that dims: its rim (index 0) and main fill (index 1).
  it.each([IconFrame.kick, IconFrame.burst])('%s keeps 3:1 against the well when not ready', (name) => {
    const palette = frames.find((frame) => frame.name === name)?.palette ?? [];
    expect(palette.length).toBeGreaterThan(1);
    for (const colour of palette.slice(0, 2)) {
      const dimmed = blend(colour, well, NOT_READY_ALPHA);
      expect(contrast(dimmed, well), `#${colour.toString(16)}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the well\u2019s power-up icons', () => {
  const frames = ICON_SHEETS.find((sheet) => sheet.key === UiTex.icons)?.frames ?? [];

  it('draws an icon for every kind, and no two kinds share one', () => {
    const drawn = new Set(frames.map((frame) => frame.name));
    for (const kind of POWER_UP_KINDS) expect(drawn.has(POWER_UP_ICON[kind]), kind).toBe(true);
    expect(new Set(POWER_UP_KINDS.map((kind) => POWER_UP_ICON[kind])).size).toBe(POWER_UP_KINDS.length);
  });
});

describe('the squid warnings on the HUD', () => {
  const ARENA = `
    ####################
    #1................F#
    #2................F#
    #3................F#
    #4................F#
    ####################
  `;
  const view = { contains: () => true, centerX: 0, centerY: 0 };
  const lockedOnPlayer = () => {
    const { world } = raceOn(ARENA);
    world.squids.push({ x: 90, y: 40, vx: 0, vy: 0, ttl: 100, owner: 'tess', target: { kind: 'racer', id: 'player' } });
    return world;
  };

  it('says LOCKED ON! while a squid is locked on the player, and nothing before', () => {
    expect(captionText(raceOn(ARENA).world, view)).toBe('');
    expect(captionText(lockedOnPlayer(), view)).toBe('LOCKED ON!');
  });

  it('does not say it for a squid chasing a rival', () => {
    const { world } = raceOn(ARENA);
    world.squids.push({ x: 90, y: 40, vx: 0, vy: 0, ttl: 100, owner: 'tess', target: { kind: 'racer', id: 'bo' } });
    expect(captionText(world, view)).toBe('');
  });

  it('leaves the caption to the KICK! prompt while a squid is latched, and prompts', () => {
    const world = lockedOnPlayer();
    racerOf(world, 'player').status.latched = 100;
    expect(captionText(world, view)).toBe('');
    expect(promptText(world, false)).toEqual({ headline: 'KICK!', hint: '' });
  });

  it('adds PRESS A on a touch screen, and prompts nothing when not latched', () => {
    const world = lockedOnPlayer();
    expect(promptText(world, true)).toEqual({ headline: '', hint: '' });
    racerOf(world, 'player').status.latched = 100;
    expect(promptText(world, true)).toEqual({ headline: 'KICK!', hint: 'PRESS A' });
  });

  it('lets a trapped player see TRAPPED! rather than LOCKED ON!', () => {
    const world = lockedOnPlayer();
    racerOf(world, 'player').status.trapped = 30;
    expect(captionText(world, view)).toBe('TRAPPED!');
  });
});
