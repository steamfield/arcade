import { describe, expect, it } from 'vitest';
import { HOW_TO_PLAY_PAGES, turnPage } from './how-to-play.ts';

const FIRST = 0;
const LAST = HOW_TO_PLAY_PAGES - 1;
const page = (n: number) => ({ kind: 'page', page: n });
const LEAVE = { kind: 'leave' };

describe('turning How to Play pages', () => {
  it('moves forward with A or right and back with B or left from a middle page', () => {
    expect(turnPage(2, 'kick')).toEqual(page(3));
    expect(turnPage(2, 'right')).toEqual(page(3));
    expect(turnPage(2, 'burst')).toEqual(page(1));
    expect(turnPage(2, 'left')).toEqual(page(1));
  });

  it('leaves only with B on the first page', () => {
    expect(turnPage(FIRST, 'burst')).toEqual(LEAVE);
    expect(turnPage(FIRST, 'left')).toEqual(page(FIRST));
    expect(turnPage(FIRST, 'kick')).toEqual(page(1));
  });

  it('leaves only with A on the last page', () => {
    expect(turnPage(LAST, 'kick')).toEqual(LEAVE);
    expect(turnPage(LAST, 'right')).toEqual(page(LAST));
    expect(turnPage(LAST, 'burst')).toEqual(page(LAST - 1));
  });
});
