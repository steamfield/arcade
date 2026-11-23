import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { chooseItemSlot } from './ai/items.ts';
import { BOT_PROFILES, PLAYER_PROFILE } from './ai/profiles.ts';
import { createAiMemory, PROGRESS_BACKSTOP_TICKS, rivalIntent } from './ai/rival.ts';
import { CHARACTERS } from './characters.ts';
import { DIFFICULTY } from './difficulty-level.ts';
import type { GameEvent } from './events.ts';
import { applyHit } from './hazards/hits.ts';
import { HIT } from './hazards/tuning.ts';
import { mediumOf } from './media/index.ts';
import { modifiersFor } from './modifiers.ts';
import { openClams } from './pickups/clams.ts';
import { heldItems } from './powerups/inventory.ts';
import { riptideCurrentAt } from './powerups/riptides.ts';
import { CLAM } from './powerups/tuning.ts';
import { fireItem } from './powerups/use.ts';
import { catchUpTarget } from './race/catch-up.ts';
import { recordFinishes, updatePlaces, updateProgress } from './race/standings.ts';
import { activeRacers, centreOf } from './racers.ts';
import { courseFromLevel, giveItems, IDLE, placeOnTile, racerOf } from './test-world.ts';
import {
  type Difficulty,
  type Intent,
  RACER_IDS,
  type RacerId,
  type RivalProfile,
  type TickInput,
  type World,
} from './types.ts';
import { createWorld, stepRace } from './world.ts';

/** Open water with a clam on tile (8, 3), all four racers on the left edge and the finish on the right. */
const ARENA = `
  ###############################
  #1...........................F#
  #2...........................F#
  #3......?....................F#
  #4...........................F#
  ###############################
`;

