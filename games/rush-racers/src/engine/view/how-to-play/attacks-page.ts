/**
 * Page 6, ATTACKS. Four scenes at 2x, one per attack power-up, each with its icon and name: the
 * Homing Squid chases a racer, a Riptide pushes along a lane, Undertow drags a racer back, and a
 * Mimic's decoy draws a squid off the real racer. The first two sit across the top band, the
 * other two to its right in the safe column, so nothing enters the d-pad zone (x < 108, y 76+) or
 * the A/B zone (x 228+, y 118+).
 */
import { Frame } from '../../art/keys.ts';
import { IconFrame } from '../../art/ui/keys.ts';
import { measureText, TEXT_FACE } from '../../art/ui/typeface.ts';
import type { ArtRef } from '../../worlds/art-ref.ts';
import { easeOut, type PageBuilder, type PageKit, stroke } from './kit.ts';

/** Scene centres: the wide scenes across the top, the narrow ones under them in the safe column. */
const SQUID_AT = { x: 67, y: 38 } as const;
const RIPTIDE_AT = { x: 181, y: 38 } as const;
const UNDERTOW_AT = { x: 150, y: 82 } as const;
const MIMIC_AT = { x: 218, y: 82 } as const;
/** A caption (icon and name) sits this far below its scene's centre. */
const CAPTION_DY = 24;
const CAPTION_ICON_GAP = 3;
const ICON_PX = 9;
/** The riptide lane's size and wash colour (the lane's own green, as in the water). */
const LANE = { w: 96, h: 28 } as const;
const LANE_WASH = 0x3ccf7a;
const LANE_ALPHA = 0.25;
const STREAK_SCROLL_PER_TICK = 1.5;
const DECOY_TINT = 0xcfe8ff;
const DECOY_ALPHA = 0.8;
const LOOP = 90;
/** Undertow's violet lines trail this far behind the racer, in px (drawn 1x to stay clear of the d-pad zone). */
const PULL_LINE_BEHIND = 24;

/** A gentle -1..1 wave, `period` ticks long, for things that bob. */
function wave(tick: number, period: number): number {
  return Math.sin((tick / period) * Math.PI * 2);
}

/** The icon and name under a scene, centred on `x` as one group. */
function addCaption(kit: PageKit, x: number, centreY: number, icon: ArtRef, name: string): void {
  const nameWidth = measureText(TEXT_FACE, name).width;
  const left = Math.round(x - (ICON_PX + CAPTION_ICON_GAP + nameWidth) / 2);
  kit.sprite(left + ICON_PX / 2, centreY, icon.texture, icon.frame);
  kit.words(left + ICON_PX + CAPTION_ICON_GAP + nameWidth / 2, centreY, name);
}

export const buildAttacksPage: PageBuilder = (kit) => {
  const { attack, itemIcons, text } = kit.skin.objects;
  const { attackCaptions } = text;
  addCaption(kit, SQUID_AT.x, SQUID_AT.y + CAPTION_DY, itemIcons.homingSquid, attackCaptions.homingSquid);
  addCaption(kit, RIPTIDE_AT.x, RIPTIDE_AT.y + CAPTION_DY, itemIcons.riptide, attackCaptions.riptide);
  addCaption(kit, UNDERTOW_AT.x, UNDERTOW_AT.y + CAPTION_DY, itemIcons.undertow, attackCaptions.undertow);
  addCaption(kit, MIMIC_AT.x, MIMIC_AT.y + CAPTION_DY, itemIcons.mimic, attackCaptions.mimic);

  // Squid: it follows a racer that keeps ahead of it.
  const chased = kit.sprite(SQUID_AT.x + 22, SQUID_AT.y, kit.racer, Frame.a, 2);
  const chaser = kit.sprite(SQUID_AT.x - 24, SQUID_AT.y, attack.homer, Frame.a, 2);

  // Riptide: a green lane with streaks, and a racer riding it.
  kit.bar(RIPTIDE_AT.x, RIPTIDE_AT.y, LANE.w, LANE.h, LANE_WASH).setAlpha(LANE_ALPHA);
  const streaks = kit.tiles(
    RIPTIDE_AT.x - LANE.w / 2,
    RIPTIDE_AT.y - LANE.h / 2,
    LANE.w,
    LANE.h,
    attack.riptideStreak,
    Frame.a,
  );
  const rider = kit.sprite(RIPTIDE_AT.x, RIPTIDE_AT.y, kit.racer, Frame.a, 2);

  // Undertow: a racer slides back with violet lines behind it.
  const pulled = kit.sprite(UNDERTOW_AT.x, UNDERTOW_AT.y, kit.racer, Frame.a, 2);
  const pullLines = kit.sprite(UNDERTOW_AT.x - PULL_LINE_BEHIND, UNDERTOW_AT.y, attack.undertowStreak, Frame.a);

  // Mimic: the squid heads for the see-through copy, an arrow says so, and the real racer swims off the other way.
  const decoy = kit.sprite(MIMIC_AT.x + 20, MIMIC_AT.y, kit.racer, Frame.a, 2).setTint(DECOY_TINT);
  const hunter = kit.sprite(MIMIC_AT.x - 24, MIMIC_AT.y, attack.homer, Frame.a, 2);
  kit.icon(MIMIC_AT.x - 1, MIMIC_AT.y, IconFrame.arrowUp).setAngle(90);
  const real = kit.sprite(MIMIC_AT.x - 18, MIMIC_AT.y + 13, kit.racer, Frame.a).setFlipX(true);

  return (tick, reducedMotion) => {
    const swim = stroke(tick, reducedMotion);
    const sway = reducedMotion ? 0 : wave(tick, 90) * 4;
    chased.setX(SQUID_AT.x + 22 + sway).setFrame(swim);
    chaser.setX(SQUID_AT.x - 24 + sway).setFrame(swim);

    streaks.setTilePosition(reducedMotion ? 0 : -tick * STREAK_SCROLL_PER_TICK, 0);
    rider.setX(RIPTIDE_AT.x + (reducedMotion ? 0 : wave(tick, 60) * 14)).setFrame(swim);

    // Undertow: swim ahead for half the loop, then be dragged back. Reduced motion holds the dragged moment.
    const half = LOOP / 2;
    const beat = reducedMotion ? LOOP - 1 : tick % LOOP;
    const dragged = beat >= half;
    const slide = dragged ? 6 - 14 * easeOut((beat - half) / half) : -8 + 14 * (beat / half);
    pulled.setX(UNDERTOW_AT.x + slide).setFrame(swim);
    pullLines
      .setX(UNDERTOW_AT.x + slide - PULL_LINE_BEHIND)
      .setVisible(dragged)
      .setFrame(swim);

    hunter.setX(MIMIC_AT.x - 24 + (reducedMotion ? 6 : (tick % LOOP) / 9)).setFrame(swim);
    decoy.setAlpha(DECOY_ALPHA).setFrame(swim);
    real.setX(MIMIC_AT.x - 18 - (reducedMotion ? 0 : (tick % LOOP) / 12)).setFrame(swim);
  };
};
