/**
 * What each enemy looks like on a given world tick, as plain data the Phaser view draws: which frame,
 * where, flipped, turned, squashed or flashing, and the marks around it. A shark swims its patrol,
 * and its wind-up flashes white (twice, under the 3 a second limit) with a `!` above it while it
 * recoils and shivers, jaws open; it charges jaws open, sits still with its mouth shut while it
 * recovers, and rolls belly-up under a dizzy star when staggered. An eel shows only a dark hole in
 * the reef wall behind its lunge direction (`enemy.out`) until its warning puts eyes in the hole with
 * bubbles rising out of it, then lunges out as a head on a body reaching back to the wall. A crab
 * walks the floor snapping its claws.
 *
 * A bonk squashes the enemy for a few ticks; a defeat squashes it flat, then pops it in a ring with
 * pearls flying out (`defeatBurst`). Under reduced motion nothing flashes, shivers, swims or
 * squashes: the tell is a steady warm tint and the `!`, and a defeat is the pop alone. Every timing
 * counts world ticks, so captures repeat. No Phaser here, so it runs under Node in tests.
 */
import { type Enemy, TILE, type Vec } from '../../logic/types.ts';
import { Frame, type FrameKey } from '../art/keys.ts';
import type { EnemyArt } from '../worlds/object-skin.ts';

/** The world ticks on which an enemy was last bonked and defeated, or null. */
export interface EnemyMoments {
  bonkedAt: number | null;
  defeatedAt: number | null;
}

/** The enemy's own sprite. `fill` turns it solid white for a flash; `tint` multiplies it. */
export interface BodyLook {
  texture: string;
  frame: FrameKey;
  x: number;
  y: number;
  flipX: boolean;
  rotation: number;
  scaleX: number;
  scaleY: number;
  fill: boolean;
  tint: number | null;
}

/** Everything drawn for one enemy this tick; a null part is hidden. */
export interface EnemyLook {
  body: BodyLook | null;
  /** The `!` over a shark winding up. */
  alert: Vec | null;
  /** An eel's hole in the reef wall, with eyes in it during the warning. */
  hole: (Vec & { eyes: boolean }) | null;
  /** An eel's body from the wall to the back of its head: centre, length in px and rotation. */
  eelBody: (Vec & { length: number; rotation: number }) | null;
  /** Bubbles rising out of an eel's hole during its warning. */
  bubbles: Vec[];
  /** The dizzy star over a staggered enemy. */
  dizzy: Vec | null;
}

/** A defeat's pop ring and the pearls flying out of it, at a given age. */
export interface BurstLook {
  ring: (Vec & { scale: number; alpha: number }) | null;
  pearls: (Vec & { alpha: number })[];
}

/** Ticks per swim or walk stroke. */
const SHARK_STROKE_TICKS = 10;
const CRAB_STROKE_TICKS = 8;
/** The wind-up flashes white for FLASH_TICKS at the start of every FLASH_PERIOD_TICKS: 3 a second at most. */
const FLASH_PERIOD_TICKS = 20;
const FLASH_TICKS = 4;
/** The wind-up's steady tell under reduced motion, in place of the flash. */
const TELL_TINT = 0xffb0a0;
/** How far a winding-up shark draws back against its facing, px, reached after RECOIL_TICKS. */
const RECOIL_PX = 2;
const RECOIL_TICKS = 8;
/** Px from a shark's centre up to the `!`. */
const ALERT_RISE_PX = 15;
/** Px from a staggered enemy's centre up to its dizzy star, and the radius it circles at. */
const DIZZY_RISE_PX = 11;
const DIZZY_ORBIT_PX = 5;
const DIZZY_PERIOD_TICKS = 36;
/** The crab's sprite sits this far below its centre, so its legs stand on the floor. */
const CRAB_FOOT_PX = 2;
/** A bonk's squash: wide and flat, easing back over SQUASH_TICKS. */
const SQUASH_TICKS = 8;
const SQUASH = 0.35;
/** A defeated enemy lies flat this long before it pops (none under reduced motion). */
const DEFEAT_SQUASH_TICKS = 6;
const DEFEAT_FLAT = 0.5;
/** The pop ring lasts this long, growing from POP_SCALE_FROM to POP_SCALE_TO. */
const POP_TICKS = 12;
const POP_SCALE_FROM = 0.5;
const POP_SCALE_TO = 1.6;
/** Pearls fly this far out of a pop, fanned over the upper half, and fade over their last ticks. */
const PEARL_FLIGHT_TICKS = 30;
const PEARL_FLIGHT_PX = 22;
const PEARL_FADE_TICKS = 8;
/** The eel head is 16 px long; its centre is half that from the back of the neck. */
const EEL_HEAD_HALF_PX = 8;
/** The eel body tile's thickness, px. */
export const EEL_BODY_PX = 10;
/** The hole sits this far into the wall from the water's edge, so it reads as a cave in the rock. */
const HOLE_SINK_PX = 3;
/** Warning bubbles rise this far out of the hole before starting again, spaced this far apart. */
const BUBBLE_RISE_PX = 16;
const BUBBLE_SPACING_PX = 8;
export const BUBBLE_COUNT = 2;
/** Under reduced motion the bubbles stand still at these distances out of the hole. */
const STILL_BUBBLES_PX = [5, 12] as const;

