import { describe, expect, it } from 'vitest';
import { gainItem } from '../../logic/powerups/inventory.ts';
import { SQUID, USE_COOLDOWN_TICKS } from '../../logic/powerups/tuning.ts';
import { giveItems, IDLE, placeOnTile, raceOn, racerOf, step } from '../../logic/test-world.ts';
import type { TickInput, World } from '../../logic/types.ts';
import {
  GUIDE_OVER_PRESS_FIRE_TICKS,
  type HintConfig,
  type HintMemory,
  hintConfig,
  KICK_LEAD_TICKS,
  NO_HINTS,
  newHintMemory,
  PRESS_FIRE_TICKS,
  SWAP_TICKS,
  UNUSED_PULSE_TICKS,
  updateHints,
} from './hints.ts';

const OPEN = `
  ##################
  #1..............F#
  #2..............F#
  #3..............F#
  #4..............F#
  ##################
`;

const FIRE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: true, cycle: 0 };
const NEXT: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 1 };

const EASY: HintConfig = hintConfig(0, 'easy');
const NORMAL_FIRST_RACE: HintConfig = hintConfig(0, 'normal');

/** A racing world and a memory that has seen nothing; `run` steps it and asks for hints after every tick. */
function race(config: HintConfig = EASY, ascii = OPEN) {
  const { world, log } = raceOn(ascii);
  const memory: HintMemory = newHintMemory();
  const player = racerOf(world, 'player');
  const run = (ticks: number, input = IDLE, using = config) => {
    let hints = updateHints(memory, world, using);
    for (let i = 0; i < ticks; i++) {
      step(world, log, 1, input);
      hints = updateHints(memory, world, using);
    }
    return hints;
  };
  return { world, player, run };
}

/** A squid locked on the player, `px` pixels to its right. */
function lockSquidOnPlayer(world: World, px = 200): void {
  const player = racerOf(world, 'player');
  world.squids.push({
    x: player.body.x + px,
    y: player.body.y,
    vx: 0,
    vy: 0,
    ttl: 600,
    owner: 'tess',
    target: { kind: 'racer', id: 'player' },
  });
}

describe('which races show hints', () => {
  it.each([
    ['the first race on a normal save', 0, 'normal', true],
    ['the first race on a hard save', 0, 'hard', true],
    ['a later normal race', 3, 'normal', false],
    ['a later hard race', 3, 'hard', false],
    ['a later easy race', 3, 'easy', true],
  ] as const)('%s', (_name, races, difficulty, shown) => {
    expect(hintConfig(races, difficulty).enabled).toBe(shown);
  });
});

describe('PRESS FIRE', () => {
  it('shows from the moment an item lands, and not before', () => {
    const { world, player, run } = race();
    expect(run(30).pressFire).toBe(false);
    gainItem(world, player, 'jetFin', 2);
    expect(run(1).pressFire).toBe(true);
  });

  it('goes away once the player fires an item, and stays away for the rest of the race', () => {
    const { world, player, run } = race();
    run(5);
    gainItem(world, player, 'jetFin', 2);
    expect(run(10).pressFire).toBe(true);
    expect(run(1, FIRE).pressFire).toBe(false);
    gainItem(world, player, 'puffer', 2);
    expect(run(200).pressFire).toBe(false);
  });

  it('times out when the player ignores it on a first race that is not Easy', () => {
    const { world, player, run } = race(NORMAL_FIRST_RACE);
    gainItem(world, player, 'jetFin', 2);
    expect(run(PRESS_FIRE_TICKS - 2).pressFire).toBe(true);
    expect(run(3).pressFire).toBe(false);
  });

  it('stays up on Easy until the first use, however long the player waits', () => {
    const { world, player, run } = race();
    gainItem(world, player, 'jetFin', 2);
    expect(run(PRESS_FIRE_TICKS * 3).pressFire).toBe(true);
  });

  it('hides when the inventory empties under it', () => {
    const { world, player, run } = race();
    gainItem(world, player, 'jetFin', 2);
    expect(run(10).pressFire).toBe(true);
    giveItems(player, []);
    expect(run(1).pressFire).toBe(false);
  });

  it('is silent when hints are off', () => {
    const { world, player, run } = race();
    gainItem(world, player, 'jetFin', 2);
    expect(run(10, IDLE, { enabled: false, easy: true })).toEqual(NO_HINTS);
  });

  it('is silent during the countdown', () => {
    const { world, player, run } = race();
    world.race.phase = 'countdown';
    gainItem(world, player, 'jetFin', 2);
    expect(run(10)).toEqual(NO_HINTS);
  });
});

