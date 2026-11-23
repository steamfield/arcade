/**
 * Racer separation: overlapping racers pushed apart by mass, bumps announced once per contact, and
 * downed racers passing through.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { noItems } from '../racers.ts';
import { type Body, RACER_SIZE, type Racer, type RacerId } from '../types.ts';
import { separateRacers } from './separate.ts';

const body = (x: number, y: number, vx = 0, vy = 0): Body => ({
  x,
  y,
  vx,
  vy,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

function racer(id: RacerId, x: number, mass = 1): Racer {
  return {
    id,
    character: 'rudy',
    motion: { kind: 'swim' },
    body: body(x, 50),
    facing: 1,
    kickCooldown: 0,
    kickCharges: 2,
    kickRecharge: 0,
    progress: Number.POSITIVE_INFINITY,
    place: 1,
    finished: null,
    ai: null,
    profile: { ...PLAYER_PROFILE, id, mass },
    ...noItems(3),
  };
}

describe('racer separation', () => {
  it('pushes overlapping racers apart along the shallower overlap, the lighter one further', () => {
    const light = racer('player', 100, 1);
    const heavy = racer('bo', 106, 2);
    separateRacers([light, heavy], new Set(), new EventLog<GameEvent>());

    expect(light.body.x).toBeCloseTo(96, 6);
    expect(heavy.body.x).toBeCloseTo(108, 6);
    expect(light.body.y).toBe(50);
    expect(heavy.body.y).toBe(50);
  });

  it('exchanges half the closing speed between equal racers on the push axis', () => {
    const chaser = racer('player', 100);
    const leader = racer('tess', 106);
    chaser.body.vx = 40;
    separateRacers([chaser, leader], new Set(), new EventLog<GameEvent>());

    expect(chaser.body.vx).toBeCloseTo(20, 6);
    expect(leader.body.vx).toBeCloseTo(20, 6);
    expect(chaser.body.vy).toBe(0);
    expect(leader.body.vy).toBe(0);
  });

  it('announces a bump once when contact starts, not on every tick it lasts', () => {
    const a = racer('player', 100);
    const b = racer('tess', 106);
    const contacts = new Set<string>();
    const log = new EventLog<GameEvent>();
    const touch = () => {
      a.body.x = 100;
      b.body.x = 106;
      separateRacers([a, b], contacts, log);
    };

    touch();
    touch();
    touch();
    expect(log.all()).toMatchObject([{ type: 'racer.bumped', a: 'player', b: 'tess' }]);
    expect([...contacts]).toEqual(['player|tess']);

    b.body.x = 200;
    separateRacers([a, b], contacts, log);
    expect(contacts.size).toBe(0);

    touch();
    expect(log.all()).toHaveLength(2);
  });

  it('hands a new contact to onBump with the speeds the pair bumped with, then shares their closing speed', () => {
    const a = racer('player', 100);
    const b = racer('tess', 106);
    a.body.vx = 60;
    b.body.vx = 20;
    const seen: [number, number][] = [];

    separateRacers([a, b], new Set(), new EventLog<GameEvent>(), undefined, (first, second) => {
      seen.push([first.body.vx, second.body.vx]);
      // What onBump does to the velocities stays: the shared closing speed is added on top.
      first.body.vx -= 10;
    });

    expect(seen).toEqual([[60, 20]]);
    expect([a.body.vx, b.body.vx]).toEqual([30, 40]);
  });

  it('leaves racers a pixel apart untouched and silent', () => {
    const a = racer('player', 100);
    const b = racer('tess', 113);
    const contacts = new Set<string>();
    const log = new EventLog<GameEvent>();
    separateRacers([a, b], contacts, log);

    expect([a.body.x, b.body.x]).toEqual([100, 113]);
    expect(log.all()).toEqual([]);
    expect(contacts.size).toBe(0);
  });
});

describe('downed racers', () => {
  it.each(['stunned', 'trapped', 'latched'] as const)('pass through a %s racer: no push, no bump', (status) => {
    for (const downed of ['first', 'second'] as const) {
      const a = racer('player', 100);
      const b = racer('tess', 106);
      a.body.vx = 40;
      (downed === 'first' ? a : b).status[status] = 30;
      const log = new EventLog<GameEvent>();
      const bumped: string[] = [];

      separateRacers([a, b], new Set(), log, undefined, (first, second) => bumped.push(`${first.id}|${second.id}`));

      expect([a.body.x, b.body.x, a.body.vx, b.body.vx], `${downed} downed`).toEqual([100, 106, 40, 0]);
      expect(log.all()).toEqual([]);
      expect(bumped).toEqual([]);
    }
  });

  it('forget the contact they were in, so touching again after recovery and parting is a new bump', () => {
    const a = racer('player', 100);
    const b = racer('tess', 106);
    const contacts = new Set<string>();
    const log = new EventLog<GameEvent>();
    const touch = () => {
      a.body.x = 100;
      b.body.x = 106;
      separateRacers([a, b], contacts, log);
    };

    touch();
    b.status.stunned = 30;
    touch();
    expect(contacts.has('player|tess')).toBe(false);

    b.status.stunned = 0;
    b.body.x = 200;
    separateRacers([a, b], contacts, log);
    touch();
    expect(log.all().map((event) => event.type)).toEqual(['racer.bumped', 'racer.bumped']);
  });

  it('keep passing through a racer that recovers while they overlap, until the two come apart', () => {
    const a = racer('player', 100);
    const b = racer('tess', 106);
    const contacts = new Set<string>();
    const log = new EventLog<GameEvent>();
    b.status.stunned = 30;
    separateRacers([a, b], contacts, log);

    b.status.stunned = 0;
    separateRacers([a, b], contacts, log);
    separateRacers([a, b], contacts, log);
    expect([a.body.x, b.body.x]).toEqual([100, 106]);
    expect(log.all()).toEqual([]);

    b.body.x = 200;
    separateRacers([a, b], contacts, log);
    expect(contacts.size).toBe(0);
    b.body.x = 106;
    separateRacers([a, b], contacts, log);
    expect(log.all()).toMatchObject([{ type: 'racer.bumped', a: 'player', b: 'tess' }]);
  });
});
