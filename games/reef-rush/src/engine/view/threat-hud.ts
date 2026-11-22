/**
 * What the HUD says about a Homing Squid hunting the player: an arrow on the screen's edge that
 * points at the squid while it is locked on, and a big KICK! prompt (with PRESS A on touch screens,
 * where A is the kick button) while one is latched on, since kicks are how it is shaken off. The
 * prompt sits by the player, above them when that fits, so a player looking at their own racer sees
 * it without looking away. The short LOCKED ON! caption is the HUD's own caption line. Everything
 * reads world state only; the arrow blinks at 3 Hz, the WCAG ceiling, and shows steadily under
 * reduced motion.
 */
import type Phaser from 'phaser';
import { playerOf } from '../../logic/racers.ts';
import type { World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { DISPLAY_FACE, TEXT_FACE } from '../art/ui/typeface.ts';
import { isTouchScreen } from '../touch.ts';
import { Layer } from './layers.ts';
import { TONE_CSS } from './race-text.ts';
import { type Marker, markerFor, newMarker, type Rect, squidHuntingPlayer } from './threat-math.ts';

/** The squid warnings; `sync` redraws them from the world. */
export interface ThreatHud {
  /**
   * `view` is the camera's world rectangle, to turn world positions into screen ones. `splashShowing`
   * keeps the arrow off the centre splash while a banner is up.
   */
  sync(world: World, view: Phaser.Geom.Rectangle, splashShowing: boolean): void;
}

/** The prompt's two lines: empty when nothing is latched, and the touch hint only on touch screens. */
export interface PromptText {
  headline: string;
  hint: string;
}

/** What the KICK! prompt says: a latched squid wants kicks, and on a touch screen says which button. */
export function promptText(world: World, touch: boolean): PromptText {
  const latched = playerOf(world).status.latched > 0;
  return { headline: latched ? 'KICK!' : '', hint: latched && touch ? 'PRESS A' : '' };
}

/** Where a centre splash (countdown, GO, FINAL STRETCH, FINISH) draws, widest case: the arrow keeps out of it while one shows. */
export const SPLASH_RECT: Rect = { x: 53, y: 50, w: 214, h: 24 };
/** The prompt centres on the middle of the safe column, like the combo name. */
const PROMPT_X = 168;
/** How far the prompt's nearest edge stays from the player's centre when it drops below them, as the combo name does. */
const PROMPT_CLEARANCE = 16;
/** The lowest the prompt may reach: the bottom margin. */
const PROMPT_LOWEST = 174;
/** Gap between KICK! and PRESS A, px. */
const PROMPT_GAP = 2;
/** The arrow is on for 14 of every 20 ticks: 3 blinks a second. */
const ARROW_BLINK = { on: 14, period: 20 } as const;
/** The KICK! prompt changes tone every this many ticks (3 changes a second). */
const PROMPT_PULSE_TICKS = 10;

/**
 * Adds the lock-on arrow and the KICK! prompt to `scene`, pinned to the screen. `anchorY(playerY,
 * height)` says where a block of text `height` px tall centres vertically beside a player at screen
 * y `playerY` (the combo name's rule), so the prompt and the combo name share one placement.
 */
export function createThreatHud(
  scene: Phaser.Scene,
  reducedMotion: boolean,
  anchorY: (playerY: number, height: number) => number,
): ThreatHud {
  const arrow = scene.add
    .image(0, 0, UiTex.icons, IconFrame.warnArrow)
    .setScrollFactor(0)
    .setDepth(Layer.banner)
    .setVisible(false);
  const options = { outline: true, align: 'center', fixed: true, depth: Layer.banner } as const;
  const prompt = createLabel(scene, PROMPT_X, 0, '', { ...options, size: 'display', tone: 'sun' });
  const touchHint = createLabel(scene, PROMPT_X, 0, '', { ...options, tone: 'foam' });
  const touch = isTouchScreen();
  // Reused every frame, so the warnings allocate nothing per frame.
  const marker: Marker = newMarker();
  const playerAt = { x: 0, y: 0 };
  const squidAt = { x: 0, y: 0 };
  const avoidSplash: Rect[] = [SPLASH_RECT];
  const avoidNothing: Rect[] = [];

  return {
    sync(world, view, splashShowing) {
      const player = playerOf(world);
      playerAt.x = player.body.x + player.body.w / 2 - view.x;
      playerAt.y = player.body.y + player.body.h / 2 - view.y;
      const squid = squidHuntingPlayer(world);
      const blinkOn = reducedMotion || world.tick % ARROW_BLINK.period < ARROW_BLINK.on;
      arrow.setVisible(squid !== null && blinkOn);
      if (squid) {
        squidAt.x = squid.x - view.x;
        squidAt.y = squid.y - view.y;
        markerFor(playerAt, squidAt, marker, splashShowing ? avoidSplash : avoidNothing);
        arrow.setPosition(Math.round(marker.x), Math.round(marker.y)).setRotation(marker.angle);
      }

      const text = promptText(world, touch);
      const pulse = !reducedMotion && Math.floor(world.tick / PROMPT_PULSE_TICKS) % 2 === 1;
      prompt.setText(text.headline).setColor(TONE_CSS[pulse ? 'foam' : 'sun']);
      touchHint.setText(text.hint);
      if (text.headline === '') return;
      // The block (KICK!, then PRESS A on touch) is placed as one, so it clears the player together.
      const height = DISPLAY_FACE.height + (text.hint ? PROMPT_GAP + TEXT_FACE.height : 0);
      const half = Math.ceil(height / 2);
      let centre = anchorY(playerAt.y, height);
      // A banner at the centre of the screen would bury the prompt: go under the player instead.
      if (splashShowing && centre - half < SPLASH_RECT.y + SPLASH_RECT.h && centre + half > SPLASH_RECT.y) {
        centre = Math.min(playerAt.y + PROMPT_CLEARANCE + half, PROMPT_LOWEST - half);
      }
      const top = centre - half;
      prompt.setOffset(0, top + Math.ceil(DISPLAY_FACE.height / 2));
      touchHint.setOffset(0, top + DISPLAY_FACE.height + PROMPT_GAP + Math.ceil(TEXT_FACE.height / 2));
    },
  };
}
