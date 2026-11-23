/**
 * The race as one deterministic step function. This module only sets the order
 * things happen in each tick; every rule lives in the module it calls.
 *
 * Tick order: the tick count, and nothing more once the race is finished; the AI takes over each
 * human slot whose input is missing; clock; the Easy guide's record of the player (`trackGuide`,
 * nothing on other levels);
 * intents for every unfinished racer from the start-of-tick
 * state (in RACER_IDS order), each person-driven racer's from its own input passed through the Easy steering assist,
 * cut to item cycling while stunned or trapped, and with no kick while the dash meter is empty
 * (`canDash`); each unfinished
 * racer's movement in the medium (`Medium.sampleEnvironment` then `applyIntent`; a squid's latch and
 * an undertow pull it after), dash, trapped drift and movement through the tiles (RACER_IDS order);
 * a dash charge spent for each `racer.kicked` that movement emitted; one pass of separation over unfinished racers when the medium's racers collide; then the phase 3 systems for unfinished
 * racers only: items (cycle, then use, from intents), projectiles and inks, squids, riptides, decoys, jellies, contacts
 * (hits), pickups (clams, pearls, loose), status counters and dash recharge; then abilities
 * (`onWorldEvents` with the events since the last call, then `tickAbilities`);
 * then progress, finishes, places, race end. Finished racers are out of play:
 * they stay where they crossed the line, nobody bumps them, and they never
 * gain, lose or use items.
 *
 * Slots are fixed (RACER_IDS); characters are data placed in them. Who sits in
 * each slot and how it is driven is `race/seats.ts`; the cast is drawn from the
 * `roster` stream, so a new pick never shifts another random stream.
 *
 * Everything that depends on how racers move goes through the world's medium (`mediumOf`); this
 * module never asks which medium it is.
 */
import { createRng, type EventSink } from '@arcade/core';
import { breaksCoralOnContact, bumpMassFor, onBump, onWorldEvents, stackMaxFor, tickAbilities } from './abilities.ts';
import { createAiMemory, rivalIntent } from './ai/rival.ts';
import { courseById, levelOf } from './courses/index.ts';
import type { Course } from './courses/types.ts';
import type { GameEvent } from './events.ts';
import { assistedIntent, trackGuide } from './guide.ts';
import { resolveContacts } from './hazards/contacts.ts';
import { createEnemies, stepEnemies } from './hazards/enemies/index.ts';
import { ENEMY } from './hazards/enemies/tuning.ts';
import { moveJellies } from './hazards/jellies.ts';
import { driftLatched } from './hazards/latch.ts';
import { advanceProjectiles } from './hazards/projectiles.ts';
import { advanceSquids } from './hazards/squids.ts';
import { LevelError } from './level/parse.ts';
import { effectiveTuning, mediumById, mediumOf } from './media/index.ts';
import type { LevelProblem, Medium } from './media/types.ts';
import { modifiersFor } from './modifiers.ts';
import { openClams } from './pickups/clams.ts';
import { updateLoose } from './pickups/loose.ts';
import { collectLoosePearls, collectPearls } from './pickups/pearls.ts';
import { canDash, DASH_METER, rechargeDash, spendDash } from './powerups/dash-meter.ts';
import { advanceDecoys } from './powerups/decoys.ts';
import { selectedSlot, slotItems } from './powerups/inventory.ts';
import { advanceRiptides } from './powerups/riptides.ts';
import { applyUndertow } from './powerups/undertow.ts';
import { driveDash, sustainItems, useItems } from './powerups/use.ts';
import { moveBody, separateRacers } from './race/collide.ts';
import { ramCoral } from './race/coral.ts';
import { buildProgressField } from './race/flowfield.ts';
import { rivalProfileOf, type Seat, seatsFor } from './race/seats.ts';
import { advanceClock, checkRaceEnd, recordFinishes, updatePlaces, updateProgress } from './race/standings.ts';
import { activeHumans, activeRacers, centreOf, noItems } from './racers.ts';
import { controlledIntent, floatTrapped, tickStatuses } from './status.ts';
import {
  type CharacterId,
  type Difficulty,
  type EnemyKind,
  type Intent,
  type Level,
  type MoveModifiers,
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
  /**
   * Slots people race in, each driven by its own entry in `stepRace`'s inputs. Default `['player']`.
   * Easy allows only that default, since its guide follows the player slot.
   */
  humans?: readonly RacerId[];
  /** Who races in each slot. Slots left out are drawn from the rest by seed. `characters.player` is `character`. */
  characters?: Partial<Record<RacerId, CharacterId>>;
  /** How hard the rivals race. Default 'hard', so tests that don't say keep the tuning they were written against; the engine always passes the saved setting. */
  difficulty?: Difficulty;
}

