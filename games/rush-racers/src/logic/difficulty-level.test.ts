import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { chooseItemSlot } from './ai/items.ts';
import { DEFAULT_COURSE, registerCourse } from './courses/index.ts';
import type { Course } from './courses/types.ts';
import { DIFFICULTY, dodgeTicks, playerHasLanternLight, rivalCatchUpFor } from './difficulty-level.ts';
import type { GameEvent } from './events.ts';
import { applyHit } from './hazards/hits.ts';
import { advanceProjectiles } from './hazards/projectiles.ts';
import { pickSquidTarget } from './hazards/squid-target.ts';
import { HIT } from './hazards/tuning.ts';
import { modifiersFor } from './modifiers.ts';
import { length } from './num.ts';
import { openClams } from './pickups/clams.ts';
import { riptideCurrentAt } from './powerups/riptides.ts';
import { SQUID } from './powerups/tuning.ts';
import { fireUndertow } from './powerups/undertow.ts';
import { fireItem } from './powerups/use.ts';
import { updateProgress } from './race/standings.ts';
import { activeRacers, centreOf } from './racers.ts';
import { courseFromLevel, eventsIn, giveItems, hold, IDLE, placeOnTile, raceOn, racerOf, step } from './test-world.ts';
import type { Difficulty, RacerId } from './types.ts';
import { createWorld } from './world.ts';

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
      giveItems(bo, ['undertow']);
      return chooseItemSlot(world, bo, { x: 1, y: 0 }, 0) !== null;
    };

    expect(wantsUndertow('hard', [22, 1])).toBe(true);
    expect(wantsUndertow('easy', [22, 1])).toBe(false);
    // Only a rival is ahead, so the pull touches nobody the level protects.
    expect(wantsUndertow('easy', [1, 1])).toBe(true);
  });

  it('spends items less often on Normal and Easy', () => {
    const firesAt = (difficulty: Difficulty, roll: number) => {
      const { world } = scene(difficulty, { player: [2, 1], tess: [12, 2], squib: [2, 3], bo: [13, 2] });
      updateProgress(world);
      const tess = racerOf(world, 'tess');
      giveItems(tess, ['glowLantern']);
      return (
        chooseItemSlot(
          world,
          tess,
          { x: 1, y: 0 },
          (roll * tess.profile.itemAggression) / tess.profile.reactionTicks,
        ) !== null
      );
    };

    // The same draw, as a share of the rival's own aggression.
    expect(firesAt('hard', 0.6)).toBe(true);
    expect(firesAt('normal', 0.6)).toBe(true);
    expect(firesAt('easy', 0.6)).toBe(false);
    expect(firesAt('easy', 0.3)).toBe(true);
  });
});

describe('swim force on each level', () => {
  const rivalForce = (difficulty: Difficulty, ticksAfterGo = 1000) => {
    const { world } = scene(difficulty, { player: [10, 1], tess: [16, 2] });
    world.race.raceTick = ticksAfterGo;
    return modifiersFor(world, racerOf(world, 'tess')).forceMul;
  };

  it('holds a rival that has pulled ahead of the player back harder on Easy and Normal than on Hard', () => {
    expect(rivalForce('easy')).toBeLessThan(rivalForce('normal'));
    expect(rivalForce('normal')).toBeLessThan(rivalForce('hard'));
  });

  it('lets Easy rivals swim at their full pace until the catch-up starts after the GO', () => {
    const pace = racerOf(scene('easy').world, 'tess').profile.forceMul * DIFFICULTY.easy.rivalForceMul;

    expect(rivalForce('easy', 0)).toBeCloseTo(pace, 9);
    expect(rivalForce('easy', DIFFICULTY.easy.rivalCatchUpDelayTicks)).toBeLessThan(pace);
  });

  it('keeps a rival ahead of the player swimming at a visible share of its pace on Easy', () => {
    const pace = racerOf(scene('easy').world, 'tess').profile.forceMul;

    expect(rivalForce('easy')).toBeGreaterThanOrEqual(0.35 * pace);
  });

  it('pushes a player trailing the leader on Easy, never one in front, and never on Hard', () => {
    const force = (difficulty: Difficulty, playerTile: [number, number]) => {
      const { world } = scene(difficulty, { player: playerTile, tess: [20, 2], squib: [19, 3], bo: [18, 4] });
      return modifiersFor(world, racerOf(world, 'player')).forceMul;
    };

    expect(force('easy', [4, 1])).toBeGreaterThan(1.3);
    expect(force('easy', [20, 1])).toBe(1);
    expect(force('hard', [4, 1])).toBe(1);
  });
});