/**
 * What to draw for `enemy` on world tick `tick`; `moments` are its last bonk and defeat. `bodies` is
 * the world skin's body texture per enemy kind; it is Reef's unless a caller says otherwise.
 */
export function enemyLook(
  enemy: Enemy,
  moments: EnemyMoments,
  tick: number,
  reducedMotion: boolean,
  bodies: EnemyArt['bodies'],
): EnemyLook {
  const look: EnemyLook = { body: null, alert: null, hole: null, eelBody: null, bubbles: [], dizzy: null };
  const texture = bodies[enemy.kind];
  if (enemy.mode === 'defeated') {
    look.body = flattened(enemy, texture, moments.defeatedAt, tick, reducedMotion);
    return look;
  }
  if (enemy.kind === 'shark') sharkLook(look, enemy, texture, tick, reducedMotion);
  else if (enemy.kind === 'crab') crabLook(look, enemy, texture, tick, reducedMotion);
  else eelLook(look, enemy, texture, reducedMotion);
  if (look.body) squash(look.body, moments.bonkedAt, tick, reducedMotion);
  if (enemy.mode === 'stagger') look.dizzy = dizzyStar(enemy.at, tick, reducedMotion);
  return look;
}

/**
 * The pop and pearl flight of a defeat at `at` whose `pearls` flew out, `age` ticks after the
 * `enemy.defeated` tick, or null once it is over. Under reduced motion it pops at once, holds the
 * ring still and sends no pearls flying.
 */
export function defeatBurst(at: Vec, pearls: number, age: number, reducedMotion: boolean): BurstLook | null {
  const popAge = age - (reducedMotion ? 0 : DEFEAT_SQUASH_TICKS);
  if (popAge < 0) return { ring: null, pearls: [] };
  const flightOver = reducedMotion || popAge >= PEARL_FLIGHT_TICKS;
  if (popAge >= POP_TICKS && flightOver) return null;
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  let ring: BurstLook['ring'] = null;
  if (popAge < POP_TICKS) {
    const t = popAge / POP_TICKS;
    ring = reducedMotion
      ? { x, y, scale: 1, alpha: 1 }
      : { x, y, scale: POP_SCALE_FROM + (POP_SCALE_TO - POP_SCALE_FROM) * t, alpha: 1 - t };
  }
  if (flightOver) return { ring, pearls: [] };
  // Out fast and slowing, like the pearls the water drags to a stop.
  const t = popAge / PEARL_FLIGHT_TICKS;
  const reach = PEARL_FLIGHT_PX * (1 - (1 - t) ** 2);
  const alpha = Math.min(1, (PEARL_FLIGHT_TICKS - popAge) / PEARL_FADE_TICKS);
  const flying = Array.from({ length: pearls }, (_, index) => {
    // Fanned from straight left, over the top, to straight right.
    const angle = Math.PI + (Math.PI * (index + 0.5)) / pearls;
    return { x: Math.round(x + Math.cos(angle) * reach), y: Math.round(y + Math.sin(angle) * reach), alpha };
  });
  return { ring, pearls: flying };
}

function sharkLook(look: EnemyLook, enemy: Enemy, texture: string, tick: number, reducedMotion: boolean): void {
  const at = enemy.at;
  const body = baseBody(texture, stroke(tick, SHARK_STROKE_TICKS, reducedMotion), at, enemy.facing);
  if (enemy.mode === 'windup') {
    body.frame = Frame.enemyBite;
    if (reducedMotion) body.tint = TELL_TINT;
    else {
      body.fill = enemy.modeTicks % FLASH_PERIOD_TICKS < FLASH_TICKS;
      const recoil = Math.round((RECOIL_PX * Math.min(enemy.modeTicks, RECOIL_TICKS)) / RECOIL_TICKS);
      const shiver = enemy.modeTicks % 4 < 2 ? 0 : 1;
      body.x -= enemy.facing * recoil;
      body.y += shiver;
    }
    look.alert = { x: Math.round(at.x), y: Math.round(at.y) - ALERT_RISE_PX };
  } else if (enemy.mode === 'charge') {
    body.frame = Frame.enemyBite;
  } else if (enemy.mode === 'recover') {
    // Spent and sitting still: mouth shut, no stroke.
    body.frame = Frame.a;
  } else if (enemy.mode === 'stagger') {
    body.frame = Frame.enemyStagger;
  }
  look.body = body;
}

function crabLook(look: EnemyLook, enemy: Enemy, texture: string, tick: number, reducedMotion: boolean): void {
  const walking = enemy.vel.x !== 0 && !reducedMotion;
  const frame = enemy.mode === 'stagger' ? Frame.enemyStagger : stroke(tick, CRAB_STROKE_TICKS, !walking);
  const body = baseBody(texture, frame, enemy.at, enemy.facing);
  body.y += CRAB_FOOT_PX;
  look.body = body;
}

