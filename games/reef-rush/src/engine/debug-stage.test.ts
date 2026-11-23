import { describe, expect, it } from 'vitest';
import { raceOn } from '../logic/test-world.ts';
import { applyStage, STAGES, stageFor } from './debug-stage.ts';

describe('which stage a launch gets', () => {
  const search = '?stage=squid-lockon';

  it('is none on a normal launch, even with ?stage= in the link', () => {
    expect(stageFor({ debug: false, testMode: false }, search)).toBeNull();
  });

  it('is honoured with ?debug=1 or in test mode', () => {
    expect(stageFor({ debug: true, testMode: false }, search)).toBe('squid-lockon');
    expect(stageFor({ debug: false, testMode: true }, search)).toBe('squid-lockon');
  });

  it('ignores a name it does not know, and a launch without one', () => {
    expect(stageFor({ debug: true, testMode: true }, '?stage=bogus')).toBeNull();
    expect(stageFor({ debug: true, testMode: true }, '')).toBeNull();
  });
});

describe('applying a stage', () => {
  const ARENA = `
    ####################
    #1................F#
    #2................F#
    #3................F#
    #4................F#
    ####################
  `;

  it('puts a squid on the player for squid-lockon and a latch on them for squid-latched', () => {
    const { world } = raceOn(ARENA);
    applyStage(world, 'squid-lockon');
    expect(world.squids).toHaveLength(1);
    expect(world.squids[0]?.target).toEqual({ kind: 'racer', id: 'player' });
    applyStage(world, 'squid-latched');
    expect(world.racers.find((r) => r.id === 'player')?.status.latched).toBeGreaterThan(0);
  });

  it('knows every stage it names, except those that need a current or a dark zone in the course', () => {
    for (const stage of STAGES.filter((name) => name !== 'riptide' && name !== 'dark')) {
      const { world } = raceOn(ARENA);
      expect(() => applyStage(world, stage), stage).not.toThrow();
    }
  });
});
