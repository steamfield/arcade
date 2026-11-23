/**
 * The HUD's dash and item well (UI.md "Race HUD"): the dash icon, dimmed while the dash recharges,
 * then one slot per inventory place (three, or four for Nib). A held item shows its icon with its
 * charges as one digit at the slot's lower right; the selected slot wears a 1 px gold frame; an
 * empty slot shows a dim socket dot, so the slot count reads. Slots never move: an item stays in
 * its slot until it is used up or knocked loose. Beside it sits the dash meter: a small panel of
 * pips, one per dash charge, that is not a slot (no icon, no frame, no digit).
 */
import type Phaser from 'phaser';
import { DASH_METER } from '../../logic/powerups/dash-meter.ts';
import { selectedItem, selectedSlot, slotItems } from '../../logic/powerups/inventory.ts';
import { playerOf } from '../../logic/racers.ts';
import type { HeldItem, PowerUpKind, World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { Frame, Tex } from '../art/keys.ts';
import { IconFrame, type IconFrameKey, UiTex } from '../art/ui/keys.ts';
import { UiColour, UiRamp } from '../art/ui/palette.ts';
import { createPanel } from '../art/ui/panel.ts';
import { Layer } from './layers.ts';

/** HUD icons are 9x9. */
const ICON_SIZE = 9;
/** The well's left edge, top and height; its width follows the slot count (see `wellLayout`). */
export const WELL = { x: 66, y: 23, h: 17 } as const;
const WELL_ICON_Y = 27;
const DASH_X = 70;
/**
 * Slots sit this far apart, left edge to left edge: a 9 px icon, its charge digit tucked against
 * its lower right (overlapping the icon's last column), and a gap clear of the digit's outline.
 */
const WELL_PITCH = 16;
/** The charge digit's right edge and top, from the slot's left edge and the icon row. */
const CHARGE_AT = { right: 14, top: 2 } as const;
/** From the last slot's left edge to the well's right edge: the digit and its outline, 1 px padding and the 3 px frame. */
const WELL_END = CHARGE_AT.right + 5;
/** An empty slot's socket: a dim square this size, centred in the 9 px icon cell. */
const SOCKET = { size: 3, inset: 3 } as const;

/** An icon that is not ready shows at this opacity; `hud.test.ts` holds it to 3:1 on the well. */
export const NOT_READY_ALPHA = 0.5;

/** The 9x9 icon each held power-up shows in the well. */
export const POWER_UP_ICON: Record<PowerUpKind, IconFrameKey> = {
  jetFin: IconFrame.jetFin,
  bubbleShield: IconFrame.bubbleShield,
  puffer: IconFrame.puffer,
  inkSac: IconFrame.inkSac,
  glowLantern: IconFrame.glowLantern,
  homingSquid: IconFrame.homingSquid,
  riptide: IconFrame.riptide,
  undertow: IconFrame.undertow,
  mimic: IconFrame.mimic,
  cannonball: IconFrame.cannonball,
};

/** Where the well's item slots go and how wide the well is, for a racer with `slots` inventory slots. */
export interface WellLayout {
  /** The well panel's width in px. */
  width: number;
  /** Each item slot's left edge, slot 0 first. */
  slotX: number[];
}

/**
 * The well for `slots` item slots: the dash icon, then one slot per inventory place, each a pitch
 * further right, and the panel just wide enough to frame the last. Three slots end at x 136;
 * Nib's four end at x 152, still under the progress strip and clear of every safe zone.
 */
export function wellLayout(slots: number): WellLayout {
  const slotX = Array.from({ length: slots }, (_, index) => DASH_X + WELL_PITCH * (index + 1));
  const last = slotX.at(-1) ?? DASH_X;
  return { width: last + WELL_END - WELL.x, slotX };
}

/** The text a slot's charge digit shows: the count, or nothing for an empty slot. */
export function chargeText(item: HeldItem | null): string {
  return item ? String(Math.min(item.charges, 9)) : '';
}

/** Adds a 9x9 UI icon with its top-left corner at (x, y), pinned to the screen. */
export function addHudIcon(scene: Phaser.Scene, x: number, y: number, frame: IconFrameKey): Phaser.GameObjects.Image {
  return scene.add.image(x, y, UiTex.icons, frame).setOrigin(0, 0).setScrollFactor(0).setDepth(Layer.hud);
}

/** One inventory slot's drawn parts. */
interface SlotView {
  socket: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  charges: Label;
}

/** The well, sized for the race from `slots`; `sync` redraws it from the player each frame. */
export function createWell(scene: Phaser.Scene, slots: number): { sync(world: World): void } {
  const layout = wellLayout(slots);
  createPanel(scene, WELL.x, WELL.y, layout.width, WELL.h, 'inset', { fixed: true, depth: Layer.hud });
  const dash = addHudIcon(scene, DASH_X, WELL_ICON_Y, IconFrame.dash);
  const views = layout.slotX.map((slotX) => createSlot(scene, slotX));
  const frame = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  let framedSlot = -1;

  return {
    sync(world) {
      const player = playerOf(world);
      dash.setAlpha(player.kickCooldown === 0 ? 1 : NOT_READY_ALPHA);
      const items = slotItems(player);
      for (const [slot, view] of views.entries()) syncSlot(view, items[slot] ?? null);
      const selected = selectedItem(player) ? selectedSlot(player) : -1;
      if (selected !== framedSlot) drawSelectedFrame(frame, layout.slotX[selected]);
      framedSlot = selected;
    },
  };
}

function createSlot(scene: Phaser.Scene, slotX: number): SlotView {
  return {
    socket: scene.add
      .rectangle(slotX + SOCKET.inset, WELL_ICON_Y + SOCKET.inset, SOCKET.size, SOCKET.size, UiRamp.dim)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Layer.hud),
    icon: addHudIcon(scene, slotX, WELL_ICON_Y, IconFrame.jetFin).setVisible(false),
    charges: createLabel(scene, slotX + CHARGE_AT.right, WELL_ICON_Y + CHARGE_AT.top, '', {
      align: 'right',
      outline: true,
      fixed: true,
      depth: Layer.hud + 0.1,
    }),
  };
}

