/**
 * Where the race's screen-pinned text and warnings may go, for a view of any size (UI.md "Race HUD"
 * and "Safe zones", drawn on the 320x180 base). The HUD row stays in the top-left corner; centred
 * text follows the view's centre; the touch zones and bottom margin follow the edges they hang from,
 * because the touch controls are anchored to the real corners of the screen.
 */
import { BASE, type Size } from '../stage.ts';

/** A rectangle in px, `(x, y)` its top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The race overlay's guides for one view size, in screen px. */
export interface ScreenLayout {
  /** The view's horizontal centre: centred banners and the caption line. */
  centreX: number;
  /** The middle of the safe column between the d-pad and the A/B buttons: text beside the player. */
  besideX: number;
  /** The lowest anything over the water reaches: the bottom margin. */
  lowest: number;
  /** Where warning arrows may sit: inside the margin, below the HUD row and caption line. */
  markerBounds: Rect;
  /** The back link, the d-pad and the A/B buttons, in that order. */
  touchZones: readonly Rect[];
  /** Where a centre splash draws, widest case (FINAL STRETCH). */
  splashRect: Rect;
}

const MARGIN = 6;
/** Half the widest splash; it spans 214 px. */
const SPLASH_HALF = 107;

/** The layout for a view `view` px big. */
export function screenLayout(view: Size): ScreenLayout {
  const { width, height } = view;
  const centreX = width / 2;
  return {
    centreX,
    // The safe column runs from the d-pad's right edge (108) to the A/B buttons' left edge (width - 92).
    besideX: (108 + width - 92) / 2,
    lowest: height - MARGIN,
    markerBounds: { x: 8, y: 52, w: width - 16, h: height - 60 },
    touchZones: [
      { x: width - 72, y: 0, w: 72, h: 26 },
      { x: 0, y: height - 104, w: 108, h: 104 },
      { x: width - 92, y: height - 62, w: 92, h: 62 },
    ],
    splashRect: { x: centreX - SPLASH_HALF, y: 50, w: SPLASH_HALF * 2, h: 24 },
  };
}

/** The layout on the 320x180 base, which the UI.md numbers describe. */
export const BASE_LAYOUT: ScreenLayout = screenLayout(BASE);
