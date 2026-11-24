/**
 * Farside, the space world: racers drift on thrusters, and its Cannonball is a Comet the gravity wells bend. Data only; only `worlds/index.ts` imports this file.
 */
import type { WorldDef } from './types.ts';

/** Farside's names for the cast slots and the shared items, pickups, enemies and hazards. */
export const FARSIDE: WorldDef = {
  id: 'farside',
  name: 'Farside',
  medium: 'drift',
  cast: {
    rudy: 'Bolt',
    gil: 'Zib',
    streak: 'Flare',
    onyx: 'Umbra',
    nib: 'Widget',
    baron: 'Admiral Crater',
    selene: 'Nova',
    rook: 'Krag',
  },
  items: {
    jetFin: 'Ion Thrusters',
    bubbleShield: 'Force Field',
    puffer: 'Shock Bubble',
    inkSac: 'Gas Bomb',
    glowLantern: 'Star Flare',
    cannonball: 'Comet',
    homingSquid: 'Homing Probe',
    riptide: 'Ion Stream',
    undertow: 'Tractor Beam',
    mimic: 'Hologram',
  },
  pickups: { clam: 'Supply Pod', pearl: 'Stardust' },
  enemies: { shark: 'Rocket Ray', eel: 'Moon Worm', crab: 'Moon Mite' },
  hazards: { urchin: 'Space Mine', jelly: 'Plasma Orb' },
  // The Comet is a shot the wells bend (`powerups/cannonball/comet.ts`), not the swim dash.
  cannonball: 'comet',
};
