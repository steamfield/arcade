/**
 * The UI palette: five colours with fixed roles, kept apart from the world
 * palettes so menus and HUD never read as part of the reef. The world is blue
 * and green water; the UI is ink and indigo panels, warm foam text, a sun gold
 * accent and a coral alert. Panel bevels and the dim text tone are ramps of
 * those five, not new hues. `ui.test.ts` holds every text tone to 4.5:1
 * against the text shadow and every panel fill.
 */
import type { Palette } from '../pixel.ts';

/** The five UI colours by role. */
export const UiColour = {
  /** Outlines, text shadow, the darkest value on screen. */
  ink: 0x0b0a1e,
  /** Panel body. Indigo, so a panel never looks like a patch of water. */
  indigo: 0x211b48,
  /** Primary text and icons. Warm white, softer than pure white on the dark panels. */
  foam: 0xf6f0dc,
  /** Accent: selection, the player's place, gold medals, the logo. */
  sun: 0xffc53a,
  /** Alerts: losing a place, DNF, a failed save. */
  coral: 0xff8a7a,
} as const;

/** Ramps derived from the five roles: panel bevels and secondary text. */
export const UiRamp = {
  /** Lit top-left edge of a raised indigo panel. */
  indigoLight: 0x433a82,
  /** Shaded bottom-right edge of a raised indigo panel, and the top edge of an inset well. */
  indigoDark: 0x17123a,
  /** Fill of an inset well (timer, progress track). */
  well: 0x120e2c,
  /** Shaded bottom-right edge of a gold panel. */
  sunDark: 0xb0700e,
  /** Secondary text: labels, hints, idle menu options. */
  dim: 0xa9a6d0,
} as const;

/** The text colours a label can take by name. */
export const UiTone = {
  foam: UiColour.foam,
  sun: UiColour.sun,
  coral: UiColour.coral,
  dim: UiRamp.dim,
} as const;

/** Any named text tone. */
export type UiToneName = keyof typeof UiTone;

/**
 * The only tones allowed on text over the water rather than a panel, and then only with a full
 * outline. Coral and dim fall under 4.5:1 on the shallow bands, so they stay on panels.
 */
export const OFF_PANEL_TONES = ['foam', 'sun'] as const satisfies readonly UiToneName[];

/** A tone as the CSS colour string `Label.setColor` takes. */
export function toneCss(tone: UiToneName): string {
  return `#${UiTone[tone].toString(16).padStart(6, '0')}`;
}

/** The ink every label's shadow or outline is drawn in. */
export const TEXT_SHADOW = UiColour.ink;

/**
 * The display face's lower rows are drawn in this grey, so a tinted numeral reads lit on top and
 * shaded below. A tone multiplied by it is the shaded colour the contrast test checks.
 */
export const DISPLAY_SHADE = 0xd4d4d4;

/** Panel palettes for the shared panel art: outline, top-left edge, fill, bottom-right edge. */
export const PanelPalette = {
  /** The default framed box: indigo, lit from the top left. */
  raised: [UiColour.ink, UiRamp.indigoLight, UiColour.indigo, UiRamp.indigoDark],
  /** Selected buttons and the player's own place: the same box in a gold frame. */
  accent: [UiColour.ink, UiColour.sun, UiColour.indigo, UiRamp.sunDark],
  /** A sunken well for readouts and tracks: dark edge on top, light edge below. */
  inset: [UiColour.ink, UiRamp.indigoDark, UiRamp.well, UiRamp.indigoLight],
} as const satisfies Record<string, Palette>;

/** Any panel style name. */
export type PanelStyle = keyof typeof PanelPalette;
