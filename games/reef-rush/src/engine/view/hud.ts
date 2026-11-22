/**
 * The race HUD, built from the UI kit to the rects in UI.md and read from the
 * world each frame. Along the top: the place panel (the player's portrait and
 * place numeral, with an arrow and a tone pop when the place changes), the
 * timer, the kick / power-up well (kick readiness, the burst icon with a
 * cooldown ring while it recharges, and a stack slot per power-up the player
 * can hold: three, or four for Nib), and a track-style progress strip
 * with one head per racer and the finish flag. Every piece sits clear of the
 * back link and the touch controls.
 *
 * Over the water: the centre splash (`race-text.ts`), a combo name that pops
 * big then settles after the player fires a combo, and a caption line for what
 * the player can't see (their own status, rival bubbles out of view). Text
 * over the water is foam or sun and outlined. Motion is timed from the world
 * tick and holds still under reduced motion.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { stackMaxFor } from '../../logic/abilities.ts';
import { BURST_COOLDOWN_TICKS } from '../../logic/powerups/tuning.ts';
import { playerOf } from '../../logic/racers.ts';
import {
  type CharacterId,
  type ComboName,
  type PowerUpKind,
  type RacePhase,
  TILE,
  type World,
} from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { IconFrame, type IconFrameKey, PortraitFrame, UiTex } from '../art/ui/keys.ts';
import { UiRamp, type UiToneName } from '../art/ui/palette.ts';
import { createPanel } from '../art/ui/panel.ts';
import { DISPLAY_FACE, TEXT_FACE } from '../art/ui/typeface.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';
import { createRaceSplash, formatRaceTime, ordinal, slideRemaining, TONE_CSS } from './race-text.ts';

/** The race HUD; `onEvents` catches combo bursts and `sync` redraws everything else from the world. */
export interface Hud {
  /** `tick` is the world tick the events were drained at; effects time themselves from it. */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  sync(world: World): void;
}

/** HUD icons are 9x9. */
const ICON_SIZE = 9;
/** UI.md "Race HUD" rects, in game px. */
const PLACE_PANEL = { x: 6, y: 6, w: 56, h: 24 } as const;
const PORTRAIT_AT = { x: 10, y: 10 } as const;
const PLACE_TEXT_AT = { x: 28, y: 12 } as const;
const ARROW_AT = { x: 6, y: 34 } as const;
const TIMER = { x: 66, y: 6, w: 52, h: 15, textTop: 10 } as const;
/** The well's left edge, top and height; its width follows the stack (see `wellLayout`). */
const WELL = { x: 66, y: 23, h: 17 } as const;
const WELL_ICON_Y = 27;
const KICK_X = 70;
const BURST_X = 81;
/** Icons in the well sit this far apart, left edge to left edge: 9 px icons with a 2 px gap. */
const WELL_PITCH = 11;
/** From the last icon's left edge to the well's right edge: the icon, 1 px padding and the 3 px frame. */
const WELL_END = ICON_SIZE + 4;
const STRIP = { x: 122, y: 6, w: 112, h: 15, headY: 10, headFrom: 126, headTo: 223 } as const;
const FLAG_AT = { x: 236, y: 9 } as const;
/**
 * The combo name centres on x 168, the middle of the safe column (x 108-228) that stays clear of
 * the d-pad and A/B zones at every height. Its y follows the player (see `comboCentreY`).
 */
const COMBO_X = 168;
/**
 * How far the combo's nearest edge stays from the player's body centre: half an inflated puffer
 * (24 px tall at 2x) plus a 4 px gap, so the name never covers the sprite.
 */
const COMBO_CLEARANCE = 16;
/** The band the combo may use: under the caption line (y 42-48) and above the bottom margin. */
const COMBO_BAND = { top: 50, bottom: 174 } as const;
const CAPTION_CENTRE = { x: 160, y: 45 } as const;

