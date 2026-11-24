/** Ocean whirlpools: a broken foam rim and streaks winding into the eye. */
import type Phaser from 'phaser';
import { type Level, TILE, type World } from '../../../logic/types.ts';
import type { ThemeLayer } from '../../themes/types.ts';
import { Layer } from '../layers.ts';

interface WhirlpoolArt {
  streak: number;
  crest: number;
  foam: number;
}

interface WhirlpoolMark {
  x: number;
  y: number;
  radius: number;
  spin: 1 | -1;
  angle: number;
}

const TURN_TICKS = 240;
const TURN = 2 * Math.PI;
const DEPTH = Layer.tiles - 0.1;

/** The geometry and pose of the pools on this logic tick. */
export function whirlpoolMarks(level: Level, tick: number, reducedMotion: boolean): WhirlpoolMark[] {
  const phase = reducedMotion ? 0 : ((tick % TURN_TICKS) / TURN_TICKS) * TURN;
  return level.whirlpools.map(({ col, row, radius, spin }) => ({
    x: (col + 0.5) * TILE,
    y: (row + 0.5) * TILE,
    radius: radius * TILE,
    spin,
    angle: phase === 0 ? 0 : phase * spin,
  }));
}

/** Draws behind tiles so an island can cut through the pool. Only the spiral turns. */
export function createWhirlpoolView(
  scene: Phaser.Scene,
  world: World,
  art: WhirlpoolArt,
  reducedMotion: boolean,
): ThemeLayer {
  const spirals = whirlpoolMarks(world.level, world.tick, reducedMotion).map((mark) => {
    const rim = scene.add.graphics({ x: mark.x, y: mark.y }).setDepth(DEPTH);
    drawRim(rim, mark.radius, art);
    const spiral = scene.add.graphics({ x: mark.x, y: mark.y }).setDepth(DEPTH).setRotation(mark.angle);
    drawSpiral(spiral, mark, art);
    return spiral;
  });
  return {
    sync(current) {
      if (spirals.length === 0 || reducedMotion) return;
      whirlpoolMarks(current.level, current.tick, reducedMotion).forEach(({ angle }, index) => {
        spirals[index]?.setRotation(angle);
      });
    },
  };
}

function drawRim(gfx: Phaser.GameObjects.Graphics, radius: number, art: WhirlpoolArt): void {
  gfx.lineStyle(1, art.streak, 0.45).strokeCircle(0, 0, radius);
  gfx.lineStyle(1, art.foam, 0.65);
  for (let i = 0; i < 18; i++) {
    const from = (i / 18) * TURN;
    gfx
      .beginPath()
      .arc(0, 0, radius, from, from + (i % 3 === 0 ? 0.19 : 0.1))
      .strokePath();
  }
}

function drawSpiral(gfx: Phaser.GameObjects.Graphics, mark: WhirlpoolMark, art: WhirlpoolArt): void {
  for (let arm = 0; arm < 3; arm++) {
    for (let streak = 0; streak < 3; streak++) {
      gfx.lineStyle(streak === 1 ? 2 : 1, streak === 0 ? art.streak : art.crest, 0.63).beginPath();
      for (let i = 0; i <= 12; i++) {
        const along = (streak + (i / 12) * 0.86) / 3;
        const angle = (arm / 3) * TURN + mark.spin * along * 2.4;
        const radius = mark.radius * (0.89 - 0.74 * along);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) gfx.moveTo(x, y);
        else gfx.lineTo(x, y);
      }
      gfx.strokePath();
    }
  }
}
