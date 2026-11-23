/**
 * The race as one deterministic step function. This module only sets the order
 * things happen in each tick; every rule lives in the module it calls.
 *
 * Tick order: clock; the Easy guide's record of the player (`trackGuide`, nothing on other levels);
 * intents for every unfinished racer from the start-of-tick
 * state (in RACER_IDS order), the human player's passed through the Easy steering assist,
 * idle while stunned or trapped; each unfinished
 * racer's movement in the medium (`Medium.sampleEnvironment` then `applyIntent`; a squid's latch and
 * an undertow pull it after), dash, trapped drift and movement through the tiles (RACER_IDS order);
 * one pass of separation over unfinished racers when the medium's racers collide; then the phase 3 systems for unfinished
 * racers only: bursts (from intents), projectiles and inks, squids, riptides, decoys, jellies, contacts
 * (hits), pickups (clams, pearls, loose), status counters; then abilities
 * (`onWorldEvents` with the events since the last call, then `tickAbilities`);
 * then progress, finishes, places, race end. Finished racers are out of play:
 * they stay where they crossed the line, nobody bumps them, and they never
 * gain, lose or burst.
 *
 * Slots are fixed (RACER_IDS); characters are data placed in them. The player's
 * slot gets the chosen character and the rival slots get `pickRivals` from the
 * `roster` stream, so a new pick never shifts another random stream.
 *
 * Everything that depends on how racers move goes through the world's medium (`mediumOf`); this
 * module never asks which medium it is.
 */
import { createRng, type EventSink } from '@arcade/core';
import { breaksCoralOnContact, bumpMassFor, onBump, onWorldEvents, tickAbilities } from './abilities.ts';
import { PLAYER_PROFILE } from './ai/profiles.ts';
import { createAiMemory, rivalIntent } from './ai/rival.ts';
import { CHARACTERS, pickRivals } from './characters.ts';
import { levelOf } from './courses/index.ts';
import type { Course } from './courses/types.ts';
import type { GameEvent } from './events.ts';
import { assistedIntent, trackGuide } from './guide.ts';
import { resolveContacts } from './hazards/contacts.ts';
import { moveJellies } from './hazards/jellies.ts';
import { driftLatched } from './hazards/latch.ts';
import { advanceProjectiles } from './hazards/projectiles.ts';
import { advanceSquids } from './hazards/squids.ts';
import { LevelError } from './level/parse.ts';
import { mediumById, mediumOf } from './media/index.ts';
import type { LevelProblem, Medium } from './media/types.ts';
import { modifiersFor } from './modifiers.ts';
import { openClams } from './pickups/clams.ts';
import { updateLoose } from './pickups/loose.ts';
import { collectPearls } from './pickups/pearls.ts';
import { driveDash, fireBursts, sustainBursts } from './powerups/burst.ts';
import { advanceDecoys } from './powerups/decoys.ts';
import { advanceRiptides } from './powerups/riptides.ts';
import { applyUndertow } from './powerups/undertow.ts';
import { ramCoral } from './race/coral.ts';
import { buildProgressField } from './race/flowfield.ts';
import { advanceClock, checkRaceEnd, recordFinishes, updatePlaces, updateProgress } from './race/standings.ts';
import { activeRacers, centreOf, noItems, playerOf } from './racers.ts';
import { controlledIntent, floatTrapped, tickStatuses } from './status.ts';
import { moveBody, separateRacers } from './swim/collide.ts';
import {
  type CharacterId,
  type Difficulty,
  type Intent,
  type Level,
  type MoveModifiers,
  RACER_IDS,
  RACER_SIZE,
  type Racer,
  type RacerId,
  type RivalProfile,
  RNG_SALTS,
  type RngStream,
  TILE,
  type TickInput,
  type World,
} from './types.ts';

export interface WorldOptions {
  /** Seeds every random stream. Same seed and inputs, same race. */
  seed: number;
  /** When set, this profile's AI drives the player's racer and `stepWorld` ignores its input. Used by bot tests. */
  playerBot?: RivalProfile;
  /** 'everyone' keeps racing after the player finishes, so difficulty tests can time every racer. Default 'player'. */
  endsWhen?: 'player' | 'everyone';
  /** Who the player races as. Default 'rudy'. The rivals are drawn from the rest by seed. */
  character?: CharacterId;
  /** How hard the rivals race. Default 'hard', so tests that don't say keep the tuning they were written against; the engine always passes the saved setting. */
  difficulty?: Difficulty;
}

const IDLE: Intent = { move: { x: 0, y: 0 }, kick: false, burst: false };

/**
 * Sets up a race on `course` at the countdown's first tick, with every clam ready, every pearl
 * in play, jellies at their homes and nothing held or in flight. The player's slot holds
 * `options.character` and the rival slots hold `pickRivals` drawn from the `roster` stream; each
 * rival slot races with its character's profile.
 *
 * @param course A shipped course, or one registered for a test (`courseFromLevel`).
 * @param events Usually the engine's EventLog, so one stream holds race, menu and save events.
 * @throws {LevelError} When the medium can't race the level (`Medium.validateLevel`), located at the
 *   first problem, with any others appended to the message after `; `.
 * @throws {Error} When the course names a medium that is neither shipped nor registered.
 */
