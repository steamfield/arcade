/**
 * Spring mushrooms (bounce cells) in run's nav and pilot, on small inline levels: a rival takes a
 * mushroom's launch onto a plateau no jump reaches, holding Up for the higher launch, and a mushroom
 * in the floor is a place a runner may jump over rather than a stretch of floor to walk.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { parseLevel } from '../../level/parse.ts';
import { courseFromLevel, IDLE, step } from '../../test-world.ts';
import { RACER_IDS } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { MEDIA } from '../index.ts';
import { BOUNCE_HOLD_TICKS, buildLinks } from './links.ts';

const NOTHING_BROKEN: ReadonlySet<number> = new Set();

/**
 * A plateau five tiles high (cols 11-18, rows 4-8) with the finish on top of it, a wall no jump
 * clears, and a mushroom in the floor at col 9 in front of it. Runners start on row 8.
 */
const PLATEAU = `
  ####################
  #.................F#
  #.................F#
  #.................F#
  #..........#########
  #..........#########
  #..........#########
  #..........#########
  #1.2.3.4...#########
  #########B##########
`;

/** A flat floor at row 5 with a mushroom in it at col 8; runners stand on row 4. */
const FLAT = `
  ##############
  #............#
  #............#
  #............#
  #1234.......F#
  ########B#####
`;

describe('a spring mushroom in run nav', () => {
  it('links its tile only to where its launches land, the plateau among them, Up held to reach it', () => {
    const level = parseLevel({ name: 'plateau', ascii: PLATEAU });
    const links = buildLinks(level, NOTHING_BROKEN, MEDIA.run.tuning).get(8 * level.width + 9) ?? [];
    const onPlateau = links.filter((link) => Math.floor(link.to / level.width) === 3);

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.kind === 'bounce')).toBe(true);
    expect(onPlateau.map((link) => ({ dir: link.dir, holdTicks: link.holdTicks }))).toContainEqual({
      dir: 1,
      holdTicks: BOUNCE_HOLD_TICKS,
    });
  });

  it('lets a runner jump over it from the tile before to the tile after', () => {
    const level = parseLevel({ name: 'flat', ascii: FLAT });
    const before = 4 * level.width + 7;
    const after = 4 * level.width + 9;
    const links = buildLinks(level, NOTHING_BROKEN, MEDIA.run.tuning).get(before) ?? [];

    expect(links.filter((link) => link.to === after).map((link) => link.kind)).toEqual(['jump']);
  });
});

describe('rivals on a course whose only way on is a mushroom', () => {
  it('each bounce off it onto the plateau and finish', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(PLATEAU, 'run'), log, { seed: 1 });
    world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
    for (let tick = 0; tick < 1200 && world.racers.some((racer) => racer.id !== 'player' && !racer.finished); tick++)
      step(world, log, 1, IDLE);
    const rivals = RACER_IDS.filter((id) => id !== 'player');
    const bounced = new Set(log.all().flatMap((event) => (event.type === 'racer.bounced' ? [event.id] : [])));

    expect(rivals.filter((id) => !bounced.has(id))).toEqual([]);
    expect(world.racers.filter((racer) => racer.id !== 'player' && !racer.finished).map((racer) => racer.id)).toEqual(
      [],
    );
  });
});