/** UI.md "Motion": a place arrow slides 4 px in over 8 ticks; the arrow and the numeral's tone last 30. */
const PLACE_POP = { slidePx: 4, slideTicks: 8, ticks: 30 } as const;
/** An icon that is not ready shows at this opacity; `hud.test.ts` holds it to 3:1 on the well. */
export const NOT_READY_ALPHA = 0.5;
const COMBO_TICKS = 60;
/** The combo name is drawn in the display face for this many ticks, then settles to the text face. */
const COMBO_POP_TICKS = 10;
/** A rival bubble this many tiles away, outside the view, gets a caption. */
const THREAT_RANGE_TILES = 10;
const COMBO_TEXT: Record<ComboName, string> = {
  cannonball: 'CANNONBALL!',
  inkTrail: 'INK TRAIL!',
  lanternBubble: 'LANTERN BUBBLE!',
  inkBomb: 'INK BOMB!',
  comet: 'COMET!',
  surfline: 'SURFLINE!',
  inkSquid: 'INK SQUID!',
  bubbleDecoy: 'BUBBLE DECOY!',
};
const POWER_UP_ICON: Record<PowerUpKind, IconFrameKey> = {
  jetFin: IconFrame.jetFin,
  bubbleShield: IconFrame.bubbleShield,
  puffer: IconFrame.puffer,
  inkSac: IconFrame.inkSac,
  glowLantern: IconFrame.glowLantern,
  // Placeholder art until lane 7/b draws the attack kinds.
  homingSquid: IconFrame.inkSac,
  riptide: IconFrame.jetFin,
  undertow: IconFrame.puffer,
  mimic: IconFrame.bubbleShield,
};

/** Adds the HUD for `world`'s race to `scene`, pinned to the screen, with each racer's character on its portrait and head. */
export function createHud(scene: Phaser.Scene, world: World, reducedMotion: boolean): Hud {
  const place = createPlacePanel(scene, playerOf(world).character, reducedMotion);
  const timer = createTimer(scene);
  let shownTime = -1;
  const well = createWell(scene, stackMaxFor(playerOf(world)));
  const strip = createProgressStrip(scene, world);
  const splash = createRaceSplash(scene, reducedMotion);
  const combo = createComboName(scene, reducedMotion);
  const caption = createLabel(scene, CAPTION_CENTRE.x, CAPTION_CENTRE.y, '', {
    tone: 'foam',
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.hud,
  });

  return {
    onEvents(events, tick) {
      for (const event of events) {
        if (event.type === 'burst.fired' && event.id === 'player' && event.combo) combo.fired(event.combo, tick);
      }
    },
    sync(world) {
      place.sync(world);
      const time = raceTime(world);
      // Only format when the shown time changes: frames can outnumber ticks.
      if (time !== shownTime) timer.setText(formatRaceTime(time));
      shownTime = time;
      well.sync(world);
      strip.sync(world);
      splash.sync(world);
      const view = scene.cameras.main.worldView;
      const body = playerOf(world).body;
      combo.sync(world.tick, body.y + body.h / 2 - view.y);
      caption.setText(captionText(world, view));
    },
  };
}

/** A HUD piece redrawn from the world each frame. */
interface WorldView {
  sync(world: World): void;
}

/** Adds a 9x9 UI icon with its top-left corner at (x, y), pinned to the screen. */
function addIcon(scene: Phaser.Scene, x: number, y: number, frame: IconFrameKey): Phaser.GameObjects.Image {
  return scene.add.image(x, y, UiTex.icons, frame).setOrigin(0, 0).setScrollFactor(0).setDepth(Layer.hud);
}

/** What the place panel knows about the player's place between frames. */
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

