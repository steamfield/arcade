/**
 * Run's physics: running, jumping and the dash. Speeds are measured on bare racers through
 * `applyRunIntent`; jumps and the dash meter through `createWorld` on small inline courses, where
 * the rivals race in their own lane walled off above the player's.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { jumpMulFor } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import { eventsIn, hold, IDLE, step } from '../../test-world.ts';
import {
  CHARACTER_IDS,
  type CharacterId,
  type Intent,
  type MoveModifiers,
  type Racer,
  TILE,
  type Vec,
} from '../../types.ts';
import { applyIntent as applySwimIntent } from '../swim/physics.ts';
import { SWIM_TUNING } from '../swim/tuning.ts';
import { bareRacer, type LaneWorldOptions, laneWorld, stepBare, ticksIn, ticksOfRacer } from '../test-kit.ts';
import { type RunEnv, runMotion } from './data.ts';
import { applyRunIntent, createRunMotion } from './physics.ts';
import { RUN_TUNING } from './tuning.ts';

const BASE: MoveModifiers = RUN_TUNING.base;
const ON_GROUND: RunEnv = { kind: 'run', grounded: true, wind: null, inMud: false };
const IN_AIR: RunEnv = { ...ON_GROUND, grounded: false };
const RIGHT: Vec = { x: 1, y: 0 };
const UP: Vec = { x: 0, y: -1 };
const UP_RIGHT: Vec = { x: 1, y: -1 };
const STILL: Vec = { x: 0, y: 0 };
const { jumpSpeed, gravity, bufferTicks, coyoteTicks } = RUN_TUNING.extra;

/** A runner in slot 'player' at rest near the top-left, outside any world. */
const bareRunner = (character: CharacterId = 'rudy') => bareRacer(createRunMotion, { character, x: 40, y: 40 });

/** Applies run to a bare racer for `ticks` ticks; returns `vx` after each and the events emitted. */
function runFor(
  racer: Racer,
  ticks: number,
  intent: Intent,
  env: RunEnv = ON_GROUND,
  mods: MoveModifiers = BASE,
): { speeds: number[]; log: EventLog<GameEvent> } {
  const { samples, log } = stepBare(
    applyRunIntent,
    racer,
    ticks,
    intent,
    { env, tuning: RUN_TUNING, mods },
    ({ body }) => body.vx,
  );
  return { speeds: samples, log };
}

/** A racing run world on `playerRows`; the rivals race in their own lane walled off above. */
const runWorld = (playerRows: readonly string[], options: LaneWorldOptions = {}) =>
  laneWorld('run', playerRows, options);

/** A flat lane 6 tiles high and 16 wide. */
const FLAT = [
  '...............F',
  '...............F',
  '...............F',
  '...............F',
  '...............F',
  '.1.............F',
  '################',
];

/** Ticks for a racer at its start to settle onto the floor. */
const SETTLE = 10;

/** The player's highest rise above where it stood, in px, over `ticks` ticks of `input` and then idle. */
function riseOf(input: Intent, inputTicks: number, character: CharacterId = 'rudy'): number {
  const { world, log, player } = runWorld(FLAT, { character });
  step(world, log, SETTLE);
  const standing = player.body.y;
  let top = standing;
  for (let tick = 0; tick < 90; tick++) {
    step(world, log, 1, tick < inputTicks ? input : IDLE);
    top = Math.min(top, player.body.y);
  }
  return standing - top;
}

