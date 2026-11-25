/**
 * The shapes every logic module and the engine share. Positions are in track space: `s` is meters
 * along the course centreline from its first segment, `d` is meters sideways (+ is right of the
 * direction of travel, 0 is the centreline) and `y` is meters up. Logic never sees world x/z; the
 * engine maps track space to the world with `engine/track-geometry.ts`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from './events.ts';
import type { RacerItems, Shot, Splat } from './items/index.ts';

export type { HeldItem, ItemKind, RacerItems, Shot, Splat } from './items/index.ts';

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
 * above the ground at `s`. A `crate` is a `?` crate floating `CRATE.height` above the ground; touching
 * it opens it for an item.
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
  /** True on the tick the fire button is pressed to use the selected item. */
  firePressed: boolean;
  nextPressed: boolean;
  prevPressed: boolean;
}

/** The fixed slots for the player and up to three rivals. */
export type RacerId = 'player' | 'r1' | 'r2' | 'r3';

/** Thornwood's cast, slot by slot. */
export type CharacterId = 'grit' | 'skip' | 'blaze' | 'shade' | 'cheeks' | 'duke' | 'dusk' | 'fang';

/** The playable cast in character-select order. */
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

/** A competitor's movement, inventory and race status. */
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
  state: 'racing' | 'fallen' | 'finished';
  /** Ticks left out of the race after a fall, while `state` is `fallen`. */
  outTicks: number;
  invulnTicks: number;
  /** The last safe spot this racer stood on, where it comes back after a fall. */
  safeS: number;
  safeD: number;
  /** Race ticks at the finish line, null until then. */
  finishTicks: number | null;
  /** Inventory and item timers. Only `logic/items/` writes it. */
  items: RacerItems;
}

/** The state of one race from the starting grid through the finish. */
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
  /** The `createRng` state rival draws and AI noise come from; starts from `seed`. Hashed. */
  rngState: number;
  /** The tick the race will end on once every rival has finished (the grace period), else null. */
  endTick: number | null;
  /**
   * One per `crate` feature, in feature order. `shutTicks` is 0 when ready. `touching` lists racers
   * in contact who already had their chance at it. A racer leaves the list when it stops touching.
   */
  crates: { shutTicks: number; touching: RacerId[] }[];
  /** Fired items still flying. */
  shots: Shot[];
  /** Mud patches from Mud Pies. */
  splats: Splat[];
  /** Not state; not hashed. */
  events: EventSink<GameEvent>;
}

/** What `createWorld` needs. With `rivals`, three rivals line up beside the player. */
export interface WorldOptions {
  course: Course;
  seed: number;
  character: CharacterId;
  rivals: boolean;
}

/** Inputs for one tick, by slot. A slot with no entry gets no input. */
export type TickInputs = Partial<Record<RacerId, TickInput>>;
