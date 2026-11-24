/**
 * How race facts read on screen: times as m:ss.cc, places as "2nd", each
 * racer's display name, a results row, and the race's big splashes (the 3-2-1 countdown,
 * GO, FINAL STRETCH, FINISH, TIME UP) in the outlined display face over the water. The
 * HUD, title and results all format and slide text through here so the same
 * fact always reads, and moves, the same way.
 *
 * Splash motion follows UI.md: a countdown numeral drops 6 px in over 6 ticks;
 * GO, FINAL STRETCH and FINISH slide 12 px in from the right over 8 ticks and
 * hold 45. Under reduced motion they appear in place. Everything is timed from
 * the world tick, so a capture at tick N always shows the same frame.
 */
import { TICK_HZ } from '@arcade/core';
import type Phaser from 'phaser';
import type { Course } from '../../logic/courses/types.ts';
import {
  type CharacterId,
  DIFFICULTIES,
  type Difficulty,
  type RacePhase,
  type RaceState,
  type World,
} from '../../logic/types.ts';
import { castName, worldOf } from '../../logic/worlds/index.ts';
import { createLabel } from '../art/font.ts';
import { toneCss, UiColour, UiRamp, type UiToneName } from '../art/ui/palette.ts';
import { DISPLAY_FACE, measureText } from '../art/ui/typeface.ts';
import { localOf } from '../local-racer.ts';
import { FINAL_STRETCH_AT, raceProgress } from '../race-progress.ts';
import { Layer } from './layers.ts';
import type { Rect } from './screen-layout.ts';

