/**
 * The global texture and frame keys, as typed consts: racers, pickups, power-ups, attack art, HUD
 * sprites and the guide arrow, which look the same on every course. Views and the art builder both
 * import from here, so a typo fails typecheck. A course's own look (terrain, hazards, backdrop) keys
 * its textures in its theme under `themes/`, never here.
 */

/** Texture keys. Phase 3's pickups, hazards and power-ups are declared now so their views have keys to use. */
export const Tex = {
  /** One racer texture per character, keyed by CharacterId so views can look up `Tex[racer.character]`. */
  rudy: 'racer-rudy',
  gil: 'racer-gil',
  streak: 'racer-streak',
  onyx: 'racer-onyx',
  nib: 'racer-nib',
  baron: 'racer-baron',
  selene: 'racer-selene',
  rook: 'racer-rook',
  pearl: 'pearl',
  clam: 'clam',
  jetFin: 'powerup-jet-fin',
  bubbleShield: 'powerup-bubble-shield',
  puffer: 'powerup-puffer',
  inkSac: 'powerup-ink-sac',
  glowLantern: 'powerup-glow-lantern',
  homingSquid: 'powerup-homing-squid',
  riptide: 'powerup-riptide',
  undertow: 'powerup-undertow',
  mimic: 'powerup-mimic',
  /** The Homing Squid in the water (16x12, swim and latched frames), not its held icon. */
  squid: 'squid',
  /** One 16x16 tile of a Riptide lane, streaks pointing right; the view rotates it to the lane. */
  riptideStreak: 'riptide-streak',
  /** Speed lines drawn ahead of a racer Undertow is pulling back. */
  undertowStreak: 'undertow-streak',
  inkCloud: 'ink-cloud',
  bubble: 'bubble',
  looseGlow: 'loose-glow',
  hudMarker: 'hud-marker',
  kickPip: 'kick-pip',
  /** The Easy guide's arrow (13x13, pointing right and down-right frames); the view turns it in quarter turns. */
  guideArrow: 'guide-arrow',
} as const;

/** Any texture key in `Tex`. */
export type TexKey = (typeof Tex)[keyof typeof Tex];

/** Named frames inside multi-frame textures. */
export const Frame = {
  /** Two-frame cycles: racer swim strokes, and a theme's own loops (the ocean's kelp, currents and jelly). */
  a: 'a',
  b: 'b',
  squidLatched: 'latched',
  clamClosed: 'closed',
  clamOpen: 'open',
  markerCircle: 'circle',
  markerSquare: 'square',
  markerTriangle: 'triangle',
  markerDiamond: 'diamond',
  pipReady: 'ready',
  pipCooling: 'cooling',
  guideStraight: 'straight',
  guideDiagonal: 'diagonal',
} as const;

/** Any frame name in `Frame`. */
export type FrameKey = (typeof Frame)[keyof typeof Frame];
