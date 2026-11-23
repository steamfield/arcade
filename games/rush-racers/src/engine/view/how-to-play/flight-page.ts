/**
 * Page 1 on a flying course, FLAP AND SWOOP. The arrows light as the player's racer flies right
 * through open sky: taps of Up flap it higher, holding Up on from a flap glides it down slowly, and
 * holding Down dives it, with a caption naming each move as it plays. Below, the dash control
 * lights and the racer lurches forward into a puff cloud, which pops. Under reduced motion the
 * flyer holds still and one caption beside it lists all three moves.
 */
import { Frame } from '../../art/keys.ts';
import type { Direction } from '../control-glyphs.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

const ARROWS_AT = { x: 56, centreY: 54 } as const;
/** Where the flyer crosses the page: its x from and to, and the y of its centre at zero lift. */
const FLIGHT = { fromX: 130, toX: 210, levelY: 60 } as const;
const CAPTION = { x: 168, top: 94 } as const;
/** The reduced-motion caption, in the open sky right of the still flyer. */
const STILL_CAPTION = { x: 232, top: 42 } as const;
/** The dash row sits in the safe column, clear of the d-pad and the A/B buttons. */
const DASH_ROW = { glyphX: 112, centreY: 120, racerX: 172 } as const;
const DASH = { period: 120, atTick: 30, pressTicks: 12, settleTicks: 18, lurchPx: 14 } as const;
/** The puff cloud ahead of the dasher: its centre x, when it pops and comes back, and its colour. */
const PUFF = { x: 204, popAfter: 5, ringTicks: 10, backAfter: 80, colour: 0xf6f0dc } as const;

const FLAP = 'TAP UP TO FLAP';
const GLIDE = 'HOLD UP TO GLIDE';
const DIVE = 'HOLD DOWN TO DIVE';
const ALL_MOVES = [FLAP, GLIDE, DIVE].join('\n');

/** One beat of the flight: how long it lasts, the arrow lit, the caption, and the lift (px up) it ends at. */
interface Beat {
  ticks: number;
  arrow: Direction;
  caption: string;
  liftTo: number;
}

/**
 * The flight loop: two flaps climb, a glide sinks slowly, a dive drops fast, and flaps climb back to
 * where it started. Between flaps the racer falls a little, as gravity always pulls. Up stays held
 * from the second flap into the glide, since a fresh press of Up always flaps.
 */
const BEATS: readonly Beat[] = [
  { ticks: 6, arrow: 'up', caption: FLAP, liftTo: 8 },
  { ticks: 18, arrow: 'right', caption: FLAP, liftTo: 4 },
  { ticks: 6, arrow: 'up', caption: FLAP, liftTo: 12 },
  { ticks: 80, arrow: 'up', caption: GLIDE, liftTo: 3 },
  { ticks: 36, arrow: 'down', caption: DIVE, liftTo: -12 },
  { ticks: 6, arrow: 'up', caption: FLAP, liftTo: -5 },
  { ticks: 16, arrow: 'right', caption: FLAP, liftTo: -7 },
  { ticks: 6, arrow: 'up', caption: FLAP, liftTo: 1 },
  { ticks: 26, arrow: 'right', caption: FLAP, liftTo: 0 },
];
const FLIGHT_PERIOD = BEATS.reduce((total, beat) => total + beat.ticks, 0);
/** Reduced motion holds the end of the first flap: Up lit and the racer risen. */
const STILL_FLIGHT_TICK = 5;

/** Where the flight is `t` ticks into its loop: the beat playing and the racer's lift in px. */
function flightAt(t: number): { beat: Beat; lift: number } {
  let start = 0;
  let from = 0;
  for (const beat of BEATS) {
    if (t < start + beat.ticks) return { beat, lift: from + ((beat.liftTo - from) * (t - start)) / beat.ticks };
    start += beat.ticks;
    from = beat.liftTo;
  }
  // FLIGHT_PERIOD is the sum of the beats, so only a `t` outside [0, FLIGHT_PERIOD) reaches here.
  throw new Error(`Flight page tick ${t} is past its ${FLIGHT_PERIOD}-tick loop`);
}