describe('rival catch-up bounds on a course', () => {
  const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];
  const HARD_OVERRIDE = { lagTiles: 6, max: 1.4 };
  /** The arena as an unlisted course that loosens Hard's catch-up only. */
  const hardOnly: Course = { ...courseFromLevel(ARENA), id: 'catch-up-hard-only', catchUp: { hard: HARD_OVERRIDE } };
  registerCourse(hardOnly);

  const boundsOn = (course: Course, difficulty: Difficulty) =>
    rivalCatchUpFor(createWorld(course, new EventLog<GameEvent>(100), { seed: 1, difficulty }));

  it.each(LEVELS)('are the table bounds on %s for a course without an override', (difficulty) => {
    expect(boundsOn(courseFromLevel(ARENA), difficulty)).toEqual(DIFFICULTY[difficulty].rivalCatchUp);
  });

  it('take a Hard-only override field by field and leave Easy and Normal as the table has them', () => {
    expect(boundsOn(hardOnly, 'hard')).toEqual({ ...DIFFICULTY.hard.rivalCatchUp, ...HARD_OVERRIDE });
    expect(boundsOn(hardOnly, 'normal')).toEqual(DIFFICULTY.normal.rivalCatchUp);
    expect(boundsOn(hardOnly, 'easy')).toEqual(DIFFICULTY.easy.rivalCatchUp);
  });
});

