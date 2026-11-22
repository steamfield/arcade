/**
 * The title screen, laid out to UI.md: the REEF RUSH logotype over the reef
 * backdrop, the four racers swimming past, the Race / Sound / Motion buttons
 * (Sound and Motion show the setting in force and change the moment it does),
 * a blinking PRESS A on touch screens (on a keyboard A is a move key, so the
 * hint would mislead), and the best-time card when the save has a best.
 *
 * The screen stays up while the player toggles Motion, so every motion here
 * reads `rt.settings.reducedMotion` live each frame. Motion is timed from the
 * runtime's tick so captures repeat.
 */
import Phaser from 'phaser';
import { OCEAN_LEVEL } from '../../logic/level/levels.ts';
import { parseLevel } from '../../logic/level/parse.ts';
import { NEW_GAME } from '../../logic/save.ts';
import type { CharacterId } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { Frame, Tex } from '../art/keys.ts';
import { MedalFrame, type MedalFrameKey, PortraitFrame, UiTex } from '../art/ui/keys.ts';
import { createPanel } from '../art/ui/panel.ts';
import { MENU_OPTIONS, type MenuOption } from '../menu.ts';
import type { Runtime, Settings } from '../runtime.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { createMenuView, type MenuView, OPTION_LABELS } from '../view/menu-view.ts';
import { formatRaceTime, ordinal } from '../view/race-text.ts';

/** UI.md "Title" rects, in game px. */
const LOGO_AT = { x: 67, y: 28, scale: 2 } as const;
const RACER_LANE = { y: 62, width: 320 } as const;
/**
 * The three buttons share one width so their fins line up. 80 is the widest that keeps the fin
 * (x 109-117) clear of the d-pad zone (x < 108) with the column centred on the logo.
 */
const MENU = { centreX: 160, top: 82, width: 80, pitch: 17 } as const;
/** 6 px clear of the last button and of the best card, so it reads as a hint, not a fourth button. */
const PRESS_A = { x: 160, top: 137 } as const;
const BEST_CARD = { x: 110, y: 150, w: 100, h: 24 } as const;
const BEST_BADGE_AT = { x: 114, y: 155 } as const;
const BEST_PLACE_AT = { x: 130, y: 154 } as const;
const BEST_TIME_AT = { x: 130, y: 163 } as const;

/** UI.md "Motion": PRESS A shows for 32 ticks and hides for 16. */
const BLINK = { on: 32, off: 16 } as const;
/** Racer sprites are 16 px wide and swap swim frames this often. */
const RACER_WIDTH = 16;
const STROKE_TICKS = 8;
/** Who swims past, each one's speed across the lane in px per tick, and where it starts, so they spread out and overtake. */
const SWIMMERS: readonly { character: CharacterId; speed: number; offset: number }[] = [
  { character: 'rudy', speed: 0.75, offset: 210 },
  { character: 'gil', speed: 0.6, offset: 150 },
  { character: 'streak', speed: 0.9, offset: 60 },
  { character: 'onyx', speed: 0.5, offset: 0 },
];
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
  private pressA: Label | null = null;

  constructor(rt: Runtime) {
    super('title');
    this.rt = rt;
  }

  create(): void {
    const rt = this.rt;
    // The backdrop reads this every update, so a Motion toggle stills it at once.
    this.backdrop = createBackdrop(this, parseLevel(OCEAN_LEVEL), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    this.add.image(LOGO_AT.x, LOGO_AT.y, UiTex.logo, 'logo').setOrigin(0, 0).setScale(LOGO_AT.scale);
    this.swimmers = SWIMMERS.map(({ character, speed, offset }) => ({
      speed,
      offset,
      image: this.add.image(0, RACER_LANE.y, Tex[character], Frame.a).setOrigin(0, 0),
    }));
    this.menuView = createMenuView(this, MENU, MENU_OPTIONS.title, (option) => optionText(option, rt.settings));
    this.pressA = isTouchScreen()
      ? createLabel(this, PRESS_A.x, PRESS_A.top + 3, 'PRESS A', { align: 'center', outline: true })
      : null;
    const best = rt.save?.best;
    if (best) addBestCard(this, best, rt.save?.character ?? NEW_GAME.character);
    this.rt.entered('title');
    this.update();
  }

  override update(): void {
    const tick = this.rt.step.tick;
    const { reducedMotion } = this.rt.settings;
    this.backdrop?.update(tick);
    this.menuView?.sync(this.rt.menu, tick, reducedMotion);
    this.pressA?.setVisible(reducedMotion || tick % (BLINK.on + BLINK.off) < BLINK.on);
    const stroke = reducedMotion || Math.floor(tick / STROKE_TICKS) % 2 === 0 ? Frame.a : Frame.b;
    for (const swimmer of this.swimmers) swimmer.image.setX(swimmerX(swimmer, tick, reducedMotion)).setFrame(stroke);
  }
}

/**
 * Whether the on-screen touch controls are up. The same rule `@arcade/input` mounts them by: the
 * shell's `?touch=1`, or a coarse pointer.
 */
function isTouchScreen(): boolean {
  const forced = new URLSearchParams(window.location.search).get('touch') === '1';
  return forced || window.matchMedia('(pointer: coarse)').matches;
}

/** What each title button says: Race as is, Sound and Motion with the setting in force. */
function optionText(option: MenuOption, settings: Settings): string {
  if (option === 'Sound') return settings.muted ? 'SOUND OFF' : 'SOUND ON';
  // "LESS" rather than "REDUCED": MOTION REDUCED is too wide for a button whose fin clears the d-pad.
  if (option === 'Motion') return settings.reducedMotion ? 'MOTION LESS' : 'MOTION FULL';
  return OPTION_LABELS[option];
}

/** A swimmer's x in the lane at `tick`, wrapping from off the right edge back to off the left. Still under reduced motion. */
function swimmerX({ speed, offset }: { speed: number; offset: number }, tick: number, reducedMotion: boolean): number {
  const span = RACER_LANE.width + RACER_WIDTH;
  const travelled = reducedMotion ? offset : offset + tick * speed;
  return Math.floor(travelled % span) - RACER_WIDTH;
}

/** The raised best-time card: a medal for a podium best (else the saved character's portrait), the place, and the time. */
function addBestCard(scene: Phaser.Scene, best: { ticks: number; place: number }, character: CharacterId): void {
  createPanel(scene, BEST_CARD.x, BEST_CARD.y, BEST_CARD.w, BEST_CARD.h, 'raised');
  const medal = MEDAL_FOR_PLACE[best.place];
  if (medal) scene.add.image(BEST_BADGE_AT.x, BEST_BADGE_AT.y, UiTex.medals, medal).setOrigin(0, 0);
  else scene.add.image(BEST_BADGE_AT.x, BEST_BADGE_AT.y - 1, UiTex.portraits, PortraitFrame[character]).setOrigin(0, 0);
  createLabel(scene, BEST_PLACE_AT.x, BEST_PLACE_AT.y, `BEST ${ordinal(best.place)}`, { tone: 'dim' });
  createLabel(scene, BEST_TIME_AT.x, BEST_TIME_AT.y, formatRaceTime(best.ticks), { tone: 'foam' });
}