describe('running', () => {
  it('reaches running speed within 0.3 s holding right and never passes it', () => {
    const { speeds } = runFor(bareRunner(), 120, hold(RIGHT));

    expect(speeds[ticksIn(0.3) - 1]).toBe(RUN_TUNING.extra.runSpeed);
    expect(Math.max(...speeds)).toBe(RUN_TUNING.extra.runSpeed);
  });

  it('never runs or dashes faster than maxSpeed, however strong its modifiers', () => {
    const strong = { ...BASE, forceMul: 6, kickMul: 3 };
    const { speeds } = runFor(bareRunner(), 90, hold(RIGHT, { kick: true }), ON_GROUND, strong);

    expect(Math.max(...speeds)).toBe(RUN_TUNING.maxSpeed);
  });

  it('stops within 0.2 s of letting go', () => {
    const racer = bareRunner();
    racer.body.vx = RUN_TUNING.extra.runSpeed;
    const { speeds } = runFor(racer, ticksIn(0.2), hold(STILL));

    expect(speeds.at(-1)).toBe(0);
  });

  it('runs 20 % faster with forceMul 1.4, half its deviation', () => {
    const { speeds } = runFor(bareRunner(), 60, hold(RIGHT), ON_GROUND, { ...BASE, forceMul: 1.4 });

    expect(speeds.at(-1)).toBeCloseTo(RUN_TUNING.extra.runSpeed * 1.2, 9);
  });

  it.each([1, 2])('slows by ground friction times dragMul %s', (dragMul) => {
    const racer = bareRunner();
    racer.body.vx = RUN_TUNING.extra.runSpeed;
    const { speeds } = runFor(racer, 3, hold(STILL), ON_GROUND, { ...BASE, dragMul });

    expect(speeds.at(-1)).toBeCloseTo(RUN_TUNING.extra.runSpeed - 3 * RUN_TUNING.drag * dragMul * TICK_DT, 9);
  });

  it('settles slower in mud', () => {
    const { speeds } = runFor(bareRunner(), 60, hold(RIGHT), { ...ON_GROUND, inMud: true });

    expect(speeds.at(-1)).toBeCloseTo(RUN_TUNING.extra.runSpeed * RUN_TUNING.extra.mudSpeedMul, 9);
  });

  it('slows to mud speed within 0.12 s of running into mud, and to running pace as soon as a gust behind it drops', () => {
    const { runSpeed, windSpeed, mudSpeedMul } = RUN_TUNING.extra;
    const intoMud = bareRunner();
    intoMud.body.vx = runSpeed;
    const leavingGust = bareRunner();
    leavingGust.body.vx = runSpeed + windSpeed;

    expect(runFor(intoMud, ticksIn(0.12), hold(RIGHT), { ...ON_GROUND, inMud: true }).speeds.at(-1)).toBeCloseTo(
      runSpeed * mudSpeedMul,
      9,
    );
    expect(runFor(leavingGust, ticksIn(0.12), hold(RIGHT)).speeds.at(-1)).toBe(runSpeed);
  });

  it('is carried by a gust standing still, and helped or held back by one while running', () => {
    const drift = (wind: Vec, move: Vec) =>
      runFor(bareRunner(), 60, hold(move), { ...ON_GROUND, wind }).speeds.at(-1) ?? Number.NaN;
    const { runSpeed, windSpeed } = RUN_TUNING.extra;

    expect([drift(RIGHT, STILL), drift(RIGHT, RIGHT), drift({ x: -1, y: 0 }, RIGHT)]).toEqual([
      windSpeed,
      runSpeed + windSpeed,
      runSpeed - windSpeed,
    ]);
  });

  it('is pushed along a Tailwind lane like a gust', () => {
    const speedAfterRunning = (inLane: boolean) => {
      const { world, log, player } = runWorld(FLAT);
      if (inLane) {
        const lane = { x: 0, y: 3 * TILE, w: 16 * TILE, h: 6 * TILE, dir: { x: 1, y: 0 } };
        world.riptides.push({ ...lane, ttl: 600, owner: 'tess' });
      }
      step(world, log, SETTLE);
      step(world, log, 40, hold(RIGHT));
      return player.body.vx;
    };

    expect(speedAfterRunning(true)).toBeGreaterThan(speedAfterRunning(false));
  });

  it('is lifted by an updraft and pushed down by a downdraft', () => {
    const fallAfter = (wind: Vec | null) => {
      const racer = bareRunner();
      runFor(racer, 10, hold(STILL), { ...IN_AIR, wind });
      return racer.body.vy;
    };

    expect(fallAfter(UP)).toBeLessThan(0);
    expect(fallAfter({ x: 0, y: 1 })).toBeGreaterThan(fallAfter(null));
  });
});