describe('the player clam roll', () => {
  /** How many of 300 opens hand the player Jet Fins, emptying the inventory between opens. */
  function jetFinOpens(difficulty: Difficulty): number {
    const { world } = scene(difficulty, { player: [8, 3] });
    const player = racerOf(world, 'player');
    let jets = 0;
    for (let open = 0; open < 300; open++) {
      giveItems(player, []);
      world.clams.forEach((clam) => {
        clam.closedFor = 0;
      });
      openClams(world, activeRacers(world));
      if (player.items[0]?.kind === 'jetFin') jets++;
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

/** What a rival's power-up does to the player (tess is on tile 8, the player on 9). */
function afterRivalAttack(
  difficulty: Difficulty,
  attack: 'flash' | 'bubble' | 'puffer' | 'ink' | 'riptide' | 'undertow',
) {
  const { world } = scene(difficulty, { player: [9, 2], tess: [8, 2], squib: [2, 3], bo: [2, 4] });
  const player = racerOf(world, 'player');
  const tess = racerOf(world, 'tess');
  switch (attack) {
    case 'flash':
    case 'bubble':
    case 'puffer':
      return { landed: applyHit(world, player, attack, 'tess', centreOf(tess)) !== null, player };
    case 'ink': {
      world.inks.push({ x: centreOf(player).x, y: centreOf(player).y, radius: 20, ttl: 100, owner: 'tess' });
      advanceProjectiles(world, activeRacers(world), 1 / 60);
      return { landed: player.status.slowed > 0, player };
    }
    case 'riptide': {
      const c = centreOf(player);
      world.riptides.push({ x: c.x - 20, y: c.y - 20, w: 40, h: 40, dir: { x: 1, y: 0 }, ttl: 100, owner: 'tess' });
      return { landed: riptideCurrentAt(world, player.body, 'player') !== null, player };
    }
    case 'undertow':
      fireUndertow(world, racerOf(world, 'bo'));
      return { landed: player.status.undertow > 0, player };
  }
}

describe('a rival power-up on the player', () => {
  const attacks = ['flash', 'bubble', 'puffer', 'ink', 'riptide', 'undertow'] as const;

  it.each(attacks)('lands a %s on Hard and Normal', (attack) => {
    expect(afterRivalAttack('hard', attack).landed).toBe(true);
    expect(afterRivalAttack('normal', attack).landed).toBe(true);
  });

  it.each(attacks)('never lands a %s on Easy', (attack) => {
    expect(afterRivalAttack('easy', attack).landed).toBe(false);
  });

  it('leaves no stun or trap behind on Easy', () => {
    const { player } = afterRivalAttack('easy', 'flash');
    expect(player.status.stunned).toBe(0);
    expect(player.status.invulnerable).toBe(0);
  });
});

describe('invulnerability after a hit', () => {
  const invulnerable = (difficulty: Difficulty, id: RacerId) => {
    const { world } = scene(difficulty);
    const racer = racerOf(world, id);
    applyHit(world, racer, 'jelly', null, { x: centreOf(racer).x - 8, y: centreOf(racer).y });
    return racer.status.invulnerable;
  };

  it('lasts three times as long for the player on Easy and is unchanged elsewhere', () => {
    expect(invulnerable('hard', 'player')).toBe(HIT.invulnerableTicks);
    expect(invulnerable('normal', 'player')).toBe(HIT.invulnerableTicks);
    expect(invulnerable('easy', 'player')).toBe(3 * HIT.invulnerableTicks);
    expect(invulnerable('easy', 'tess')).toBe(HIT.invulnerableTicks);
  });
});

describe('the shark on each level', () => {
  it('hunts harder on Normal and Hard, which share one tuning, and keeps the patient shark on Easy', () => {
    expect(DIFFICULTY.normal.shark).toEqual(DIFFICULTY.hard.shark);
    expect(DIFFICULTY.hard.shark).toEqual({ sightTiles: 8, patrolTiles: 4, recoverTicks: 24, chargeTurn: 0.05 });
    expect(DIFFICULTY.easy.shark).toEqual({ sightTiles: 6, patrolTiles: 3, recoverTicks: 40, chargeTurn: 0 });
  });
});

describe('the squid dodge window', () => {
  it('is 12 ticks on Hard, longer on Normal and longest on Easy, as `dodgeTicks` says', () => {
    expect(dodgeTicks(scene('hard').world)).toBe(SQUID.dodgeTicks);
    expect(dodgeTicks(scene('normal').world)).toBe(18);
    expect(dodgeTicks(scene('easy').world)).toBe(24);
  });

  /** Whether a kick 44 px from contact (about 16 ticks of squid flight) makes tess's squid miss the player. */
  function dodgedFromAfar(difficulty: Difficulty): boolean {
    const { world, log } = raceOn(ARENA);
    for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
    placeOnTile(racerOf(world, 'tess'), 4, 2);
    placeOnTile(racerOf(world, 'player'), 14, 2);
    updateProgress(world);
    giveItems(racerOf(world, 'tess'), ['homingSquid']);
    fireItem(world, racerOf(world, 'tess'), 0, { x: 1, y: 0 });
    // Rivals may not squid the player on Easy, so the lock is made on Normal and the level swapped after.
    world.difficulty = 'normal';
    for (let tick = 0; ; tick++) {
      const squid = world.squids[0];
      if (!squid || tick > 200) throw new Error('the squid never closed on the player');
      if (length(centreOf(racerOf(world, 'player')).x - squid.x, centreOf(racerOf(world, 'player')).y - squid.y) <= 44)
        break;
      step(world, log);
    }
    world.difficulty = difficulty;
    step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    return eventsIn(log, 'squid.dodged').length > 0;
  }

  it('lets a kick 16 ticks from contact dodge on Normal and Easy but not on Hard', () => {
    expect(dodgedFromAfar('hard')).toBe(false);
    expect(dodgedFromAfar('normal')).toBe(true);
    expect(dodgedFromAfar('easy')).toBe(true);
  });
});

describe('the start of an Easy race', () => {
  it('sends every rival off the line at a visible speed while the player sits still', () => {
    const { world, log } = scene('easy', { player: [1, 1], tess: [1, 2], squib: [1, 3], bo: [1, 4] });
    step(world, log, 120, IDLE);

    for (const id of ['tess', 'squib', 'bo'] as const) {
      const { vx, vy } = racerOf(world, id).body;
      expect(length(vx, vy), id).toBeGreaterThanOrEqual(50);
    }
  });
});

describe('light in the dark by level', () => {
  it.each([
    ['easy', true],
    ['normal', false],
    ['hard', false],
  ] as const)('on %s lights the player like a Glow Lantern: %s, and never a rival', (difficulty, lit) => {
    const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1, difficulty });

    expect(playerHasLanternLight(world, racerOf(world, 'player'))).toBe(lit);
    expect(
      world.racers.filter((racer) => racer.id !== 'player').some((racer) => playerHasLanternLight(world, racer)),
    ).toBe(false);
  });
});
