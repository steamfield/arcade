/**
 * Rival Baron Barnacle rams through the coral gate (columns 481-482, rows 8-9) instead of always
 * climbing over it. His steering reads the ram field, so this holds only while that field prices
 * the gate below the climb (`RAM_CORAL_COST` in `race/flowfield.ts`).
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { OCEAN_LEVEL } from '../level/levels.ts';
import { parseLevel } from '../level/parse.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import type { RacerId } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';

const LEVEL = parseLevel(OCEAN_LEVEL);
const IDLE = { move: { x: 0, y: 0 }, kick: false, burst: false };
const GATE_COLUMNS = [481, 482];
/** A tile column well past the gate. */
const PAST_GATE = 495;

/** The first `count` seeds from 1 in which Baron races as a rival against Rudy, with his slot. */
function seedsWithBaron(count: number): { seed: number; slot: RacerId }[] {
  const found: { seed: number; slot: RacerId }[] = [];
  for (let seed = 1; found.length < count; seed++) {
    const world = createWorld(LEVEL, new EventLog<GameEvent>(), { seed, playerBot: BOT_PROFILES.expert });
    const baron = world.racers.find((racer) => racer.character === 'baron');
    if (baron) found.push({ seed, slot: baron.id });
  }
  return found;
}

/** Races until Baron is past the gate; true when he broke gate coral on the way. */
function baronRamsTheGate(seed: number, slot: RacerId): boolean {
  const log = new EventLog<GameEvent>(1_000_000);
  const world = createWorld(LEVEL, log, { seed, playerBot: BOT_PROFILES.expert, endsWhen: 'everyone' });
  const baron = world.racers.find((racer) => racer.id === slot);
  if (!baron) throw new Error(`Seed ${seed} has no racer in slot ${slot}`);
  for (let i = 0; i < RACE_LIMIT_TICKS && baron.body.x < PAST_GATE * 16 && world.race.phase !== 'finished'; i++) {
    stepWorld(world, IDLE, TICK_DT);
  }
  return log
    .all()
    .some((event) => event.type === 'coral.broken' && event.by === slot && GATE_COLUMNS.includes(event.tx));
}

describe('rival Baron and the coral gate', () => {
  it('rams through the gate in most races rather than climbing over it', () => {
    const races = seedsWithBaron(8);
    const rammed = races.filter(({ seed, slot }) => baronRamsTheGate(seed, slot));

    expect(
      rammed.length,
      `gate taken in seeds ${rammed.map((race) => race.seed).join(', ')} of ${races.map((race) => race.seed).join(', ')}`,
    ).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
