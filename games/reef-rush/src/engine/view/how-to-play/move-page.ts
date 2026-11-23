/**
 * Page 1, SWIM AND DASH. The top row shows the arrows (or the d-pad) with the one being pressed lit
 * while the player's racer swims round a loop the way it points; the lower row shows the dash
 * control lighting up and the racer lurching forward with speed lines behind it.
 */
import { Frame } from '../../art/keys.ts';
import type { Direction } from '../control-glyphs.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** The racer's loop, centre of its 2x sprite, and the direction it swims in each leg. */
const LOOP = { left: 130, right: 210, top: 44, bottom: 64 } as const;
const LEGS: readonly Direction[] = ['right', 'down', 'left', 'up'];
const LEG_TICKS = 45;
const ARROWS_AT = { x: 56, centreY: 54 } as const;
/** The lower row sits in the safe column, clear of the d-pad and the A/B buttons. */
const KICK_ROW = { glyphX: 112, centreY: 104, racerX: 220 } as const;
/** The kick lasts this long on a 120 tick loop, lurching the racer this many px forward. */
const KICK = { startsAt: 40, pressTicks: 12, settleTicks: 18, lurchPx: 14, period: 120 } as const;

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

/** The lurch in px `t` ticks into a kick loop: out fast, then back as the speed fades. */
function lurch(t: number): number {
  if (t < KICK.startsAt) return 0;
  const since = t - KICK.startsAt;
  if (since < KICK.pressTicks) return KICK.lurchPx * easeOut(since / KICK.pressTicks);
  const settling = since - KICK.pressTicks;
  return settling < KICK.settleTicks ? KICK.lurchPx * (1 - settling / KICK.settleTicks) : 0;
}

export const buildMovePage: PageBuilder = (kit) => {
  const arrows = kit.move();
  arrows.setPosition(ARROWS_AT.x, ARROWS_AT.centreY - arrows.height / 2);
  const swimmer = kit.sprite(LOOP.left, LOOP.top, kit.racer, Frame.a, 2);

  const kick = kit.action('dash', 2);
  kick.setPosition(KICK_ROW.glyphX, KICK_ROW.centreY - kick.height / 2);
  const kicker = kit.sprite(KICK_ROW.racerX, KICK_ROW.centreY, kit.racer, Frame.a, 2);
  const streaks = [-6, 0, 6].map((dy) => kit.bar(0, KICK_ROW.centreY + dy, 10, 1, 0xf6f0dc));

  return (tick, reducedMotion) => {
    // Reduced motion holds one still picture: halfway along the first leg, and the kick's high point.
    const at = loopPosition(reducedMotion ? LEG_TICKS / 2 : tick);
    swimmer
      .setPosition(Math.round(at.x), Math.round(at.y))
      .setFlipX(at.leg === 'left')
      .setFrame(stroke(tick, reducedMotion));
    arrows.setPressed(at.leg);

    const t = tick % KICK.period;
    const push = reducedMotion ? KICK.lurchPx / 2 : lurch(t);
    const pressed = reducedMotion || (t >= KICK.startsAt && t < KICK.startsAt + KICK.pressTicks);
    kick.setHighlighted(pressed);
    kicker.setPosition(KICK_ROW.racerX + Math.round(push), KICK_ROW.centreY).setFrame(stroke(tick, reducedMotion));
    for (const streak of streaks) {
      streak.setVisible(push > 1).setX(KICK_ROW.racerX + Math.round(push) - 30);
    }
  };
};
