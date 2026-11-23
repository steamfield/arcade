/**
 * Applies a whole-pixel shake offset on top of the race camera's own scroll. The camera rig
 * (`view/camera.ts`) writes an absolute, whole-pixel scroll on every frame where the world
 * tick moved on and leaves it alone otherwise, and the race scene syncs the rig before the
 * effects. So on a new tick the scroll is the rig's clean value, and on a repeated tick it
 * still holds the offset this nudge added last frame, which is taken back off first. The
 * scroll stays whole pixels either way.
 */
import type Phaser from 'phaser';

/** Shifts one camera by a shake offset each rendered frame. */
export interface CameraNudge {
  /** Moves the camera to the rig's scroll for `tick` plus (`dx`, `dy`) whole px. */
  apply(tick: number, dx: number, dy: number): void;
}

/** Wraps `camera`, which must be the one the race camera rig drives. */
export function createCameraNudge(camera: Phaser.Cameras.Scene2D.Camera): CameraNudge {
  let lastTick = Number.NaN;
  let appliedX = 0;
  let appliedY = 0;

  return {
    apply(tick, dx, dy) {
      if (dx === appliedX && dy === appliedY && tick === lastTick) return;
      const sameTick = tick === lastTick;
      const baseX = sameTick ? camera.scrollX - appliedX : camera.scrollX;
      const baseY = sameTick ? camera.scrollY - appliedY : camera.scrollY;
      camera.setScroll(baseX + dx, baseY + dy);
      lastTick = tick;
      appliedX = dx;
      appliedY = dy;
    },
  };
}
