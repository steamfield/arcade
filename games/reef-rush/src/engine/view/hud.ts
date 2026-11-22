/**
 * The race HUD, built from the UI kit to the rects in UI.md and read from the
 * world each frame. Along the top: the place panel (the player's portrait and
 * place numeral, with an arrow and a tone pop when the place changes), the
 * timer, the kick / power-up well (kick readiness, the burst icon inside its
 * cooldown ring, and the three stack slots), and a track-style progress strip
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
import { BURST_COOLDOWN_TICKS, STACK_MAX } from '../../logic/powerups/tuning.ts';
import { playerOf } from '../../logic/racers.ts';
import { type ComboName, type PowerUpKind, type RacerId, TILE, type World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { IconFrame, type IconFrameKey, PortraitFrame, UiTex } from '../art/ui/keys.ts';
import { toneCss, UiColour, UiRamp, type UiToneName } from '../art/ui/palette.ts';
import { createPanel } from '../art/ui/panel.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';
import { createRaceSplash, formatRaceTime, ordinal, slideRemaining } from './race-text.ts';

/** The race HUD; `onEvents` catches combo bursts and `sync` redraws everything else from the world. */
export interface Hud {
  /** `tick` is the world tick the events were drained at; effects time themselves from it. */
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
  sync(world: World): void;
}

/** UI.md "Race HUD" rects, in game px. */
const PLACE_PANEL = { x: 6, y: 6, w: 56, h: 24 } as const;
const PORTRAIT_AT = { x: 10, y: 10 } as const;
const PLACE_TEXT_AT = { x: 28, y: 12 } as const;
const ARROW_AT = { x: 6, y: 34 } as const;
const TIMER = { x: 66, y: 6, w: 52, h: 15, textTop: 10 } as const;
const WELL = { x: 66, y: 23, w: 61, h: 17 } as const;
const WELL_ICON_Y = 27;
const KICK_X = 70;
const BURST_X = 81;
const STACK_X = [92, 103, 114] as const;
const STRIP = { x: 122, y: 6, w: 112, h: 15, headY: 10, headFrom: 126, headTo: 223 } as const;
const FLAG_AT = { x: 236, y: 9 } as const;
const ICON_SIZE = 9;
/**
 * Below the splash the safe column is x 108-228, so text there centres on 168, not the screen's 160.
 * Low in that column, under where the camera usually holds the player.
 */
const COMBO_CENTRE = { x: 168, y: 104 } as const;
const CAPTION_CENTRE = { x: 160, y: 45 } as const;

/** UI.md "Motion": a place arrow slides 4 px in over 8 ticks; the arrow and the numeral's tone last 30. */
const PLACE_POP = { slidePx: 4, slideTicks: 8, ticks: 30 } as const;
/** An icon that is not ready shows at this opacity. */
const NOT_READY_ALPHA = 0.35;
const COMBO_TICKS = 60;
/** The combo name is drawn in the display face for this many ticks, then settles to the text face. */
const COMBO_POP_TICKS = 10;
/** A rival bubble this many tiles away, outside the view, gets a caption. */
const THREAT_RANGE_TILES = 10;
const COMBO_TEXT: Record<ComboName, string> = {
  cannonball: 'CANNONBALL!',
  inkTrail: 'INK TRAIL!',
  seekerBubble: 'SEEKER BUBBLE!',
  inkBomb: 'INK BOMB!',
  comet: 'COMET!',
};
const POWER_UP_ICON: Record<PowerUpKind, IconFrameKey> = {
  jetFin: IconFrame.jetFin,
  bubbleShield: IconFrame.bubbleShield,
  puffer: IconFrame.puffer,
  inkSac: IconFrame.inkSac,
  glowLantern: IconFrame.glowLantern,
};

