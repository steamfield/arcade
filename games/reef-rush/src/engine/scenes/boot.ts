/**
 * The first scene: builds every texture and animation once, then routes to the
 * title, or straight into a race when launched with `?scene=race` (or the older
 * `?scene=play`).
 */

import Phaser from 'phaser';
import { buildTextures } from '../art/index.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import type { Runtime } from '../runtime.ts';

/** `?scene=` values that skip the title. */
const RACE_SCENE_PARAMS: readonly (string | null)[] = ['race', 'play'];

/** Boot scene. It never calls `entered`, so the runtime stays loading until the next scene is up. */
export class BootScene extends Phaser.Scene {
  private readonly rt: Runtime;

  constructor(rt: Runtime) {
    super('boot');
    this.rt = rt;
  }

  create(): void {
    buildTextures(this);
    buildUiTextures(this);
    if (RACE_SCENE_PARAMS.includes(this.rt.ctx.params.scene)) this.rt.startRace();
    else this.rt.goTo('title');
  }
}
