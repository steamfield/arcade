/**
 * Shared shapes for Rush Racers' rules. Every logic module and the engine agree
 * on these, so they hold data only: no functions live here.
 */

import type { EventSink, Rng } from '@arcade/core';
import type { GameEvent } from './events.ts';
import type { MediumNav, PilotMemory, RacerMotion } from './media/types.ts';

/** Tile size in world pixels. Levels are grids of TILE x TILE cells. */
export const TILE = 16;

/** Every racer's hitbox in pixels, whatever the medium. */
export const RACER_SIZE = { width: 12, height: 10 } as const;

/**
 * A racer slot: the player's and three rival slots. Characters are data assigned to slots, so tick
 * order, rng streams and tie-breaks follow the slot, never the character in it.
 */
export type RacerId = 'player' | 'tess' | 'squib' | 'bo';

/** Racer order. Starts, tick processing and tie-breaks all follow it, so runs are deterministic. */
export const RACER_IDS: readonly RacerId[] = ['player', 'tess', 'squib', 'bo'];

/** The playable cast. Each has a name, a signature ability and a rival profile in `characters.ts`. */
export type CharacterId = 'rudy' | 'gil' | 'streak' | 'onyx' | 'nib' | 'baron' | 'selene' | 'rook';

/** Every character, in select-screen order. */
export const CHARACTER_IDS: readonly CharacterId[] = [
  'rudy',
  'gil',
  'streak',
  'onyx',
  'nib',
  'baron',
  'selene',
  'rook',
];

/** One signature ability per character; `abilities.ts` holds the hooks that apply them. */
export type AbilityId =
  | 'shakeItOff'
  | 'springKick'
  | 'windUp'
  | 'ambush'
  | 'deepPockets'
  | 'bulldozer'
  | 'moonlight'
  | 'frenzy';

/**
 * Per-racer state the ability code keeps between ticks, owned by `abilities.ts`. Every field is 0
 * at the start line (`noItems`).
 */
export interface AbilityState {
  /** Wind-up: ticks swum without turning hard or being hit. Baron reuses it as ticks since the start or his last hit (bulldozer ramp). */
  windUp: number;
  /** Frenzy: ticks left in the speed burst. */
  frenzy: number;
}

export interface Vec {
  x: number;
  y: number;
}

/**
 * What a racer wants this tick. `move` components are in [-1, 1]; `kick` and `use` are presses on
 * this tick. In one tick `cycle` applies before `use`, so pressing both fires the newly selected item.
 */
