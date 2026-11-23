/**
 * Page 7, DASH TO DODGE, alone at 2x. A squid swims at the racer; the dash control above lights at
 * the last moment, the racer hops up and the squid sails underneath. Everything sits in the safe
 * column (x 108-228), clear of the d-pad and A/B zones.
 */
import { Frame, Tex } from '../../art/keys.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

const GLYPH_AT = { centreX: 168, centreY: 52 } as const;
const RACER = { x: 200, y: 100, hopPx: 20 } as const;
/** The squid starts right of the column's left edge and swims along under the racer's line. */
const SQUID = { startX: 126, y: 104, pxPerTick: 1.3, hideAfterX: 240 } as const;
const PERIOD = 120;
const KICK_AT = 40;
const PRESS_TICKS = 12;
const HOP_TICKS = 10;

export const buildDodgePage: PageBuilder = (kit) => {
  const kick = kit.action('dash', 2);
  kick.setPosition(GLYPH_AT.centreX - kick.width / 2, GLYPH_AT.centreY - kick.height / 2);
  const hopper = kit.sprite(RACER.x, RACER.y, kit.racer, Frame.a, 2);
  const incoming = kit.sprite(SQUID.startX, SQUID.y, Tex.squid, Frame.a, 2);

  return (tick, reducedMotion) => {
    const swim = stroke(tick, reducedMotion);
    const t = tick % PERIOD;
    // Reduced motion holds the moment of the dodge: control lit, racer up, squid just under it.
    const kicked = reducedMotion || t >= KICK_AT;
    kick.setHighlighted(reducedMotion || (t >= KICK_AT && t < KICK_AT + PRESS_TICKS));
    const hop = reducedMotion ? RACER.hopPx : kicked ? RACER.hopPx * easeOut((t - KICK_AT) / HOP_TICKS) : 0;
    hopper.setY(RACER.y - Math.round(hop)).setFrame(swim);
    const squidX = reducedMotion ? RACER.x - 4 : SQUID.startX + t * SQUID.pxPerTick;
    incoming
      .setX(Math.round(squidX))
      .setFrame(swim)
      .setVisible(squidX < SQUID.hideAfterX);
  };
};