/**
 * The eel's hole always, in the wall behind its lunge direction `enemy.out`; eyes and bubbles while
 * it warns (`windup`); head and body while it is out.
 */
function eelLook(look: EnemyLook, enemy: Enemy, texture: string, reducedMotion: boolean): void {
  const { out } = enemy;
  const home = { x: (enemy.home.x + 0.5) * TILE, y: (enemy.home.y + 0.5) * TILE };
  const mouth = { x: home.x - (out.x * TILE) / 2, y: home.y - (out.y * TILE) / 2 };
  const warning = enemy.mode === 'windup';
  look.hole = {
    x: Math.round(mouth.x - out.x * HOLE_SINK_PX),
    y: Math.round(mouth.y - out.y * HOLE_SINK_PX),
    eyes: warning,
  };
  if (warning) look.bubbles = warningBubbles(mouth, out, enemy.modeTicks, reducedMotion);
  if (enemy.mode !== 'lunge' && enemy.mode !== 'stagger') return;

  const rotation = facingRotation(out);
  const head = baseBody(texture, enemy.mode === 'lunge' ? Frame.b : Frame.a, enemy.at, 1);
  head.flipX = out.x < 0;
  head.rotation = rotation;
  look.body = head;
  const reach = (enemy.at.x - mouth.x) * out.x + (enemy.at.y - mouth.y) * out.y;
  const length = Math.max(0, Math.round(reach - EEL_HEAD_HALF_PX));
  if (length > 0) {
    look.eelBody = {
      x: Math.round(mouth.x + (out.x * length) / 2),
      y: Math.round(mouth.y + (out.y * length) / 2),
      length,
      rotation: out.x < 0 ? 0 : rotation,
    };
  }
}

/** Bubbles rising out of the hole along `out`, one every BUBBLE_SPACING_PX, standing still under reduced motion. */
function warningBubbles(mouth: Vec, out: Vec, modeTicks: number, reducedMotion: boolean): Vec[] {
  const distances = reducedMotion
    ? STILL_BUBBLES_PX
    : Array.from(
        { length: BUBBLE_COUNT },
        (_, index) => 2 + ((modeTicks / 2 + index * BUBBLE_SPACING_PX) % BUBBLE_RISE_PX),
      );
  return distances.map((distance) => ({
    x: Math.round(mouth.x + out.x * distance),
    y: Math.round(mouth.y + out.y * distance),
  }));
}

/** A defeated enemy squashed flat for its first ticks, then gone (at once under reduced motion). */
function flattened(
  enemy: Enemy,
  texture: string,
  defeatedAt: number | null,
  tick: number,
  reducedMotion: boolean,
): BodyLook | null {
  if (reducedMotion || defeatedAt === null || tick - defeatedAt >= DEFEAT_SQUASH_TICKS) return null;
  const body = baseBody(texture, Frame.a, enemy.at, enemy.facing);
  body.scaleX = 1 + DEFEAT_FLAT / 2;
  body.scaleY = DEFEAT_FLAT;
  return body;
}

/** Widens and flattens `body` for SQUASH_TICKS after a bonk, easing back; never under reduced motion. */
function squash(body: BodyLook, bonkedAt: number | null, tick: number, reducedMotion: boolean): void {
  if (reducedMotion || bonkedAt === null) return;
  const age = tick - bonkedAt;
  if (age < 0 || age >= SQUASH_TICKS) return;
  const amount = SQUASH * (1 - age / SQUASH_TICKS);
  body.scaleX = 1 + amount;
  body.scaleY = 1 - amount;
}

function dizzyStar(at: Vec, tick: number, reducedMotion: boolean): Vec {
  const angle = reducedMotion ? -Math.PI / 2 : (2 * Math.PI * tick) / DIZZY_PERIOD_TICKS;
  return {
    x: Math.round(at.x + Math.cos(angle) * DIZZY_ORBIT_PX),
    y: Math.round(at.y - DIZZY_RISE_PX + Math.sin(angle) * 2),
  };
}

function baseBody(texture: string, frame: FrameKey, at: Vec, facing: 1 | -1): BodyLook {
  return {
    texture,
    frame,
    x: Math.round(at.x),
    y: Math.round(at.y),
    flipX: facing < 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: false,
    tint: null,
  };
}

function stroke(tick: number, strokeTicks: number, still: boolean): FrameKey {
  return still || Math.floor(tick / strokeTicks) % 2 === 0 ? Frame.a : Frame.b;
}

/** The rotation that turns right-pointing art to `dir`; left is drawn flipped, never upside down. */
function facingRotation(dir: Vec): number {
  if (dir.y > 0) return Math.PI / 2;
  if (dir.y < 0) return -Math.PI / 2;
  return 0;
}

/** One enemy's sprites, made once. */
