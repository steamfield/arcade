/**
 * Placeholder art as data: flat shapes for every key in `keys.ts`. Each racer
 * keeps one strong body colour and each HUD marker one shape, so racers read
 * apart without relying on colour alone. Phase 4 replaces these with pixel art.
 */
import { TILE } from '../../logic/types.ts';
import { Frame, Tex } from './keys.ts';
import type { Shape, Sheet } from './placeholder.ts';

const RACER_W = 12;
const RACER_H = 10;

/** A racer facing right: body, eye, and a tail fin that flips between two strokes. */
function racerSheet(key: Sheet['key'], body: number, detail: number): Sheet {
  const torso: Shape[] = [
    { rect: [2, 2, 9, 6], color: body },
    { rect: [8, 3, 2, 2], color: detail },
  ];
  return {
    key,
    width: RACER_W,
    height: RACER_H,
    frames: {
      [Frame.a]: [...torso, { rect: [0, 0, 2, 4], color: body }],
      [Frame.b]: [...torso, { rect: [0, 6, 2, 4], color: body }],
    },
  };
}

/** A current tile: a faint streak with an arrowhead, shifted between frames so it reads as flowing. */
function currentSheet(key: Sheet['key'], arrow: (shift: number) => Shape[]): Sheet {
  return { key, width: TILE, height: TILE, frames: { [Frame.a]: arrow(0), [Frame.b]: arrow(3) } };
}

const FLOW = 0x7fdbff;

const rightArrow = (s: number): Shape[] => [
  { rect: [s, 7, 9, 2], color: FLOW, alpha: 0.35 },
  { triangle: [s + 8, 4, s + 12, 8, s + 8, 12], color: FLOW, alpha: 0.6 },
];
const leftArrow = (s: number): Shape[] => [
  { rect: [7 - s, 7, 9, 2], color: FLOW, alpha: 0.35 },
  { triangle: [8 - s, 4, 4 - s, 8, 8 - s, 12], color: FLOW, alpha: 0.6 },
];
const downArrow = (s: number): Shape[] => [
  { rect: [7, s, 2, 9], color: FLOW, alpha: 0.35 },
  { triangle: [4, s + 8, 8, s + 12, 12, s + 8], color: FLOW, alpha: 0.6 },
];
const upArrow = (s: number): Shape[] => [
  { rect: [7, 7 - s, 2, 9], color: FLOW, alpha: 0.35 },
  { triangle: [4, 8 - s, 8, 4 - s, 12, 8 - s], color: FLOW, alpha: 0.6 },
];

/** A 12x12 power-up icon: a rounded backing in the item's colour with a white mark. */
function iconSheet(key: Sheet['key'], color: number, mark: Shape): Sheet {
  return {
    key,
    width: 12,
    height: 12,
    frames: { [Frame.a]: [{ circle: [6, 6, 6], color }, mark] },
  };
}

const WHITE = 0xffffff;

