/**
 * Page 7 on a running course. On foot a dash doesn't dodge a homing attack, so the page shows what
 * does stop one: a held shield. The racer stands on the floor inside its shield bubble (drawn at
 * twice the racer's scale, as in a race) with the shield's icon over it; the homing creature flies
 * in, the bubble pops with a pop ring where they met, and the creature is gone while the racer
 * stands unharmed. Everything sits in the safe column (x 108-228), clear of the d-pad and A/B zones.
 */
import { Frame } from '../../art/keys.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';
import { addFloor, racerCentreY } from './run-kit.ts';

const RACER_X = 196;
/** The bubble is drawn at twice the racer's scale, as `powerup-view.ts` draws it over a 1x racer. */
const BUBBLE = { scale: 4, radiusPx: 20, alpha: 0.6 } as const;
/** The held shield's icon, over the racer. */
const ICON = { y: 34, scale: 2 } as const;
/** The homing creature starts at the column's left edge and flies right along the racer's line. */
const HOMER = { startX: 118, pxPerTick: 1.2 } as const;
/** It meets the bubble's rim on this tick of the loop. */
const CONTACT_AT = Math.ceil((RACER_X - BUBBLE.radiusPx - HOMER.startX) / HOMER.pxPerTick);
const POP = { ticks: 10, growPx: 8 } as const;
const PERIOD = 150;

/** Builds the run shield page: a homing creature flies at a shielded racer and pops the shield instead. */
export const buildRunShieldPage: PageBuilder = (kit) => {
  const { attack, itemIcons, enemies } = kit.skin.objects;
  addFloor(kit);
  const y = racerCentreY(0);
  kit.sprite(RACER_X, ICON.y, itemIcons.bubbleShield.texture, itemIcons.bubbleShield.frame, ICON.scale);
  const racer = kit.sprite(RACER_X, y, kit.racer, Frame.a, 2);
  const bubble = kit.sprite(RACER_X, y, attack.bubble, Frame.a, BUBBLE.scale).setAlpha(BUBBLE.alpha);
  const homer = kit.sprite(HOMER.startX, y, attack.homer, Frame.a, 2);
  const ring = kit.sprite(RACER_X - BUBBLE.radiusPx, y, enemies.marks, Frame.markPop, 2);

  return (tick, reducedMotion) => {
    const frame = stroke(tick, reducedMotion);
    // Reduced motion holds the moment of contact: the creature at the bubble's rim, the shield still up.
    const t = reducedMotion ? CONTACT_AT - 1 : tick % PERIOD;
    const popped = t >= CONTACT_AT;
    racer.setFrame(frame);
    homer
      .setX(Math.round(HOMER.startX + t * HOMER.pxPerTick))
      .setFrame(frame)
      .setVisible(!popped);
    const popAge = (t - CONTACT_AT) / POP.ticks;
    const popping = popped && popAge < 1;
    bubble.setVisible(!popped);
    ring.setVisible(popping).setScale(2 + (POP.growPx / 12) * easeOut(popAge));
  };
};
