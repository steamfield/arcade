/**
 * What the HUD says about a Homing Squid hunting the player's racer (the local racer, the slot the
 * screen follows): an arrow on the screen's edge that
 * points at the squid while it is locked on, and a big DASH! prompt (with PRESS B on touch screens,
 * where B is the dash button) while one is latched on, since dashes are how it is shaken off. The
 * prompt sits by the player, above them when that fits, so a player looking at their own racer sees
 * it without looking away. The short LOCKED ON! caption is the HUD's own caption line. Everything
 * reads world state only; the arrow blinks at 3 Hz, the WCAG ceiling, and shows steadily under
 * reduced motion.
 */
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { DISPLAY_FACE, TEXT_FACE } from '../art/ui/typeface.ts';
import { localOf } from '../local-racer.ts';
import { isTouchScreen } from '../touch.ts';
import { Layer } from './layers.ts';
import { TONE_CSS } from './race-text.ts';
import { BASE_LAYOUT, type ScreenLayout } from './screen-layout.ts';
import { type Marker, markerFor, newMarker, type Rect, squidHuntingLocal } from './threat-math.ts';

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

/** What the DASH! prompt says: a latched squid wants dashes, and on a touch screen says which button. */
export function promptText(world: World, touch: boolean): PromptText {
  const latched = localOf(world).status.latched > 0;
  return { headline: latched ? 'DASH!' : '', hint: latched && touch ? 'PRESS B' : '' };
}

/**
 * Where a centre splash (countdown, GO, FINAL STRETCH, FINISH) draws on the base, widest case: the
 * arrow keeps out of it while one shows. Other view sizes: `ScreenLayout.splashRect`.
 */
export const SPLASH_RECT: Rect = BASE_LAYOUT.splashRect;
/** How far the prompt's nearest edge stays from the player's centre when it drops below them, as the hint lines do. */
const PROMPT_CLEARANCE = 16;
/** Gap between DASH! and PRESS B, px. */
const PROMPT_GAP = 2;
/** The arrow is on for 14 of every 20 ticks: 3 blinks a second. */
const ARROW_BLINK = { on: 14, period: 20 } as const;
/** The DASH! prompt changes tone every this many ticks (3 changes a second). */
const PROMPT_PULSE_TICKS = 10;

/**
 * Adds the lock-on arrow and the DASH! prompt to `scene`, pinned to the screen. `anchorY(playerY,
 * height)` says where a block of text `height` px tall centres vertically beside a player at screen
 * y `playerY` (`besidePlayerY`), so the prompt and the hint lines share one placement.
 */
export function createThreatHud(
  scene: Phaser.Scene,
  reducedMotion: boolean,
  anchorY: (playerY: number, height: number) => number,
  layout: ScreenLayout,
): ThreatHud {
  const arrow = scene.add
    .image(0, 0, UiTex.icons, IconFrame.warnArrow)
    .setScrollFactor(0)
    .setDepth(Layer.banner)
    .setVisible(false);
  const options = { outline: true, align: 'center', fixed: true, depth: Layer.banner } as const;
  // The prompt centres on the middle of the safe column, like the hint lines.
  const prompt = createLabel(scene, layout.besideX, 0, '', { ...options, size: 'display', tone: 'sun' });
  const touchHint = createLabel(scene, layout.besideX, 0, '', { ...options, tone: 'foam' });
  const touch = isTouchScreen();
  // Reused every frame, so the warnings allocate nothing per frame.
  const marker: Marker = newMarker();
  const localAt = { x: 0, y: 0 };
  const squidAt = { x: 0, y: 0 };
  const splash = layout.splashRect;
  const avoidSplash: Rect[] = [splash];
  const avoidNothing: Rect[] = [];

  return {
    sync(world, view, splashShowing) {
      const local = localOf(world);
      localAt.x = local.body.x + local.body.w / 2 - view.x;
      localAt.y = local.body.y + local.body.h / 2 - view.y;
      const squid = squidHuntingLocal(world);
      const blinkOn = reducedMotion || world.tick % ARROW_BLINK.period < ARROW_BLINK.on;
      arrow.setVisible(squid !== null && blinkOn);
      if (squid) {
        squidAt.x = squid.x - view.x;
        squidAt.y = squid.y - view.y;
        markerFor(localAt, squidAt, marker, splashShowing ? avoidSplash : avoidNothing, layout);
        arrow.setPosition(Math.round(marker.x), Math.round(marker.y)).setRotation(marker.angle);
      }

      const text = promptText(world, touch);
      const pulse = !reducedMotion && Math.floor(world.tick / PROMPT_PULSE_TICKS) % 2 === 1;
      prompt.setText(text.headline).setColor(TONE_CSS[pulse ? 'foam' : 'sun']);
      touchHint.setText(text.hint);
      if (text.headline === '') return;
      // The block (DASH!, then PRESS B on touch) is placed as one, so it clears the player together.
      const height = DISPLAY_FACE.height + (text.hint ? PROMPT_GAP + TEXT_FACE.height : 0);
      const half = Math.ceil(height / 2);
      let centre = anchorY(localAt.y, height);
      // A banner at the centre of the screen would bury the prompt: go under the player instead.
      if (splashShowing && centre - half < splash.y + splash.h && centre + half > splash.y) {
        centre = Math.min(localAt.y + PROMPT_CLEARANCE + half, layout.lowest - half);
      }
      const top = centre - half;
      prompt.setOffset(0, top + Math.ceil(DISPLAY_FACE.height / 2));
      touchHint.setOffset(0, top + DISPLAY_FACE.height + PROMPT_GAP + Math.ceil(TEXT_FACE.height / 2));
    },
  };
}
