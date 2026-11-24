import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { LIGHTNING } from '../../../logic/hazards/tuning.ts';
import { TILE } from '../../../logic/types.ts';
import { stormLook, ticksIntoPhase } from './lightning-view.ts';
import { cameraSpan, zoneSide } from './storm-reach.ts';

describe('how a storm zone looks through its cycle', () => {
  it('shows nothing while calm', () => {
    expect(stormLook('calm', 30, false)).toEqual({
      shadeAlpha: 0,
      shimmerAlpha: 0,
      cloudAlpha: 0,
      boltVisible: false,
      boltFlipped: false,
    });
  });

  it('darkens and shimmers more as the warning goes on, with no bolt yet', () => {
    const early = stormLook('warning', 0, false);
    const late = stormLook('warning', LIGHTNING.warnTicks - 1, false);
    expect(early.shadeAlpha).toBeGreaterThan(0);
    expect(early.shimmerAlpha).toBeGreaterThan(0);
    expect(late.shadeAlpha).toBeGreaterThan(early.shadeAlpha);
    expect(late.cloudAlpha).toBeGreaterThan(early.cloudAlpha);
    expect(late.boltVisible).toBe(false);
  });

  it('shows a bolt that crackles during a strike, and a still one under reduced motion', () => {
    const beats = Array.from({ length: LIGHTNING.strikeTicks }, (_, tick) => stormLook('strike', tick, false));
    expect(beats.every((look) => look.boltVisible)).toBe(true);
    expect(new Set(beats.map((look) => look.boltFlipped))).toEqual(new Set([true, false]));
    const still = Array.from({ length: LIGHTNING.strikeTicks }, (_, tick) => stormLook('strike', tick, true));
    expect(still.every((look) => look.boltVisible && !look.boltFlipped)).toBe(true);
  });
});

describe('how far a storm zone is into its phase', () => {
  // Period 150: calm for ticks 0-92 of each cycle, warning 93-137, strike 138-149.
  const zone = { cols: [4, 6] as [number, number], periodTicks: 150, offsetTicks: 0 };

  it('counts from the start of the warning and of the strike, in every cycle', () => {
    expect(ticksIntoPhase(zone, 93, 'warning')).toBe(0);
    expect(ticksIntoPhase(zone, 137, 'warning')).toBe(LIGHTNING.warnTicks - 1);
    expect(ticksIntoPhase(zone, 138, 'strike')).toBe(0);
    expect(ticksIntoPhase(zone, 150 + 140, 'strike')).toBe(2);
    expect(ticksIntoPhase(zone, 40, 'calm')).toBe(0);
  });

  it('picks up a warning already under way at the start, so a view built mid-warning does not restart the darkening', () => {
    // The race starts 113 ticks into the cycle: 20 ticks into the warning.
    const midWarning = { ...zone, offsetTicks: 113 };
    expect(ticksIntoPhase(midWarning, 0, 'warning')).toBe(20);
    const atStart = stormLook('warning', ticksIntoPhase(midWarning, 0, 'warning'), false);
    expect(atStart.shadeAlpha).toBeGreaterThan(stormLook('warning', 0, false).shadeAlpha);
    expect(atStart.shadeAlpha).toBeLessThan(stormLook('strike', 0, false).shadeAlpha);
  });
});

describe('what the camera shows', () => {
  it("reads this frame's scroll, not the view Phaser last rendered, which lags a moving camera", () => {
    const camera = {
      scrollX: 480,
      scrollY: 96,
      width: 428,
      worldView: { x: 400, y: 60, width: 428 },
    } as unknown as Phaser.Cameras.Scene2D.Camera;
    expect(cameraSpan(camera)).toEqual({ x: 480, y: 96, width: 428 });
  });
});

describe('where a storm zone sits across from the camera', () => {
  // A 320 px view from x = 1600 to 1920 (tile columns 100-119).
  const view = { x: 100 * TILE, width: 320 };
  const zone = (from: number, to: number) => ({
    cols: [from, to] as [number, number],
    periodTicks: 150,
    offsetTicks: 0,
  });

  it('is on screen when any column is in view, even one at either edge', () => {
    expect(zoneSide(zone(105, 109), view)).toBe('on screen');
    expect(zoneSide(zone(95, 100), view)).toBe('on screen');
    expect(zoneSide(zone(119, 123), view)).toBe('on screen');
  });

  it('is beside the edge it is just past, up to a screen width away', () => {
    expect(zoneSide(zone(120, 124), view)).toBe('right');
    expect(zoneSide(zone(140, 144), view)).toBe('right');
    expect(zoneSide(zone(95, 99), view)).toBe('left');
    expect(zoneSide(zone(76, 79), view)).toBe('left');
  });

  it('is far once more than a screen width beyond either edge', () => {
    expect(zoneSide(zone(141, 145), view)).toBe('far');
    expect(zoneSide(zone(70, 78), view)).toBe('far');
  });
});
