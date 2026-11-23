/**
 * Page 4, GRAB PEARLS. The racer swims along a row of pearls and each one it reaches leaves the
 * row and counts up on a pearl counter like the HUD's, while the speed lines behind it grow: more
 * pearls, more speed. Then a hit flashes on the racer, three pearls scatter out behind it and the
 * counter drops by three.
 */
import { Frame, Tex } from '../../art/keys.ts';
import { IconFrame } from '../../art/ui/keys.ts';
import { UiColour } from '../../art/ui/palette.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** The pearl row across the top band, and the racer's swim along it (centres of 2x sprites). */
const ROW = { y: 48, firstX: 70, pitch: 26, count: 5 } as const;
const SWIM = { fromX: 28, toX: 206, ticks: 150 } as const;
/** The counter at 2x in the safe column: an inset well, the pearl, then the count. */
const COUNTER = { x: 134, y: 80, w: 52, h: 26 } as const;
const COUNTER_PEARL_X = COUNTER.x + 13;
const COUNTER_TEXT_X = COUNTER.x + 26;
const MORE_TOP = 112;
const HIT_TOP = 126;
/** A hit knocks this many pearls loose, as in a race. */
const DROPPED = 3;
/** The hit lands after the swim, and the dropped pearls fly back and sink over `SCATTER_TICKS`. */
const HIT_AT = 170;
const FLASH_TICKS = 16;
const SCATTER_TICKS = 40;
const SCATTER = { backPx: 40, spreadPx: 14, sinkPx: 18 } as const;
const PERIOD = 300;
/** Speed lines: one more for every two pearls held, the longest 14 px. */
const LINES = { max: 3, length: 14, behind: 24, spacing: 5 } as const;

/** The x of pearl `index` in the row. */
function pearlX(index: number): number {
  return ROW.firstX + index * ROW.pitch;
}

export const buildPearlsPage: PageBuilder = (kit) => {
  const row = Array.from({ length: ROW.count }, (_, index) => kit.sprite(pearlX(index), ROW.y, Tex.pearl, Frame.a, 2));
  const lines = Array.from({ length: LINES.max }, (_, index) =>
    kit.bar(0, ROW.y + (index - 1) * LINES.spacing, LINES.length, 1, UiColour.foam),
  );
  const flash = kit.icon(SWIM.toX, ROW.y, IconFrame.fire, 3);
  const racer = kit.sprite(SWIM.fromX, ROW.y, kit.racer, Frame.a, 2);
  const scattered = Array.from({ length: DROPPED }, () => kit.sprite(0, 0, Tex.pearl, Frame.a, 2));

  kit.well(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h);
  kit.sprite(COUNTER_PEARL_X, COUNTER.y + COUNTER.h / 2, Tex.pearl, Frame.a, 2);
  const count = kit.words(COUNTER_TEXT_X, COUNTER.y + 6, '0', { align: 'left', scale: 2, outline: false });
  kit.words(160, MORE_TOP, 'MORE = FASTER');
  const hitCaption = kit.words(160, HIT_TOP, 'A HIT DROPS 3', { tone: 'sun' });

  return (tick, reducedMotion) => {
    // Reduced motion holds the moment after the hit: all five grabbed, three scattered, the counter at two.
    const t = reducedMotion ? HIT_AT + SCATTER_TICKS : tick % PERIOD;
    const swum = easeOut(t / SWIM.ticks);
    const x = SWIM.fromX + (SWIM.toX - SWIM.fromX) * swum;
    const grabbed = row.filter((_, index) => pearlX(index) <= x).length;
    row.forEach((pearl, index) => {
      pearl.setVisible(pearlX(index) > x);
    });
    const hit = t >= HIT_AT;
    const held = hit ? grabbed - DROPPED : grabbed;
    count.setText(String(held));
    racer.setX(Math.round(x)).setFrame(stroke(tick, reducedMotion));
    // Flicker for the second after a hit, as a hit racer does; steady under reduced motion.
    racer.setAlpha(hit && !reducedMotion && t - HIT_AT < 60 && Math.floor(t / 4) % 2 === 0 ? 0.4 : 1);

    const shownLines = hit || t >= SWIM.ticks ? 0 : Math.ceil(grabbed / 2);
    lines.forEach((line, index) => {
      line.setVisible(index < shownLines).setX(Math.round(x) - LINES.behind);
    });

    flash.setVisible(hit && t - HIT_AT < FLASH_TICKS);
    hitCaption.setVisible(hit);
    const out = easeOut((t - HIT_AT) / SCATTER_TICKS);
    scattered.forEach((pearl, index) => {
      const spread = (index - 1) * SCATTER.spreadPx;
      pearl
        .setVisible(hit)
        .setPosition(
          Math.round(SWIM.toX - SCATTER.backPx * out + spread * out),
          Math.round(ROW.y + (spread / 2 + SCATTER.sinkPx) * out),
        );
    });
  };
};
