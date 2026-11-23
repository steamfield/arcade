import { describe, expect, it } from 'vitest';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, placeAt, placeOnTile, raceOn, racerOf } from '../test-world.ts';
import type { Bubble, Jelly, RacerId, World } from '../types.ts';
import { resolveContacts } from './contacts.ts';
import { jellyCentre } from './jellies.ts';

/** An urchin at (4, 2) and a jelly at (8, 3), clear of the starts. */
const REEF = `
  ##############
  #1..........F#
  #2..*.......F#
  #3......j...F#
  #4..........F#
  ##############
`;

function setup() {
  const { world, log } = raceOn(REEF);
  const contacts = () => resolveContacts(world, activeRacers(world));
  return { world, log, player: racerOf(world, 'player'), tess: racerOf(world, 'tess'), contacts };
}

/** A bubble owned by `owner` sitting on `target`'s centre. */
function bubbleOn(world: World, owner: RacerId, target: RacerId): Bubble {
  const bubble = { ...centreOf(racerOf(world, target)), vx: 150, vy: 0, ttl: 60, owner, seeking: false };
  world.bubbles = [bubble];
  return bubble;
}

describe('urchins', () => {
  it('hit a racer overlapping their tile', () => {
    const { log, player, contacts } = setup();
    placeOnTile(player, 4, 2);

    contacts();

    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'racer.stunned', id: 'player' },
    ]);
  });

  it('leave an inflated racer alone', () => {
    const { log, player, contacts } = setup();
    placeOnTile(player, 4, 2);
    player.status.inflated = 30;

    contacts();

    expect(eventsIn(log)).toEqual([]);
  });
});

describe('jellies', () => {
  it('sting a racer that touches them', () => {
    const { world, log, player, contacts } = setup();
    placeAt(player, jellyCentre(world.jellies[0] as Jelly));

    contacts();

    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'jelly', by: null }]);
  });

  it('do nothing while stunned', () => {
    const { world, log, player, contacts } = setup();
    const jelly = world.jellies[0] as Jelly;
    jelly.stunned = 5;
    placeAt(player, jellyCentre(jelly));

    contacts();

    expect(eventsIn(log)).toEqual([]);
  });
});

describe('a flashed jelly', () => {
  it('stings nobody for its whole 45-tick stun, then stings again', () => {
    const { world, log, player, contacts } = setup();
    const jelly = world.jellies[0] as Jelly;
    jelly.stunned = 45;
    placeAt(player, jellyCentre(jelly));

    for (let i = 0; i < 45; i++) contacts();
    expect(eventsIn(log)).toEqual([]);

    contacts();
    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'jelly', by: null }]);
  });
});

describe('bubbles', () => {
  it('trap the other racer they touch for 60 ticks and pop', () => {
    const { world, log, tess, contacts } = setup();
    bubbleOn(world, 'player', 'tess');

    contacts();

    expect(eventsIn(log)).toEqual([
      { type: 'bubble.popped', by: 'tess' },
      { type: 'racer.hit', id: 'tess', cause: 'bubble', by: 'player' },
      { type: 'racer.trapped', id: 'tess', by: 'player' },
    ]);
    expect(tess.status.trapped).toBe(60);
    expect(world.bubbles).toEqual([]);
  });

  it('never hit their owner', () => {
    const { world, log, contacts } = setup();
    const bubble = bubbleOn(world, 'player', 'player');

    contacts();

    expect(eventsIn(log)).toEqual([]);
    expect(world.bubbles).toEqual([bubble]);
  });

  it('pass through an invulnerable racer', () => {
    const { world, log, tess, contacts } = setup();
    const bubble = bubbleOn(world, 'player', 'tess');
    tess.status.invulnerable = 20;

    contacts();

    expect(eventsIn(log)).toEqual([]);
    expect(world.bubbles).toEqual([bubble]);
  });
});

describe('contact order', () => {
  it('lets an urchin land first, so a bubble on the same racer flies on', () => {
    const { world, log, player, contacts } = setup();
    placeOnTile(player, 4, 2);
    const bubble = bubbleOn(world, 'tess', 'player');

    contacts();

    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'racer.stunned', id: 'player' },
    ]);
    expect(player.status.trapped).toBe(0);
    expect(world.bubbles).toEqual([bubble]);
  });
});

describe('inflated puffers', () => {
  it('hit the other racers they touch', () => {
    const { log, player, tess, contacts } = setup();
    placeOnTile(player, 6, 1);
    placeAt(tess, { x: centreOf(player).x + 15, y: centreOf(player).y });
    player.status.inflated = 30;

    contacts();

    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'tess', cause: 'puffer', by: 'player' },
      { type: 'racer.stunned', id: 'tess' },
    ]);
  });
});
