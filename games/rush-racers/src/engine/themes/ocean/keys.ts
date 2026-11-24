/**
 * The ocean theme's own texture, tile and animation keys. The strings are the ones the game used
 * before themes existed, so a capture of the ocean course is unchanged. Only the ocean theme's
 * files import these; views get them through the theme.
 */

/** Ocean texture keys: the reef's terrain, flowing water, the waterline, finish banner and backdrop layers. */
export const OceanTex = {
  /** Tileset for the tilemap: one frame per entry in `OceanTile`. */
  tiles: 'tiles',
  coralDebris: 'coral-debris',
  kelp: 'kelp',
  currentRight: 'current-right',
  currentLeft: 'current-left',
  currentUp: 'current-up',
  currentDown: 'current-down',
  finishGate: 'finish-gate',
  backdropFar: 'backdrop-far',
  backdropNear: 'backdrop-near',
  /** The wave crest along the sea's surface, a two-frame loop. */
  waterline: 'waterline',
  /** The rock wall behind a dark stretch, tiled across it. */
  caveWall: 'cave-wall',
} as const;

/** Any texture key in `OceanTex`. */
export type OceanTexKey = (typeof OceanTex)[keyof typeof OceanTex];

/** Tile indices inside `OceanTex.tiles`, in the order its frames are laid out. */
export const OceanTile = {
  rock: 0,
  coral: 1,
  sky: 2,
  caveRock: 3,
  stalactite: 4,
  stalagmite: 5,
  ledge: 6,
  /** A bounce cloud, for sky-test until the sky theme has its own. */
  bounce: 7,
  shellTopLeft: 8,
  shellTopRight: 9,
  shellBottomLeft: 10,
  shellBottomRight: 11,
} as const;

/** Ocean animation keys: kelp sway, the four current flows and the waterline's roll. */
export const OceanAnim = {
  kelpSway: 'kelp-sway',
  currentRight: 'current-right-flow',
  currentLeft: 'current-left-flow',
  currentUp: 'current-up-flow',
  currentDown: 'current-down-flow',
  waterlineRoll: 'waterline-roll',
} as const;
