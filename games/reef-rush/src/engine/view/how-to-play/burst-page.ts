/**
 * Page 3, B USES ALL. The page a child must get without reading: a well holding three power-ups,
 * the B control beside it, and the racer with all three effects bursting out at once when B lights.
 * The well is the HUD's own picture (icons on an inset), so the child can match it to the corner
 * of the race screen.
 */

import type { PowerUpKind } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { IconFrame } from '../../art/ui/keys.ts';
import { POWER_UP_ICON } from '../hud.ts';
import { POWER_UP_TEX } from '../powerup-view.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** The three held power-ups the page fires together. */
const HELD: readonly PowerUpKind[] = ['jetFin', 'puffer', 'inkSac'];
const ROW_Y = 60;
/** The well ends at y 74, above the d-pad zone, which starts at y 76. */
const WELL = { x: 12, y: ROW_Y - 14, w: 86, h: 28, slotX: 30, pitch: 26 } as const;
const GLYPH_X = 110;
const ARROW_X = 140;
const RACER_X = 200;
/** Where each burst effect flies to, round the racer (screen px centres), and how big the starburst behind it is. */
const FAN: readonly { x: number; y: number }[] = [
  { x: RACER_X - 40, y: ROW_Y - 12 },
  { x: RACER_X, y: ROW_Y - 28 },
  { x: RACER_X + 40, y: ROW_Y - 12 },
];
const STARBURST_SCALE = 4;
/** One loop: the stack waits, B lights at FIRE_AT, the effects burst out together and hold. */
const PERIOD = 150;
const FIRE_AT = 50;
const OUT_TICKS = 12;
const CAPTION_TOP = 100;

export const buildBurstPage: PageBuilder = (kit) => {
  kit.well(WELL.x, WELL.y, WELL.w, WELL.h);
  for (const [index, kind] of HELD.entries()) kit.icon(WELL.slotX + index * WELL.pitch, ROW_Y, POWER_UP_ICON[kind], 2);
  const glyph = kit.action('burst');
  glyph.setPosition(GLYPH_X, ROW_Y - glyph.height / 2);
  kit.icon(ARROW_X, ROW_Y, IconFrame.arrowUp).setAngle(90);
  const starburst = kit.icon(RACER_X, ROW_Y, IconFrame.burst, STARBURST_SCALE);
  const racer = kit.sprite(RACER_X, ROW_Y, kit.racer, Frame.a, 2);
  const effects = HELD.map((kind) => kit.sprite(RACER_X, ROW_Y, POWER_UP_TEX[kind], Frame.a, 2));
  kit.words(160, CAPTION_TOP, 'ALL AT ONCE!', { size: 'display', tone: 'sun' });

  return (tick, reducedMotion) => {
    const t = tick % PERIOD;
    // Reduced motion shows the moment after B: lit, with every effect out.
    const since = reducedMotion ? OUT_TICKS : t - FIRE_AT;
    const fired = since >= 0;
    glyph.setHighlighted(fired && since < PERIOD / 2);
    racer.setFrame(stroke(tick, reducedMotion));
    starburst.setVisible(fired && since < OUT_TICKS * 2);
    const out = easeOut(since / OUT_TICKS);
    effects.forEach((effect, index) => {
      const spot = FAN[index] ?? FAN[0];
      if (!spot) return;
      effect
        .setVisible(fired)
        .setPosition(RACER_X + (spot.x - RACER_X) * out, ROW_Y + (spot.y - ROW_Y) * out)
        .setScale(2 * out);
    });
  };
};
