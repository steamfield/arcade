import { createRng, EventLog, TICK_DT, TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, PLAYER_PROFILE } from './ai/profiles.ts';
import { CHARACTERS, pickRivals } from './characters.ts';
import { DEFAULT_COURSE } from './courses/index.ts';
import type { GameEvent } from './events.ts';
import { RACE_LIMIT_TICKS } from './race/standings.ts';
import { courseFromLevel } from './test-world.ts';
import { CHARACTER_IDS, type CharacterId, RACER_IDS, RNG_SALTS, type TickInput } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

const LANES = courseFromLevel({
  name: 'lanes',
  ascii: `
    1...F
    2...F
    3...F
    4...F
  `,
});

const worldAt = (seed: number, character?: CharacterId) =>
  createWorld(LANES, new EventLog<GameEvent>(), character ? { seed, character } : { seed });

describe('picking rivals', () => {
  it.each(CHARACTER_IDS)('fields three different rivals, never the player, when %s is picked', (player) => {
    for (const seed of SEEDS) {
      const rivals = pickRivals(createRng(seed), player);

      expect(rivals).toHaveLength(3);
      expect(new Set(rivals).size, `seed ${seed}: ${rivals.join(', ')}`).toBe(3);
      expect(rivals, `seed ${seed}`).not.toContain(player);
    }
  });

  it('fields the same rivals for the same seed and different line-ups across seeds', () => {
    const lineUps = SEEDS.map((seed) => pickRivals(createRng(seed), 'rudy').join(','));

    expect(SEEDS.map((seed) => pickRivals(createRng(seed), 'rudy').join(','))).toEqual(lineUps);
    expect(new Set(lineUps).size).toBeGreaterThan(5);
  });

  it('draws every slot from one pool, so each other character races in each slot', () => {
    const lineUps = SEEDS.map((seed) => pickRivals(createRng(seed), 'rudy'));
    const others = CHARACTER_IDS.filter((id) => id !== 'rudy').sort();

    for (const slot of [0, 1, 2]) {
      expect([...new Set(lineUps.map((lineUp) => lineUp[slot]))].sort(), `slot ${slot}`).toEqual(others);
    }
  });

  it('gives every other character a turn as a rival', () => {
    const fielded = new Set(SEEDS.flatMap((seed) => pickRivals(createRng(seed), 'rudy')));

    expect([...fielded].sort()).toEqual(CHARACTER_IDS.filter((id) => id !== 'rudy').sort());
  });
});

describe('racing at par', () => {
  it("gives every rival a swim force within 0.95 to 1.10 of the player's", () => {
    const outside = CHARACTER_IDS.filter((id) => {
      const ratio = CHARACTERS[id].profile.forceMul / PLAYER_PROFILE.forceMul;
      return ratio < 0.95 || ratio > 1.1;
    });

    expect(outside).toEqual([]);
  });

  it('keeps the cast in its order of swim force, Rudy weakest and Nib strongest', () => {
    const force = (id: CharacterId) => CHARACTERS[id].profile.forceMul;
    const tiers: CharacterId[][] = [['rudy'], ['baron', 'selene', 'rook'], ['gil'], ['streak', 'onyx'], ['nib']];

    for (const tier of tiers) expect(new Set(tier.map(force)).size, tier.join()).toBe(1);
    const tierForces = tiers.map((tier) => force(tier[0] as CharacterId));
    expect(tierForces).toEqual([...tierForces].sort((a, b) => a - b));
    expect(new Set(tierForces).size).toBe(tiers.length);
  });

  // Seed 3 is one where the rivals' old 1.4x force left this player 4.4 s back; seed 1 is the plan's.
  it.each([1, 3])('keeps a player who never dashes or fires within 3 s of the winner on Normal, seed %i', (seed) => {
    const steadySwimmer = { ...BOT_PROFILES.expert, kickSkill: 0, itemAggression: 0 };
    const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(100_000), {
      seed,
      difficulty: 'normal',
      playerBot: steadySwimmer,
      endsWhen: 'everyone',
    });
    const idle: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };
    for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) {
      stepWorld(world, idle, TICK_DT);
    }
    const finishes = world.racers.map((racer) => racer.finished?.tick ?? Number.POSITIVE_INFINITY);
    const player = world.racers.find((racer) => racer.id === 'player')?.finished?.tick ?? Number.POSITIVE_INFINITY;

    expect(player - Math.min(...finishes), `finish ticks ${finishes.join(', ')}`).toBeLessThanOrEqual(3 * TICK_HZ);
  });
});

describe('a race line-up', () => {
  it("puts the player in as Rudy by default with rivals drawn from the seed's roster stream", () => {
    const seed = 7;
    // The documented stream derivation: the mixed seed XOR the stream's salt.
    const roster = createRng((Math.imul(seed, 0x9e3779b1) ^ RNG_SALTS.roster) >>> 0);

    expect(worldAt(seed).racers.map((racer) => racer.character)).toEqual(['rudy', ...pickRivals(roster, 'rudy')]);
  });

  it('races the picked character and keeps it out of the rival slots', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const world = worldAt(seed, 'selene');

      expect(world.racers.map((racer) => racer.id)).toEqual(RACER_IDS);
      expect(world.racers[0]?.character).toBe('selene');
      expect(world.racers.slice(1).map((racer) => racer.character)).not.toContain('selene');
    }
  });

  it("races each rival slot with its character's profile under the slot's id, and the player with the player's", () => {
    const world = worldAt(3, 'nib');
    const [player, ...rivals] = world.racers;

    expect(player?.profile).toEqual(PLAYER_PROFILE);
    for (const rival of rivals) {
      expect(rival.profile).toEqual({ id: rival.id, ...CHARACTERS[rival.character].profile });
    }
  });
});