export function createWorld(course: Course, events: EventSink<GameEvent>, options: WorldOptions): World {
  const medium = mediumById(course.medium);
  if (!medium) throw new Error(`Course '${course.id}' names unknown medium '${course.medium}'`);
  const level = levelOf(course);
  const broken = new Set<number>();
  const nav = medium.buildNav(level, broken);
  throwOnProblems(medium.validateLevel(level, nav));
  const rngs = createRngs(options.seed);
  const player = options.character ?? 'rudy';
  const characters: CharacterId[] = [player, ...pickRivals(rngs.roster, player)];
  const recentEvents: GameEvent[] = [];
  const world: World = {
    course: course.id,
    medium: medium.id,
    level,
    difficulty: options.difficulty ?? 'hard',
    progress: buildProgressField(level),
    nav,
    broken,
    racers: RACER_IDS.map((id, index) =>
      createRacer(level, medium, id, index, characters[index] ?? player, options.playerBot),
    ),
    race: { phase: 'countdown', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: options.endsWhen ?? 'player' },
    tick: 0,
    rngs,
    events: recordingInto(events, recentEvents),
    recentEvents,
    contacts: new Set(),
    clams: level.clams.map((tile) => ({ tile: { ...tile }, closedFor: 0 })),
    pearlsTaken: new Set(),
    loose: [],
    inks: [],
    bubbles: [],
    jellies: level.jellies.map((home) => ({ home: { ...home }, phase: 0, stunned: 0 })),
    squids: [],
    riptides: [],
    decoys: [],
    guide: { bestSteer: Number.POSITIVE_INFINITY, stuckTicks: 0, helpTicks: 0 },
  };
  // Catch-up reads progress on the first racing tick, before stepWorld updates it.
  updateProgress(world);
  return world;
}

/** Throws a LevelError at the first problem, naming the rest after it; does nothing for none. */
function throwOnProblems(problems: readonly LevelProblem[]): void {
  const [first, ...rest] = problems;
  if (!first) return;
  const message = [first, ...rest].map((problem) => problem.message).join('; ');
  throw new LevelError(message, first.row, first.col);
}

function createRacer(
  level: Level,
  medium: Medium,
  id: RacerId,
  index: number,
  character: CharacterId,
  playerBot: RivalProfile | undefined,
): Racer {
  const start = level.starts[index];
  if (!start) throw new LevelError(`Level has no start ${index + 1}`);
  const isHuman = id === 'player' && !playerBot;
  const profile = id === 'player' ? (playerBot ?? PLAYER_PROFILE) : { id, ...CHARACTERS[character].profile };
  const body = {
    x: start.x * TILE + (TILE - RACER_SIZE.width) / 2,
    y: start.y * TILE + (TILE - RACER_SIZE.height) / 2,
    vx: 0,
    vy: 0,
    w: RACER_SIZE.width,
    h: RACER_SIZE.height,
  };
  return {
    id,
    character,
    motion: medium.createMotion(body),
    body,
    facing: 1,
    kickCooldown: 0,
    progress: Number.POSITIVE_INFINITY,
    place: index + 1,
    finished: null,
    ai: isHuman ? null : createAiMemory(medium),
    profile,
    ...noItems(),
  };
}

/** A sink that passes every event on to `sink` and also appends it to `into`. */
function recordingInto(sink: EventSink<GameEvent>, into: GameEvent[]): EventSink<GameEvent> {
  return {
    emit(event) {
      into.push(event);
      sink.emit(event);
    },
  };
}

function createRngs(seed: number): World['rngs'] {
  const streams = Object.keys(RNG_SALTS) as RngStream[];
  return Object.fromEntries(
    // Mixed first because with a bare XOR, stream A at seed s equals stream B at s ^ saltA ^ saltB.
    streams.map((stream) => [stream, createRng((Math.imul(seed, 0x9e3779b1) ^ RNG_SALTS[stream]) >>> 0)]),
  ) as World['rngs'];
}

/** Advances the race by one fixed tick. `input` drives the player's racer unless a bot does. */
export function stepWorld(world: World, input: TickInput, dt: number): void {
  world.tick++;
  if (world.race.phase === 'finished') return;
  if (advanceClock(world)) return;

  const racing = activeRacers(world);
  const medium = mediumOf(world);
  trackGuide(world, input);
  // Every racer's intent is asked for even while it can't act, so AI rng draws per tick never vary.
  const intents = racing.map((racer) => controlledIntent(racer, intentFor(world, racer, input)));
  racing.forEach((racer, index) => {
    moveRacer(world, medium, racer, intents[index] ?? IDLE, modifiersFor(world, racer), dt);
  });
  if (medium.racerCollision === 'solid') {
    separateRacers(racing, world.contacts, world.events, bumpMassFor, (a, b) => onBump(world, a, b));
  }

  fireBursts(world, racing, intents);
  sustainBursts(world, racing);
  advanceProjectiles(world, racing, dt);
  advanceSquids(world, racing, dt);
  advanceRiptides(world);
  advanceDecoys(world, dt);
  moveJellies(world);
  resolveContacts(world, racing);
  openClams(world, racing);
  collectPearls(world, racing);
  updateLoose(world, racing, dt);
  for (const racer of racing) tickStatuses(racer);
  // splice(0) empties the buffer the event sink appends to, so each event reaches abilities once.
  onWorldEvents(world, world.recentEvents.splice(0));
  tickAbilities(world, racing);

  updateProgress(world);
  recordFinishes(world);
  updatePlaces(world);
  checkRaceEnd(world);
}

