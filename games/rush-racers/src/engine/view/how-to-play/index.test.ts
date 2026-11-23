import { describe, expect, it } from 'vitest';
import { SKINS } from '../../worlds/index.ts';
import { MEDIUM_PAGES, mediumPagesFor, pageSpecsFor } from './index.ts';

/** The headings a medium's pages show, in order, for a world's skin on a keyboard. */
function headingsFor(medium: string, world: keyof typeof SKINS): string[] {
  return pageSpecsFor(medium).map((page) => page.heading(false, SKINS[world]));
}

describe("How to Play's pages per medium", () => {
  it('explains swimming and dashing on a swim course', () => {
    expect(mediumPagesFor('swim')).toBe(MEDIUM_PAGES.swim);
    const headings = headingsFor('swim', 'reef');
    expect(headings[0]).toBe('SWIM AND DASH');
    expect(headings[1]).toBe('OPEN CLAMS');
    expect(headings[3]).toBe('GRAB PEARLS');
    expect(headings[4]).toBe('DASH TO BONK');
  });

  it('teaches running, bumping crates from below and stomping on a run course, in Thornwood words', () => {
    const headings = headingsFor('run', 'thornwood');
    expect(headings[0]).toBe('RUN AND JUMP');
    expect(headings[1]).toBe('HIT CRATES');
    expect(headings[3]).toBe('GRAB ACORNS');
    expect(headings[4]).toBe('JUMP TO STOMP');
  });

  it("falls back to swim's pages for a medium that hasn't shipped", () => {
    expect(mediumPagesFor('glide')).toBe(MEDIUM_PAGES.swim);
    expect(mediumPagesFor('toString')).toBe(MEDIUM_PAGES.swim);
  });
});
