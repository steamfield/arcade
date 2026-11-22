import { describe, expect, it } from 'vitest';
import type { RuntimeEvent } from '../runtime.ts';
import { attackSfx } from './attack-sfx.ts';

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
    ['a decoy popping', { type: 'decoy.popped', owner: 'squib', by: 'player' }, 'decoy.pop'],
    ['a decoy expiring', { type: 'decoy.popped', owner: 'squib', by: null }, 'decoy.pop'],
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
    expect(attackSfx(event)).toBe(key);
  });
});
