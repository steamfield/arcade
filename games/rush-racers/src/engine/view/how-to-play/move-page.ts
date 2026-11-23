/**
 * Page 1, SWIM AND DASH. The top row shows the arrows (or the d-pad) with the one being pressed lit
 * while the player's racer swims round a loop the way it points. Below, the dash control lights
 * twice and the racer lurches forward with speed lines each time; beside it the HUD's dash meter
 * empties one pip per dash and refills them one at a time, so a dash reads as something you run out of.
 */
import { DASH_METER } from '../../../logic/powerups/dash-meter.ts';
import { Frame, Tex } from '../../art/keys.ts';
import type { Direction } from '../control-glyphs.ts';
import { type ChargeTrack, dashPipFrames, NOT_READY_ALPHA, pipScale } from '../hud-well.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** The racer's loop, centre of its 2x sprite, and the direction it swims in each leg. */
const LOOP = { left: 130, right: 210, top: 44, bottom: 64 } as const;
const LEGS: readonly Direction[] = ['right', 'down', 'left', 'up'];
const LEG_TICKS = 45;
const ARROWS_AT = { x: 56, centreY: 54 } as const;
/** The dash row sits in the safe column, clear of the d-pad and the A/B buttons. */
const DASH_ROW = { glyphX: 112, centreY: 96, racerX: 210 } as const;
/** The meter at 2x under the dash control: the HUD's pips, 12 px with a 6 px gap, in an inset well. */
const METER = { x: 112, y: 114, pad: 5, pip: 12, gap: 6, h: 22 } as const;
const METER_W = METER.pad * 2 + METER.pip * DASH_METER.charges + METER.gap * (DASH_METER.charges - 1);
/**
 * One loop: two dashes empty the meter, then the charges come back as they do in a race (the first
 * `rechargeTicks` after the meter first dropped, the next `rechargeTicks` after that).
 */
const DASHES_AT: readonly number[] = [30, 80];
const PERIOD = 300;
const DASH = { pressTicks: 12, settleTicks: 18, lurchPx: 14 } as const;

/** Where on the loop the racer is `tick` ticks in, and which way it faces. */
function loopPosition(tick: number): { x: number; y: number; leg: Direction } {
  const legIndex = Math.floor(tick / LEG_TICKS) % LEGS.length;
  const leg = LEGS[legIndex] ?? 'right';
  const along = (tick % LEG_TICKS) / LEG_TICKS;
  const { left, right, top, bottom } = LOOP;
  if (leg === 'right') return { x: left + (right - left) * along, y: top, leg };
  if (leg === 'down') return { x: right, y: top + (bottom - top) * along, leg };
  if (leg === 'left') return { x: right - (right - left) * along, y: bottom, leg };
  return { x: left, y: bottom - (bottom - top) * along, leg };
}

/** The lurch in px `since` ticks after a dash: out fast, then back as the speed fades. */
function lurch(since: number): number {
  if (since < 0) return 0;
  if (since < DASH.pressTicks) return DASH.lurchPx * easeOut(since / DASH.pressTicks);
  const settling = since - DASH.pressTicks;
  return settling < DASH.settleTicks ? DASH.lurchPx * (1 - settling / DASH.settleTicks) : 0;
}

/** Ticks since the latest dash at or before `t` in the loop, or -1 before the first. */
function sinceDash(t: number): number {
  const last = DASHES_AT.findLast((at) => at <= t);
  return last === undefined ? -1 : t - last;
}

/** The meter's charges `t` ticks into the loop, and the pip that came back last and when, for its pop. */
function meterAt(t: number): ChargeTrack {
  const firstSpent = DASHES_AT[0] ?? 0;
  const spent = DASHES_AT.filter((at) => at <= t).length;
  const back = t < firstSpent ? 0 : Math.floor((t - firstSpent) / DASH_METER.rechargeTicks);
  const returned = Math.min(back, spent);
  const charges = DASH_METER.charges - spent + returned;
  const refilled = returned > 0 ? { pip: charges - 1, at: firstSpent + returned * DASH_METER.rechargeTicks } : null;
  return { shown: charges, refilled };
}

export const buildMovePage: PageBuilder = (kit) => {
  const arrows = kit.move();
  arrows.setPosition(ARROWS_AT.x, ARROWS_AT.centreY - arrows.height / 2);
  const swimmer = kit.sprite(LOOP.left, LOOP.top, kit.racer, Frame.a, 2);

  const dash = kit.action('dash', 2);
  dash.setPosition(DASH_ROW.glyphX, DASH_ROW.centreY - dash.height / 2);
  const dasher = kit.sprite(DASH_ROW.racerX, DASH_ROW.centreY, kit.racer, Frame.a, 2);
  const streaks = [-6, 0, 6].map((dy) => kit.bar(0, DASH_ROW.centreY + dy, 10, 1, 0xf6f0dc));

  kit.well(METER.x, METER.y, METER_W, METER.h);
  const pips = dashPipFrames(DASH_METER.charges).map((frame, pip) =>
    kit.sprite(
      METER.x + METER.pad + pip * (METER.pip + METER.gap) + METER.pip / 2,
      METER.y + METER.h / 2,
      Tex.kickPip,
      frame,
      2,
    ),
  );

  return (tick, reducedMotion) => {
    // Reduced motion holds one still picture: halfway along the first leg, the first dash half out, one pip spent.
    const at = loopPosition(reducedMotion ? LEG_TICKS / 2 : tick);
    swimmer
      .setPosition(Math.round(at.x), Math.round(at.y))
      .setFlipX(at.leg === 'left')
      .setFrame(stroke(tick, reducedMotion));
    arrows.setPressed(at.leg);

    const t = reducedMotion ? (DASHES_AT[0] ?? 0) + DASH.pressTicks / 2 : tick % PERIOD;
    const since = sinceDash(t);
    const push = reducedMotion ? DASH.lurchPx / 2 : lurch(since);
    dash.setHighlighted(since >= 0 && since < DASH.pressTicks);
    dasher.setPosition(DASH_ROW.racerX + Math.round(push), DASH_ROW.centreY).setFrame(stroke(tick, reducedMotion));
    for (const streak of streaks) {
      streak.setVisible(push > 1).setX(DASH_ROW.racerX + Math.round(push) - 30);
    }

    const meter = meterAt(t);
    dashPipFrames(meter.shown ?? DASH_METER.charges).forEach((frame, pip) => {
      pips[pip]
        ?.setFrame(frame)
        .setAlpha(frame === Frame.pipReady ? 1 : NOT_READY_ALPHA)
        .setScale(2 * pipScale(meter, pip, t, reducedMotion));
    });
  };
};
