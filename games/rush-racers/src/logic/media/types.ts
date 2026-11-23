/**
 * A medium is a movement style: the only code that knows whether racers swim, fly, run or drift.
 * Generic race code asks the world's medium (`mediumOf(world)`) and never branches on its id.
 *
 * The plain data a medium keeps in the world (its nav, the environment it samples, each racer's
 * motion and each rival's pilot memory) is opaque here: `MediumNav`, `MediumEnv`, `RacerMotion` and
 * `PilotMemory` carry only a `kind` naming the medium that made them. Generic code and the World
 * and Racer types see nothing more. Each medium extends them in its own folder (swim's `SwimNav`,
 * `SwimEnv`, `SwimPilot` and `SwimMotion` in `media/swim/data.ts`) and reads its data back through
 * accessors there (`swimNav(nav)`) that check `kind` and throw on another medium's data. A new
 * medium adds its own shapes and accessors the same way, with no edit to this file.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import type { Body, Box, Cell, Intent, Level, MoveContacts, MoveModifiers, Racer, Vec, World } from '../types.ts';

/** A medium's numbers. Swim's are today's `SWIM` constants with `base` as `BASE_MODIFIERS`. */
export interface MediumTuning {
  /** Modifiers for a racer with no profile bonuses, power-ups or abilities (kick cooldown and the rest). */
  base: MoveModifiers;
  /** Acceleration from holding a direction, px/s². */
  force: number;
  /** Linear drag per second. */
  drag: number;
  /** Hard cap on speed, px/s. */
  maxSpeed: number;
  /** Speed a kick adds, px/s. */
  kick: number;
  /** Medium-specific extras (swim: sink, currentForce, kelpDragMul). */
  extra: Readonly<Record<string, number>>;
}

/** What the medium's surroundings do to a body this tick. Opaque outside the medium that sampled it. */
export interface MediumEnv {
  /** The id of the medium that sampled it. */
  readonly kind: string;
}

/** The medium's navigation over a level. Opaque outside the medium that built it. */
export interface MediumNav {
  /** The id of the medium that built it. */
  readonly kind: string;
}

/** Per-racer movement state the medium owns. Opaque outside the medium that created it. */
export interface RacerMotion {
  /** The id of the medium that created it. */
  readonly kind: string;
}

/** Per-rival AI state the medium owns. Opaque outside the medium that created it. */
export interface PilotMemory {
  /** The id of the medium that created it. */
  readonly kind: string;
}

/**
 * The four numbers a rival draws from its rng every tick, in this order, whether or not they are used,
 * so a rival's choices never shift the rest of its stream.
 */
export interface AiDraws {
  wobble: number;
  kick: number;
  side: number;
  item: number;
}

/** A medium's steering answer for one rival this tick. */
export interface Steering {
  /** The stick, components in [-1, 1]. */
  move: Vec;
  kick: boolean;
  kickHeld: boolean;
  /** The aim after wobble and avoidance; item use reads it. */
  aim: Vec;
  /** True while the medium is recovering from being stuck; the rival then uses no items. */
  recovering: boolean;
}

/** A reason a level can't be raced in a medium, located where that means something. */
export interface LevelProblem {
  message: string;
  row: number | null;
  col: number | null;
}

/** Data that stands for what the medium does in the generic rules that push racers around. */
export interface MediumEffects {
  /** 'both': a dash, knockback or decoy holds velocity on both axes; 'horizontal': gravity keeps vertical. */
  dashAxes: 'both' | 'horizontal';
  /** Vertical speed of a racer trapped in a bubble, px/s; negative is up (water floats it up). */
  trappedDrift: number;
  /** Vertical speed of a loose power-up, px/s; negative is up. */
  looseDrift: number;
  /**
   * Upward speed, px/s, a racer leaves with after landing on an enemy, which bonks it (a stomp).
   * Null: enemies can't be stomped, only bonked by a dash.
   */
  stompBounce: number | null;
  /** True: a clam (crate) is a solid tile, ready or shut, and a ready one opens only when a racer's head hits it from below. */
  solidClams: boolean;
  /** True: no floor below the last row, so racers fall out through pits and `afterMove` brings them back. */
  pitBelow: boolean;
  /** True: the medium's levels may use ledges (`=`), which only hold a body coming down onto them. */
  allowsLedges: boolean;
}

