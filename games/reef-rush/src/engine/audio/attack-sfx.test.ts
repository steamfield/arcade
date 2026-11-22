import { describe, expect, it } from 'vitest';
import { placeAt, raceOn, racerOf } from '../../logic/test-world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { createAttackSfx, HEARING_PX, LOCK_CUE_GAP_TICKS, withinHearing } from './attack-sfx.ts';

describe('the sound of an attack power-up event', () => {
  it.each<[string, RuntimeEvent, string | null]>([
    ['a squid fired by anyone', { type: 'squid.spawned', owner: 'squib', target: 'tess' }, 'squid.fire'],
    ['a lock-on to the player', { type: 'squid.locked', owner: 'tess', target: 'player' }, 'squid.lock'],
    ['a lock-on to a rival', { type: 'squid.locked', owner: 'player', target: 'tess' }, null],
    ['a lock-on to a decoy', { type: 'squid.locked', owner: 'tess', target: 'decoy' }, null],
    ['a latch on the player', { type: 'squid.latched', id: 'player', by: 'tess' }, 'squid.latch'],
    ['a latch on a rival', { type: 'squid.latched', id: 'tess', by: 'player' }, null],
    ['the player dodging', { type: 'squid.dodged', id: 'player' }, 'squid.dodge'],
    ['a rival dodging', { type: 'squid.dodged', id: 'bo' }, null],
    ['the player shaking a squid off', { type: 'racer.shaken', id: 'player' }, 'squid.shake'],
    ['a rival shaking a squid off', { type: 'racer.shaken', id: 'tess' }, null],
    ['the player’s squid fizzling', { type: 'squid.lost', owner: 'player' }, 'squid.lost'],
    ['a rival’s squid fizzling', { type: 'squid.lost', owner: 'tess' }, null],
    ['a riptide laid by anyone', { type: 'riptide.spawned', owner: 'bo' }, 'riptide'],
    ['an Undertow that pulls the player', { type: 'undertow.fired', id: 'tess', pulled: ['player'] }, 'undertow'],
    ['an Undertow the player fires', { type: 'undertow.fired', id: 'player', pulled: [] }, 'undertow'],
    ['an Undertow between rivals', { type: 'undertow.fired', id: 'tess', pulled: ['squib'] }, null],
    ['a decoy appearing', { type: 'decoy.spawned', owner: 'squib' }, 'decoy.spawn'],
    ['a decoy popping', { type: 'decoy.popped', owner: 'squib', by: 'player', trapped: null }, 'decoy.pop'],
    ['a decoy expiring', { type: 'decoy.popped', owner: 'squib', by: null, trapped: null }, 'decoy.pop'],
    [
      'the player’s Surfline',
      { type: 'burst.fired', id: 'player', kinds: ['jetFin', 'riptide'], combo: 'surfline' },
      'combo.surfline',
    ],
    [
      'the player’s Ink Squid',
      { type: 'burst.fired', id: 'player', kinds: ['homingSquid', 'inkSac'], combo: 'inkSquid' },
      'combo.inkSquid',
    ],
    [
      'the player’s Bubble Decoy',
      { type: 'burst.fired', id: 'player', kinds: ['mimic', 'bubbleShield'], combo: 'bubbleDecoy' },
      'combo.bubbleDecoy',
    ],
    ['a rival’s Surfline', { type: 'burst.fired', id: 'tess', kinds: ['jetFin', 'riptide'], combo: 'surfline' }, null],
    ['a burst with no combo', { type: 'burst.fired', id: 'player', kinds: ['homingSquid'], combo: null }, null],
    ['an unrelated event', { type: 'racer.kicked', id: 'player' }, null],
  ])('%s', (_case, event, key) => {
    expect(createAttackSfx().forEvent(event, 500)).toBe(key);
  });
});

describe('the lock-on cue', () => {
  const lock: RuntimeEvent = { type: 'squid.locked', owner: 'tess', target: 'player' };

  it('sounds once, then stays quiet for 90 ticks even as the squid retargets', () => {
    const attacks = createAttackSfx();
    expect(attacks.forEvent(lock, 100)).toBe('squid.lock');
    expect(attacks.forEvent(lock, 100 + LOCK_CUE_GAP_TICKS - 1)).toBeNull();
    expect(attacks.forEvent(lock, 100 + LOCK_CUE_GAP_TICKS)).toBe('squid.lock');
  });
});

describe('other racers\u2019 attacks', () => {
  const far = () => false;
  it.each<[string, RuntimeEvent, string | null]>([
    ['a squid fired out of earshot', { type: 'squid.spawned', owner: 'tess', target: null }, null],
    ['a riptide laid out of earshot', { type: 'riptide.spawned', owner: 'tess' }, null],
    ['a decoy left out of earshot', { type: 'decoy.spawned', owner: 'tess' }, null],
    ['a decoy popping out of earshot', { type: 'decoy.popped', owner: 'tess', by: null, trapped: null }, null],
    [
      'an Undertow that pulls the player, wherever the user is',
      { type: 'undertow.fired', id: 'tess', pulled: ['player'] },
      'undertow',
    ],
  ])('%s', (_case, event, key) => {
    expect(createAttackSfx(far).forEvent(event, 500)).toBe(key);
  });

  it('hears racers within a screen of the player and not beyond it', () => {
    const { world } = raceOn(`
      #######################################
      #1...................................F#
      #2...................................F#
      #3...................................F#
      #4...................................F#
      #######################################
    `);
    const player = racerOf(world, 'player');
    const tess = racerOf(world, 'tess');
    placeAt(player, { x: 40, y: 40 });
    placeAt(tess, { x: 40 + HEARING_PX - 10, y: 40 });
    expect(withinHearing(world, 'tess')).toBe(true);
    placeAt(tess, { x: 40 + HEARING_PX + 40, y: 40 });
    expect(withinHearing(world, 'tess')).toBe(false);
  });
});
