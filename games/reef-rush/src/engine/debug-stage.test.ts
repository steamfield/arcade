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
  /** A coral gate two tiles tall at columns 9-10, rows 2-3, with a way round below. */
  const GATE = `
    ####################
    #1................F#
    #2.......CC.......F#
    #3.......CC.......F#
    #4................F#
    ####################
  `;

  it('holds a Cannonball three tiles before the first coral, level with the middle of the gate', () => {
    const { world } = raceOn(GATE);
    applyStage(world, 'cannonball');
    const player = world.racers.find((racer) => racer.id === 'player');
    const centre = player && { x: player.body.x + player.body.w / 2, y: player.body.y + player.body.h / 2 };
    expect(player?.items).toEqual([{ kind: 'cannonball', charges: 1 }, null, null]);
    expect(centre).toEqual({ x: 6.5 * 16, y: 3 * 16 });
  });

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

  it('knows every stage it names, except those that need a current, a dark zone, coral or a tall room', () => {
    const needsMore = ['riptide', 'dark', 'cannonball', 'enemy-modes'];
    for (const stage of STAGES.filter((name) => !needsMore.includes(name))) {
      const { world } = raceOn(ARENA);
      expect(() => applyStage(world, stage), stage).not.toThrow();
    }
  });

  it('stands the player on the floor, a crab 3 tiles ahead walking away, a shark 6 ahead facing them, rivals up top', () => {
    const { world } = raceOn(ARENA);
    applyStage(world, 'enemies');
    const player = world.racers.find((r) => r.id === 'player');
    const tile = player && {
      x: Math.floor((player.body.x + player.body.w / 2) / 16),
      y: Math.floor((player.body.y + player.body.h / 2) / 16),
    };
    expect(tile).toEqual({ x: 1, y: 4 });
    expect(world.enemies.map(({ kind, home, facing, mode }) => ({ kind, home, facing, mode }))).toEqual([
      { kind: 'crab', home: { x: 4, y: 4 }, facing: 1, mode: 'patrol' },
      { kind: 'shark', home: { x: 7, y: 2 }, facing: -1, mode: 'patrol' },
    ]);
    const rivalRows = world.racers
      .filter((r) => r.id !== 'player')
      .map((r) => Math.floor((r.body.y + r.body.h / 2) / 16));
    expect(rivalRows).toEqual([1, 2, 3]);
  });

  it('lines up every enemy kind in each of its modes for enemy-modes', () => {
    const { world } = raceOn(`
      ####################
      #.................F#
      #.................F#
      #1................F#
      #2................F#
      #3................F#
      #4................F#
      ####################
    `);
    applyStage(world, 'enemy-modes');
    expect(world.enemies.map(({ kind, mode }) => `${kind} ${mode}`)).toEqual([
      'crab patrol',
      'crab stagger',
      'eel hidden',
      'eel windup',
      'eel lunge',
      'shark patrol',
      'shark windup',
      'shark charge',
      'shark stagger',
    ]);
  });

  it('names the column when a stage needs a floor the course does not have', () => {
    const { world } = raceOn(`
      ####################
      #1................F#
      #2................F#
      #3................F#
      #4................F#
      ####################
    `);
    world.level.cells[5] = world.level.cells[5]?.map(() => 'water') ?? [];
    expect(() => applyStage(world, 'enemies')).toThrow('need a floor below row 1 in column 1');
  });
});