/** The gold place panel: the player's portrait, place numeral (hidden in the countdown), and the change arrow under it. */
function createPlacePanel(scene: Phaser.Scene, character: CharacterId, reducedMotion: boolean): WorldView {
  const { x, y, w, h } = PLACE_PANEL;
  createPanel(scene, x, y, w, h, 'accent', { fixed: true, depth: Layer.hud });
  scene.add
    .image(PORTRAIT_AT.x, PORTRAIT_AT.y, UiTex.portraits, PortraitFrame[character])
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
      trackPlace(track, world.race.phase, playerOf(world).place, world.tick);
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

/** Where the well's stack slots go and how wide the well is, for a racer who holds `stackMax` power-ups. */
export interface WellLayout {
  /** The well panel's width in px. */
  width: number;
  /** Each stack slot's left edge, oldest first. */
  slotX: number[];
}

/**
 * The well for a stack of `stackMax`: kick and burst, then one slot per power-up, each a pitch
 * further right, and the panel just wide enough to frame the last. Three slots end at x 126; Nib's
 * four end at x 137, still under the progress strip and clear of every safe zone.
 */
export function wellLayout(stackMax: number): WellLayout {
  const slotX = Array.from({ length: stackMax }, (_, index) => BURST_X + WELL_PITCH * (index + 1));
  const last = slotX.at(-1) ?? BURST_X;
  return { width: last + WELL_END - WELL.x, slotX };
}

/**
 * The well: kick readiness, the burst icon (with its cooldown ring while cooling), and a slot per
 * power-up the player can hold, oldest first. The size is fixed for the race from `stackMax`. An
 * empty slot shows a dim socket dot, so the cap reads.
 */
function createWell(scene: Phaser.Scene, stackMax: number): WorldView {
  const layout = wellLayout(stackMax);
  createPanel(scene, WELL.x, WELL.y, layout.width, WELL.h, 'inset', { fixed: true, depth: Layer.hud });
  const kick = addIcon(scene, KICK_X, WELL_ICON_Y, IconFrame.kick);
  const ring = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  const burst = addIcon(scene, BURST_X, WELL_ICON_Y, IconFrame.burst);
  const slots = layout.slotX.map((slotX) => ({
    socket: scene.add
      .rectangle(slotX + SOCKET.inset, WELL_ICON_Y + SOCKET.inset, SOCKET.size, SOCKET.size, UiRamp.dim)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Layer.hud),
    icon: addIcon(scene, slotX, WELL_ICON_Y, IconFrame.jetFin).setVisible(false),
  }));
  let drawnCooldown = -1;

  return {
    sync(world) {
      const player = playerOf(world);
      kick.setAlpha(player.kickCooldown === 0 ? 1 : NOT_READY_ALPHA);
      const burstReady = player.burstCooldown === 0 && player.stack.length > 0;
      burst.setAlpha(burstReady ? 1 : NOT_READY_ALPHA);
      if (player.burstCooldown !== drawnCooldown) drawBurstRing(ring, player.burstCooldown);
      drawnCooldown = player.burstCooldown;
      for (let index = 0; index < slots.length; index++) {
        const slot = slots[index];
        const kind = player.stack[index];
        if (!slot) continue;
        slot.socket.setVisible(kind === undefined);
        slot.icon.setVisible(kind !== undefined);
        if (kind !== undefined) slot.icon.setFrame(POWER_UP_ICON[kind]);
      }
    },
  };
}

/** An empty stack slot's socket: a dim square this size, centred in the 9 px icon cell. */
const SOCKET = { size: 3, inset: 3 } as const;

/**
 * The 1 px square ring around the burst icon, as pixels walked clockwise from top centre. A ring
 * of pixels rather than a stroked arc, so it stays crisp at every integer zoom.
 */
const RING_PIXELS = squareRing(BURST_X - 1, WELL_ICON_Y - 1, ICON_SIZE + 2);

/**
 * Fills the ring in dim as the burst cooldown runs out. There is no ring once the burst is ready:
 * readiness is the icon at full strength, so nothing reads as a selection frame.
 */
function drawBurstRing(ring: Phaser.GameObjects.Graphics, cooldown: number): void {
  ring.clear();
  if (cooldown === 0) return;
  const lit = Math.floor((1 - cooldown / BURST_COOLDOWN_TICKS) * RING_PIXELS.length);
  ring.fillStyle(UiRamp.dim, 1);
  for (let index = 0; index < lit; index++) {
    const pixel = RING_PIXELS[index];
    if (pixel) ring.fillRect(pixel[0], pixel[1], 1, 1);
  }
}

/** Every pixel on the edge of a `size` square at (left, top), clockwise from the middle of the top edge. */
function squareRing(left: number, top: number, size: number): [number, number][] {
  const last = size - 1;
  const edge: [number, number][] = [];
  for (let i = 0; i < last; i++) edge.push([left + i, top]);
  for (let i = 0; i < last; i++) edge.push([left + last, top + i]);
  for (let i = 0; i < last; i++) edge.push([left + last - i, top + last]);
  for (let i = 0; i < last; i++) edge.push([left, top + last - i]);
  const start = Math.floor(size / 2);
  return [...edge.slice(start), ...edge.slice(0, start)];
}

