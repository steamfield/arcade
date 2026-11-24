/**
 * Cloudreach, the sky world: racers fly. Data only; only `worlds/index.ts` imports this file.
 */
import type { WorldDef } from './types.ts';

/** Cloudreach's names for the cast slots and the shared items, pickups, enemies and hazards. */
export const CLOUDREACH: WorldDef = {
  id: 'cloudreach',
  name: 'Cloudreach',
  medium: 'flight',
  cast: {
    rudy: 'Bumper',
    gil: 'Zip',
    streak: 'Dart',
    onyx: 'Nox',
    nib: 'Pip',
    baron: 'Admiral Pouch',
    selene: 'Luna',
    rook: 'Talon',
  },
  items: {
    jetFin: 'Jet Pack',
    bubbleShield: 'Cloud Shield',
    puffer: 'Puffball',
    inkSac: 'Smoke Bomb',
    glowLantern: 'Star Lamp',
    cannonball: 'Meteor',
    homingSquid: 'Homing Gull',
    riptide: 'Jet Stream',
    undertow: 'Headwind',
    mimic: 'Mirage',
  },
  pickups: { clam: 'Balloon', pearl: 'Feather' },
  enemies: { shark: 'Storm Crow', eel: 'Sky Eel', crab: 'Cloud Crab' },
  hazards: { urchin: 'Spark Cloud', jelly: 'Static Wisp' },
  cannonball: 'meteor',
};
