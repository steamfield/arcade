/**
 * Page 5, DASH TO BONK. Three scenes at 2x, each a racer beside the dash control and one enemy,
 * captioned with what the enemy does and how many bonks beat it. Across the top: a crab walks the
 * floor and one dash pops it into a pearl; a shark shows its `!`, charges, is staggered by a dash
 * under a dizzy star and popped by a second. In the safe column under them: an eel's eyes show in
 * its hole, it lunges out, and a dash while it is out pops it. Nothing enters the d-pad zone
 * (x < 108, y 76+) or the A/B zone (x 228+, y 118+).
 */
import { Frame } from '../../art/keys.ts';
import type { ObjectSkin } from '../../worlds/object-skin.ts';
import type { Glyph } from '../control-glyphs.ts';
import { easeOut, type PageBuilder, type PageKit, stroke } from './kit.ts';

/** Each scene's centre line, and where its dash control, racer and enemy sit. */
const CRAB = { y: 42, glyphX: 8, racerX: 40, enemyX: 86 } as const;
const SHARK = { y: 42, glyphX: 120, racerX: 150, enemyX: 222 } as const;
const EEL = { y: 94, glyphX: 112, racerX: 142, holeX: 214 } as const;
/** Two caption lines under each scene: what the enemy does, then the bonks it takes. */
const CAPTION = { firstDy: 16, lineDy: 9 } as const;
const PERIOD = 200;
/** A dash lurches the racer this far toward the enemy and back. */
const LURCH = { px: 26, outTicks: 8, backTicks: 24 } as const;
const PRESS_TICKS = 12;
/** A pop ring shows this long, and a freed pearl rises this far over `PEARL_TICKS`. */
const POP_TICKS = 14;
const PEARL = { risePx: 16, ticks: 40 } as const;

/** The crab's timeline: it walks, a dash at `dashAt` pops it. */
const CRAB_TIMES = { dashAt: 60, walkPx: 8, walkTicks: 40 } as const;
/** The shark's: `!` from `alertAt`, a charge from `chargeAt`, a stagger at the first dash, a pop at the second. */
const SHARK_TIMES = {
  alertAt: 10,
  chargeAt: 40,
  chargePx: 14,
  firstDash: 52,
  recoverTicks: 30,
  secondDash: 120,
} as const;
/** The eel's: eyes in the hole from `warnAt`, out from `outAt`, popped by a dash at `dashAt`. */
const EEL_TIMES = { warnAt: 20, outAt: 56, reachPx: 48, outTicks: 10, dashAt: 74 } as const;
/** The dizzy star sits over the shark's tail, clear of the heading above its head. */
const DIZZY_DX = 10;
/** Two 16 px body segments trail the head out of the hole. */
const EEL_SEGMENTS = 2;
const EEL_SEGMENT_PX = 16;
/** A bonk lands this many ticks after its dash, once the lurch has reached the enemy. */
const CONTACT_TICKS = LURCH.outTicks;

/** The racer's lurch in px `since` ticks after a dash, or 0 before it. */
function lurch(since: number): number {
  if (since < 0) return 0;
  if (since < LURCH.outTicks) return LURCH.px * easeOut(since / LURCH.outTicks);
  return LURCH.px * Math.max(0, 1 - (since - LURCH.outTicks) / LURCH.backTicks);
}

/** Ticks since the latest of `dashes` at or before `t`, or -1 before them all. */
function sinceLast(t: number, dashes: readonly number[]): number {
  const last = dashes.findLast((at) => at <= t);
  return last === undefined ? -1 : t - last;
}

/** A scene's racer and its dash control, which lights while a dash is pressed. */
function addDasher(kit: PageKit, at: { y: number; glyphX: number; racerX: number }) {
  const glyph: Glyph = kit.action('dash');
  glyph.setPosition(at.glyphX, at.y - glyph.height / 2);
  const racer = kit.sprite(at.racerX, at.y, kit.racer, Frame.a, 2);
  return (t: number, tick: number, reducedMotion: boolean, dashes: readonly number[]) => {
    const since = sinceLast(t, dashes);
    glyph.setHighlighted(since >= 0 && since < PRESS_TICKS);
    racer.setX(at.racerX + Math.round(lurch(since))).setFrame(stroke(tick, reducedMotion));
  };
}

/** Two centred caption lines under a scene. */
function addCaption(kit: PageKit, x: number, sceneY: number, does: string, bonks: string): void {
  kit.words(x, sceneY + CAPTION.firstDy, does);
  kit.words(x, sceneY + CAPTION.firstDy + CAPTION.lineDy, bonks, { tone: 'sun' });
}

/** A pop ring and the pearl it frees, `since` ticks after the defeat (hidden before it). */
function addDefeat(kit: PageKit, objects: ObjectSkin, x: number, y: number) {
  const ring = kit.sprite(x, y, objects.enemies.marks, Frame.markPop, 2);
  const pearl = kit.sprite(x, y, objects.pickups.pearl, Frame.a, 2);
  return (since: number) => {
    ring.setVisible(since >= 0 && since < POP_TICKS);
    pearl
      .setVisible(since >= 0 && since < PEARL.ticks)
      .setY(Math.round(y - PEARL.risePx * easeOut(since / PEARL.ticks)));
  };
}