function intentFor(world: World, racer: Racer, input: TickInput): Intent {
  if (!racer.ai) return assistedIntent(world, racer, input);
  return rivalIntent(world, racer, world.rngs[`ai.${racer.id}`]);
}

/**
 * One racer's velocity for the tick (the medium's response to its intent, then a dash or a trapped
 * drift overriding it), then its move, breaking the coral ahead first when its ability rams through coral.
 */
function moveRacer(world: World, medium: Medium, racer: Racer, intent: Intent, mods: MoveModifiers, dt: number): void {
  medium.applyIntent(racer, intent, medium.sampleEnvironment(world, racer), mods, world.events, dt);
  driftLatched(racer, dt);
  applyUndertow(world, racer, dt);
  driveDash(world, racer);
  floatTrapped(world, racer);
  if (breaksCoralOnContact(racer)) ramCoral(world, racer, dt);
  moveBody(racer.body, world.level, world.broken, dt);
}

/** Small, stable view for the CLI summary and scenario assertions. `stack` lists held power-ups oldest first. */
export function summarize(world: World) {
  const player = playerOf(world);
  return {
    tick: world.tick,
    phase: world.race.phase,
    raceTick: world.race.raceTick,
    place: `${player.place}/${world.racers.length}`,
    progress: Number.isFinite(player.progress) ? Math.round(player.progress) : null,
    finished: player.finished !== null,
    player: { tile: centreTile(player), kickReady: player.kickCooldown === 0 },
    stack: [...player.stack],
    pearls: player.pearls,
    stunned: player.status.stunned > 0,
  };
}

function centreTile(racer: Racer): [number, number] {
  const centre = centreOf(racer);
  return [Math.floor(centre.x / TILE), Math.floor(centre.y / TILE)];
}

const CELL_CHAR = {
  water: '.',
  rock: '#',
  coral: 'C',
  kelp: '~',
  'current-right': '>',
  'current-left': '<',
  'current-up': '^',
  'current-down': 'v',
} as const;

const RACER_CHAR: Record<RacerId, string> = { player: '@', tess: 'T', squib: 'S', bo: 'B' };

/** The "x,y" tile key of a thing at pixel position (x, y). */
function pixelTileKey({ x, y }: { x: number; y: number }): string {
  return `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;
}

/**
 * Characters for things on the course, by "x,y" tile: `*` urchin, `o` pearl still in play,
 * `?` clam ready to open, `_` clam shut after opening, `j` jelly (at its home tile), `m` Mimic decoy,
 * `s` Homing Squid (the last two at the tile holding their centre).
 * Later entries win, so a jelly shows over the tile it bobs around.
 */
function itemChars(world: World): Map<string, string> {
  const { level } = world;
  return new Map([
    ...level.urchins.map((tile): [string, string] => [`${tile.x},${tile.y}`, '*']),
    ...level.pearls.flatMap((tile, index): [string, string][] =>
      world.pearlsTaken.has(index) ? [] : [[`${tile.x},${tile.y}`, 'o']],
    ),
    ...world.clams.map(({ tile, closedFor }): [string, string] => [`${tile.x},${tile.y}`, closedFor > 0 ? '_' : '?']),
    ...world.jellies.map(({ home }): [string, string] => [`${home.x},${home.y}`, 'j']),
    ...world.decoys.map((decoy): [string, string] => [pixelTileKey(decoy), 'm']),
    ...world.squids.map((squid): [string, string] => [pixelTileKey(squid), 's']),
  ]);
}

/**
 * The course as text: racers (`@ T S B`) at their centre tiles over items (see `itemChars`: urchins `*`,
 * pearls `o`, clams `?` `_`, jellies `j`, Mimic decoys `m` and Homing Squids `s`) over
 * tiles in the level's own characters, with broken coral shown as water. Readable in test failures
 * and `arcade see --ascii`.
 */
export function toAscii(world: World): string {
  const racerAt = new Map(world.racers.map((racer) => [centreTile(racer).join(','), RACER_CHAR[racer.id]]));
  const items = itemChars(world);
  return world.level.cells
    .map((row, y) =>
      row
        .map((cell, x) => {
          const shown = racerAt.get(`${x},${y}`) ?? items.get(`${x},${y}`);
          if (shown) return shown;
          if (x === world.level.finishX && cell === 'water') return 'F';
          if (cell === 'coral' && world.broken.has(y * world.level.width + x)) return '.';
          return CELL_CHAR[cell];
        })
        .join(''),
    )
    .join('\n');
}
