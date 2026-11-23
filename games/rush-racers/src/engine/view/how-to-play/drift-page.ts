/**
 * Page 1 on a drift course, THRUST AND DRIFT. The player's racer crosses open space twice, with a
 * caption naming each beat. The first pass has three: holding Right burns it up to speed with a flame
 * behind it, letting go leaves the arrows dark while it keeps drifting on at almost the same speed,
 * and holding Left burns against its motion, flame ahead, until it stops. On the second pass it
 * drifts past a small planet and its path bends up toward it. Under reduced motion the racer holds
 * still mid-burn with the planet above it, and one caption lists all four moves.
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
const PULL = 'PLANETS PULL YOU IN';
const ALL_MOVES = [BURN, DRIFT, BRAKE, PULL].join('\n');

/** The planet on the second pass: its centre, above the racer's line and right of the caption, and radius. */
const PLANET = { x: 190, y: 30, radius: 6, colour: 0x9fb8e8 } as const;
/**
 * How the planet bends the second pass: the path starts curving up at `fromX`, is `depthAtPlanet`
 * px higher when level with the planet, and leaves on the heading it had there.
 */
const BEND = { fromX: 140, depthAtPlanet: 10 } as const;

/**
 * One beat: how long it lasts, the arrow lit (none while drifting), the caption, the speed (px a
 * tick) it ends at, whether the racer leaves a drifting trail, and whether the planet is out and
 * bending its path.
 */
interface Beat {
  ticks: number;
  arrow: Direction | null;
  caption: string;
  speedTo: number;
  trail: boolean;
  planet: boolean;
}

/** One run across the page from `DRIFTER.fromX`: the speed it starts at and its beats. */
interface Pass {
  speedFrom: number;
  beats: readonly Beat[];
}

/**
 * The loop. First pass: a burn from rest to speed, a long drift that barely slows (thin dust is the
 * only drag), a burn back that stops it, then a moment at rest. Second pass: the racer drifts in at
 * speed and past the planet, which bends its path. Then it is back at the start.
 */
const PASSES: readonly Pass[] = [
  {
    speedFrom: 0,
    beats: [
      { ticks: 40, arrow: 'right', caption: BURN, speedTo: 1, trail: false, planet: false },
      { ticks: 60, arrow: null, caption: DRIFT, speedTo: 0.9, trail: true, planet: false },
      { ticks: 30, arrow: 'left', caption: BRAKE, speedTo: 0, trail: false, planet: false },
      { ticks: 30, arrow: null, caption: BRAKE, speedTo: 0, trail: false, planet: false },
    ],
  },
  {
    speedFrom: 1,
    beats: [{ ticks: 90, arrow: null, caption: PULL, speedTo: 1, trail: true, planet: true }],
  },
];
const passTicks = (pass: Pass): number => pass.beats.reduce((total, beat) => total + beat.ticks, 0);
const DRIFT_PERIOD = PASSES.reduce((total, pass) => total + passTicks(pass), 0);
/** Reduced motion holds the racer three quarters through its first burn, Right lit and flame out. */
const STILL_TICK = 30;

/** Where the racer is `t` ticks into the loop: the beat playing and how far along its pass it is in px. */
function driftAt(t: number): { beat: Beat; travelled: number } {
  let start = 0;
  for (const pass of PASSES) {
    const into = t - start;
    if (into < passTicks(pass)) return travelAlong(pass, into);
    start += passTicks(pass);
  }
  // DRIFT_PERIOD is the sum of the passes, so only a `t` outside [0, DRIFT_PERIOD) reaches here.
  throw new Error(`Drift page tick ${t} is past its ${DRIFT_PERIOD}-tick loop`);
}