export interface Intent {
  move: Vec;
  kick: boolean;
  /** Fire the selected item. */
  use: boolean;
  /** Move the item selection to the next (1) or previous (-1) held slot; 0 leaves it. */
  cycle: -1 | 0 | 1;
  /** Select this slot and fire it in the same tick (how rivals fire). Absent means none. */
  useSlot?: number;
  /** The kick button is down this tick (a press or a hold). Media with variable jumps read it; swim ignores it. Absent means not held. */
  kickHeld?: boolean;
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
  | 'current-down'
  | 'ledge'
  | 'bounce'
  | 'air';

/**
 * What one tick of movement through the tiles ran into (`moveBody`). Tiles only: racers and enemies
 * are separate. The medium reads it in `afterMove` (grounded, landing, a head bump).
 */
export interface MoveContacts {
  /** Stopped by a tile below: rock, unbroken coral, a solid tile, or a ledge from above. */
  floor: boolean;
  /** Stopped by a tile above. */
  ceiling: boolean;
  wallLeft: boolean;
  wallRight: boolean;
  /** Tile indices (`tileIndex`) the body's head hit this tick, left to right; empty unless `ceiling`. */
  ceilingTiles: readonly number[];
  /**
   * The velocity, px/s, each axis had when a tile stopped it this tick; 0 on an axis nothing stopped.
   * A medium whose racers bounce reads it, since `moveBody` has already zeroed the body's own.
   */
  lost: Vec;
}

/** What `moveBody` treats as solid beyond the level's own tiles, from the world's medium (`moveRulesFor`). */
export interface MoveRules {
  /** True: there is no floor below the last row, so a body can fall out of the level (a pit). */
  pitBelow: boolean;
  /** Extra tile indices that block like rock this tick (every crate, ready or shut, in a solid-crate medium). */
  solidTiles: ReadonlySet<number>;
  /** Ledge tile indices that hold nothing this tick: crumbling branches that are down (`World.fallen`). */
  openLedges: ReadonlySet<number>;
}

/** An extra level glyph: the base cell it behaves as, and the art key a theme draws it with. */
export interface LegendEntry {
  cell: Cell;
  art: string;
}

/** A course as authored: ASCII rows plus dark zones given as inclusive tile-column ranges. */
export interface LevelDef {
  name: string;
  ascii: string;
  dark?: readonly (readonly [from: number, to: number])[];
  /**
   * Stretches open to the sky: in columns `from..to` (inclusive) every water tile above row `row`
   * becomes air, so the surface of the sea is the top of row `row`. Objects placed there float in air.
   */
  surface?: readonly SurfaceDef[];
  /** Extra glyphs this level uses, each behaving as a base cell but drawn its own way. */
  legend?: Readonly<Record<string, LegendEntry>>;
  /** Gravity wells: planets and moons that pull racers in, and black holes. Only a medium with `effects.gravityWells` races them. */
  wells?: readonly WellDef[];
  /** Storm zones where lightning strikes on a timer (`hazards/lightning.ts`); none when left out. */
  lightning?: readonly LightningZone[];
  /** Geyser vents that erupt on a timer and push racers up (`setpieces/vents.ts`); none when left out. */
  vents?: readonly VentDef[];
  /** Wind zones whose gust flips direction on a timer (`setpieces/shifting-wind.ts`); none when left out. */
  shiftingWind?: readonly ShiftingWindDef[];
  /** Asteroids drifting back and forth on straight tracks (`setpieces/asteroids.ts`); none when left out. */
  asteroids?: readonly AsteroidDef[];
  /** Whirlpools that carry racers round their centres (`setpieces/whirlpools.ts`); none when left out. */
  whirlpools?: readonly WhirlpoolDef[];
  /** Rotten ledge runs that give way under a racer and grow back (`setpieces/crumbles.ts`); none when left out. */
  crumbles?: readonly CrumbleDef[];
  /** Cloud cannons that catch a racer and fire it along a fixed aim (`setpieces/cannons.ts`); none when left out. */
  cannons?: readonly CannonDef[];
  /** Paired mouths that carry a racer from one to the other (`setpieces/wormholes.ts`); none when left out. */
  wormholes?: readonly WormholeDef[];
}

/**
 * A geyser vent on the floor at tile (`col`, `row`): every `periodTicks` (shifted by `offsetTicks`)
 * it warns, then erupts, pushing racers in its column up to `height` tiles above it.
 */
export interface VentDef {
  col: number;
  row: number;
  height: number;
  periodTicks: number;
  offsetTicks: number;
}

/**
 * A wind zone over columns `cols[0]..cols[1]` (inclusive) whose gust pushes racers along x at
 * `push` px/s², flipping direction every half `periodTicks` (shifted by `offsetTicks`) after a warning.
 */
export interface ShiftingWindDef {
  cols: readonly [from: number, to: number];
  periodTicks: number;
  offsetTicks: number;
  push: number;
}

/**
 * An asteroid gliding from tile `from` to tile `to` and back once every `periodTicks` (shifted by
 * `offsetTicks`); a racer it touches (within `radius` tiles of its centre) is hit with cause 'asteroid'.
 */
export interface AsteroidDef {
  from: readonly [col: number, row: number];
  to: readonly [col: number, row: number];
  periodTicks: number;
  offsetTicks: number;
  radius: number;
}

/**
 * A whirlpool centred on tile (`col`, `row`) with a `radius` in tiles. It pushes racers inside it
 * round its centre: `spin` 1 turns clockwise on screen (water moves right along its top), -1 the
 * other way; `push` is the peak tangential acceleration in px/s².
 */
export interface WhirlpoolDef {
  col: number;
  row: number;
  radius: number;
  spin: 1 | -1;
  push: number;
}

/** A run of `length` ledge tiles from tile (`col`, `row`) rightward that shakes, falls and grows back as one branch. */
export interface CrumbleDef {
  col: number;
  row: number;
  length: number;
}

/**
 * A cloud cannon on open tile (`col`, `row`): it catches a racer, holds it, then fires it along
 * `dir` (each of x and y -1, 0 or 1, not both 0) at `speed` px/s for `flightTicks`.
 */
export interface CannonDef {
  col: number;
  row: number;
  dir: readonly [dx: -1 | 0 | 1, dy: -1 | 0 | 1];
  speed: number;
  flightTicks: number;
}

/** Two wormhole mouths on open tiles: a racer entering `a` leaves from `b`, and the other way too unless `oneWay`. */
export interface WormholeDef {
  a: readonly [col: number, row: number];
  b: readonly [col: number, row: number];
  oneWay: boolean;
}

/**
 * One gravity well as a course writes it, centred on tile (`col`, `row`). It pulls racers inside
 * `reach` tiles toward its centre, hardest (`pull`, px/s²) at the centre and not at all at the
 * reach. With a `horizon` (tiles, smaller than `reach`) it is a black hole, which swallows a racer
 * inside it; without one it is a planet or moon, whose body the level draws in rock.
 */
export interface WellDef {
  col: number;
  row: number;
  reach: number;
  pull: number;
  horizon?: number;
}

/** A parsed gravity well: centre, reach and horizon in pixels, `pull` in px/s². A null horizon is a planet. */
export interface Well {
  centre: Vec;
  reach: number;
  pull: number;
  horizon: number | null;
}

/**
 * A storm zone: lightning strikes every racer in columns `cols[0]..cols[1]` (inclusive) at any
 * height, on a cycle of `periodTicks` race ticks shifted by `offsetTicks`, after a warning. A course
 * hazard, the same in every world; a pure function of the race tick.
 */
export interface LightningZone {
  cols: [from: number, to: number];
  periodTicks: number;
  offsetTicks: number;
}

/** One stretch of open sky over the water: columns `from..to` inclusive, surface at the top of row `row`. */
export interface SurfaceDef {
  from: number;
  to: number;
  row: number;
}

/** A parsed course. Positions are tile coordinates; `cells[y][x]`. */
export interface Level {
  name: string;
  width: number;
  height: number;
  cells: Cell[][];
  /** The glyph written at each tile, `glyphs[y][x]`, so a theme can draw legend glyphs their own way. */
  glyphs: string[][];
  /** Start tiles in RACER_IDS order. */
  starts: Vec[];
  /** Tile column of the finish line. A racer finishes when its centre crosses `finishX * TILE`. */
  finishX: number;
  pearls: Vec[];
  clams: Vec[];
  urchins: Vec[];
  jellies: Vec[];
  /** Boost rings (`@`), in reading order; the tile under each is open sky (water). */
  rings: Vec[];
  /** Enemies placed by glyph (`S` shark, `E` eel, `K` crab), in reading order. The tile underneath is water. */
  enemies: { kind: EnemyKind; tile: Vec }[];
  dark: [from: number, to: number][];
  /** Stretches open to the sky (`LevelDef.surface`); their water above `row` parsed as 'air'. */
  surface: SurfaceDef[];
  /** Gravity wells (`LevelDef.wells`), in the order written; empty for a level without any. */
  wells: Well[];
  /** Storm zones (`LevelDef.lightning`), checked to be on the map, apart and long enough to warn before they strike. */
  lightning: LightningZone[];
  /** Geyser vents (`LevelDef.vents`), checked by `parseVents`; empty for a level without any. */
  vents: VentDef[];
  /** Shifting wind zones (`LevelDef.shiftingWind`), checked by `parseShiftingWind`; empty for a level without any. */
  shiftingWind: ShiftingWindDef[];
  /** Drifting asteroids (`LevelDef.asteroids`), checked by `parseAsteroids`; empty for a level without any. */
  asteroids: AsteroidDef[];
  /** Whirlpools (`LevelDef.whirlpools`), checked by `parseWhirlpools`; empty for a level without any. */
  whirlpools: WhirlpoolDef[];
  /** Crumbling branches (`LevelDef.crumbles`), checked by `parseCrumbles`; empty for a level without any. */
  crumbles: CrumbleDef[];
  /** Cloud cannons (`LevelDef.cannons`), checked by `parseCannons`; empty for a level without any. */
  cannons: CannonDef[];
  /** Wormholes (`LevelDef.wormholes`), checked by `parseWormholes`; empty for a level without any. */
  wormholes: WormholeDef[];
}

/** An axis-aligned box in world pixels: top-left corner and size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A racer's box in world pixels with its velocity in pixels per second. */
export interface Body extends Box {
  vx: number;
  vy: number;
}

/** What the water does to a body at its centre this tick. */
export interface Environment {
  /** Unit direction of the current, or null outside currents. */
  current: Vec | null;
  inKelp: boolean;
  /** True when the body's centre is in an air tile above a surface. */
  inAir: boolean;
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
  /** How readily it fires an item that has a use, 0..1. */
  itemAggression: number;
  /**
   * How well it pilots in media that reward skill beyond wobble and kicks, 0..1. Absent means 1.
   * Each medium reads it in its own `steer`; swim ignores it.
   */
  pilotSkill?: number;
}

/**
 * Per-racer state the AI keeps between ticks: the medium's pilot memory, plus the generic progress
 * backstop (`ai/rival.ts`), which starts the medium's stuck recovery when progress stalls.
 */
export interface AiMemory {
  /** What the world's medium remembers about steering this rival (`Medium.createPilot`). */
  pilot: PilotMemory;
  /** The lowest `racer.progress` seen while racing; Infinity before the first reading. */
  bestProgress: number;
  /** Racing ticks since `bestProgress` last fell. */
  sinceBest: number;
}

export interface Finish {
  /** Race tick on which the racer crossed the line. */
  tick: number;
  place: number;
  /** Pixels the centre was past the line on that tick; breaks same-tick ties. */
  overshoot: number;
}

/** The ten power-ups. A racer holds each kind at most once. */
export type PowerUpKind =
  | 'jetFin'
  | 'bubbleShield'
  | 'puffer'
  | 'inkSac'
  | 'glowLantern'
  | 'homingSquid'
  | 'riptide'
  | 'undertow'
  | 'mimic'
  | 'cannonball';

/** Every power-up kind, in a fixed order that clam rolls and tests iterate. */
export const POWER_UP_KINDS: readonly PowerUpKind[] = [
  'jetFin',
  'bubbleShield',
  'puffer',
  'inkSac',
  'glowLantern',
  'homingSquid',
  'riptide',
  'undertow',
  'mimic',
  'cannonball',
];

/** A power-up in an inventory slot and the uses it has left (at least 1 while held). */
export interface HeldItem {
  kind: PowerUpKind;
  charges: number;
}

/**
 * What hurt a racer. Urchins, jellies, enemies and lightning have no owner; the rest come from
 * another racer's item. Lightning stuns like a flash.
 */
export type HitCause =
  | 'urchin'
  | 'jelly'
  | 'bubble'
  | 'puffer'
  | 'flash'
  | 'squid'
  | 'lightning'
  | 'asteroid'
  | CannonballShotStyle
  | EnemyKind;

/** A world's reworked item, used in place of the shared effect (`powerups/twists/`). */
export type ItemTwistStyle = 'mudPie' | 'headwind' | 'gravityBomb';

/**
 * A world's reworked item in play (`powerups/twists/`). One shape for every style so the world
 * holds them in one list; each style's module says what its fields mean for it.
 */
export interface Twist {
  style: ItemTwistStyle;
  owner: RacerId;
  /** Centre in px. */
  x: number;
  y: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  /** Ticks left before it ends on its own. */
  ttl: number;
  /** A per-style stage, such as 0 while a Mud Pie flies and 1 once it has landed as a splat. */
  phase: number;
}

/** How a world's Cannonball fires when it isn't the swim dash (`powerups/cannonball/`). */
export type CannonballShotStyle = 'boulder' | 'meteor' | 'comet';

/**
 * Why a shot ended: it hit a racer, met the ground or a wall (a meteor landing, a boulder smashing,
 * a comet striking rock or ice), fizzled with no one to aim at, or ran out (time, the level's
 * bottom, a black hole).
 */
export type ShotEndReason = 'hit' | 'landed' | 'fizzled' | 'expired';

/**
 * A world-specific Cannonball in flight (`powerups/cannonball/`). One shape for every style so
 * the world holds them in one list; each style's module says what its fields mean for it.
 */
export interface Shot {
  style: CannonballShotStyle;
  owner: RacerId;
  /** Centre in px. */
  x: number;
  y: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  /** Ticks left before it ends on its own. */
  ttl: number;
  /** The racer it is aimed at, if its style aims (the Meteor). */
  target: RacerId | null;
  /** A per-style countdown or stage, such as a Meteor's warning ticks left. */
  phase: number;
}

/** Creatures on the course that a racer can beat with a dash bonk (`hazards/enemies/`). */
export type EnemyKind = 'shark' | 'eel' | 'crab';
export const ENEMY_KINDS: readonly EnemyKind[] = ['shark', 'eel', 'crab'];

/**
 * Timed conditions on a racer, each a count of ticks left (0 = off). `tickStatuses` (status.ts)
 * takes one off every counter at the end of each tick the racer is in play, except `fallen`, which
 * the medium counts down itself.
 */
export interface RacerStatus {
  /** Input ignored (intent idle). */
  stunned: number;
  /** Hits do nothing; set by a landed hit, and the racer flickers. */
  invulnerable: number;
  /** Cannonballing: hits do nothing (`isInvulnerable`), without the hit flicker. */
  cannonball: number;
  /** Inside another racer's ink: swims at half force. */
  slowed: number;
  /** Inside a bubble: input ignored, floats straight up. */
  trapped: number;
  /** Puffer or Cannonball: larger hitbox that breaks coral and hits racers, urchin-proof. */
  inflated: number;
  /** Jet Fins or Cannonball: velocity held at `dashSpeed` along `dashDir`. A landed hit ends it (`applyHit` sets 0). */
  dashing: number;
  /** Pearl boost: swims with more force. */
  boost: number;
  /** Boost ring: moves with more force (`PASSIVE.ringBoostForceMul`), so in flight cruise rises with it. */
  ringBoost: number;
  /** Held by a Homing Squid: swims at reduced force with a sideways drift; kicks shorten it. */
  latched: number;
  /** Undertow: pulled back along the medium's way to the finish. */
  undertow: number;
  /** Just dashed (kicked): a dash bonk lands on an enemy touched while this is above 0. */
  bonking: number;
  /**
   * Fell out of the course and is being put back: input ignored, downed, never a homing target. The
   * medium sets it and counts it down in `afterMove`; `tickStatuses` leaves it alone.
   */
  fallen: number;
}

export interface Racer {
  /** The slot this racer races in. */
  id: RacerId;
  /** World tick on which the AI took this racer over from its player. Absent until then. */
  tookOverAt?: number;
  /**
   * A test bot's profile drives this human slot, so its input entry is ignored and the AI never
   * takes it over. Absent for every racer a person or a rival drives.
   */
  testBot?: true;
  /** Movement state the world's medium owns (`Medium.createMotion`). */
  motion: RacerMotion;
  /** Who is swimming in the slot: sprite, name and ability. */
  character: CharacterId;
  body: Body;
  facing: 1 | -1;
  /** Ticks until the next kick is allowed; 0 means ready. */
  kickCooldown: number;
  /** Dashes (kicks) left on the meter, 0..DASH_METER.charges. A kick needs one (`powerups/dash-meter.ts`). */
  kickCharges: number;
  /** Ticks toward the next dash charge while the meter is below full. */
  kickRecharge: number;
  /** Distance to the finish along the progress field, in tiles. Lower is further ahead. */
  progress: number;
  /** Current standing, 1..4. */
  place: number;
  finished: Finish | null;
  /** Null for the player unless a bot drives it in tests. */
  ai: AiMemory | null;
  profile: RivalProfile;
  /**
   * Inventory slots, always `stackMaxFor(racer)` long: a held item or null. Never two of a kind.
   * Read and change it only through `powerups/inventory.ts`.
   */
  items: (HeldItem | null)[];
  /** Index of the selected slot. While anything is held it points at a held slot. */
  selected: number;
  /** Ticks until the next item use is allowed; 0 means ready. Shared by every slot. */
  useCooldown: number;
  /** Pearls collected this race. */
  pearls: number;
  status: RacerStatus;
  /** Unit direction of the current dash; meaningful only while `status.dashing` is above 0. */
  dashDir: Vec;
  /** Speed in px/s of the current dash (Jet Fins or Cannonball); meaningful only while dashing. */
  dashSpeed: number;
  ability: AbilityState;
  /**
   * Undertow: how many tiles ahead of the user this racer was when it was pulled, which sets the
   * pull's strength while `status.undertow` runs. Absent until an Undertow has pulled it.
   */
  undertowGapTiles?: number;
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
  /** 'player' ends the race when no active human is left racing (play); 'everyone' runs until all four finish (bot tests). */
  endsWhen: 'player' | 'everyone';
  result: RaceResult | null;
}

/** The size of a field laid over the tile grid. */
export interface GridSize {
  width: number;
  height: number;
}

/**
 * Uniform-cost distance to the finish over the tile grid, indexed `y * width + x`, in tiles: only
 * rock is closed, coral counts as open whether broken or not. It ranks racers, so places never
 * depend on terrain, on broken coral or on how the medium moves. Built by `buildProgressField`.
 */
export interface ProgressField extends GridSize {
  distance: Float32Array;
}

/**
 * Swim's navigation: distance-to-finish fields over the tile grid, indexed `y * width + x`, in tile
 * units. `steer` guides swimmers (kelp and currents weighted, coral blocked unless broken). `smash`
 * is `steer` with coral passable at a high cost, for racers that can break it with a Puffer or Cannonball.
 * `ram` is `steer` with coral passable at a low cost, for a racer that breaks coral just by swimming
 * into it (Baron's bulldozer): no item to wait for, so coral is cheaper for him than for a Puffer
 * holder. Only the swim medium reads these (`logic/media/swim/`).
 */
export interface FlowFields extends GridSize {
  steer: Float32Array;
  smash: Float32Array;
  ram: Float32Array;
}

/** Salts for the per-consumer random streams. Adding a consumer never shifts an existing stream. */
export const RNG_SALTS = {
  'ai.player': 0x51a7e101,
  'ai.tess': 0x51a7e102,
  'ai.squib': 0x51a7e103,
  'ai.bo': 0x51a7e104,
  pickups: 0x51a7e105,
  hazards: 0x51a7e106,
  /** Draws the rival characters at createWorld. */
  roster: 0x51a7e107,
} as const;

export type RngStream = keyof typeof RNG_SALTS;

/** A clam on the course. It opens when touched, then stays shut for `closedFor` ticks. */
export interface Clam {
  tile: Vec;
  /** Ticks until it can open again; 0 means ready. */
  closedFor: number;
}

/** A power-up knocked off a racer, drifting up until someone grabs it or it expires. */
/** A pearl a hit knocked loose: drifts with drag until collected or its life runs out (`pickups/pearls.ts`). */
export interface LoosePearl {
  /** Pixel position of its centre. */
  at: Vec;
  /** Pixels per second. */
  vel: Vec;
  /** Ticks since it was dropped. */
  age: number;
  /** Who dropped it; that racer can't collect it for a short grace. */
  droppedBy: RacerId | null;
}

export interface LoosePowerUp {
  kind: PowerUpKind;
  /** Uses it gives whoever grabs it: what the racer it was knocked off had left. */
  charges: number;
  /** Centre in world pixels. */
  x: number;
  y: number;
  /** Ticks before anyone can grab it. */
  grabDelay: number;
  /** Ticks until it disappears. */
  ttl: number;
}

/** An ink cloud: a circle that slows every racer inside it except its owner. */
export interface InkCloud {
  /** Centre in world pixels. */
  x: number;
  y: number;
  radius: number;
  ttl: number;
  owner: RacerId;
}

/** A Bubble Shield's trap bubble in flight: traps the first other racer it touches. */
export interface Bubble {
  /** Centre in world pixels. */
  x: number;
  y: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  ttl: number;
  owner: RacerId;
}

/** What a Homing Squid chases: a racer, a Mimic decoy (named by its owner), or nothing (it swims straight). */
export type SquidTarget = { kind: 'racer'; id: RacerId } | { kind: 'decoy'; owner: RacerId };

/** A Homing Squid in flight. Centre in world pixels, velocity in px/s. */
export interface Squid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  owner: RacerId;
  target: SquidTarget | null;
  /** The racer whose kick made it miss. It flies on without a lock and never chases that racer again. */
  dodgedBy?: RacerId;
}

