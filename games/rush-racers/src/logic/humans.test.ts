/**
 * Races with more than one person in them: which slots are human, who drives each, the AI taking
 * over a slot whose input stops, and when such a race ends and what it announces.
 */
import { createRng, EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, PLAYER_PROFILE } from './ai/profiles.ts';
import { botDriver } from './balance/bot-driver.ts';
import { assignCharacters, CHARACTERS } from './characters.ts';
import { DEFAULT_COURSE } from './courses/index.ts';
import type { GameEvent } from './events.ts';
import { hashWorld } from './hash.ts';
import { COUNTDOWN_TICKS, DNF_GRACE_TICKS } from './race/standings.ts';
import { courseFromLevel, eventsIn, hold, IDLE, placeOnTile, racerOf, ticksOf } from './test-world.ts';
import { CHARACTER_IDS, type CharacterId, type RacerId, RNG_SALTS, TILE, type TickInput, type World } from './types.ts';
import { createWorld, stepRace, stepWorld, type WorldOptions } from './world.ts';

type Inputs = Partial<Record<RacerId, TickInput>>;

/** Columns of open water between the start column and the finish column. */
const LANE_LENGTH = 120;
/** The finish column in `LANES`: the wall, the start, then the open water. */
const FINISH_COLUMN = LANE_LENGTH + 2;

const WALL = '#'.repeat(FINISH_COLUMN + 2);

/**
 * Four lanes walled off from each other, so nobody bumps anyone, and long enough that nobody
 * reaches the line unless a test puts them there. Start n is on row 2n - 1.
 */
const LANES = [WALL, ...[1, 2, 3, 4].flatMap((start) => [`#${start}${'.'.repeat(LANE_LENGTH)}F#`, WALL])].join('\n');

/** One course for every test, since a world's hash includes its course id. */
const LANES_COURSE = courseFromLevel(LANES);

/** The row of racer `id`'s lane in `LANES`. */
function laneRow(world: World, id: RacerId): number {
  return 2 * world.racers.findIndex((racer) => racer.id === id) + 1;
}

const RIGHT = hold({ x: 1, y: 0 });

/** A world on `LANES`, still in its countdown, with its own event log. */
function countdownOn(options: Partial<WorldOptions> = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(LANES_COURSE, log, { seed: 1, ...options });
  return { world, log };
}

/** A world on `LANES` already racing (countdown skipped, nothing stepped yet). */
function racingOn(options: Partial<WorldOptions> = {}) {
  const race = countdownOn(options);
  race.world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  return race;
}

/** Steps `ticks` times with the same inputs, stamping events with the tick they happen on. */
function stepWith(world: World, log: EventLog<GameEvent>, inputs: Inputs, ticks = 1): void {
  for (let i = 0; i < ticks; i++) {
    log.tick = world.tick + 1;
    stepRace(world, inputs, TICK_DT);
  }
}

/** Puts racer `id` on its own lane just past the finish line, at rest. */
function acrossTheLine(world: World, id: RacerId): void {
  placeOnTile(racerOf(world, id), FINISH_COLUMN, laneRow(world, id));
}

/** Puts racer `id` on its own lane `tiles` columns past its start, at rest. */
function upTheLane(world: World, id: RacerId, tiles: number): void {
  placeOnTile(racerOf(world, id), 1 + tiles, laneRow(world, id));
}

const rivalProfile = (world: World, id: RacerId) => ({ id, ...CHARACTERS[racerOf(world, id).character].profile });

