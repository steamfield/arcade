/**
 * Thornwood, the forest world: racers run and jump. Data only; only `worlds/index.ts` imports this file.
 */
import type { WorldDef } from './types.ts';

/** Thornwood's names for the cast slots and the shared items, pickups, enemies and hazards. */
export const THORNWOOD: WorldDef = {
  id: 'thornwood',
  name: 'Thornwood',
  medium: 'run',
  cast: {
    rudy: 'Grit',
    gil: 'Skip',
    streak: 'Blaze',
    onyx: 'Shade',
    nib: 'Cheeks',
    baron: 'Duke Mossback',
    selene: 'Dusk',
    rook: 'Fang',
  },
  items: {
    jetFin: 'Rocket Boots',
    bubbleShield: 'Sap Shield',
    puffer: 'Burr Ball',
    inkSac: 'Mud Pie',
    glowLantern: 'Firefly Jar',
    cannonball: 'Boulder',
    homingSquid: 'Homing Bee',
    riptide: 'Tailwind',
    undertow: 'Snare Vine',
    mimic: 'Copycat',
  },
  pickups: { clam: 'Crate', pearl: 'Acorn' },
  enemies: { shark: 'Boar', eel: 'Snake', crab: 'Beetle' },
  hazards: { urchin: 'Thorn Bush', jelly: 'Wasp' },
};
