/**
 * The friends screen: create a room, or join one by spelling its code, drawn by
 * `view/friends-view.ts` over the same backdrop as the title. It only draws `rt.online`; the online
 * flow reads input for it each tick.
 */
import Phaser from 'phaser';
import { levelOf } from '../../logic/courses/index.ts';
import { centreOnStage } from '../centre-on-stage.ts';
import type { Runtime } from '../runtime.ts';
import { themeFor } from '../themes/index.ts';
import { isTouchScreen } from '../touch.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { createFriendsView, type FriendsView } from '../view/friends-view.ts';

/** The friends scene. */
export class FriendsScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private backdrop: Backdrop | null = null;
  private view: FriendsView | null = null;

  constructor(rt: Runtime) {
    super('friends');
    this.rt = rt;
  }

  create(): void {
    centreOnStage(this);
    const rt = this.rt;
    const course = rt.menuCourse;
    this.backdrop = createBackdrop(this, levelOf(course), themeFor(course), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    this.view = createFriendsView(this, isTouchScreen());
    rt.entered('friends');
    this.update();
  }

  override update(): void {
    const rt = this.rt;
    this.backdrop?.update(rt.step.tick);
    this.view?.sync(rt.online, rt.step.tick, rt.settings.reducedMotion);
  }
}
