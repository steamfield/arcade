/**
 * The title screen, laid out to UI.md: the RUSH RACERS logotype over the backdrop of the last
 * listed course raced (Sunlit Shallows until then), the four racers swimming past, the Race / Friends / How to play /
 * Level / Sound / Motion buttons (Level, Sound and Motion show the setting in force and change the moment it does),
 * a blinking PRESS A on touch screens (on a keyboard A is a move key, so the
 * hint would mislead), the best-time card, to the right of the buttons, when the save has a
 * best on the current course at the level now selected (it follows the Level button), and the
 * line saying why online play ended, when it ended with one.
 *
 * The screen stays up while the player toggles Motion, so every motion here
 * reads `rt.settings.reducedMotion` live each frame. Motion is timed from the
 * runtime's tick so captures repeat.
 */
import Phaser from 'phaser';
import { levelOf } from '../../logic/courses/index.ts';
import { bestFor } from '../../logic/records.ts';
import { NEW_GAME } from '../../logic/save.ts';
import type { CharacterId, Difficulty } from '../../logic/types.ts';
import { CHARACTER_IDS, DIFFICULTIES } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { Frame } from '../art/keys.ts';
import { BUTTON_HEIGHT } from '../art/ui/button.ts';
import { MedalFrame, type MedalFrameKey, UiTex } from '../art/ui/keys.ts';
import { UiColour, UiRamp } from '../art/ui/palette.ts';
import { createPanel } from '../art/ui/panel.ts';
import { centreOnStage } from '../centre-on-stage.ts';
import { MENU_OPTIONS, type MenuOption } from '../menu.ts';
import type { Runtime, Settings } from '../runtime.ts';
import { baseOffset } from '../stage.ts';
import { themeFor } from '../themes/index.ts';
import { isTouchScreen } from '../touch.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { createMenuView, type MenuView, OPTION_LABELS } from '../view/menu-view.ts';
import { formatRaceTime, ordinal } from '../view/race-text.ts';
import type { ArtRef } from '../worlds/art-ref.ts';
import { skinFor } from '../worlds/index.ts';

/** UI.md "Title" rects, in game px. */
const LOGO_AT = { x: 64, y: 28, scale: 2 } as const;
/** The lane the racers swim along: base y 62, across the whole view, behind the menu. */
const RACER_LANE = { y: 62, depth: -1 } as const;
/**
 * The six buttons share one width so their fins line up. 80 is the widest that keeps the fin
 * (x 109-117) clear of the d-pad zone (x < 108) with the column centred on the logo. A 1 px gap
 * between buttons fits six between the racer lane and the bottom margin.
 */
const MENU = { centreX: 160, top: 76, width: 80, pitch: 16 } as const;
/** Under the best card, just above the A/B buttons it points to; no room is left under the six buttons. */
const PRESS_A = { x: 264, top: 110 } as const;
/**
 * The online notice: one line of up to 40 characters (240 px) centred between the left margin and
 * the back link (x 6-246), above the logo.
 */
const NOTICE = { x: 126, top: 8 } as const;
/** Right of the buttons, clear of the back link above and the A/B buttons below. */
const BEST_CARD = { x: 214, y: 82, w: 100, h: 24 } as const;
const BEST_BADGE_AT = { x: 218, y: 87 } as const;
const BEST_PLACE_AT = { x: 234, y: 86 } as const;
const BEST_TIME_AT = { x: 234, y: 95 } as const;

/** The Level button's row in the title menu, counting from the top. */
const LEVEL_ROW = MENU_OPTIONS.title.indexOf('Difficulty');
/** The Level button's pips: 3 px squares 5 px apart, 6 px in from the button's left edge. */
const LEVEL_PIPS = { size: 3, pitch: 5, inset: 6 } as const;

/** UI.md "Motion": PRESS A shows for 32 ticks and hides for 16. */
const BLINK = { on: 32, off: 16 } as const;
/** Racer sprites are 16 px wide and swap swim frames this often. */
const RACER_WIDTH = 16;
const STROKE_TICKS = 8;
/**
 * Each title racer's speed across the lane in px per tick and where it starts, so they spread out and
 * overtake. The first four character slots take these in order.
 */
