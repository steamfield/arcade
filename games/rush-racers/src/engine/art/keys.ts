/**
 * The global texture keys and the shared frame names, as typed consts. Global textures are the HUD
 * kick pip and the guide arrow, which look the same in every world. Views and the art builder both
 * import from here, so a typo fails typecheck. A world's cast and objects key their textures in
 * `worlds/<id>/keys.ts`, and a course's own look (terrain, hazards, backdrop) in its theme under
 * `themes/`, never here.
 */

/** Global texture keys. */
export const Tex = {
  kickPip: 'kick-pip',
  /** The Easy guide's arrow (13x13, pointing right and down-right frames); the view turns it in quarter turns. */
  guideArrow: 'guide-arrow',
} as const;

/** Any texture key in `Tex`. */
export type TexKey = (typeof Tex)[keyof typeof Tex];

/** Named frames inside multi-frame textures, shared by every world and theme. */
export const Frame = {
  /** Two-frame cycles: racer swim strokes, and a theme's own loops (the ocean's kelp, currents and jelly). */
  a: 'a',
  b: 'b',
  squidLatched: 'latched',
  clamClosed: 'closed',
  clamOpen: 'open',
  pipReady: 'ready',
  pipCooling: 'cooling',
  guideStraight: 'straight',
  guideDiagonal: 'diagonal',
  /** An enemy's attack pose: the shark's jaws open for its wind-up and charge. */
  enemyBite: 'bite',
  /** An enemy knocked dazed by a bonk. */
  enemyStagger: 'stagger',
  markHole: 'hole',
  markEyes: 'eyes',
  markAlert: 'alert',
  markBubble: 'bubble',
  markStar: 'star',
  markPop: 'pop',
} as const;

/** Any frame name in `Frame`. */
export type FrameKey = (typeof Frame)[keyof typeof Frame];
