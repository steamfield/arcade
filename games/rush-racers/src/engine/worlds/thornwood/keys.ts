/**
 * Thornwood's own texture and frame keys, as typed consts, prefixed `thornwood-` so they can't
 * collide with the global art, the UI kit or a theme. The cast and object skins name these; their
 * `register` functions build every one at boot, and `assertSkinTextures` checks they exist.
 */
import type { CharacterId, PowerUpKind } from '../../../logic/types.ts';

/** The art owner name Thornwood's cast and object textures are drawn under, so `drawSheets` treats them as one world's. */
export const THORNWOOD_ART_OWNER = 'thornwood';

/** Racer texture per slot: 16x12, facing right, run-stride frames `Frame.a` and `Frame.b`. */
export const ThornRacerTex: Readonly<Record<CharacterId, string>> = {
  rudy: 'thornwood-racer-grit',
  gil: 'thornwood-racer-skip',
  streak: 'thornwood-racer-blaze',
  onyx: 'thornwood-racer-shade',
  nib: 'thornwood-racer-cheeks',
  baron: 'thornwood-racer-duke',
  selene: 'thornwood-racer-dusk',
  rook: 'thornwood-racer-fang',
};

/** Thornwood texture keys other than the racers. */
export const ThornTex = {
  /** 16x16 portraits, one frame per slot named by `ThornCastFrame`. */
  portraits: 'thornwood-portraits',
  /** 7x7 progress-strip heads, one frame per slot named by `ThornCastFrame`. */
  heads: 'thornwood-heads',
  /** 9x9 HUD item icons, one frame per item named by `ThornIconFrame`. */
  icons: 'thornwood-icons',
  /** The bee in flight: frames `Frame.a`, `Frame.b` and `Frame.squidLatched`. */
  bee: 'thornwood-bee',
  tailwindStreak: 'thornwood-tailwind-streak',
  snareStreak: 'thornwood-snare-streak',
  mudCloud: 'thornwood-mud-cloud',
  sapBubble: 'thornwood-sap-bubble',
  looseGlow: 'thornwood-loose-glow',
  acorn: 'thornwood-acorn',
  /** The `?` crate: frames `Frame.clamClosed` and `Frame.clamOpen`. */
  crate: 'thornwood-crate',
  /** The beetle (the crab's slot): frames `a`, `b`, `stagger`. */
  beetle: 'thornwood-beetle',
  /** The boar (the shark's slot): frames `a`, `b`, `bite`, `stagger`. */
  boar: 'thornwood-boar',
  /** The snake's head (the eel's slot): frames as the eel head's. */
  snakeHead: 'thornwood-snake-head',
  snakeBody: 'thornwood-snake-body',
  /** Enemy marks: frames `markHole`, `markEyes`, `markAlert`, `markBubble`, `markStar`, `markPop`. */
  marks: 'thornwood-marks',
} as const;

/** In-world item sprite per item, as Reef's `Tex.<item>` sprites are. */
export const ThornItemTex: Readonly<Record<PowerUpKind, string>> = {
  jetFin: 'thornwood-item-rocket-boots',
  bubbleShield: 'thornwood-item-sap-shield',
  puffer: 'thornwood-item-burr-ball',
  inkSac: 'thornwood-item-mud-pie',
  glowLantern: 'thornwood-item-firefly-jar',
  homingSquid: 'thornwood-item-homing-bee',
  riptide: 'thornwood-item-tailwind',
  undertow: 'thornwood-item-snare-vine',
  mimic: 'thornwood-item-copycat',
  cannonball: 'thornwood-item-boulder',
};

/** Frame names in `ThornTex.portraits` and `ThornTex.heads`: the slot id. */
export const ThornCastFrame: Readonly<Record<CharacterId, string>> = {
  rudy: 'rudy',
  gil: 'gil',
  streak: 'streak',
  onyx: 'onyx',
  nib: 'nib',
  baron: 'baron',
  selene: 'selene',
  rook: 'rook',
};

/** Frame names in `ThornTex.icons`: the item kind. */
export const ThornIconFrame: Readonly<Record<PowerUpKind, string>> = {
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