describe('who races as a human', () => {
  it('defaults to the player slot alone, and stepWorld races exactly as stepRace with its input', () => {
    const viaStepWorld = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
    const viaStepRace = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
    for (let tick = 0; tick < 400; tick++) {
      const input = hold({ x: 1, y: tick % 50 < 25 ? 1 : -1 }, { kick: tick % 45 === 0, use: tick % 20 === 0 });
      stepWorld(viaStepWorld, input, TICK_DT);
      stepRace(viaStepRace, { player: input }, TICK_DT);
    }

    expect(viaStepWorld.humans).toEqual(['player']);
    expect(hashWorld(viaStepWorld)).toBe(hashWorld(viaStepRace));
  });

  it('refuses to step a world with humans other than the player alone through stepWorld', () => {
    const { world } = countdownOn({ humans: ['tess'] });

    expect(() => stepWorld(world, IDLE, TICK_DT)).toThrow(
      "stepWorld drives slot player only; this world's humans are [tess]; use stepRace",
    );
    expect(world.tick).toBe(0);
  });

  it('stores human slots in slot order, each with the player profile and no AI, and the rest as rivals', () => {
    const { world } = countdownOn({ humans: ['tess', 'player'] });

    expect(world.humans).toEqual(['player', 'tess']);
    for (const id of ['player', 'tess'] as const) {
      expect(racerOf(world, id).ai, id).toBeNull();
      expect(racerOf(world, id).profile, id).toEqual({ ...PLAYER_PROFILE, id });
    }
    for (const id of ['squib', 'bo'] as const) {
      expect(racerOf(world, id).ai, id).not.toBeNull();
      expect(racerOf(world, id).profile, id).toEqual(rivalProfile(world, id));
    }
  });

  it("lets the AI drive the player slot as its character's rival when only tess is human", () => {
    const { world } = countdownOn({ humans: ['tess'] });
    const player = racerOf(world, 'player');

    expect(player.ai).not.toBeNull();
    expect(player.profile).toEqual(rivalProfile(world, 'player'));
    expect(racerOf(world, 'tess').ai).toBeNull();
  });

  it.each<[string, Partial<WorldOptions>, RegExp]>([
    ['no humans', { humans: [] }, /humans is empty/],
    ['a repeated slot', { humans: ['player', 'tess', 'player'] }, /humans repeats slot 'player'/],
    ['an unknown slot', { humans: ['player', 'zed' as RacerId] }, /humans names unknown slot 'zed'/],
    ['one character in two slots', { characters: { tess: 'gil', bo: 'gil' } }, /characters gives 'gil' to two slots/],
    [
      'character and characters.player disagreeing',
      { character: 'nib', characters: { player: 'gil' } },
      /character 'nib' and characters.player 'gil' disagree/,
    ],
    ['two humans on Easy', { difficulty: 'easy', humans: ['player', 'tess'] }, /\[player, tess\] on Easy/],
    [
      'a player bot without the player slot human',
      { humans: ['tess'], playerBot: BOT_PROFILES.expert },
      /playerBot drives the player slot, but humans is \[tess\]; add 'player' to humans or drop playerBot/,
    ],
    [
      'an unknown character in characters',
      { characters: { tess: 'zed' as CharacterId } },
      /characters gives slot 'tess' unknown character 'zed'; characters are rudy, /,
    ],
    [
      'an unknown character in character',
      { character: 'zed' as CharacterId },
      /character is unknown character 'zed'; characters are rudy, /,
    ],
  ])('refuses %s, naming the bad value', (_case, options, message) => {
    expect(() => countdownOn(options)).toThrow(message);
  });
});

describe('characters per slot', () => {
  it('keeps the chosen characters in their slots and draws the others from the rest, none twice', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { world } = countdownOn({ seed, characters: { player: 'gil', tess: 'nib' } });
      const cast = world.racers.map((racer) => racer.character);

      expect(cast.slice(0, 2), `seed ${seed}`).toEqual(['gil', 'nib']);
      expect(new Set(cast).size, `seed ${seed}: ${cast.join(', ')}`).toBe(4);
    }
  });

  it.each(CHARACTER_IDS)(
    "fields today's line-up for each seed when only the player's character, %s, is given",
    (character) => {
      for (const seed of [1, 7, 23]) {
        const roster = createRng((Math.imul(seed, 0x9e3779b1) ^ RNG_SALTS.roster) >>> 0);
        const { world } = countdownOn({ seed, character });

        const cast = assignCharacters(roster, { player: character });

        expect(world.racers[0]?.character).toBe(character);
        expect(world.racers.map((racer) => racer.character)).toEqual(world.racers.map((racer) => cast[racer.id]));
      }
    },
  );
});

