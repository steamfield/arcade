/**
 * Comets in flight on the race screen (`world.shots` of style 'comet'): a bright head and a tail of
 * fading, shrinking puffs trailing back along its velocity, so a bend round a planet shows in the
 * curve of the head's path and the swing of the tail. Redrawn every frame from the shots alone, so
 * a comet that ends simply stops being drawn (the impact fx comes from `shot.ended`). A space theme
 * extra layer.
 */
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** One puff of a comet: centre and radius in px, and its opacity. */
export interface CometPuff {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

/** What to draw for one comet on one frame: its head, then its tail from the head backwards. */
export interface CometMark {
  head: CometPuff;
  tail: CometPuff[];
}

/** The head, a white-hot core inside a pale blue glow, and the tail behind it. */
const HEAD = { radius: 4, alpha: 1, glowRadius: 7, glowColour: 0x9fd8ff, glowAlpha: 0.45, colour: 0xf4fbff } as const;
/**
 * The tail: this many puffs, spaced by the distance the comet covers in `secondsPerPuff`, each
 * smaller and fainter than the one before it.
 */
const TAIL = { puffs: 6, secondsPerPuff: 1 / 30, colour: 0x7ab8ff, shrink: 0.82, fade: 0.7 } as const;

/** One mark per comet in flight, in `world.shots` order; other shot styles are left to their own views. */
export function cometMarks(world: World): CometMark[] {
  return world.shots
    .filter((shot) => shot.style === 'comet')
    .map((shot) => {
      let radius = HEAD.radius;
      let alpha = TAIL.fade;
      const tail = Array.from({ length: TAIL.puffs }, (_, index) => {
        const back = (index + 1) * TAIL.secondsPerPuff;
        const puff = { x: shot.x - shot.vx * back, y: shot.y - shot.vy * back, radius, alpha };
        radius *= TAIL.shrink;
        alpha *= TAIL.fade;
        return puff;
      });
      return { head: { x: shot.x, y: shot.y, radius: HEAD.radius, alpha: HEAD.alpha }, tail };
    });
}

/** Adds a layer to `scene` that draws every comet in flight, in front of the course objects and under the racers. */
export function createCometView(scene: Phaser.Scene): ThemeLayer {
  const graphics = scene.add.graphics().setDepth(Layer.objects + 0.5);
  return {
    sync(current) {
      graphics.clear();
      for (const mark of cometMarks(current)) drawComet(graphics, mark);
    },
  };
}

/** The tail from its far end in, so nearer puffs sit on top, then the glow and the core of the head. */
function drawComet(graphics: Phaser.GameObjects.Graphics, mark: CometMark): void {
  for (const puff of [...mark.tail].reverse()) {
    graphics.fillStyle(TAIL.colour, puff.alpha);
    graphics.fillCircle(puff.x, puff.y, puff.radius);
  }
  const { head } = mark;
  graphics.fillStyle(HEAD.glowColour, HEAD.glowAlpha);
  graphics.fillCircle(head.x, head.y, HEAD.glowRadius);
  graphics.fillStyle(HEAD.colour, head.alpha);
  graphics.fillCircle(head.x, head.y, head.radius);
}
