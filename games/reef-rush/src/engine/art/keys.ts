/**
 * Every texture, frame and animation key the game uses, as typed consts. Views
 * and the art builder both import from here, so a typo fails typecheck and the
 * phase 4 pixel art can replace a texture by building the same key.
 */

/** Texture keys. Phase 3's pickups, hazards and power-ups are declared now so their views have keys to use. */
export const Tex = {
  /** Tileset for the tilemap: one frame per entry in TileIndex. */
  tiles: 'tiles',
  coralDebris: 'coral-debris',
  kelp: 'kelp',
  currentRight: 'current-right',
  currentLeft: 'current-left',
  currentUp: 'current-up',
  currentDown: 'current-down',
  finishGate: 'finish-gate',
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
  urchin: 'urchin',
  jelly: 'jelly',
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
  backdropFar: 'backdrop-far',
  backdropNear: 'backdrop-near',
} as const;

/** Any texture key in `Tex`. */
export type TexKey = (typeof Tex)[keyof typeof Tex];

/** Named frames inside multi-frame textures. */
export const Frame = {
  /** Two-frame cycles: racer swim strokes, kelp sway, current flow, jelly pulse. */
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
} as const;

/** Any frame name in `Frame`. */
export type FrameKey = (typeof Frame)[keyof typeof Frame];

/** Tile indices inside `Tex.tiles`. The tilemap stores these; -1 is empty water. */
export const TileIndex = {
  rock: 0,
  coral: 1,
} as const;

/** Global animation keys, registered once by `buildTextures`. */
export const Anim = {
  kelpSway: 'kelp-sway',
  currentRight: 'current-right-flow',
  currentLeft: 'current-left-flow',
  currentUp: 'current-up-flow',
  currentDown: 'current-down-flow',
  jellyPulse: 'jelly-pulse',
} as const;

/** Any animation key in `Anim`. */
export type AnimKey = (typeof Anim)[keyof typeof Anim];
