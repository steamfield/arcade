import { createRng, EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import { updateProgress } from '../race/standings.ts';
import { noItems } from '../racers.ts';
import { placeOnTile, raceOn } from '../test-world.ts';
import type { Intent, PowerUpKind, Racer, RacerId, TickInput, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { RIVAL_PROFILES } from './profiles.ts';
import { CATCH_UP, catchUpMul, rivalIntent } from './rival.ts';

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, burst: false };

/** One walled lane per racer, so every aim is straight right and nobody bumps. */
function lanes(seed = 1) {
  const level = parseLevel({
    name: 'lanes',
    ascii: `
      ####################
      #1................F#
      ####################
      #2................F#
      ####################
      #3................F#
      ####################
      #4................F#
      ####################
    `,
  });
  const log = new EventLog<GameEvent>(100_000);
  return { world: createWorld(level, log, { seed }), log };
}

function racer(world: World, id: RacerId): Racer {
  const found = world.racers.find((r) => r.id === id);
  if (!found) throw new Error(`No racer ${id}`);
  return found;
}

/** Skips the countdown so intents are asked for a running race. */
function racing(world: World) {
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null };
}

/** Asks for `ticks` intents, calling `hold` on the racer before each to pin its velocity. */
function intents(world: World, id: 'tess' | 'squib' | 'bo', ticks: number, hold: (r: Racer) => void): Intent[] {
  const target = racer(world, id);
  const out: Intent[] = [];
  for (let i = 0; i < ticks; i++) {
    hold(target);
    out.push(rivalIntent(world, target, world.rngs[`ai.${id}`]));
  }
  return out;
}

const sideways = (intent: Intent) => Math.abs(intent.move.x) < 0.5 && Math.abs(intent.move.y) > 0.8;

describe('rival racing', () => {
  it('swims every rival to the finish of a straight course', () => {
    const { world } = lanes();
    for (let i = 0; i < 1200 && world.racers.some((r) => r.ai && !r.finished); i++) stepWorld(world, IDLE, TICK_DT);

    for (const id of ['tess', 'squib', 'bo'] as const) expect(racer(world, id).finished, id).not.toBeNull();
  });

  it('repeats a race exactly with the same seed', () => {
    const run = () => {
      const { world, log } = lanes(7);
      for (let i = 0; i < 400; i++) {
        log.tick = world.tick;
        stepWorld(world, IDLE, TICK_DT);
      }
      return { racers: world.racers, events: log.all() };
    };

    expect(run()).toEqual(run());
  });

  it('never kicks while its kick is cooling down, and does kick once it is ready', () => {
    const { world } = lanes();
    racing(world);
    const moving = (cooldown: number) => (r: Racer) => {
      r.body.vx = 60;
      r.body.vy = 0;
      r.kickCooldown = cooldown;
    };

    expect(intents(world, 'squib', 200, moving(10)).some((i) => i.kick)).toBe(false);
    expect(intents(world, 'squib', 200, moving(0)).some((i) => i.kick)).toBe(true);
  });

  it('never fires a burst', () => {
    const { world } = lanes();
    racing(world);
    const moving = (r: Racer) => {
      r.body.vx = 60;
    };

    expect(intents(world, 'squib', 300, moving).some((i) => i.burst)).toBe(false);
  });

  it('draws the same amount of randomness whether or not it can kick', () => {
    const { world } = lanes();
    racing(world);
    const tess = racer(world, 'tess');
    const ready = createRng(99);
    const cooling = createRng(99);
    for (let i = 0; i < 50; i++) {
      tess.body.vx = 60;
      tess.kickCooldown = 0;
      rivalIntent(world, tess, ready);
    }
    const second = lanes().world;
    racing(second);
    const tessAgain = racer(second, 'tess');
    for (let i = 0; i < 50; i++) {
      tessAgain.body.vx = 60;
      tessAgain.kickCooldown = 10;
      rivalIntent(second, tessAgain, cooling);
    }

    expect(cooling.state()).toBe(ready.state());
  });

  it('changes nothing in the world but its own memory', () => {
    const { world } = lanes();
    racing(world);
    const tess = racer(world, 'tess');
    const visible = () => ({
      racers: world.racers.map((r) => ({
        ...r,
        body: { ...r.body },
        ai: r.id === 'tess' ? null : structuredClone(r.ai),
      })),
      race: { ...world.race },
      tick: world.tick,
      broken: [...world.broken],
    });
    const before = visible();
    for (let i = 0; i < 50; i++) rivalIntent(world, tess, world.rngs['ai.tess']);

    expect(visible()).toEqual(before);
  });
});

