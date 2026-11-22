/**
 * Draw order for the race screen, back to front. Every view sets its depth from
 * here so adding a layer means editing one list.
 */
export const Layer = {
  backdrop: -20,
  parallax: -10,
  tiles: 0,
  water: 1,
  objects: 2,
  racers: 5,
  player: 6,
  hud: 10,
  banner: 11,
  debug: 20,
} as const;
