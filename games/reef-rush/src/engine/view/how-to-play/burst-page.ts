/**
 * Page 3, B USES ALL. The page a child must get without reading: a well holding three power-ups,
 * the B control beside it, and the racer with all three effects bursting out at once when B lights.
 * A bubble trail runs from each well slot to its effect ("these made those"), then the well icons
 * dim while a bar under B recharges, and pop back to full when it is ready: you keep everything and
 * wait for B to recharge. The well is the HUD's own picture (icons on an inset), so the child can
 * match it to the corner of the race screen. No Undertow here, which is the one power-up B spends.
 */

import { BURST_COOLDOWN_TICKS } from '../../../logic/powerups/tuning.ts';
import type { PowerUpKind } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { IconFrame } from '../../art/ui/keys.ts';
import { UiColour, UiRamp } from '../../art/ui/palette.ts';
import { POWER_UP_ICON } from '../hud.ts';
import { POWER_UP_TEX } from '../powerup-view.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** The three held power-ups the page fires together. */
const HELD: readonly PowerUpKind[] = ['jetFin', 'puffer', 'inkSac'];
const ROW_Y = 60;
/** The well ends at y 74, above the d-pad zone, which starts at y 76. */
const WELL = { x: 12, y: ROW_Y - 14, w: 86, h: 28, slotX: 30, pitch: 26 } as const;
/** The control is drawn at 2x, the biggest thing on the row after the racer. */
const GLYPH_X = 106;
const ARROW_X = 148;
const RACER_X = 208;
/** Where each burst effect flies to, round the racer (screen px centres). */
const FAN: readonly { x: number; y: number }[] = [
  { x: RACER_X - 40, y: ROW_Y - 12 },
  { x: RACER_X, y: ROW_Y - 28 },
  { x: RACER_X + 40, y: ROW_Y - 12 },
];
const STARBURST_SCALE = 4;
/** One loop: the stack waits, B lights at FIRE_AT, the burst cools down for the game's own cooldown, then the stack pops ready. */
const FIRE_AT = 50;
const READY_AT = FIRE_AT + BURST_COOLDOWN_TICKS;
const PERIOD = READY_AT + 100;
const OUT_TICKS = 12;
/** The effects and their bubble trails show this long after B, then the picture settles to the cooldown. */
const EFFECT_TICKS = 90;
const TRAIL_TICKS = 40;
const TRAIL_DOTS = 4;
const DIM_ALPHA = 0.35;
const POP_TICKS = 8;
const CAPTION_TOP = 100;
/** The recharge bar under B: as wide as the 2x control, 2 px tall. */
const BAR = { w: 30, h: 2, gap: 4 } as const;

export const buildBurstPage: PageBuilder = (kit) => {
  kit.well(WELL.x, WELL.y, WELL.w, WELL.h);
  const icons = HELD.map((kind, index) => kit.icon(WELL.slotX + index * WELL.pitch, ROW_Y, POWER_UP_ICON[kind], 2));
  const glyph = kit.action('burst', 2);
  glyph.setPosition(GLYPH_X, ROW_Y - glyph.height / 2);
  const barX = GLYPH_X + glyph.width / 2;
  const barY = ROW_Y + glyph.height / 2 + BAR.gap;
  kit.bar(barX, barY, BAR.w, BAR.h, UiRamp.indigoLight);
  const fill = kit.bar(GLYPH_X, barY, 0, BAR.h, UiColour.sun).setOrigin(0, 0.5);
  kit.icon(ARROW_X, ROW_Y, IconFrame.arrowUp).setAngle(90);
  const starburst = kit.icon(RACER_X, ROW_Y, IconFrame.burst, STARBURST_SCALE);
  const racer = kit.sprite(RACER_X, ROW_Y, kit.racer, Frame.a, 2);
  const effects = HELD.map((kind) => kit.sprite(RACER_X, ROW_Y, POWER_UP_TEX[kind], Frame.a, 2));
  const trails = HELD.map(() => Array.from({ length: TRAIL_DOTS }, () => kit.bar(0, 0, 2, 2, UiColour.foam)));
  kit.words(160, CAPTION_TOP, 'ALL AT ONCE!', { size: 'display', tone: 'sun' });

  return (tick, reducedMotion) => {
    const t = tick % PERIOD;
    // Reduced motion holds the cooldown just after B: effects out, trails drawn, well dimmed.
    const since = reducedMotion ? OUT_TICKS : t - FIRE_AT;
    const fired = since >= 0;
    const cooling = fired && since < BURST_COOLDOWN_TICKS;
    const sincePop = reducedMotion ? Number.POSITIVE_INFINITY : t - READY_AT;
    glyph.setHighlighted(fired && since < OUT_TICKS * 2);
    fill.setSize(cooling ? Math.round((BAR.w * since) / BURST_COOLDOWN_TICKS) : 0, BAR.h);
    for (const icon of icons) {
      const popping = sincePop >= 0 && sincePop < POP_TICKS;
      icon.setAlpha(cooling ? DIM_ALPHA : 1).setScale(popping ? 2 + (1 - sincePop / POP_TICKS) : 2);
    }
    racer.setFrame(stroke(tick, reducedMotion));
    starburst.setVisible(fired && since < OUT_TICKS * 2);
    const out = easeOut(since / OUT_TICKS);
    const showEffects = fired && (reducedMotion || since < EFFECT_TICKS);
    for (const [index, effect] of effects.entries()) {
      const spot = FAN[index] ?? FAN[0];
      if (!spot) continue;
      effect
        .setVisible(showEffects)
        .setPosition(RACER_X + (spot.x - RACER_X) * out, ROW_Y + (spot.y - ROW_Y) * out)
        .setScale(2 * out);
      const fromX = WELL.slotX + index * WELL.pitch;
      const showTrail = fired && (reducedMotion || since < TRAIL_TICKS);
      for (const [dot, bar] of (trails[index] ?? []).entries()) {
        const along = ((dot + 1) / (TRAIL_DOTS + 1)) * out;
        bar.setVisible(showTrail).setPosition(fromX + (spot.x - fromX) * along, ROW_Y + (spot.y - ROW_Y) * along);
      }
    }
  };
};