function syncSlot(view: SlotView, item: HeldItem | null): void {
  view.socket.setVisible(item === null);
  view.icon.setVisible(item !== null);
  if (item) view.icon.setFrame(POWER_UP_ICON[item.kind]);
  view.charges.setText(chargeText(item));
}

/** The 1 px gold square around the selected slot's icon, or nothing when no slot is selected. */
function drawSelectedFrame(frame: Phaser.GameObjects.Graphics, slotX: number | undefined): void {
  frame.clear();
  if (slotX === undefined) return;
  frame.lineStyle(1, UiColour.sun, 1);
  frame.strokeRect(slotX - 0.5, WELL_ICON_Y - 0.5, ICON_SIZE + 1, ICON_SIZE + 1);
}

/** The dash meter's panel, 4 px right of the well: two 6x6 pips 4 px apart, 4 px in from the frame. */
const METER = { gap: 4, pad: 4, pip: 6, pipGap: 4, pipTop: 28 } as const;
const METER_WIDTH = METER.pad * 2 + METER.pip * DASH_METER.charges + METER.pipGap * (DASH_METER.charges - 1);

/** A pip that has just come back swells to this scale and settles over `ticks` world ticks. */
const PIP_POP = { scale: 1.6, ticks: 12 } as const;
/** A spent pip is drawn at this opacity as well as hollow, so it reads as empty on a glance. */
const SPENT_PIP_ALPHA = 0.6;

/** Each pip's frame: filled while its charge is held, a hollow ring once spent. */
export function dashPipFrames(charges: number): string[] {
  return Array.from({ length: DASH_METER.charges }, (_, pip) => (pip < charges ? Frame.pipReady : Frame.pipCooling));
}

/** What the meter knows about the player's charges between frames. */
export interface ChargeTrack {
  /** The charge count last shown, or null before the first frame (no baseline, so no pop). */
  shown: number | null;
  /** The pip that last came back (its 0-based position) and the tick it did. */
  refilled: { pip: number; at: number } | null;
}

/** Updates `track` for this frame: a rise in charges marks the newest pip as refilled on `tick`. */
export function trackDashCharges(track: ChargeTrack, charges: number, tick: number): void {
  if (track.shown !== null && charges > track.shown) track.refilled = { pip: charges - 1, at: tick };
  track.shown = charges;
}

/** The scale pip `pip` is drawn at on `tick`: swelling from the moment it refilled, still under reduced motion. */
export function pipScale(track: ChargeTrack, pip: number, tick: number, reducedMotion: boolean): number {
  const { refilled } = track;
  if (reducedMotion || !refilled || refilled.pip !== pip) return 1;
  const age = tick - refilled.at;
  if (age < 0 || age >= PIP_POP.ticks) return 1;
  return 1 + (PIP_POP.scale - 1) * (1 - age / PIP_POP.ticks);
}

/** The dash meter beside a well of `slots` item slots; `right` is its panel's right edge in px. */
export function createDashMeter(
  scene: Phaser.Scene,
  slots: number,
  reducedMotion: boolean,
): { sync(world: World): void; right: number } {
  const x = WELL.x + wellLayout(slots).width + METER.gap;
  createPanel(scene, x, WELL.y, METER_WIDTH, WELL.h, 'inset', { fixed: true, depth: Layer.hud });
  const centreY = METER.pipTop + METER.pip / 2;
  const pips = dashPipFrames(DASH_METER.charges).map((_, pip) =>
    scene.add
      .image(x + METER.pad + pip * (METER.pip + METER.pipGap) + METER.pip / 2, centreY, Tex.kickPip, Frame.pipReady)
      .setScrollFactor(0)
      .setDepth(Layer.hud),
  );
  const track: ChargeTrack = { shown: null, refilled: null };

  return {
    right: x + METER_WIDTH,
    sync(world) {
      const charges = playerOf(world).kickCharges;
      trackDashCharges(track, charges, world.tick);
      dashPipFrames(charges).forEach((frame, pip) => {
        pips[pip]
          ?.setFrame(frame)
          .setAlpha(frame === Frame.pipReady ? 1 : SPENT_PIP_ALPHA)
          .setScale(pipScale(track, pip, world.tick, reducedMotion));
      });
    },
  };
}
