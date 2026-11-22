/**
 * Puts the newest held power-up's icon on the on-screen B button, so a child can link the button
 * to the item it fires. The touch controls are DOM buttons owned by `@arcade/input`; this only adds
 * an image inside the B button while the stack holds something, and takes it away (back to the
 * plain "B") when it empties or the race scene closes. The icon is cut from the UI icon sheet
 * and scaled with crisp pixels. Without touch controls it does nothing.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../logic/types.ts';
import { UiTex } from '../art/ui/keys.ts';
import { burstButton } from '../touch.ts';
import { POWER_UP_ICON } from './hud.ts';

/** The B button's icon; `sync` follows the player's stack and `destroy` restores the button. */
export interface BurstButtonIcon {
  /** `stack` is the player's held power-ups, oldest first; the last one is shown. */
  sync(stack: readonly PowerUpKind[]): void;
  destroy(): void;
}

/** CSS px the 9x9 icon is shown at: 4x, leaving room under it for the button's own "B". */
const ICON_CSS_PX = 36;

/** A button that does nothing, for screens without touch controls. */
const NO_ICON: BurstButtonIcon = { sync() {}, destroy() {} };

/** Adds the icon to the B button if the touch controls are up; the returned icon is inert otherwise. */
export function createBurstButtonIcon(scene: Phaser.Scene): BurstButtonIcon {
  const button = burstButton();
  if (!button) return NO_ICON;
  const urls = new Map<PowerUpKind, string>();
  const image = document.createElement('img');
  image.alt = '';
  image.style.cssText = `width:${ICON_CSS_PX}px;height:${ICON_CSS_PX}px;image-rendering:pixelated;pointer-events:none`;
  let shown: PowerUpKind | null = null;

  const show = (kind: PowerUpKind) => {
    let url = urls.get(kind);
    if (url === undefined) {
      url = iconUrl(scene, kind);
      urls.set(kind, url);
    }
    image.src = url;
    if (shown === null) {
      button.prepend(image);
      Object.assign(button.style, STACKED);
    }
    shown = kind;
  };
  const hide = () => {
    if (shown === null) return;
    image.remove();
    for (const property of Object.keys(STACKED)) button.style.removeProperty(toCssName(property));
    shown = null;
  };

  return {
    sync(stack) {
      const newest = stack.at(-1);
      if (newest === undefined) hide();
      else if (newest !== shown) show(newest);
    },
    destroy: hide,
  };
}

/** The button's layout while it holds an icon: the icon over the "B", both centred. */
const STACKED = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } as const;

function toCssName(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `kind`'s HUD icon as a PNG data URL, cut out of the icon sheet at its own size. */
function iconUrl(scene: Phaser.Scene, kind: PowerUpKind): string {
  const frame = scene.textures.getFrame(UiTex.icons, POWER_UP_ICON[kind]);
  const canvas = document.createElement('canvas');
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('Cannot draw the power-up icon for the B button: this browser gave no 2D canvas context');
  const source = frame.source.image as CanvasImageSource;
  context.drawImage(
    source,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    0,
    0,
    frame.cutWidth,
    frame.cutHeight,
  );
  return canvas.toDataURL('image/png');
}
