import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { courseFromLevel, raceOn, racerOf } from '../../logic/test-world.ts';
import { POWER_UP_KINDS } from '../../logic/types.ts';
import { createWorld } from '../../logic/world.ts';
import { Frame } from '../art/keys.ts';
import { iconSheets } from '../art/ui/icons.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { PanelPalette } from '../art/ui/palette.ts';
import { REEF_ITEM_ICON_FRAMES } from '../worlds/reef/sprites/icons.ts';
import { REEF_SKIN } from '../worlds/reef.ts';
import { besidePlayerY } from './beside-player.ts';
import { captionText, isPlacePopping, type PlaceTrack, pearlText, trackPlace } from './hud.ts';
import {
  type ChargeTrack,
  chargeText,
  dashPipFrames,
  NOT_READY_ALPHA,
  pipScale,
  trackDashCharges,
  wellLayout,
} from './hud-well.ts';
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

describe('text beside the player', () => {
  const clearOfPlayer = (playerY: number, height: number) => {
    const centre = besidePlayerY(playerY, height);
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
    const centre = besidePlayerY(playerY, height);
    expect(centre < playerY ? 'above' : 'below').toBe(side);
    expect(clearOfPlayer(playerY, height)).toBe(true);
  });

  it('stays under the caption line and above the bottom margin wherever the player is', () => {
    for (let playerY = 0; playerY <= 180; playerY++) {
      for (const height of [7, 12]) {
        const centre = besidePlayerY(playerY, height);
        expect(centre - Math.ceil(height / 2), `player at ${playerY}`).toBeGreaterThanOrEqual(50);
        expect(centre + Math.ceil(height / 2), `player at ${playerY}`).toBeLessThanOrEqual(174);
      }
    }
  });
});

describe('the dash and item well', () => {
  it('frames three item slots after the dash icon for a racer with three slots', () => {
    expect(wellLayout(3)).toEqual({ width: 71, slotX: [86, 102, 118] });
  });

  it('grows by one slot for a racer with four, like Nib', () => {
    const { width, slotX } = wellLayout(4);
    expect(slotX).toEqual([86, 102, 118, 134]);
    // The panel keeps 1 px padding and its 3 px frame past the fourth slot's digit (x 144-148).
    expect(66 + width - 1).toBe(152);
    // It stays left of the back link (x 248 and right), and the d-pad zone starts at y 76, below it.
    expect(66 + width).toBeLessThan(248);
  });

  it('shows a held item\u2019s charges as one digit and nothing for an empty slot', () => {
    expect([chargeText({ kind: 'jetFin', charges: 3 }), chargeText(null)]).toEqual(['3', '']);
  });
});

describe('the dash meter', () => {
  it('shows a filled pip per charge held and a hollow one per charge spent', () => {
    expect([2, 1, 0].map((charges) => dashPipFrames(charges))).toEqual([
      [Frame.pipReady, Frame.pipReady],
      [Frame.pipReady, Frame.pipCooling],
      [Frame.pipCooling, Frame.pipCooling],
    ]);
  });

  it('swells the pip that comes back, over 12 ticks, and not at the first frame or when one is spent', () => {
    const track: ChargeTrack = { shown: null, refilled: null };
    trackDashCharges(track, 2, 100);
    expect(pipScale(track, 1, 100, false)).toBe(1);
    trackDashCharges(track, 1, 110);
    expect(pipScale(track, 1, 110, false)).toBe(1);
    trackDashCharges(track, 2, 200);
    const scales = [200, 206, 211, 212].map((tick) => pipScale(track, 1, tick, false));
    expect(scales[0]).toBeCloseTo(1.6);
    expect(scales[1]).toBeCloseTo(1.3);
    expect(scales[2]).toBeGreaterThan(1);
    expect(scales[3]).toBe(1);
    // Only the pip that came back swells.
    expect(pipScale(track, 0, 200, false)).toBe(1);
    // Spending it mid-swell ends the swell.
    trackDashCharges(track, 1, 203);
    expect(pipScale(track, 1, 203, false)).toBe(1);
  });

  it('holds still under reduced motion', () => {
    const track: ChargeTrack = { shown: 0, refilled: null };
    trackDashCharges(track, 1, 50);
    expect(pipScale(track, 0, 50, true)).toBe(1);
    expect(pipScale(track, 0, 50, false)).toBeGreaterThan(1);
  });
});

describe('the pearl counter', () => {
  it('shows the count, and stops at 99', () => {
    expect([0, 7, 99, 100, 250].map(pearlText)).toEqual(['0', '7', '99', '99', '99']);
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
  const frames = iconSheets(REEF_ITEM_ICON_FRAMES).find((sheet) => sheet.key === UiTex.icons)?.frames ?? [];

  // The silhouette of each icon that dims: its rim (index 0) and main fill (index 1).
  it.each([IconFrame.dash])('%s keeps 3:1 against the well when not ready', (name) => {
    const palette = frames.find((frame) => frame.name === name)?.palette ?? [];
    expect(palette.length).toBeGreaterThan(1);
    for (const colour of palette.slice(0, 2)) {
      const dimmed = blend(colour, well, NOT_READY_ALPHA);
      expect(contrast(dimmed, well), `#${colour.toString(16)}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the well\u2019s power-up icons', () => {
  const frames = iconSheets(REEF_ITEM_ICON_FRAMES).find((sheet) => sheet.key === UiTex.icons)?.frames ?? [];

  it('draws an icon for every kind, and no two kinds share one', () => {
    const drawn = new Set(frames.map((frame) => frame.name));
    const { itemIcons } = REEF_SKIN.objects;
    for (const kind of POWER_UP_KINDS) {
      expect(itemIcons[kind].texture, kind).toBe(UiTex.icons);
      expect(drawn.has(itemIcons[kind].frame), kind).toBe(true);
    }
    expect(new Set(POWER_UP_KINDS.map((kind) => itemIcons[kind].frame)).size).toBe(POWER_UP_KINDS.length);
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

  it('leaves the caption to the DASH! prompt while a squid is latched, and prompts', () => {
    const world = lockedOnPlayer();
    racerOf(world, 'player').status.latched = 100;
    expect(captionText(world, view)).toBe('');
    expect(promptText(world, false)).toEqual({ headline: 'DASH!', hint: '' });
  });

  it('keeps its caption while latched where a dash cannot shake the latch, since no DASH! prompt shows there', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(ARENA, 'run'), log, { seed: 1 });
    world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
    world.squids.push({ x: 90, y: 40, vx: 0, vy: 0, ttl: 100, owner: 'tess', target: { kind: 'racer', id: 'player' } });
    racerOf(world, 'player').status.latched = 100;
    expect([captionText(world, view), promptText(world, false).headline]).toEqual(['LOCKED ON!', '']);
  });

  it('adds PRESS B on a touch screen, and prompts nothing when not latched', () => {
    const world = lockedOnPlayer();
    expect(promptText(world, true)).toEqual({ headline: '', hint: '' });
    racerOf(world, 'player').status.latched = 100;
    expect(promptText(world, true)).toEqual({ headline: 'DASH!', hint: 'PRESS B' });
  });

  it('lets a trapped player see TRAPPED! rather than LOCKED ON!', () => {
    const world = lockedOnPlayer();
    racerOf(world, 'player').status.trapped = 30;
    expect(captionText(world, view)).toBe('TRAPPED!');
  });

  it('shows no caption while the player has fallen, even when stunned and locked on', () => {
    const world = lockedOnPlayer();
    const player = racerOf(world, 'player');
    player.status.stunned = 30;
    player.status.fallen = 20;
    expect(captionText(world, view)).toBe('');
  });
});
