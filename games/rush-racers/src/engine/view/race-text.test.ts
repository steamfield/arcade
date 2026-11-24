import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE } from '../../logic/courses/index.ts';
import {
  countdownRects,
  levelBanner,
  noteSplashMoments,
  type SplashClock,
  type SplashMoments,
  slideRemaining,
  splashFrame,
  standingsRow,
} from './race-text.ts';

const NONE: SplashMoments = { stretchAt: null, endedAt: null };
const countdown = (raceTick: number): SplashClock => ({
  tick: raceTick,
  race: { phase: 'countdown', raceTick, result: null },
  localFinished: false,
});
/** A race that started on world tick 180, `raceTick` ticks ago. */
const racing = (raceTick: number): SplashClock => ({
  tick: 180 + raceTick,
  race: { phase: 'racing', raceTick, result: null },
  localFinished: false,
});
/** A finished race in which slot 1 took `playerTicks` (null for no time) and the local racer did or did not cross. */
const finished = (tick: number, playerTicks: number | null, localFinished = playerTicks !== null): SplashClock => ({
  tick,
  race: { phase: 'finished', raceTick: 900, result: { standings: [], playerPlace: 1, playerTicks } },
  localFinished,
});

describe('the race splash', () => {
  it.each([
    [0, '3', -6],
    [3, '3', -3],
    [59, '3', 0],
    [60, '2', -6],
    [179, '1', 0],
  ])('counts down: at countdown tick %i it shows %s, %i px from rest', (raceTick, text, dy) => {
    expect(splashFrame(countdown(raceTick), NONE, false)).toEqual({ text, tone: 'foam', dx: 0, dy });
  });

  it('slides GO in from the right, holds it, and hides it 53 ticks after the start', () => {
    expect(splashFrame(racing(0), NONE, false)).toEqual({ text: 'GO!', tone: 'sun', dx: 12, dy: 0 });
    expect(splashFrame(racing(8), NONE, false)).toMatchObject({ text: 'GO!', dx: 0 });
    expect(splashFrame(racing(52), NONE, false).text).toBe('GO!');
    expect(splashFrame(racing(53), NONE, false).text).toBe('');
  });

  it('shows FINAL STRETCH once, from the tick the race first crosses three quarters', () => {
    const moments: SplashMoments = { stretchAt: null, endedAt: null };
    noteSplashMoments(moments, 'racing', 400, 0.74);
    expect(moments.stretchAt).toBeNull();
    noteSplashMoments(moments, 'racing', 500, 0.75);
    // Falling back under and crossing again (a knock back) doesn't restart it.
    noteSplashMoments(moments, 'racing', 520, 0.7);
    noteSplashMoments(moments, 'racing', 540, 0.8);
    expect(moments.stretchAt).toBe(500);
    const at = (tick: number) => splashFrame({ ...racing(tick - 180) }, moments, false).text;
    expect([at(500), at(552), at(553), at(700)]).toEqual(['FINAL STRETCH', 'FINAL STRETCH', '', '']);
  });

  it('shows FINISH over a FINAL STRETCH still on screen', () => {
    const moments: SplashMoments = { stretchAt: 900, endedAt: 910 };
    expect(splashFrame(finished(910, 700), moments, false)).toEqual({ text: 'FINISH', tone: 'sun', dx: 12, dy: 0 });
  });

  it('says TIME UP in foam when the player did not finish', () => {
    const moments: SplashMoments = { stretchAt: null, endedAt: 2000 };
    noteSplashMoments(moments, 'finished', 2005, 0.2);
    expect(moments.endedAt).toBe(2000);
    expect(splashFrame(finished(2010, null), moments, false)).toEqual({ text: 'TIME UP', tone: 'foam', dx: 0, dy: 0 });
  });

  it('says TIME UP when slot 1 finished but the local racer did not', () => {
    const moments: SplashMoments = { stretchAt: null, endedAt: 2000 };
    expect(splashFrame(finished(2010, 700, false), moments, false)).toEqual({
      text: 'TIME UP',
      tone: 'foam',
      dx: 0,
      dy: 0,
    });
  });

  it('puts every splash in place at once under reduced motion', () => {
    expect(splashFrame(countdown(0), NONE, true).dy).toBe(0);
    expect(splashFrame(racing(0), NONE, true).dx).toBe(0);
    expect(splashFrame(finished(910, 700), { stretchAt: null, endedAt: 910 }, true).dx).toBe(0);
    expect(slideRemaining(0, 8, 6, true)).toBe(0);
  });

  it('slides evenly from the full distance to rest', () => {
    expect([0, 3, 5, 6, 40].map((age) => slideRemaining(age, 8, 6, false))).toEqual([8, 4, 1, 0, 0]);
  });
});

