/**
 * One racer's sprite, synced from logic state: whole-pixel position, a flip for
 * facing, a two-frame swim stroke that quickens with speed, a squash-then-stretch
 * when a kick fires, a squash against the wall on a bounce, a stretch tall on a jump, a squat on
 * landing (read from the racer's body between ticks, see `fx/movement-sense.ts`), a flicker while invulnerable (3 Hz, the WCAG ceiling) and,
 * for the local racer (the slot the screen follows), a one-off white flash on gaining a place. A
 * racer that has fallen out of the level (`status.fallen > 0`) is hidden until it respawns. All timing is counted
 * in logic ticks so captures repeat. Under reduced motion the sprite holds its
 * shape, shows invulnerability as a steady see-through look and skips the flash;
 * the kick puff and place-up sparkles in `fx/` still carry those moments.
 */
import type { Stamped } from '@arcade/core';
import Phaser from 'phaser';
import type { Racer, RacerId } from '../../logic/types.ts';
import { Frame } from '../art/keys.ts';
import { hasLanded, isMovingFreely } from '../fx/movement-sense.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { CastSkin } from '../worlds/cast-skin.ts';
import { Layer } from './layers.ts';
import { createRacerMoments } from './racer-moments.ts';

/** One racer's sprite, kept in step with its logic state. */
export interface RacerView {
  /**
   * Starts the kick squash on this racer's `racer.kicked`, the bounce squash on its `racer.rebounded`,
   * the jump stretch on its `racer.jumped`, the landing squat when its body came to rest on the ground
   * since the last tick and, for the local racer, the flash on its `player.place` that gains a place,
   * from world tick `tick` (the drain's world tick). Called once per world tick.
   */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /**
   * Moves the sprite to `racer`'s current state.
   *
   * @param tick The world tick, which drives the stroke, squash, flicker and flash timing.
   */
  sync(racer: Racer, tick: number): void;
}

/** Below this speed (px/s) a racer is drifting; below SPRINT_SPEED it is cruising. */
const DRIFT_SPEED = 15;
const SPRINT_SPEED = 90;

/** One on-off flicker cycle while invulnerable: 20 ticks is 3 per second at 60 ticks per second. */
const FLICKER_TICKS = 20;
const FLICKER_DIM_ALPHA = 0.25;
/** Reduced motion shows invulnerability as this steady alpha instead of flickering. */
const STEADY_INVULNERABLE_ALPHA = 0.55;

/** The place-up flash fills the sprite with this colour. */
const FLASH_COLOUR = 0xffffff;

/**
 * Adds `racer`'s sprite to `scene`, drawn as its character in `cast`, the world's cast skin. The local racer draws above the others.
 *
 * @param reducedMotion Drops the squash and stretch and the place-up flash, and holds the
 *   invulnerability look steady instead of flickering.
 * @param local The slot the screen follows.
 */
export function createRacerView(
  scene: Phaser.Scene,
  racer: Racer,
  reducedMotion: boolean,
  cast: CastSkin,
  local: RacerId,
): RacerView {
  const sprite = scene.add
    .sprite(0, 0, cast.racers[racer.character], Frame.a)
    .setDepth(racer.id === local ? Layer.player : Layer.racers);
  const moments = createRacerMoments(racer.id, racer.place, local);
  let kickedAt = Number.NEGATIVE_INFINITY;
  // Kicks fire along the input, so the squash follows whichever axis the racer is moving on.
  let kickVertical = false;
  let kickAxisFor = Number.NaN;
  let lastVy = racer.body.vy;

  return {
    onEvents(events, tick) {
      moments.onEvents(events, tick);
      if (isMovingFreely(racer) && hasLanded(lastVy, racer.body.vy)) moments.onLanded(tick);
      lastVy = racer.body.vy;
      for (const event of events) if (event.type === 'racer.kicked' && event.id === racer.id) kickedAt = tick;
    },
    sync(current, tick) {
      const { body } = current;
      if (kickAxisFor !== kickedAt) {
        kickAxisFor = kickedAt;
        kickVertical = Math.abs(body.vy) > Math.abs(body.vx);
      }
      sprite.setPosition(Math.round(body.x + body.w / 2), Math.round(body.y + body.h / 2));
      sprite.setVisible(current.status.fallen === 0);
      sprite.setFlipX(current.facing < 0);
      sprite.setFrame(strokeFrame(Math.hypot(body.vx, body.vy), tick));
      const { stretch, axis, flashing } = moments.look(tick, reducedMotion);
      // A bounce names its own axis; a kick's follows the way the racer was moving when it fired.
      const vertical = axis === null ? kickVertical : axis === 'y';
      if (vertical) sprite.setScale(1 - stretch, 1 + stretch);
      else sprite.setScale(1 + stretch, 1 - stretch);
      sprite.setAlpha(invulnerableAlpha(current.status.invulnerable, reducedMotion));
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

/** Sprite alpha for `invulnerableTicks` left: dim for half of each flicker cycle, or steadily see-through. */
function invulnerableAlpha(invulnerableTicks: number, reducedMotion: boolean): number {
  if (invulnerableTicks <= 0) return 1;
  if (reducedMotion) return STEADY_INVULNERABLE_ALPHA;
  return invulnerableTicks % FLICKER_TICKS < FLICKER_TICKS / 2 ? FLICKER_DIM_ALPHA : 1;
}
