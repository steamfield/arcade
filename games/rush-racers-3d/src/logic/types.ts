/**
 * The shapes every logic module and the engine share. Positions are in track space: `s` is meters
 * along the course centreline from its first segment, `d` is meters sideways (+ is right of the
 * direction of travel, 0 is the centreline) and `y` is meters up. Logic never sees world x/z; the
 * engine maps track space to the world with `engine/track-geometry.ts`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from './events.ts';

/** One piece of the course centreline. A `turn` with positive `angleDeg` turns right along an arc of `radius` meters. */
export type PathSegment = { kind: 'straight'; length: number } | { kind: 'turn'; angleDeg: number; radius: number };

/** A rectangle in track space: `s0 < s1` and `d0 < d1`, meters. */
export interface Span {
  s0: number;
  s1: number;
  d0: number;
  d1: number;
}

/**
 * Something on the course. A `pit` has no ground inside its span. `mud` scales running speed by
 * `RUN.mudSpeedMul`. A `gust` pushes sideways at `push` m/s (+ pushes right) while a racer is inside
 * it. A `log` is a solid box from `s` to `s + RUN.logDepth`, across `d0..d1`, `height` meters tall
 * above the ground at `s`. A `crate` is a `?` crate (inert until phase 3).
 */
export type Feature =
  | ({ kind: 'pit' } & Span)
  | ({ kind: 'mud' } & Span)
  | ({ kind: 'gust'; push: number } & Span)
  | { kind: 'log'; s: number; d0: number; d1: number; height: number }
  | { kind: 'crate'; s: number; d: number };

/** A course as data. `hills` give the ground height at points along `s`, sorted by `s`, linear between them. */
export interface Course {
  id: string;
  name: string;
  path: PathSegment[];
  /** Half the track's width, meters: `d` runs from `-halfWidth` to `halfWidth`. */
  halfWidth: number;
  hills: { s: number; y: number }[];
  /** Where racers line up, and the line that finishes the race, meters along `s`. */
  startS: number;
  finishS: number;
  /** A good clean run's finish time, in ticks. */
  parTicks: number;
  features: Feature[];
}

/** One racer's controls for one tick, as plain data. The engine reads `@arcade/input` and fills this in. */
export interface TickInput {
  forward: boolean;
  brake: boolean;
  /** -1 (full left) .. 1 (full right). */
  steer: number;
  /** True only on the tick the jump button went down. */
  jumpPressed: boolean;
  /** True on every tick the jump button is down. */
  jumpHeld: boolean;
  dashPressed: boolean;
  /** Phase 3: fire the selected item, select the next or previous held item. */
  firePressed: boolean;
  nextPressed: boolean;
  prevPressed: boolean;
}

/** The four fixed race slots. `player` is the human; the rest are rivals from phase 2. */
export type RacerId = 'player' | 'r1' | 'r2' | 'r3';

/** Thornwood's cast, slot by slot. */
export type CharacterId = 'grit' | 'skip' | 'blaze' | 'shade' | 'cheeks' | 'duke' | 'dusk' | 'fang';

export const CHARACTER_IDS: readonly CharacterId[] = [
  'grit',
  'skip',
  'blaze',
  'shade',
  'cheeks',
  'duke',
  'dusk',
  'fang',
];

export interface Racer {
  id: RacerId;
  character: CharacterId;
  s: number;
  d: number;
  y: number;
  /** Forward speed along `s`, m/s, never negative. */
  vs: number;
  /** Sideways speed along `d`, m/s. */
  vd: number;
  /** Vertical speed, m/s, + is up. */
  vy: number;
  grounded: boolean;
  /** Ticks left in which a jump still works after leaving the ground. */
  coyoteTicks: number;
  /** Ticks left in which an early jump press still jumps on landing. */
  bufferTicks: number;
  /** Dash charges held, 0..DASH.charges. */
  dashCharges: number;
  /** Ticks until the next charge comes back, 0 while the meter is full. */
  dashRecharge: number;
  /** Ticks left of the current dash's burst, 0 when not dashing. */
  dashTicks: number;
  state: 'racing' | 'fallen' | 'finished';
  /** Ticks left out of the race after a fall, while `state` is `fallen`. */
  outTicks: number;
  invulnTicks: number;
  /** The last safe spot this racer stood on, where it comes back after a fall. */
  safeS: number;
  safeD: number;
  /** Race ticks at the finish line, null until then. */
  finishTicks: number | null;
}

export interface World {
  seed: number;
  /** Constant data; not hashed. */
  course: Course;
  phase: 'countdown' | 'racing' | 'finished';
  /** Ticks since the world was created. */
  tick: number;
  /** Ticks since `race.started`; 0 during the countdown. */
  raceTicks: number;
  /** Stepped in this order every tick. `racers[0]` is always the player. */
  racers: Racer[];
  /** Not state; not hashed. */
  events: EventSink<GameEvent>;
}

/** What `createWorld` needs. `rivals` stays false until phase 2. */
export interface WorldOptions {
  course: Course;
  seed: number;
  character: CharacterId;
  rivals: boolean;
}

/** Inputs for one tick, by slot. A slot with no entry gets no input. */
export type TickInputs = Partial<Record<RacerId, TickInput>>;
