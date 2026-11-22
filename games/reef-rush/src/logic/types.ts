/**
 * Shared shapes for Reef Rush's rules. Every logic module and the engine agree
 * on these, so they hold data only: no functions live here.
 */
import type { EventSink, Rng } from '@arcade/core';
import type { GameEvent } from './events.ts';

/** Tile size in world pixels. Levels are grids of TILE x TILE cells. */
export const TILE = 16;

export type RacerId = 'player' | 'tess' | 'squib' | 'bo';

/** Racer order. Starts, tick processing and tie-breaks all follow it, so runs are deterministic. */
export const RACER_IDS: readonly RacerId[] = ['player', 'tess', 'squib', 'bo'];

export interface Vec {
  x: number;
  y: number;
}

/** What a racer wants this tick. `move` components are in [-1, 1]; `kick` and `burst` are presses on this tick. */
export interface Intent {
  move: Vec;
  kick: boolean;
  burst: boolean;
}

/** Player input as plain data. The engine reads `@arcade/input` and passes this in. */
export type TickInput = Intent;

export type Cell =
  | 'water'
  | 'rock'
  | 'coral'
  | 'kelp'
  | 'current-right'
  | 'current-left'
  | 'current-up'
  | 'current-down';

/** A course as authored: ASCII rows plus dark zones given as inclusive tile-column ranges. */
export interface LevelDef {
  name: string;
  ascii: string;
  dark?: readonly (readonly [from: number, to: number])[];
}

/** A parsed course. Positions are tile coordinates; `cells[y][x]`. */
export interface Level {
  name: string;
  width: number;
  height: number;
  cells: Cell[][];
  /** Start tiles in RACER_IDS order. */
  starts: Vec[];
  /** Tile column of the finish line. A racer finishes when its centre crosses `finishX * TILE`. */
  finishX: number;
  pearls: Vec[];
  clams: Vec[];
  urchins: Vec[];
  jellies: Vec[];
  dark: [from: number, to: number][];
}

/** An axis-aligned box in world pixels with its velocity in pixels per second. */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
}

/** What the water does to a body at its centre this tick. */
export interface Environment {
  /** Unit direction of the current, or null outside currents. */
  current: Vec | null;
  inKelp: boolean;
}

/** Multipliers and overrides on a racer's swimming. Profiles set them; power-ups change them in phase 3. */
export interface MoveModifiers {
  forceMul: number;
  kickMul: number;
  kickCooldownTicks: number;
  dragMul: number;
}

/** Personality and skill of a computer-driven racer. Tuned in `ai/profiles.ts`. */
export interface RivalProfile {
  id: RacerId;
  /** Multiplies swim force, so cruise speed scales with it. 1 is the player's. */
  forceMul: number;
  /** Chance per eligible tick to kick when the kick is ready and aim is aligned, 0..1. */
  kickSkill: number;
  /** Largest steering wobble in radians. */
  wobble: number;
  /** Ticks between re-reading the flow field. */
  reactionTicks: number;
  /** Relative mass in bumps; heavier racers get pushed less. */
  mass: number;
  /** How readily it bursts power-ups, 0..1. Read from phase 3. */
  itemAggression: number;
}

/** Per-racer state the AI keeps between ticks. */
export interface AiMemory {
  /** Current wobble angle offset in radians. */
  wobble: number;
  stuckTicks: number;
  /** Ticks left in a stuck-recovery swim; 0 when not recovering. */
  recoverTicks: number;
  recoverDir: Vec;
  /** Last unit aim read from the flow field. */
  aim: Vec;
  /** Ticks until the flow field is read again. */
  replanIn: number;
}

export interface Finish {
  /** Race tick on which the racer crossed the line. */
  tick: number;
  place: number;
  /** Pixels the centre was past the line on that tick; breaks same-tick ties. */
  overshoot: number;
}

export interface Racer {
  id: RacerId;
  body: Body;
  facing: 1 | -1;
  /** Ticks until the next kick is allowed; 0 means ready. */
  kickCooldown: number;
  /** Distance to the finish along the progress field, in tiles. Lower is further ahead. */
  progress: number;
  /** Current standing, 1..4. */
  place: number;
  finished: Finish | null;
  /** Null for the player unless a bot drives it in tests. */
  ai: AiMemory | null;
  profile: RivalProfile;
}

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceResult {
  /** Every racer, first place first. */
  standings: RacerId[];
  playerPlace: number;
  /** Race ticks the player took, or null when the player did not finish. */
  playerTicks: number | null;
}

export interface RaceState {
  phase: RacePhase;
  /** Counts countdown ticks during the countdown, then racing ticks from 0 at the start signal. */
  raceTick: number;
  /** Race tick on which the third rival finished, or null. Starts the DNF grace period. */
  rivalsDoneAt: number | null;
  result: RaceResult | null;
}

/**
 * Distance-to-finish fields over the tile grid, indexed `y * width + x`, in tile units.
 * `progress` ranks racers (uniform cost, coral passable). `steer` guides swimmers (kelp and
 * currents weighted, coral blocked unless broken). `smash` is `steer` with coral passable at a
 * high cost, for racers that can break it.
 */
export interface FlowFields {
  width: number;
  height: number;
  progress: Float32Array;
  steer: Float32Array;
  smash: Float32Array;
}

/** Salts for the per-consumer random streams. Adding a consumer never shifts an existing stream. */
export const RNG_SALTS = {
  'ai.player': 0x51a7e101,
  'ai.tess': 0x51a7e102,
  'ai.squib': 0x51a7e103,
  'ai.bo': 0x51a7e104,
} as const;

export type RngStream = keyof typeof RNG_SALTS;

export interface World {
  level: Level;
  fields: FlowFields;
  /** Tile indices of coral broken this race. */
  broken: Set<number>;
  racers: Racer[];
  race: RaceState;
  tick: number;
  rngs: Record<RngStream, Rng>;
  events: EventSink<GameEvent>;
  /** Pairs of racers currently touching, keyed "a|b" in RACER_IDS order. */
  contacts: Set<string>;
}
