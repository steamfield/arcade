/**
 * Page 1 on a drift course, THRUST AND DRIFT. The player's racer crosses open space in three beats
 * with a caption naming each: holding Right burns it up to speed with a flame behind it, letting
 * go leaves the arrows dark while it keeps drifting on at almost the same speed, and holding Left
 * burns against its motion, flame ahead, until it stops. Under reduced motion the racer holds still
 * mid-burn and one caption beside it lists all three moves.
 */
import { Frame } from '../../art/keys.ts';
import type { Direction } from '../control-glyphs.ts';
import { type PageBuilder, stroke } from './kit.ts';

const ARROWS_AT = { x: 56, centreY: 54 } as const;
/** Where the racer starts its run and the y of its centre. */
const DRIFTER = { fromX: 130, y: 60 } as const;
const CAPTION = { x: 168, top: 94 } as const;
/** The reduced-motion caption, in the open space right of the still racer. */
const STILL_CAPTION = { x: 232, top: 42 } as const;
/** The thruster flame: how far from the racer's centre it sits, its length and colour. */
const FLAME = { offset: 21, length: 8, colour: 0xffb347 } as const;
/** The faint trail a drifting racer leaves: how far behind it the dots start, their gap and colour. */
const TRAIL = { offset: 24, gap: 6, colour: 0xf6f0dc } as const;

const BURN = 'HOLD TO BURN';
const DRIFT = 'LET GO TO DRIFT';
const BRAKE = 'BURN BACK TO BRAKE';
const ALL_MOVES = [BURN, DRIFT, BRAKE].join('\n');

/** One beat: how long it lasts, the arrow lit (none while drifting), the caption, and the speed (px a tick) it ends at. */
interface Beat {
  ticks: number;
  arrow: Direction | null;
  caption: string;
  speedTo: number;
}

/**
 * The loop: a burn from rest to speed, a long drift that barely slows (thin dust is the only drag),
 * a burn back that stops it, then a moment at rest before the racer is back at the start.
 */
const BEATS: readonly Beat[] = [
  { ticks: 40, arrow: 'right', caption: BURN, speedTo: 1 },
  { ticks: 60, arrow: null, caption: DRIFT, speedTo: 0.9 },
  { ticks: 30, arrow: 'left', caption: BRAKE, speedTo: 0 },
  { ticks: 30, arrow: null, caption: BRAKE, speedTo: 0 },
];
const DRIFT_PERIOD = BEATS.reduce((total, beat) => total + beat.ticks, 0);
/** Reduced motion holds the racer three quarters through its first burn, Right lit and flame out. */
const STILL_TICK = 30;

/** Where the racer is `t` ticks into the loop: the beat playing and how far it has travelled in px. */
function driftAt(t: number): { beat: Beat; travelled: number } {
  let start = 0;
  let speed = 0;
  let travelled = 0;
  for (const beat of BEATS) {
    const into = t - start;
    // Speed changes evenly through a beat, so the distance is the area under that line.
    const rate = (beat.speedTo - speed) / beat.ticks;
    if (into < beat.ticks) return { beat, travelled: travelled + speed * into + (rate * into * into) / 2 };
    travelled += ((speed + beat.speedTo) * beat.ticks) / 2;
    start += beat.ticks;
    speed = beat.speedTo;
  }
  // DRIFT_PERIOD is the sum of the beats, so only a `t` outside [0, DRIFT_PERIOD) reaches here.
  throw new Error(`Drift page tick ${t} is past its ${DRIFT_PERIOD}-tick loop`);
}

/** Builds the drift move page: burn to speed, drift on with the stick released, burn back to stop. */
export const buildDriftMovePage: PageBuilder = (kit) => {
  const arrows = kit.move();
  arrows.setPosition(ARROWS_AT.x, ARROWS_AT.centreY - arrows.height / 2);
  const drifter = kit.sprite(DRIFTER.fromX, DRIFTER.y, kit.racer, Frame.a, 2);
  const flame = [-2, 2].map((dy) => kit.bar(0, DRIFTER.y + dy, FLAME.length, 2, FLAME.colour));
  const trail = [0, 1, 2].map(() => kit.bar(0, DRIFTER.y, 2, 1, TRAIL.colour));
  const caption = kit.words(CAPTION.x, CAPTION.top, BURN);
  const stillCaption = kit.words(STILL_CAPTION.x, STILL_CAPTION.top, ALL_MOVES);

  return (tick, reducedMotion) => {
    const t = reducedMotion ? STILL_TICK : tick % DRIFT_PERIOD;
    const { beat, travelled } = driftAt(t);
    const x = DRIFTER.fromX + Math.round(travelled);
    drifter.setPosition(x, DRIFTER.y).setFrame(stroke(tick, reducedMotion));
    arrows.setPressed(beat.arrow);
    caption.setText(beat.caption).setVisible(!reducedMotion);
    stillCaption.setVisible(reducedMotion);

    // A burn to the right throws its flame out behind; a burn back throws it out ahead.
    const flameX = beat.arrow === 'right' ? x - FLAME.offset : x + FLAME.offset;
    for (const bar of flame) bar.setVisible(beat.arrow !== null).setX(flameX);
    const drifting = beat.caption === DRIFT;
    trail.forEach((dot, i) => {
      dot.setVisible(drifting).setX(x - TRAIL.offset - i * TRAIL.gap);
    });
  };
};
