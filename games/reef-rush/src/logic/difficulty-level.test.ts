import { describe, expect, it } from 'vitest';
import { wantsBurst } from './ai/items.ts';
import { DIFFICULTY } from './difficulty-level.ts';
import { applyHit } from './hazards/hits.ts';
import { pickSquidTarget } from './hazards/squid-target.ts';
import { HIT } from './hazards/tuning.ts';
import { modifiersFor } from './modifiers.ts';
import { openClams } from './pickups/clams.ts';
import { updateProgress } from './race/standings.ts';
import { activeRacers, centreOf } from './racers.ts';
import { placeOnTile, raceOn, racerOf } from './test-world.ts';
import type { Difficulty, RacerId } from './types.ts';

/** Open water with a clam, all four racers on the left edge and the finish on the right. */
const ARENA = `
  ###############################
  #1...........................F#
  #2...........................F#
  #3......?....................F#
  #4...........................F#
  ###############################
`;

/** An arena race on `difficulty` with each listed racer on its tile (x, y) and progress read. */
function scene(difficulty: Difficulty, spots: Partial<Record<RacerId, [number, number]>> = {}) {
  const { world, log } = raceOn(ARENA);
  world.difficulty = difficulty;
  for (const [id, [tx, ty]] of Object.entries(spots) as [RacerId, [number, number]][]) {
    placeOnTile(racerOf(world, id), tx, ty);
  }
  updateProgress(world);
  return { world, log };
}

/** Ticks of stun a plain hit leaves on `id` on `difficulty`. */
function stunTicks(difficulty: Difficulty, id: RacerId): number {
  const { world } = scene(difficulty);
  const racer = racerOf(world, id);
  applyHit(world, racer, 'jelly', null, { x: centreOf(racer).x - 8, y: centreOf(racer).y });
  return racer.status.stunned;
}

describe('the player stun on each level', () => {
  it('is half as long on Easy, three quarters on Normal, as on Hard', () => {
    const hard = stunTicks('hard', 'player');

    expect(stunTicks('normal', 'player')).toBe(Math.round(hard * 0.75));
    expect(stunTicks('easy', 'player')).toBe(Math.round(hard * 0.5));
  });

  it('stays the same for a rival', () => {
    expect(stunTicks('easy', 'tess')).toBe(HIT.stunTicks);
  });
});

describe('who a rival may aim at', () => {
  it('locks a squid on the player on Hard and passes the player over on Easy', () => {
    const squidTarget = (difficulty: Difficulty) => {
      const { world } = scene(difficulty, { player: [14, 1], tess: [8, 2], squib: [2, 3], bo: [2, 4] });
      return pickSquidTarget(world, 'tess', centreOf(racerOf(world, 'tess')), null);
    };

    expect(squidTarget('hard')).toEqual({ kind: 'racer', id: 'player' });
    expect(squidTarget('easy')).toBeNull();
  });

  it('still lets the player lock a squid on a rival on Easy', () => {
    const { world } = scene('easy', { player: [8, 1], tess: [14, 2], squib: [2, 3], bo: [2, 4] });

    expect(pickSquidTarget(world, 'player', centreOf(racerOf(world, 'player')), null)).toEqual({
      kind: 'racer',
      id: 'tess',
    });
  });

  it('fires an Undertow from last place only where the player is not ahead on Easy', () => {
    const wantsUndertow = (difficulty: Difficulty, playerTile: [number, number]) => {
      const { world } = scene(difficulty, { player: playerTile, tess: [14, 2], squib: [10, 3], bo: [2, 4] });
      const bo = racerOf(world, 'bo');
      bo.place = 4;
      bo.stack = ['undertow'];
      return wantsBurst(world, bo, { x: 1, y: 0 }, 0);
    };

    expect(wantsUndertow('hard', [22, 1])).toBe(true);
    expect(wantsUndertow('easy', [22, 1])).toBe(false);
    // Only a rival is ahead, so the pull touches nobody the level protects.
    expect(wantsUndertow('easy', [1, 1])).toBe(true);
  });

  it('spends bursts less often on Normal and Easy', () => {
    const burstsAt = (difficulty: Difficulty, roll: number) => {
      const { world } = scene(difficulty, { player: [2, 1], tess: [12, 2], squib: [2, 3], bo: [13, 2] });
      updateProgress(world);
      const tess = racerOf(world, 'tess');
      tess.stack = ['glowLantern'];
      return wantsBurst(world, tess, { x: 1, y: 0 }, roll * tess.profile.itemAggression);
    };

    // The same draw, as a share of the rival's own aggression.
    expect(burstsAt('hard', 0.6)).toBe(true);
    expect(burstsAt('normal', 0.6)).toBe(true);
    expect(burstsAt('easy', 0.6)).toBe(false);
    expect(burstsAt('easy', 0.3)).toBe(true);
  });
});

describe('swim force on each level', () => {
  it('multiplies a rival by the level rivalForceMul on top of its catch-up', () => {
    const { world } = scene('hard', { player: [10, 1], tess: [10, 2] });
    const [tess, player] = [racerOf(world, 'tess'), racerOf(world, 'player')];

    const full = modifiersFor(tess, player, DIFFICULTY.hard, world.racers).forceMul;
    const halved = modifiersFor(tess, player, { ...DIFFICULTY.hard, rivalForceMul: 0.5 }, world.racers).forceMul;

    expect(halved).toBeCloseTo(full / 2, 9);
  });

  it('holds a rival that has pulled ahead of the player back harder on Easy and Normal than on Hard', () => {
    const force = (difficulty: Difficulty) => {
      const { world } = scene(difficulty, { player: [10, 1], tess: [16, 2] });
      return modifiersFor(racerOf(world, 'tess'), racerOf(world, 'player'), DIFFICULTY[difficulty], world.racers)
        .forceMul;
    };

    expect(force('easy')).toBeLessThan(force('normal'));
    expect(force('normal')).toBeLessThan(force('hard'));
  });

  it('pushes a player trailing the leader on Easy, never one in front, and never on Hard', () => {
    const force = (difficulty: Difficulty, playerTile: [number, number]) => {
      const { world } = scene(difficulty, { player: playerTile, tess: [20, 2], squib: [19, 3], bo: [18, 4] });
      const player = racerOf(world, 'player');
      return modifiersFor(player, player, DIFFICULTY[difficulty], world.racers).forceMul;
    };

    expect(force('easy', [4, 1])).toBeGreaterThan(1.3);
    expect(force('easy', [20, 1])).toBe(1);
    expect(force('hard', [4, 1])).toBe(1);
  });
});

describe('the player clam roll', () => {
  /** How many of 300 opens hand the player Jet Fins, emptying the stack between opens. */
  function jetFinOpens(difficulty: Difficulty): number {
    const { world } = scene(difficulty, { player: [8, 3] });
    const player = racerOf(world, 'player');
    let jets = 0;
    for (let open = 0; open < 300; open++) {
      player.stack = [];
      world.clams.forEach((clam) => {
        clam.closedFor = 0;
      });
      openClams(world, activeRacers(world));
      if (player.stack.includes('jetFin')) jets++;
    }
    return jets;
  }

  it('hands out helpful power-ups more often on Easy', () => {
    expect(jetFinOpens('easy')).toBeGreaterThan(jetFinOpens('hard') * 1.5);
  });
});

describe('a world built without a level', () => {
  it('races on Hard, the tuning every other test measures', () => {
    const { world } = raceOn(ARENA);

    expect(world.difficulty).toBe('hard');
  });
});
