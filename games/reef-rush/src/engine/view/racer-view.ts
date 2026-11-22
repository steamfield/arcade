/**
 * One racer's sprite, synced from logic state: whole-pixel position, a flip for
 * facing, a two-frame swim stroke that quickens with speed, a squash-then-stretch
 * when a kick fires, a flicker while invulnerable (3 Hz, the WCAG ceiling) and,
 * for the player, a one-off white flash on gaining a place. All timing is counted
 * in logic ticks so captures repeat. Under reduced motion the sprite holds its
 * shape, shows invulnerability as a steady see-through look and skips the flash;
 * the kick puff and place-up sparkles in `fx/` still carry those moments.
 */
import type { Stamped } from '@arcade/core';
import Phaser from 'phaser';
import type { Racer, RacerId } from '../../logic/types.ts';
import { Frame, Tex, type TexKey } from '../art/keys.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';

/** One racer's sprite, kept in step with its logic state. */
export interface RacerView {
  /**
   * Starts the kick squash on this racer's `racer.kicked` and, for the player, the flash on a
   * `player.place` that gains a place, each from the tick stamped on the event.
   */
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
  /**
   * Moves the sprite to `racer`'s current state.
   *
   * @param tick The world tick, which drives the stroke, squash, flicker and flash timing.
   */
  sync(racer: Racer, tick: number): void;
}

const TEXTURE: Record<RacerId, TexKey> = { player: Tex.player, tess: Tex.tess, squib: Tex.squib, bo: Tex.bo };

/** Below this speed (px/s) a racer is drifting; below SPRINT_SPEED it is cruising. */
const DRIFT_SPEED = 15;
const SPRINT_SPEED = 90;

/** A kick squashes the sprite along the axis it kicked on for SQUASH_TICKS, then stretches it and eases back by KICK_TICKS. */
const SQUASH_TICKS = 3;
const KICK_TICKS = 11;
const SQUASH_AMOUNT = 0.2;
const STRETCH_AMOUNT = 0.25;

/** One on-off flicker cycle while invulnerable: 20 ticks is 3 per second at 60 ticks per second. */
const FLICKER_TICKS = 20;
const FLICKER_DIM_ALPHA = 0.25;
/** Reduced motion shows invulnerability as this steady alpha instead of flickering. */
const STEADY_INVULNERABLE_ALPHA = 0.55;

/** The place-up flash fills the sprite white for this many ticks, once. */
const PLACE_FLASH_TICKS = 4;
const FLASH_COLOUR = 0xffffff;

/**
 * Adds `racer`'s sprite to `scene`. The player draws above the rivals.
 *
 * @param reducedMotion Drops the squash and stretch and the place-up flash, and holds the
 *   invulnerability look steady instead of flickering. Defaults to full motion.
 */
export function createRacerView(scene: Phaser.Scene, racer: Racer, reducedMotion = false): RacerView {
  const sprite = scene.add
    .sprite(0, 0, TEXTURE[racer.id], Frame.a)
    .setDepth(racer.id === 'player' ? Layer.player : Layer.racers);
  let kickedAt = Number.NEGATIVE_INFINITY;
  // Kicks fire along the input, so the squash follows whichever axis the racer is moving on.
  let kickVertical = false;
  let kickAxisFor = Number.NaN;
  let place = racer.place;
  let placeGainedAt = Number.NEGATIVE_INFINITY;

  return {
    onEvents(events) {
      for (const event of events) {
        if (event.type === 'racer.kicked' && event.id === racer.id) kickedAt = event.tick;
        if (event.type === 'player.place' && racer.id === 'player') {
          if (event.place < place) placeGainedAt = event.tick;
          place = event.place;
        }
      }
    },
    sync(current, tick) {
      const { body } = current;
      if (kickAxisFor !== kickedAt) {
        kickAxisFor = kickedAt;
        kickVertical = Math.abs(body.vy) > Math.abs(body.vx);
      }
      sprite.setPosition(Math.round(body.x + body.w / 2), Math.round(body.y + body.h / 2));
      sprite.setFlipX(current.facing < 0);
      sprite.setFrame(strokeFrame(Math.hypot(body.vx, body.vy), tick));
      const stretch = reducedMotion ? 0 : kickStretchAt(tick - kickedAt);
      if (kickVertical) sprite.setScale(1 - stretch, 1 + stretch);
      else sprite.setScale(1 + stretch, 1 - stretch);
      sprite.setAlpha(invulnerableAlpha(current.status.invulnerable, reducedMotion));
      const flashing = !reducedMotion && current.id === 'player' && tick - placeGainedAt < PLACE_FLASH_TICKS;
      if (flashing) sprite.setTint(FLASH_COLOUR).setTintMode(Phaser.TintModes.FILL);
      else sprite.clearTint();
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

/**
 * Stretch along the kick's axis `ticksSinceKick` after a kick (the other axis moves the other way):
 * negative (squashed short and tall, gathering) for SQUASH_TICKS, then a stretch long and thin
 * that eases back to nothing by KICK_TICKS.
 */
function kickStretchAt(ticksSinceKick: number): number {
  if (ticksSinceKick < 0 || ticksSinceKick >= KICK_TICKS) return 0;
  if (ticksSinceKick < SQUASH_TICKS) return -SQUASH_AMOUNT;
  return STRETCH_AMOUNT * (1 - (ticksSinceKick - SQUASH_TICKS) / (KICK_TICKS - SQUASH_TICKS));
}

/** Sprite alpha for `invulnerableTicks` left: dim for half of each flicker cycle, or steadily see-through. */
function invulnerableAlpha(invulnerableTicks: number, reducedMotion: boolean): number {
  if (invulnerableTicks <= 0) return 1;
  if (reducedMotion) return STEADY_INVULNERABLE_ALPHA;
  return invulnerableTicks % FLICKER_TICKS < FLICKER_TICKS / 2 ? FLICKER_DIM_ALPHA : 1;
}
