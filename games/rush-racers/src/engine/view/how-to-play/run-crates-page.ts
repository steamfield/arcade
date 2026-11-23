/**
 * The crates page on a running course. The racer jumps up under a crate and bumps it from below;
 * the crate opens and a power-up pops out above it. Hitting a crate from underneath is how you
 * open it, so the page shows the racer's head meeting the crate's bottom.
 */
import { Frame } from '../../art/keys.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';
import { addFloor, FLOOR_Y, type Jump, liftAt, racerCentreY } from './run-page.ts';

const CRATE = { x: 168, y: 36 } as const;
/** The jump peaks as the racer's head reaches the crate's bottom. */
const JUMP: Jump = { startTick: 30, holdTicks: 14, airTicks: 30, peakPx: 38 };
const PERIOD = 150;
/** The crate opens at the jump's peak and the power-up rises over `ITEM.ticks`. */
const OPENS_AT = JUMP.startTick + JUMP.airTicks / 2;
const ITEM = { risePx: 22, ticks: 20 } as const;
const BUMP = { px: 3, ticks: 4 } as const;

export const buildRunCratesPage: PageBuilder = (kit) => {
  const { itemTextures, pickups } = kit.skin.objects;
  addFloor(kit);
  const crate = kit.sprite(CRATE.x, CRATE.y, pickups.clam, Frame.clamClosed, 2);
  const item = kit.sprite(CRATE.x, CRATE.y, itemTextures.jetFin, Frame.a, 2);
  const racer = kit.sprite(CRATE.x, racerCentreY(0), kit.racer, Frame.a, 2);
  kit.words(CRATE.x, FLOOR_Y + 12, 'BUMP IT FROM BELOW');

  return (tick, reducedMotion) => {
    // Reduced motion shows the moment after the bump: the crate open, its power-up out.
    const t = reducedMotion ? OPENS_AT + ITEM.ticks : tick % PERIOD;
    const opened = t >= OPENS_AT;
    racer.setY(racerCentreY(liftAt(JUMP, t))).setFrame(stroke(tick, reducedMotion));
    const bump = opened && t < OPENS_AT + BUMP.ticks ? BUMP.px : 0;
    crate.setFrame(opened ? Frame.clamOpen : Frame.clamClosed).setY(CRATE.y - bump);
    const rise = easeOut((t - OPENS_AT) / ITEM.ticks);
    item.setVisible(opened).setY(CRATE.y - Math.round(ITEM.risePx * rise));
  };
};
