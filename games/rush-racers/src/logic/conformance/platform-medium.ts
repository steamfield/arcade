/**
 * Test-only: a medium that switches on every platformer seam generic code reads (stomps, solid crates
 * opened from below, pits, ledges, sideways-only racer collision), built on glide's movement so the
 * seam tests don't depend on any shipped medium. It records each `afterMove` call. Register it with
 * `platformRace`; the game never does.
 */
import { EventLog } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import { registerMedium } from '../media/index.ts';
import type { Medium } from '../media/types.ts';
import { courseFromLevel } from '../test-world.ts';
import type { MoveContacts, RacerId, Vec } from '../types.ts';
import { createWorld } from '../world.ts';
import { GLIDE_EFFECTS, GLIDE_MEDIUM } from './glide.ts';

/** Upward speed after a stomp in the platform medium, px/s. */
export const PLATFORM_STOMP_BOUNCE = 200;

/** One `afterMove` call: whose, on which world tick, where the racer was, and what it ran into. */
export interface AfterMoveCall {
  id: RacerId;
  tick: number;
  at: Vec;
  contacts: MoveContacts;
}

/** Every `afterMove` call the platform medium has seen since `platformRace` last cleared it. */
export const afterMoveCalls: AfterMoveCall[] = [];

/** The platform medium: glide's movement with every platformer seam on. */
export const PLATFORM_MEDIUM: Medium = {
  ...GLIDE_MEDIUM,
  id: 'platform',
  effects: {
    ...GLIDE_EFFECTS,
    stompBounce: PLATFORM_STOMP_BOUNCE,
    solidClams: true,
    pitBelow: true,
    allowsLedges: true,
  },
  racerCollision: 'horizontal',
  afterMove(world, racer, contacts) {
    afterMoveCalls.push({ id: racer.id, tick: world.tick, at: { x: racer.body.x, y: racer.body.y }, contacts });
  },
};

registerMedium(PLATFORM_MEDIUM);

/**
 * A world on `ascii` in the platform medium, already racing (countdown skipped, nothing stepped), with
 * an empty event log and no `afterMove` calls recorded.
 */
export function platformRace(ascii: string, seed = 1) {
  afterMoveCalls.length = 0;
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(ascii, PLATFORM_MEDIUM.id), log, { seed });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  return { world, log };
}

/**
 * `rows` (the player's area, with its own walls, start `1` and finish `F`) under three sealed one-row
 * rival lanes, so rivals race without reaching what the test puts in front of the player. Player-area
 * row r is level row r + `PLATFORM_ARENA_TOP`.
 */
export function platformArena(rows: readonly string[], seed = 1) {
  const width = rows[0]?.length ?? 0;
  const wall = '#'.repeat(width);
  const lane = (digit: string) => `#${digit}${'.'.repeat(width - 4)}F#`;
  return platformRace([wall, lane('2'), wall, lane('3'), wall, lane('4'), wall, ...rows].join('\n'), seed);
}

/** Rows above the player area in every `platformArena`. */
export const PLATFORM_ARENA_TOP = 7;
