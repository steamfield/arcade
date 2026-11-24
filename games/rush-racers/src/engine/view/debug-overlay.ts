/**
 * The `?debug=1` overlay: every racer's hitbox drawn from logic state (not from
 * sprites, so it shows what the rules believe), plus the tick and the local racer's
 * tile just below the HUD.
 */
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import { summarize } from '../../logic/world.ts';
import { createLabel } from '../art/font.ts';
import { localIdOf } from '../local-racer.ts';
import { Layer } from './layers.ts';

/** The debug overlay; `sync` redraws hitboxes and the readout from the world. */
interface DebugOverlay {
  sync(world: World): void;
}

const HITBOX_COLOUR = 0xff00ff;

/** Adds the debug overlay to `scene`. */
export function createDebugOverlay(scene: Phaser.Scene): DebugOverlay {
  const hitboxes = scene.add.graphics().setDepth(Layer.debug);
  const readout = createLabel(scene, 8, 46, '', { size: 'small', color: '#ff9cff', fixed: true, depth: Layer.debug });
  return {
    sync(world) {
      hitboxes.clear().lineStyle(1, HITBOX_COLOUR);
      for (const { body } of world.racers) hitboxes.strokeRect(body.x, body.y, body.w, body.h);
      const { tick, player } = summarize(world, localIdOf(world));
      readout.setText(`tick ${tick}  tile ${player.tile.join(',')}`);
    },
  };
}
