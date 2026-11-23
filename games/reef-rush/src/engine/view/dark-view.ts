/**
 * Darkness over the course's dark zones (`level.dark`, inclusive tile-column
 * ranges, merged once): a veil in the course theme's dark tint across each zone's columns on
 * screen, faded in at its ends, with a pool of light cut around every racer.
 * The local racer's pool (the slot the screen follows) is the widest and leans ahead along their velocity, and a
 * racer with a Glow Lantern selected has a bigger one still. Urchins and jellies inside a zone
 * show a faint glint above the veil, so a hazard reads before it is lit. A Mimic decoy carries the
 * rival's pool (it is meant to pass for the racer), and a Homing Squid a small one (`SQUID_LIGHT_RADIUS`),
 * so the thing hunting the player can be seen coming. A
 * local racer who sees in the dark (`racerSeesInDark`, Selene's Moonlight) gets
 * only a light tint that says "this is a dark zone".
 *
 * Cheap on phones by design: one screen-sized render texture, redrawn only
 * while a zone is on screen and only when the tick or the scroll changed,
 * with a handful of rectangle fills and one erase stamp per racer from light
 * textures built at create. Nothing is done per pixel per frame and the
 * per-frame path allocates nothing. It draws under the HUD layer, so the HUD
 * always shows. The numbers live in `dark-math.ts`.
 *
 * Light pools flicker by a pixel or two, changing at most three times a second
 * (the UI.md flash rule), timed from the world tick so captures repeat; under
 * reduced motion the pools hold still and the darkness is otherwise the same.
 */
import Phaser from 'phaser';
import { racerSeesInDark } from '../../logic/abilities.ts';
import { selectedItem } from '../../logic/powerups/inventory.ts';
import { TILE, type Vec, type World } from '../../logic/types.ts';
import { localIdOf, localOf } from '../local-racer.ts';
import type { DarkTint } from '../themes/types.ts';
import {
  FADE,
  fadeSteps,
  flicker,
  leadOffset,
  lightOpacity,
  lightRadius,
  mergeZones,
  reachableRadii,
  type Span,
  spansOnScreen,
} from './dark-math.ts';
import { Layer } from './layers.ts';

/** The darkness view; `sync` redraws it from the world each frame. */
export interface DarkView {
  sync(world: World): void;
}

/** Veil opacity for a player who sees through the dark: only a tint. The full veil's colour and opacity come from the theme. */
const SEE_THROUGH_ALPHA = 0.3;
/** Over every world layer and effect, under the HUD so it never hides a readout. */
const VEIL_DEPTH = Layer.hud - 1;
/** Hazard glints sit between the veil and the HUD. */
const GLINT_DEPTH = Layer.hud - 0.5;
/** Each glint: a 5x5 plus with a bright centre, in the hazard's warning colour, faint. */
const GLINTS = {
  urchin: { key: 'dark-glint-urchin', colour: 0xff8a7a, alpha: 0.55 },
  jelly: { key: 'dark-glint-jelly', colour: 0xe0b8ff, alpha: 0.6 },
} as const;
/** A squid's pool: enough to see its shape, far less than a racer's. */
const SQUID_LIGHT_RADIUS = 14;
/** Stamping a light pool erases it from the veil. */
const ERASE_STAMP = { blendMode: Phaser.BlendModes.ERASE } as const;