describe('a results row', () => {
  const finishedAt = (ticks: number) => ({ finished: { tick: ticks } });

  it('keeps a six-letter name apart from a time over a minute', () => {
    expect(standingsRow({ character: 'streak', ...finishedAt(11030) }, 2, DEFAULT_COURSE)).toBe('2ND STREAK 3:03.83');
    expect(standingsRow({ character: 'selene', ...finishedAt(11030) }, 3, DEFAULT_COURSE)).toBe('3RD SELENE 3:03.83');
  });

  it('lines the times up whatever the name, and stays 18 characters (UI.md rows are 107 px)', () => {
    const rows = [
      standingsRow({ character: 'onyx', ...finishedAt(5400) }, 1, DEFAULT_COURSE),
      standingsRow({ character: 'baron', ...finishedAt(5400) }, 4, DEFAULT_COURSE),
      standingsRow({ character: 'rudy', finished: null }, 4, DEFAULT_COURSE),
    ];
    expect(rows).toEqual(['1ST ONYX   1:30.00', '4TH BARON  1:30.00', '4TH RUDY   TIME UP']);
    for (const row of rows) expect(row).toHaveLength(18);
  });
});

describe('the countdown level banner', () => {
  const world = (difficulty: 'easy' | 'normal' | 'hard', phase: 'countdown' | 'racing') => ({
    difficulty,
    race: { phase },
  });

  it.each([
    ['easy', 'EASY', 1],
    ['normal', 'NORMAL', 2],
    ['hard', 'HARD', 3],
  ] as const)('names %s with %i lit pips while counting down', (difficulty, text, pips) => {
    expect(levelBanner(world(difficulty, 'countdown'))).toEqual({ text, pips });
  });

  it('is gone once the race is running', () => {
    expect(levelBanner(world('hard', 'racing'))).toBeNull();
  });
});

describe('where the countdown draws', () => {
  /** Whether `rect` covers the span x0-x1, y0-y1 (inclusive pixel edges, as UI.md gives them). */
  const covers = (
    rect: { x: number; y: number; w: number; h: number },
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => rect.x <= x0 && rect.y <= y0 && rect.x + rect.w >= x1 && rect.y + rect.h >= y1;

  it('covers the numeral from the top of its drop to rest, the level word and the pips (UI.md, base view)', () => {
    const [numeral, word, pips] = countdownRects(160);

    // The numeral centres on y 62 at 2x (50-74) and drops 6 px in.
    expect(numeral && covers(numeral, 152, 44, 168, 74)).toBe(true);
    // NORMAL, the widest level word, centred on (160, 88).
    expect(word && covers(word, 135, 82, 185, 94)).toBe(true);
    expect(pips && covers(pips, 147, 98, 173, 104)).toBe(true);
  });

  it('follows the view centre on a wider view', () => {
    const shift = 50;
    const moved = countdownRects(160 + shift);
    expect(moved).toEqual(countdownRects(160).map((rect) => ({ ...rect, x: rect.x + shift })));
  });
});