describe('jumping', () => {
  it('jumps on Up without dashing, and a held jump clears a 3-tile wall', () => {
    const { world, log, player } = runWorld([
      '...............F',
      '...............F',
      '...............F',
      '...............F',
      '...............F',
      '...............F',
      '.......#.......F',
      '.......#.......F',
      '.....1.#.......F',
      '################',
    ]);
    step(world, log, SETTLE);
    step(world, log, 90, hold(UP_RIGHT));

    expect({ jumps: ticksOfRacer(log, 'racer.jumped').length, dashes: ticksOfRacer(log, 'racer.kicked') }).toEqual({
      jumps: 1,
      dashes: [],
    });
    expect(player.body.x).toBeGreaterThan(8 * TILE);
  });

  it('hops at least 1.5 tiles lower when Up is tapped for 2 ticks than when held', () => {
    const held = riseOf(hold(UP), 90);
    const tapped = riseOf(hold(UP), 2);

    expect(held).toBeGreaterThan(3 * TILE);
    expect(held - tapped).toBeGreaterThanOrEqual(1.5 * TILE);
  });

  it('needs a fresh press to jump again after landing', () => {
    const { world, log } = runWorld(FLAT);
    step(world, log, SETTLE);
    step(world, log, 120, hold(UP));

    expect(ticksOfRacer(log, 'racer.jumped')).toHaveLength(1);
  });

  describe('buffer', () => {
    /** Drops the player from 4 tiles up, pressing Up on `pressTick`; returns the ticks it jumped on. */
    function dropPressingAt(pressTick: number | null) {
      const { world, log, player } = runWorld(FLAT);
      player.body.y -= 4 * TILE;
      let landedOn: number | null = null;
      for (let tick = 1; tick <= 60; tick++) {
        step(world, log, 1, tick === pressTick ? hold(UP) : IDLE);
        if (landedOn === null && runMotion(player.motion).grounded) landedOn = world.tick;
      }
      return { landedOn: landedOn ?? Number.NaN, jumps: ticksOfRacer(log, 'racer.jumped') };
    }
    // The runner stands (reads grounded) the tick after the move that lands it.
    const standsOn = dropPressingAt(null).landedOn + 1;

    it(`jumps on landing from a press ${bufferTicks} ticks before`, () => {
      expect(dropPressingAt(standsOn - bufferTicks).jumps).toEqual([standsOn]);
    });

    it(`forgets a press ${bufferTicks + 1} ticks before landing`, () => {
      expect(dropPressingAt(standsOn - bufferTicks - 1).jumps).toEqual([]);
    });
  });

  describe('coyote time', () => {
    const LEDGE = [
      '...............F',
      '...............F',
      '...............F',
      '.1.............F',
      '#####..........F',
      '#####..........F',
      '################',
    ];

    /** Runs the player off a ledge, pressing Up on `pressTick`; returns its first airborne tick and jumps. */
    function runOffPressingAt(pressTick: number | null) {
      const { world, log, player } = runWorld(LEDGE);
      let airborneFrom: number | null = null;
      step(world, log, SETTLE);
      for (let tick = SETTLE + 1; tick <= 60; tick++) {
        step(world, log, 1, tick === pressTick ? hold(UP_RIGHT) : hold(RIGHT));
        // The first tick that reads not grounded is the one after the move that left the ledge.
        if (airborneFrom === null && !runMotion(player.motion).grounded) airborneFrom = world.tick + 1;
      }
      return { airborneFrom: airborneFrom ?? Number.NaN, jumps: ticksOfRacer(log, 'racer.jumped') };
    }
    const airborneFrom = runOffPressingAt(null).airborneFrom;

    it(`still jumps on the ${coyoteTicks}th tick off a ledge`, () => {
      const lastChance = airborneFrom + coyoteTicks - 1;
      expect(runOffPressingAt(lastChance).jumps).toEqual([lastChance]);
    });

    it(`can't jump on the ${coyoteTicks + 1}th tick off a ledge`, () => {
      expect(runOffPressingAt(airborneFrom + coyoteTicks).jumps).toEqual([]);
    });
  });

  it.each(CHARACTER_IDS)(
    'launches %s at the jump speed times its jump multiplier (Gil 1.12, others 1)',
    (character) => {
      const racer = bareRunner(character);
      runFor(racer, 1, hold(UP));

      expect(jumpMulFor(racer)).toBe(character === 'gil' ? 1.12 : 1);
      expect(racer.body.vy).toBeCloseTo(-jumpSpeed * jumpMulFor(racer) + gravity * TICK_DT, 9);
    },
  );

  it('leaves Gil swimming exactly like everyone else when he swims up', () => {
    const swimUp = (character: CharacterId) => {
      const racer = { ...bareRunner(character), motion: { kind: 'swim' } };
      const log = new EventLog<GameEvent>(100);
      const water = { kind: 'swim', current: null, inKelp: false };
      for (let tick = 0; tick < 30; tick++) {
        applySwimIntent(racer, hold(UP), water, SWIM_TUNING, SWIM_TUNING.base, log, TICK_DT);
      }
      return { ...racer.body };
    };

    expect(swimUp('gil')).toEqual(swimUp('rudy'));
  });
});

