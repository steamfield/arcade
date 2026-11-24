/**
 * Cloudreach's own texture and frame keys, as typed consts, prefixed `cloudreach-` so they can't
 * collide with the global art, the UI kit, a theme, Reef's or Thornwood's. The cast and object skins
 * name these; their `register` functions build every one at boot, and `assertSkinTextures` checks
 * they exist.
 */
import type { CharacterId, PowerUpKind } from '../../../logic/types.ts';
import { worldArtOwner } from '../../art/index.ts';
import { byItem, bySlot } from '../../art/keys.ts';

/** The art owner name Cloudreach's cast and object textures are drawn under, so `drawSheets` treats them as one world's. */
export const CLOUDREACH_ART_OWNER = worldArtOwner('cloudreach');

/** Racer texture per slot: 16x12, facing right, wing-beat frames `Frame.a` (wings up) and `Frame.b` (wings down). */
export const SkyRacerTex: Readonly<Record<CharacterId, string>> = {
  rudy: 'cloudreach-racer-bumper',
  gil: 'cloudreach-racer-zip',
  streak: 'cloudreach-racer-dart',
  onyx: 'cloudreach-racer-nox',
  nib: 'cloudreach-racer-pip',
  baron: 'cloudreach-racer-pouch',
  selene: 'cloudreach-racer-luna',
  rook: 'cloudreach-racer-talon',
};

/** Cloudreach texture keys other than the racers and item sprites. */
export const SkyTex = {
  /** 16x16 portraits, one frame per slot named by `SkyPortraitFrame`. */
  portraits: 'cloudreach-portraits',
  /** 7x7 progress-strip heads, one frame per slot named by `SkyPortraitFrame`. */
  heads: 'cloudreach-heads',
  /** 9x9 HUD item icons, one frame per item named by `SkyIconFrame`. */
  icons: 'cloudreach-icons',
  /** The Homing Gull in flight: frames `Frame.a`, `Frame.b` and `Frame.squidLatched`. */
  gull: 'cloudreach-gull',
  jetStreamStreak: 'cloudreach-jet-stream-streak',
  headwindStreak: 'cloudreach-headwind-streak',
  smokeCloud: 'cloudreach-smoke-cloud',
  /** The Cloud Shield trap and shield bubble (Reef's Bubble Shield bubble). */
  cloudBubble: 'cloudreach-cloud-bubble',
  looseGlow: 'cloudreach-loose-glow',
  feather: 'cloudreach-feather',
  /** The `?` balloon: frames `Frame.clamOpen` (ready, full with a `?` ribbon) and `Frame.clamClosed` (used, a popped string). */
  balloon: 'cloudreach-balloon',
  /** The cloud crab (the crab's slot): frames `a`, `b`, `stagger`. */
  cloudCrab: 'cloudreach-cloud-crab',
  /** The storm crow (the shark's slot): frames `a`, `b`, `bite`, `stagger`. */
  stormCrow: 'cloudreach-storm-crow',
  /** The sky eel's head (the eel's slot): frames as the eel head's. */
  skyEelHead: 'cloudreach-sky-eel-head',
  skyEelBody: 'cloudreach-sky-eel-body',
  /** Enemy marks: frames `markHole`, `markEyes`, `markAlert`, `markBubble`, `markStar`, `markPop`. */
  marks: 'cloudreach-marks',
} as const;

/** In-world item sprite per item, as Reef's `Tex.<item>` sprites are. */
export const SkyItemTex: Readonly<Record<PowerUpKind, string>> = {
  jetFin: 'cloudreach-item-jet-pack',
  bubbleShield: 'cloudreach-item-cloud-shield',
  puffer: 'cloudreach-item-puffball',
  inkSac: 'cloudreach-item-smoke-bomb',
  glowLantern: 'cloudreach-item-star-lamp',
  homingSquid: 'cloudreach-item-homing-gull',
  riptide: 'cloudreach-item-jet-stream',
  undertow: 'cloudreach-item-headwind',
  mimic: 'cloudreach-item-mirage',
  cannonball: 'cloudreach-item-meteor',
};

/** Frame names in `SkyTex.portraits` and `SkyTex.heads`: the slot id. */
export const SkyPortraitFrame: Readonly<Record<CharacterId, string>> = bySlot();

/** Frame names in `SkyTex.icons`: the item kind. */
export const SkyIconFrame: Readonly<Record<PowerUpKind, string>> = byItem();
