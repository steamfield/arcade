/**
 * Page 3, FIRE ONE. A well holding three items like the HUD's, the selected one in a gold frame,
 * and the fire control beside it. Each time the control lights, only the framed item's effect comes
 * out of the racer, with a bubble trail from that slot to it ("this one made that"), and then the
 * frame moves on to the next item for the next press: you pick one item and fire it.
 */
import type { PowerUpKind } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { IconFrame } from '../../art/ui/keys.ts';
import { UiColour } from '../../art/ui/palette.ts';
import { POWER_UP_ICON } from '../hud-well.ts';
import { POWER_UP_TEX } from '../powerup-view.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** The three held items, fired one per shot from left to right. */
const HELD: readonly PowerUpKind[] = ['jetFin', 'puffer', 'inkSac'];
const ROW_Y = 60;
/** The well ends at y 74, above the d-pad zone, which starts at y 76. */
const WELL = { x: 12, y: ROW_Y - 14, w: 86, h: 28, slotX: 30, pitch: 26 } as const;
/** The selected slot's frame: around a 2x icon (18 px) with a 2 px gap, a 2 px gold line. */
const FRAME = { size: 22, line: 2 } as const;
/** The control is drawn at 2x, the biggest thing on the row after the racer. */
const GLYPH_X = 106;
const ARROW_X = 148;
const RACER_X = 208;
/** Where the fired effect flies to, above the racer (screen px centre). */
const EFFECT_AT = { x: RACER_X, y: ROW_Y - 28 } as const;
const STARBURST_SCALE = 4;
/** One shot: the control lights at FIRE_AT into it, then the frame moves on at its end. */
const SHOT_TICKS = 100;
const FIRE_AT = 30;
const OUT_TICKS = 12;
const EFFECT_TICKS = 50;
const TRAIL_TICKS = 30;
const TRAIL_DOTS = 4;
const CAPTION_TOP = 100;

export const buildFirePage: PageBuilder = (kit) => {
  kit.well(WELL.x, WELL.y, WELL.w, WELL.h);
  const slotX = (index: number) => WELL.slotX + index * WELL.pitch;
  for (const [index, kind] of HELD.entries()) kit.icon(slotX(index), ROW_Y, POWER_UP_ICON[kind], 2);
  const frame = kit.bar(slotX(0), ROW_Y, FRAME.size, FRAME.size, UiColour.sun);
  frame.setFillStyle().setStrokeStyle(FRAME.line, UiColour.sun);
  const glyph = kit.action('fire', 2);
  glyph.setPosition(GLYPH_X, ROW_Y - glyph.height / 2);
  kit.icon(ARROW_X, ROW_Y, IconFrame.arrowUp).setAngle(90);
  const starburst = kit.icon(RACER_X, ROW_Y, IconFrame.fire, STARBURST_SCALE);
  const racer = kit.sprite(RACER_X, ROW_Y, kit.racer, Frame.a, 2);
  const effects = HELD.map((kind) => kit.sprite(RACER_X, ROW_Y, POWER_UP_TEX[kind], Frame.a, 2));
  const trail = Array.from({ length: TRAIL_DOTS }, () => kit.bar(0, 0, 2, 2, UiColour.foam));
  kit.words(160, CAPTION_TOP, 'ONE AT A TIME!', { size: 'display', tone: 'sun' });

  return (tick, reducedMotion) => {
    // Reduced motion holds the first shot just after the press: effect out, trail drawn.
    const shot = reducedMotion ? 0 : Math.floor(tick / SHOT_TICKS) % HELD.length;
    const since = reducedMotion ? OUT_TICKS : (tick % SHOT_TICKS) - FIRE_AT;
    const fired = since >= 0;
    frame.setPosition(slotX(shot), ROW_Y);
    glyph.setHighlighted(fired && since < OUT_TICKS * 2);
    racer.setFrame(stroke(tick, reducedMotion));
    starburst.setVisible(fired && since < OUT_TICKS * 2);
    const out = easeOut(since / OUT_TICKS);
    effects.forEach((effect, index) => {
      effect
        .setVisible(index === shot && fired && (reducedMotion || since < EFFECT_TICKS))
        .setPosition(RACER_X + (EFFECT_AT.x - RACER_X) * out, ROW_Y + (EFFECT_AT.y - ROW_Y) * out)
        .setScale(2 * out);
    });
    const showTrail = fired && (reducedMotion || since < TRAIL_TICKS);
    trail.forEach((dot, index) => {
      const along = ((index + 1) / (TRAIL_DOTS + 1)) * out;
      const fromX = slotX(shot);
      dot
        .setVisible(showTrail)
        .setPosition(fromX + (EFFECT_AT.x - fromX) * along, ROW_Y + (EFFECT_AT.y - ROW_Y) * along);
    });
  };
};
