/**
 * A medium is a movement style: the only code that knows whether racers swim, fly, run or drift.
 * Generic race code asks the world's medium (`mediumOf(world)`) and never branches on its id.
 * Plain data in the world (motion, pilot memory, nav) is defined by each medium; the unions below
 * grow one member per medium.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import type {
  Body,
  Box,
  Cell,
  Environment,
  FlowFields,
  Intent,
  Level,
  MoveModifiers,
  Racer,
  Vec,
  World,
} from '../types.ts';

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

/** What the medium's surroundings do to a body this tick. Swim: today's water environment, Riptide included. */
export type MediumEnv = Environment;

/** The medium's navigation over a level. Swim: today's flow fields (steer, smash, ram). */
export type MediumNav = FlowFields;

/** Per-racer movement state the medium owns. Swim and flight: nothing. */
export type RacerMotion = Record<string, never>;

/** Per-rival AI state the medium owns. Swim: wobble, speed-based stuck count, recovery, aim and replan timer. */
export interface PilotMemory {
  wobble: number;
  stuckTicks: number;
  recoverTicks: number;
  recoverDir: Vec;
  aim: Vec;
  replanIn: number;
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
  /** Velocity, facing and kick cooldown for one tick. Every `MoveModifiers` field has a visible effect. */
  applyIntent(
    racer: Racer,
    intent: Intent,
    env: MediumEnv,
    mods: MoveModifiers,
    events: EventSink<GameEvent>,
    dt: number,
  ): void;
  /** Navigation for the level with `broken` coral gone; rebuilt when coral breaks. */
  buildNav(level: Level, broken: ReadonlySet<number>): MediumNav;
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
  /** Why `level` can't be raced in this medium; empty when it can. */
  validateLevel(level: Level, nav: MediumNav): LevelProblem[];
  racerCollision: 'solid' | 'ghost';
  effects: MediumEffects;
  kickRules: KickRules;
}
