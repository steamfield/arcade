/**
 * The surface of the sea through the real world: a racer breaching out of the water with its
 * momentum, arcing under gravity in the air and splashing back, and everything that must stay in the
 * water (loose power-ups, trapped racers, scattered pearls) stopping at the surface.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { parseLevel } from './level/parse.ts';
import { cellAt } from './level/query.ts';
import type { SwimEnv } from './media/swim/data.ts';
import { buildSwimNav, steerCost } from './media/swim/nav.ts';
import { applyIntent } from './media/swim/physics.ts';
import { SWIM_TUNING as SWIM } from './media/swim/tuning.ts';
import { spawnLoose } from './pickups/loose.ts';
import { scatterPearls } from './pickups/pearl-drift.ts';
import { fieldAt } from './race/flowfield.ts';
import { centreOf } from './racers.ts';
import {
  courseFromLevel,
  eventsIn,
  hold,
  placeAt,
  placeOnTile,
  racerOf,
  step,
  ticksOf,
  tileCentre,
} from './test-world.ts';
import { type LevelDef, type Racer, TILE, type Vec, type World } from './types.ts';
import { createWorld } from './world.ts';

const UP: Vec = { x: 0, y: -1 };
const RIGHT: Vec = { x: 1, y: 0 };
const STILL: Vec = { x: 0, y: 0 };
const CRUISE = SWIM.force / SWIM.drag;

/**
 * The player's lane opens to the sky in columns 2-9 above row 3, with a clam two rows above the
 * surface at (5, 1). The rivals race in sealed lanes below.
 */
const OPEN_SEA: LevelDef = {
  name: 'Open Sea',
  ascii: `
    ##........F#
    ##...?....F#
    ##........F#
    #1........F#
    #.........F#
    ############
    #2........F#
    ############
    #3........F#
    ############
    #4........F#
    ############
  `,
  surface: [{ from: 2, to: 9, row: 3 }],
};
const SURFACE_Y = 3 * TILE;