/** The progress strip: a 7x7 head per racer, showing its character, travelling toward the finish flag. */
function createProgressStrip(scene: Phaser.Scene, world: World): WorldView {
  const { x, y, w, h, headY, headFrom, headTo } = STRIP;
  createPanel(scene, x, y, w, h, 'inset', { fixed: true, depth: Layer.hud });
  addIcon(scene, FLAG_AT.x, FLAG_AT.y, IconFrame.finishFlag);
  // The player's head draws at a higher depth than the rivals', so it is never hidden.
  const heads = new Map(
    world.racers.map((racer) => [
      racer.id,
      scene.add
        .image(headFrom, headY, UiTex.heads, PortraitFrame[racer.character])
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(racer.id === 'player' ? Layer.banner : Layer.hud),
    ]),
  );
  // Distance to the finish from the furthest start, fixed at the first sync; heads show the share of it covered.
  let courseLength: number | null = null;

  return {
    sync(world) {
      courseLength ??= longestStart(world);
      for (const racer of world.racers) {
        const fraction = racer.finished ? 1 : 1 - racer.progress / courseLength;
        heads.get(racer.id)?.setX(Math.round(headFrom + clampUnit(fraction) * (headTo - headFrom)));
      }
    },
  };
}

/** The combo name over the water, started by the player's combo bursts. */
interface ComboNameView {
  fired(name: ComboName, tick: number): void;
  /** `playerY` is the player's body centre in screen px. */
  sync(tick: number, playerY: number): void;
}

/**
 * Where the combo name centres vertically, in screen px, for text `height` px tall: above the
 * player when there is room under the caption line, else below, kept inside the band either way.
 */
export function comboCentreY(playerY: number, height: number): number {
  const half = Math.ceil(height / 2);
  const above = playerY - COMBO_CLEARANCE - half;
  if (above - half >= COMBO_BAND.top) return Math.round(above);
  const below = Math.min(playerY + COMBO_CLEARANCE + half, COMBO_BAND.bottom - half);
  return Math.round(Math.max(below, COMBO_BAND.top + half));
}

/** The combo name: the display face for its first ticks, then the text face, then gone. */
function createComboName(scene: Phaser.Scene, reducedMotion: boolean): ComboNameView {
  const options = { tone: 'sun', outline: true, align: 'center', fixed: true, depth: Layer.banner } as const;
  // Anchored at y 0 and moved with setOffset, so the name can follow the player.
  const big = createLabel(scene, COMBO_X, 0, '', { ...options, size: 'display' });
  const small = createLabel(scene, COMBO_X, 0, '', options);
  let text = '';
  let firedAt = Number.NEGATIVE_INFINITY;
  return {
    fired(name, tick) {
      text = COMBO_TEXT[name];
      firedAt = tick;
    },
    sync(tick, playerY) {
      const age = tick - firedAt;
      const shown = age >= 0 && age < COMBO_TICKS;
      // Under reduced motion the name doesn't jump between sizes; it shows settled.
      const popping = !reducedMotion && age < COMBO_POP_TICKS;
      big.setText(shown && popping ? text : '');
      small.setText(shown && !popping ? text : '');
      if (!shown) return;
      const label = popping ? big : small;
      label.setOffset(0, comboCentreY(playerY, popping ? DISPLAY_FACE.height : TEXT_FACE.height));
    },
  };
}

/** Status of the player, else a rival bubble nearby but out of view, else nothing. */
function captionText(world: World, view: Phaser.Geom.Rectangle): string {
  const player = playerOf(world);
  const { status } = player;
  if (status.trapped > 0) return 'TRAPPED!';
  if (status.stunned > 0) return 'STUNNED!';
  if (status.slowed > 0) return 'SLOWED BY INK';
  const px = player.body.x + player.body.w / 2;
  const py = player.body.y + player.body.h / 2;
  for (const bubble of world.bubbles) {
    if (bubble.owner === 'player' || view.contains(bubble.x, bubble.y)) continue;
    if (Math.hypot(bubble.x - px, bubble.y - py) > THREAT_RANGE_TILES * TILE) continue;
    const dx = bubble.x - view.centerX;
    const dy = bubble.y - view.centerY;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? '< BUBBLE' : 'BUBBLE >';
    return dy < 0 ? '^ BUBBLE' : 'v BUBBLE';
  }
  return '';
}

function longestStart(world: World): number {
  const finite = world.racers.map((racer) => racer.progress).filter(Number.isFinite);
  return Math.max(1, ...finite);
}

/** Ticks shown on the timer: zero in the countdown, the player's finish time once they cross. */
function raceTime(world: World): number {
  const { race } = world;
  if (race.phase === 'countdown') return 0;
  return playerOf(world).finished?.tick ?? race.raceTick;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
