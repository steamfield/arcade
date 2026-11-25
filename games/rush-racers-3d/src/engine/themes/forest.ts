/** Colours and lighting for wooded courses. */
import type { Theme } from './types.ts';

/** The theme used by Thornwood Trail. */
export const FOREST: Theme = {
  sky: { color: 0xcec6a8, fogNear: 28, fogFar: 115 },
  light: {
    sun: { color: 0xffe1ae, intensity: 2.05, position: [-15, 25, 8] },
    hemisphere: { sky: 0xfff0cf, ground: 0x73605a, intensity: 1.55 },
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
  },
  gustLeaves: [0xffd483, 0xc8803a, 0xf1ae51],
};
