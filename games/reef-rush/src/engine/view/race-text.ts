/**
 * How race facts read on screen: times as m:ss.cc, places as "2nd", each
 * racer's display name, and the race's big splashes (the 3-2-1 countdown,
 * GO, FINAL STRETCH, FINISH) in the outlined display face over the water. The
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
import { playerOf } from '../../logic/racers.ts';
import type { RacePhase, RacerId, RaceState, World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { toneCss, type UiToneName } from '../art/ui/palette.ts';
import { FINAL_STRETCH_AT, raceProgress } from '../race-progress.ts';
import { Layer } from './layers.ts';

const RACER_NAMES: Record<RacerId, string> = { player: 'Pip', tess: 'Tess', squib: 'Squib', bo: 'Bo' };

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

/** The name a racer goes by on screen. */
export function racerName(id: RacerId): string {
  return RACER_NAMES[id];
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
export interface RaceSplash {
  sync(world: World): void;
}

/** Where every splash is centred (UI.md "Splash"); FINAL STRETCH, the widest, spans x 53-267, y 50-74. */
const SPLASH_CENTRE = { x: 160, y: 62 } as const;
const COUNTDOWN_TICKS_PER_NUMBER = 60;
const COUNTDOWN_DROP = { px: 6, ticks: 6 } as const;
const BANNER_SLIDE = { px: 12, ticks: 8 } as const;
const BANNER_HOLD_TICKS = 45;
const COUNTDOWN_TEXT: Partial<Record<number, string>> = { 1: '1', 2: '2', 3: '3' };

/** One splash frame: the text (empty for none), its tone and how far it sits from its resting place. */
export interface SplashFrame {
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
export function createRaceSplash(scene: Phaser.Scene, reducedMotion: boolean): RaceSplash {
  const label = createLabel(scene, SPLASH_CENTRE.x, SPLASH_CENTRE.y, '', {
    size: 'display',
    scale: 2,
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  // The player's distance to the finish at the first sync, which is the start line.
  let startProgress: number | null = null;
  const moments: SplashMoments = { stretchAt: null, endedAt: null };
  // Reused every frame, so the splash allocates nothing per frame.
  const frame: SplashFrame = { text: '', tone: 'foam', dx: 0, dy: 0 };

  return {
    sync(world) {
      startProgress ??= playerOf(world).progress;
      noteSplashMoments(moments, world.race.phase, world.tick, raceProgress(world, startProgress));
      splashFrame(world, moments, reducedMotion, frame);
      label.setColor(TONE_CSS[frame.tone]).setOffset(frame.dx, frame.dy).setText(frame.text);
    },
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
    // Coral is not allowed over the water (UI.md), so a DNF reads by its word, in foam.
    const dnf = race.result?.playerTicks === null;
    return banner(out, dnf ? 'DNF' : 'FINISH', dnf ? 'foam' : 'sun', world.tick - moments.endedAt, reducedMotion);
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