/** One walled lane per racer, so every aim is straight right and nobody bumps. */
const LANES = `
  ####################
  #1................F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

/** The column racers cross to finish an ARENA race. */
const ARENA_FINISH_COLUMN = 29;

/**
 * Hands the human slot `id` to the AI the way the game does: one tick of `stepRace` with an input
 * for every other human and none for `id`.
 */
function takeOver(world: World, id: RacerId): void {
  const inputs: Partial<Record<RacerId, TickInput>> = {};
  for (const human of world.humans) if (human !== id) inputs[human] = IDLE;
  stepRace(world, inputs, TICK_DT);
}

/**
 * A race on `ascii` (ARENA unless given) at `difficulty`, with each listed racer on its tile (x, y)
 * and progress read. Two humans (`player`, `tess`) unless `twoHumans` is false; `playerBot` drives
 * the player slot.
 */
function scene(
  difficulty: Difficulty,
  spots: Partial<Record<RacerId, [number, number]>> = {},
  {
    twoHumans = true,
    ascii = ARENA,
    playerBot,
  }: { twoHumans?: boolean; ascii?: string; playerBot?: RivalProfile } = {},
) {
  // Created on the default level and switched after, so the Easy rules can be read for a second
  // human: createWorld refuses two humans on Easy, but the rule functions must not depend on that.
  const world = createWorld(courseFromLevel(ascii), new EventLog<GameEvent>(100_000), {
    seed: 1,
    ...(twoHumans ? { humans: ['player', 'tess'] as const } : {}),
    ...(playerBot ? { playerBot } : {}),
  });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  world.difficulty = difficulty;
  for (const [id, [tx, ty]] of Object.entries(spots) as [RacerId, [number, number]][]) {
    placeOnTile(racerOf(world, id), tx, ty);
  }
  updateProgress(world);
  return world;
}

/** Ticks of stun and invulnerability a plain urchin hit on an empty-handed racer leaves. */
function afterUrchin(world: World, id: RacerId) {
  const racer = racerOf(world, id);
  applyHit(world, racer, 'urchin', null, { x: centreOf(racer).x - 8, y: centreOf(racer).y });
  return { stunned: racer.status.stunned, invulnerable: racer.status.invulnerable };
}

/** Whether `attacker`'s Glow Lantern flash, fired right next to `target`, stuns it. */
function flashLands(world: World, attacker: RacerId, target: RacerId): boolean {
  const from = racerOf(world, attacker);
  placeOnTile(from, 8, 2);
  placeOnTile(racerOf(world, target), 9, 2);
  giveItems(from, ['glowLantern']);
  fireItem(world, from, 0, { x: 1, y: 0 });
  return racerOf(world, target).status.stunned > 0;
}

/**
 * Whether `id`, holding a Glow Lantern on tile (12, 2) with `bo` just ahead, fires it on a draw of
 * `share` times its own aggression over its reaction ticks. So it fires when `share` is under the
 * level's item aggression factor for it.
 */
function firesLanternAt(world: World, id: RacerId, share: number): boolean {
  const racer = racerOf(world, id);
  placeOnTile(racer, 12, 2);
  placeOnTile(racerOf(world, 'bo'), 13, 3);
  updateProgress(world);
  giveItems(racer, ['glowLantern']);
  const roll = (share * racer.profile.itemAggression) / racer.profile.reactionTicks;
  return chooseItemSlot(world, racer, { x: 1, y: 0 }, roll) !== null;
}

/** How many of 300 clam opens hand `id` (alone on the clam) Jet Fins, emptying its slots between opens. */
function jetFinOpens(world: World, id: RacerId): number {
  const racer = racerOf(world, id);
  placeOnTile(racer, 8, 3);
  let jets = 0;
  for (let open = 0; open < 300; open++) {
    giveItems(racer, []);
    for (const clam of world.clams) clam.closedFor = 0;
    openClams(world, activeRacers(world));
    if (racer.items[0]?.kind === 'jetFin') jets++;
  }
  return jets;
}

/** Moves `id` onto the finish line in its own start row and records it as the next racer home. */
function finishNext(world: World, id: RacerId): void {
  placeOnTile(racerOf(world, id), ARENA_FINISH_COLUMN, RACER_IDS.indexOf(id) + 1);
  updateProgress(world);
  recordFinishes(world);
}

/** Intents for `id` over `ticks` ticks, held on lane tile (5, row) but moving right, so only the backstop sees it stuck. */
function heldMovingIntents(world: World, id: RacerId, row: number, ticks: number): Intent[] {
  const racer = racerOf(world, id);
  return Array.from({ length: ticks }, () => {
    placeOnTile(racer, 5, row);
    racer.body.vx = 60;
    racer.body.vy = 0;
    return rivalIntent(world, racer, world.rngs[`ai.${id}`]);
  });
}

/** The stuck recovery steers across the lane instead of along it. */
const sideways = (intent: Intent) => Math.abs(intent.move.x) < 0.5 && Math.abs(intent.move.y) > 0.8;

const forceOf = (world: World, id: RacerId) => modifiersFor(world, racerOf(world, id)).forceMul;

describe('a human in the tess slot', () => {
  it('is stunned for the human length on Normal while squib keeps the rival length', () => {
    const stun = (difficulty: Difficulty, id: RacerId) => afterUrchin(scene(difficulty), id).stunned;

    expect(stun('normal', 'tess')).toBe(Math.round(stun('hard', 'tess') * DIFFICULTY.normal.playerStatusMul));
    expect(stun('normal', 'player')).toBe(Math.round(stun('hard', 'player') * DIFFICULTY.normal.playerStatusMul));
    expect(stun('normal', 'squib')).toBe(stun('hard', 'squib'));
  });

  it('gets one roll from a clam while squib gets the rival rolls', () => {
    const itemsFromClam = (id: RacerId) => {
      const world = scene('normal', { [id]: [8, 3] });
      openClams(world, activeRacers(world));
      return heldItems(racerOf(world, id)).length;
    };

    expect(itemsFromClam('tess')).toBe(1);
    expect(itemsFromClam('squib')).toBe(CLAM.rivalRolls);
  });

  it('gets the Easy invulnerability and clam bias while squib does not', () => {
    // createWorld refuses two humans on Easy; the rules themselves must still read the human slots.
    const easy = () => scene('easy');
    const hard = () => scene('hard');

    expect(afterUrchin(easy(), 'tess').invulnerable).toBe(
      DIFFICULTY.easy.playerInvulnerableMul * HIT.invulnerableTicks,
    );
    expect(afterUrchin(easy(), 'squib').invulnerable).toBe(HIT.invulnerableTicks);
    expect(jetFinOpens(easy(), 'tess')).toBeGreaterThan(jetFinOpens(hard(), 'tess') * 1.5);
    expect(jetFinOpens(easy(), 'squib')).toBe(jetFinOpens(hard(), 'squib'));
  });
});

describe('attacks between humans and rivals', () => {
  it.each(['normal', 'hard'] as const)('lets each human flash the other on %s', (difficulty) => {
    expect(flashLands(scene(difficulty), 'player', 'tess')).toBe(true);
    expect(flashLands(scene(difficulty), 'tess', 'player')).toBe(true);
  });

  it.each(['normal', 'hard'] as const)('lets a rival flash a human in the tess slot on %s', (difficulty) => {
    expect(flashLands(scene(difficulty), 'squib', 'tess')).toBe(true);
  });

  it('keeps a rival flash off the one Easy human after the AI took it over', () => {
    const world = scene('easy', {}, { twoHumans: false });
    takeOver(world, 'player');

    expect(flashLands(world, 'tess', 'player')).toBe(false);
  });
});

describe('a human slot the AI took over', () => {
  it('spends items at the level rival rate on Normal and is still stunned for the human length', () => {
    const takenOver = (difficulty: Difficulty) => {
      const world = scene(difficulty);
      takeOver(world, 'tess');
      return world;
    };
    const rivalShare = DIFFICULTY.normal.rivalItemAggressionMul;

    expect(firesLanternAt(takenOver('normal'), 'tess', rivalShare + 0.05)).toBe(false);
    expect(firesLanternAt(takenOver('normal'), 'tess', rivalShare - 0.05)).toBe(true);
    expect(afterUrchin(takenOver('normal'), 'tess').stunned).toBe(
      Math.round(afterUrchin(takenOver('hard'), 'tess').stunned * DIFFICULTY.normal.playerStatusMul),
    );
  });

  it('spends items at the level rival rate in the player slot too', () => {
    const world = scene('normal', {}, { twoHumans: false });
    takeOver(world, 'player');

    expect(firesLanternAt(world, 'player', DIFFICULTY.normal.rivalItemAggressionMul + 0.05)).toBe(false);
  });

  it('keeps the Easy invulnerability and clam bias when it is the one default human', () => {
    const takenOverOnEasy = () => {
      const world = scene('easy', {}, { twoHumans: false });
      takeOver(world, 'player');
      return world;
    };

    expect(afterUrchin(takenOverOnEasy(), 'player').invulnerable).toBe(
      DIFFICULTY.easy.playerInvulnerableMul * HIT.invulnerableTicks,
    );
    expect(jetFinOpens(takenOverOnEasy(), 'player')).toBeGreaterThan(
      jetFinOpens(scene('hard', {}, { twoHumans: false }), 'player') * 1.5,
    );
  });

  it('still feels the current of its own Riptide lane on Easy', () => {
    const world = scene('easy', { player: [8, 1] }, { twoHumans: false });
    takeOver(world, 'player');
    const player = racerOf(world, 'player');
    const centre = centreOf(player);
    world.riptides.push({
      x: centre.x - 20,
      y: centre.y - 20,
      w: 40,
      h: 40,
      dir: { x: 1, y: 0 },
      ttl: 100,
      owner: 'player',
    });

    expect(riptideCurrentAt(world, player.body, 'player')).not.toBeNull();
  });
});

describe('item aggression', () => {
  it('is full for a bot driving the player slot and the level rival rate for squib on Normal', () => {
    const rivalShare = DIFFICULTY.normal.rivalItemAggressionMul;
    const withBot = () => scene('normal', {}, { twoHumans: false, playerBot: BOT_PROFILES.expert });

    expect(firesLanternAt(withBot(), 'player', rivalShare + 0.05)).toBe(true);
    expect(firesLanternAt(withBot(), 'squib', rivalShare + 0.05)).toBe(false);
    expect(firesLanternAt(withBot(), 'squib', rivalShare - 0.05)).toBe(true);
  });
});

describe('swim force for several humans', () => {
  it('is the same for two humans level with each other', () => {
    const world = scene('normal', { player: [10, 1], tess: [10, 2], squib: [20, 3], bo: [4, 4] });

    expect(forceOf(world, 'tess')).toBe(forceOf(world, 'player'));
  });

  it('pushes a human far behind the leader in either slot', () => {
    const behind = scene('normal', { player: [20, 1], tess: [4, 2], squib: [20, 3], bo: [20, 4] });
    const level = scene('normal', { player: [20, 1], tess: [20, 2], squib: [20, 3], bo: [20, 4] });
    const mirrored = scene('normal', { player: [4, 1], tess: [20, 2], squib: [20, 3], bo: [20, 4] });

    expect(forceOf(behind, 'tess')).toBeGreaterThan(forceOf(level, 'tess'));
    expect(forceOf(behind, 'tess')).toBe(forceOf(mirrored, 'player'));
  });

  it('paces a rival to the leading human, not to the player slot', () => {
    const spots: Partial<Record<RacerId, [number, number]>> = { player: [4, 1], tess: [24, 2], squib: [14, 3] };
    const withTessHuman = scene('hard', spots);
    const playerAlone = scene('hard', spots, { twoHumans: false });

    // Squib trails tess, the leading human, so it is pushed; measured against the player it is held back.
    expect(forceOf(withTessHuman, 'squib')).toBeGreaterThan(forceOf(playerAlone, 'squib'));
  });
});

describe('the racer rivals pace themselves to', () => {
  it('is the one human, behind the field or finished', () => {
    const world = scene('hard', { player: [4, 1], tess: [20, 2], squib: [20, 3], bo: [20, 4] }, { twoHumans: false });
    expect(catchUpTarget(world).id).toBe('player');

    finishNext(world, 'player');
    expect(catchUpTarget(world).id).toBe('player');
  });

  it('is the unfinished human with less progress left, ties to the earlier slot', () => {
    const ahead = scene('hard', { player: [6, 1], tess: [16, 2] });
    const level = scene('hard', { player: [16, 1], tess: [16, 2] });

    expect(catchUpTarget(ahead).id).toBe('tess');
    expect(catchUpTarget(level).id).toBe('player');
  });

  it('is the unfinished human once the other has finished', () => {
    const world = scene('hard', { player: [6, 1], tess: [16, 2] });
    finishNext(world, 'tess');

    expect(catchUpTarget(world).id).toBe('player');
  });

  it('is the human with the better finish place once both have finished', () => {
    const world = scene('hard', { player: [6, 1], tess: [16, 2] });
    finishNext(world, 'tess');
    finishNext(world, 'player');

    expect(catchUpTarget(world).id).toBe('tess');
  });
});

describe('the stuck backstop', () => {
  it('never fires for a bot driving the player slot', () => {
    const world = scene('hard', {}, { twoHumans: false, ascii: LANES, playerBot: PLAYER_PROFILE });

    expect(heldMovingIntents(world, 'player', 1, PROGRESS_BACKSTOP_TICKS + 100).some(sideways)).toBe(false);
  });

  it(`fires for a taken-over human held in place for ${PROGRESS_BACKSTOP_TICKS} ticks`, () => {
    const world = scene('hard', {}, { ascii: LANES });
    takeOver(world, 'tess');

    expect(heldMovingIntents(world, 'tess', 3, PROGRESS_BACKSTOP_TICKS + 100).findIndex(sideways)).toBe(
      PROGRESS_BACKSTOP_TICKS,
    );
  });
});

describe('a rival Undertow on Easy', () => {
  it('stays held while the human is ahead and may fire while the human is behind', () => {
    const wantsUndertow = (playerTile: [number, number]) => {
      const world = scene(
        'easy',
        { player: playerTile, tess: [14, 2], squib: [10, 3], bo: [2, 4] },
        { twoHumans: false },
      );
      updatePlaces(world);
      const bo = racerOf(world, 'bo');
      giveItems(bo, ['undertow']);
      return chooseItemSlot(world, bo, { x: 1, y: 0 }, 0) !== null;
    };

    expect(wantsUndertow([22, 1])).toBe(false);
    expect(wantsUndertow([1, 1])).toBe(true);
  });
});