describe('dash', () => {
  it('bursts along facing without changing vertical speed', () => {
    const withDash = bareRunner();
    const without = bareRunner();
    for (const racer of [withDash, without]) {
      racer.facing = -1;
      racer.body.vy = -50;
    }
    const { log } = runFor(withDash, 1, hold(STILL, { kick: true }), IN_AIR);
    runFor(without, 1, hold(STILL), IN_AIR);

    expect(withDash.body.vx).toBe(-RUN_TUNING.kick);
    expect(withDash.body.vy).toBe(without.body.vy);
    expect(eventsIn(log)).toEqual([{ type: 'racer.kicked', id: 'player' }]);
  });

  it('glides back to running pace over about 0.8 s while right is held', () => {
    const racer = bareRunner();
    racer.body.vx = RUN_TUNING.extra.runSpeed;
    runFor(racer, 1, hold(RIGHT, { kick: true }));
    const { speeds } = runFor(racer, ticksIn(1), hold(RIGHT));

    expect(speeds[ticksIn(0.25) - 1]).toBeGreaterThan(RUN_TUNING.extra.runSpeed * 1.3);
    expect(speeds[ticksIn(0.75) - 1]).toBeGreaterThan(RUN_TUNING.extra.runSpeed);
    expect(speeds.at(-1)).toBe(RUN_TUNING.extra.runSpeed);
  });

  it('glides a dash into mud back to running pace, then slows to mud speed at full friction', () => {
    const { runSpeed, mudSpeedMul } = RUN_TUNING.extra;
    const racer = bareRunner();
    racer.body.vx = runSpeed;
    runFor(racer, 1, hold(RIGHT, { kick: true }), { ...ON_GROUND, inMud: true });
    const { speeds } = runFor(racer, ticksIn(1.2), hold(RIGHT), { ...ON_GROUND, inMud: true });

    expect(speeds[ticksIn(0.5) - 1]).toBeGreaterThan(runSpeed);
    expect(speeds.at(-1)).toBeCloseTo(runSpeed * mudSpeedMul, 9);
  });

  it('stops within 0.3 s of letting go straight after a dash', () => {
    const racer = bareRunner();
    runFor(racer, 1, hold(RIGHT, { kick: true }));
    const { speeds } = runFor(racer, ticksIn(0.3), hold(STILL));

    expect(speeds.at(-1)).toBe(0);
  });

  it('spends a dash charge as a swim kick does', () => {
    const { world, log, player } = runWorld(FLAT);
    step(world, log, SETTLE);
    const charges = player.kickCharges;
    step(world, log, 1, hold(STILL, { kick: true }));

    expect(player.kickCharges).toBe(charges - 1);
  });

  it('dashes once in the air, then again only after landing', () => {
    // A 2-tick cooldown, so only the once-per-air rule holds the second dash back.
    const tuning = { base: { ...BASE, kickCooldownTicks: 2 } };
    const { world, log, player } = runWorld(FLAT, { tuning });
    player.body.y -= 4 * TILE;
    let landedOn: number | null = null;
    for (let tick = 1; tick <= 60 && landedOn === null; tick++) {
      step(world, log, 1, hold(STILL, { kick: true }));
      if (runMotion(player.motion).grounded) landedOn = world.tick;
    }
    const airDashes = ticksOfRacer(log, 'racer.kicked').length;
    step(world, log, 1, hold(STILL, { kick: true }));

    expect(landedOn).not.toBeNull();
    expect([airDashes, ticksOfRacer(log, 'racer.kicked').length]).toEqual([1, 2]);
  });
});
