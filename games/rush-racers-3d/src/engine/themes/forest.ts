/** Colours and lighting for wooded courses. */
import type { Theme } from './types.ts';

/** The forest look: warm haze, low sun, bark-brown props and green verges. */
export const FOREST: Theme = {
  sky: { color: 0xd3c9a6, zenith: 0x8fb0c2, fogNear: 30, fogFar: 118 },
  light: {
    exposure: 1.05,
    sun: { color: 0xffdca0, intensity: 3.1, position: [-18, 24, 10] },
    hemisphere: { sky: 0xe4ecf0, ground: 0x6a5a48, intensity: 1.35 },
  },
  ground: {
    dirt: 0xb68a59,
    shoulder: 0x9f8751,
    grass: 0x6b7945,
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
    bark: [0x65472e, 0x876445, 0x543a2a],
    needles: [0x3d5636, 0x546739, 0x627d4c, 0x435c39, 0x747a3d],
    leaves: [0x889546, 0x9d9343, 0xa08640, 0x809151, 0x6c844b],
    rock: 0x797464,
    shrub: 0x9d994d,
    grass: [0x6f8240, 0x7e8a45, 0x5f7339, 0x8f9049],
  },
  gustLeaves: [0xffd483, 0xc8803a, 0xf1ae51],
};
