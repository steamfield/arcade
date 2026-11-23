/**
 * Farside's own texture and frame keys, as typed consts, prefixed `farside-` so they can't
 * collide with the global art, the UI kit or a theme. The cast and object skins name these; their
 * `register` functions build every one at boot, and `assertSkinTextures` checks they exist.
 */
import type { CharacterId, PowerUpKind } from '../../../logic/types.ts';

/** Racer texture per slot: 16x12, facing right, run-stride frames `Frame.a` and `Frame.b`. */
export const FarRacerTex: Readonly<Record<CharacterId, string>> = {
  rudy: 'farside-racer-grit',
  gil: 'farside-racer-skip',
  streak: 'farside-racer-blaze',
  onyx: 'farside-racer-shade',
  nib: 'farside-racer-cheeks',
  baron: 'farside-racer-duke',
  selene: 'farside-racer-dusk',
  rook: 'farside-racer-fang',
};

/** Farside texture keys other than the racers. */
export const FarTex = {
  /** 16x16 portraits, one frame per slot named by `FarCastFrame`. */
  portraits: 'farside-portraits',
  /** 7x7 progress-strip heads, one frame per slot named by `FarCastFrame`. */
  heads: 'farside-heads',
  /** 9x9 HUD item icons, one frame per item named by `FarIconFrame`. */
  icons: 'farside-icons',
  /** The bee in flight: frames `Frame.a`, `Frame.b` and `Frame.squidLatched`. */
  bee: 'farside-bee',
  tailwindStreak: 'farside-tailwind-streak',
  snareStreak: 'farside-snare-streak',
  mudCloud: 'farside-mud-cloud',
  sapBubble: 'farside-sap-bubble',
  looseGlow: 'farside-loose-glow',
  acorn: 'farside-acorn',
  /** The `?` crate: frames `Frame.clamClosed` and `Frame.clamOpen`. */
  crate: 'farside-crate',
  /** The beetle (the crab's slot): frames `a`, `b`, `stagger`. */
  beetle: 'farside-beetle',
  /** The boar (the shark's slot): frames `a`, `b`, `bite`, `stagger`. */
  boar: 'farside-boar',
  /** The snake's head (the eel's slot): frames as the eel head's. */
  snakeHead: 'farside-snake-head',
  snakeBody: 'farside-snake-body',
  /** Enemy marks: frames `markHole`, `markEyes`, `markAlert`, `markBubble`, `markStar`, `markPop`. */
  marks: 'farside-marks',
} as const;

/** In-world item sprite per item, as Reef's `Tex.<item>` sprites are. */
export const FarItemTex: Readonly<Record<PowerUpKind, string>> = {
  jetFin: 'farside-item-rocket-boots',
  bubbleShield: 'farside-item-sap-shield',
  puffer: 'farside-item-burr-ball',
  inkSac: 'farside-item-mud-pie',
  glowLantern: 'farside-item-firefly-jar',
  homingSquid: 'farside-item-homing-bee',
  riptide: 'farside-item-tailwind',
  undertow: 'farside-item-snare-vine',
  mimic: 'farside-item-copycat',
  cannonball: 'farside-item-boulder',
};

/** Frame names in `FarTex.portraits` and `FarTex.heads`: the slot id. */
export const FarCastFrame: Readonly<Record<CharacterId, string>> = {
  rudy: 'rudy',
  gil: 'gil',
  streak: 'streak',
  onyx: 'onyx',
  nib: 'nib',
  baron: 'baron',
  selene: 'selene',
  rook: 'rook',
};

/** Frame names in `FarTex.icons`: the item kind. */
export const FarIconFrame: Readonly<Record<PowerUpKind, string>> = {
  jetFin: 'jetFin',
  bubbleShield: 'bubbleShield',
  puffer: 'puffer',
  inkSac: 'inkSac',
  glowLantern: 'glowLantern',
  homingSquid: 'homingSquid',
  riptide: 'riptide',
  undertow: 'undertow',
  mimic: 'mimic',
  cannonball: 'cannonball',
};