export const buildEnemiesPage: PageBuilder = (kit) => {
  const { objects } = kit.skin;
  const { enemies } = objects;
  const { enemyCaptions } = objects.text;
  const crabX = (CRAB.racerX + CRAB.enemyX) / 2 + 4;
  addCaption(kit, crabX, CRAB.y, enemyCaptions.crab, '1 BONK');
  addCaption(kit, (SHARK.glyphX + SHARK.enemyX + 12) / 2, SHARK.y, enemyCaptions.shark, '2 BONKS');
  addCaption(kit, (EEL.glyphX + EEL.holeX + 12) / 2, EEL.y, enemyCaptions.eel, 'BONK IT OUT');

  const crabDasher = addDasher(kit, CRAB);
  const crab = kit.sprite(CRAB.enemyX, CRAB.y, enemies.bodies.crab, Frame.a, 2);
  const crabPop = addDefeat(kit, objects, CRAB.enemyX - CRAB_TIMES.walkPx / 2, CRAB.y);

  const sharkDasher = addDasher(kit, SHARK);
  const shark = kit.sprite(SHARK.enemyX, SHARK.y, enemies.bodies.shark, Frame.a, 2).setFlipX(true);
  const alert = kit.sprite(SHARK.enemyX, SHARK.y - 20, enemies.marks, Frame.markAlert, 2);
  const dizzy = kit.sprite(SHARK.enemyX, SHARK.y - 16, enemies.marks, Frame.markStar, 2);
  const sharkPop = addDefeat(kit, objects, SHARK.enemyX - SHARK_TIMES.chargePx, SHARK.y);

  const eelDasher = addDasher(kit, EEL);
  const hole = kit.sprite(EEL.holeX, EEL.y, enemies.marks, Frame.markHole, 2);
  const segments = Array.from({ length: EEL_SEGMENTS }, () =>
    kit.sprite(EEL.holeX, EEL.y, enemies.eelBody, Frame.a, 2).setFlipX(true),
  );
  const eelHead = kit.sprite(EEL.holeX, EEL.y, enemies.bodies.eel, Frame.a, 2).setFlipX(true);
  const eelPop = addDefeat(kit, objects, EEL.holeX - EEL_TIMES.reachPx, EEL.y);

  return (tick, reducedMotion) => {
    // Reduced motion holds each scene's teaching moment: the crab popping, the shark dizzy, the eel out.
    const t = reducedMotion ? null : tick % PERIOD;

    // Crab: walks back and forth until the dash reaches it.
    const crabT = t ?? CRAB_TIMES.dashAt + CONTACT_TICKS + 2;
    crabDasher(crabT, tick, reducedMotion, [CRAB_TIMES.dashAt]);
    const crabSince = crabT - CRAB_TIMES.dashAt - CONTACT_TICKS;
    const walk = Math.abs(((crabT / CRAB_TIMES.walkTicks) % 2) - 1);
    crab
      .setVisible(crabSince < 0)
      .setX(CRAB.enemyX - Math.round(walk * CRAB_TIMES.walkPx))
      .setFrame(stroke(tick, reducedMotion));
    crabPop(crabSince);

    // Shark: the tell, the charge, a stagger, then the pop.
    const sharkT = t ?? SHARK_TIMES.firstDash + CONTACT_TICKS + 4;
    sharkDasher(sharkT, tick, reducedMotion, [SHARK_TIMES.firstDash, SHARK_TIMES.secondDash]);
    const staggerSince = sharkT - SHARK_TIMES.firstDash - CONTACT_TICKS;
    const popSince = sharkT - SHARK_TIMES.secondDash - CONTACT_TICKS;
    const staggered = staggerSince >= 0 && staggerSince < SHARK_TIMES.recoverTicks;
    // Jaws open from the tell until the first bonk, as the shark's wind-up and charge are drawn in a race.
    const biting = sharkT >= SHARK_TIMES.alertAt && staggerSince < 0;
    const charged = sharkT < SHARK_TIMES.chargeAt ? 0 : easeOut((sharkT - SHARK_TIMES.chargeAt) / 12);
    const sharkX = SHARK.enemyX - Math.round(SHARK_TIMES.chargePx * charged);
    shark
      .setVisible(popSince < 0)
      .setX(sharkX)
      .setFrame(staggered ? Frame.enemyStagger : biting ? Frame.enemyBite : stroke(tick, reducedMotion));
    alert.setVisible(sharkT >= SHARK_TIMES.alertAt && sharkT < SHARK_TIMES.chargeAt).setX(sharkX);
    dizzy.setVisible(staggered).setX(sharkX + DIZZY_DX);
    sharkPop(popSince);

    // Eel: eyes in the hole, the lunge, and a dash while it is out.
    const eelT = t ?? EEL_TIMES.dashAt;
    eelDasher(eelT, tick, reducedMotion, [EEL_TIMES.dashAt]);
    const eelSince = eelT - EEL_TIMES.dashAt - CONTACT_TICKS;
    hole.setFrame(eelT >= EEL_TIMES.warnAt && eelT < EEL_TIMES.outAt ? Frame.markEyes : Frame.markHole);
    const reach =
      eelT < EEL_TIMES.outAt ? 0 : EEL_TIMES.reachPx * easeOut((eelT - EEL_TIMES.outAt) / EEL_TIMES.outTicks);
    const headX = EEL.holeX - Math.round(reach);
    const eelShown = reach > 0 && eelSince < 0;
    eelHead.setVisible(eelShown).setX(headX).setFrame(stroke(tick, reducedMotion));
    segments.forEach((segment, index) => {
      const x = headX + EEL_SEGMENT_PX * (index + 1);
      segment.setVisible(eelShown && x < EEL.holeX).setX(x);
    });
    eelPop(eelSince);
  };
};
