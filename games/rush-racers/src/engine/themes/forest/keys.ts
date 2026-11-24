/**
 * The forest theme's own texture, tile and animation keys. Every key starts with `forest-` so none
 * can collide with the ocean's or the global art's. Only the forest theme's files import these;
 * views get them through the theme.
 */

/** Forest texture keys: the tileset, mud, wind, finish banner and backdrop layers. */
export const ForestTex = {
  /** Tileset for the tilemap: one frame per entry in `ForestTile`. */
  tiles: 'forest-tiles',
  stoneDebris: 'forest-stone-debris',
  mud: 'forest-mud',
  windRight: 'forest-wind-right',
  windLeft: 'forest-wind-left',
  windUp: 'forest-wind-up',
  windDown: 'forest-wind-down',
  finishGate: 'forest-finish-gate',
  backdropFar: 'forest-backdrop-far',
  backdropNear: 'forest-backdrop-near',
} as const;

/** Any texture key in `ForestTex`. */
export type ForestTexKey = (typeof ForestTex)[keyof typeof ForestTex];

/** Tile indices inside `ForestTex.tiles`, named for the cell each draws and in frame order. */
export const ForestTile = {
  /** Earth with a grass top. */
  rock: 0,
  /** Cracked stone. */
  coral: 1,
  /** A thin branch to jump up through. */
  ledge: 2,
  /** Earth under earth or stone: no grass top. */
  rockBuried: 3,
} as const;

/** Forest animation keys: mud bubbles and the four wind flows. */
export const ForestAnim = {
  mudBubble: 'forest-mud-bubble',
  windRight: 'forest-wind-right-flow',
  windLeft: 'forest-wind-left-flow',
  windUp: 'forest-wind-up-flow',
  windDown: 'forest-wind-down-flow',
} as const;
