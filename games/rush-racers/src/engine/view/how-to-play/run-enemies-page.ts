/**
 * The enemies page on a running course. A beetle walks along the floor toward the racer, which
 * jumps and lands on it: a stomp pops the beetle into an acorn. Landing on top is the way to beat
 * an enemy, so the racer's jump is drawn arcing down onto it.
 */
import { Frame } from '../../art/keys.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';
import { addFloor, FLOOR_Y, type Jump, liftAt, racerCentreY } from './run-page.ts';

const RACER_X = { start: 140, landing: 190 } as const;
/** The beetle starts out on the right and stops where the racer lands. */
const BEETLE_START_X = 222;
const WALK_TICKS = 100;
const BEETLE_HALF_HEIGHT = 8;
const JUMP: Jump = { startTick: 64, holdTicks: 14, airTicks: 36, peakPx: 30 };
const STOMP_AT = JUMP.startTick + JUMP.airTicks;
const POP_TICKS = 14;
const ACORN = { risePx: 16, ticks: 40 } as const;
const PERIOD = 180;
const CAPTION_X = 168;

/** How far through its jump the racer is, 0 before it starts and 1 once it has landed. */
function jumpProgress(tick: number): number {
  return Math.min(1, Math.max(0, (tick - JUMP.startTick) / JUMP.airTicks));
}

export const buildRunEnemiesPage: PageBuilder = (kit) => {
  const { objects } = kit.skin;
  addFloor(kit);
  const beetleY = FLOOR_Y - BEETLE_HALF_HEIGHT;
  const beetle = kit.sprite(BEETLE_START_X, beetleY, objects.enemies.bodies.crab, Frame.a, 2);
  const ring = kit.sprite(RACER_X.landing, beetleY, objects.enemies.marks, Frame.markPop, 2);
  const acorn = kit.sprite(RACER_X.landing, beetleY, objects.pickups.pearl, Frame.a, 2);
  const racer = kit.sprite(RACER_X.start, racerCentreY(0), kit.racer, Frame.a, 2);
  kit.words(CAPTION_X, FLOOR_Y + 12, objects.text.enemyCaptions.crab);
  kit.words(CAPTION_X, FLOOR_Y + 21, 'LAND ON IT TO STOMP', { tone: 'sun' });

  return (tick, reducedMotion) => {
    // Reduced motion holds the stomp: the beetle popped, the acorn out.
    const t = reducedMotion ? STOMP_AT + 6 : tick % PERIOD;
    const stomped = t >= STOMP_AT;
    const since = t - STOMP_AT;
    const racerX = RACER_X.start + (RACER_X.landing - RACER_X.start) * jumpProgress(t);
    racer.setPosition(Math.round(racerX), racerCentreY(liftAt(JUMP, t))).setFrame(stroke(tick, reducedMotion));
    const beetleX = BEETLE_START_X + (RACER_X.landing - BEETLE_START_X) * easeOut(t / WALK_TICKS);
    beetle.setVisible(!stomped).setX(Math.round(beetleX)).setFrame(stroke(tick, reducedMotion));
    ring.setVisible(stomped && since < POP_TICKS);
    acorn
      .setVisible(stomped && since < ACORN.ticks)
      .setY(Math.round(beetleY - ACORN.risePx * easeOut(since / ACORN.ticks)));
  };
};
