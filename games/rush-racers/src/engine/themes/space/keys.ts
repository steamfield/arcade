/**
 * The space theme's own texture, tile and animation keys. Every key starts with `space-` so none
 * can collide with the ocean's or the global art's. Only the space theme's files import these;
 * views get them through the theme.
 */

/** Space texture keys: the tileset, mud, wind, finish banner, hazards and backdrop layers. */
export const SpaceTex = {
  /** Tileset for the tilemap: one frame per entry in `SpaceTile`. */
  tiles: 'space-tiles',
  stoneDebris: 'space-stone-debris',
  mud: 'space-mud',
  windRight: 'space-wind-right',
  windLeft: 'space-wind-left',
  windUp: 'space-wind-up',
  windDown: 'space-wind-down',
  finishGate: 'space-finish-gate',
  thornBush: 'space-thorn-bush',
  wasp: 'space-wasp',
  backdropFar: 'space-backdrop-far',
  backdropNear: 'space-backdrop-near',
} as const;

/** Any texture key in `SpaceTex`. */
export type SpaceTexKey = (typeof SpaceTex)[keyof typeof SpaceTex];

/** Tile indices inside `SpaceTex.tiles`, named for the cell each draws and in frame order. */
export const SpaceTile = {
  /** Earth with a grass top. */
  rock: 0,
  /** Cracked stone. */
  coral: 1,
  /** A thin branch to jump up through. */
  ledge: 2,
  /** Earth under earth or stone: no grass top. */
  rockBuried: 3,
} as const;

/** Space animation keys: mud bubbles, the four wind flows and the wasp's wings. */
export const SpaceAnim = {
  mudBubble: 'space-mud-bubble',
  windRight: 'space-wind-right-flow',
  windLeft: 'space-wind-left-flow',
  windUp: 'space-wind-up-flow',
  windDown: 'space-wind-down-flow',
  waspBuzz: 'space-wasp-buzz',
} as const;
