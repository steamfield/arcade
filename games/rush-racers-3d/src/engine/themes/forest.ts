/** Colours and lighting for wooded courses. */
import type { Theme } from './types.ts';

/** The forest look: warm haze, low sun, bark-brown props and green verges. */
export const FOREST: Theme = {
  sky: { color: 0xd3c9a6, zenith: 0x8fb0c2, fogNear: 30, fogFar: 118 },
  light: {
    exposure: 1.05,
    environment: 0.9,
    sun: { color: 0xffdca0, intensity: 3.1, position: [-18, 24, 10] },
    hemisphere: { sky: 0xe4ecf0, ground: 0x6a5a48, intensity: 0.55 },
  },
  ground: {
    dirt: 0xb68a59,
    shoulder: 0x93804a,
    grass: 0x55702f,
    mud: 0x553526,
    pitRim: 0x805639,
    pitWall: 0x432f25,
    pitFloor: 0x231e1c,
    chalk: 0xffecc5,
    darkMark: 0x694833,
  },
  props: {
    cutWood: 0xf1ba6e,
    bark: [0x995c32, 0x865034, 0xb97541],
    wood: 0x72432c,
    trim: 0x9c6b41,
    pedestal: 0x806047,
    sign: { start: 0x343b27, finish: 0x504129, border: 0xc9a571, text: 0xfff1ca },
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