describe('the pulsing fire glyph by the item well', () => {
  /** Fires a Puffer once so PRESS FIRE is retired, leaving one charge held and nothing counted as unused yet. */
  function afterFirstFire(config: HintConfig = EASY) {
    const built = race(config);
    gainItem(built.world, built.player, 'puffer', 2);
    built.run(1, FIRE);
    return built;
  }

  it('starts after 5 seconds of holding something unused', () => {
    const { run } = afterFirstFire();
    // The fire's cooldown passes before the item counts as unused.
    run(USE_COOLDOWN_TICKS);
    expect(run(UNUSED_PULSE_TICKS - 2).pulseItems).toBe(false);
    expect(run(3).pulseItems).toBe(true);
  });

  it('stops when an item is fired, and starts counting again after the cooldown', () => {
    const { world, player, run } = afterFirstFire();
    gainItem(world, player, 'inkSac', 3);
    giveItems(player, [{ kind: 'puffer', charges: 2 }]);
    expect(run(UNUSED_PULSE_TICKS + 30).pulseItems).toBe(true);
    expect(run(1, FIRE).pulseItems).toBe(false);
    // The puffer is still held, but nothing counts as unused until the cooldown ends and 5 s pass.
    expect(run(UNUSED_PULSE_TICKS - 1).pulseItems).toBe(false);
    expect(run(200).pulseItems).toBe(true);
  });

  it('waits while PRESS FIRE is up on Easy, since that already shows the fire control', () => {
    const { world, player, run } = race();
    gainItem(world, player, 'jetFin', 2);
    const hints = run(UNUSED_PULSE_TICKS * 2);
    expect([hints.pressFire, hints.pulseItems]).toEqual([true, false]);
  });

  it('takes over the moment PRESS FIRE gives up on a first race that is not Easy', () => {
    const { world, player, run } = race(NORMAL_FIRST_RACE);
    gainItem(world, player, 'jetFin', 2);
    const before = run(PRESS_FIRE_TICKS - 1);
    expect([before.pressFire, before.pulseItems]).toEqual([true, false]);
    const after = run(1);
    expect([after.pressFire, after.pulseItems]).toEqual([false, true]);
  });

  it('never shows with nothing held', () => {
    const { run } = race();
    expect(run(UNUSED_PULSE_TICKS * 2).pulseItems).toBe(false);
  });
});

