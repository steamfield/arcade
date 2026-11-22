import { createRng, EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILE, RIVAL_PROFILES } from './ai/profiles.ts';
import { CHARACTERS, pickRivals } from './characters.ts';
import type { GameEvent } from './events.ts';
import { parseLevel } from './level/parse.ts';
import { CHARACTER_IDS, type CharacterId, RACER_IDS, RNG_SALTS } from './types.ts';
import { createWorld } from './world.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

const LANES = parseLevel({
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

  it('gives every other character a turn as a rival', () => {
    const fielded = new Set(SEEDS.flatMap((seed) => pickRivals(createRng(seed), 'rudy')));

    expect([...fielded].sort()).toEqual(CHARACTER_IDS.filter((id) => id !== 'rudy').sort());
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

  it('keeps each rival slot on its pre-roster tuned profile whoever is picked, while profiles are placeholders', () => {
    for (const character of CHARACTER_IDS) {
      for (const seed of SEEDS.slice(0, 10)) {
        const rivals = worldAt(seed, character).racers.slice(1);
        const slotProfiles = rivals.map((rival) => (rival.id === 'player' ? null : RIVAL_PROFILES[rival.id]));
        expect(
          rivals.map((rival) => rival.profile),
          `${character} seed ${seed}`,
        ).toEqual(slotProfiles);
      }
    }
  });
});