function raceOnOpenSea() {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(OPEN_SEA), log, { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  return { world, log, player: racerOf(world, 'player') };
}

function isAirAt(world: World, at: Vec): boolean {
  return cellAt(world.level, Math.floor(at.x / TILE), Math.floor(at.y / TILE)) === 'air';
}

describe('breaching the surface', () => {
  it('pops a racer holding up at cruise less than a tile out, then lets it fall back in', () => {
    const { world, log, player } = raceOnOpenSea();
    placeOnTile(player, 5, 4);
    let highestTop = Number.POSITIVE_INFINITY;
    for (let tick = 0; tick < 240; tick++) {
      step(world, log, 1, hold(UP));
      highestTop = Math.min(highestTop, player.body.y);
    }

    expect(highestTop).toBeGreaterThanOrEqual(SURFACE_Y - TILE);
    expect(highestTop).toBeLessThan(SURFACE_Y - player.body.h / 2);
    expect(eventsIn(log, 'racer.breached', 'racer.splashed').slice(0, 2)).toEqual([
      { type: 'racer.breached', id: 'player' },
      { type: 'racer.splashed', id: 'player' },
    ]);
    expect(eventsIn(log, 'clam.opened')).toEqual([]);
  });

  it('carries a racer that dashes up from a tile under the surface high enough to open a clam two rows above it', () => {
    const { world, log, player } = raceOnOpenSea();
    placeAt(player, { x: 5.5 * TILE, y: SURFACE_Y + TILE });
    player.body.vy = -CRUISE;

    step(world, log, 1, hold(UP, { kick: true }));
    step(world, log, 60, hold(UP));

    expect(eventsIn(log, 'racer.kicked')).toContainEqual({ type: 'racer.kicked', id: 'player' });
    expect(eventsIn(log, 'clam.opened')).toEqual([
      { type: 'clam.opened', id: 'player', index: 0, kind: expect.any(String) },
    ]);
  });

  it('emits racer.breached once on the first tick the centre is in air and racer.splashed once back in water', () => {
    const { world, log, player } = raceOnOpenSea();
    placeAt(player, { x: 5.5 * TILE, y: SURFACE_Y + 8 });
    player.body.vy = -150;
    const airAtTickStart: boolean[] = [];
    for (let tick = 0; tick < 120; tick++) {
      airAtTickStart.push(isAirAt(world, centreOf(player)));
      step(world, log);
    }
    const firstAir = airAtTickStart.indexOf(true);
    const backInWater = airAtTickStart.indexOf(false, firstAir);

    expect(firstAir).toBeGreaterThan(0);
    expect(backInWater).toBeGreaterThan(firstAir);
    expect(ticksOf(log, 'racer.breached')).toEqual([firstAir + 1]);
    expect(ticksOf(log, 'racer.splashed')).toEqual([backInWater + 1]);
  });
});

describe('a racer in the air', () => {
  const AIR: SwimEnv = { kind: 'swim', current: null, inKelp: false, inAir: true };
  const WATER: SwimEnv = { ...AIR, inAir: false };
  const DECAY = 1 - SWIM.extra.airDrag * TICK_DT;

  /** A racer from a fresh world, at rest, after one `applyIntent` tick in `env`, plus that tick's events. */
  function oneTick(env: SwimEnv, move: Vec, setup: (racer: Racer) => void = () => {}) {
    const { player } = raceOnOpenSea();
    player.body.vx = 0;
    player.body.vy = 0;
    setup(player);
    const log = new EventLog<GameEvent>(100);
    applyIntent(player, hold(move, { kick: true }), env, SWIM, SWIM.base, log, TICK_DT);
    return { body: player.body, kickCooldown: player.kickCooldown, events: eventsIn(log, 'racer.kicked') };
  }

  it('falls under gravity with no idle sink: idle and steering sideways fall alike, unlike in water', () => {
    const idle = oneTick(AIR, STILL).body;
    const sideways = oneTick(AIR, RIGHT).body;

    expect(idle.vy).toBeCloseTo(SWIM.extra.airGravity * TICK_DT * DECAY, 9);
    expect(sideways.vy).toBeCloseTo(idle.vy, 9);
    expect(oneTick(WATER, STILL).body.vy).not.toBeCloseTo(oneTick(WATER, RIGHT).body.vy, 9);
  });

  it('ignores currents and kelp', () => {
    const plain = oneTick(AIR, RIGHT).body;
    const overCurrentAndKelp = oneTick({ ...AIR, current: { x: -1, y: 0 }, inKelp: true }, RIGHT).body;

    expect(overCurrentAndKelp).toEqual(plain);
  });

  it('steers at airSteer of swim force', () => {
    const { vx } = oneTick(AIR, RIGHT).body;

    expect(vx).toBeCloseTo(SWIM.force * SWIM.extra.airSteer * TICK_DT * DECAY, 9);
  });

  it('does not kick, while the kick cooldown keeps counting down', () => {
    expect(oneTick(AIR, UP)).toMatchObject({ kickCooldown: 0, events: [] });
    expect(oneTick(AIR, UP, (racer) => (racer.kickCooldown = 5))).toMatchObject({ kickCooldown: 4, events: [] });
  });

  it('still caps speed', () => {
    const { body } = oneTick(AIR, UP, (racer) => (racer.body.vy = -400));

    expect(Math.sqrt(body.vx * body.vx + body.vy * body.vy)).toBeCloseTo(SWIM.maxSpeed, 9);
  });
});

describe('rivals and the air', () => {
  it('charges 4 to enter an air tile, so the field stays finite over it', () => {
    const level = parseLevel(OPEN_SEA);
    const nav = buildSwimNav(level, new Set());

    expect(steerCost('air', false, RIGHT)).toBe(4);
    for (let y = 0; y < 3; y++) {
      for (let x = 2; x <= 9; x++) expect(Number.isFinite(fieldAt(nav.steer, nav, { x, y }))).toBe(true);
    }
  });
});

describe('what stays in the water', () => {
  it('stops a loose power-up rising to the surface', () => {
    const { world, log } = raceOnOpenSea();
    spawnLoose(world, 'inkSac', 1, tileCentre(7, 3));
    for (let tick = 0; tick < 150; tick++) {
      step(world, log);
      const loose = world.loose[0];
      expect(loose && isAirAt(world, loose)).toBe(false);
    }

    expect(world.loose[0]?.y).toBeGreaterThanOrEqual(SURFACE_Y);
    expect(world.loose[0]?.y).toBeLessThan(SURFACE_Y + 1);
  });

  it('stops a bubble-trapped racer rising at the surface', () => {
    const { world, log, player } = raceOnOpenSea();
    placeOnTile(player, 5, 4);
    player.status.trapped = 200;
    for (let tick = 0; tick < 150; tick++) {
      step(world, log);
      expect(isAirAt(world, centreOf(player))).toBe(false);
    }

    expect(centreOf(player).y).toBeGreaterThanOrEqual(SURFACE_Y);
    expect(centreOf(player).y).toBeLessThan(SURFACE_Y + 1);
  });

  it('never lets a scattered pearl into the air', () => {
    const { world, log } = raceOnOpenSea();
    world.loosePearls.push(...scatterPearls(tileCentre(8, 3), 1, 3, null));
    for (let tick = 0; tick < 30; tick++) {
      step(world, log);
      expect(world.loosePearls.filter((pearl) => isAirAt(world, pearl.at))).toEqual([]);
    }

    expect(world.loosePearls).toHaveLength(3);
  });
});
