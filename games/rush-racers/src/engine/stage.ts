/**
 * How big the game's view is. Screens are laid out on a 320x180 base; the view grows past it
 * so the canvas fills the window at a whole-number zoom (crisp pixels) instead of showing bars.
 * Menus keep their base layout centred over a backdrop that fills the whole view
 * (`centre-on-stage.ts`); the race shows more of the course and pins its HUD to the real edges.
 */
/** A size in game px. */
export interface Size {
  width: number;
  height: number;
}

/** The layout every screen is designed on (UI.md). */
export const BASE: Size = { width: 320, height: 180 };

/** The widest and tallest the view grows to; a window past these keeps thin bars rather than stretch play. */
const MAX_ASPECT = 21 / 9;
const MIN_ASPECT = 4 / 3;

/** The view size and zoom for a container `css` px big. */
export interface Stage extends Size {
  zoom: number;
}

/**
 * The largest whole-number zoom at which the base fits, and the view at that zoom that covers the
 * container: at least the base, rounded up (so at most `zoom - 1` css px is cropped), within the aspect caps.
 */
export function stageFor(css: Size): Stage {
  const zoom = Math.max(1, Math.floor(Math.min(css.width / BASE.width, css.height / BASE.height)));
  const height = Math.max(BASE.height, Math.ceil(css.height / zoom));
  const width = Math.max(BASE.width, Math.min(Math.ceil(css.width / zoom), Math.floor(height * MAX_ASPECT)));
  return { zoom, width, height: Math.min(height, Math.max(BASE.height, Math.floor(width / MIN_ASPECT))) };
}

/** Top-left of the base layout when it is centred in a view `view` px big. */
export function baseOffset(view: Size): { x: number; y: number } {
  return { x: Math.floor((view.width - BASE.width) / 2), y: Math.floor((view.height - BASE.height) / 2) };
}
