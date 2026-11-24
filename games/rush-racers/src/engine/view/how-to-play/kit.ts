/**
 * What every How to Play page is built from: a way to add sprites, words, glyphs and wells that the
 * page then shows and hides as one, and the small bits of motion maths the pages share. Pages are
 * made of the game's real sprites and UI kit, drawn over the same water as the title, so words
 * are foam or sun and outlined (UI.md "Text over the water").
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../../../logic/types.ts';
import { createLabel, type Label, type LabelOptions } from '../../art/font.ts';
import { Frame, Tex, type TexKey } from '../../art/keys.ts';
import { type IconFrameKey, UiTex } from '../../art/ui/keys.ts';
import { createPanel } from '../../art/ui/panel.ts';
import type { WorldSkin } from '../../worlds/types.ts';
import { type ActionName, createActionGlyph, createMoveGlyph, type Glyph, type MoveGlyph } from '../control-glyphs.ts';

/** Anything a page owns that can be shown or hidden. */
interface Showable {
  setVisible(visible: boolean): unknown;
}

/** One page: its heading, and how it shows, hides and animates. */
export interface Page {
  /** At most four short words, in capitals. */
  heading: string;
  setVisible(visible: boolean): void;
  /** `tick` counts logic ticks since the page opened, so a page always starts from its first moment. */
  update(tick: number, reducedMotion: boolean): void;
}

/** What a page builder returns: its animation, called with ticks since the page opened. */
type PageAnimation = (tick: number, reducedMotion: boolean) => void;

/** Builds the page's objects through `kit` and returns how it moves. */
export type PageBuilder = (kit: PageKit) => PageAnimation;

/** Adds the things a page is made of, each shown and hidden with the page. */
export interface PageKit {
  /** True on a touch screen, so glyphs draw as on-screen buttons. */
  readonly touch: boolean;
  /** The world skin the pages draw items, pickups and enemies from (the course's world). */
  skin: WorldSkin;
  /** The texture of the racer the player picked, so the pictures show their own character. */
  readonly racer: string;
  /** A sprite centred on (x, y), at a whole-number scale. */
  sprite(x: number, y: number, texture: string, frame: string, scale?: number): Phaser.GameObjects.Image;
  /** A HUD icon, 9x9 at `scale`, centred on (x, y). */
  icon(x: number, y: number, frame: IconFrameKey, scale?: number): Phaser.GameObjects.Image;
  /** Outlined text over the water, anchored by `align` at (x, top). */
  words(x: number, top: number, text: string, options?: LabelOptions): Label;
  /** A control glyph, at `scale` times its normal size. */
  action(action: ActionName, scale?: 1 | 2): Glyph;
  move(): MoveGlyph;
  /** A tiling sprite (a scrolling streak) with its top-left at (x, y). */
  tiles(
    x: number,
    y: number,
    width: number,
    height: number,
    texture: string,
    frame: string,
  ): Phaser.GameObjects.TileSprite;
  /** An inset well like the HUD's, with its top-left at (x, y). */
  well(x: number, y: number, width: number, height: number): void;
  /** A 1 px rectangle, for streaks and trails; centred on (x, y). */
  bar(x: number, y: number, width: number, height: number, colour: number): Phaser.GameObjects.Rectangle;
  /** Hides or shows everything the kit has added. */
  setVisible(visible: boolean): void;
}

/** Creates a kit for one page. */
function createPageKit(scene: Phaser.Scene, touch: boolean, character: CharacterId, skin: WorldSkin): PageKit {
  const owned: Showable[] = [];
  const own = <T extends Showable>(item: T): T => {
    owned.push(item);
    return item;
  };
  return {
    touch,
    skin,
    racer: skin.cast.racers[character],
    sprite: (x, y, texture, frame, scale = 1) => own(scene.add.image(x, y, texture, frame).setScale(scale)),
    icon: (x, y, frame, scale = 1) => own(scene.add.image(x, y, UiTex.icons, frame).setScale(scale)),
    words: (x, top, text, options = {}) =>
      own(createLabel(scene, x, top, text, { outline: true, align: 'center', ...options })),
    action: (action, scale = 1) => own(createActionGlyph(scene, action, touch, { scale })),
    move: () => own(createMoveGlyph(scene, touch)),
    tiles: (x, y, width, height, texture, frame) =>
      own(scene.add.tileSprite(x, y, width, height, texture, frame).setOrigin(0, 0)),
    well(x, y, width, height) {
      own(createPanel(scene, x, y, width, height, 'inset'));
    },
    bar: (x, y, width, height, colour) => own(scene.add.rectangle(x, y, width, height, colour)),
    setVisible(visible) {
      for (const item of owned) item.setVisible(visible);
    },
  };
}

/** A page from its heading and builder. It starts hidden. */
export function createPage(
  scene: Phaser.Scene,
  touch: boolean,
  character: CharacterId,
  skin: WorldSkin,
  heading: string,
  build: PageBuilder,
): Page {
  const kit = createPageKit(scene, touch, character, skin);
  const animate = build(kit);
  kit.setVisible(false);
  return {
    heading,
    setVisible: (visible) => kit.setVisible(visible),
    update: animate,
  };
}

/** Position 0..1 through a repeating `period`, `tick` ticks in. */
export function cycle(tick: number, period: number): number {
  return (tick % period) / period;
}

/** `t` clamped to 0..1, eased out so a move settles instead of stopping dead. */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) * (1 - clamped);
}

/** Two-frame swim stroke for `tick`, still on the first frame under reduced motion. */
export function stroke(tick: number, reducedMotion: boolean): string {
  return reducedMotion || Math.floor(tick / 8) % 2 === 0 ? Frame.a : Frame.b;
}