describe('several humans each driving their own racer', () => {
  it('moves two humans holding right by the same distance from their starts', () => {
    // Neither character's ability changes how hard it swims, so only the slots differ.
    const characters = { player: 'rudy', tess: 'nib' } as const;
    const { world, log } = racingOn({ humans: ['player', 'tess'], difficulty: 'normal', characters });
    const startX = (id: RacerId) => racerOf(world, id).body.x;
    const starts = { player: startX('player'), tess: startX('tess') };
    stepWith(world, log, { player: RIGHT, tess: RIGHT }, 300);

    const moved = (id: 'player' | 'tess') => racerOf(world, id).body.x - starts[id];
    expect(moved('player')).toBeGreaterThan(10 * TILE);
    expect(moved('tess')).toBe(moved('player'));
  });

  it("changes only tess when tess's input differs", () => {
    const pushed = racingOn({ humans: ['player', 'tess'] });
    const idle = racingOn({ humans: ['player', 'tess'] });
    stepWith(pushed.world, pushed.log, { player: RIGHT, tess: RIGHT });
    stepWith(idle.world, idle.log, { player: RIGHT, tess: IDLE });

    for (const id of ['player', 'squib', 'bo'] as const) {
      expect(racerOf(pushed.world, id).body, id).toEqual(racerOf(idle.world, id).body);
    }
    expect(racerOf(pushed.world, 'tess').body.x).toBeGreaterThan(racerOf(idle.world, 'tess').body.x);
  });

  it('lets a playerBot drive the player slot whatever its input entry says', () => {
    const pressed = racingOn({ playerBot: BOT_PROFILES.expert });
    const absent = racingOn({ playerBot: BOT_PROFILES.expert });
    stepWith(pressed.world, pressed.log, { player: hold({ x: -1, y: 1 }, { kick: true, use: true }) }, 200);
    stepWith(absent.world, absent.log, {}, 200);

    expect(hashWorld(pressed.world)).toBe(hashWorld(absent.world));
    expect(eventsIn(absent.log, 'racer.takeover')).toEqual([]);

    // The no-dash harness lifts the player's AI memory out between its own calls.
    const noDashGiven = racingOn({ playerBot: BOT_PROFILES.noDash });
    const noDashAbsent = racingOn({ playerBot: BOT_PROFILES.noDash });
    botDriver(noDashGiven.world, BOT_PROFILES.noDash);
    botDriver(noDashAbsent.world, BOT_PROFILES.noDash);
    stepWith(noDashGiven.world, noDashGiven.log, { player: IDLE }, 50);
    stepWith(noDashAbsent.world, noDashAbsent.log, {}, 50);

    expect(eventsIn(noDashAbsent.log, 'racer.takeover')).toEqual([]);
    expect(hashWorld(noDashAbsent.world)).toBe(hashWorld(noDashGiven.world));
  });

  it('ignores an input entry for a rival slot', () => {
    const steered = racingOn();
    const plain = racingOn();
    stepWith(steered.world, steered.log, { player: RIGHT, squib: hold({ x: -1, y: 0 }, { kick: true }) }, 200);
    stepWith(plain.world, plain.log, { player: RIGHT }, 200);

    expect(hashWorld(steered.world)).toBe(hashWorld(plain.world));
  });
});

describe('the AI taking over a human slot', () => {
  it("takes over a human with no input entry on that tick, as its character's rival, and swims it on", () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    stepWith(world, log, { player: IDLE, tess: IDLE }, 5);
    const tess = racerOf(world, 'tess');
    const parkedX = tess.body.x;
    stepWith(world, log, { player: IDLE });

    expect(tess.ai).not.toBeNull();
    expect(tess.tookOverAt).toBe(world.tick);
    expect(tess.profile).toEqual(rivalProfile(world, 'tess'));
    expect(eventsIn(log, 'racer.takeover')).toEqual([{ type: 'racer.takeover', id: 'tess' }]);
    expect(ticksOf(log, 'racer.takeover')).toEqual([world.tick]);

    stepWith(world, log, { player: IDLE }, 60);
    expect(tess.body.x).toBeGreaterThan(parkedX + TILE);
  });

  it('takes over once and ignores the slot input from then on, whether it comes back or not', () => {
    const returning = racingOn({ humans: ['player', 'tess'] });
    const gone = racingOn({ humans: ['player', 'tess'] });
    for (const { world, log } of [returning, gone]) stepWith(world, log, { player: IDLE });
    stepWith(returning.world, returning.log, { player: IDLE, tess: hold({ x: -1, y: 1 }, { kick: true }) }, 100);
    stepWith(gone.world, gone.log, { player: IDLE }, 100);

    expect(eventsIn(returning.log, 'racer.takeover')).toEqual([{ type: 'racer.takeover', id: 'tess' }]);
    expect(eventsIn(gone.log, 'racer.takeover')).toEqual([{ type: 'racer.takeover', id: 'tess' }]);
    expect(hashWorld(returning.world)).toBe(hashWorld(gone.world));
  });

  it('takes over during the countdown the same way', () => {
    const { world, log } = countdownOn({ humans: ['player', 'tess'] });
    const tess = racerOf(world, 'tess');
    const startX = tess.body.x;
    stepWith(world, log, { player: IDLE }, 10);

    expect(world.race.phase).toBe('countdown');
    expect(tess.ai).not.toBeNull();
    expect(tess.tookOverAt).toBe(1);
    expect(tess.profile).toEqual(rivalProfile(world, 'tess'));
    expect(ticksOf(log, 'racer.takeover')).toEqual([1]);

    stepWith(world, log, { player: IDLE }, COUNTDOWN_TICKS + 60);
    expect(tess.body.x).toBeGreaterThan(startX + TILE);
  });

  it('leaves a human who has finished alone when its input stops', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    acrossTheLine(world, 'tess');
    stepWith(world, log, { player: IDLE, tess: IDLE });
    stepWith(world, log, { player: IDLE }, 10);

    expect(racerOf(world, 'tess').finished).not.toBeNull();
    expect(racerOf(world, 'tess').ai).toBeNull();
    expect(racerOf(world, 'tess').tookOverAt).toBeUndefined();
    expect(eventsIn(log, 'racer.takeover')).toEqual([]);
  });
});