/** A Riptide lane: a strong current over the box (x, y, w, h) in world pixels, pushing along the unit vector `dir`. */
export interface Riptide {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: Vec;
  ttl: number;
  owner: RacerId;
}

/** A Mimic decoy: looks like its owner and swims on along the steer field. Centre in world pixels. */
export interface Decoy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  owner: RacerId;
}

/**
 * What an enemy is doing. Each kind uses its own subset: a shark patrols, winds up, charges, recovers
 * (sits still after a charge) and staggers; an eel is hidden, shows its warning in 'windup' and
 * lunges; a crab only patrols. Any of them can end 'defeated'.
 */
export type EnemyMode = 'patrol' | 'windup' | 'charge' | 'recover' | 'stagger' | 'hidden' | 'lunge' | 'defeated';

/** One enemy on the course, made from a `level.enemies` entry. */
export interface Enemy {
  kind: EnemyKind;
  /** The tile it was placed on; patrols and lunges are measured from here. */
  home: Vec;
  /** Pixel position of its centre. */
  at: Vec;
  /** Pixels per second. */
  vel: Vec;
  facing: 1 | -1;
  /** The unit direction an eel lunges out of its hole, set once at creation; zero for sharks and crabs. */
  out: Vec;
  mode: EnemyMode;
  /** Ticks spent in `mode` so far. */
  modeTicks: number;
  /** Bonks it can still take before it is defeated. */
  hp: number;
  /** The racer a shark is winding up for or charging, else null. */
  target: RacerId | null;
  /** Racers that bonked it and are still touching it: each gets one bonk per contact. */
  bonkedBy: RacerId[];
}

