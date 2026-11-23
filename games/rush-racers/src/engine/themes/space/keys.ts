/**
 * The space theme's own texture, tile and animation keys. Every key starts with `space-` so none
 * can collide with the ocean's or the global art's. Only the space theme's files import these;
 * views get them through the theme.
 */

/** Space texture keys: the tileset, dust, wind, finish banner, hazards and backdrop layers. */
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
  mine: 'space-mine',
  orb: 'space-orb',
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

/** Space animation keys: dust bubbles, the four wind flows and the orb's wings. */
export const SpaceAnim = {
  dustSwirl: 'space-dust-swirl',
  windRight: 'space-wind-right-flow',
  windLeft: 'space-wind-left-flow',
  windUp: 'space-wind-up-flow',
  windDown: 'space-wind-down-flow',
  orbPulse: 'space-orb-pulse',
} as const;
