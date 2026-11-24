import { describe, expect, it } from 'vitest';
import { VENT, ventPhase } from '../../logic/setpieces/vents.ts';
import type { VentDef } from '../../logic/types.ts';
import { measureFrames } from '../art/pixel.ts';
import { OCEAN_VENT_ART } from '../themes/ocean/vent-art.ts';
import { ticksIntoVentPhase, ventLook } from './vent-view.ts';

const LAST_WARNING_TICK = VENT.warnTicks - 1;
const LAST_ERUPTION_TICK = VENT.eruptTicks - 1;

describe('how a vent looks through its cycle', () => {
  it('shows only the fissure while quiet', () => {
    expect(ventLook('quiet', 30, false)).toEqual({ glowAlpha: 0, columnAlpha: 0, rise: 0 });
  });

  it('glows brighter as the warning goes on, flickering on a beat, with no column yet', () => {
    const beats = Array.from({ length: VENT.warnTicks }, (_, tick) => ventLook('warning', tick, false));

    expect(beats.every((look) => look.glowAlpha > 0 && look.columnAlpha === 0)).toBe(true);
    expect(ventLook('warning', 0, false).glowAlpha).toBeLessThan(ventLook('warning', 40, false).glowAlpha);
    const steps = beats.slice(1).map((look, tick) => Math.sign(look.glowAlpha - (beats[tick]?.glowAlpha ?? 0)));
    expect(new Set(steps)).toEqual(new Set([1, -1]));
  });

  it('warns without flickering under reduced motion', () => {
    const beats = Array.from({ length: VENT.warnTicks }, (_, tick) => ventLook('warning', tick, true).glowAlpha);

    expect(beats.every((alpha, tick) => tick === 0 || alpha >= (beats[tick - 1] ?? 0))).toBe(true);
    // Tick 40 is on a bright beat, so the steady glow matches the flickering one there.
    expect(beats[40]).toBeCloseTo(ventLook('warning', 40, false).glowAlpha);
  });

  it('surges the column in, holds it, and lets it die away by the end of the eruption', () => {
    const column = (tick: number) => ventLook('erupting', tick, false).columnAlpha;

    expect(column(0)).toBeGreaterThan(0);
    expect(column(0)).toBeLessThan(column(10));
    expect(column(10)).toBe(column(40));
    expect(column(LAST_ERUPTION_TICK)).toBeLessThan(column(40));
    expect(column(LAST_ERUPTION_TICK)).toBeGreaterThan(0);
  });

  it('rushes the bubbles up with the ticks, and holds them still under reduced motion with the same column', () => {
    const moving = [0, 1, 30].map((tick) => ventLook('erupting', tick, false));
    const still = [0, 1, 30].map((tick) => ventLook('erupting', tick, true));

    expect(moving.map((look) => look.rise)).toEqual([0, 6, 180]);
    expect(still.map((look) => look.rise)).toEqual([0, 0, 0]);
    expect(still.map((look) => look.columnAlpha)).toEqual(moving.map((look) => look.columnAlpha));
  });
});

describe('how far a vent is into its phase', () => {
  // Period 200, offset 20: warning on race ticks 0-24 and 180-224, eruption 25-84 and 225-284, quiet 85-179.
  const vent: VentDef = { col: 4, row: 8, height: 5, periodTicks: 200, offsetTicks: 20 };
  const into = (raceTick: number) => ticksIntoVentPhase(vent, raceTick, ventPhase(vent, raceTick));

  it('counts from the first tick of each phase, picking up mid-cycle', () => {
    expect([180, 199, 224].map(into)).toEqual([0, 19, LAST_WARNING_TICK]);
    expect([25, 84, 225, 284].map(into)).toEqual([0, LAST_ERUPTION_TICK, 0, LAST_ERUPTION_TICK]);
    expect([0, 85, 120, 179].map(into)).toEqual([20, 0, 0, 0]);
  });
});

describe("the ocean's vent art", () => {
  it('is three well-formed frames of one tile each', () => {
    const { crack, glow, bubbles } = OCEAN_VENT_ART;

    expect(measureFrames(OCEAN_VENT_ART.texture, [crack, glow, bubbles])).toEqual({ width: 16, height: 16 });
    expect([crack, glow, bubbles].map((frame) => frame.name)).toEqual(['crack', 'glow', 'bubbles']);
  });
});
