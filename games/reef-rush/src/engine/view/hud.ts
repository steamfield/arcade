/**
 * The race HUD, read entirely from the world each frame: the player's place in
 * big type, the race timer, a kick-ready pip, a progress strip across the top
 * with one marker per racer (each a different shape and colour), and the
 * centre banner for 3-2-1-GO and the finish. It sits in the top-left so it
 * stays clear of the shell's back link and the touch controls.
 *
 * Phase 3 adds three power-up stack slots with icons and a burst cooldown ring
 * (bottom-left), a combo name that pops for 60 ticks after the player fires a
 * combo, and a caption line for what the player can't see: their own status and
 * rival bubbles outside the camera.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { BURST_COOLDOWN_TICKS, STACK_MAX } from '../../logic/powerups/tuning.ts';
import { playerOf } from '../../logic/racers.ts';
import { type ComboName, type RacerId, TILE, type World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { Frame, type FrameKey, Tex } from '../art/keys.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';
import { POWER_UP_TEX } from './powerup-view.ts';
import { formatRaceTime, ordinal } from './race-text.ts';

/** The race HUD; `onEvents` catches combo bursts and `sync` redraws everything else from the world. */
export interface Hud {
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
  sync(world: World): void;
}

/** Slot row and burst ring geometry in screen px, bottom-left but clear of the touch d-pad (about 50 px wide). */
const SLOTS = { x: 68, y: 166, size: 14, gap: 2 } as const;
const RING = { x: 58, y: 166, radius: 7 } as const;
const COMBO_TICKS = 60;
/** The combo name is drawn big for this many ticks, then settles to a smaller size. */
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

/** Progress strip geometry in screen px. It stops short of the top-right corner, where the back link sits. */
const STRIP = { left: 10, right: 236, y: 7 } as const;
const MARKER_FRAME: Record<RacerId, FrameKey> = {
  player: Frame.markerCircle,
  tess: Frame.markerSquare,
  squib: Frame.markerTriangle,
  bo: Frame.markerDiamond,
};

const COUNTDOWN_TICKS_PER_NUMBER = 60;
/** How long "GO!" stays up after the start, in race ticks. */
const GO_TICKS = 45;