/** Logic ticks as a race time, e.g. 1234 ticks reads "0:20.56". Rounds down to the hundredth. */
export function formatRaceTime(ticks: number): string {
  const centis = Math.floor((ticks * 100) / TICK_HZ);
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis % 100).padStart(2, '0')}`;
}

/** A place as an English ordinal: 1st, 2nd, 3rd, 4th. */
export function ordinal(place: number): string {
  const teens = place % 100 >= 11 && place % 100 <= 13;
  const suffix = teens ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th');
  return `${place}${suffix}`;
}

/** The saved best as the debug summary reports it, e.g. "Best 0:24.46 (2nd)". */
export function formatBest(best: { ticks: number; place: number }): string {
  return `Best ${formatRaceTime(best.ticks)} (${ordinal(best.place)})`;
}

/**
 * The name a character's slot goes by on screen in `course`'s world, e.g. "Baron Barnacle" in Reef.
 *
 * @throws {Error} When the course names an unknown world.
 */
export function racerName(character: CharacterId, course: Pick<Course, 'id' | 'world'>): string {
  return castName(worldOf(course), character);
}

/** The first word of a character's name in `course`'s world, for rows and cells too narrow for the whole: "Baron". */
export function racerShortName(character: CharacterId, course: Pick<Course, 'id' | 'world'>): string {
  const [first = ''] = racerName(character, course).split(' ');
  return first;
}

/** What a racer's time column says when they never finished: a phrase a child can read, not an abbreviation. */
const NO_TIME_TEXT = 'TIME UP';

/**
 * One results standings row, 18 characters (107 px, UI.md's row width): the place in 4, the short
 * name in 7 (6 letters at most, then a space) and the time or TIME UP right-aligned in 7, e.g.
 * "4TH BARON  0:24.46" or "2ND STREAK 3:06.30". Names come from `course`'s world cast.
 */
export function standingsRow(
  racer: { character: CharacterId; finished: { tick: number } | null },
  place: number,
  course: Pick<Course, 'id' | 'world'>,
): string {
  const time = racer.finished ? formatRaceTime(racer.finished.tick) : NO_TIME_TEXT;
  const name = racerShortName(racer.character, course).toUpperCase();
  return `${ordinal(place).toUpperCase().padEnd(4)}${name.padEnd(7)}${time.padStart(7)}`;
}

/** The word and lit pips the race countdown shows for the level the race was built on. */
interface LevelBanner {
  text: string;
  /** 1 for Easy, 2 for Normal, 3 for Hard, as on the title's Level button. */
  pips: number;
}

/** The level banner while the countdown runs, null once the race is under way. */
export function levelBanner(world: { difficulty: Difficulty; race: Pick<RaceState, 'phase'> }): LevelBanner | null {
  if (world.race.phase !== 'countdown') return null;
  return { text: world.difficulty.toUpperCase(), pips: DIFFICULTIES.indexOf(world.difficulty) + 1 };
}

/**
 * How many px of a slide are still to go `age` ticks after it started: `distance` at age 0, then
 * evenly down to 0 at `ticks`. Under reduced motion nothing slides, so it is always 0.
 */
export function slideRemaining(age: number, distance: number, ticks: number, reducedMotion: boolean): number {
  if (reducedMotion || age >= ticks) return 0;
  return Math.round(distance * (1 - Math.max(0, age) / ticks));
}

/** Each tone's CSS string, built once so per-frame colour changes allocate nothing. */
export const TONE_CSS: Readonly<Record<UiToneName, string>> = {
  foam: toneCss('foam'),
  sun: toneCss('sun'),
  coral: toneCss('coral'),
  dim: toneCss('dim'),
};

/** The race's centre splash: countdown numerals, GO, FINAL STRETCH and FINISH. */
interface RaceSplash {
  /** Redraws the splash and says whether one is showing. */
  sync(world: World): boolean;
}

/**
 * Where every splash centres vertically (UI.md "Splash"), on the view's centre across; FINAL STRETCH,
 * the widest, spans x 53-267, y 50-74 on the base.
 */
const SPLASH_Y = 62;
/**
 * The countdown's level word (display, centred) and pips (6 px squares with a 1 px outline, 4 px
 * apart, centred), under the numeral, in the safe column and clear of the lock-on caption above.
 */
const LEVEL_BANNER = { wordY: 88, pipsY: 98, pip: 6, gap: 4 } as const;
const COUNTDOWN_TICKS_PER_NUMBER = 60;
const COUNTDOWN_DROP = { px: 6, ticks: 6 } as const;
const BANNER_SLIDE = { px: 12, ticks: 8 } as const;
const BANNER_HOLD_TICKS = 45;
const COUNTDOWN_TEXT: Partial<Record<number, string>> = { 1: '1', 2: '2', 3: '3' };
const SPLASH_SCALE = 2;
/** An outline is one glyph pixel wide, so it grows a label by this many px a side per scale step. */
const OUTLINE_PX = 1;

/**
 * Where the countdown draws on a view centred on `centreX`, outlines included: the numeral over its
 * whole drop, the level word and the level pips. Anything else on screen during the countdown stays
 * out of these.
 */
export function countdownRects(centreX: number): Rect[] {
  const numerals = Object.values(COUNTDOWN_TEXT).map((text) => measureText(DISPLAY_FACE, text ?? '', SPLASH_SCALE));
  const words = DIFFICULTIES.map((level) => measureText(DISPLAY_FACE, level.toUpperCase()));
  const pipSpan = DIFFICULTIES.length * LEVEL_BANNER.pip + (DIFFICULTIES.length - 1) * LEVEL_BANNER.gap;
  const numeralRest = centredRect(centreX, SPLASH_Y, widest(numerals), numerals[0]?.height ?? 0, SPLASH_SCALE);
  return [
    { ...numeralRest, y: numeralRest.y - COUNTDOWN_DROP.px, h: numeralRest.h + COUNTDOWN_DROP.px },
    centredRect(centreX, LEVEL_BANNER.wordY, widest(words), words[0]?.height ?? 0, 1),
    // The pips' 1 px stroke straddles their edges.
    { x: centreX - pipSpan / 2 - 1, y: LEVEL_BANNER.pipsY - 1, w: pipSpan + 2, h: LEVEL_BANNER.pip + 2 },
  ];
}

function widest(sizes: readonly { width: number }[]): number {
  return Math.max(...sizes.map((size) => size.width));
}

/** The rect of outlined text `width` by `height` px that a centre-aligned label puts at (x, y). */
function centredRect(x: number, y: number, width: number, height: number, scale: number): Rect {
  const outline = OUTLINE_PX * scale;
  return {
    x: x - Math.floor(width / 2) - outline,
    y: y - Math.floor(height / 2) - outline,
    w: width + 2 * outline,
    h: height + 2 * outline,
  };
}

/** One splash frame: the text (empty for none), its tone and how far it sits from its resting place. */
interface SplashFrame {
  text: string;
  tone: UiToneName;
  dx: number;
  dy: number;
}

/** World ticks on which the race reached the final stretch and ended, null until it has. */
export interface SplashMoments {
  stretchAt: number | null;
  endedAt: number | null;
}

/** The parts of the world a splash frame depends on. */
export interface SplashClock {
  tick: number;
  race: Pick<RaceState, 'phase' | 'raceTick' | 'result'>;
  /** Whether the local racer (the slot the screen follows) crossed the line: FINISH if so, else TIME UP. */
  localFinished: boolean;
}

/**
 * Notes the first tick the race is in its final stretch and the first tick it is over. Each is
 * set once and kept, so each banner shows once per race. `progress` is the player's race fraction.
 */
export function noteSplashMoments(moments: SplashMoments, phase: RacePhase, tick: number, progress: number): void {
  if (moments.stretchAt === null && phase === 'racing' && progress >= FINAL_STRETCH_AT) moments.stretchAt = tick;
  if (moments.endedAt === null && phase === 'finished') moments.endedAt = tick;
}

/**
 * Adds the splash to `scene`, pinned to the screen above the HUD. The final stretch is the same
 * `raceProgress` crossing of `FINAL_STRETCH_AT` that lifts the music.
 */
export function createRaceSplash(scene: Phaser.Scene, reducedMotion: boolean, centreX: number): RaceSplash {
  const label = createLabel(scene, centreX, SPLASH_Y, '', {
    size: 'display',
    scale: SPLASH_SCALE,
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  // The local racer's distance to the finish at the first sync, which is the start line.
  let startProgress: number | null = null;
  const moments: SplashMoments = { stretchAt: null, endedAt: null };
  // Reused every frame, so the splash allocates nothing per frame.
  const frame: SplashFrame = { text: '', tone: 'foam', dx: 0, dy: 0 };
  const levelView = createLevelView(scene, centreX);
  const clock: SplashClock = {
    tick: 0,
    race: { phase: 'countdown', raceTick: 0, result: null },
    localFinished: false,
  };

  return {
    sync(world) {
      levelView(levelBanner(world));
      const local = localOf(world);
      startProgress ??= local.progress;
      noteSplashMoments(moments, world.race.phase, world.tick, raceProgress(world, startProgress));
      clock.tick = world.tick;
      clock.race = world.race;
      clock.localFinished = local.finished !== null;
      splashFrame(clock, moments, reducedMotion, frame);
      label.setColor(TONE_CSS[frame.tone]).setOffset(frame.dx, frame.dy).setText(frame.text);
      return frame.text !== '';
    },
  };
}

/**
 * The level under the countdown numeral: its word in foam and three pips, as many lit (sun) as the
 * level's number, so a child who can't read EASY still sees one, two or three. Returns the redraw,
 * which hides everything for a null banner.
 */
function createLevelView(scene: Phaser.Scene, centreX: number): (banner: LevelBanner | null) => void {
  const word = createLabel(scene, centreX, LEVEL_BANNER.wordY, '', {
    size: 'display',
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  const span = DIFFICULTIES.length * LEVEL_BANNER.pip + (DIFFICULTIES.length - 1) * LEVEL_BANNER.gap;
  const pips = DIFFICULTIES.map((_, index) =>
    scene.add
      .rectangle(
        centreX - span / 2 + index * (LEVEL_BANNER.pip + LEVEL_BANNER.gap),
        LEVEL_BANNER.pipsY,
        LEVEL_BANNER.pip,
        LEVEL_BANNER.pip,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, UiColour.ink)
      .setScrollFactor(0)
      .setDepth(Layer.banner)
      .setVisible(false),
  );
  return (banner) => {
    word.setVisible(banner !== null);
    if (banner) word.setText(banner.text);
    for (const [index, pip] of pips.entries()) {
      pip.setVisible(banner !== null);
      if (banner) pip.setFillStyle(index < banner.pips ? UiColour.sun : UiRamp.indigoLight);
    }
  };
}

/**
 * What the splash shows now, written into `out` and returned. The finish wins over a final
 * stretch still on screen; an empty `text` means no splash.
 */
export function splashFrame(
  world: SplashClock,
  moments: SplashMoments,
  reducedMotion: boolean,
  out: SplashFrame = { text: '', tone: 'foam', dx: 0, dy: 0 },
): SplashFrame {
  const { race } = world;
  if (race.phase === 'countdown') {
    const age = race.raceTick % COUNTDOWN_TICKS_PER_NUMBER;
    const n = Math.max(1, 3 - Math.floor(race.raceTick / COUNTDOWN_TICKS_PER_NUMBER));
    // Up from rest: 0 minus, not unary minus, so a finished drop is 0 rather than -0.
    const dy = 0 - slideRemaining(age, COUNTDOWN_DROP.px, COUNTDOWN_DROP.ticks, reducedMotion);
    return setFrame(out, COUNTDOWN_TEXT[n] ?? '', 'foam', 0, dy);
  }
  if (moments.endedAt !== null) {
    // Coral is not allowed over the water (UI.md), so running out of time reads by its words, in foam.
    const [text, tone] = world.localFinished ? (['FINISH', 'sun'] as const) : ([NO_TIME_TEXT, 'foam'] as const);
    return banner(out, text, tone, world.tick - moments.endedAt, reducedMotion);
  }
  if (moments.stretchAt !== null && isBannerUp(world.tick - moments.stretchAt))
    return banner(out, 'FINAL STRETCH', 'sun', world.tick - moments.stretchAt, reducedMotion);
  return banner(out, 'GO!', 'sun', race.raceTick, reducedMotion);
}

function isBannerUp(age: number): boolean {
  return age >= 0 && age < BANNER_SLIDE.ticks + BANNER_HOLD_TICKS;
}

/** A banner `age` ticks after it started: sliding in from the right, holding, then gone. */
function banner(out: SplashFrame, text: string, tone: UiToneName, age: number, reducedMotion: boolean): SplashFrame {
  if (!isBannerUp(age)) return setFrame(out, '', 'foam', 0, 0);
  return setFrame(out, text, tone, slideRemaining(age, BANNER_SLIDE.px, BANNER_SLIDE.ticks, reducedMotion), 0);
}

function setFrame(out: SplashFrame, text: string, tone: UiToneName, dx: number, dy: number): SplashFrame {
  out.text = text;
  out.tone = tone;
  out.dx = dx;
  out.dy = dy;
  return out;
}