/** The beat playing `t` ticks into `pass` and how far the racer has travelled along it in px. */
function travelAlong(pass: Pass, t: number): { beat: Beat; travelled: number } {
  let start = 0;
  let speed = pass.speedFrom;
  let travelled = 0;
  for (const beat of pass.beats) {
    const into = t - start;
    // Speed changes evenly through a beat, so the distance is the area under that line.
    const rate = (beat.speedTo - speed) / beat.ticks;
    if (into < beat.ticks) return { beat, travelled: travelled + speed * into + (rate * into * into) / 2 };
    travelled += ((speed + beat.speedTo) * beat.ticks) / 2;
    start += beat.ticks;
    speed = beat.speedTo;
  }
  throw new Error(`Drift page tick ${t} is past its ${passTicks(pass)}-tick pass`);
}

/**
 * The racer's y at `x` during `beat`. Past the planet the path climbs: as a parabola until it is
 * level with the planet (the pull turning it), then straight on along the heading it had there.
 */
function pathY(x: number, beat: Beat): number {
  if (!beat.planet || x <= BEND.fromX) return DRIFTER.y;
  const approach = PLANET.x - BEND.fromX;
  const curve = BEND.depthAtPlanet / (approach * approach);
  if (x <= PLANET.x) return Math.round(DRIFTER.y - curve * (x - BEND.fromX) ** 2);
  const climbPerPx = 2 * curve * approach;
  return Math.round(DRIFTER.y - BEND.depthAtPlanet - climbPerPx * (x - PLANET.x));
}

/** The planet as rows of pixels: each row's offset from the centre and its width, wider towards the middle. */
function planetRows(radius: number): { dy: number; width: number }[] {
  return Array.from({ length: 2 * radius + 1 }, (_, index) => {
    const dy = index - radius;
    return { dy, width: Math.max(2, 2 * Math.round(Math.sqrt(radius * radius - dy * dy))) };
  });
}

/** Builds the drift move page: burn to speed, drift on with the stick released, burn back to stop, then swing past a planet. */
export const buildDriftMovePage: PageBuilder = (kit) => {
  const arrows = kit.move();
  arrows.setPosition(ARROWS_AT.x, ARROWS_AT.centreY - arrows.height / 2);
  const drifter = kit.sprite(DRIFTER.fromX, DRIFTER.y, kit.racer, Frame.a, 2);
  const flame = [-2, 2].map((dy) => kit.bar(0, DRIFTER.y + dy, FLAME.length, 2, FLAME.colour));
  const trail = [0, 1, 2].map(() => kit.bar(0, DRIFTER.y, 2, 1, TRAIL.colour));
  const caption = kit.words(CAPTION.x, CAPTION.top, BURN);
  const stillCaption = kit.words(STILL_CAPTION.x, STILL_CAPTION.top, ALL_MOVES);
  const planet = planetRows(PLANET.radius).map(({ dy, width }) =>
    kit.bar(PLANET.x, PLANET.y + dy, width, 1, PLANET.colour),
  );

  return (tick, reducedMotion) => {
    const t = reducedMotion ? STILL_TICK : tick % DRIFT_PERIOD;
    const { beat, travelled } = driftAt(t);
    const x = DRIFTER.fromX + Math.round(travelled);
    drifter.setPosition(x, pathY(x, beat)).setFrame(stroke(tick, reducedMotion));
    arrows.setPressed(beat.arrow);
    caption.setText(beat.caption).setVisible(!reducedMotion);
    stillCaption.setVisible(reducedMotion);

    // A burn to the right throws its flame out behind; a burn back throws it out ahead.
    const flameX = beat.arrow === 'right' ? x - FLAME.offset : x + FLAME.offset;
    for (const bar of flame) bar.setVisible(beat.arrow !== null).setX(flameX);
    trail.forEach((dot, i) => {
      const dotX = x - TRAIL.offset - i * TRAIL.gap;
      dot.setVisible(beat.trail).setPosition(dotX, pathY(dotX, beat));
    });
    for (const row of planet) row.setVisible(beat.planet || reducedMotion);
  };
};