describe('SWAP', () => {
  /** A race where the player has already fired once, so PRESS FIRE is retired and SWAP can have the spot. */
  function firedOnce(config: HintConfig = EASY) {
    const built = race(config);
    gainItem(built.world, built.player, 'puffer', 2);
    built.run(1, FIRE);
    return built;
  }

  it('shows the first time the player holds two items, and not with one', () => {
    const { world, player, run } = firedOnce();
    expect(run(30).swap).toBe(false);
    gainItem(world, player, 'inkSac', 3);
    expect(run(1)).toEqual({ ...NO_HINTS, swap: true });
  });

  it('goes away once the player swaps, and stays away for the rest of the race', () => {
    const { world, player, run } = firedOnce();
    gainItem(world, player, 'inkSac', 3);
    expect(run(10).swap).toBe(true);
    expect(run(1, NEXT).swap).toBe(false);
    gainItem(world, player, 'jetFin', 3);
    expect(run(60).swap).toBe(false);
  });

  it('shows once: it gives up after a few seconds and never comes back that race', () => {
    const { world, player, run } = firedOnce();
    gainItem(world, player, 'inkSac', 3);
    expect(run(SWAP_TICKS - 1).swap).toBe(true);
    expect(run(1).swap).toBe(false);
    giveItems(player, ['jetFin']);
    run(10);
    gainItem(world, player, 'riptide', 2);
    expect(run(10).swap).toBe(false);
  });

  it('still shows after the selected item is used up, since the selection moving on is not a swap', () => {
    const { world, player, run } = race();
    giveItems(player, [{ kind: 'puffer', charges: 1 }, null, null]);
    // Firing the last Puffer charge moves the selection on by itself; the player hasn't swapped.
    run(1, FIRE);
    gainItem(world, player, 'inkSac', 3);
    gainItem(world, player, 'jetFin', 3);
    expect(run(1).swap).toBe(true);
  });

  it('waits behind PRESS FIRE until the player has fired once', () => {
    const { world, player, run } = race();
    gainItem(world, player, 'inkSac', 3);
    gainItem(world, player, 'jetFin', 3);
    const waiting = run(60);
    expect([waiting.pressFire, waiting.swap]).toEqual([true, false]);
    const after = run(1, FIRE);
    expect([after.pressFire, after.swap]).toEqual([false, true]);
  });

  it('stays hidden while a squid is latched on the player, whose DASH! prompt holds the spot', () => {
    const { world, player, run } = firedOnce();
    player.status.latched = 60;
    gainItem(world, player, 'inkSac', 3);
    expect(run(1)).toEqual(NO_HINTS);
  });

  it('pauses while a squid takes the spot, then comes back for the rest of its time', () => {
    const { world, player, run } = firedOnce();
    gainItem(world, player, 'inkSac', 3);
    expect(run(SWAP_TICKS / 2).swap).toBe(true);
    lockSquidOnPlayer(world, 40);
    const interrupted = run(1);
    expect([interrupted.kick, interrupted.swap]).toEqual([true, false]);
    world.squids.length = 0;
    // Half its time was used before the squid; it gets the other half back once the squid is gone.
    expect(run(SWAP_TICKS / 2 - 2).swap).toBe(true);
    expect(run(2).swap).toBe(false);
  });

  it('is silent on a later Normal race', () => {
    const { world, player, run } = firedOnce(hintConfig(3, 'normal'));
    gainItem(world, player, 'inkSac', 3);
    expect(run(1)).toEqual(NO_HINTS);
  });
});

describe('one hint at a time', () => {
  it('shows at most one hint on every tick while items, a squid and its latch all call for one', () => {
    const { world, player, run } = race();
    gainItem(world, player, 'puffer', 2);
    gainItem(world, player, 'inkSac', 3);
    const seen = { pressFire: 0, kick: 0, swap: 0, pulseItems: 0 };
    let most = 0;
    for (let tick = 0; tick < UNUSED_PULSE_TICKS + SWAP_TICKS + 60; tick++) {
      if (tick === 20) run(1, FIRE);
      if (tick === 100) lockSquidOnPlayer(world, 40);
      // A latch partway through: the threat HUD's DASH! holds the spot, so no hint may show.
      if (tick === 200) player.status.latched = 60;
      const hints = run(1);
      const on = [hints.pressFire, hints.kick, hints.swap, hints.pulseItems, hints.guide !== null];
      most = Math.max(most, on.filter(Boolean).length);
      if (player.status.latched > 0) expect(on.some(Boolean), `tick ${tick}`).toBe(false);
      for (const key of Object.keys(seen) as (keyof typeof seen)[]) if (hints[key]) seen[key] += 1;
    }
    expect(most).toBe(1);
    expect(seen.pressFire, 'PRESS FIRE showed').toBeGreaterThan(0);
    expect(seen.kick, 'DASH showed').toBeGreaterThan(0);
    expect(seen.swap, 'SWAP showed').toBeGreaterThan(0);
  });
});

