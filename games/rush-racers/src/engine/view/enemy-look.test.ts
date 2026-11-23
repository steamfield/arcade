import { describe, expect, it } from 'vitest';
import { createEnemies } from '../../logic/hazards/enemies/index.ts';
import { raceOn } from '../../logic/test-world.ts';
import type { Enemy, EnemyMode, Vec } from '../../logic/types.ts';
import { Frame, Tex } from '../art/keys.ts';
import { REEF_OBJECTS } from '../worlds/reef/objects.ts';
import { defeatBurst, type EnemyLook, type EnemyMoments, enemyLook } from './enemy-look.ts';

/** `enemyLook` with Reef's enemy art, the world these cases draw. */
function reefLook(...args: [Enemy, EnemyMoments, number, boolean]): EnemyLook {
  return enemyLook(...args, REEF_OBJECTS.enemies.bodies);
}

/** A shark (5, 2) in open water, a crab (5, 4) on the floor and an eel (12, 4) whose hole is in the floor. */
const REEF = `
  ####################
  #1................F#
  #2...S............F#
  #3................F#
  #4...K......E....#F#
  ####################
`;

const NONE: EnemyMoments = { bonkedAt: null, defeatedAt: null };

/** The REEF enemy of `kind`, put in `mode` as lane a's logic would leave it. */
function enemy(kind: Enemy['kind'], mode: EnemyMode, changes: Partial<Enemy> = {}): Enemy {
  const { world } = raceOn(REEF);
  const found = createEnemies(world.level).find((candidate) => candidate.kind === kind);
  if (!found) throw new Error(`REEF has no ${kind}`);
  return { ...found, mode, ...changes };
}

describe('the shark', () => {
  it('swims its patrol in two strokes, facing the way it goes, with no tell', () => {
    const shark = enemy('shark', 'patrol', { facing: 1 });
    const strokes = [0, 10].map((tick) => reefLook(shark, NONE, tick, false));
    expect(strokes.map((look) => look.body?.frame)).toEqual([Frame.a, Frame.b]);
    expect(strokes[0]).toMatchObject({
      body: { texture: Tex.shark, x: 88, y: 40, flipX: false, fill: false, tint: null },
      alert: null,
      dizzy: null,
    });
    expect(reefLook({ ...shark, facing: -1 }, NONE, 0, false).body?.flipX).toBe(true);
  });

  it('winds up jaws open with a ! over it, flashing white twice in its half second, and recoils', () => {
    const windup = (modeTicks: number) => reefLook(enemy('shark', 'windup', { modeTicks }), NONE, 0, false);
    expect(windup(0)).toMatchObject({ body: { frame: Frame.enemyBite, fill: true }, alert: { x: 88, y: 25 } });
    const flashes = Array.from({ length: 30 }, (_, tick) => windup(tick).body?.fill);
    const starts = flashes.filter((on, tick) => on && !flashes[tick - 1]).length;
    expect(starts).toBe(2);
    // Facing left, it draws back to the right.
    expect(windup(8).body?.x).toBe(90);
  });

  it('keeps a steady warm tell and the ! under reduced motion, with no flash, recoil or shiver', () => {
    const looks = [0, 3, 9, 25].map((modeTicks) => reefLook(enemy('shark', 'windup', { modeTicks }), NONE, 0, true));
    for (const look of looks) {
      expect(look).toMatchObject({ body: { x: 88, y: 40, fill: false, tint: 0xffb0a0 }, alert: { x: 88, y: 25 } });
    }
  });

  it('recovers after a charge with its mouth shut, still, and no tell', () => {
    const looks = [0, 10].map((tick) => reefLook(enemy('shark', 'recover'), NONE, tick, false));
    for (const look of looks) {
      expect(look).toMatchObject({ body: { frame: Frame.a, fill: false, tint: null }, alert: null, dizzy: null });
    }
  });

  it('charges jaws open with no !, and staggers belly-up under a dizzy star', () => {
    expect(reefLook(enemy('shark', 'charge'), NONE, 0, false)).toMatchObject({
      body: { frame: Frame.enemyBite },
      alert: null,
    });
    const staggered = reefLook(enemy('shark', 'stagger'), NONE, 0, false);
    expect(staggered.body?.frame).toBe(Frame.enemyStagger);
    expect(staggered.dizzy?.y).toBeLessThan(40);
  });
});

describe('the crab', () => {
  it('walks in two strokes standing on the floor, and stands still on one when not moving', () => {
    const walking = enemy('crab', 'patrol', { vel: { x: -20, y: 0 } });
    expect([0, 8].map((tick) => reefLook(walking, NONE, tick, false).body?.frame)).toEqual([Frame.a, Frame.b]);
    expect(reefLook(walking, NONE, 0, false).body).toMatchObject({ texture: Tex.crab, x: 88, y: 74 });
    const resting = enemy('crab', 'patrol');
    expect(reefLook(resting, NONE, 8, false).body?.frame).toBe(Frame.a);
  });

  it('holds one stroke under reduced motion', () => {
    const walking = enemy('crab', 'patrol', { vel: { x: -20, y: 0 } });
    expect(reefLook(walking, NONE, 8, true).body?.frame).toBe(Frame.a);
  });
});