const LANE_PACE: readonly { speed: number; offset: number }[] = [
  { speed: 0.75, offset: 210 },
  { speed: 0.6, offset: 150 },
  { speed: 0.9, offset: 60 },
  { speed: 0.5, offset: 0 },
];
/** Who swims past: the first character slots, one per lane pace. */
const SWIMMERS: readonly { character: CharacterId; speed: number; offset: number }[] = LANE_PACE.map((pace, index) => ({
  character: CHARACTER_IDS[index] as CharacterId,
  ...pace,
}));
const MEDAL_FOR_PLACE: Partial<Record<number, MedalFrameKey>> = {
  1: MedalFrame.first,
  2: MedalFrame.second,
  3: MedalFrame.third,
};

/** Title scene. Its menu lives on the runtime, which reads input for it each tick. */
export class TitleScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private menuView: MenuView | null = null;
  private backdrop: Backdrop | null = null;
  private swimmers: { image: Phaser.GameObjects.Image; speed: number; offset: number }[] = [];
  /** The view's width: the swimmers' lane runs across all of it. */
  private laneWidth = 0;
  private pressA: Label | null = null;
  private notice: Label | null = null;
  private levelPips: Phaser.GameObjects.Rectangle[] = [];
  /** Each level's best-time card, for the levels that have a best; one shows at a time. */
  private bestCards: Partial<Record<Difficulty, BestCard>> = {};

  constructor(rt: Runtime) {
    super('title');
    this.rt = rt;
  }

  create(): void {
    centreOnStage(this);
    const rt = this.rt;
    // The backdrop reads this every update, so a Motion toggle stills it at once.
    const backdropCourse = rt.menuCourse;
    this.backdrop = createBackdrop(this, levelOf(backdropCourse), themeFor(backdropCourse), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    this.add.image(LOGO_AT.x, LOGO_AT.y, UiTex.logo, 'logo').setOrigin(0, 0).setScale(LOGO_AT.scale);
    // Drawn by the full-view camera (depth below 0), so they swim from edge to edge of the window.
    const at = baseOffset(this.scale);
    this.laneWidth = this.scale.width;
    const { cast } = skinFor(backdropCourse);
    this.swimmers = SWIMMERS.map(({ character, speed, offset }) => ({
      speed,
      offset: offset + at.x,
      image: this.add
        .image(0, RACER_LANE.y + at.y, cast.racers[character], Frame.a)
        .setOrigin(0, 0)
        .setDepth(RACER_LANE.depth),
    }));
    this.menuView = createMenuView(this, MENU, MENU_OPTIONS.title, (option) => optionText(option, rt.settings));
    this.levelPips = addLevelPips(this);
    this.pressA = isTouchScreen()
      ? createLabel(this, PRESS_A.x, PRESS_A.top + 3, 'PRESS A', { align: 'center', outline: true })
      : null;
    this.notice = createLabel(this, NOTICE.x, NOTICE.top + 3, '', { align: 'center', outline: true });
    const save = rt.save ?? NEW_GAME;
    this.bestCards = {};
    for (const level of DIFFICULTIES) {
      const best = bestFor(save, rt.course.id, level);
      if (best)
        this.bestCards[level] = addBestCard(this, best, cast.portraits[rt.save?.character ?? NEW_GAME.character]);
    }
    this.rt.entered('title');
    this.update();
  }

  override update(): void {
    const tick = this.rt.step.tick;
    const { reducedMotion } = this.rt.settings;
    this.backdrop?.update(tick);
    this.menuView?.sync(this.rt.menu, tick, reducedMotion);
    const { difficulty } = this.rt.settings;
    const level = DIFFICULTIES.indexOf(difficulty) + 1;
    for (const [index, pip] of this.levelPips.entries())
      pip.setFillStyle(index < level ? UiColour.sun : UiRamp.indigoLight);
    for (const shown of DIFFICULTIES) this.bestCards[shown]?.setVisible(shown === difficulty);
    this.pressA?.setVisible(reducedMotion || tick % (BLINK.on + BLINK.off) < BLINK.on);
    const notice = this.rt.online.notice;
    this.notice?.setVisible(notice !== null);
    if (notice !== null) this.notice?.setText(notice.toUpperCase());
    const stroke = reducedMotion || Math.floor(tick / STROKE_TICKS) % 2 === 0 ? Frame.a : Frame.b;
    for (const swimmer of this.swimmers)
      swimmer.image.setX(swimmerX(swimmer, this.laneWidth, tick, reducedMotion)).setFrame(stroke);
  }
}

