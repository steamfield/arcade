/**
 * Puts the selected item's icon on the on-screen A (fire) button, so a child can link the button
 * to the item it fires. The touch controls are DOM buttons owned by `@arcade/input`; this only adds
 * an image inside the A button while an item is held, and takes it away (back to the plain "A")
 * when nothing is held or the race scene closes. The icon is cut from the UI icon sheet
 * and scaled with crisp pixels. Without touch controls it does nothing.
 */
import type Phaser from 'phaser';
import type { PowerUpKind } from '../../logic/types.ts';
import { fireButton } from '../touch.ts';
import type { ArtRef } from '../worlds/art-ref.ts';
import type { ObjectSkin } from '../worlds/object-skin.ts';

/** The A button's icon; `sync` follows the player's selected item and `destroy` restores the button. */
export interface FireButtonIcon {
  /** `selected` is the kind in the player's selected slot, or null when nothing is held. */
  sync(selected: PowerUpKind | null): void;
  destroy(): void;
}

/** CSS px the 9x9 icon is shown at: 4x, leaving room under it for the button's own "A". */
const ICON_CSS_PX = 36;

/** A button that does nothing, for screens without touch controls. */
const NO_ICON: FireButtonIcon = { sync() {}, destroy() {} };

/**
 * Adds the icon to the A button if the touch controls are up, cut from `itemIcons`; the returned
 * icon is inert otherwise.
 */
export function createFireButtonIcon(scene: Phaser.Scene, itemIcons: ObjectSkin['itemIcons']): FireButtonIcon {
  const button = fireButton();
  if (!button) return NO_ICON;
  const urls = new Map<PowerUpKind, string>();
  const image = document.createElement('img');
  image.alt = '';
  image.style.cssText = `width:${ICON_CSS_PX}px;height:${ICON_CSS_PX}px;image-rendering:pixelated;pointer-events:none`;
  let shown: PowerUpKind | null = null;

  const show = (kind: PowerUpKind) => {
    let url = urls.get(kind);
    if (url === undefined) {
      url = iconUrl(scene, itemIcons[kind]);
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
    sync(selected) {
      if (selected === null) hide();
      else if (selected !== shown) show(selected);
    },
    destroy: hide,
  };
}

/** The button's layout while it holds an icon: the icon over the "A", both centred. */
const STACKED = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } as const;

function toCssName(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** The HUD icon `icon` as a PNG data URL, cut out of its sheet at its own size. */
function iconUrl(scene: Phaser.Scene, icon: ArtRef): string {
  const frame = scene.textures.getFrame(icon.texture, icon.frame);
  const canvas = document.createElement('canvas');
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('Cannot draw the power-up icon for the A button: this browser gave no 2D canvas context');
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
