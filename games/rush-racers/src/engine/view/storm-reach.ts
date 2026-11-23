/**
 * How far a storm zone (`level.lightning`) is from what the player sees and hears. A zone spans
 * the level's full height, so only horizontal distance counts. The lightning view, the event
 * effects and the audio all measure zones here, so a strike's flash, shake and sound agree on
 * what "on screen" and "nearby" mean.
 */
import type Phaser from 'phaser';
import { type LightningZone, TILE, type World } from '../../logic/types.ts';
import { localOf } from '../local-racer.ts';

/** The part of the world the camera shows this frame, in world px. */
export interface CameraSpan {
  x: number;
  y: number;
  width: number;
}

/** Where a zone sits across from the camera's view: on it, within one view width of an edge, or farther. */
export type ZoneSide = 'on screen' | 'left' | 'right' | 'far';

/**
 * What `camera` shows this frame, read from its scroll rather than `worldView`: the race camera
 * moves during the scene's update, and `worldView` catches up only when the frame renders.
 */
export function cameraSpan(camera: Phaser.Cameras.Scene2D.Camera): CameraSpan {
  return { x: camera.scrollX, y: camera.scrollY, width: camera.width };
}

/** How far across world x `x` is from `zone`'s columns, px; 0 inside them. */
function zoneAcrossFrom(zone: LightningZone, x: number): number {
  const left = zone.cols[0] * TILE;
  const right = (zone.cols[1] + 1) * TILE;
  return Math.max(left - x, x - right, 0);
}

/** Where `zone`'s columns sit across from `view`: on it, within one view width of an edge, or farther. */
export function zoneSide(zone: LightningZone, view: Pick<CameraSpan, 'x' | 'width'>): ZoneSide {
  const left = zone.cols[0] * TILE;
  const right = (zone.cols[1] + 1) * TILE;
  const viewRight = view.x + view.width;
  if (right > view.x && left < viewRight) return 'on screen';
  if (right <= view.x) return view.x - right <= view.width ? 'left' : 'far';
  return left - viewRight <= view.width ? 'right' : 'far';
}

/**
 * Whether storm zone `zone` in `world` is within `reachPx` across of the local racer, whom the
 * camera follows. False for an index the level has no zone for.
 */
export function stormWithinReach(world: World, zone: number, reachPx: number): boolean {
  const storm = world.level.lightning[zone];
  if (!storm) return false;
  const local = localOf(world);
  return zoneAcrossFrom(storm, local.body.x + local.body.w / 2) <= reachPx;
}
