import { describe, expect, it } from 'vitest';
import { gainPowerUp } from '../../logic/powerups/stack.ts';
import { SQUID } from '../../logic/powerups/tuning.ts';
import { IDLE, placeOnTile, raceOn, racerOf, step } from '../../logic/test-world.ts';
import type { TickInput, World } from '../../logic/types.ts';
import {
  GUIDE_OVER_PRESS_B_TICKS,
  type HintConfig,
  type HintMemory,
  hintConfig,
  KICK_LEAD_TICKS,
  NO_HINTS,
  newHintMemory,
  PRESS_B_TICKS,
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

const BURST: TickInput = { move: { x: 0, y: 0 }, kick: false, burst: true };

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

describe('PRESS B', () => {
  it('shows from the moment a power-up lands, and not before', () => {
    const { world, player, run } = race();
    expect(run(30).pressB).toBe(false);
    gainPowerUp(world, player, 'jetFin');
    expect(run(1).pressB).toBe(true);
  });

  it('goes away once the player fires the stack, and stays away for the rest of the race', () => {
    const { world, player, run } = race();
    run(5);
    gainPowerUp(world, player, 'jetFin');
    expect(run(10).pressB).toBe(true);
    expect(run(1, BURST).pressB).toBe(false);
    gainPowerUp(world, player, 'puffer');
    expect(run(200).pressB).toBe(false);
  });

  it('times out when the player ignores it on a first race that is not Easy', () => {
    const { world, player, run } = race(NORMAL_FIRST_RACE);
    gainPowerUp(world, player, 'jetFin');
    expect(run(PRESS_B_TICKS - 2).pressB).toBe(true);
    expect(run(3).pressB).toBe(false);
  });

  it('stays up on Easy until the first burst, however long the player waits', () => {
    const { world, player, run } = race();
    gainPowerUp(world, player, 'jetFin');
    expect(run(PRESS_B_TICKS * 3).pressB).toBe(true);
  });

  it('hides when the stack empties under it', () => {
    const { world, player, run } = race();
    gainPowerUp(world, player, 'jetFin');
    expect(run(10).pressB).toBe(true);
    player.stack = [];
    expect(run(1).pressB).toBe(false);
  });

  it('is silent when hints are off', () => {
    const { world, player, run } = race();
    gainPowerUp(world, player, 'jetFin');
    expect(run(10, IDLE, { enabled: false, easy: true })).toEqual(NO_HINTS);
  });

  it('is silent during the countdown', () => {
    const { world, player, run } = race();
    world.race.phase = 'countdown';
    gainPowerUp(world, player, 'jetFin');
    expect(run(10)).toEqual(NO_HINTS);
  });
});

describe('the pulsing B on the stack', () => {
  it('starts after 5 seconds of holding something unused', () => {
    const { world, player, run } = race();
    gainPowerUp(world, player, 'jetFin');
    expect(run(UNUSED_PULSE_TICKS - 2).pulseStack).toBe(false);
    expect(run(3).pulseStack).toBe(true);
  });

  it('stops when the stack is fired, and starts counting again after the cooldown', () => {
    const { world, player, run } = race();
    gainPowerUp(world, player, 'puffer');
    expect(run(UNUSED_PULSE_TICKS + 1).pulseStack).toBe(true);
    expect(run(1, BURST).pulseStack).toBe(false);
    // The puffer is still held, but nothing counts as unused until the cooldown ends and 5 s pass.
    expect(run(UNUSED_PULSE_TICKS - 1).pulseStack).toBe(false);
    expect(run(200).pulseStack).toBe(true);
  });

  it('takes over the moment PRESS B gives up on a first race that is not Easy', () => {
    const { world, player, run } = race(NORMAL_FIRST_RACE);
    gainPowerUp(world, player, 'jetFin');
    const before = run(PRESS_B_TICKS - 1);
    expect([before.pressB, before.pulseStack]).toEqual([true, false]);
    const after = run(1);
    expect([after.pressB, after.pulseStack]).toEqual([false, true]);
  });

  it('never shows with an empty stack', () => {
    const { run } = race();
    expect(run(UNUSED_PULSE_TICKS * 2).pulseStack).toBe(false);
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
  const UP: TickInput = { move: { x: 0, y: -1 }, kick: false, burst: false };
  const DOWN: TickInput = { move: { x: 0, y: 1 }, kick: false, burst: false };
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

  it('waits behind PRESS B! at first, then takes over so a child who never fires still finds the way', () => {
    const { world, player, run } = stuckRace();
    gainPowerUp(world, player, 'jetFin');
    const early = run(150, UP);
    expect([early.pressB, early.guide]).toEqual([true, null]);
    const late = run(GUIDE_OVER_PRESS_B_TICKS, UP);
    expect([late.pressB, late.guide]).toEqual([false, WAY_ON]);
  });
});