/** What each title button says: Race and How to play as is, Level, Sound and Motion with the setting in force. */
function optionText(option: MenuOption, settings: Settings): string {
  // The pips beside the word (`addLevelPips`) show the level to a child who can't read it.
  if (option === 'Difficulty') return settings.difficulty.toUpperCase();
  if (option === 'Sound') return settings.muted ? 'SOUND OFF' : 'SOUND ON';
  // "LESS" rather than "REDUCED": MOTION REDUCED is too wide for a button whose fin clears the d-pad.
  if (option === 'Motion') return settings.reducedMotion ? 'MOTION LESS' : 'MOTION FULL';
  return OPTION_LABELS[option];
}

/**
 * One pip per level, left inside the Level button: 1 lit for Easy, 2 for Normal, 3 for Hard. The
 * button's word is centred, and the widest, NORMAL, starts at x 142, clear of the pips.
 */
function addLevelPips(scene: Phaser.Scene): Phaser.GameObjects.Rectangle[] {
  const top = MENU.top + LEVEL_ROW * MENU.pitch + (BUTTON_HEIGHT - LEVEL_PIPS.size) / 2;
  const left = MENU.centreX - MENU.width / 2 + LEVEL_PIPS.inset;
  return DIFFICULTIES.map((_, index) =>
    scene.add
      .rectangle(left + index * LEVEL_PIPS.pitch, top, LEVEL_PIPS.size, LEVEL_PIPS.size, UiRamp.indigoLight)
      .setOrigin(0, 0)
      .setDepth(1),
  );
}

/** A swimmer's x in the lane at `tick`, wrapping from off the right edge back to off the left. Still under reduced motion. */
function swimmerX(
  { speed, offset }: { speed: number; offset: number },
  laneWidth: number,
  tick: number,
  reducedMotion: boolean,
): number {
  const span = laneWidth + RACER_WIDTH;
  const travelled = reducedMotion ? offset : offset + tick * speed;
  return Math.floor(travelled % span) - RACER_WIDTH;
}

/** A best-time card's parts, shown or hidden together. */
interface BestCard {
  setVisible(visible: boolean): void;
}

/**
 * The raised best-time card, built hidden: a medal for a podium best (else the saved character's
 * portrait), the place, and the time.
 */
function addBestCard(scene: Phaser.Scene, best: { ticks: number; place: number }, portrait: ArtRef): BestCard {
  const parts: { setVisible(visible: boolean): unknown }[] = [
    createPanel(scene, BEST_CARD.x, BEST_CARD.y, BEST_CARD.w, BEST_CARD.h, 'raised'),
  ];
  const medal = MEDAL_FOR_PLACE[best.place];
  parts.push(
    medal
      ? scene.add.image(BEST_BADGE_AT.x, BEST_BADGE_AT.y, UiTex.medals, medal).setOrigin(0, 0)
      : scene.add.image(BEST_BADGE_AT.x, BEST_BADGE_AT.y - 1, portrait.texture, portrait.frame).setOrigin(0, 0),
    createLabel(scene, BEST_PLACE_AT.x, BEST_PLACE_AT.y, `BEST ${ordinal(best.place)}`, { tone: 'dim' }),
    createLabel(scene, BEST_TIME_AT.x, BEST_TIME_AT.y, formatRaceTime(best.ticks), { tone: 'foam' }),
  );
  return {
    setVisible(visible) {
      for (const part of parts) part.setVisible(visible);
    },
  };
}