const IDLE: Intent = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };

/**
 * Sets up a race on `course` at the countdown's first tick, with every clam ready, every pearl
 * in play, jellies at their homes and nothing held or in flight. Who sits in each slot and how it
 * is driven comes from `seatsFor`, which draws the cast from the `roster` stream.
 *
 * @param course A shipped course, or one registered for a test (`courseFromLevel`).
 * @param events Usually the engine's EventLog, so one stream holds race, menu and save events.
 * @throws {LevelError} When the medium can't race the level (`Medium.validateLevel`), located at the
 *   first problem, with any others appended to the message after `; `.
 * @throws {Error} When `course` isn't the course its id is registered to (unregistered, or a copy
 *   with changes), since the world keeps only the id and reads the rest back from the registry.
 * @throws {Error} When the course names a medium that is neither shipped nor registered.
 * @throws {Error} When `humans` is empty, repeats a slot, names an unknown slot, or is not
 *   `['player']` on Easy; when `characters` names an unknown slot or gives one character twice; or
 *   when `character` and `characters.player` differ.
 */
export function createWorld(course: Course, events: EventSink<GameEvent>, options: WorldOptions): World {
  requireRegistered(course);
  const medium = mediumById(course.medium);
  if (!medium) throw new Error(`Course '${course.id}' names unknown medium '${course.medium}'`);
  const level = levelOf(course);
  const broken = new Set<number>();
  const nav = medium.buildNav(level, broken);
  throwOnProblems(medium.validateLevel(level, nav));
  const difficulty = options.difficulty ?? 'hard';
  const rngs = createRngs(options.seed);
  const { humans, seats } = seatsFor(options, rngs.roster, difficulty);
  const recentEvents: GameEvent[] = [];
  const world: World = {
    course: course.id,
    medium: medium.id,
    level,
    difficulty,
    humans,
    progress: buildProgressField(level),
    nav,
    broken,
    racers: seats.map((seat) => createRacer(level, medium, seat)),
    race: { phase: 'countdown', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: options.endsWhen ?? 'player' },
    tick: 0,
    rngs,
    events: recordingInto(events, recentEvents),
    recentEvents,
    contacts: new Set(),
    clams: level.clams.map((tile) => ({ tile: { ...tile }, closedFor: 0 })),
    pearlsTaken: new Set(),
    loosePearls: [],
    loose: [],
    inks: [],
    bubbles: [],
    jellies: level.jellies.map((home) => ({ home: { ...home }, phase: 0, stunned: 0 })),
    enemies: createEnemies(level),
    squids: [],
    riptides: [],
    decoys: [],
    guide: { bestSteer: Number.POSITIVE_INFINITY, stuckTicks: 0, helpTicks: 0 },
  };
  // Catch-up reads progress on the first racing tick, before stepWorld updates it.
  updateProgress(world);
  return world;
}

/**
 * Checks that `course` is the very course its id looks up, so the race can't silently run on the
 * registered course's level or tuning instead.
 *
 * @throws {Error} When the id is unknown or registered to a different course object.
 */
function requireRegistered(course: Course): void {
  if (courseById(course.id) === course) return;
  throw new Error(
    `Course '${course.id}' is not the registered course with that id; add it to COURSES or call registerCourse with it`,
  );
}

