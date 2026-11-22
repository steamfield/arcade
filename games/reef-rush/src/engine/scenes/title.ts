/**
 * The title screen: the game's name, the menu (just "Race" for now), and the
 * saved best time and place when there is one.
 */
import Phaser from 'phaser';
import { createLabel } from '../art/font.ts';
import { MENU_OPTIONS } from '../menu.ts';
import type { Runtime } from '../runtime.ts';
import { createMenuView, type MenuView } from '../view/menu-view.ts';
import { formatBest } from '../view/race-text.ts';

/** Title scene. Its menu lives on the runtime, which reads input for it each tick. */
export class TitleScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private menuView: MenuView | null = null;

  constructor(rt: Runtime) {
    super('title');
    this.rt = rt;
  }

  create(): void {
    const { width } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0b3d6b');
    createLabel(this, width / 2, 50, this.rt.ctx.manifest.title.toUpperCase(), {
      size: 'title',
      color: '#ffd23f',
      align: 'center',
    });
    this.menuView = createMenuView(this, width / 2, 100, MENU_OPTIONS.title);
    const best = this.rt.save?.best;
    if (best)
      createLabel(this, width / 2, 140, formatBest(best), { size: 'medium', color: '#9fe7ff', align: 'center' });
    this.rt.entered('title');
  }

  override update(_time: number, delta: number): void {
    this.rt.frame(delta);
    this.menuView?.sync(this.rt.menu);
  }
}