/** The racer's lurch in px `since` ticks after a dash: out fast, then back as the speed fades. */
function lurch(since: number): number {
  if (since < 0) return 0;
  if (since < DASH.pressTicks) return DASH.lurchPx * easeOut(since / DASH.pressTicks);
  const settling = since - DASH.pressTicks;
  return settling < DASH.settleTicks ? DASH.lurchPx * (1 - settling / DASH.settleTicks) : 0;
}

/** Whether the puff cloud is whole `since` ticks after the dash: before it pops and once it has come back. */
function puffWhole(since: number): boolean {
  return since < PUFF.popAfter || since >= PUFF.backAfter;
}

/** Builds the flight move page: flaps, a glide and a dive, then a dash that pops a puff cloud. */
export const buildFlightMovePage: PageBuilder = (kit) => {
  const arrows = kit.move();
  arrows.setPosition(ARROWS_AT.x, ARROWS_AT.centreY - arrows.height / 2);
  const flyer = kit.sprite(FLIGHT.fromX, FLIGHT.levelY, kit.racer, Frame.a, 2);
  const caption = kit.words(CAPTION.x, CAPTION.top, FLAP);
  const stillCaption = kit.words(STILL_CAPTION.x, STILL_CAPTION.top, ALL_MOVES);

  const dash = kit.action('dash', 2);
  dash.setPosition(DASH_ROW.glyphX, DASH_ROW.centreY - dash.height / 2);
  const dasher = kit.sprite(DASH_ROW.racerX, DASH_ROW.centreY, kit.racer, Frame.a, 2);
  const streaks = [-6, 0, 6].map((dy) => kit.bar(0, DASH_ROW.centreY + dy, 10, 1, 0xf6f0dc));
  const puff = [
    kit.bar(PUFF.x, DASH_ROW.centreY + 3, 20, 7, PUFF.colour),
    kit.bar(PUFF.x - 1, DASH_ROW.centreY - 3, 12, 7, PUFF.colour),
  ];
  const popRing = kit.sprite(PUFF.x, DASH_ROW.centreY, kit.skin.objects.enemies.marks, Frame.markPop, 2);

  return (tick, reducedMotion) => {
    const t = reducedMotion ? STILL_FLIGHT_TICK : tick % FLIGHT_PERIOD;
    const { beat, lift } = flightAt(t);
    const x = FLIGHT.fromX + ((FLIGHT.toX - FLIGHT.fromX) * t) / FLIGHT_PERIOD;
    flyer.setPosition(Math.round(x), FLIGHT.levelY - Math.round(lift)).setFrame(stroke(tick, reducedMotion));
    arrows.setPressed(beat.arrow);
    caption.setText(beat.caption).setVisible(!reducedMotion);
    stillCaption.setVisible(reducedMotion);

    // Reduced motion holds the dash half out, the cloud just popped.
    const sinceDash = reducedMotion ? DASH.pressTicks / 2 : (tick % DASH.period) - DASH.atTick;
    const push = reducedMotion ? DASH.lurchPx / 2 : lurch(sinceDash);
    dash.setHighlighted(sinceDash >= 0 && sinceDash < DASH.pressTicks);
    dasher.setPosition(DASH_ROW.racerX + Math.round(push), DASH_ROW.centreY).setFrame(stroke(tick, reducedMotion));
    for (const streak of streaks) streak.setVisible(push > 1).setX(DASH_ROW.racerX + Math.round(push) - 30);
    for (const bar of puff) bar.setVisible(puffWhole(sinceDash));
    const sincePop = sinceDash - PUFF.popAfter;
    popRing.setVisible(sincePop >= 0 && sincePop < PUFF.ringTicks);
  };
};