/** How the generic counters read a kick in this medium. */
export interface KickRules {
  /** A kick just before contact makes a Homing Squid miss. */
  dodgesSquid: boolean;
  /** Each kick while latched takes ticks off the latch. */
  shakesLatch: boolean;
  /** A kick against an Undertow cuts its pull that tick. */
  countersUndertow: boolean;
  /** True when Gil's spring kick applies to a kick along the unit `aim`. */
  springKick(aim: Vec): boolean;
}

export interface Medium {
  id: string;
  tuning: MediumTuning;
  /** A racer's movement state at the start line. */
  createMotion(body: Body): RacerMotion;
  /** A rival's AI state at the start line. */
  createPilot(): PilotMemory;
  /** What the surroundings do to `racer` this tick (racer, not body: a held Riptide changes what its holder feels). */
  sampleEnvironment(world: World, racer: Racer): MediumEnv;
  /**
   * Velocity, facing and kick cooldown for one tick. Every `MoveModifiers` field has a visible effect.
   * `tuning` is the medium's tuning with the course's overrides (`effectiveTuning`); read every number
   * from it, not from the medium's own constants.
   */
  applyIntent(
    racer: Racer,
    intent: Intent,
    env: MediumEnv,
    tuning: MediumTuning,
    mods: MoveModifiers,
    events: EventSink<GameEvent>,
    dt: number,
  ): void;
  /**
   * Navigation for the level with `broken` coral gone; rebuilt when coral breaks. `tuning` is the
   * world's effective tuning (`effectiveTuning`), for media whose routes depend on it (how far a
   * racer can jump, say); media that don't need it ignore it.
   */
  buildNav(level: Level, broken: ReadonlySet<number>, tuning: MediumTuning): MediumNav;
  /**
   * A rival's steering this tick. Reads `world.nav` and `racer.profile.pilotSkill`, mutates only the
   * rival's pilot memory. `forceRecover` starts a stuck recovery now (the generic progress backstop).
   */
  steer(world: World, racer: Racer, mods: MoveModifiers, draws: AiDraws, forceRecover: boolean): Steering;
  /** Cost of entering `cell` along `move` for flow-field media; the progress field stays uniform. */
  enterCost(cell: Cell, isBroken: boolean, move: Vec): number;
  /** Unit aim toward the finish along the medium's way from `body`; zero at the finish. */
  aimFrom(world: World, body: Box, lookaheadTiles: number): Vec;
  /** Offset (each of x and y in -1..1) of the neighbour nearer the finish; null at the finish or boxed in. */
  nextTile(world: World, tile: Vec): Vec | null;
  /** The medium's distance to the finish from `tile`; Infinity when unreachable. */
  distanceAt(world: World, tile: Vec): number;
  /**
   * True when unbroken coral lies within `steps` tiles from `tile` along the medium's way for a racer
   * that can break coral, so a Puffer or Cannonball would open the way. Rival item choice asks it.
   */
  coralAhead(world: World, tile: Vec, steps: number): boolean;
  /** Why `level` can't be raced in this medium; empty when it can. */
  validateLevel(level: Level, nav: MediumNav): LevelProblem[];
  /**
   * After this tick's `moveBody` for an unfinished racer, with what it ran into: grounded state,
   * falls and respawns. Runs in RACER_IDS order, before crates are opened from below.
   */
  afterMove(world: World, racer: Racer, contacts: MoveContacts, events: EventSink<GameEvent>): void;
  /** 'solid': racers bump each other; 'ghost': they pass through; 'horizontal': they push apart along x only. */
  racerCollision: 'solid' | 'ghost' | 'horizontal';
  effects: MediumEffects;
  kickRules: KickRules;
}
