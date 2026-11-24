/**
 * The space theme's own texture, tile and animation keys. Every key starts with `space-` so none
 * can collide with the ocean's or the global art's. Only the space theme's files import these;
 * views get them through the theme.
 */

/** Space texture keys: the tileset, dust, wind, finish banner and backdrop layers. */
export const SpaceTex = {
  /** Tileset for the tilemap: one frame per entry in `SpaceTile`. */
  tiles: 'space-tiles',
  iceDebris: 'space-ice-debris',
  dust: 'space-dust',
  windRight: 'space-wind-right',
  windLeft: 'space-wind-left',
  windUp: 'space-wind-up',
  windDown: 'space-wind-down',
  finishGate: 'space-finish-gate',
  backdropFar: 'space-backdrop-far',
  backdropNear: 'space-backdrop-near',
} as const;

/** Any texture key in `SpaceTex`. */
export type SpaceTexKey = (typeof SpaceTex)[keyof typeof SpaceTex];

/** Tile indices inside `SpaceTex.tiles`, named for the cell each draws and in frame order. */
export const SpaceTile = {
  /** Asteroid rock facing open space above: a sunlit rim along its top. */
  rock: 0,
  /** Breakable ice. */
  coral: 1,
  /** A thin metal strut to jump up through. */
  ledge: 2,
  /** Asteroid rock under rock or ice: no rim, a scatter of lit specks instead. */
  rockBuried: 3,
} as const;

/** Space animation keys: the dust's sway and the four wind flows. */
export const SpaceAnim = {
  dustSwirl: 'space-dust-swirl',
  windRight: 'space-wind-right-flow',
  windLeft: 'space-wind-left-flow',
  windUp: 'space-wind-up-flow',
  windDown: 'space-wind-down-flow',
} as const;

/** Backdrop layer heights in px: the art draws each layer this tall and `space.ts` declares it to the backdrop view. */
export const FAR_HEIGHT = 192;
export const NEAR_HEIGHT = 80;
