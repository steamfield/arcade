/**
 * One racer's sprite, synced from logic state: whole-pixel position, a flip for
 * facing, a two-frame swim stroke that quickens with speed, and a short squash
 * when a kick fires. All timing is counted in logic ticks so captures repeat.
 */
import type Phaser from 'phaser';
import type { Racer, RacerId } from '../../logic/types.ts';
import { Frame, Tex, type TexKey } from '../art/keys.ts';
import { Layer } from './layers.ts';

/** One racer's sprite, kept in step with its logic state. */
export interface RacerView {
  /**
   * Moves the sprite to `racer`'s current state.
   *
   * @param tick The world tick, which drives the stroke and squash timing.
   */
  sync(racer: Racer, tick: number): void;
}

const TEXTURE: Record<RacerId, TexKey> = { player: Tex.player, tess: Tex.tess, squib: Tex.squib, bo: Tex.bo };

/** Below this speed (px/s) a racer is drifting; below SPRINT_SPEED it is cruising. */
const DRIFT_SPEED = 15;
const SPRINT_SPEED = 90;

const SQUASH_TICKS = 8;
/** Widest squash at the moment of a kick: 30% wider and 30% shorter, easing back to 1. */
const SQUASH_AMOUNT = 0.3;

/** Adds `racer`'s sprite to `scene`. The player draws above the rivals. */
export function createRacerView(scene: Phaser.Scene, racer: Racer): RacerView {
  const sprite = scene.add
    .sprite(0, 0, TEXTURE[racer.id], Frame.a)
    .setDepth(racer.id === 'player' ? Layer.player : Layer.racers);
  let lastCooldown = racer.kickCooldown;
  let kickedAt = Number.NEGATIVE_INFINITY;

  return {
    sync(current, tick) {
      // A cooldown that went up since the last sync means a kick fired in between.
      if (current.kickCooldown > lastCooldown) kickedAt = tick;
      lastCooldown = current.kickCooldown;

      const { body } = current;
      sprite.setPosition(Math.round(body.x + body.w / 2), Math.round(body.y + body.h / 2));
      sprite.setFlipX(current.facing < 0);
      sprite.setFrame(strokeFrame(Math.hypot(body.vx, body.vy), tick));
      const squash = squashAt(tick - kickedAt);
      sprite.setScale(1 + squash, 1 - squash);
    },
  };
}

function strokeFrame(speed: number, tick: number): string {
  return Math.floor(tick / ticksPerStrokeFrame(speed)) % 2 === 0 ? Frame.a : Frame.b;
}

function ticksPerStrokeFrame(speed: number): number {
  if (speed < DRIFT_SPEED) return 30;
  if (speed < SPRINT_SPEED) return 14;
  return 7;
}

/** Squash amount `ticksSinceKick` after a kick: full at 0, gone by SQUASH_TICKS. */
function squashAt(ticksSinceKick: number): number {
  if (ticksSinceKick < 0 || ticksSinceKick >= SQUASH_TICKS) return 0;
  return SQUASH_AMOUNT * (1 - ticksSinceKick / SQUASH_TICKS);
}
