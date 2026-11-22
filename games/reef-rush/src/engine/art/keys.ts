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
  player: 'racer-player',
  tess: 'racer-tess',
  squib: 'racer-squib',
  bo: 'racer-bo',
  pearl: 'pearl',
  clam: 'clam',
  urchin: 'urchin',
  jelly: 'jelly',
  jetFin: 'powerup-jet-fin',
  bubbleShield: 'powerup-bubble-shield',
  puffer: 'powerup-puffer',
  inkSac: 'powerup-ink-sac',
  glowLantern: 'powerup-glow-lantern',
  inkCloud: 'ink-cloud',
  bubble: 'bubble',
  looseGlow: 'loose-glow',
  hudMarker: 'hud-marker',
  kickPip: 'kick-pip',
  backdropFar: 'backdrop-far',
  backdropNear: 'backdrop-near',
} as const;

export type TexKey = (typeof Tex)[keyof typeof Tex];

/** Named frames inside multi-frame textures. */
export const Frame = {
  /** Two-frame cycles: racer swim strokes, kelp sway, current flow, jelly pulse. */
  a: 'a',
  b: 'b',
  clamClosed: 'closed',
  clamOpen: 'open',
  markerCircle: 'circle',
  markerSquare: 'square',
  markerTriangle: 'triangle',
  markerDiamond: 'diamond',
  pipReady: 'ready',
  pipCooling: 'cooling',
} as const;

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

export type AnimKey = (typeof Anim)[keyof typeof Anim];
