/**
 * Darkness over the course's dark zones (`level.dark`, inclusive tile-column
 * ranges): a near-black veil across each zone's columns on screen, faded in
 * over its first and last tiles, with a pool of light cut around every racer.
 * A racer holding a Glow Lantern carries a bigger pool. A player whose ability
 * is Moonlight (Selene) sees through the dark, so for them the veil is only a
 * light tint that says "this is a dark zone".
 *
 * Cheap on phones by design: one screen-sized render texture, redrawn per
 * frame only while a zone is on screen, with a handful of rectangle fills and
 * one erase stamp per racer from light textures built once. Nothing is done
 * per pixel per frame. It draws under the HUD layer, so the HUD always shows.
 *
 * Light pools flicker by a pixel or two, changing at most three times a second
 * (the UI.md flash rule), timed from the world tick so captures repeat; under
 * reduced motion the pools hold still and the darkness is otherwise the same.
 */
import Phaser from 'phaser';
import { CHARACTERS } from '../../logic/characters.ts';
import { playerOf } from '../../logic/racers.ts';
import { type Racer, TILE, type World } from '../../logic/types.ts';
import { Layer } from './layers.ts';

/** The darkness view; `sync` redraws it from the world each frame. */
export interface DarkView {
  sync(world: World): void;
}

/** The veil's colour: the deep water's own blue taken almost to black. */
const DARK_COLOUR = 0x020616;
/** Veil opacity in the dark, and for a player who sees through it (only a tint). */
const DARK_ALPHA = 0.9;
const SEE_THROUGH_ALPHA = 0.3;
/** A zone fades in over this many steps of this many px at each end, so it reads as a trench, not a wall. */
const FADE = { steps: 4, px: 8 } as const;

/** Light pool radii in px: the player sees further than a rival's glow shows; a lantern adds reach. */
const LIGHT_RADIUS = { player: 48, rival: 28, lanternBonus: 32 } as const;
/** A pool's edge is four rings this wide, each letting through less light. */
const LIGHT_RING_PX = 4;
const LIGHT_RINGS = 4;
/** The flicker changes a pool's radius at most once per this many ticks (three times a second). */
const FLICKER_TICKS = 20;
/** How far a flicker may shrink a pool, in px. */
const FLICKER_PX = 2;

/** Adds the darkness for `world`'s course to `scene`. With no dark zones it draws nothing. */
export function createDarkView(scene: Phaser.Scene, world: World, reducedMotion: boolean): DarkView {
  const zones = world.level.dark;
  if (zones.length === 0) return { sync() {} };
  const camera = scene.cameras.main;
  const { width, height } = camera;
  const veil = scene.add
    .renderTexture(0, 0, width, height)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    // Over every world layer and effect, under the HUD so it never hides a readout.
    .setDepth(Layer.hud - 1)
    .setVisible(false);
  const seesThrough = CHARACTERS[playerOf(world).character].ability === 'moonlight';
  const alpha = seesThrough ? SEE_THROUGH_ALPHA : DARK_ALPHA;

  return {
    sync(current) {
      // The scroll, not worldView: the camera was just moved this frame and worldView catches up only at render.
      const left = Math.round(camera.scrollX);
      const top = Math.round(camera.scrollY);
      const spans = zones.map(([from, to]) => ({ left: from * TILE - left, right: (to + 1) * TILE - left }));
      const onScreen = spans.filter((span) => span.right > 0 && span.left < width);
      veil.setVisible(onScreen.length > 0);
      if (onScreen.length === 0) return;
      veil.clear();
      for (const span of onScreen) fillZone(veil, span, height, alpha);
      if (!seesThrough) {
        current.racers.forEach((racer, index) => {
          const radius = lightRadius(racer) - flicker(current.tick, index, reducedMotion);
          const { x, y, w, h } = racer.body;
          veil.stamp(
            ensureLightTexture(scene, radius),
            undefined,
            Math.round(x + w / 2) - left,
            Math.round(y + h / 2) - top,
            {
              blendMode: Phaser.BlendModes.ERASE,
            },
          );
        });
      }
      veil.render();
    },
  };
}

/** Fills one zone's on-screen columns: full veil in the middle, stepping down to nothing at each end. */
function fillZone(
  veil: Phaser.GameObjects.RenderTexture,
  span: { left: number; right: number },
  height: number,
  alpha: number,
): void {
  const fade = FADE.steps * FADE.px;
  veil.fill(DARK_COLOUR, alpha, span.left + fade, 0, Math.max(0, span.right - span.left - 2 * fade), height);
  for (let step = 0; step < FADE.steps; step++) {
    const stepAlpha = (alpha * (step + 1)) / (FADE.steps + 1);
    veil.fill(DARK_COLOUR, stepAlpha, span.left + step * FADE.px, 0, FADE.px, height);
    veil.fill(DARK_COLOUR, stepAlpha, span.right - (step + 1) * FADE.px, 0, FADE.px, height);
  }
}

/** How far a racer's light reaches: the player's own, a rival's, plus the lantern's reach if it holds one. */
function lightRadius(racer: Racer): number {
  const base = racer.id === 'player' ? LIGHT_RADIUS.player : LIGHT_RADIUS.rival;
  return base + (racer.stack.includes('glowLantern') ? LIGHT_RADIUS.lanternBonus : 0);
}

/**
 * How many px the racer at `index` loses to flicker at `tick`: 0 to FLICKER_PX, changing at most
 * every FLICKER_TICKS, each racer out of step with the others. Always 0 under reduced motion.
 */
function flicker(tick: number, index: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const step = Math.floor(tick / FLICKER_TICKS) + index * 5;
  // A fixed shuffle of shrink amounts, so the light wavers without a visible rhythm.
  const pattern = [0, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1];
  return Math.min(FLICKER_PX, pattern[step % pattern.length] ?? 0);
}

/**
 * The light pool texture for `radius`, built the first time it is needed and kept for the game:
 * opaque inside, then rings of falling opacity to the edge. Erasing with it cuts the pool out of
 * the veil. Textures are global, so a later race reuses it.
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

/** How much of the veil the pool removes `distance` px from its centre: all of it inside, less in each outer ring, none past the edge. */
function lightOpacity(distance: number, radius: number): number {
  const ringsIn = Math.ceil((radius - distance) / LIGHT_RING_PX);
  if (ringsIn <= 0) return 0;
  return Math.min(1, ringsIn / LIGHT_RINGS);
}
