/**
 * Texture and frame keys for the UI kit, as typed consts, kept apart from the
 * world's `art/keys.ts` so the two sets can't collide, and the sheet shape the
 * UI art files export. Panel textures are made per size on demand and are
 * named by `panelKey` in `panel.ts`. A world's portraits and heads key their
 * textures in `worlds/<id>/keys.ts`.
 */
import type { NamedFrame } from '../pixel.ts';

/** UI texture keys; every one is built by `buildUiTextures`. */
export const UiTex = {
  fontText: 'ui-font-text',
  fontDisplay: 'ui-font-display',
  fontTextShadow: 'ui-font-text-shadow',
  fontDisplayShadow: 'ui-font-display-shadow',
  icons: 'ui-icons',
  medals: 'ui-medals',
  logo: 'ui-logo',
} as const;

/** Any UI texture key. */
type UiTexKey = (typeof UiTex)[keyof typeof UiTex];

/** One UI texture's art: frames laid left to right in the listed order. */
export interface UiSheet {
  key: UiTexKey;
  frames: readonly NamedFrame[];
}

/** Frames in `UiTex.icons`, all 9x9. */
export const IconFrame = {
  /** Two chevrons: the dash control (the logic's kick). */
  dash: 'dash',
  /** A starburst: the fire control, which uses the selected item. */
  fire: 'fire',
  jetFin: 'jet-fin',
  bubbleShield: 'bubble-shield',
  puffer: 'puffer',
  inkSac: 'ink-sac',
  glowLantern: 'glow-lantern',
  homingSquid: 'homing-squid',
  riptide: 'riptide',
  undertow: 'undertow',
  mimic: 'mimic',
  cannonball: 'cannonball',
  /** The lock-on warning's wedge, pointing right; the HUD turns it toward the squid. */
  warnArrow: 'warn-arrow',
  finishFlag: 'finish-flag',
  arrowUp: 'arrow-up',
  arrowDown: 'arrow-down',
  cursorFin: 'cursor-fin',
} as const;

/** Any icon frame name. */
export type IconFrameKey = (typeof IconFrame)[keyof typeof IconFrame];

/** Frames in `UiTex.medals`, all 12x14: first, second and third place. */
export const MedalFrame = {
  first: 'first',
  second: 'second',
  third: 'third',
} as const;

/** Any medal frame name. */
export type MedalFrameKey = (typeof MedalFrame)[keyof typeof MedalFrame];
