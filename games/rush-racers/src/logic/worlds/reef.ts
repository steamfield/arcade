/**
 * Reef, the underwater world: racers swim. Data only; only `worlds/index.ts` imports this file.
 */
import type { WorldDef } from './types.ts';

/** Reef's names, the ones the game has always used. */
export const REEF: WorldDef = {
  id: 'reef',
  name: 'Reef',
  medium: 'swim',
  cast: {
    rudy: 'Rudy',
    gil: 'Gil',
    streak: 'Streak',
    onyx: 'Onyx',
    nib: 'Nib',
    baron: 'Baron Barnacle',
    selene: 'Selene',
    rook: 'Rook',
  },
  items: {
    jetFin: 'Jet Fins',
    bubbleShield: 'Bubble Shield',
    puffer: 'Puffer',
    inkSac: 'Ink Sac',
    glowLantern: 'Glow Lantern',
    cannonball: 'Cannonball',
    homingSquid: 'Homing Squid',
    riptide: 'Riptide',
    undertow: 'Undertow',
    mimic: 'Mimic',
  },
  pickups: { clam: 'Clam', pearl: 'Pearl' },
  enemies: { shark: 'Shark', eel: 'Eel', crab: 'Crab' },
  hazards: { urchin: 'Urchin', jelly: 'Jellyfish' },
};
