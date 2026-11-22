import { createRng, EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import { updateProgress } from '../race/standings.ts';
import { noItems } from '../racers.ts';
import { placeOnTile, raceOn } from '../test-world.ts';
import type { Intent, PowerUpKind, Racer, RacerId, TickInput, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { ITEM_USE } from './items.ts';
import { PLAYER_PROFILE } from './profiles.ts';
import { CATCH_UP, catchUpMul, DARK_STEERING, rivalIntent } from './rival.ts';

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
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
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

    const afterFirstRead = moving.slice(racer(world, 'tess').profile.reactionTicks);

    expect(moving.some(sideways)).toBe(false);
    expect(afterFirstRead.every((i) => i.move.x > 0.9)).toBe(true);
  });
});

describe('stunned or trapped', () => {
  it('never starts a recovery swim, and resets the count of still ticks toward being stuck', () => {
    const { world } = lanes();
    racing(world);
    const still = (r: Racer) => {
      r.body.vx = 0;
      r.body.vy = 0;
    };
    const before = intents(world, 'tess', 20, still);
    const stunned = intents(world, 'tess', 40, (r) => {
      still(r);
      r.status.stunned = 5;
    });
    const trapped = intents(world, 'tess', 40, (r) => {
      still(r);
      r.status.stunned = 0;
      r.status.trapped = 5;
    });
    const freed = intents(world, 'tess', 25, (r) => {
      still(r);
      r.status.trapped = 0;
    });

    expect([...before, ...stunned, ...trapped, ...freed].some(sideways)).toBe(false);
  });
});

