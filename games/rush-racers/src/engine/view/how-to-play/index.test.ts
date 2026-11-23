import { configureLogging, type LogEntry } from '@arcade/core';
import { afterEach, describe, expect, it } from 'vitest';
import { HOW_TO_PLAY_PAGES } from '../../how-to-play.ts';
import { SKINS } from '../../worlds/index.ts';
import { MEDIUM_PAGES, mediumPagesFor, pageSpecsFor } from './index.ts';

/** The headings a medium's pages show, in order, for a world's skin on a keyboard. */
function headingsFor(medium: string, world: keyof typeof SKINS): string[] {
  return pageSpecsFor(medium).map((page) => page.heading(false, SKINS[world]));
}

afterEach(() => configureLogging(() => {}));

describe("How to Play's pages per medium", () => {
  it('explains swimming and dashing on a swim course', () => {
    expect(mediumPagesFor('swim')).toBe(MEDIUM_PAGES.swim);
    const headings = headingsFor('swim', 'reef');
    expect(headings[0]).toBe('SWIM AND DASH');
    expect(headings[1]).toBe('OPEN CLAMS');
    expect(headings[3]).toBe('GRAB PEARLS');
    expect(headings[4]).toBe('DASH TO BONK');
    expect(headings[6]).toBe('DASH TO DODGE');
  });

  it('teaches running, bumping crates from below and stomping on a run course, in Thornwood words', () => {
    const headings = headingsFor('run', 'thornwood');
    expect(headings[0]).toBe('RUN AND JUMP');
    expect(headings[1]).toBe('HIT CRATES');
    expect(headings[3]).toBe('GRAB ACORNS');
    expect(headings[4]).toBe('JUMP TO STOMP');
  });

  it('shows a shield stopping the bee on a run course, since a dash there dodges nothing, on the same page count', () => {
    const headings = headingsFor('run', 'thornwood');
    expect(headings[6]).toBe('SHIELD STOPS THE BEE');
    expect(headings).toHaveLength(HOW_TO_PLAY_PAGES);
    expect(headings).not.toContain('DASH TO DODGE');
  });

  it("falls back to swim's pages for a medium that hasn't shipped, warning once per medium", () => {
    const warnings: string[] = [];
    configureLogging((entry: LogEntry) => {
      if (entry.level === 'warn') warnings.push(entry.message);
    });
    expect(mediumPagesFor('glide')).toBe(MEDIUM_PAGES.swim);
    expect(mediumPagesFor('glide')).toBe(MEDIUM_PAGES.swim);
    expect(mediumPagesFor('toString')).toBe(MEDIUM_PAGES.swim);
    expect(warnings).toEqual([
      "How to Play has no pages for medium 'glide': showing swim's",
      "How to Play has no pages for medium 'toString': showing swim's",
    ]);
  });
});
