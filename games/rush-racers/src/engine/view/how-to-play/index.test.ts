import { describe, expect, it } from 'vitest';
import { MOVE_PAGES, movePageFor } from './index.ts';

describe("How to Play's move page", () => {
  it('explains swimming and dashing on a swim course', () => {
    expect(movePageFor('swim')).toBe(MOVE_PAGES.swim);
    expect(MOVE_PAGES.swim.heading).toBe('SWIM AND DASH');
  });

  it("falls back to swim's page for a medium that hasn't shipped", () => {
    expect(movePageFor('glide')).toBe(MOVE_PAGES.swim);
    expect(movePageFor('toString')).toBe(MOVE_PAGES.swim);
  });
});