describe('catch-up', () => {
  const pair = (rivalProgress: number, playerProgress: number) => {
    const base = {
      character: 'rudy' as const,
      facing: 1 as const,
      kickCooldown: 0,
      place: 1,
      finished: null,
      ai: null,
      ...noItems(),
    };
    const body = { x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 10 };
    const rival: Racer = {
      ...base,
      id: 'tess',
      body,
      progress: rivalProgress,
      profile: { ...PLAYER_PROFILE, id: 'tess' },
    };
    const player: Racer = { ...base, id: 'player', body, progress: playerProgress, profile: PLAYER_PROFILE };
    return catchUpMul(rival, player);
  };

  it('slows a rival far ahead of the player down to the lower bound', () => {
    expect(pair(10, 200)).toBeCloseTo(CATCH_UP.min, 6);
  });

  it('speeds a rival far behind the player up to the upper bound', () => {
    expect(pair(200, 10)).toBeCloseTo(CATCH_UP.max, 6);
  });

  it('scales with the gap in between and is neutral when level', () => {
    expect(pair(12, 10)).toBeCloseTo(1 + 2 * CATCH_UP.perTile, 6);
    expect(pair(10, 12)).toBeCloseTo(1 - 2 * CATCH_UP.perTile, 6);
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

  it('flashes its lantern at a racer just ahead, within 2 tiles', () => {
    expect(bursts(itemScene(['glowLantern'], { player: [12, 5] }).decide())).toBe(1);
  });

  it('saves its lantern for a racer 3 tiles ahead, or one just behind it', () => {
    expect(bursts(itemScene(['glowLantern'], { player: [13, 5] }).decide())).toBe(0);
    expect(bursts(itemScene(['glowLantern'], { player: [8, 5] }).decide())).toBe(0);
  });

  it('aims its items at the player only, never at another rival', () => {
    const atSquib = itemScene(['glowLantern', 'inkSac'], { squib: [12, 5], bo: [8, 5] });
    const atPlayer = itemScene(['glowLantern', 'inkSac'], { player: [12, 5] });

    expect(bursts(atSquib.decide(100))).toBe(0);
    expect(bursts(atPlayer.decide())).toBe(1);
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

  it('steers around coral while its puffer burst cools down', () => {
    const { tess, decide } = itemScene(['puffer'], {}, 0, CORAL_LANE);
    tess.burstCooldown = 100;

    expect(decide()[0]?.move.x).toBeLessThan(0);
  });

  it('steers through coral while inflated, even with its burst cooling down', () => {
    const { tess, decide } = itemScene(['puffer'], {}, 0, CORAL_LANE);
    tess.burstCooldown = 100;
    tess.status.inflated = 30;

    expect(decide()[0]?.move.x).toBeGreaterThan(0.5);
  });

  it('never bursts while swimming sideways to get unstuck', () => {
    const { tess, decide } = itemScene(['glowLantern'], { player: [12, 5] });
    const pinned = Array.from({ length: 60 }, () => {
      tess.body.vx = 0;
      tess.body.vy = 0;
      return decide()[0] as Intent;
    });
    const recovering = pinned.filter(sideways);

    expect(recovering.length).toBeGreaterThan(0);
    expect(recovering.filter((intent) => intent.burst)).toEqual([]);
    expect(pinned.filter((intent) => !sideways(intent)).every((intent) => intent.burst)).toBe(true);
  });

  it('aims into the coral itself once it reaches it holding a puffer', () => {
    const [atCoral] = itemScene(['puffer'], { tess: [5, 1] }, 0, CORAL_LANE).decide();

    expect(atCoral?.move.x).toBeGreaterThan(0.5);
  });

  it('dashes with 5 clear tiles straight ahead, but on only a small share of the ticks it could', () => {
    const { tess, decide } = itemScene(['jetFin']);
    const dashes = bursts(
      Array.from({ length: 1000 }, () => {
        tess.body.vx = 60;
        return decide()[0] as Intent;
      }),
    );

    expect(dashes / 1000).toBeGreaterThan(ITEM_USE.jetChanceMul * 0.4);
    expect(dashes / 1000).toBeLessThan(ITEM_USE.jetChanceMul * 1.8);
  });

  it('holds back a lantern flash it would fire every time while Jet Fins ride along in the stack', () => {
    const flashes = (kinds: PowerUpKind[]) => {
      const { tess, decide } = itemScene(kinds, { player: [12, 5] });
      return bursts(
        Array.from({ length: 1000 }, () => {
          tess.body.vx = 60;
          return decide()[0] as Intent;
        }),
      );
    };

    expect(flashes(['glowLantern'])).toBe(1000);
    expect(flashes(['jetFin', 'glowLantern'])).toBeLessThan(150);
  });

  it('holds its dash with a wall 3 tiles ahead', () => {
    expect(bursts(itemScene(['jetFin'], { tess: [18, 5] }).decide())).toBe(0);
  });

  it('bursts on about itemAggression of its eligible ticks', () => {
    // Kept swimming, so it never sits still long enough to start a recovery swim (which holds bursts).
    const swimming = (aggression: number) => {
      const { tess, decide } = itemScene(['glowLantern'], { player: [12, 5] }, aggression);
      return Array.from({ length: 400 }, () => {
        tess.body.vx = 60;
        return decide()[0] as Intent;
      });
    };
    const half = bursts(swimming(0.5));
    const never = bursts(swimming(0));

    expect(half / 400).toBeGreaterThan(0.35);
    expect(half / 400).toBeLessThan(0.65);
    expect(never).toBe(0);
  });

  it('never bursts while its burst cools down', () => {
    const { tess, decide } = itemScene(['glowLantern'], { player: [12, 5] });
    tess.burstCooldown = 10;

    expect(bursts(decide(100))).toBe(0);
  });

  it('draws the same randomness each tick whatever it holds', () => {
    const draws = (kinds: PowerUpKind[]) => {
      const { world, tess } = itemScene(kinds, { player: [12, 5] });
      const rng = createRng(99);
      for (let i = 0; i < 50; i++) rivalIntent(world, tess, rng);
      return rng.state();
    };

    expect(draws(['glowLantern', 'jetFin'])).toBe(draws([]));
  });
});

/** One wide lane per racer; `dark` covers every column when set. */
function darkLanes(dark: boolean) {
  const level = parseLevel({
    name: 'dark lanes',
    ascii: `
      ##############################
      #1..........................F#
      ##############################
      #............................#
      #2..........................F#
      #............................#
      ##############################
      #3..........................F#
      ##############################
      #4..........................F#
      ##############################
    `,
    dark: dark ? [[0, 29]] : [],
  });
  const world = createWorld(level, new EventLog<GameEvent>(100_000), { seed: 3 });
  racing(world);
  return world;
}

/** Tess's intents swimming on the spot mid-lane for `ticks`, after `setup` on her. */
function steering(dark: boolean, ticks: number, setup: (tess: Racer) => void = () => {}) {
  const world = darkLanes(dark);
  setup(racer(world, 'tess'));
  return intents(world, 'tess', ticks, (r) => {
    placeOnTile(r, 10, 4);
    r.body.vx = 60;
  });
}

const widestSwerve = (moves: Intent[]) => Math.max(...moves.map((intent) => Math.abs(intent.move.y)));

describe('steering in the dark', () => {
  it('wobbles twice as far off its line in a dark zone', () => {
    const lit = widestSwerve(steering(false, 600));
    const dark = widestSwerve(steering(true, 600));

    expect(lit).toBeGreaterThan(0);
    // The same draws walk an angle exactly twice as wide; the sine of a small angle nearly doubles.
    expect(dark / lit).toBeGreaterThan(1.9);
    expect(dark / lit).toBeLessThan(2.05);
  });

  it('reads its field half as often in a dark zone', () => {
    const reads = (dark: boolean) => {
      const world = darkLanes(dark);
      const tess = racer(world, 'tess');
      let count = 0;
      for (let i = 0; i < 120; i++) {
        placeOnTile(tess, 10, 4);
        if (tess.ai?.replanIn === 0) count++;
        rivalIntent(world, tess, world.rngs['ai.tess']);
      }
      return count;
    };

    expect(reads(true)).toBe(Math.ceil(reads(false) / DARK_STEERING.reactionMul));
  });

  it('steers as if lit while it holds a Glow Lantern', () => {
    const withLantern = (tess: Racer) => {
      tess.stack = ['glowLantern'];
      tess.profile = { ...tess.profile, itemAggression: 0 };
    };

    expect(steering(true, 600, withLantern)).toEqual(steering(false, 600, withLantern));
  });

  it('steers as if lit as Selene', () => {
    const asSelene = (tess: Racer) => {
      tess.character = 'selene';
    };

    expect(steering(true, 600, asSelene)).toEqual(steering(false, 600, asSelene));
  });
});

describe('abilities in the rival AI', () => {
  /** A jelly sits dead ahead on Tess's line. */
  const JELLY_LINE = `
    ##########################
    #1......................F#
    ##########################
    #.......................F#
    #2.........j............F#
    #.......................F#
    ##########################
    #3......................F#
    ##########################
    #4......................F#
    ##########################
  `;

  it('swims straight at a jelly as Selene, who it cannot sting, where others swerve', () => {
    const aimAtJelly = (character: 'selene' | 'rook') => {
      const { world } = raceOn(JELLY_LINE);
      const tess = racer(world, 'tess');
      tess.character = character;
      tess.profile = { ...tess.profile, wobble: 0 };
      placeOnTile(tess, 8, 4);
      tess.body.vx = 60;
      return rivalIntent(world, tess, world.rngs['ai.tess']).move;
    };

    expect(Math.abs(aimAtJelly('selene').y)).toBeLessThan(0.05);
    expect(Math.abs(aimAtJelly('rook').y)).toBeGreaterThan(0.2);
  });

  it('steers through coral as Baron Barnacle, who rams it, and around it as anyone else', () => {
    const aimAt = (character: 'baron' | 'rudy') => {
      const { world } = raceOn(CORAL_LANE);
      const tess = racer(world, 'tess');
      tess.character = character;
      tess.profile = { ...tess.profile, wobble: 0 };
      return rivalIntent(world, tess, world.rngs['ai.tess']).move;
    };

    expect(aimAt('baron').x).toBeGreaterThan(0.5);
    expect(aimAt('rudy').x).toBeLessThan(0);
  });
});
