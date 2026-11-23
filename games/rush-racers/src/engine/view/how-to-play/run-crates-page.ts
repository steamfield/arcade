/**
 * The crates page on a running course. The racer jumps up under a crate and bumps it from below;
 * the crate opens and a power-up pops out above it. Hitting a crate from underneath is how you
 * open it, so the page shows the racer's head meeting the crate's bottom.
 */
import { Frame } from '../../art/keys.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';
import { addFloor, FLOOR_Y, type Jump, liftAt, RACER_HALF_HEIGHT, racerCentreY } from './run-kit.ts';

const CRATE = { x: 168, y: 40, halfHeight: 10 } as const;
/** The lift at which the racer's head reaches the crate's bottom. */
const CONTACT_LIFT = FLOOR_Y - 2 * RACER_HALF_HEIGHT - (CRATE.y + CRATE.halfHeight);
/** The jump peaks exactly at contact, so the racer never overlaps the crate and falls from the bump. */
const JUMP: Jump = { startTick: 30, holdTicks: 14, airTicks: 30, peakPx: CONTACT_LIFT };
const PERIOD = 150;
/** The crate opens at the jump's peak and the power-up rises over `ITEM.ticks`, clear of the heading. */
const OPENS_AT = JUMP.startTick + JUMP.airTicks / 2;
const ITEM = { risePx: 16, ticks: 20 } as const;
const BUMP = { px: 3, ticks: 4 } as const;

/** Builds the run crates page: a racer jumps into a crate from below and it opens. */
export const buildRunCratesPage: PageBuilder = (kit) => {
  const { itemTextures, pickups } = kit.skin.objects;
  addFloor(kit);
  // A ready crate is the `clamOpen` frame, as a ready clam is open; a bumped one shuts (`clamClosed`).
  const crate = kit.sprite(CRATE.x, CRATE.y, pickups.clam, Frame.clamOpen, 2);
  const item = kit.sprite(CRATE.x, CRATE.y, itemTextures.jetFin, Frame.a, 2);
  const racer = kit.sprite(CRATE.x, racerCentreY(0), kit.racer, Frame.a, 2);
  kit.words(CRATE.x, FLOOR_Y + 12, 'BUMP IT FROM BELOW');

  return (tick, reducedMotion) => {
    // Reduced motion shows the moment after the bump: the crate emptied, its power-up out.
    const t = reducedMotion ? OPENS_AT + ITEM.ticks : tick % PERIOD;
    const opened = t >= OPENS_AT;
    racer.setY(racerCentreY(liftAt(JUMP, t))).setFrame(stroke(tick, reducedMotion));
    const bump = opened && t < OPENS_AT + BUMP.ticks ? BUMP.px : 0;
    crate.setFrame(opened ? Frame.clamClosed : Frame.clamOpen).setY(CRATE.y - bump);
    const rise = easeOut((t - OPENS_AT) / ITEM.ticks);
    item.setVisible(opened).setY(CRATE.y - Math.round(ITEM.risePx * rise));
  };
};
