/**
 * Page 4, ATTACKS. Four small scenes, one per attack power-up, each with its icon and name: the
 * Homing Squid chases a racer, a Riptide pushes along a lane, Undertow drags a racer back, and
 * a Mimic's decoy draws a squid off. Below them, how to dodge a squid: kick as it arrives and the
 * racer hops clear while the squid sails past.
 */
import { Frame, Tex } from '../../art/keys.ts';
import { IconFrame, type IconFrameKey } from '../../art/ui/keys.ts';
import { easeOut, type PageBuilder, stroke } from './kit.ts';

/** Four cells across the top band, each 54 px wide, centred on these x. */
const CELL_X = [41, 99, 157, 215] as const;
/** Each cell stacks a 2x icon, the little scene and the name; the names end at y 75, above the d-pad zone. */
const ICON_Y = 32;
const SCENE_Y = 54;
const NAME_TOP = 68;
/** The riptide lane and its wash colour (the lane's own green, as in the water). */
const LANE = { w: 44, h: 16 } as const;
const LANE_WASH = 0x3ccf7a;
const LANE_ALPHA = 0.25;
const STREAK_SCROLL_PER_TICK = 1.5;
const DECOY_TINT = 0xcfe8ff;
const DECOY_ALPHA = 0.8;
const LOOP = 90;
/** The dodge row, in the safe column: words, then the kick control, the racer and the squid. */
const DODGE = { wordsTop: 86, glyphX: 116, centreY: 120, racerX: 192, period: 120, kickAt: 56 } as const;

const NAMES: readonly { name: string; icon: IconFrameKey }[] = [
  { name: 'SQUID', icon: IconFrame.homingSquid },
  { name: 'RIPTIDE', icon: IconFrame.riptide },
  { name: 'UNDERTOW', icon: IconFrame.undertow },
  { name: 'MIMIC', icon: IconFrame.mimic },
];

/** A gentle -1..1 wave, `period` ticks long, for things that bob. */
function wave(tick: number, period: number): number {
  return Math.sin((tick / period) * Math.PI * 2);
}

export const buildAttacksPage: PageBuilder = (kit) => {
  NAMES.forEach(({ name, icon }, index) => {
    const x = CELL_X[index] ?? 0;
    kit.icon(x, ICON_Y, icon, 2);
    kit.words(x, NAME_TOP + 3, name);
  });

  // Squid: it follows a racer that keeps ahead of it.
  const chased = kit.sprite(CELL_X[0] + 10, SCENE_Y, kit.racer, Frame.a);
  const chaser = kit.sprite(CELL_X[0] - 14, SCENE_Y, Tex.squid, Frame.a);

  // Riptide: a green lane with streaks, and a racer riding it.
  const laneLeft = CELL_X[1] - LANE.w / 2;
  kit.bar(CELL_X[1], SCENE_Y, LANE.w, LANE.h, LANE_WASH).setAlpha(LANE_ALPHA);
  const streaks = kit.tiles(laneLeft, SCENE_Y - LANE.h / 2, LANE.w, LANE.h, Tex.riptideStreak, Frame.a);
  const rider = kit.sprite(CELL_X[1], SCENE_Y, kit.racer, Frame.a);

  // Undertow: a racer slides back with violet lines behind it.
  const pulled = kit.sprite(CELL_X[2], SCENE_Y, kit.racer, Frame.a);
  const pullLines = kit.sprite(CELL_X[2] - 10, SCENE_Y, Tex.undertowStreak, Frame.a);

  // Mimic: a squid heads for the decoy, not the racer.
  const real = kit.sprite(CELL_X[3] - 10, SCENE_Y + 7, kit.racer, Frame.a);
  const decoy = kit.sprite(CELL_X[3] + 12, SCENE_Y - 6, kit.racer, Frame.a).setTint(DECOY_TINT);
  const hunter = kit.sprite(CELL_X[3] - 18, SCENE_Y - 6, Tex.squid, Frame.a);

  // Dodge: kick as the squid arrives and hop over it.
  kit.words(168, DODGE.wordsTop + 3, 'KICK TO DODGE', { tone: 'sun' });
  const kick = kit.action('kick');
  kick.setPosition(DODGE.glyphX, DODGE.centreY - kick.height / 2);
  const hopper = kit.sprite(DODGE.racerX, DODGE.centreY, kit.racer, Frame.a);
  const incoming = kit.sprite(DODGE.racerX - 48, DODGE.centreY + 2, Tex.squid, Frame.a);

  return (tick, reducedMotion) => {
    const swim = stroke(tick, reducedMotion);
    const sway = reducedMotion ? 0 : wave(tick, 90) * 5;
    chased.setX(CELL_X[0] + 10 + sway).setFrame(swim);
    chaser.setX(CELL_X[0] - 14 + sway).setFrame(swim);

    streaks.setTilePosition(reducedMotion ? 0 : -tick * STREAK_SCROLL_PER_TICK, 0);
    rider.setX(CELL_X[1] + (reducedMotion ? 0 : wave(tick, 60) * 6)).setFrame(swim);

    // Undertow: swim ahead for half the loop, then be dragged back. Reduced motion holds the dragged moment.
    const half = LOOP / 2;
    const beat = reducedMotion ? LOOP - 1 : tick % LOOP;
    const dragged = beat >= half;
    const slide = dragged ? 8 - 20 * easeOut((beat - half) / half) : -8 + 16 * (beat / half);
    pulled.setX(CELL_X[2] + slide).setFrame(swim);
    pullLines
      .setX(CELL_X[2] + slide - 12)
      .setVisible(dragged)
      .setFrame(swim);

    const approach = reducedMotion ? 0.6 : (tick % LOOP) / LOOP;
    hunter.setX(CELL_X[3] - 18 + approach * 16).setFrame(swim);
    decoy.setAlpha(DECOY_ALPHA).setFrame(swim);
    real.setFrame(swim);

    const t = tick % DODGE.period;
    const dodged = reducedMotion || t >= DODGE.kickAt;
    kick.setHighlighted(reducedMotion || (t >= DODGE.kickAt && t < DODGE.kickAt + 12));
    const hop = reducedMotion ? 14 : t < DODGE.kickAt ? 0 : 14 * easeOut((t - DODGE.kickAt) / 10);
    hopper.setY(DODGE.centreY - (dodged ? hop : 0)).setFrame(swim);
    const squidX = reducedMotion ? DODGE.racerX - 10 : DODGE.racerX - 48 + (t / DODGE.period) * 100;
    incoming
      .setX(squidX)
      .setFrame(swim)
      .setVisible(squidX < 226);
  };
};