/** Adds the darkness for `world`'s course to `scene`, veiled in `tint` (the course theme's). With no dark zones it draws nothing. */
export function createDarkView(scene: Phaser.Scene, world: World, tint: DarkTint, reducedMotion: boolean): DarkView {
  const zones = mergeZones(world.level.dark);
  if (zones.length === 0) return { sync() {} };
  // Every pool texture up front, so the first lantern pickup in the dark doesn't hitch.
  const lightKeys = new Map(reachableRadii().map((radius) => [radius, ensureLightTexture(scene, radius)]));
  const squidKey = ensureLightTexture(scene, SQUID_LIGHT_RADIUS);
  addGlints(scene, world, zones);
  const camera = scene.cameras.main;
  const { width, height } = camera;
  const veil = scene.add
    .renderTexture(0, 0, width, height)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(VEIL_DEPTH)
    .setVisible(false);
  const local = localIdOf(world);
  const seesThrough = racerSeesInDark(localOf(world));
  const veilTint: DarkTint = { colour: tint.colour, alpha: seesThrough ? SEE_THROUGH_ALPHA : tint.alpha };
  const spans: Span[] = [];
  const drawn = { tick: -1, left: Number.NaN, top: Number.NaN };

  return {
    sync(current) {
      // The scroll, not worldView: the camera was just moved this frame and worldView catches up only at render.
      const left = Math.round(camera.scrollX);
      const top = Math.round(camera.scrollY);
      // Racers only move on ticks, so with the same tick and scroll the last drawing still stands.
      if (current.tick === drawn.tick && left === drawn.left && top === drawn.top) return;
      drawn.tick = current.tick;
      drawn.left = left;
      drawn.top = top;
      const count = spansOnScreen(zones, left, width, spans);
      veil.setVisible(count > 0);
      if (count === 0) return;
      veil.clear();
      for (let index = 0; index < count; index++) {
        const span = spans[index];
        if (span) fillZone(veil, span, height, veilTint);
      }
      if (!seesThrough) {
        for (let index = 0; index < current.racers.length; index++) {
          const racer = current.racers[index];
          if (!racer) continue;
          const isLocal = racer.id === local;
          const reach = lightRadius(isLocal, selectedItem(racer)?.kind === 'glowLantern');
          const key = lightKeys.get(reach - flicker(current.tick, index, reducedMotion));
          if (!key) continue;
          const { x, y, w, h, vx, vy } = racer.body;
          // Only the local racer's pool leans ahead: it's what the player steers by.
          const cx = Math.round(x + w / 2) + (isLocal ? leadOffset(vx) : 0) - left;
          const cy = Math.round(y + h / 2) + (isLocal ? leadOffset(vy) : 0) - top;
          veil.stamp(key, undefined, cx, cy, ERASE_STAMP);
        }
      }
      if (!seesThrough) {
        const rivalReach = lightRadius(false, false);
        for (let index = 0; index < current.decoys.length; index++) {
          const decoy = current.decoys[index];
          const key =
            decoy && lightKeys.get(rivalReach - flicker(current.tick, current.racers.length + index, reducedMotion));
          if (decoy && key)
            veil.stamp(key, undefined, Math.round(decoy.x) - left, Math.round(decoy.y) - top, ERASE_STAMP);
        }
        for (const squid of current.squids) {
          veil.stamp(squidKey, undefined, Math.round(squid.x) - left, Math.round(squid.y) - top, ERASE_STAMP);
        }
      }
      veil.render();
    },
  };
}

/** Fills one zone's columns: full veil in the middle, stepping down to nothing at each end, fewer steps when narrow. */
function fillZone(veil: Phaser.GameObjects.RenderTexture, span: Span, height: number, tint: DarkTint): void {
  const { colour, alpha } = tint;
  const steps = fadeSteps(span.right - span.left);
  const fade = steps * FADE.px;
  veil.fill(colour, alpha, span.left + fade, 0, span.right - span.left - 2 * fade, height);
  for (let step = 0; step < steps; step++) {
    const stepAlpha = (alpha * (step + 1)) / (steps + 1);
    veil.fill(colour, stepAlpha, span.left + step * FADE.px, 0, FADE.px, height);
    veil.fill(colour, stepAlpha, span.right - (step + 1) * FADE.px, 0, FADE.px, height);
  }
}

/**
 * A faint glint over every urchin and jelly home inside a dark zone, above the veil. They're placed
 * once: urchins never move, and a jelly bobs only a few px around its home.
 */
function addGlints(scene: Phaser.Scene, world: World, zones: readonly (readonly [number, number])[]): void {
  const inZone = (tile: Vec) => zones.some(([from, to]) => tile.x >= from && tile.x <= to);
  const place = (tiles: readonly Vec[], glint: (typeof GLINTS)[keyof typeof GLINTS]) => {
    const key = ensureGlintTexture(scene, glint.key, glint.colour);
    for (const tile of tiles.filter(inZone)) {
      scene.add
        .image(tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2, key)
        .setAlpha(glint.alpha)
        .setDepth(GLINT_DEPTH);
    }
  };
  place(world.level.urchins, GLINTS.urchin);
  place(world.level.jellies, GLINTS.jelly);
}

/** The 5x5 glint texture in `colour`, built once per game. */
function ensureGlintTexture(scene: Phaser.Scene, key: string, colour: number): string {
  if (scene.textures.exists(key)) return key;
  const graphics = scene.make.graphics({}, false);
  graphics.fillStyle(colour, 1).fillRect(2, 0, 1, 5).fillRect(0, 2, 5, 1);
  graphics.fillStyle(0xffffff, 1).fillRect(2, 2, 1, 1);
  graphics.generateTexture(key, 5, 5);
  graphics.destroy();
  return key;
}

/**
 * The light pool texture for `radius`, built once and kept for the game: opaque inside, then rings
 * of falling opacity to the edge. Erasing with it cuts the pool out of the veil.
 *
 * @throws {Error} When Phaser refuses to make the canvas texture.
 */
function ensureLightTexture(scene: Phaser.Scene, radius: number): string {
  const key = `dark-light-${radius}`;
  if (scene.textures.exists(key)) return key;
  const size = radius * 2;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) throw new Error(`Could not create the ${size}x${size} light texture "${key}" for the dark zones.`);
  const context = texture.getContext();
  const image = context.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Distance from the texture's centre to this pixel's centre.
      const distance = Math.hypot(px + 0.5 - radius, py + 0.5 - radius);
      image.data[(py * size + px) * 4 + 3] = Math.round(255 * lightOpacity(distance, radius));
    }
  }
  context.putImageData(image, 0, 0);
  texture.refresh();
  return key;
}
