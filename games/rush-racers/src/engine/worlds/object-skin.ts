/**
 * How a world draws and words the things every world shares: item icons and in-world item art, attack
 * art, pickups, enemies, hazards and their dark-zone glints, and the item and enemy words on the HUD
 * and How to Play. Mechanics and ids are shared; only the look and the words change per world. The
 * theme draws a course's terrain and backdrop.
 */
import type { EnemyKind, PowerUpKind } from '../../logic/types.ts';
import type { ArtRef } from './art-ref.ts';

/** How a hazard looks: a texture with a still frame, or a looping animation. */
export interface HazardSkin {
  texture: string;
  /** The frame shown when `anim` is null. */
  frame: string;
  /** A looping animation the sprite plays; null for a still image. */
  anim: string | null;
}

/** In-world art for the attack items and their effects. */
export interface AttackArt {
  /** The Homing Squid (or a world's homing creature) in flight, frames `a`, `b` and `latched`. */
  homer: string;
  /** One 16x16 tile of a Riptide lane, streaks pointing right. */
  riptideStreak: string;
  /** Speed lines ahead of a racer Undertow pulls back. */
  undertowStreak: string;
  /** An Ink Sac cloud. */
  inkCloud: string;
  /** A Bubble Shield trap and shield bubble. */
  bubble: string;
  /** The glow under a loose power-up. */
  looseGlow: string;
}

/** Enemy art. Frame names follow `Frame` in `art/keys.ts`. */
export interface EnemyArt {
  /** Per kind, the main body texture (the eel's head). */
  bodies: Readonly<Record<EnemyKind, string>>;
  /** The eel's repeated body segment (or a world's equivalent). */
  eelBody: string;
  /** Marks: hole, eyes, `!` tell, bubble, dizzy star, pop ring. */
  marks: string;
}

/** A hazard's glint in a dark zone: a 5x5 plus the dark view draws under `key`, its tint and its alpha. */
export interface Glint {
  key: string;
  colour: number;
  alpha: number;
}

/** How strongly each hazard's glint shows in a dark zone; every world uses these unless it has a reason not to. */
export const GLINT_ALPHA: Readonly<Record<'urchin' | 'jelly', number>> = { urchin: 0.55, jelly: 0.6 };

/** Words the HUD and How to Play show about shared things, in capitals. */
export interface ObjectText {
  /** The HUD line under a racer slowed by an Ink Sac cloud, e.g. SLOWED BY INK. */
  slowedBy: string;
  /** The word on the arrows beside a trapped racer, e.g. BUBBLE. */
  trapped: string;
  /** How to Play captions for the four attack items. */
  attackCaptions: Readonly<Record<'homingSquid' | 'riptide' | 'undertow' | 'mimic', string>>;
  /** How to Play captions per enemy, e.g. CRAB WALKS. */
  enemyCaptions: Readonly<Record<EnemyKind, string>>;
  /** How to Play heading for the page about opening clams, e.g. OPEN CLAMS. */
  cratesHeading: string;
  /** How to Play heading for the page about pearls, e.g. GRAB PEARLS. */
  pearlsHeading: string;
}

/** A world's object art and wording. */
export interface ObjectSkin {
  /** HUD and fire-button icon per item. */
  itemIcons: Readonly<Record<PowerUpKind, ArtRef>>;
  /** In-world sprite per item (a loose pickup, a burst icon). */
  itemTextures: Readonly<Record<PowerUpKind, string>>;
  attack: AttackArt;
  /** The pearl (acorn) texture, and the clam (crate) texture with `closed` and `open` frames. */
  pickups: Readonly<{ pearl: string; clam: string }>;
  enemies: EnemyArt;
  /** The art in the two hazard slots: urchins and jellies, whatever the world calls them. */
  hazards: Readonly<{ urchin: HazardSkin; jelly: HazardSkin }>;
  glints: Readonly<{ urchin: Glint; jelly: Glint }>;
  text: ObjectText;
}
