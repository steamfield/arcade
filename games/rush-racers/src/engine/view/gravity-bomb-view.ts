/**
 * Gravity bombs on the race screen (`world.twists` of style 'gravityBomb'): a dark violet core with
 * a bright rim that pulses, a faint ring where its pull ends (as the well view rings a planet's
 * reach), and ripples that shrink from the ring to the core so the pull reads as inward. Everything
 * is timed by the bomb's own `ttl`, so captures repeat and the picture holds still once twists stop
 * advancing after the finish. Reduced motion keeps the core and ring but stills the pulse and drops
 * the ripples. Redrawn every frame from the twists alone, so a bomb that ends simply stops being
 * drawn. A space theme extra layer.
 */
import type Phaser from 'phaser';
import { GRAVITY_BOMB_TUNING } from '../../logic/powerups/twists/gravity-bomb.ts';
import { TILE, type World } from '../../logic/types.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** What to draw for one gravity bomb on one frame, in world px. */
export interface GravityBombMark {
  x: number;
  y: number;
  /** The core's radius this frame. */
  core: number;
  /** The radius of the ring where its pull ends. */
  reach: number;
  /** Each inward ripple's radius this frame, outermost first; empty under reduced motion. */
  ripples: number[];
}

/** The core: its resting radius, how far the pulse swells and shrinks it, and how many ticks one pulse takes. */
const CORE = { radius: 5, pulse: 1.5, pulseTicks: 30, colour: 0x2a1048, rim: 0xd8a8ff, rimWidth: 2 } as const;
/** A soft glow round the core, so it stands out against the dark sky. */
const GLOW = { radius: 10, colour: 0x9a5cff, alpha: 0.3 } as const;
/** The ring where its pull ends. */
const REACH_RING = { width: 1, colour: 0xc8a8ff, alpha: 0.35 } as const;
/** Ripples: how many at once, the ticks one takes to shrink from the ring to the core, and their look. */
const RIPPLES = { count: 2, ticks: 60, width: 1, colour: 0xb890ff, maxAlpha: 0.5 } as const;

const REACH = GRAVITY_BOMB_TUNING.reachTiles * TILE;

/** One mark per gravity bomb in play, in `world.twists` order; other twist styles are left to their own views. */
export function gravityBombMarks(world: World, reducedMotion: boolean): GravityBombMark[] {
  return world.twists
    .filter((twist) => twist.style === 'gravityBomb')
    .map((bomb) => {
      const age = GRAVITY_BOMB_TUNING.ttlTicks - bomb.ttl;
      return {
        x: bomb.x,
        y: bomb.y,
        core: reducedMotion ? CORE.radius : pulsingCore(age),
        reach: REACH,
        ripples: reducedMotion ? [] : rippleRadii(age),
      };
    });
}

/** Adds a layer to `scene` that draws every gravity bomb in play, in front of the course objects and under the racers. */
export function createGravityBombView(scene: Phaser.Scene, reducedMotion: boolean): ThemeLayer {
  const graphics = scene.add.graphics().setDepth(Layer.objects + 0.4);
  return {
    sync(current) {
      graphics.clear();
      for (const mark of gravityBombMarks(current, reducedMotion)) drawBomb(graphics, mark);
    },
  };
}

/** The core's radius `age` ticks after the drop: one sine swell and shrink every `CORE.pulseTicks`. */
function pulsingCore(age: number): number {
  return CORE.radius + CORE.pulse * Math.sin((2 * Math.PI * age) / CORE.pulseTicks);
}

/** The ripples' radii `age` ticks after the drop, evenly spaced and each shrinking from the reach to the core. */
function rippleRadii(age: number): number[] {
  return Array.from({ length: RIPPLES.count }, (_, index) => {
    const progress = ((age + (index * RIPPLES.ticks) / RIPPLES.count) % RIPPLES.ticks) / RIPPLES.ticks;
    return REACH - (REACH - CORE.radius) * progress;
  }).sort((a, b) => b - a);
}

/** The reach ring and ripples first, then the glow, core and rim on top. */
function drawBomb(graphics: Phaser.GameObjects.Graphics, mark: GravityBombMark): void {
  graphics.lineStyle(REACH_RING.width, REACH_RING.colour, REACH_RING.alpha);
  graphics.strokeCircle(mark.x, mark.y, mark.reach);
  for (const radius of mark.ripples) {
    // Faint at the reach, brighter as a ripple nears the core, like something being drawn in.
    const alpha = RIPPLES.maxAlpha * (1 - radius / mark.reach);
    graphics.lineStyle(RIPPLES.width, RIPPLES.colour, alpha);
    graphics.strokeCircle(mark.x, mark.y, radius);
  }
  graphics.fillStyle(GLOW.colour, GLOW.alpha);
  graphics.fillCircle(mark.x, mark.y, GLOW.radius);
  graphics.fillStyle(CORE.colour, 1);
  graphics.fillCircle(mark.x, mark.y, mark.core);
  graphics.lineStyle(CORE.rimWidth, CORE.rim, 1);
  graphics.strokeCircle(mark.x, mark.y, mark.core);
}
