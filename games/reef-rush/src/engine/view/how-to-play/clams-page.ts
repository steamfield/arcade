/**
 * Page 2, OPEN CLAMS. The racer swims up to a clam; the clam shuts and a power-up pops out. Below,
 * a well like the HUD's fills with one more power-up each time round, up to three, which is all
 * you can hold.
 */

import type { PowerUpKind } from '../../../logic/types.ts';
import { Frame, Tex } from '../../art/keys.ts';
import { IconFrame } from '../../art/ui/keys.ts';
import { UiRamp } from '../../art/ui/palette.ts';
import { POWER_UP_ICON } from '../hud-well.ts';
import { POWER_UP_TEX } from '../powerup-view.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** What the clam hands out, in the order the well fills. */
const KINDS: readonly PowerUpKind[] = ['jetFin', 'puffer', 'inkSac'];
const TOP_ROW = { centreY: 50, racerX: 56, clamX: 138, itemX: 212 } as const;
/** The well in the safe column: three slots at 2x, with a gap between. */
const WELL = { x: 134, y: 96, w: 84, h: 26, slotX: 148, pitch: 26, centreY: 109 } as const;
/** HOLD 3 sits under the well, out of the way of the power-up flying in from the clam. */
const WELL_TITLE_TOP = 128;
/** Ticks per power-up: the clam shuts for the first part, the item pops, then the well takes it. */
const ROUND_TICKS = 90;
const POP_TICKS = 10;
const CLAM_SHUT_TICKS = 30;
/** In the last ticks of a round the power-up flies from the clam into the next slot of the well. */
const FLY_TICKS = 20;

export const buildClamsPage: PageBuilder = (kit) => {
  const racer = kit.sprite(TOP_ROW.racerX, TOP_ROW.centreY, kit.racer, Frame.a, 2);
  kit.icon(TOP_ROW.racerX + 40, TOP_ROW.centreY, IconFrame.arrowUp).setAngle(90);
  const clam = kit.sprite(TOP_ROW.clamX, TOP_ROW.centreY, Tex.clam, Frame.clamOpen, 2);
  kit.icon(TOP_ROW.clamX + 40, TOP_ROW.centreY, IconFrame.arrowUp).setAngle(90);
  const item = kit.sprite(TOP_ROW.itemX, TOP_ROW.centreY, Tex.jetFin, Frame.a, 2);

  kit.words(WELL.x + WELL.w / 2, WELL_TITLE_TOP, 'HOLD 3', { size: 'display', tone: 'sun' });
  kit.well(WELL.x, WELL.y, WELL.w, WELL.h);
  const slots = KINDS.map((_, index) => {
    const x = WELL.slotX + index * WELL.pitch;
    return {
      socket: kit.bar(x, WELL.centreY, 5, 5, UiRamp.dim),
      icon: kit.icon(x, WELL.centreY, IconFrame.jetFin, 2),
    };
  });

  return (tick, reducedMotion) => {
    const round = Math.floor(tick / ROUND_TICKS) % (KINDS.length + 1);
    const t = tick % ROUND_TICKS;
    // Reduced motion shows the finished picture: the last pop, the clam open, all three held.
    const popping = reducedMotion ? KINDS.length - 1 : Math.min(round, KINDS.length - 1);
    const kind = KINDS[popping] ?? 'jetFin';
    racer.setFrame(stroke(tick, reducedMotion));
    clam.setFrame(!reducedMotion && round < KINDS.length && t < CLAM_SHUT_TICKS ? Frame.clamClosed : Frame.clamOpen);
    const shown = reducedMotion || round < KINDS.length;
    const flown = reducedMotion ? 0 : easeOut((t - (ROUND_TICKS - FLY_TICKS)) / FLY_TICKS);
    const slotX = WELL.slotX + popping * WELL.pitch;
    item
      .setTexture(POWER_UP_TEX[kind], Frame.a)
      .setVisible(shown)
      .setPosition(
        Math.round(TOP_ROW.itemX + (slotX - TOP_ROW.itemX) * flown),
        Math.round(TOP_ROW.centreY + (WELL.centreY - TOP_ROW.centreY) * flown),
      )
      .setScale(reducedMotion ? 2 : 2 * easeOut(t / POP_TICKS));
    const held = reducedMotion ? KINDS.length : round;
    slots.forEach((slot, index) => {
      const slotKind = KINDS[index] ?? 'jetFin';
      slot.icon.setFrame(POWER_UP_ICON[slotKind]).setVisible(index < held);
      slot.socket.setVisible(index >= held);
    });
  };
};
