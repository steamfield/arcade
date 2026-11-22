/**
 * Held-stack effects drawn on a racer, read from `racer.stack` and `racer.status`:
 * a shield ring while Bubble Shield is held, the Puffer itself blown up to twice its
 * size around the racer during a Puffer burst, a dash streak behind a Jet Fins dash
 * and a ring that expands from a Glow Lantern flash. Everything is an overlay: the
 * racer's own sprite (including its invulnerability flicker) belongs to
 * `racer-view.ts`. Overlays are created once and only reconfigured each frame.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { FLASH } from '../../logic/powerups/tuning.ts';
import { type PowerUpKind, type Racer, type RacerId, TILE } from '../../logic/types.ts';
import { Frame, Tex, type TexKey } from '../art/keys.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';

/** Icon texture for each power-up. Shared by the HUD and loose pickups. */
export const POWER_UP_TEX: Record<PowerUpKind, TexKey> = {
  jetFin: Tex.jetFin,
  bubbleShield: Tex.bubbleShield,
  puffer: Tex.puffer,
  inkSac: Tex.inkSac,
  glowLantern: Tex.glowLantern,
};

/** One racer's held-stack overlays. */
export interface PowerupView {
  /** Starts the flash ring when `flash.fired` names this racer. `tick` is the world tick the events were drained at. */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  /** Positions and shows or hides every overlay from `racer`'s state at `tick`. */
  sync(racer: Racer, tick: number): void;
}

const FLASH_RING_TICKS = 15;
const SHIELD_SCALE = 2;
/** The 12 px Puffer icon at a whole-number scale: 24 px, just around the 20 px inflated hitbox. */
const INFLATED_SCALE = 2;
const GLOW_DIAMETER = 16;
const STREAK_LENGTH = 40;
const STREAK_TINT = 0x7fdbff;
const FLASH_TINT = 0xf0e060;

/** Creates the overlays for one racer. `reducedMotion` shows the flash ring at its full reach, fading, instead of growing. */
export function createPowerupView(scene: Phaser.Scene, racerId: RacerId, reducedMotion: boolean): PowerupView {
  const overlay = (texture: TexKey, depth: number) =>
    scene.add.image(0, 0, texture, Frame.a).setDepth(depth).setVisible(false);
  const shield = overlay(Tex.bubble, Layer.player + 0.5)
    .setScale(SHIELD_SCALE)
    .setAlpha(0.6);
  const inflated = overlay(Tex.puffer, Layer.racers - 0.5).setScale(INFLATED_SCALE);
  const streak = overlay(Tex.looseGlow, Layer.racers - 0.5).setTint(STREAK_TINT);
  const flashRing = overlay(Tex.looseGlow, Layer.player + 0.25).setTint(FLASH_TINT);
  let flashedAt = Number.NEGATIVE_INFINITY;

  return {
    onEvents(events, tick) {
      for (const event of events) if (event.type === 'flash.fired' && event.id === racerId) flashedAt = tick;
    },
    sync(racer, tick) {
      const x = Math.round(racer.body.x + racer.body.w / 2);
      const y = Math.round(racer.body.y + racer.body.h / 2);
      const { status } = racer;

      shield.setVisible(racer.stack.includes('bubbleShield')).setPosition(x, y);
      inflated
        .setVisible(status.inflated > 0)
        .setPosition(x, y)
        .setFlipX(racer.facing < 0);
      showStreak(streak, racer, x, y);
      showFlashRing(flashRing, tick - flashedAt, x, y, reducedMotion);
    },
  };
}

/** A stretched glow trailing the dash, rotated to the dash direction. */
function showStreak(streak: Phaser.GameObjects.Image, racer: Racer, x: number, y: number): void {
  const dashing = racer.status.dashing > 0;
  streak.setVisible(dashing);
  if (!dashing) return;
  const { dashDir } = racer;
  streak
    .setPosition(x - (dashDir.x * STREAK_LENGTH) / 2, y - (dashDir.y * STREAK_LENGTH) / 2)
    .setRotation(Math.atan2(dashDir.y, dashDir.x))
    .setScale(STREAK_LENGTH / GLOW_DIAMETER, 0.5)
    .setAlpha(0.6);
}

/**
 * A ring growing to the flash range over FLASH_RING_TICKS. Under reduced motion it appears at
 * the full range at once and only fades, so the flash's reach still reads.
 */
function showFlashRing(
  ring: Phaser.GameObjects.Image,
  ticksSince: number,
  x: number,
  y: number,
  reducedMotion: boolean,
): void {
  const active = ticksSince >= 0 && ticksSince < FLASH_RING_TICKS;
  ring.setVisible(active);
  if (!active) return;
  const progress = ticksSince / FLASH_RING_TICKS;
  const reach = reducedMotion ? 1 : progress;
  ring
    .setPosition(x, y)
    .setScale((reach * FLASH.rangeTiles * TILE * 2) / GLOW_DIAMETER)
    .setAlpha((reducedMotion ? 0.35 : 0.5) * (1 - progress));
}