/** Adds the HUD to `scene`, pinned to the screen. */
export function createHud(scene: Phaser.Scene, reducedMotion: boolean): Hud {
  const { width, height } = scene.cameras.main;
  drawStripTrack(scene);
  const markers = createMarkers(scene);
  const place = createLabel(scene, 8, 14, '', { size: 'large', color: '#ffd23f', fixed: true, depth: Layer.hud });
  const timer = createLabel(scene, 46, 20, '', { size: 'medium', fixed: true, depth: Layer.hud });
  const kickPip = scene.add.image(50, 37, Tex.kickPip, Frame.pipReady).setScrollFactor(0).setDepth(Layer.hud);
  const kickLabel = createLabel(scene, 56, 33, 'kick', { size: 'small', fixed: true, depth: Layer.hud });
  const banner = createLabel(scene, width / 2, height / 2 - 24, '', {
    size: 'title',
    color: '#ffd23f',
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  const stack = createStackSlots(scene);
  const ring = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  const comboBig = createLabel(scene, width / 2, height / 2 + 14, '', {
    size: 'large',
    color: '#ff8fd1',
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  const comboSmall = createLabel(scene, width / 2, height / 2 + 14, '', {
    size: 'medium',
    color: '#ff8fd1',
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  const caption = createLabel(scene, width / 2, 36, '', {
    size: 'small',
    color: '#ffe08a',
    align: 'center',
    fixed: true,
    depth: Layer.hud,
  });
  let comboText = '';
  let comboPending: ComboName | null = null;
  let comboStartedAt = Number.NEGATIVE_INFINITY;
  let drawnCooldown = -1;
  // Distance to the finish from the furthest start, fixed at the first sync; markers show the share of it covered.
  let courseLength: number | null = null;

  return {
    onEvents(events) {
      for (const event of events)
        if (event.type === 'burst.fired' && event.id === 'player' && event.combo) comboPending = event.combo;
    },
    sync(world) {
      courseLength ??= longestStart(world);
      const player = playerOf(world);
      place.setText(ordinal(player.place));
      timer.setText(formatRaceTime(raceTime(world)));
      const kickReady = player.kickCooldown === 0;
      kickPip.setFrame(kickReady ? Frame.pipReady : Frame.pipCooling);
      kickLabel.setColor(kickReady ? '#7fdbff' : '#6a8aa6');
      banner.setText(bannerText(world));
      for (const racer of world.racers) {
        const fraction = racer.finished ? 1 : 1 - racer.progress / courseLength;
        markers[racer.id].setX(Math.round(STRIP.left + clampUnit(fraction) * (STRIP.right - STRIP.left)));
      }
      showStack(stack, player.stack);
      if (player.burstCooldown !== drawnCooldown) {
        drawnCooldown = player.burstCooldown;
        drawBurstRing(ring, drawnCooldown, player.stack.length > 0);
      }
      if (comboPending) {
        comboText = COMBO_TEXT[comboPending];
        comboStartedAt = world.tick;
        comboPending = null;
      }
      const comboAge = world.tick - comboStartedAt;
      const comboShown = comboAge >= 0 && comboAge < COMBO_TICKS;
      const popping = !reducedMotion && comboAge < COMBO_POP_TICKS;
      comboBig.setText(comboShown && popping ? comboText : '');
      comboSmall.setText(comboShown && !popping ? comboText : '');
      caption.setText(captionText(world, scene.cameras.main.worldView));
    },
  };
}

interface StackSlot {
  icon: Phaser.GameObjects.Image;
}

/** Draws the empty slot frames and an icon per slot that `showStack` fills. */
function createStackSlots(scene: Phaser.Scene): StackSlot[] {
  const frames = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  return Array.from({ length: STACK_MAX }, (_, index) => {
    const x = SLOTS.x + index * (SLOTS.size + SLOTS.gap);
    frames.fillStyle(0x0b1d33, 0.7).fillRect(x, SLOTS.y - SLOTS.size / 2, SLOTS.size, SLOTS.size);
    const icon = scene.add
      .image(x + SLOTS.size / 2, SLOTS.y, Tex.jetFin, Frame.a)
      .setScrollFactor(0)
      .setDepth(Layer.hud)
      .setVisible(false);
    return { icon };
  });
}

/** Shows each held power-up's icon in its slot, oldest first, and hides the rest. */
function showStack(slots: StackSlot[], held: readonly (keyof typeof POWER_UP_TEX)[]): void {
  slots.forEach(({ icon }, index) => {
    const kind = held[index];
    icon.setVisible(kind !== undefined);
    if (kind !== undefined) icon.setTexture(POWER_UP_TEX[kind], Frame.a);
  });
}

/** A ring that fills as the burst cooldown runs out; full and bright when a burst is ready, dim with an empty stack. */
function drawBurstRing(ring: Phaser.GameObjects.Graphics, cooldown: number, hasStack: boolean): void {
  const ready = cooldown === 0;
  const filled = 1 - cooldown / BURST_COOLDOWN_TICKS;
  const start = -Math.PI / 2;
  ring.clear().lineStyle(2, 0x2a4a6a, 1).strokeCircle(RING.x, RING.y, RING.radius);
  if (!ready) {
    ring
      .lineStyle(2, 0x7fdbff, 1)
      .beginPath()
      .arc(RING.x, RING.y, RING.radius, start, start + filled * Math.PI * 2)
      .strokePath();
    return;
  }
  ring.lineStyle(2, hasStack ? 0xffd23f : 0x4a6a86, 1).strokeCircle(RING.x, RING.y, RING.radius);
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
    if (Math.hypot(bubble.x - px, bubble.y - py) <= THREAT_RANGE_TILES * TILE)
      return bubble.x < view.x ? '< BUBBLE' : 'BUBBLE >';
  }
  return '';
}

function drawStripTrack(scene: Phaser.Scene): void {
  const track = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  track.fillStyle(0x0b1d33, 0.7).fillRect(STRIP.left - 4, STRIP.y - 5, STRIP.right - STRIP.left + 8, 10);
  track.fillStyle(0x9fe7ff, 1).fillRect(STRIP.left, STRIP.y, STRIP.right - STRIP.left, 1);
  track.fillStyle(0xffffff, 1).fillRect(STRIP.right, STRIP.y - 4, 1, 9);
}

function createMarkers(scene: Phaser.Scene): Record<RacerId, Phaser.GameObjects.Image> {
  const marker = (id: RacerId) =>
    scene.add
      .image(STRIP.left, STRIP.y, Tex.hudMarker, MARKER_FRAME[id])
      .setScrollFactor(0)
      // The player's marker draws on top so it never hides behind a rival's.
      .setDepth(id === 'player' ? Layer.banner : Layer.hud);
  return { player: marker('player'), tess: marker('tess'), squib: marker('squib'), bo: marker('bo') };
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

function bannerText(world: World): string {
  const { race } = world;
  if (race.phase === 'countdown')
    return String(Math.max(1, 3 - Math.floor(race.raceTick / COUNTDOWN_TICKS_PER_NUMBER)));
  if (race.phase === 'racing') return race.raceTick < GO_TICKS ? 'GO!' : '';
  return race.result?.playerTicks === null ? 'DNF' : 'FINISH!';
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
