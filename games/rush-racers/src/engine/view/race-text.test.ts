import { describe, expect, it } from 'vitest';
import {
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
});
/** A race that started on world tick 180, `raceTick` ticks ago. */
const racing = (raceTick: number): SplashClock => ({
  tick: 180 + raceTick,
  race: { phase: 'racing', raceTick, result: null },
});
const finished = (tick: number, playerTicks: number | null): SplashClock => ({
  tick,
  race: { phase: 'finished', raceTick: 900, result: { standings: [], playerPlace: 1, playerTicks } },
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
    expect(standingsRow({ character: 'streak', ...finishedAt(11030) }, 2)).toBe('2ND STREAK 3:03.83');
    expect(standingsRow({ character: 'selene', ...finishedAt(11030) }, 3)).toBe('3RD SELENE 3:03.83');
  });

  it('lines the times up whatever the name, and stays 18 characters (UI.md rows are 107 px)', () => {
    const rows = [
      standingsRow({ character: 'onyx', ...finishedAt(5400) }, 1),
      standingsRow({ character: 'baron', ...finishedAt(5400) }, 4),
      standingsRow({ character: 'rudy', finished: null }, 4),
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
