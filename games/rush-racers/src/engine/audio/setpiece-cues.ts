/**
 * Which sound the course set pieces and the world-specific Cannonballs make, from existing effects:
 * a vent erupting or a wind zone turning near the local racer rushes like a Riptide, a wind zone about
 * to turn breathes like a wingbeat, a shot that warns the local racer it is the target pings like a
 * squid lock, and a shot ending within hearing sounds like its world: a Boulder crunches like coral,
 * a Meteor lands with a lightning crack and a Comet pops like a decoy. Positions come from the event
 * or the level, judged against the local racer.
 */
import { type RacerId, TILE, type World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { HEARING_PX } from './attack-sfx.ts';
import type { EffectKey } from './effects.ts';

/** How each world's Cannonball shot sounds where it ends. */
const SHOT_LANDS = { boulder: 'coral', meteor: 'lightning.strike', comet: 'decoy.pop' } as const;

/** The sound `event` makes for the local racer `local` in `world`, or null when it makes none or is out of earshot. */
export function setPieceCue(event: RuntimeEvent, world: World | null, local: RacerId): EffectKey | null {
  if (!world) return null;
  const listenerX = world.racers.find((racer) => racer.id === local)?.body.x;
  if (listenerX === undefined) return null;
  const heard = (x: number) => Math.abs(x - listenerX) <= HEARING_PX;
  switch (event.type) {
    case 'vent.erupted': {
      const vent = world.level.vents[event.vent];
      return vent && heard((vent.col + 0.5) * TILE) ? 'riptide' : null;
    }
    case 'wind.warned':
    case 'wind.shifted': {
      const zone = world.level.shiftingWind[event.zone];
      if (!zone) return null;
      const inside = listenerX >= zone.cols[0] * TILE && listenerX <= (zone.cols[1] + 1) * TILE;
      if (!inside && !heard(zone.cols[0] * TILE) && !heard((zone.cols[1] + 1) * TILE)) return null;
      return event.type === 'wind.warned' ? 'flap' : 'riptide';
    }
    case 'shot.warned':
      return event.target === local ? 'squid.lock' : null;
    case 'shot.ended':
      return heard(event.x) ? SHOT_LANDS[event.style] : null;
    default:
      return null;
  }
}