describe('the eel', () => {
  it('shows only its hole in the wall while hidden', () => {
    expect(reefLook(enemy('eel', 'hidden'), NONE, 0, false)).toEqual({
      body: null,
      alert: null,
      hole: { x: 200, y: 83, eyes: false },
      eelBody: null,
      bubbles: [],
      dizzy: null,
    });
  });

  it('warns with eyes in the hole and bubbles rising out of it', () => {
    const early = reefLook(enemy('eel', 'windup', { modeTicks: 0 }), NONE, 0, false);
    const later = reefLook(enemy('eel', 'windup', { modeTicks: 6 }), NONE, 0, false);
    expect(early.hole).toEqual({ x: 200, y: 83, eyes: true });
    expect(early.body).toBeNull();
    expect(early.bubbles).toHaveLength(2);
    for (const bubble of early.bubbles) expect(bubble.y).toBeLessThan(80);
    expect(later.bubbles[0]?.y).toBeLessThan(early.bubbles[0]?.y ?? 0);
  });

  it('keeps its warning bubbles still under reduced motion', () => {
    const at = (modeTicks: number) => reefLook(enemy('eel', 'windup', { modeTicks }), NONE, 0, true).bubbles;
    expect(at(0)).toEqual(at(9));
    expect(at(0)).toEqual([
      { x: 200, y: 75 },
      { x: 200, y: 68 },
    ]);
  });

  it('lunges out of the wall as a head on a body reaching back to the hole', () => {
    // 24 px up out of the floor: the head's centre is 32 px from the hole, its neck 8 px back.
    const out = reefLook(enemy('eel', 'lunge', { at: { x: 200, y: 48 } }), NONE, 0, false);
    expect(out.body).toMatchObject({ texture: Tex.eelHead, frame: Frame.b, x: 200, y: 48, rotation: -Math.PI / 2 });
    expect(out.eelBody).toEqual({ x: 200, y: 68, length: 24, rotation: -Math.PI / 2 });
    expect(out.hole?.eyes).toBe(false);
  });

  it('lunges out of a side wall without turning upside down, its hole in that wall', () => {
    // Its hole is in the rock to its right, so it lunges left.
    const fromRight = reefLook(enemy('eel', 'lunge', { out: { x: -1, y: 0 }, at: { x: 180, y: 72 } }), NONE, 0, false);
    expect(fromRight.hole).toEqual({ x: 211, y: 72, eyes: false });
    expect(fromRight.body).toMatchObject({ flipX: true, rotation: 0 });
    expect(fromRight.eelBody).toEqual({ x: 198, y: 72, length: 20, rotation: 0 });
  });
});

describe('bonks and defeats', () => {
  it('squashes a bonked enemy wide and flat, easing back, and not under reduced motion', () => {
    const shark = enemy('shark', 'stagger');
    const bonked = { bonkedAt: 100, defeatedAt: null };
    const squashed = reefLook(shark, bonked, 100, false).body;
    expect(squashed?.scaleX).toBeGreaterThan(1);
    expect(squashed?.scaleY).toBeLessThan(1);
    expect(reefLook(shark, bonked, 108, false).body).toMatchObject({ scaleX: 1, scaleY: 1 });
    expect(reefLook(shark, bonked, 100, true).body).toMatchObject({ scaleX: 1, scaleY: 1 });
  });

  it('lies flat a moment once defeated, then is gone; at once under reduced motion', () => {
    const crab = enemy('crab', 'defeated');
    const defeated = { bonkedAt: 100, defeatedAt: 100 };
    expect(reefLook(crab, defeated, 102, false).body?.scaleY).toBeLessThan(1);
    expect(reefLook(crab, defeated, 106, false).body).toBeNull();
    expect(reefLook(crab, defeated, 100, true).body).toBeNull();
    // An eel that is beaten leaves no hole behind.
    expect(reefLook(enemy('eel', 'defeated'), defeated, 120, false).hole).toBeNull();
  });

  it('pops after the squash and sends its pearls flying up and out, fading', () => {
    const at = { x: 100, y: 50 };
    expect(defeatBurst(at, 5, 0, false)).toEqual({ ring: null, pearls: [] });
    const popping = defeatBurst(at, 5, 10, false);
    expect(popping?.ring).toMatchObject({ x: 100, y: 50 });
    expect(popping?.pearls).toHaveLength(5);
    for (const pearl of popping?.pearls ?? []) expect(pearl.y).toBeLessThanOrEqual(50);
    const landed = defeatBurst(at, 5, 6 + 29, false);
    expect(landed?.ring).toBeNull();
    expect(landed?.pearls[0]?.alpha).toBeLessThan(1);
    expect(defeatBurst(at, 5, 6 + 30, false)).toBeNull();
  });

  it('only pops under reduced motion: at once, still, with no pearls in flight', () => {
    const at = { x: 100, y: 50 };
    expect(defeatBurst(at, 5, 0, true)).toEqual({ ring: { x: 100, y: 50, scale: 1, alpha: 1 }, pearls: [] });
    expect(defeatBurst(at, 5, 11, true)?.ring).toEqual({ x: 100, y: 50, scale: 1, alpha: 1 });
    expect(defeatBurst(at, 5, 12, true)).toBeNull();
  });
});
