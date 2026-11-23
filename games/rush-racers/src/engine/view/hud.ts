/**
 * The race HUD, built from the UI kit to the rects in UI.md and read from the
 * world each frame, for the local racer (the slot the screen follows). Along the top: the place
 * panel (the local racer's portrait and place numeral, with an arrow and a tone pop when the place changes), the
 * timer, the dash and item well (`hud-well.ts`), and a track-style progress strip
 * with one head per racer (spread apart when racers bunch, the local racer's never moved
 * unless the strip's end forces it) and the finish flag. Every piece sits clear of the
 * back link and the touch controls.
 *
 * Over the water: the centre splash (`race-text.ts`), a caption line for what
 * the local racer can't see (their own status, a squid locked on, rival bubbles out of view), and
 * the squid warnings in `threat-hud.ts` (an edge arrow, a DASH! prompt). Text
 * over the water is foam or sun and outlined. Motion is timed from the world
 * tick and holds still under reduced motion.
 */
import type Phaser from 'phaser';
import { stackMaxFor } from '../../logic/abilities.ts';
import { courseOf } from '../../logic/courses/index.ts';
import { type RacePhase, TILE, type World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { Frame } from '../art/keys.ts';
import { IconFrame } from '../art/ui/keys.ts';
import type { UiToneName } from '../art/ui/palette.ts';
import { createPanel } from '../art/ui/panel.ts';
import { localIdOf, localOf } from '../local-racer.ts';
import { spreadHeads } from '../race-progress.ts';
import type { ArtRef } from '../worlds/art-ref.ts';
import type { CastSkin } from '../worlds/cast-skin.ts';
import { skinFor } from '../worlds/index.ts';
import { besidePlayerY } from './beside-player.ts';
import { latchPromptShows } from './hints.ts';
import { addHudIcon as addIcon, createDashMeter, createWell } from './hud-well.ts';
import { Layer } from './layers.ts';
import { createRaceSplash, formatRaceTime, ordinal, slideRemaining, TONE_CSS } from './race-text.ts';
import type { ScreenLayout } from './screen-layout.ts';
import { createThreatHud } from './threat-hud.ts';
import { squidHuntingLocal } from './threat-math.ts';

/** The race HUD; `sync` redraws it from the world. */
export interface Hud {
  /** The right edge in px of the HUD's last top-left piece, the pearl counter. */
  readonly right: number;
  sync(world: World): void;
}

/** UI.md "Race HUD" rects, in game px. */
const PLACE_PANEL = { x: 6, y: 6, w: 56, h: 24 } as const;
const PORTRAIT_AT = { x: 10, y: 10 } as const;
const PLACE_TEXT_AT = { x: 28, y: 12 } as const;
const ARROW_AT = { x: 6, y: 34 } as const;
const TIMER = { x: 66, y: 6, w: 52, h: 15, textTop: 10 } as const;
const STRIP = { x: 122, y: 6, w: 112, h: 15, headY: 10, headFrom: 126, headTo: 223 } as const;
/** Heads are 7 px wide; bunched racers are drawn this far apart, so each shows more than half its face. */
const HEAD_MIN_GAP = 5;
const FLAG_AT = { x: 236, y: 9 } as const;
/** UI.md: HUD pieces sit 4 px apart. */
const HUD_GAP = 4;
/** The pearl counter: an `inset` panel level with the well; the 7x7 pearl, then up to two 5 px digits on a 6 px pitch. */
const PEARLS = { y: 23, h: 17, pad: 4, iconY: 28, textTop: 28, textGap: 3, maxShown: 99 } as const;
const PEARL_SIZE = 7;
const PEARLS_WIDTH = PEARLS.pad * 2 + PEARL_SIZE + PEARLS.textGap + 11;
/** The caption line centres on the view's centre at this y. */
const CAPTION_Y = 45;

/** UI.md "Motion": a place arrow slides 4 px in over 8 ticks; the arrow and the numeral's tone last 30. */
const PLACE_POP = { slidePx: 4, slideTicks: 8, ticks: 30 } as const;
/** A rival bubble this many tiles away, outside the view, gets a caption. */
const THREAT_RANGE_TILES = 10;
/**
 * Adds the HUD for `world`'s race to `scene`, pinned to the screen, with each racer's portrait and
 * head drawn from the cast of the course's world.
 */
export function createHud(scene: Phaser.Scene, world: World, reducedMotion: boolean, layout: ScreenLayout): Hud {
  const { cast, objects } = skinFor(courseOf(world));
  const place = createPlacePanel(scene, cast.portraits[localOf(world).character], reducedMotion);
  const timer = createTimer(scene);
  let shownTime = -1;
  const slots = stackMaxFor(localOf(world));
  const well = createWell(scene, slots, objects.itemIcons);
  const meter = createDashMeter(scene, slots, reducedMotion);
  const pearls = createPearlCounter(scene, meter.right + HUD_GAP, objects.pickups.pearl);
  const strip = createProgressStrip(scene, world, cast.heads);
  const splash = createRaceSplash(scene, reducedMotion, layout.centreX);
  const threat = createThreatHud(scene, reducedMotion, (y, height) => besidePlayerY(y, height, layout), layout);
  const caption = createLabel(scene, layout.centreX, CAPTION_Y, '', {
    tone: 'foam',
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.hud,
  });

  return {
    right: pearls.right,
    sync(world) {
      place.sync(world);
      const time = raceTime(world);
      // Only format when the shown time changes: frames can outnumber ticks.
      if (time !== shownTime) timer.setText(formatRaceTime(time));
      shownTime = time;
      well.sync(world);
      meter.sync(world);
      pearls.sync(world);
      strip.sync(world);
      const splashShowing = splash.sync(world);
      const view = scene.cameras.main.worldView;
      threat.sync(world, view, splashShowing);
      caption.setText(captionText(world, view));
    },
  };
}

/** The count the pearl counter shows: the racer's pearls, never more than two digits. */
export function pearlText(pearls: number): string {
  return String(Math.min(pearls, PEARLS.maxShown));
}

/** The pearl counter: the pearl sprite and the local racer's count, under the progress strip and clear of the back link. */
function createPearlCounter(scene: Phaser.Scene, x: number, pearlTexture: string): WorldView & { right: number } {
  createPanel(scene, x, PEARLS.y, PEARLS_WIDTH, PEARLS.h, 'inset', { fixed: true, depth: Layer.hud });
  scene.add
    .image(x + PEARLS.pad, PEARLS.iconY, pearlTexture, Frame.a)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(Layer.hud);
  const count = createLabel(scene, x + PEARLS.pad + PEARL_SIZE + PEARLS.textGap, PEARLS.textTop, '0', {
    fixed: true,
    depth: Layer.hud,
  });
  let shown = 0;
  return {
    right: x + PEARLS_WIDTH,
    sync(world) {
      const pearls = localOf(world).pearls;
      if (pearls === shown) return;
      shown = pearls;
      count.setText(pearlText(pearls));
    },
  };
}

/** A HUD piece redrawn from the world each frame. */
interface WorldView {
  sync(world: World): void;
}

/** What the place panel knows about the local racer's place between frames. */
export interface PlaceTrack {
  /** The place the panel last showed, or null when there is no baseline yet (the countdown). */
  shown: number | null;
  /** The last change: which way and on what world tick. */
  change: { up: boolean; at: number } | null;
}

/**
 * Updates `track` for this frame. The countdown keeps no baseline (logic only places racers once
 * they move), the first racing frame sets one without a pop, and every later change is a pop.
 */
export function trackPlace(track: PlaceTrack, phase: RacePhase, place: number, tick: number): void {
  if (phase === 'countdown') {
    track.shown = null;
    track.change = null;
    return;
  }
  if (track.shown !== null && place !== track.shown) track.change = { up: place < track.shown, at: tick };
  track.shown = place;
}

/** True while a place change is still popping `tick` ticks into the race. */
export function isPlacePopping(track: PlaceTrack, tick: number): boolean {
  if (!track.change) return false;
  const age = tick - track.change.at;
  return age >= 0 && age < PLACE_POP.ticks;
}

/** The gold place panel: the local racer's portrait, place numeral (hidden in the countdown), and the change arrow under it. */
function createPlacePanel(scene: Phaser.Scene, portrait: ArtRef, reducedMotion: boolean): WorldView {
  const { x, y, w, h } = PLACE_PANEL;
  createPanel(scene, x, y, w, h, 'accent', { fixed: true, depth: Layer.hud });
  scene.add
    .image(PORTRAIT_AT.x, PORTRAIT_AT.y, portrait.texture, portrait.frame)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(Layer.hud);
  const numeral = createLabel(scene, PLACE_TEXT_AT.x, PLACE_TEXT_AT.y, '', {
    size: 'display',
    tone: 'sun',
    fixed: true,
    depth: Layer.hud,
  });
  const arrow = addIcon(scene, ARROW_AT.x, ARROW_AT.y, IconFrame.arrowUp).setVisible(false);
  const track: PlaceTrack = { shown: null, change: null };
  let numeralPlace: number | null = null;

  return {
    sync(world) {
      trackPlace(track, world.race.phase, localOf(world).place, world.tick);
      if (track.shown !== numeralPlace) numeral.setText(track.shown === null ? '' : ordinal(track.shown));
      numeralPlace = track.shown;
      const popping = isPlacePopping(track, world.tick);
      const change = track.change;
      numeral.setColor(TONE_CSS[popping && change ? placePopTone(change.up) : 'sun']);
      arrow.setVisible(popping);
      if (!popping || !change) return;
      // The arrow travels the way the place went: up into place from below, or down from above.
      const still = slideRemaining(world.tick - change.at, PLACE_POP.slidePx, PLACE_POP.slideTicks, reducedMotion);
      arrow.setFrame(change.up ? IconFrame.arrowUp : IconFrame.arrowDown);
      arrow.setY(ARROW_AT.y + (change.up ? still : -still));
    },
  };
}

/** A place gained flashes the numeral foam; a place lost flashes it coral. The arrow says which, too. */
function placePopTone(up: boolean): UiToneName {
  return up ? 'foam' : 'coral';
}

function createTimer(scene: Phaser.Scene): Label {
  const { x, y, w, h, textTop } = TIMER;
  createPanel(scene, x, y, w, h, 'inset', { fixed: true, depth: Layer.hud });
  // A centred label is anchored at its middle; the 7 px text face puts its top 3 px above that.
  return createLabel(scene, x + w / 2, textTop + 3, '', { align: 'center', fixed: true, depth: Layer.hud });
}

/** The progress strip: a 7x7 head per racer, showing its character, travelling toward the finish flag. */
function createProgressStrip(scene: Phaser.Scene, world: World, headArt: CastSkin['heads']): WorldView {
  const { x, y, w, h, headY, headFrom, headTo } = STRIP;
  const local = localIdOf(world);
  createPanel(scene, x, y, w, h, 'inset', { fixed: true, depth: Layer.hud });
  addIcon(scene, FLAG_AT.x, FLAG_AT.y, IconFrame.finishFlag);
  // The local racer's head draws at a higher depth than the others', so it is never hidden.
  const heads = new Map(
    world.racers.map((racer) => [
      racer.id,
      scene.add
        .image(headFrom, headY, headArt[racer.character].texture, headArt[racer.character].frame)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(racer.id === local ? Layer.banner : Layer.hud),
    ]),
  );
  // Distance to the finish from the furthest start, fixed at the first sync; heads show the share of it covered.
  let courseLength: number | null = null;

  // Heads move whole pixels, so most frames repeat the last layout: only re-spread when one moved.
  const spots: number[] = world.racers.map(() => Number.NaN);
  let drawn: number[] = [];
  const anchor = Math.max(
    0,
    world.racers.findIndex((racer) => racer.id === local),
  );

  return {
    sync(world) {
      courseLength ??= longestStart(world);
      let moved = false;
      world.racers.forEach((racer, index) => {
        const fraction = racer.finished ? 1 : 1 - racer.progress / (courseLength ?? 1);
        const spot = Math.round(headFrom + clampUnit(fraction) * (headTo - headFrom));
        if (spot === spots[index]) return;
        spots[index] = spot;
        moved = true;
      });
      if (!moved) return;
      drawn = spreadHeads(spots, anchor, HEAD_MIN_GAP, headFrom, headTo);
      world.racers.forEach((racer, index) => {
        heads.get(racer.id)?.setX(drawn[index] ?? headFrom);
      });
    },
  };
}

/** The parts of the camera's view the caption reads. */
export type CaptionView = Pick<Phaser.Geom.Rectangle, 'contains' | 'centerX' | 'centerY'>;

/**
 * The caption line: nothing while the local racer has fallen, else its status (trapped, stunned, or a squid locked on) first, else a
 * rival bubble nearby but out of view, else nothing, in the words of the course's world skin.
 *
 * @throws {Error} When the world's course is unknown or its world has no skin.
 */
export function captionText(world: World, view: CaptionView): string {
  const local = localOf(world);
  const { status } = local;
  // A fallen racer is being put back and needs no warning.
  if (status.fallen > 0) return '';
  // A latched squid's DASH! prompt takes the caption's place, where the medium shows one.
  if (latchPromptShows(world)) return '';
  if (status.trapped > 0) return 'TRAPPED!';
  if (status.stunned > 0) return 'STUNNED!';
  if (squidHuntingLocal(world)) return 'LOCKED ON!';
  const { text } = skinFor(courseOf(world)).objects;
  if (status.slowed > 0) return text.slowedBy;
  const px = local.body.x + local.body.w / 2;
  const py = local.body.y + local.body.h / 2;
  for (const bubble of world.bubbles) {
    if (bubble.owner === local.id || view.contains(bubble.x, bubble.y)) continue;
    if (Math.hypot(bubble.x - px, bubble.y - py) > THREAT_RANGE_TILES * TILE) continue;
    const dx = bubble.x - view.centerX;
    const dy = bubble.y - view.centerY;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? `< ${text.trapped}` : `${text.trapped} >`;
    return dy < 0 ? `^ ${text.trapped}` : `v ${text.trapped}`;
  }
  return '';
}

function longestStart(world: World): number {
  const finite = world.racers.map((racer) => racer.progress).filter(Number.isFinite);
  return Math.max(1, ...finite);
}

/** Ticks shown on the timer: zero in the countdown, the local racer's finish time once they cross. */
function raceTime(world: World): number {
  const { race } = world;
  if (race.phase === 'countdown') return 0;
  return localOf(world).finished?.tick ?? race.raceTick;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
