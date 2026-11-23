/**
 * Farside's own texture and frame keys, as typed consts, prefixed `farside-` so they can't
 * collide with the global art, the UI kit or a theme. The cast and object skins name these; their
 * `register` functions build every one at boot, and `assertSkinTextures` checks they exist.
 */
import type { CharacterId, PowerUpKind } from '../../../logic/types.ts';

/** Racer texture per slot: 16x12, facing right, run-stride frames `Frame.a` and `Frame.b`. */
export const FarRacerTex: Readonly<Record<CharacterId, string>> = {
  rudy: 'farside-racer-bolt',
  gil: 'farside-racer-zib',
  streak: 'farside-racer-flare',
  onyx: 'farside-racer-umbra',
  nib: 'farside-racer-widget',
  baron: 'farside-racer-crater',
  selene: 'farside-racer-nova',
  rook: 'farside-racer-krag',
};

/** Farside texture keys other than the racers. */
export const FarTex = {
  /** 16x16 portraits, one frame per slot named by `FarCastFrame`. */
  portraits: 'farside-portraits',
  /** 7x7 progress-strip heads, one frame per slot named by `FarCastFrame`. */
  heads: 'farside-heads',
  /** 9x9 HUD item icons, one frame per item named by `FarIconFrame`. */
  icons: 'farside-icons',
  /** The probe in flight: frames `Frame.a`, `Frame.b` and `Frame.squidLatched`. */
  probe: 'farside-probe',
  ionStreak: 'farside-ion-streak',
  tractorStreak: 'farside-tractor-streak',
  gasCloud: 'farside-gas-cloud',
  fieldBubble: 'farside-field-bubble',
  looseGlow: 'farside-loose-glow',
  stardust: 'farside-stardust',
  /** The `?` pod: frames `Frame.clamClosed` and `Frame.clamOpen`. */
  pod: 'farside-pod',
  /** The mite (the crab's slot): frames `a`, `b`, `stagger`. */
  mite: 'farside-probetle',
  /** The ray (the shark's slot): frames `a`, `b`, `bite`, `stagger`. */
  ray: 'farside-ray',
  /** The worm's head (the eel's slot): frames as the eel head's. */
  wormHead: 'farside-worm-head',
  wormBody: 'farside-worm-body',
  /** Enemy marks: frames `markHole`, `markEyes`, `markAlert`, `markBubble`, `markStar`, `markPop`. */
  marks: 'farside-marks',
} as const;

/** In-world item sprite per item, as Reef's `Tex.<item>` sprites are. */
export const FarItemTex: Readonly<Record<PowerUpKind, string>> = {
  jetFin: 'farside-item-ion-thrusters',
  bubbleShield: 'farside-item-force-field',
  puffer: 'farside-item-shock-bubble',
  inkSac: 'farside-item-gas-bomb',
  glowLantern: 'farside-item-star-flare',
  homingSquid: 'farside-item-homing-probe',
  riptide: 'farside-item-ion-stream',
  undertow: 'farside-item-tractor-beam',
  mimic: 'farside-item-hologram',
  cannonball: 'farside-item-comet',
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
