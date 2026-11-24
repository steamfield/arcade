/** Paired, tick-driven rings in Farside, with an inward spiral wherever a racer can enter. */
import type Phaser from 'phaser';
import { WORMHOLE } from '../../../logic/setpieces/wormholes.ts';
import { TILE, type World, type WormholeDef } from '../../../logic/types.ts';
import { WormholePalette } from '../../themes/space/palettes.ts';
import type { ThemeLayer } from '../../themes/types.ts';
import { Layer } from '../layers.ts';

const TURN_TICKS = 150;
const TAU = 2 * Math.PI;

/** The geometry, colour and orientation of each mouth this tick. */
export function wormholeMarks(wormholes: readonly WormholeDef[], tick: number, reducedMotion: boolean) {
  const angle = ringAngle(tick, reducedMotion);
  const usedColours = new Set<number>();
  return wormholes.flatMap(({ a, b, oneWay }, index) => {
    const colour = rimColour(index, usedColours);
    usedColours.add(colour);
    return [
      { x: (a[0] + 0.5) * TILE, y: (a[1] + 0.5) * TILE, entry: true, colour, angle },
      { x: (b[0] + 0.5) * TILE, y: (b[1] + 0.5) * TILE, entry: !oneWay, colour, angle },
    ];
  });
}

/** Extend the space palette with blends between its rims on courses with more pairs. */
function rimColour(index: number, used: ReadonlySet<number>): number {
  const { rims } = WormholePalette;
  const base = rims[index % rims.length] ?? rims[0];
  const pass = Math.floor(index / rims.length);
  if (pass === 0) return base;
  const next = rims[(index + 1) % rims.length] ?? rims[0];
  const mix = pass / (pass + 1);
  let colour = 0;
  for (const shift of [16, 8, 0]) {
    const from = (base >> shift) & 0xff;
    const to = (next >> shift) & 0xff;
    colour |= Math.round(from + (to - from) * mix) << shift;
  }
  // Rounding very close blends to the same RGB should never give two pairs the same rim.
  while (used.has(colour)) colour = (colour + 1) & 0xffffff;
  return colour;
}

/** Draw each mouth once, then rotate it from the world clock. */
export function createWormholeView(scene: Phaser.Scene, world: World, reducedMotion: boolean): ThemeLayer {
  const rings = wormholeMarks(world.level.wormholes, world.tick, reducedMotion).map((mark) => {
    const graphic = scene.add.graphics({ x: mark.x, y: mark.y }).setDepth(Layer.objects);
    drawRing(graphic, mark.colour, mark.entry);
    return graphic.setRotation(mark.angle);
  });
  return {
    sync(current) {
      const angle = ringAngle(current.tick, reducedMotion);
      for (const ring of rings) ring.setRotation(angle);
    },
  };
}

function ringAngle(tick: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : ((tick % TURN_TICKS) * TAU) / TURN_TICKS;
}

function drawRing(graphics: Phaser.GameObjects.Graphics, colour: number, entry: boolean): void {
  const radius = WORMHOLE.ringRadius;
  graphics.fillStyle(WormholePalette.centre, 0.85).fillCircle(0, 0, radius);
  graphics.lineStyle(1, colour, 0.65).strokeCircle(0, 0, radius);
  graphics.fillStyle(colour, 1).fillCircle(radius, 0, 1.5).fillCircle(-radius, 0, 1.5);
  if (!entry) return;

  graphics.lineStyle(1.5, colour, 0.9);
  for (const offset of [0, Math.PI]) {
    graphics.beginPath().moveTo(Math.cos(offset) * radius, Math.sin(offset) * radius);
    for (let i = 1; i <= 12; i++) {
      const along = i / 12;
      const angle = offset + Math.PI * along;
      const r = radius * (1 - 0.82 * along);
      graphics.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    graphics.strokePath();
  }
}
