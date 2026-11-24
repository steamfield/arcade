import { configureLogging, EventLog, type LogEntry } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES, courseById, DEFAULT_COURSE } from '../logic/courses/index.ts';
import type { GameEvent } from '../logic/events.ts';
import { raceOn } from '../logic/test-world.ts';
import { createWorld } from '../logic/world.ts';
import { applyStage, STAGES, stageFor } from './capture-stages.ts';

describe('which stage a launch gets', () => {
  const search = '?stage=squid-lockon';

  it('is none on a normal launch, even with ?stage= in the link', () => {
    expect(stageFor({ debug: false, testMode: false }, search)).toBeNull();
  });

  it('is honoured with ?debug=1 or in test mode', () => {
    expect(stageFor({ debug: true, testMode: false }, search)).toBe('squid-lockon');
    expect(stageFor({ debug: false, testMode: true }, search)).toBe('squid-lockon');
  });

  it('ignores a name it does not know, warning with the valid names, and a launch without one quietly', () => {
    const logged: LogEntry[] = [];
    configureLogging((entry) => logged.push(entry));
    try {
      expect(stageFor({ debug: true, testMode: true }, '?stage=bogus')).toBeNull();
      expect(stageFor({ debug: true, testMode: true }, '')).toBeNull();
      expect(stageFor({ debug: false, testMode: false }, '?stage=bogus')).toBeNull();
    } finally {
      configureLogging(() => {});
    }
    expect(logged).toEqual([
      {
        level: 'warn',
        namespace: 'rush-racers:stage',
        message: `Unknown ?stage=bogus, so the race is not staged. Valid stages: ${STAGES.join(', ')}`,
      },
    ]);
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

  it('knows every stage it names, except those that need a current, a dark zone, coral, a tall room, a surface or a black hole', () => {
    const needsMore = ['riptide', 'dark', 'cannonball', 'enemy-modes', 'surface', 'hole'];
    for (const stage of STAGES.filter((name) => !needsMore.includes(name))) {
      const { world } = raceOn(ARENA);
      expect(() => applyStage(world, stage), stage).not.toThrow();
    }
  });

  it("puts the player 3 tiles under the ocean course's surface, with sky straight above", () => {
    const { world } = raceOn(DEFAULT_COURSE.level);
    applyStage(world, 'surface');
    const player = world.racers.find((r) => r.id === 'player');
    const surface = world.level.surface[0];
    const tile = player && {
      x: Math.floor((player.body.x + player.body.w / 2) / 16),
      y: Math.floor((player.body.y + player.body.h / 2) / 16),
    };

    expect(tile).toEqual({ x: (surface?.from ?? 0) + 5, y: (surface?.row ?? 0) + 3 });
    expect(world.level.cells[(surface?.row ?? 0) - 1]?.[tile?.x ?? 0]).toBe('air');
  });

  it("puts the player at rest in Drift Test's black hole's column, two tiles below its reach", () => {
    const course = COURSES['drift-test'];
    const world = createWorld(course, new EventLog<GameEvent>(100), { seed: 1 });
    applyStage(world, 'hole');
    const player = world.racers.find((r) => r.id === 'player');
    const hole = world.level.wells.find((well) => well.horizon !== null);
    const centre = player && { x: player.body.x + player.body.w / 2, y: player.body.y + player.body.h / 2 };

    expect(centre?.x).toBe(hole?.centre.x);
    expect((centre?.y ?? 0) - (hole?.centre.y ?? 0)).toBe((hole?.reach ?? 0) + 2 * 16);
    expect(player?.body).toMatchObject({ vx: 0, vy: 0 });
  });

  it('names what is missing when the hole stage runs on a course with no black hole', () => {
    const { world } = raceOn(ARENA);
    expect(() => applyStage(world, 'hole')).toThrow('The hole stage needs a black hole');
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

  it('moves an enemy-modes enemy to the nearest column with a floor when its own has none', () => {
    // Columns 10-12 of the floor are a bounce cloud, not rock, as on Sky Test: the crab staged 9
    // tiles ahead of the player in column 1 stands in column 9 instead, the nearest column with rock under it.
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
    world.level.cells[7] = world.level.cells[7]?.map((cell, x) => (x >= 10 && x <= 12 ? 'bounce' : cell)) ?? [];
    applyStage(world, 'enemy-modes');
    expect(world.enemies.filter((enemy) => enemy.kind === 'crab').map(({ home, mode }) => ({ home, mode }))).toEqual([
      { home: { x: 8, y: 6 }, mode: 'patrol' },
      { home: { x: 9, y: 6 }, mode: 'stagger' },
    ]);
  });

  it('moves an enemy-modes enemy ahead rather than behind when columns either side of its own both have a floor', () => {
    // A one-column hole in the floor at column 10: the crab staged 9 tiles ahead of the player in
    // column 1 stands in column 11, ahead, where column 9 behind is just as near.
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
    world.level.cells[7] = world.level.cells[7]?.map((cell, x) => (x === 10 ? 'bounce' : cell)) ?? [];
    applyStage(world, 'enemy-modes');
    expect(world.enemies.filter((enemy) => enemy.kind === 'crab').map(({ home, mode }) => ({ home, mode }))).toEqual([
      { home: { x: 8, y: 6 }, mode: 'patrol' },
      { home: { x: 11, y: 6 }, mode: 'stagger' },
    ]);
  });

  it('stages enemy-modes on Sky Test, whose floor has a bounce cloud in it', () => {
    const skyTest = courseById('sky-test');
    if (!skyTest) throw new Error('Sky Test is not registered');
    const world = createWorld(skyTest, new EventLog<GameEvent>(100), { seed: 1 });
    expect(() => applyStage(world, 'enemy-modes')).not.toThrow();
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
