/**
 * The first scene: builds every texture and animation once (the global art, the UI kit and every
 * theme's own), then routes to the title, or straight into a race when launched with `?scene=race`
 * (or the older `?scene=play`), into the room a `?room=<code>` link names, or to Friends with `?scene=friends`.
 */

import Phaser from 'phaser';
import { buildTextures } from '../art/index.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import type { Runtime } from '../runtime.ts';
import { registerThemeTextures } from '../themes/index.ts';
import { assertSkinTextures, registerSkinTextures, SKINS } from '../worlds/index.ts';

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
    registerThemeTextures(this);
    registerSkinTextures(this);
    for (const skin of Object.values(SKINS)) assertSkinTextures(this.textures, skin);
    if (RACE_SCENE_PARAMS.includes(this.rt.ctx.params.scene)) this.rt.startRace();
    // A room link joins its room at once; otherwise Friends when asked for, else the title.
    else if (!this.rt.openRoomLink()) this.rt.goTo(this.rt.ctx.params.scene === 'friends' ? 'friends' : 'title');
  }
}
