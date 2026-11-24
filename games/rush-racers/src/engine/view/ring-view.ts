/**
 * The course's boost rings (`level.rings`) on the race screen, drawn from world state each frame,
 * with a sparkle when the local racer passes one (`ring.passed`). A ring the local racer has passed
 * (`world.ringsPassed`) looks spent for it, while rivals can still pass it. Rings are global art,
 * code-drawn, until a sky theme restyles them.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { TILE, type World } from '../../logic/types.ts';
import { drawFrames, type NamedFrame } from '../art/pixel.ts';
import { localIdOf } from '../local-racer.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';

/** The rings; `sync` redraws them from the world, `onEvents` hears the passes drained on world tick `tick`. */
export interface RingView {
  sync(world: World, tick: number): void;
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
}

/** How one ring looks on one frame. */
export interface RingLook {
  frame: RingFrame;
  scale: number;
  /** Whole px added to the ring's y, for its idle bob. */
  bob: number;
  alpha: number;
}

/** Texture key for the ring sheet, drawn once per game. */
export const RING_TEXTURE = 'sky-ring';

/** Frame names inside `RING_TEXTURE`. */
export const RingFrame = { ready: 'ready', spent: 'spent' } as const;
export type RingFrame = (typeof RingFrame)[keyof typeof RingFrame];

/** A pass sparkles for this many ticks: the ring swells and eases back before it looks spent. */
export const SPARKLE_TICKS = 18;
/** How much bigger a ring is at the start of its sparkle. */
const SPARKLE_GROW = 0.5;
const BOB_PERIOD_TICKS = 90;
/** Each ring's bob trails the one before it by this many ticks, so a line of rings ripples. */
const BOB_STAGGER_TICKS = 12;
const BOB_PX = 1;
const SPENT_ALPHA = 0.55;

/** A hoop seen side on, 12x20: rim `0`, body `1`, shine `2` on the upper left. */
const RING_ROWS = [
  '....0000....',
  '..00222200..',
  '.0221111220.',
  '.021....120.',
  ...Array.from({ length: 6 }, () => '021......120'),
  ...Array.from({ length: 6 }, () => '011......110'),
  '.011....110.',
  '.0111111110.',
  '..00111100..',
  '....0000....',
];

const RING_FRAMES: readonly NamedFrame[] = [
  { name: RingFrame.ready, rows: RING_ROWS, palette: [0x8a4a00, 0xf0b028, 0xfff4b0] },
  { name: RingFrame.spent, rows: RING_ROWS, palette: [0x3a3c50, 0x707890, 0x9aa2b8] },
];

/**
 * Adds the rings of `world`'s level to `scene`; under `reducedMotion` they hold still.
 *
 * @throws {Error} When the ring pixel text is malformed (see `drawFrames`).
 */
export function createRingView(scene: Phaser.Scene, world: World, reducedMotion: boolean): RingView {
  if (!scene.textures.exists(RING_TEXTURE)) drawFrames(scene, RING_TEXTURE, RING_FRAMES);
  const centre = (tile: number) => tile * TILE + TILE / 2;
  const rings = world.level.rings.map((tile) => ({
    restY: centre(tile.y),
    sprite: scene.add.image(centre(tile.x), centre(tile.y), RING_TEXTURE, RingFrame.ready).setDepth(Layer.objects),
  }));
  /** The world tick the local racer passed each ring on, by ring index. */
  const passedOn = new Map<number, number>();

  return {
    sync(current, tick) {
      const passed = current.ringsPassed[localIdOf(current)] ?? [];
      rings.forEach(({ restY, sprite }, index) => {
        const passTick = passedOn.get(index);
        const sparkleAge = passTick === undefined ? null : tick - passTick;
        const look = ringLook(passed.includes(index), sparkleAge, tick, index, reducedMotion);
        sprite
          .setFrame(look.frame)
          .setScale(look.scale)
          .setAlpha(look.alpha)
          .setY(restY + look.bob);
      });
    },
    onEvents(events, tick) {
      const local = localIdOf(world);
      for (const event of events) {
        if (event.type === 'ring.passed' && event.id === local) passedOn.set(event.ring, tick);
      }
    },
  };
}

/**
 * How ring `index` looks on world tick `tick`. A ring the local racer hasn't passed is gold and
 * bobs; one it passed `sparkleAge` ticks ago swells gold and eases back over `SPARKLE_TICKS`, then
 * looks spent (grey, faded). `sparkleAge` is null when the pass wasn't seen on this screen. Under
 * `reducedMotion` nothing bobs or swells: a pass turns the ring spent at once.
 */
export function ringLook(
  spent: boolean,
  sparkleAge: number | null,
  tick: number,
  index: number,
  reducedMotion: boolean,
): RingLook {
  const bob = reducedMotion ? 0 : bobAt(tick + index * BOB_STAGGER_TICKS);
  const sparkling = !reducedMotion && sparkleAge !== null && sparkleAge >= 0 && sparkleAge < SPARKLE_TICKS;
  if (sparkling) {
    const left = 1 - sparkleAge / SPARKLE_TICKS;
    return { frame: RingFrame.ready, scale: 1 + SPARKLE_GROW * left, bob, alpha: 1 };
  }
  if (spent) return { frame: RingFrame.spent, scale: 1, bob, alpha: SPENT_ALPHA };
  return { frame: RingFrame.ready, scale: 1, bob, alpha: 1 };
}

/** The idle bob at `tick`, in whole px. */
function bobAt(tick: number): number {
  return Math.round(Math.sin((2 * Math.PI * tick) / BOB_PERIOD_TICKS) * BOB_PX);
}