/** Throws a LevelError at the first problem, naming the rest after it; does nothing for none. */
function throwOnProblems(problems: readonly LevelProblem[]): void {
  const [first, ...rest] = problems;
  if (!first) return;
  const message = [first, ...rest].map((problem) => problem.message).join('; ');
  throw new LevelError(message, first.row, first.col);
}

/** A racer at its start, as `seat` says, with nothing held and the dash meter full. */
function createRacer(level: Level, medium: Medium, { id, index, character, profile, driver }: Seat): Racer {
  const start = level.starts[index];
  if (!start) throw new LevelError(`Level has no start ${index + 1}`);
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
    kickCharges: DASH_METER.charges,
    kickRecharge: 0,
    progress: Number.POSITIVE_INFINITY,
    place: index + 1,
    finished: null,
    ai: driver === 'person' ? null : createAiMemory(medium),
    profile,
    // Only set for a bot, so a default world's racers (and its hash) are as they were.
    ...(driver === 'testBot' ? { testBot: true as const } : {}),
    ...noItems(stackMaxFor({ character })),
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

/**
 * Advances the race by one fixed tick with each human slot's own input. A human slot with no entry
 * in `inputs` is handed to the AI on that tick and stays with it; entries for AI-driven and
 * finished racers are ignored.
 */
export function stepRace(world: World, inputs: Partial<Record<RacerId, TickInput>>, dt: number): void {
  world.tick++;
  if (world.race.phase === 'finished') return;
  takeOverAbsentHumans(world, inputs);
  if (advanceClock(world)) return;

  const racing = activeRacers(world);
  const medium = mediumOf(world);
  trackGuide(world, inputs.player ?? IDLE);
  // Every racer's intent is asked for even while it can't act, so AI rng draws per tick never vary.
  const intents = racing.map((racer) => controlledIntent(racer, intentFor(world, racer, inputs)));
  racing.forEach((racer, index) => {
    moveRacer(world, medium, racer, dashGated(racer, intents[index] ?? IDLE), modifiersFor(world, racer), dt);
  });
  spendKickedDashes(world);
  if (medium.racerCollision === 'solid') {
    separateRacers(racing, world.contacts, world.events, bumpMassFor, (a, b) => onBump(world, a, b));
  }

  useItems(world, racing, intents);
  sustainItems(world, racing);
  advanceProjectiles(world, racing, dt);
  advanceSquids(world, racing, dt);
  advanceRiptides(world);
  advanceDecoys(world, dt);
  moveJellies(world);
  stepEnemies(world, racing);
  resolveContacts(world, racing);
  openClams(world, racing);
  collectPearls(world, racing);
  collectLoosePearls(world, racing);
  updateLoose(world, racing, dt);
  for (const racer of racing) {
    tickStatuses(racer);
    rechargeDash(world, racer);
  }
  // splice(0) empties the buffer the event sink appends to, so each event reaches abilities once.
  onWorldEvents(world, world.recentEvents.splice(0));
  tickAbilities(world, racing);

  updateProgress(world);
  recordFinishes(world);
  updatePlaces(world);
  checkRaceEnd(world);
}

/**
 * Advances the race by one fixed tick. `input` drives the player's racer unless a bot does. In a
 * world whose `humans` is not exactly `['player']`, every other human slot has no input here and is
 * taken over by the AI on its first tick; step such worlds with `stepRace`.
 */
export function stepWorld(world: World, input: TickInput, dt: number): void {
  stepRace(world, { player: input }, dt);
}

/**
 * Hands every unfinished racer a person still drives (never a test bot) to the AI when `inputs` has no entry for it,
 * in RACER_IDS order: AI memory, its character's rival profile, `tookOverAt` and one `racer.takeover`.
 */
function takeOverAbsentHumans(world: World, inputs: Partial<Record<RacerId, TickInput>>): void {
  const medium = mediumOf(world);
  for (const racer of activeHumans(world)) {
    if (racer.testBot || racer.finished || inputs[racer.id] !== undefined) continue;
    racer.ai = createAiMemory(medium);
    racer.profile = rivalProfileOf(racer.id, racer.character);
    racer.tookOverAt = world.tick;
    world.events.emit({ type: 'racer.takeover', id: racer.id });
  }
}

/** A person-driven racer's intent from its own entry in `inputs`; an AI-driven racer's from its AI. */
function intentFor(world: World, racer: Racer, inputs: Partial<Record<RacerId, TickInput>>): Intent {
  if (!racer.ai) return assistedIntent(world, racer, inputs[racer.id] ?? IDLE);
  return rivalIntent(world, racer, world.rngs[`ai.${racer.id}`]);
}

/** The intent with its kick dropped when the racer's dash meter is empty, so no medium can kick it. */
function dashGated(racer: Racer, intent: Intent): Intent {
  return intent.kick && !canDash(racer) ? { ...intent, kick: false } : intent;
}

/**
 * Spends a dash charge for every `racer.kicked` emitted this tick (the movement loop's kicks), and
 * opens that racer's bonk window (`status.bonking`) for enemies.
 */
function spendKickedDashes(world: World): void {
  for (const event of world.recentEvents) {
    if (event.type !== 'racer.kicked') continue;
    const racer = world.racers.find((candidate) => candidate.id === event.id);
    if (!racer) continue;
    spendDash(world, racer);
    racer.status.bonking = ENEMY.bonkTicks;
  }
}

/**
 * One racer's velocity for the tick (the medium's response to its intent, then a dash or a trapped
 * drift overriding it), then its move, breaking the coral ahead first when its ability rams through coral.
 */
function moveRacer(world: World, medium: Medium, racer: Racer, intent: Intent, mods: MoveModifiers, dt: number): void {
  const env = medium.sampleEnvironment(world, racer);
  medium.applyIntent(racer, intent, env, effectiveTuning(world), mods, world.events, dt);
  driftLatched(racer, dt);
  applyUndertow(world, racer, dt);
  driveDash(world, racer);
  floatTrapped(world, racer);
  if (breaksCoralOnContact(racer)) ramCoral(world, racer, dt);
  moveBody(racer.body, world.level, world.broken, dt);
}

/**
 * Small, stable view for the CLI summary and scenario assertions, about the racer in slot `id`
 * (slot 1 when omitted). `items` has one entry per slot, `'kind:charges'` or null, and `selected`
 * is the selected slot.
 *
 * @throws {Error} When the world has no racer in slot `id`; createWorld always fills every slot.
 */
export function summarize(world: World, id: RacerId = 'player') {
  const player = world.racers.find((racer) => racer.id === id);
  if (!player) throw new Error(`World has no racer in slot '${id}'; build worlds with createWorld`);
  return {
    tick: world.tick,
    phase: world.race.phase,
    raceTick: world.race.raceTick,
    place: `${player.place}/${world.racers.length}`,
    progress: Number.isFinite(player.progress) ? Math.round(player.progress) : null,
    finished: player.finished !== null,
    player: { tile: centreTile(player), kickReady: player.kickCooldown === 0 },
    dashCharges: player.kickCharges,
    items: slotItems(player).map((item) => (item ? `${item.kind}:${item.charges}` : null)),
    selected: selectedSlot(player),
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

const ENEMY_CHARS: Record<EnemyKind, string> = { shark: 'S', eel: 'E', crab: 'K' };

/**
 * Characters for things on the course, by "x,y" tile: `*` urchin, `o` pearl still in play,
 * `?` clam ready to open, `_` clam shut after opening, `j` jelly (at its home tile), `m` Mimic decoy,
 * `s` Homing Squid (the last two at the tile holding their centre), `o` for a loose pearl too, and
 * enemies still in play as `S` shark, `E` eel, `K` crab at the tile holding their centre.
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
    ...world.loosePearls.map(({ at }): [string, string] => [pixelTileKey(at), 'o']),
    ...world.enemies
      .filter((enemy) => enemy.mode !== 'defeated')
      .map((enemy): [string, string] => [pixelTileKey(enemy.at), ENEMY_CHARS[enemy.kind]]),
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
