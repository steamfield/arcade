/**
 * Reef's own texture and frame keys, as typed consts. Unlike the other worlds', Reef's keys carry no
 * world prefix (`racer-rudy`, `pearl`, `ui-portraits`), and `themes/ocean.test.ts` pins them. The
 * cast and object skins name these; their `register` functions build every one at boot, and
 * `assertSkinTextures` checks they exist. Reef's HUD item icons are frames of the UI kit's shared
 * `ui-icons` texture, named by `IconFrame` in `art/ui/keys.ts`.
 */
import type { CharacterId, PowerUpKind } from '../../../logic/types.ts';
import { worldArtOwner } from '../../art/index.ts';
import { bySlot } from '../../art/keys.ts';

/** The art owner name Reef's cast and object textures are drawn under, so `drawSheets` treats them as one world's. */
export const REEF_ART_OWNER = worldArtOwner('reef');

/** Racer texture per slot: 16x12, facing right, swim-stroke frames `Frame.a` and `Frame.b`. */
export const ReefRacerTex: Readonly<Record<CharacterId, string>> = {
  rudy: 'racer-rudy',
  gil: 'racer-gil',
  streak: 'racer-streak',
  onyx: 'racer-onyx',
  nib: 'racer-nib',
  baron: 'racer-baron',
  selene: 'racer-selene',
  rook: 'racer-rook',
};

/** Reef texture keys other than the racers and the item sprites. */
export const ReefTex = {
  /** 16x16 portraits, one frame per slot named by `ReefCastFrame`. */
  portraits: 'ui-portraits',
  /** 7x7 progress-strip heads, one frame per slot named by `ReefCastFrame`. */
  heads: 'ui-heads',
  pearl: 'pearl',
  /** The clam: frames `Frame.clamClosed` and `Frame.clamOpen`. */
  clam: 'clam',
  /** The Homing Squid in the water (16x12, swim and latched frames), not its held icon. */
  squid: 'squid',
  /** One 16x16 tile of a Riptide lane, streaks pointing right; the view rotates it to the lane. */
  riptideStreak: 'riptide-streak',
  /** Speed lines drawn ahead of a racer Undertow is pulling back. */
  undertowStreak: 'undertow-streak',
  inkCloud: 'ink-cloud',
  bubble: 'bubble',
  looseGlow: 'loose-glow',
  /** The shark (24x14, facing right): swim strokes, a jaws-open bite pose and a dazed stagger pose. */
  shark: 'enemy-shark',
  /** The moray eel's head (16x10, pointing right): mouth shut and open. */
  eelHead: 'enemy-eel-head',
  /** One 8x10 tile of eel body, pointing right; the view repeats it from the wall to the head. */
  eelBody: 'enemy-eel-body',
  /** The crab (16x12, symmetric): two walking strokes and a dazed stagger pose. */
  crab: 'enemy-crab',
  /** Enemy marks on 12x12 frames: the wall hole and its eyes, the `!` tell, a bubble, the dizzy star, the pop ring. */
  marks: 'enemy-mark',
} as const;

/** In-world item sprite per item (12x12, frame `Frame.a`): a loose pickup or a clam's burst. */
export const ReefItemTex: Readonly<Record<PowerUpKind, string>> = {
  jetFin: 'powerup-jet-fin',
  bubbleShield: 'powerup-bubble-shield',
  puffer: 'powerup-puffer',
  inkSac: 'powerup-ink-sac',
  glowLantern: 'powerup-glow-lantern',
  homingSquid: 'powerup-homing-squid',
  riptide: 'powerup-riptide',
  undertow: 'powerup-undertow',
  mimic: 'powerup-mimic',
  cannonball: 'powerup-cannonball',
};

/** Frame names in `ReefTex.portraits` and `ReefTex.heads`: the slot id. */
export const ReefCastFrame: Readonly<Record<CharacterId, string>> = bySlot();
