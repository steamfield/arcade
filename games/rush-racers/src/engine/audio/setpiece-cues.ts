/**
 * Which sound the course set pieces and the world-specific Cannonballs make, from existing effects:
 * a vent about to erupt near the local racer rumbles like a gathering storm, a vent erupting or a
 * wind zone turning near the local racer rushes like a Riptide, a wind zone about
 * to turn breathes like a wingbeat, a shot that warns the local racer it is the target pings like a
 * squid lock, and a shot ending within hearing sounds like its world (a fizzle is silent): a Boulder that hit crunches like coral,
 * a Meteor lands with a lightning crack and a Comet pops like a decoy. Of the reworked items, a Mud
 * Pie splats like a squid latching and a gravity bomb pops like a decoy as it ends. Of the long
 * courses' set pieces, a whirlpool catching the local racer pulls like an Undertow, a crumbling branch
 * within hearing thuds as it shakes and crunches like coral as it falls, a cloud cannon clanks as it
 * loads the local racer and rushes like a Riptide as it fires within hearing, and a wormhole whooshes
 * like a dodge as it carries the local racer. Positions come
 * from the event or the level, judged against the local racer.
 */
import { type RacerId, type ShotEndReason, TILE, type World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { HEARING_PX } from './attack-sfx.ts';
import type { EffectKey } from './effects.ts';

/** How each world's Cannonball shot sounds where it ends. */
const SHOT_LANDS = { boulder: 'coral', meteor: 'lightning.strike', comet: 'decoy.pop' } as const;

/**
 * How a shot sounds where it ends. A fizzle is silent (nothing was in the air), and a Boulder that
 * landed is already heard as `coral.broken` or the wall's thud, so it adds nothing; one that ran
 * out gives a soft bump.
 */
function shotEndCue(style: keyof typeof SHOT_LANDS, reason: ShotEndReason): EffectKey | null {
  if (reason === 'fizzled') return null;
  if (style !== 'boulder') return SHOT_LANDS[style];
  if (reason === 'landed') return null;
  return reason === 'hit' ? SHOT_LANDS.boulder : 'bump';
}

/** The sound `event` makes for the local racer `local` in `world`, or null when it makes none or is out of earshot. */
export function setPieceCue(event: RuntimeEvent, world: World | null, local: RacerId): EffectKey | null {
  if (!world) return null;
  const listenerX = world.racers.find((racer) => racer.id === local)?.body.x;
  if (listenerX === undefined) return null;
  const heard = (x: number) => Math.abs(x - listenerX) <= HEARING_PX;
  switch (event.type) {
    case 'vent.warned':
    case 'vent.erupted': {
      const vent = world.level.vents[event.vent];
      if (!vent || !heard((vent.col + 0.5) * TILE)) return null;
      return event.type === 'vent.warned' ? 'lightning.warn' : 'riptide';
    }
    case 'wind.warned':
    case 'wind.shifted': {
      const zone = world.level.shiftingWind[event.zone];
      if (!zone) return null;
      const inside = listenerX >= zone.cols[0] * TILE && listenerX <= (zone.cols[1] + 1) * TILE;
      if (!inside && !heard(zone.cols[0] * TILE) && !heard((zone.cols[1] + 1) * TILE)) return null;
      return event.type === 'wind.warned' ? 'flap' : 'riptide';
    }
    case 'whirlpool.caught':
      return event.racer === local ? 'undertow' : null;
    case 'crumble.shook':
    case 'crumble.fell': {
      const branch = world.level.crumbles[event.crumble];
      if (!branch || !heard((branch.col + branch.length / 2) * TILE)) return null;
      return event.type === 'crumble.shook' ? 'bump' : 'coral';
    }
    case 'cannon.loaded':
      return event.racer === local ? 'clank' : null;
    case 'cannon.fired': {
      const cannon = world.level.cannons[event.cannon];
      return cannon && heard((cannon.col + 0.5) * TILE) ? 'riptide' : null;
    }
    case 'wormhole.warped':
      return event.racer === local ? 'squid.dodge' : null;
    case 'shot.warned':
      return event.target === local ? 'squid.lock' : null;
    case 'shot.ended':
      return heard(event.x) ? shotEndCue(event.style, event.reason) : null;
    case 'twist.landed':
      return event.style === 'mudPie' && heard(event.x) ? 'squid.latch' : null;
    case 'twist.ended':
      return event.style === 'gravityBomb' && heard(event.x) ? 'decoy.pop' : null;
    default:
      return null;
  }
}
