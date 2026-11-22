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
import type { RacerId, World } from '../../logic/types.ts';
import { createLabel, type Label, type LabelOptions } from '../art/font.ts';
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

/** A label that can be drawn a few whole px away from where it rests, for slides. */
export interface SlidingLabel {
  /** Shows `text` in `tone`, offset (dx, dy) from the resting point; empty text hides it. */
  show(text: string, tone: UiToneName, dx?: number, dy?: number): void;
}

/**
 * Adds a sliding label resting at (x, y). Labels are anchored when created, so it keeps one label
 * per offset it has been asked for (a slide has at most a dozen) and shows only the current one.
 */
export function createSlidingLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: Omit<LabelOptions, 'tone' | 'color'>,
): SlidingLabel {
  const byOffset = new Map<string, Label>();
  let shown: Label | null = null;
  return {
    show(text, tone, dx = 0, dy = 0) {
      const key = `${dx},${dy}`;
      let label = byOffset.get(key);
      if (!label) {
        label = createLabel(scene, x + dx, y + dy, '', options);
        byOffset.set(key, label);
      }
      if (shown !== label) shown?.setText('');
      shown = label;
      label.setColor(toneCss(tone)).setText(text);
    },
  };
}

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

/** One splash frame: the text, its tone and how far it sits from its resting place. */
interface SplashFrame {
  text: string;
  tone: UiToneName;
  dx: number;
  dy: number;
}

const NO_SPLASH: SplashFrame = { text: '', tone: 'foam', dx: 0, dy: 0 };

/** World ticks on which the race reached the final stretch and ended, null until it has. */
interface SplashMoments {
  stretchAt: number | null;
  endedAt: number | null;
}

/**
 * Adds the splash to `scene`, pinned to the screen above the HUD. It notes the world tick on which
 * the race first entered the final stretch (`FINAL_STRETCH_AT`, the same moment the music lifts)
 * and on which it ended, so each banner shows once per race.
 */
export function createRaceSplash(scene: Phaser.Scene, reducedMotion: boolean): RaceSplash {
  const label = createSlidingLabel(scene, SPLASH_CENTRE.x, SPLASH_CENTRE.y, {
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

  return {
    sync(world) {
      startProgress ??= playerOf(world).progress;
      const { phase } = world.race;
      if (moments.stretchAt === null && phase === 'racing' && raceProgress(world, startProgress) >= FINAL_STRETCH_AT)
        moments.stretchAt = world.tick;
      if (moments.endedAt === null && phase === 'finished') moments.endedAt = world.tick;
      const frame = splashFrame(world, moments, reducedMotion);
      label.show(frame.text, frame.tone, frame.dx, frame.dy);
    },
  };
}

/** What the splash shows now. The finish wins over a final stretch still on screen. */
function splashFrame(world: World, moments: SplashMoments, reducedMotion: boolean): SplashFrame {
  const { race } = world;
  if (race.phase === 'countdown') {
    const age = race.raceTick % COUNTDOWN_TICKS_PER_NUMBER;
    const n = Math.max(1, 3 - Math.floor(race.raceTick / COUNTDOWN_TICKS_PER_NUMBER));
    const dy = -slideRemaining(age, COUNTDOWN_DROP.px, COUNTDOWN_DROP.ticks, reducedMotion);
    return { text: String(n), tone: 'foam', dx: 0, dy };
  }
  if (moments.endedAt !== null) {
    // Coral is not allowed over the water (UI.md), so a DNF reads by its word, in foam.
    const dnf = race.result?.playerTicks === null;
    return banner(dnf ? 'DNF' : 'FINISH', dnf ? 'foam' : 'sun', world.tick - moments.endedAt, reducedMotion);
  }
  if (moments.stretchAt !== null && isBannerUp(world.tick - moments.stretchAt))
    return banner('FINAL STRETCH', 'sun', world.tick - moments.stretchAt, reducedMotion);
  return banner('GO!', 'sun', race.raceTick, reducedMotion);
}

function isBannerUp(age: number): boolean {
  return age >= 0 && age < BANNER_SLIDE.ticks + BANNER_HOLD_TICKS;
}

/** A banner `age` ticks after it started: sliding in from the right, holding, then gone. */
function banner(text: string, tone: UiToneName, age: number, reducedMotion: boolean): SplashFrame {
  if (!isBannerUp(age)) return NO_SPLASH;
  return { text, tone, dx: slideRemaining(age, BANNER_SLIDE.px, BANNER_SLIDE.ticks, reducedMotion), dy: 0 };
}
