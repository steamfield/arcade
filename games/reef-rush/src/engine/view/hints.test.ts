import { describe, expect, it } from 'vitest';
import { gainPowerUp } from '../../logic/powerups/stack.ts';
import { IDLE, raceOn, racerOf, step } from '../../logic/test-world.ts';
import type { TickInput, World } from '../../logic/types.ts';
import {
  type HintMemory,
  hintsEnabled,
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

/** A racing world and a memory that has seen nothing; `run` steps it and asks for hints after every tick. */
function race() {
  const { world, log } = raceOn(OPEN);
  const memory: HintMemory = newHintMemory();
  const player = racerOf(world, 'player');
  const run = (ticks: number, input = IDLE, enabled = true) => {
    let hints = updateHints(memory, world, enabled);
    for (let i = 0; i < ticks; i++) {
      step(world, log, 1, input);
      hints = updateHints(memory, world, enabled);
    }
    return hints;
  };
  return { world, player, run };
}

function lockSquidOnPlayer(world: World): void {
  const player = racerOf(world, 'player');
  world.squids.push({
    x: player.body.x + 200,
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
    expect(hintsEnabled(races, difficulty)).toBe(shown);
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

  it('times out when the player ignores it', () => {
    const { world, player, run } = race();
    gainPowerUp(world, player, 'jetFin');
    expect(run(PRESS_B_TICKS - 2).pressB).toBe(true);
    expect(run(3).pressB).toBe(false);
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
    expect(run(10, IDLE, false)).toEqual(NO_HINTS);
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

  it('never shows with an empty stack', () => {
    const { run } = race();
    expect(run(UNUSED_PULSE_TICKS * 2).pulseStack).toBe(false);
  });
});

describe('KICK', () => {
  it('shows while a squid is locked on the player', () => {
    const { world, run } = race();
    expect(run(2).kick).toBe(false);
    lockSquidOnPlayer(world);
    expect(run(1).kick).toBe(true);
  });

  it('gives way to the latched prompt once the squid has wrapped the player', () => {
    const { world, player, run } = race();
    lockSquidOnPlayer(world);
    player.status.latched = 60;
    expect(run(1).kick).toBe(false);
  });

  it('ignores a squid locked on a rival', () => {
    const { world, run } = race();
    lockSquidOnPlayer(world);
    const [squid] = world.squids;
    if (squid) squid.target = { kind: 'racer', id: 'tess' };
    expect(run(1).kick).toBe(false);
  });
});
