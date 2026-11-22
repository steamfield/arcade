/**
 * Every signature ability, driven through the real race (createWorld, stepWorld
 * and the systems' public entry points) with the player racing as the character
 * that has it, next to the same moment for a character without it. Rival slots
 * get fixed characters from the real cast, so a test doesn't depend on the seed's
 * line-up.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { ABILITY } from './abilities.ts';
import { CHARACTERS } from './characters.ts';
import type { GameEvent } from './events.ts';
import { applyHit } from './hazards/hits.ts';
import { HIT } from './hazards/tuning.ts';
import { parseLevel } from './level/parse.ts';
import { length } from './num.ts';
import { gainPowerUp } from './powerups/stack.ts';
import { BUBBLE } from './powerups/tuning.ts';
import { centreOf } from './racers.ts';
import { SWIM } from './swim/physics.ts';
import { eventsIn, hold, placeAt, placeOnTile, racerOf, step, tileCentre } from './test-world.ts';
import { type CharacterId, type PowerUpKind, type Racer, TILE, type World } from './types.ts';
import { createWorld } from './world.ts';

/** The player and Tess share open water; Squib and Bo race walled off below. Urchin at (20, 3). */
const ARENA = `
  ##################################################
  #1..............................................F#
  #2..............................................F#
  #...................*...........................F#
  ##################################################
  #3..............................................F#
  ##################################################
  #4..............................................F#
  ##################################################
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

/** Rival characters for every test: none of their abilities touch these moments. */
const RIVALS: [CharacterId, CharacterId, CharacterId] = ['nib', 'gil', 'selene'];

/** A racing world on `ascii` with the player as `character` and the rivals as RIVALS. */
function raceAs(character: CharacterId, ascii = ARENA) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(parseLevel({ name: 'test', ascii }), log, { seed: 1, character });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  world.racers.slice(1).forEach((rival, index) => {
    const rivalCharacter = RIVALS[index] ?? 'nib';
    rival.character = rivalCharacter;
    rival.profile = { id: rival.id, ...CHARACTERS[rivalCharacter].profile };
  });
  return { world, log, player: racerOf(world, 'player'), tess: racerOf(world, 'tess') };
}

/** Stuns racers so their input is idle; only what the test does moves them. */
function stun(...racers: Racer[]): void {
  for (const racer of racers) racer.status.stunned = 300;
}

const speedOf = (racer: Racer) => length(racer.body.vx, racer.body.vy);

describe('Rudy: Shake it off', () => {
  it.each<CharacterId>(['rudy', 'gil'])(
    '%s: stuns and bubble traps last the right share of their time',
    (character) => {
      const { world, player } = raceAs(character);
      const share = character === 'rudy' ? ABILITY.shakeItOff.statusMul : 1;

      applyHit(world, player, 'urchin', null, tileCentre(20, 3));
      expect(player.status.stunned).toBe(Math.round(HIT.stunTicks * share));

      player.status.invulnerable = 0;
      applyHit(world, player, 'bubble', 'tess', centreOf(player));
      expect(player.status.trapped).toBe(Math.round(BUBBLE.trapTicks * share));
    },
  );

  it('gets back to swimming sooner after a stun', () => {
    const swimmingAgainAfter = (character: CharacterId) => {
      const { world, log, player } = raceAs(character);
      applyHit(world, player, 'urchin', null, tileCentre(20, 3));
      let ticks = 0;
      while (player.status.stunned > 0) {
        step(world, log, 1, hold({ x: 1, y: 0 }));
        ticks++;
      }
      return ticks;
    };

    expect(swimmingAgainAfter('rudy')).toBe(Math.round(HIT.stunTicks * ABILITY.shakeItOff.statusMul));
    expect(swimmingAgainAfter('onyx')).toBe(HIT.stunTicks);
  });
});

describe('Gil: Spring kick', () => {
  /** Velocity right after one kick from rest at (10, 2), holding `move`. */
  const kickFrom = (character: CharacterId, move: { x: number; y: number }) => {
    const { world, log, player } = raceAs(character);
    placeOnTile(player, 10, 2);
    step(world, log, 1, hold(move, { kick: true }));
    expect(eventsIn(log, 'racer.kicked')).toEqual([{ type: 'racer.kicked', id: 'player' }]);
    return { vx: player.body.vx, vy: player.body.vy };
  };

  it('kicks straight up harder than anyone else', () => {
    const gil = kickFrom('gil', { x: 0, y: -1 });
    const rudy = kickFrom('rudy', { x: 0, y: -1 });

    // Both fire from rest; Gil's extra spring shows up to the speed cap.
    expect(rudy.vy).toBeCloseTo(-SWIM.kick - SWIM.force / 60, 0);
    expect(gil.vy).toBeCloseTo(-Math.min(SWIM.maxSpeed, SWIM.kick * ABILITY.springKick.upMul + SWIM.force / 60), 0);
  });

  it('springs on a steep diagonal kick too, upward part only', () => {
    const up = { x: 1, y: -1 };
    const gil = kickFrom('gil', up);
    const rudy = kickFrom('rudy', up);

    expect(gil.vx).toBeCloseTo(rudy.vx, 6);
    expect(gil.vy).toBeLessThan(rudy.vy);
  });

  it.each([
    ['sideways', { x: 1, y: 0 }],
    ['shallow up', { x: 1, y: -0.5 }],
    ['down', { x: 0, y: 1 }],
  ])('kicks %s like everyone else', (_name, move) => {
    expect(kickFrom('gil', move)).toEqual(kickFrom('rudy', move));
  });
});

describe('Streak: Wind-up', () => {
  /** Holds right from (2, 1) for `ticks`. */
  const cruise = (character: CharacterId, ticks: number) => {
    const { world, log, player, tess } = raceAs(character);
    stun(tess);
    placeOnTile(player, 2, 1);
    step(world, log, ticks, hold({ x: 1, y: 0 }));
    return { world, log, player };
  };

  it('swims faster the longer it holds a straight line, up to its full bonus', () => {
    const early = cruise('streak', 90).player;
    const wound = cruise('streak', 300).player;
    const plain = cruise('rudy', 300).player;

    expect(early.ability.windUp).toBeGreaterThan(0);
    expect(early.ability.windUp).toBeLessThan(ABILITY.windUp.rampTicks);
    expect(wound.ability.windUp).toBeGreaterThan(ABILITY.windUp.rampTicks);
    expect(speedOf(wound) / speedOf(plain)).toBeCloseTo(1 + ABILITY.windUp.maxBonus, 2);
    expect(plain.ability.windUp).toBe(0);
  });

  it('starts over after a hard turn', () => {
    const { world, log, player } = cruise('streak', 300);

    step(world, log, 3, hold({ x: -1, y: 0 }));

    expect(player.ability.windUp).toBe(0);
  });

  it('keeps winding up through a gentle drift up or down', () => {
    const { world, log, player } = cruise('streak', 120);
    const before = player.ability.windUp;

    step(world, log, 10, hold({ x: 1, y: 0.3 }));

    expect(player.ability.windUp).toBe(before + 10);
  });

  it('starts over when hit', () => {
    const { world, log, player } = cruise('streak', 300);

    // Hit from ahead, so the knockback carries it backward rather than on along its line.
    applyHit(world, player, 'flash', 'tess', { x: centreOf(player).x + 8, y: centreOf(player).y });
    step(world, log);

    expect(player.ability.windUp).toBe(0);
  });
});

describe('Onyx: Ambush', () => {
  /** The player rear-ends Tess (or Tess the player, `onyxAhead`) at speed on row 2; both coast. */
  const rearEnd = (character: CharacterId, onyxAhead = false) => {
    const { world, log, player, tess } = raceAs(character);
    stun(player, tess);
    const [rear, front] = onyxAhead ? [tess, player] : [player, tess];
    placeOnTile(rear, 10, 2);
    placeAt(front, { x: tileCentre(10, 2).x + rear.body.w - 4, y: tileCentre(10, 2).y });
    rear.body.vx = 120;
    front.body.vx = 40;
    step(world, log);
    expect(eventsIn(log, 'racer.bumped')).toEqual([{ type: 'racer.bumped', a: 'player', b: 'tess' }]);
    return { player: player.body.vx, tess: tess.body.vx };
  };

  it('takes speed from a racer it bumps from behind and keeps it', () => {
    const onyx = rearEnd('onyx');
    const plain = rearEnd('rudy');
    const { steal } = ABILITY.ambush;

    expect(onyx.tess).toBeLessThan(plain.tess);
    expect(onyx.player).toBeGreaterThan(plain.player);
    // One tick of drag acts on both after the steal, so compare the change, not raw values.
    expect((plain.tess - onyx.tess) / (onyx.player - plain.player)).toBeCloseTo(1, 6);
    expect(plain.tess - onyx.tess).toBeGreaterThan(plain.tess * steal * 0.9);
  });

  it('takes nothing when it is the one bumped from behind', () => {
    expect(rearEnd('onyx', true)).toEqual(rearEnd('rudy', true));
  });
});

describe('Nib: Deep pockets', () => {
  const fill = (character: CharacterId) => {
    const { world, log, player } = raceAs(character);
    const kinds: PowerUpKind[] = ['jetFin', 'bubbleShield', 'puffer', 'inkSac', 'glowLantern'];
    for (const kind of kinds) gainPowerUp(world, player, kind);
    return { stack: player.stack, lost: eventsIn(log, 'powerup.lost') };
  };

  it('holds four power-ups, so only a fifth pushes out the oldest', () => {
    expect(fill('nib')).toEqual({
      stack: ['bubbleShield', 'puffer', 'inkSac', 'glowLantern'],
      lost: [{ type: 'powerup.lost', id: 'player', kind: 'jetFin', cause: 'full' }],
    });
  });

  it('leaves everyone else at three', () => {
    expect(fill('rook').stack).toEqual(['puffer', 'inkSac', 'glowLantern']);
  });
});

describe('Baron Barnacle: Bulldozer', () => {
  it('rams through coral in his way, where others stop', () => {
    const swimInto = (character: CharacterId) => {
      const { world, log, player } = raceAs(character, CORAL_AHEAD);
      step(world, log, 90, hold({ x: 1, y: 0 }));
      return { broken: eventsIn(log, 'coral.broken'), tile: Math.floor(centreOf(player).x / TILE) };
    };
    const baron = swimInto('baron');

    expect(baron.broken).toEqual([{ type: 'coral.broken', tx: 4, ty: 1, by: 'player' }]);
    expect(baron.tile).toBeGreaterThan(4);
    expect(swimInto('rudy')).toEqual({ broken: [], tile: 3 });
  });

  it('barely moves in a bump', () => {
    const pushedApart = (character: CharacterId) => {
      const { world, log, player, tess } = raceAs(character);
      stun(player, tess);
      placeOnTile(player, 10, 2);
      placeAt(tess, { x: tileCentre(10, 2).x + player.body.w - 4, y: tileCentre(10, 2).y });
      const before = { player: player.body.x, tess: tess.body.x };
      step(world, log);
      return { player: before.player - player.body.x, tess: tess.body.x - before.tess };
    };

    const baron = pushedApart('baron');
    const plain = pushedApart('rudy');

    expect(baron.player / baron.tess).toBeCloseTo(plain.player / plain.tess / ABILITY.bulldozer.massMul, 6);
  });

  it('gets going slowly but reaches the same cruising speed', () => {
    const speedAfter = (character: CharacterId, ticks: number) => {
      const { world, log, player, tess } = raceAs(character);
      stun(tess);
      placeOnTile(player, 2, 1);
      step(world, log, ticks, hold({ x: 1, y: 0 }));
      return player.body.vx;
    };

    expect(speedAfter('baron', 15)).toBeLessThan(0.8 * speedAfter('rudy', 15));
    expect(speedAfter('baron', 300)).toBeCloseTo(speedAfter('rudy', 300), 1);
  });
});

describe('Selene: Moonlight', () => {
  it('shrugs off jelly stings but not urchins', () => {
    const { world, log, player } = raceAs('selene');

    expect(applyHit(world, player, 'jelly', null, tileCentre(9, 1))).toBe(false);
    expect(player.status).toMatchObject({ stunned: 0, invulnerable: 0 });
    expect(eventsIn(log)).toEqual([]);
    expect(applyHit(world, player, 'urchin', null, tileCentre(20, 3))).toBe(true);
  });

  it('swims through a jelly that stings anyone else', () => {
    const stingsSwimmingPast = (character: CharacterId) => {
      const { world, log, player, tess } = raceAs(character, ARENA.replace('#2......', '#2....j.'));
      stun(tess);
      placeOnTile(player, 2, 2);
      step(world, log, 90, hold({ x: 1, y: 0 }));
      return eventsIn(log, 'racer.hit');
    };

    expect(stingsSwimmingPast('selene')).toEqual([]);
    expect(stingsSwimmingPast('rudy')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'jelly', by: null }]);
  });
});

describe('Rook: Frenzy', () => {
  /** Rook at (10, 1), Tess at `tessTile`, both still; then `strike` happens and Rook swims right for 30 ticks. */
  const frenzyAfter = (strike: (world: World, rook: Racer, tess: Racer) => void, tessTile: [number, number]) => {
    const { world, log, player, tess } = raceAs('rook');
    stun(tess);
    placeOnTile(player, 10, 1);
    placeOnTile(tess, ...tessTile);
    strike(world, player, tess);
    step(world, log, 30, hold({ x: 1, y: 0 }));
    return { frenzy: player.ability.frenzy, speed: player.body.vx };
  };
  const hitTess = (world: World, _rook: Racer, tess: Racer) => {
    applyHit(world, tess, 'urchin', null, centreOf(tess));
  };
  const nothing = () => {};

  it('gets a speed burst when a racer near him is hit', () => {
    const frenzied = frenzyAfter(hitTess, [12, 2]);
    const calm = frenzyAfter(nothing, [12, 2]);

    expect(frenzied.frenzy).toBe(ABILITY.frenzy.ticks - 30);
    expect(frenzied.speed).toBeGreaterThan(calm.speed * 1.1);
    expect(calm.frenzy).toBe(0);
  });

  it('gets one when a racer near him loses a power-up to a hit', () => {
    const knocked = frenzyAfter(
      (world, _rook, tess) => {
        gainPowerUp(world, tess, 'inkSac');
        applyHit(world, tess, 'urchin', null, centreOf(tess));
      },
      [12, 2],
    );

    expect(knocked.frenzy).toBe(ABILITY.frenzy.ticks - 30);
  });

  it('ignores hits too far away, and his own', () => {
    expect(frenzyAfter(hitTess, [10 + ABILITY.frenzy.rangeTiles + 2, 2]).frenzy).toBe(0);
    expect(
      frenzyAfter(
        (world, rook) => {
          applyHit(world, rook, 'urchin', null, tileCentre(20, 3));
        },
        [12, 2],
      ).frenzy,
    ).toBe(0);
  });

  it('is the only one who gets it', () => {
    const { world, log, tess } = raceAs('rudy');
    stun(tess);
    placeOnTile(tess, 11, 2);
    applyHit(world, tess, 'urchin', null, centreOf(tess));
    step(world, log, 5, hold({ x: 1, y: 0 }));

    expect(world.racers.map((racer) => racer.ability.frenzy)).toEqual([0, 0, 0, 0]);
  });
});
