/**
 * Texture and frame keys for the UI kit, as typed consts, kept apart from the
 * world's `art/keys.ts` so the two sets can't collide, and the sheet shape the
 * UI art files export. Panel textures are made per size on demand and are
 * named by `panelKey` in `panel.ts`.
 */
import type { NamedFrame } from '../pixel.ts';

/** UI texture keys; every one is built by `buildUiTextures`. */
export const UiTex = {
  fontText: 'ui-font-text',
  fontDisplay: 'ui-font-display',
  icons: 'ui-icons',
  medals: 'ui-medals',
  portraits: 'ui-portraits',
  logo: 'ui-logo',
} as const;

/** Any UI texture key. */
export type UiTexKey = (typeof UiTex)[keyof typeof UiTex];

/** One UI texture's art: frames laid left to right in the listed order. */
export interface UiSheet {
  key: UiTexKey;
  frames: readonly NamedFrame[];
}

/** Frames in `UiTex.icons`, all 9x9. */
export const IconFrame = {
  kick: 'kick',
  burst: 'burst',
  jetFin: 'jet-fin',
  bubbleShield: 'bubble-shield',
  puffer: 'puffer',
  inkSac: 'ink-sac',
  glowLantern: 'glow-lantern',
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

/** Frames in `UiTex.portraits`, all 16x16, named by racer id so a view can pass `racer.id` straight in. */
export const PortraitFrame = {
  player: 'player',
  tess: 'tess',
  squib: 'squib',
  bo: 'bo',
} as const;

/** Any portrait frame name. */
export type PortraitFrameKey = (typeof PortraitFrame)[keyof typeof PortraitFrame];
