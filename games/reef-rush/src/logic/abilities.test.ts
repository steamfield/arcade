/**
 * Every place the race consults a character's ability, driven through the real
 * systems with the default cast (the player races as Rudy). The scaffold's hooks
 * change nothing, so each test pins the plain rule at its call site: an ability
 * that leaks into a racer that doesn't have it fails here.
 */
import { describe, expect, it } from 'vitest';
import { applyHit } from './hazards/hits.ts';
import { HIT } from './hazards/tuning.ts';
import { modifiersFor } from './modifiers.ts';
import { length } from './num.ts';
import { gainPowerUp } from './powerups/stack.ts';
import { BUBBLE } from './powerups/tuning.ts';
import { centreOf } from './racers.ts';
import { BASE_MODIFIERS } from './swim/physics.ts';
import { eventsIn, hold, placeAt, placeOnTile, raceOn, racerOf, step, tileCentre } from './test-world.ts';
import { type HitCause, type Racer, TILE, type World } from './types.ts';

/** Open water with the starts on the left and an urchin at (6, 4). */
const OPEN = `
  ##############
  #1..........F#
  #2..........F#
  #3..........F#
  #4....*.....F#
  #...........F#
  #...........F#
  ##############
`;

/** The player's lane has coral at (4, 1), with a way round below; the rivals race behind rock. */
const CORAL_AHEAD = `
  ###########
  #1..C....F#
  #........F#
  ###########
  #2.......F#
  #3.......F#
  #4.......F#
  ###########
`;

/** Puts `rear` overlapping `front` from the left by 4 px on tile row `ty`, both at rest. */
function overlapping(rear: Racer, front: Racer, tx: number, ty: number): void {
  placeOnTile(rear, tx, ty);
  placeAt(front, { x: tileCentre(tx, ty).x + rear.body.w - 4, y: tileCentre(tx, ty).y });
}

/** Stuns both racers so their input is idle and only the bump moves them sideways. */
function stun(...racers: Racer[]): void {
  for (const racer of racers) racer.status.stunned = 30;
}

/** The pair's momentum along x, weighting each velocity by its mass. */
const momentumX = (world: World) =>
  [racerOf(world, 'player'), racerOf(world, 'tess')].reduce(
    (sum, racer) => sum + racer.profile.mass * racer.body.vx,
    0,
  );

describe('the default cast swims, bumps and gets hit by the plain rules', () => {
  it('swims with base modifiers and nothing added by its ability', () => {
    const { world } = raceOn(OPEN);
    const player = racerOf(world, 'player');

    expect(player.character).toBe('rudy');
    expect(modifiersFor(player, player)).toEqual(BASE_MODIFIERS);
  });

  it('holds three power-ups, so a fourth pushes out the oldest', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');

    for (const kind of ['jetFin', 'bubbleShield', 'puffer', 'inkSac'] as const) gainPowerUp(world, player, kind);

    expect(player.stack).toEqual(['bubbleShield', 'puffer', 'inkSac']);
    expect(eventsIn(log, 'powerup.lost')).toEqual([
      { type: 'powerup.lost', id: 'player', kind: 'jetFin', cause: 'full' },
    ]);
  });

  it('stays stunned and trapped for the full time', () => {
    const { world } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    const tess = racerOf(world, 'tess');

    applyHit(world, player, 'urchin', null, tileCentre(6, 4));
    applyHit(world, tess, 'bubble', 'player', centreOf(tess));

    expect(player.status.stunned).toBe(HIT.stunTicks);
    expect(tess.status.trapped).toBe(BUBBLE.trapTicks);
  });

  it.each<HitCause>(['urchin', 'jelly', 'bubble', 'puffer', 'flash'])('takes a %s hit', (cause) => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');

    expect(applyHit(world, player, cause, cause === 'bubble' ? 'tess' : null, tileCentre(6, 4))).toBe(true);
    expect(eventsIn(log, 'racer.hit')).toEqual([
      { type: 'racer.hit', id: 'player', cause, by: cause === 'bubble' ? 'tess' : null },
    ]);
  });

  it('is pushed apart in a bump by its profile mass', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    const tess = racerOf(world, 'tess');
    overlapping(player, tess, 5, 5);
    stun(player, tess);
    const before = { player: player.body.x, tess: tess.body.x };

    step(world, log);

    expect(eventsIn(log, 'racer.bumped')).toEqual([{ type: 'racer.bumped', a: 'player', b: 'tess' }]);
    const playerMoved = before.player - player.body.x;
    const tessMoved = tess.body.x - before.tess;
    // The lighter racer moves further, by the ratio of the masses.
    expect(playerMoved / tessMoved).toBeCloseTo(tess.profile.mass / player.profile.mass, 6);
  });

  it('takes no speed from a racer it bumps from behind', () => {
    const bumped = raceOn(OPEN);
    const apart = raceOn(OPEN);
    for (const { world } of [bumped, apart]) {
      const player = racerOf(world, 'player');
      const tess = racerOf(world, 'tess');
      overlapping(player, tess, 3, 5);
      if (world === apart.world) placeOnTile(tess, 9, 6);
      stun(player, tess);
      player.body.vx = 120;
      tess.body.vx = 20;
    }

    step(bumped.world, bumped.log);
    step(apart.world, apart.log);

    expect(eventsIn(bumped.log, 'racer.bumped')).toHaveLength(1);
    // A bump only moves speed between the pair, so their momentum matches the pair that never touched.
    expect(momentumX(bumped.world)).toBeCloseTo(momentumX(apart.world), 6);
  });

  it('stops against coral it swims into, leaving it whole', () => {
    const { world, log } = raceOn(CORAL_AHEAD);
    const player = racerOf(world, 'player');

    step(world, log, 60, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'coral.broken')).toEqual([]);
    expect(world.broken.size).toBe(0);
    expect(Math.floor(centreOf(player).x / TILE)).toBe(3);
  });

  it('kicks as hard upward as sideways', () => {
    const speedAfterKick = (move: { x: number; y: number }) => {
      const { world, log } = raceOn(OPEN);
      const player = racerOf(world, 'player');
      placeOnTile(player, 6, 2);
      step(world, log, 1, hold(move, { kick: true }));
      expect(eventsIn(log, 'racer.kicked')).toEqual([{ type: 'racer.kicked', id: 'player' }]);
      return length(player.body.vx, player.body.vy);
    };

    expect(speedAfterKick({ x: 0, y: -1 })).toBeCloseTo(speedAfterKick({ x: 1, y: 0 }), 6);
  });

  it('keeps every ability counter at zero through hits and bumps', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    const tess = racerOf(world, 'tess');
    placeOnTile(player, 6, 4);
    overlapping(tess, racerOf(world, 'squib'), 3, 2);

    step(world, log, 240, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'racer.hit').length).toBeGreaterThan(0);
    expect(eventsIn(log, 'racer.bumped').length).toBeGreaterThan(0);
    expect(world.racers.map((racer) => racer.ability)).toEqual(world.racers.map(() => ({ windUp: 0, frenzy: 0 })));
  });
});
