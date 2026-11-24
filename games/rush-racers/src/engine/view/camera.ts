/**
 * A race camera that follows one body: a central deadzone so small moves don't
 * scroll, a lookahead along the body's velocity so you see where you're going,
 * exponential smoothing that behaves the same at any frame rate, and whole-pixel
 * scroll kept inside the level.
 */
import type Phaser from 'phaser';
import { type Body, type Level, TILE, type Vec } from '../../logic/types.ts';

/** A camera following one body; `update` moves it on by logic time. */
export interface CameraRig {
  /**
   * Eases the camera toward the body.
   *
   * @param seconds Logic time since the last update. Zero leaves the camera where it is.
   */
  update(seconds: number): void;
}

/** Half-size of the box around screen centre the target can move in without scrolling, in px. */
const DEADZONE = { x: 24, y: 16 } as const;
/** How far ahead of the body to look, as seconds of its current velocity, capped per axis in px. */
const LOOKAHEAD_SECONDS = 0.45;
const LOOKAHEAD_MAX = { x: 56, y: 28 } as const;
/** Fraction of the remaining distance closed per second is 1 - e^(-rate). */
const SMOOTHING_RATE = 6;

/**
 * Points `camera` at `body` now and returns the rig that keeps following it. `body` is read live each update.
 *
 * @param headroom Px the camera may show above the level's top edge, so a HUD row of that height covers
 *   sky beyond the level rather than the top rows racers move in. 0 keeps the view inside the level.
 */
export function followRacer(camera: Phaser.Cameras.Scene2D.Camera, body: Body, level: Level, headroom = 0): CameraRig {
  const half = { x: camera.width / 2, y: camera.height / 2 };
  const least = { x: half.x, y: half.y - headroom };
  const limit = { x: level.width * TILE - half.x, y: level.height * TILE - half.y };
  const centre = clampToLevel(lookTarget(body), least, limit);
  applyScroll(camera, centre, half);

  return {
    update(seconds) {
      if (seconds <= 0) return;
      const wanted = clampToLevel(outOfDeadzone(centre, lookTarget(body)), least, limit);
      const blend = 1 - Math.exp(-SMOOTHING_RATE * seconds);
      centre.x += (wanted.x - centre.x) * blend;
      centre.y += (wanted.y - centre.y) * blend;
      applyScroll(camera, centre, half);
    },
  };
}

/** The body's centre pushed ahead along its velocity. */
function lookTarget(body: Body): Vec {
  return {
    x: body.x + body.w / 2 + clamp(body.vx * LOOKAHEAD_SECONDS, -LOOKAHEAD_MAX.x, LOOKAHEAD_MAX.x),
    y: body.y + body.h / 2 + clamp(body.vy * LOOKAHEAD_SECONDS, -LOOKAHEAD_MAX.y, LOOKAHEAD_MAX.y),
  };
}

/** Where the camera centre must be so `target` sits just inside the deadzone; unchanged when it already does. */
function outOfDeadzone(centre: Vec, target: Vec) {
  return {
    x: clamp(centre.x, target.x - DEADZONE.x, target.x + DEADZONE.x),
    y: clamp(centre.y, target.y - DEADZONE.y, target.y + DEADZONE.y),
  };
}

function clampToLevel(point: Vec, least: Vec, limit: Vec) {
  // A level smaller than the screen centres on its own middle instead of clamping past itself.
  return {
    x: limit.x < least.x ? (limit.x + least.x) / 2 : clamp(point.x, least.x, limit.x),
    y: limit.y < least.y ? (limit.y + least.y) / 2 : clamp(point.y, least.y, limit.y),
  };
}

function applyScroll(camera: Phaser.Cameras.Scene2D.Camera, centre: Vec, half: Vec) {
  camera.setScroll(Math.round(centre.x - half.x), Math.round(centre.y - half.y));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
