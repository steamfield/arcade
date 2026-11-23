/**
 * Page 1 on a running course, RUN AND JUMP. The arrows light as the player's racer runs along a
 * floor: a quick tap of Up makes a short hop, and holding Up longer makes a tall jump. Below, the
 * dash control lights and the racer lurches forward with speed lines. Also holds the small pieces
 * of floor and jump drawing the run crates and enemies pages share.
 */
import { Frame } from '../../art/keys.ts';
import type { Direction } from '../control-glyphs.ts';
import { easeOut, type PageBuilder, type PageKit, stroke } from './kit.ts';

/** The floor line's top, and a racer sprite's centre height above it at 2x. */
export const FLOOR_Y = 74;
const RACER_HALF_HEIGHT = 12;
const FLOOR = { centreX: 168, width: 120, thickness: 3, colour: 0x6b4423 } as const;
const ARROWS_AT = { x: 56, centreY: 54 } as const;
/** The dash row sits in the safe column, clear of the d-pad and the A/B buttons. */
const DASH_ROW = { glyphX: 112, centreY: 110, racerX: 190 } as const;
const DASH = { period: 120, atTick: 30, pressTicks: 12, settleTicks: 18, lurchPx: 14 } as const;

/** A jump: when it starts, how long Up is held, how long it lasts and how high it peaks (px). */
export interface Jump {
  startTick: number;
  holdTicks: number;
  airTicks: number;
  peakPx: number;
}

/** A quick tap makes the short hop; holding Up longer makes the tall jump. */
const HOP: Jump = { startTick: 50, holdTicks: 6, airTicks: 24, peakPx: 12 };
const TALL_JUMP: Jump = { startTick: 130, holdTicks: 20, airTicks: 40, peakPx: 28 };
const RUN = { period: 240, fromX: 130, toX: 210 } as const;

/** How far above the floor a racer is `tick` ticks into `jump`: a parabola, 0 before and after. */
export function liftAt(jump: Jump, tick: number): number {
  const along = (tick - jump.startTick) / jump.airTicks;
  if (along <= 0 || along >= 1) return 0;
  return jump.peakPx * 4 * along * (1 - along);
}

/** Whether Up is held at `tick` for `jump`. */
function holdsUp(jump: Jump, tick: number): boolean {
  return tick >= jump.startTick && tick < jump.startTick + jump.holdTicks;
}

/** Draws the floor strip the racer stands on, shown and hidden with the page. */
export function addFloor(kit: PageKit): void {
  kit.bar(FLOOR.centreX, FLOOR_Y + FLOOR.thickness / 2, FLOOR.width, FLOOR.thickness, FLOOR.colour);
}

/** The y that centres a racer sprite standing on the floor, `lift` px in the air. */
export function racerCentreY(lift: number): number {
  return FLOOR_Y - RACER_HALF_HEIGHT - Math.round(lift);
}

/** The racer's lurch in px `since` ticks after a dash: out fast, then back as the speed fades. */
function lurch(since: number): number {
  if (since < 0) return 0;
  if (since < DASH.pressTicks) return DASH.lurchPx * easeOut(since / DASH.pressTicks);
  const settling = since - DASH.pressTicks;
  return settling < DASH.settleTicks ? DASH.lurchPx * (1 - settling / DASH.settleTicks) : 0;
}

/** The arrow lit `tick` ticks into the run loop: Up while it is held, else right. */
function arrowAt(tick: number): Direction {
  return holdsUp(HOP, tick) || holdsUp(TALL_JUMP, tick) ? 'up' : 'right';
}

export const buildRunMovePage: PageBuilder = (kit) => {
  const arrows = kit.move();
  arrows.setPosition(ARROWS_AT.x, ARROWS_AT.centreY - arrows.height / 2);
  addFloor(kit);
  const runner = kit.sprite(RUN.fromX, racerCentreY(0), kit.racer, Frame.a, 2);
  kit.words(FLOOR.centreX, FLOOR_Y + 8, 'HOLD UP FOR HEIGHT');

  const dash = kit.action('dash', 2);
  dash.setPosition(DASH_ROW.glyphX, DASH_ROW.centreY - dash.height / 2);
  const dasher = kit.sprite(DASH_ROW.racerX, DASH_ROW.centreY, kit.racer, Frame.a, 2);
  const streaks = [-6, 0, 6].map((dy) => kit.bar(0, DASH_ROW.centreY + dy, 10, 1, 0xf6f0dc));

  return (tick, reducedMotion) => {
    // Reduced motion holds one still picture: the tall jump at its peak, Up held, the dash half out.
    const t = reducedMotion ? TALL_JUMP.startTick + TALL_JUMP.airTicks / 2 : tick % RUN.period;
    const x = RUN.fromX + ((RUN.toX - RUN.fromX) * t) / RUN.period;
    const lift = liftAt(HOP, t) + liftAt(TALL_JUMP, t);
    runner.setPosition(Math.round(x), racerCentreY(lift)).setFrame(stroke(tick, reducedMotion));
    arrows.setPressed(reducedMotion ? 'up' : arrowAt(t));

    const sinceDash = reducedMotion ? DASH.pressTicks / 2 : (tick % DASH.period) - DASH.atTick;
    const push = reducedMotion ? DASH.lurchPx / 2 : lurch(sinceDash);
    dash.setHighlighted(sinceDash >= 0 && sinceDash < DASH.pressTicks);
    dasher.setPosition(DASH_ROW.racerX + Math.round(push), DASH_ROW.centreY).setFrame(stroke(tick, reducedMotion));
    for (const streak of streaks) streak.setVisible(push > 1).setX(DASH_ROW.racerX + Math.round(push) - 30);
  };
};
