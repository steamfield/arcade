/**
 * Cloudreach's Meteor shots (`world.shots` of style 'meteor') on the race screen, a sky theme extra
 * layer: through the warning a dark shadow on the ground under the mark, growing as the fall nears,
 * then the meteor itself falling with a fiery trail while its shadow keeps growing under it.
 * Drawn from each shot's fields alone (`powerups/cannonball/meteor.ts` says what they mean), so it
 * redraws the same on any frame. Code-drawn global art.
 */
import { TICK_DT } from '@arcade/core';
import type Phaser from 'phaser';
import { groundBelow, METEOR_TUNING } from '../../logic/powerups/cannonball/meteor.ts';
import { type Shot, TILE } from '../../logic/types.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** How one meteor shot looks on one frame. */
export interface MeteorLook {
  /** The shadow's centre on the ground, px, and its half width. */
  shadow: { x: number; y: number; radius: number; alpha: number };
  /** The falling meteor's centre and the length of its trail, px; null while it only warns. */
  meteor: { x: number; y: number; trailPx: number } | null;
}

/** The shadow's half width when the warning starts and just before the meteor lands, px. */
const SHADOW_MIN_RADIUS = 5;
const SHADOW_MAX_RADIUS = 1.5 * TILE;
const SHADOW_MIN_ALPHA = 0.25;
const SHADOW_MAX_ALPHA = 0.6;
/** A falling meteor's shadow is full size this far above the ground, px. */
const SHADOW_FULL_HEIGHT_PX = 6 * TILE;
const SHADOW_COLOUR = 0x1a1030;
const METEOR_RADIUS = 7;
const METEOR_COLOUR = 0x6a4030;
const METEOR_GLOW_COLOUR = 0xffb040;
const TRAIL_COLOUR = 0xff7020;
/** The trail is this many ticks of fall long. */
const TRAIL_TICKS = 5;

/**
 * How `shot` looks with its ground at `groundY` (px, the top of the tile it will land on). Warning,
 * the shadow grows from small and faint to full size as `phase` runs down. Falling, it keeps growing
 * until the meteor is `SHADOW_FULL_HEIGHT_PX` above the ground.
 */
export function meteorLook(shot: Shot, groundY: number): MeteorLook {
  const falling = shot.phase === 0;
  const warned = 1 - shot.phase / METEOR_TUNING.warnTicks;
  const closeness = falling ? 1 - Math.max(0, groundY - shot.y) / SHADOW_FULL_HEIGHT_PX : 0;
  const size = falling ? 0.5 + 0.5 * Math.max(0, closeness) : 0.5 * warned;
  return {
    shadow: {
      x: shot.x,
      y: groundY,
      radius: SHADOW_MIN_RADIUS + (SHADOW_MAX_RADIUS - SHADOW_MIN_RADIUS) * size,
      alpha: SHADOW_MIN_ALPHA + (SHADOW_MAX_ALPHA - SHADOW_MIN_ALPHA) * size,
    },
    meteor: falling ? { x: shot.x, y: shot.y, trailPx: METEOR_TUNING.fallSpeed * TICK_DT * TRAIL_TICKS } : null,
  };
}

/** Adds the meteor layer to `scene` as a theme layer; it draws nothing while no meteor is in the air. */
export function createMeteorView(scene: Phaser.Scene): ThemeLayer {
  const shadows = scene.add.graphics().setDepth(Layer.water + 0.7);
  const meteors = scene.add.graphics().setDepth(Layer.player + 0.4);
  return {
    sync(current) {
      shadows.clear();
      meteors.clear();
      for (const shot of current.shots) {
        if (shot.style !== 'meteor') continue;
        const look = meteorLook(shot, groundBelow(current, shot.x, shot.y).y);
        drawShadow(shadows, look.shadow);
        if (look.meteor) drawMeteor(meteors, look.meteor);
      }
    },
  };
}

/** A flat ellipse resting on the ground line. */
function drawShadow(graphics: Phaser.GameObjects.Graphics, shadow: MeteorLook['shadow']): void {
  graphics.fillStyle(SHADOW_COLOUR, shadow.alpha);
  graphics.fillEllipse(shadow.x, shadow.y - 2, shadow.radius * 2, shadow.radius * 0.6);
}

/** The rock with a glowing rim and a tapering trail streaming up behind it. */
function drawMeteor(graphics: Phaser.GameObjects.Graphics, meteor: NonNullable<MeteorLook['meteor']>): void {
  const { x, y, trailPx } = meteor;
  graphics.fillStyle(TRAIL_COLOUR, 0.55);
  graphics.fillTriangle(x - METEOR_RADIUS, y, x + METEOR_RADIUS, y, x, y - trailPx);
  graphics.fillStyle(METEOR_GLOW_COLOUR, 0.9);
  graphics.fillCircle(x, y, METEOR_RADIUS + 2);
  graphics.fillStyle(METEOR_COLOUR, 1);
  graphics.fillCircle(x, y, METEOR_RADIUS);
}
