/**
 * The sky theme's own texture, tile and animation keys. Every key starts with `sky-theme-` so none
 * can collide with another theme's, the global art's, the ring and storm views' `sky-` textures or
 * Cloudreach's `cloudreach-` skin keys. Only the sky theme's files import these; views get them
 * through the theme.
 */

/** Sky texture keys: the tileset, popped-cloud puffs, fog, winds, finish banner and backdrop layers. */
export const SkyThemeTex = {
  /** Tileset for the tilemap: one frame per entry in `SkyThemeTile`. */
  tiles: 'sky-theme-tiles',
  puffDebris: 'sky-theme-puff-debris',
  fog: 'sky-theme-fog',
  windRight: 'sky-theme-wind-right',
  windLeft: 'sky-theme-wind-left',
  updraft: 'sky-theme-updraft',
  downdraft: 'sky-theme-downdraft',
  finishGate: 'sky-theme-finish-gate',
  backdropFar: 'sky-theme-backdrop-far',
  backdropNear: 'sky-theme-backdrop-near',
} as const;

/** Any texture key in `SkyThemeTex`. */
export type SkyThemeTexKey = (typeof SkyThemeTex)[keyof typeof SkyThemeTex];

/** Tile indices inside `SkyThemeTex.tiles`, named for the cell each draws and in frame order. */
export const SkyThemeTile = {
  /** Thunderhead with a lit top edge. */
  rock: 0,
  /** A round puff cloud a dash pops. */
  coral: 1,
  /** A thin cloud wisp to jump up through. */
  ledge: 2,
  /** Thunderhead under thunderhead or puff: no lit top edge. */
  rockBuried: 3,
  /** A springy cloud with a coiled rim. */
  bounce: 4,
} as const;

/** Sky animation keys: fog drift and the four winds. */
export const SkyThemeAnim = {
  fogDrift: 'sky-theme-fog-drift',
  windRight: 'sky-theme-wind-right-flow',
  windLeft: 'sky-theme-wind-left-flow',
  updraft: 'sky-theme-updraft-flow',
  downdraft: 'sky-theme-downdraft-flow',
} as const;
