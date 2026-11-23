/**
 * The two cameras that let a menu scene keep its 320x180 layout while its backdrop fills the
 * whole view (`stage.ts`).
 */
import Phaser from 'phaser';
import { BASE, baseOffset } from './stage.ts';

/**
 * Centres a menu scene's base layout in the view. Objects at depth below 0 (the backdrop) draw
 * through the main camera across the whole view; everything else draws through a base-sized
 * camera in the middle, so the scene keeps placing things in base px. Call first in `create()`.
 */
export function centreOnStage(scene: Phaser.Scene): void {
  const main = scene.cameras.main;
  const at = baseOffset(scene.scale);
  const layout = scene.cameras.add(at.x, at.y, BASE.width, BASE.height);
  // Checked every frame because scenes add objects after create (pages, cards).
  const assign = () => {
    for (const child of scene.children.list) {
      const depth = (child as Partial<Phaser.GameObjects.Components.Depth>).depth ?? 0;
      child.cameraFilter = depth < 0 ? layout.id : main.id;
    }
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, assign);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.PRE_RENDER, assign));
}