/** A jellyfish bobbing around its home tile. */
export interface Jelly {
  home: Vec;
  /** Ticks into its bob cycle; frozen while stunned. */
  phase: number;
  /** Ticks left stunned (0 = active): a stunned jelly neither moves nor stings. */
  stunned: number;
}

/**
 * How hard the rivals race. 'hard' is the tuning the per-character difficulty tests measure;
 * 'normal' and 'easy' soften it (the knobs live in `difficulty-level.ts`). Easy is meant for a
 * young child: winnable without frustration.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * What the Easy guide remembers about the player's way through the course (see `guide.ts`).
 * Only tracked on levels where the guide is on; zeros elsewhere.
 */
export interface GuideMemory {
  /** The lowest medium distance to the finish the player's tile has had this race (`Medium.distanceAt`; Infinity before the first tick). */
  bestSteer: number;
  /** Ticks the player has pushed without reaching a tile closer to the finish by the medium's distance. */
  stuckTicks: number;
  /** Ticks of pushing the steering assist stays on for after it engaged against a wall. */
  helpTicks: number;
}

export interface World {
  /** Slots a person started the race in, in RACER_IDS order. Fixed for the race. */
  humans: readonly RacerId[];
  /** Id of the course being raced (`courseOf(world)`). */
  course: string;
  /** Id of the medium the course races in (`mediumOf(world)`). */
  medium: string;
  level: Level;
  /** Fixed for the race. */
  difficulty: Difficulty;
  /** The uniform-cost field that ranks racers. Generic; it never changes during a race. */
  progress: ProgressField;
  /**
   * The medium's navigation, read only by the medium (`logic/media/`). Rebuilt through the medium
   * when coral breaks (`rebuildNav`).
   */
  nav: MediumNav;
  /** Tile indices of coral broken this race. Only `breakCoral` (race/coral.ts) changes it. */
  broken: ReadonlySet<number>;
  racers: Racer[];
  race: RaceState;
  tick: number;
  rngs: Record<RngStream, Rng>;
  events: EventSink<GameEvent>;
  /**
   * Events emitted since abilities last read them (`onWorldEvents` in stepWorld). The world records
   * them as they pass to `events`, so abilities can react to anything that happened this tick.
   */
  recentEvents: GameEvent[];
  /** Pairs of racers currently touching, keyed "a|b" in RACER_IDS order. */
  contacts: Set<string>;
  /** One per `level.clams`, same order. */
  clams: Clam[];
  /** Indices into `level.pearls` already collected; each pearl is taken once per race. */
  pearlsTaken: Set<number>;
  /**
   * Indices into `level.rings` each racer has passed, in the order it passed them. Rings are never
   * used up: each boosts every racer once per race (`pickups/rings.ts`).
   */
  ringsPassed: Record<RacerId, number[]>;
  /** Pearls knocked loose by hits, still in play. */
  loosePearls: LoosePearl[];
  loose: LoosePowerUp[];
  inks: InkCloud[];
  bubbles: Bubble[];
  /** One per `level.jellies`, same order. */
  jellies: Jelly[];
  /** One per `level.enemies`, same order; event `index` fields index this list. */
  enemies: Enemy[];
  /** Homing Squids in flight. */
  squids: Squid[];
  /** Riptide lanes in the water. */
  riptides: Riptide[];
  /** Mimic decoys swimming. */
  decoys: Decoy[];
  /** World-specific Cannonballs in flight (`powerups/cannonball/`). */
  shots: Shot[];
  /** World-specific reworked items in play (`powerups/twists/`). */
  twists: Twist[];
  /** One state per `level.crumbles` entry, in order (`setpieces/crumbles.ts`). */
  crumbles: CrumbleState[];
  /** Tile indices of crumbling branches that are down. Only `setpieces/crumbles.ts` changes it. */
  fallen: ReadonlySet<number>;
  /** Racers a cloud cannon holds, is firing, or is reloading for (`setpieces/cannons.ts`). */
  cannonRides: CannonRide[];
  /** Racers that just came out of a wormhole and can't warp again yet (`setpieces/wormholes.ts`). */
  warps: WarpCooldown[];
  /** The player's way-finding record for the Easy guide. */
  guide: GuideMemory;
}

/** Where a crumbling branch is in its cycle, and the ticks left in that phase (unused while solid). */
export interface CrumbleState {
  phase: 'solid' | 'shaking' | 'fallen';
  ticks: number;
}

/**
 * Racer `racer` and cloud cannon `cannon` (an index into `level.cannons`): `held` ticks left before
 * it fires, then `flight` ticks left of the shot, then `reload` ticks before that cannon may catch
 * the racer again. The ride is over when all three are 0.
 */
export interface CannonRide {
  racer: RacerId;
  cannon: number;
  held: number;
  flight: number;
  reload: number;
}

/** Racer `racer` came out of a wormhole and can't warp again for `ticks` more ticks. */
export interface WarpCooldown {
  racer: RacerId;
  ticks: number;
}