describe('the end of a race with two humans', () => {
  const both: Inputs = { player: IDLE, tess: IDLE };

  it('runs on when the first human finishes and ends on the tick the second does', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    acrossTheLine(world, 'player');
    stepWith(world, log, both, 20);
    expect(world.race.phase).toBe('racing');

    acrossTheLine(world, 'tess');
    stepWith(world, log, both);
    expect(world.race.phase).toBe('finished');
    expect(ticksOf(log, 'race.finished')).toEqual([world.tick]);
  });

  it('ends when the player finishes while tess is taken over and still racing', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    stepWith(world, log, { player: IDLE }, 20);
    expect(world.race.phase).toBe('racing');

    acrossTheLine(world, 'player');
    stepWith(world, log, { player: IDLE });
    expect(racerOf(world, 'tess').finished).toBeNull();
    expect(world.race.phase).toBe('finished');
  });

  it('ends on the first tick after every human is taken over', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    stepWith(world, log, both, 5);
    stepWith(world, log, {});

    expect(ticksOf(log, 'race.finished')).toEqual([world.tick]);
  });

  it('starts the grace only once one active human is left, then ends it DNF_GRACE_TICKS later', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    acrossTheLine(world, 'squib');
    acrossTheLine(world, 'bo');
    stepWith(world, log, both, 10);
    expect(world.race.rivalsDoneAt).toBeNull();

    acrossTheLine(world, 'tess');
    stepWith(world, log, both);
    const tessHome = world.race.raceTick;
    expect(world.race.rivalsDoneAt).toBe(tessHome);

    stepWith(world, log, both, DNF_GRACE_TICKS - 1);
    expect(world.race.phase).toBe('racing');
    stepWith(world, log, both);
    expect(world.race).toMatchObject({ phase: 'finished', result: { playerTicks: null } });
  });

  it('waits for a taken-over human as for a rival before starting the grace', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    stepWith(world, log, { player: IDLE });
    acrossTheLine(world, 'squib');
    acrossTheLine(world, 'bo');
    stepWith(world, log, { player: IDLE }, 10);
    expect(world.race.rivalsDoneAt).toBeNull();

    acrossTheLine(world, 'tess');
    stepWith(world, log, { player: IDLE });
    expect(world.race.rivalsDoneAt).toBe(world.race.raceTick);
  });

  it('reports slot player in race.finished, wherever the other human placed', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    acrossTheLine(world, 'tess');
    stepWith(world, log, both, 5);
    acrossTheLine(world, 'player');
    stepWith(world, log, both);
    const playerHome = world.race.raceTick;

    const finished = eventsIn(log, 'race.finished');
    expect(finished).toMatchObject([{ type: 'race.finished', playerPlace: 2, playerTicks: playerHome }]);
    expect(world.race.result?.standings.slice(0, 2)).toEqual(['tess', 'player']);
  });
});

describe('place announcements', () => {
  it('announces each active human whose place changed, in slot order, never a rival or a taken-over human', () => {
    const { world, log } = racingOn({ humans: ['player', 'tess'] });
    upTheLane(world, 'bo', 60);
    upTheLane(world, 'player', 40);
    upTheLane(world, 'tess', 20);
    stepWith(world, log, { player: IDLE, tess: IDLE });
    expect(eventsIn(log, 'player.place')).toEqual([
      { type: 'player.place', id: 'player', place: 2 },
      { type: 'player.place', id: 'tess', place: 3 },
    ]);

    upTheLane(world, 'tess', 80);
    stepWith(world, log, { player: IDLE });
    expect(eventsIn(log, 'player.place').slice(2)).toEqual([{ type: 'player.place', id: 'player', place: 3 }]);
  });
});