/** Adds the HUD to `scene`, pinned to the screen. */
export function createHud(scene: Phaser.Scene, reducedMotion: boolean): Hud {
  const place = createPlacePanel(scene, reducedMotion);
  const timer = createTimer(scene);
  const well = createWell(scene);
  const strip = createProgressStrip(scene);
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
      timer.setText(formatRaceTime(raceTime(world)));
      well.sync(world);
      strip.sync(world);
      splash.sync(world);
      combo.sync(world.tick);
      caption.setText(captionText(world, scene.cameras.main.worldView));
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

/** The gold place panel: portrait, place numeral, and the change arrow under it. */
function createPlacePanel(scene: Phaser.Scene, reducedMotion: boolean): WorldView {
  const { x, y, w, h } = PLACE_PANEL;
  createPanel(scene, x, y, w, h, 'accent', { fixed: true, depth: Layer.hud });
  scene.add
    .image(PORTRAIT_AT.x, PORTRAIT_AT.y, UiTex.portraits, PortraitFrame.player)
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
  let shownPlace: number | null = null;
  let change: { up: boolean; at: number } | null = null;

  return {
    sync(world) {
      const { place } = playerOf(world);
      if (shownPlace !== null && place !== shownPlace) change = { up: place < shownPlace, at: world.tick };
      shownPlace = place;
      numeral.setText(ordinal(place));
      const age = change ? world.tick - change.at : Number.POSITIVE_INFINITY;
      const popping = change !== null && age >= 0 && age < PLACE_POP.ticks;
      numeral.setColor(toneCss(popping ? placePopTone(change?.up ?? true) : 'sun'));
      arrow.setVisible(popping);
      if (!popping || !change) return;
      // The arrow travels the way the place went: up into place from below, or down from above.
      const still = slideRemaining(age, PLACE_POP.slidePx, PLACE_POP.slideTicks, reducedMotion);
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

/** The well: kick readiness, the burst icon in its cooldown ring, and the stack slots, oldest first. */
function createWell(scene: Phaser.Scene): WorldView {
  const { x, y, w, h } = WELL;
  createPanel(scene, x, y, w, h, 'inset', { fixed: true, depth: Layer.hud });
  const kick = addIcon(scene, KICK_X, WELL_ICON_Y, IconFrame.kick);
  const ring = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  const burst = addIcon(scene, BURST_X, WELL_ICON_Y, IconFrame.burst);
  const slots = STACK_X.slice(0, STACK_MAX).map((slotX) =>
    addIcon(scene, slotX, WELL_ICON_Y, IconFrame.jetFin).setVisible(false),
  );
  let drawnRing = '';

  return {
    sync(world) {
      const player = playerOf(world);
      kick.setAlpha(player.kickCooldown === 0 ? 1 : NOT_READY_ALPHA);
      const hasStack = player.stack.length > 0;
      const burstReady = player.burstCooldown === 0 && hasStack;
      burst.setAlpha(burstReady ? 1 : NOT_READY_ALPHA);
      const ringKey = `${player.burstCooldown},${hasStack}`;
      if (ringKey !== drawnRing) drawBurstRing(ring, player.burstCooldown, hasStack);
      drawnRing = ringKey;
      slots.forEach((slot, index) => {
        const kind = player.stack[index];
        slot.setVisible(kind !== undefined);
        if (kind !== undefined) slot.setFrame(POWER_UP_ICON[kind]);
      });
    },
  };
}

/**
 * The 1 px square ring around the burst icon, as pixels walked clockwise from top centre. A ring
 * of pixels rather than a stroked arc, so it stays crisp at every integer zoom.
 */
const RING_PIXELS = squareRing(BURST_X - 1, WELL_ICON_Y - 1, ICON_SIZE + 2);

/** Fills the ring as the burst cooldown runs out: gold all round when a burst is ready, empty with nothing held. */
function drawBurstRing(ring: Phaser.GameObjects.Graphics, cooldown: number, hasStack: boolean): void {
  ring.clear();
  if (cooldown === 0 && !hasStack) return;
  const ready = cooldown === 0;
  const lit = ready ? RING_PIXELS.length : Math.floor((1 - cooldown / BURST_COOLDOWN_TICKS) * RING_PIXELS.length);
  ring.fillStyle(ready ? UiColour.sun : UiRamp.dim, 1);
  for (const [px, py] of RING_PIXELS.slice(0, lit)) ring.fillRect(px, py, 1, 1);
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

/** The progress strip: a 7x7 head per racer travelling toward the finish flag. */
function createProgressStrip(scene: Phaser.Scene): WorldView {
  const { x, y, w, h, headY, headFrom, headTo } = STRIP;
  createPanel(scene, x, y, w, h, 'inset', { fixed: true, depth: Layer.hud });
  addIcon(scene, FLAG_AT.x, FLAG_AT.y, IconFrame.finishFlag);
  const head = (id: RacerId) =>
    scene.add.image(headFrom, headY, UiTex.heads, PortraitFrame[id]).setOrigin(0, 0).setScrollFactor(0);
  // Rivals first and the player last at a higher depth, so the player's head is never hidden.
  const heads: Record<RacerId, Phaser.GameObjects.Image> = {
    tess: head('tess').setDepth(Layer.hud),
    squib: head('squib').setDepth(Layer.hud),
    bo: head('bo').setDepth(Layer.hud),
    player: head('player').setDepth(Layer.banner),
  };
  // Distance to the finish from the furthest start, fixed at the first sync; heads show the share of it covered.
  let courseLength: number | null = null;

  return {
    sync(world) {
      courseLength ??= longestStart(world);
      for (const racer of world.racers) {
        const fraction = racer.finished ? 1 : 1 - racer.progress / courseLength;
        heads[racer.id].setX(Math.round(headFrom + clampUnit(fraction) * (headTo - headFrom)));
      }
    },
  };
}

/** The combo name over the water, started by the player's combo bursts. */
interface ComboNameView {
  fired(name: ComboName, tick: number): void;
  sync(tick: number): void;
}

/** The combo name: the display face for its first ticks, then the text face, then gone. */
function createComboName(scene: Phaser.Scene, reducedMotion: boolean): ComboNameView {
  const options = { tone: 'sun', outline: true, align: 'center', fixed: true, depth: Layer.banner } as const;
  const big = createLabel(scene, COMBO_CENTRE.x, COMBO_CENTRE.y, '', { ...options, size: 'display' });
  const small = createLabel(scene, COMBO_CENTRE.x, COMBO_CENTRE.y, '', options);
  let text = '';
  let firedAt = Number.NEGATIVE_INFINITY;
  return {
    fired(name: ComboName, tick: number) {
      text = COMBO_TEXT[name];
      firedAt = tick;
    },
    sync(tick: number) {
      const age = tick - firedAt;
      const shown = age >= 0 && age < COMBO_TICKS;
      // Under reduced motion the name doesn't jump between sizes; it shows settled.
      const popping = !reducedMotion && age < COMBO_POP_TICKS;
      big.setText(shown && popping ? text : '');
      small.setText(shown && !popping ? text : '');
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
