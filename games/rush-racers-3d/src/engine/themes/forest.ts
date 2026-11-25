/** Colours and lighting for wooded courses. */
import type { Theme } from './types.ts';

/** The forest look: warm haze, low sun, bark-brown props and green verges. */
export const FOREST: Theme = {
  sky: { color: 0xb0c9be, zenith: 0x71adcd, fogNear: 27, fogFar: 130 },
  light: {
    exposure: 1.01,
    environment: 0.77,
    sun: { color: 0xffe3b4, intensity: 3.0, position: [-18, 24, 10] },
    hemisphere: { sky: 0xe4ecf0, ground: 0x6a5a48, intensity: 0.55 },
  },
  ground: {
    dirt: 0xb78b68,
    shoulder: 0x938457,
    grass: 0x648443,
    mud: 0x553526,
    pitRim: 0xb87f51,
    pitWall: 0x674937,
    pitFloor: 0x231d1b,
    chalk: 0xffecc5,
    darkMark: 0x694833,
  },
  props: {
    cutWood: 0xdfb782,
    bark: [0x91765b, 0x745641, 0x82654d, 0x6c5141, 0x99795b],
    wood: 0x72432c,
    trim: 0xab7951,
    pedestal: 0x614333,
    sign: { start: 0x1c4b40, finish: 0x673b2e, border: 0xc9a571, text: 0xfff1ca },
  },
  scenery: {
    conifer: [0xffffff, 0xe3eacb, 0xcfd7b4, 0xf2ecc4],
    broadleaf: [0xffffff, 0xffd998, 0xffc27e, 0xf3efc0],
    undergrowth: [0xffffff, 0xeee4b2, 0xdfe4c0],
    grass: [0xf6f0c2, 0xe9e4ad, 0xdcdca8, 0xfff2c4],
    rock: [0xffffff, 0xe9e0cf, 0xd6d0c4],
  },
  gustLeaves: [0xffd483, 0xc8803a, 0xf1ae51],
};
