/**
 * Which sound the attack power-ups' events make. Squids, lanes and decoys are heard wherever they
 * happen, so the field's fights are audible; the things that happen to a racer (a lock-on, a
 * latch, a dodge, a shake-off, an Undertow pull) are heard only when that racer is the player, so
 * the cue always means "this is about you". Pure: the adapter plays whatever key this returns.
 */
import type { RuntimeEvent } from '../runtime.ts';
import type { SfxKey } from './sfx.ts';

/** The sound for `event`, or null when it makes none. */
export function attackSfx(event: RuntimeEvent): SfxKey | null {
  switch (event.type) {
    case 'squid.spawned':
      return 'squid.fire';
    case 'squid.locked':
      return event.target === 'player' ? 'squid.lock' : null;
    case 'squid.latched':
      return event.id === 'player' ? 'squid.latch' : null;
    case 'squid.dodged':
      return event.id === 'player' ? 'squid.dodge' : null;
    case 'racer.shaken':
      return event.id === 'player' ? 'squid.shake' : null;
    case 'squid.lost':
      return event.owner === 'player' ? 'squid.lost' : null;
    case 'riptide.spawned':
      return 'riptide';
    case 'undertow.fired':
      return event.id === 'player' || event.pulled.includes('player') ? 'undertow' : null;
    case 'decoy.spawned':
      return 'decoy.spawn';
    case 'decoy.popped':
      return 'decoy.pop';
    case 'burst.fired':
      return event.id === 'player' ? comboSfx(event.combo) : null;
    default:
      return null;
  }
}

/** The accent for the combos that came with the attack power-ups; the older combos have no adapter cue yet. */
function comboSfx(combo: string | null): SfxKey | null {
  if (combo === 'surfline') return 'combo.surfline';
  if (combo === 'inkSquid') return 'combo.inkSquid';
  if (combo === 'bubbleDecoy') return 'combo.bubbleDecoy';
  return null;
}
