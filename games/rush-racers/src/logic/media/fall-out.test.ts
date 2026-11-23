/**
 * The shared fall, park and respawn timer that run and flight both bring fallen racers back with.
 * Driven on a bare racer; each medium's own tests race it through `afterMove`.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { eventsIn } from '../test-world.ts';
import { fallOut, holdParked, respawnAt } from './fall-out.ts';
import { bareFlyer } from './flight/test-kit.ts';

const RESPAWN_TICKS = 60;
const INVULN_TICKS = 45;

describe('fallOut', () => {
  it('stops the racer where it is, puts it out for respawnTicks and emits racer.fell once', () => {
    const racer = bareFlyer();
    Object.assign(racer.body, { vx: 80, vy: 240 });
    const log = new EventLog<GameEvent>(100);
    fallOut(racer, log, RESPAWN_TICKS);

    expect([racer.body.vx, racer.body.vy, racer.status.fallen]).toEqual([0, 0, RESPAWN_TICKS]);
    expect(eventsIn(log)).toEqual([{ type: 'racer.fell', id: 'player' }]);
  });
});

describe('holdParked', () => {
  it('puts a fallen racer back where it fell, at rest, after something moved it', () => {
    const racer = bareFlyer();
    const log = new EventLog<GameEvent>(100);
    fallOut(racer, log, RESPAWN_TICKS);
    const parked = { x: racer.body.x, y: racer.body.y };
    Object.assign(racer.body, { x: parked.x + 30, y: parked.y + 12, vx: 200, vy: 50 });
    holdParked(racer);

    expect(racer.body).toMatchObject({ ...parked, vx: 0, vy: 0 });
    expect(eventsIn(log)).toEqual([{ type: 'racer.fell', id: 'player' }]);
  });
});

describe('respawnAt', () => {
  it('puts the racer on the spot at rest, briefly invulnerable, and emits racer.respawned with where', () => {
    const racer = bareFlyer();
    const log = new EventLog<GameEvent>(100);
    fallOut(racer, log, RESPAWN_TICKS);
    racer.status.fallen = 0;
    respawnAt(racer, { x: 48, y: 70 }, INVULN_TICKS, log);

    expect(racer.body).toMatchObject({ x: 48, y: 70, vx: 0, vy: 0 });
    expect(racer.status.invulnerable).toBe(INVULN_TICKS);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.fell', id: 'player' },
      { type: 'racer.respawned', id: 'player', x: 48, y: 70 },
    ]);
  });
});
