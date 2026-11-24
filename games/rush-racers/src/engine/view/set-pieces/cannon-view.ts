/** Cloudreach's cloud cannons, drawn from their ride counters on the current world tick. */
import type Phaser from 'phaser';
import { tileCentre } from '../../../logic/ai/steer.ts';
import { moveRulesFor } from '../../../logic/race/move.ts';
import { centreOf } from '../../../logic/racers.ts';
import { CANNON, traceCannonShot } from '../../../logic/setpieces/cannons.ts';
import type { Vec, World } from '../../../logic/types.ts';
import { SkyTerrainPalette } from '../../themes/sky/palettes.ts';
import type { ThemeLayer } from '../../themes/types.ts';
import { Layer } from '../layers.ts';

const [OUTLINE, SHADE, CLOUD, WHITE] = SkyTerrainPalette.puffCloud;
const MUZZLE = 9;
const PUFF_TICKS = 12;

/** Swell during the hold and let the launch puff dissipate over the first few flight ticks. */
export function cannonLook(
  world: World,
  cannon: number,
  reducedMotion: boolean,
): {
  swell: number;
  puff: number;
} {
  const def = world.level.cannons[cannon];
  let swell = 1;
  let puff = 0;
  if (!def) return { swell, puff };
  let shortFlight: number | undefined;
  for (const ride of world.cannonRides) {
    if (ride.cannon !== cannon) continue;
    if (ride.held > 0) {
      const elapsed = CANNON.holdTicks - ride.held;
      swell = Math.max(swell, reducedMotion ? 1.15 : 1.08 + (elapsed / CANNON.holdTicks) * 0.24);
    }
    if (reducedMotion) continue;
    if (ride.flight > 0) {
      const elapsed = def.flightTicks - ride.flight - 1;
      puff = Math.max(puff, 1 - elapsed / PUFF_TICKS);
    } else if (ride.reload > CANNON.reloadTicks - PUFF_TICKS) {
      // A short or blocked shot may already be reloading when the frame first sees it.
      shortFlight ??= traceCannonShot(def, world.level, world.broken, moveRulesFor(world), PUFF_TICKS + 1).ticks;
      const elapsed = shortFlight - 1 + (CANNON.reloadTicks - ride.reload);
      puff = Math.max(puff, 1 - elapsed / PUFF_TICKS);
    }
  }
  return { swell, puff };
}

/** One graphics layer behind the racers, so the loaded racer stays visible. */
export function createCannonView(scene: Phaser.Scene, levelWorld: World, reducedMotion: boolean): ThemeLayer {
  const barrels = levelWorld.level.cannons.map(({ col, row, dir }) => ({
    centre: tileCentre({ x: col, y: row }),
    angle: Math.atan2(dir[1], dir[0]),
  }));
  if (barrels.length === 0) return { sync() {} };
  const graphics = scene.add.graphics().setDepth(Layer.objects + 0.3);
  return {
    sync(world) {
      graphics.clear();
      for (const ride of world.cannonRides) {
        if (ride.flight === 0) continue;
        const barrel = barrels[ride.cannon];
        const racer = world.racers.find((racer) => racer.id === ride.racer);
        if (barrel && racer && !racer.finished) drawStreak(graphics, centreOf(racer), barrel.angle, reducedMotion);
      }
      barrels.forEach(({ centre, angle }, index) => {
        const { swell, puff } = cannonLook(world, index, reducedMotion);
        graphics.save();
        graphics.translateCanvas(centre.x, centre.y);
        graphics.rotateCanvas(angle);
        graphics.scaleCanvas(swell, swell);
        drawBarrel(graphics);
        if (puff > 0) drawPuff(graphics, puff);
        graphics.restore();
      });
    },
  };
}

/** A scalloped cylinder with a shaded mouth broadside to its aim. */
function drawBarrel(graphics: Phaser.GameObjects.Graphics): void {
  graphics.fillStyle(OUTLINE);
  graphics.fillEllipse(-3, 0, 29, 24);
  graphics.fillStyle(SHADE);
  graphics.fillEllipse(-3, 0, 26, 21);
  graphics.fillStyle(CLOUD);
  graphics.fillCircle(-11, -2, 6);
  graphics.fillCircle(-6, -6, 7);
  graphics.fillCircle(0, -4, 8);
  graphics.fillCircle(-9, 5, 5);
  graphics.fillCircle(-2, 5, 7);
  graphics.fillStyle(WHITE);
  graphics.fillEllipse(MUZZLE, 0, 12, 25);
  graphics.fillStyle(OUTLINE);
  graphics.fillEllipse(MUZZLE + 1, 0, 7, 18);
  graphics.fillStyle(SHADE);
  graphics.fillEllipse(MUZZLE + 1, 2, 4, 10);
}

function drawPuff(graphics: Phaser.GameObjects.Graphics, strength: number): void {
  const travel = (1 - strength) * 20;
  graphics.fillStyle(CLOUD, strength * 0.8);
  graphics.fillCircle(MUZZLE + 6 + travel, 0, 3 + travel / 4);
  graphics.fillCircle(MUZZLE + 5 + travel, -5 - travel / 3, 3);
  graphics.fillCircle(MUZZLE + 4 + travel, 5 + travel / 3, 2);
}

function drawStreak(graphics: Phaser.GameObjects.Graphics, centre: Vec, angle: number, reducedMotion: boolean): void {
  graphics.save();
  graphics.translateCanvas(centre.x, centre.y);
  graphics.rotateCanvas(angle);
  graphics.lineStyle(2, WHITE, reducedMotion ? 0.45 : 0.8);
  graphics.lineBetween(reducedMotion ? -18 : -28, 0, -7, 0);
  if (!reducedMotion) {
    graphics.lineStyle(1, CLOUD, 0.55);
    graphics.lineBetween(-23, -4, -9, -4);
    graphics.lineBetween(-18, 4, -8, 4);
  }
  graphics.restore();
}
