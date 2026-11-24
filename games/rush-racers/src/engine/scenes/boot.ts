/**
 * The first scene: builds the global art and the UI kit with Reef's item icons, then hands over to
 * `Runtime.boot`, which waits for the art of the courses the first screens draw and routes on.
 * Every other world's and theme's art loads when a screen first needs it (see `Runtime.goTo`).
 */

import Phaser from 'phaser';
import { buildTextures } from '../art/index.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import type { Runtime } from '../runtime.ts';
import { REEF_ITEM_ICON_FRAMES } from '../worlds/reef/sprites/icons.ts';

/** Boot scene. It never calls `entered`, so the runtime stays loading until the next scene is up. */
export class BootScene extends Phaser.Scene {
  private readonly rt: Runtime;

  constructor(rt: Runtime) {
    super('boot');
    this.rt = rt;
  }

  create(): void {
    buildTextures(this);
    buildUiTextures(this, REEF_ITEM_ICON_FRAMES);
    this.rt.boot();
  }
}