describe('getting unstuck', () => {
  it('swims sideways for 20 ticks once pinned still for 30, well within 60 ticks', () => {
    const { world } = lanes();
    racing(world);
    const pinned = intents(world, 'tess', 90, (r) => {
      r.body.vx = 0;
      r.body.vy = 0;
    });
    const firstSideways = pinned.findIndex(sideways);
    const run = pinned.slice(firstSideways).findIndex((i) => !sideways(i));

    expect(firstSideways).toBeGreaterThanOrEqual(29);
    expect(firstSideways).toBeLessThan(60);
    expect(run).toBe(20);
  });

  it('keeps swimming forward while it is moving', () => {
    const { world } = lanes();
    racing(world);
    const moving = intents(world, 'tess', 120, (r) => {
      r.body.vx = 60;
      r.body.vy = 0;
    });

    const afterFirstRead = moving.slice(RIVAL_PROFILES.tess.reactionTicks);

    expect(moving.some(sideways)).toBe(false);
    expect(afterFirstRead.every((i) => i.move.x > 0.9)).toBe(true);
  });
});

describe('catch-up', () => {
  const pair = (rivalProgress: number, playerProgress: number) => {
    const base = { facing: 1 as const, kickCooldown: 0, place: 1, finished: null, ai: null, ...noItems() };
    const body = { x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 10 };
    const rival: Racer = { ...base, id: 'tess', body, progress: rivalProgress, profile: RIVAL_PROFILES.tess };
    const player: Racer = { ...base, id: 'player', body, progress: playerProgress, profile: RIVAL_PROFILES.tess };
    return catchUpMul(rival, player);
  };

  it('slows a rival far ahead of the player down to the lower bound', () => {
    expect(pair(10, 200)).toBeCloseTo(CATCH_UP.min, 6);
  });

  it('speeds a rival far behind the player up to the upper bound', () => {
    expect(pair(200, 10)).toBeCloseTo(CATCH_UP.max, 6);
  });

  it('scales with the gap in between and is neutral when level', () => {
    expect(pair(15, 10)).toBeCloseTo(1 + 5 * CATCH_UP.perTile, 6);
    expect(pair(10, 15)).toBeCloseTo(1 - 5 * CATCH_UP.perTile, 6);
    expect(pair(10, 10)).toBeCloseTo(1, 6);
  });

  it('is neutral before progress is known', () => {
    expect(pair(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('kicking while getting unstuck', () => {
  it('never kicks during the 20 recovery ticks, even while swimming the sideways way', () => {
    const { world } = lanes();
    racing(world);
    const squib = racer(world, 'squib');
    const recovery: Intent[] = [];
    let previous: Intent | null = null;
    for (let i = 0; i < 80 && recovery.length < 20; i++) {
      // Pinned still until it starts recovering, then moving the way it asked, kick always ready.
      const moveTo = previous && sideways(previous) ? previous.move : { x: 0, y: 0 };
      squib.body.vx = moveTo.x * 60;
      squib.body.vy = moveTo.y * 60;
      squib.kickCooldown = 0;
      previous = rivalIntent(world, squib, world.rngs['ai.squib']);
      if (sideways(previous)) recovery.push(previous);
    }

    expect(recovery).toHaveLength(20);
    expect(recovery.filter((i) => i.kick)).toEqual([]);
  });
});

/** Open water with the finish on the right, so a rival in the middle aims straight right. */
const ARENA = `
  #######################
  #1...................F#
  #....................F#
  #....................F#
  #....................F#
  #2...................F#
  #....................F#
  #....................F#
  #....................F#
  #3..................4F#
  #######################
`;

/**
 * Tess's lane is blocked by coral two tiles ahead; going round means doubling back and down,
 * so the smash field runs through the coral and the steer field goes the other way.
 */
const CORAL_LANE = `
  ##################
  #1..2.C.........F#
  #.################
  #3..............F#
  #4..............F#
  ##################
`;

type Spots = Partial<Record<RacerId, [number, number]>>;

/**
 * Tess holding `kinds` with item aggression `aggression`. By default she sits mid-arena at (10, 5)
 * and everyone else is about 10 tiles away; `spots` moves racers to other tiles.
 */
function itemScene(kinds: PowerUpKind[], spots: Spots = {}, aggression = 1, ascii = ARENA) {
  const { world } = raceOn(ascii);
  const defaults: Spots = ascii === ARENA ? { tess: [10, 5], player: [1, 1], squib: [1, 9], bo: [19, 9] } : {};
  for (const [id, [tx, ty]] of Object.entries({ ...defaults, ...spots }) as [RacerId, [number, number]][]) {
    placeOnTile(racer(world, id), tx, ty);
  }
  updateProgress(world);
  const tess = racer(world, 'tess');
  tess.stack = kinds;
  tess.profile = { ...tess.profile, itemAggression: aggression };
  const decide = (ticks = 1) => Array.from({ length: ticks }, () => rivalIntent(world, tess, world.rngs['ai.tess']));
  return { world, tess, decide };
}

const bursts = (intents: Intent[]) => intents.filter((intent) => intent.burst).length;

describe('using items', () => {
  it('drops ink on a racer close behind', () => {
    expect(bursts(itemScene(['inkSac'], { player: [7, 5] }).decide())).toBe(1);
  });

  it('keeps its ink when nobody is within 4 tiles behind', () => {
    expect(bursts(itemScene(['inkSac'], { player: [4, 5] }).decide())).toBe(0);
  });

  it('fires a bubble at a racer ahead within 6 tiles in its aim', () => {
    expect(bursts(itemScene(['bubbleShield'], { player: [14, 5] }).decide())).toBe(1);
  });

  it('holds its bubble when the near racer is behind it', () => {
    expect(bursts(itemScene(['bubbleShield'], { player: [7, 5] }).decide())).toBe(0);
  });

  it('flashes its lantern with a racer within 4 tiles', () => {
    expect(bursts(itemScene(['glowLantern'], { player: [10, 2] }).decide())).toBe(1);
  });

  it('saves its lantern when every racer is further than 4 tiles', () => {
    expect(bursts(itemScene(['glowLantern']).decide())).toBe(0);
  });

  it('inflates its puffer for coral on its smash path within 3 tiles', () => {
    expect(bursts(itemScene(['puffer'], {}, 1, CORAL_LANE).decide())).toBe(1);
  });

  it('keeps its puffer with no coral in reach', () => {
    expect(bursts(itemScene(['puffer']).decide())).toBe(0);
  });

  it('steers by the smash field through coral while holding a puffer, and around it without', () => {
    const [withPuffer] = itemScene(['puffer'], {}, 0, CORAL_LANE).decide();
    const [without] = itemScene([], {}, 0, CORAL_LANE).decide();

    expect(withPuffer?.move.x).toBeGreaterThan(0.5);
    expect(without?.move.x).toBeLessThan(0);
  });

  it('dashes with 5 clear tiles straight ahead', () => {
    expect(bursts(itemScene(['jetFin']).decide())).toBe(1);
  });

  it('holds its dash with a wall 3 tiles ahead', () => {
    expect(bursts(itemScene(['jetFin'], { tess: [18, 5] }).decide())).toBe(0);
  });

  it('bursts on about itemAggression of its eligible ticks', () => {
    const half = bursts(itemScene(['glowLantern'], { player: [10, 2] }, 0.5).decide(400));
    const never = bursts(itemScene(['glowLantern'], { player: [10, 2] }, 0).decide(400));

    expect(half / 400).toBeGreaterThan(0.35);
    expect(half / 400).toBeLessThan(0.65);
    expect(never).toBe(0);
  });

  it('never bursts while its burst cools down', () => {
    const { tess, decide } = itemScene(['glowLantern'], { player: [10, 2] });
    tess.burstCooldown = 10;

    expect(bursts(decide(100))).toBe(0);
  });

  it('draws the same randomness each tick whatever it holds', () => {
    const draws = (kinds: PowerUpKind[]) => {
      const { world, tess } = itemScene(kinds, { player: [10, 2] });
      const rng = createRng(99);
      for (let i = 0; i < 50; i++) rivalIntent(world, tess, rng);
      return rng.state();
    };

    expect(draws(['glowLantern', 'jetFin'])).toBe(draws([]));
  });
});