/** Every placeholder texture, in no particular order. */
export const PLACEHOLDER_SHEETS: readonly Sheet[] = [
  {
    key: Tex.tiles,
    width: TILE,
    height: TILE,
    frames: {
      rock: [
        { rect: [0, 0, 16, 16], color: 0x3b3355 },
        { rect: [1, 1, 6, 3], color: 0x5a4f7a },
        { rect: [9, 8, 5, 3], color: 0x5a4f7a },
      ],
      coral: [
        { rect: [0, 0, 16, 16], color: 0xd9577a },
        { rect: [2, 2, 3, 3], color: 0xff9ab0 },
        { rect: [9, 6, 3, 3], color: 0xff9ab0 },
        { rect: [4, 11, 3, 3], color: 0xff9ab0 },
      ],
    },
  },
  {
    key: Tex.coralDebris,
    width: 8,
    height: 8,
    frames: {
      [Frame.a]: [
        { rect: [1, 3, 3, 3], color: 0xd9577a },
        { rect: [5, 1, 2, 2], color: 0xff9ab0 },
      ],
    },
  },
  {
    key: Tex.kelp,
    width: TILE,
    height: TILE,
    frames: {
      [Frame.a]: [
        { rect: [3, 0, 2, 16], color: 0x2f8f4e },
        { rect: [10, 0, 2, 16], color: 0x2f8f4e },
      ],
      [Frame.b]: [
        { rect: [4, 0, 2, 16], color: 0x2f8f4e },
        { rect: [11, 0, 2, 16], color: 0x2f8f4e },
      ],
    },
  },
  currentSheet(Tex.currentRight, rightArrow),
  currentSheet(Tex.currentLeft, leftArrow),
  currentSheet(Tex.currentUp, upArrow),
  currentSheet(Tex.currentDown, downArrow),
  {
    key: Tex.finishGate,
    width: TILE,
    height: TILE,
    frames: {
      [Frame.a]: [
        { rect: [6, 0, 4, 8], color: WHITE },
        { rect: [6, 8, 4, 8], color: 0x111111 },
      ],
    },
  },
  racerSheet(Tex.player, 0xffd23f, 0x1d2b53),
  racerSheet(Tex.tess, 0x4caf50, 0x0b2e13),
  racerSheet(Tex.squib, 0xb388ff, 0x2a0b4d),
  racerSheet(Tex.bo, 0xff7043, 0x3e1308),
  { key: Tex.pearl, width: 6, height: 6, frames: { [Frame.a]: [{ circle: [3, 3, 3], color: 0xf4f1e8 }] } },
  {
    key: Tex.clam,
    width: TILE,
    height: 10,
    frames: {
      [Frame.clamClosed]: [{ rect: [1, 3, 14, 7], color: 0x8a6fb0 }],
      [Frame.clamOpen]: [
        { rect: [1, 0, 14, 3], color: 0x8a6fb0 },
        { circle: [8, 6, 2], color: 0xffd23f },
        { rect: [1, 8, 14, 2], color: 0x8a6fb0 },
      ],
    },
  },
  {
    key: Tex.urchin,
    width: 12,
    height: 12,
    frames: {
      [Frame.a]: [
        { circle: [6, 6, 4], color: 0x1d1033 },
        { rect: [5, 0, 2, 12], color: 0x1d1033 },
        { rect: [0, 5, 12, 2], color: 0x1d1033 },
      ],
    },
  },
  {
    key: Tex.jelly,
    width: 12,
    height: 14,
    frames: {
      [Frame.a]: [
        { rect: [1, 0, 10, 6], color: 0xff8fd1, alpha: 0.8 },
        { rect: [3, 6, 6, 8], color: 0xff8fd1, alpha: 0.5 },
      ],
      [Frame.b]: [
        { rect: [2, 1, 8, 6], color: 0xff8fd1, alpha: 0.8 },
        { rect: [2, 7, 8, 6], color: 0xff8fd1, alpha: 0.5 },
      ],
    },
  },
  iconSheet(Tex.jetFin, 0x2b9cd8, { triangle: [3, 3, 10, 6, 3, 9], color: WHITE }),
  iconSheet(Tex.bubbleShield, 0x5fd3e0, { circle: [6, 6, 3], color: WHITE }),
  iconSheet(Tex.puffer, 0xe0a030, { rect: [3, 5, 6, 2], color: WHITE }),
  iconSheet(Tex.inkSac, 0x3a2a5a, { circle: [6, 7, 2], color: WHITE }),
  iconSheet(Tex.glowLantern, 0xf0e060, { rect: [5, 3, 2, 6], color: WHITE }),
  {
    key: Tex.inkCloud,
    width: 24,
    height: 16,
    frames: { [Frame.a]: [{ circle: [12, 8, 8], color: 0x1a1030, alpha: 0.7 }] },
  },
  {
    key: Tex.bubble,
    width: 10,
    height: 10,
    frames: { [Frame.a]: [{ circle: [5, 5, 5], color: 0xbff4ff, alpha: 0.5 }] },
  },
  {
    key: Tex.looseGlow,
    width: 16,
    height: 16,
    frames: { [Frame.a]: [{ circle: [8, 8, 8], color: WHITE, alpha: 0.3 }] },
  },
  {
    key: Tex.hudMarker,
    width: 7,
    height: 7,
    frames: {
      [Frame.markerCircle]: [{ circle: [3.5, 3.5, 3.5], color: 0xffd23f }],
      [Frame.markerSquare]: [{ rect: [0, 0, 7, 7], color: 0x4caf50 }],
      [Frame.markerTriangle]: [{ triangle: [3.5, 0, 7, 7, 0, 7], color: 0xb388ff }],
      [Frame.markerDiamond]: [
        { triangle: [3.5, 0, 7, 3.5, 0, 3.5], color: 0xff7043 },
        { triangle: [0, 3.5, 7, 3.5, 3.5, 7], color: 0xff7043 },
      ],
    },
  },
  {
    key: Tex.kickPip,
    width: 6,
    height: 6,
    frames: {
      [Frame.pipReady]: [{ circle: [3, 3, 3], color: 0x7fdbff }],
      [Frame.pipCooling]: [{ circle: [3, 3, 3], color: 0x2a4a6a }],
    },
  },
  {
    key: Tex.backdropFar,
    width: 64,
    height: 48,
    frames: { [Frame.a]: [{ triangle: [0, 48, 22, 18, 44, 48], color: 0x0e4c7a, alpha: 0.6 }] },
  },
  {
    key: Tex.backdropNear,
    width: 96,
    height: 40,
    frames: {
      [Frame.a]: [
        { triangle: [10, 40, 30, 8, 50, 40], color: 0x0a3a60, alpha: 0.7 },
        { rect: [60, 26, 20, 14], color: 0x0a3a60, alpha: 0.7 },
      ],
    },
  },
];
