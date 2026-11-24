/**
 * The first scene: builds the global art and the UI kit with Reef's item icons, waits for the art
 * of the courses the first screens draw (the session's course and the menu course behind the
 * title, which differ with `?course=`), then routes to the title, or straight into a race when
 * launched with `?scene=race` (or the older `?scene=play`), into the room a `?room=<code>` link
 * names, or to Friends with `?scene=friends`. Every other world's and theme's art loads when a
 * screen first needs it (see `Runtime.goTo`).
 */

import Phaser from 'phaser';
import { buildTextures } from '../art/index.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import type { Runtime } from '../runtime.ts';
import { REEF_ITEM_ICON_FRAMES } from '../worlds/reef/sprites/icons.ts';

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
    buildUiTextures(this, REEF_ITEM_ICON_FRAMES);
    this.rt.whenArtReady([this.rt.course, this.rt.menuCourse], () => this.route());
  }

  private route(): void {
    if (RACE_SCENE_PARAMS.includes(this.rt.ctx.params.scene)) this.rt.startRace();
    // A room link joins its room at once; otherwise Friends when asked for, else the title.
    else if (!this.rt.openRoomLink()) this.rt.goTo(this.rt.ctx.params.scene === 'friends' ? 'friends' : 'title');
  }
}