describe('KICK', () => {
  /** Px a squid covers in the dodge window, and the farther edge where the hint starts. */
  const windowPx = SQUID.dodgeTicks * SQUID.speed * (1 / 60);
  const leadPx = (SQUID.dodgeTicks + KICK_LEAD_TICKS) * SQUID.speed * (1 / 60);

  it('stays quiet while the locked-on squid is still far away', () => {
    const { world, run } = race();
    lockSquidOnPlayer(world, 200);
    expect(run(1).kick).toBe(false);
  });

  it('shows once the squid is inside the dodge window and its lead', () => {
    const { world, run } = race();
    lockSquidOnPlayer(world, Math.round(leadPx - 4));
    expect(run(1).kick).toBe(true);
    const next = race();
    lockSquidOnPlayer(next.world, Math.round(windowPx));
    expect(next.run(1).kick).toBe(true);
  });

  it('shows farther out on Easy, where the logic gives a wider dodge window', () => {
    const between = Math.round(leadPx + 4 * SQUID.speed * (1 / 60));
    const hard = race();
    lockSquidOnPlayer(hard.world, between);
    expect(hard.run(1).kick).toBe(false);
    const easy = race();
    easy.world.difficulty = 'easy';
    lockSquidOnPlayer(easy.world, between);
    expect(easy.run(1).kick).toBe(true);
  });

  it('stays quiet while the player kick is cooling down', () => {
    const { world, player, run } = race();
    lockSquidOnPlayer(world, Math.round(windowPx));
    player.kickCooldown = 20;
    expect(run(1).kick).toBe(false);
  });

  it('gives way to the latched prompt once the squid has wrapped the player', () => {
    const { world, player, run } = race();
    lockSquidOnPlayer(world, Math.round(windowPx));
    player.status.latched = 60;
    expect(run(1).kick).toBe(false);
  });

  it('ignores a squid locked on a rival', () => {
    const { world, run } = race();
    lockSquidOnPlayer(world, Math.round(windowPx));
    const [squid] = world.squids;
    if (squid) squid.target = { kind: 'racer', id: 'tess' };
    expect(run(1).kick).toBe(false);
  });
});

describe('the guide arrow', () => {
  /** A wall with its only gap in the bottom row: from beside it the way on is down. */
  const WALLED = `
  ####################
  #1....#...........F#
  #2....#...........F#
  #3....#...........F#
  #4................F#
  ####################
`;
  const UP: TickInput = { move: { x: 0, y: -1 }, kick: false, use: false, cycle: 0 };
  const DOWN: TickInput = { move: { x: 0, y: 1 }, kick: false, use: false, cycle: 0 };
  const WAY_ON = { x: 0, y: 1 };

  /** A race with the player beside the wall; pushing up is the wrong way, so the steering assist stays out of it. */
  function stuckRace(difficulty: 'easy' | 'normal' | 'hard' = 'easy') {
    const built = race(EASY, WALLED);
    built.world.difficulty = difficulty;
    placeOnTile(built.player, 5, 1);
    return built;
  }

  it('points the way on once the player has pushed a while without getting closer, and not before', () => {
    const { run } = stuckRace();
    expect(run(60, UP).guide).toBeNull();
    expect(run(60, UP).guide).toEqual(WAY_ON);
  });

  it('fades as soon as the player gets closer to the finish', () => {
    const { run } = stuckRace();
    expect(run(120, UP).guide).toEqual(WAY_ON);
    expect(run(30, DOWN).guide).toBeNull();
  });

  it('stays off on Normal and Hard, however long the player is stuck', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const { run } = stuckRace(difficulty);
      expect(run(300, UP).guide, difficulty).toBeNull();
    }
  });

  it('gives way to KICK!', () => {
    const { world, run } = stuckRace();
    run(120, UP);
    lockSquidOnPlayer(world, 60);
    const hints = run(1, UP);
    expect([hints.kick, hints.guide]).toEqual([true, null]);
  });

  it('waits behind PRESS FIRE at first, then takes over so a child who never fires still finds the way', () => {
    const { world, player, run } = stuckRace();
    gainItem(world, player, 'jetFin', 2);
    const early = run(150, UP);
    expect([early.pressFire, early.guide]).toEqual([true, null]);
    const late = run(GUIDE_OVER_PRESS_FIRE_TICKS, UP);
    expect([late.pressFire, late.guide]).toEqual([false, WAY_ON]);
  });
});
