import { describe, expect, it } from 'vitest';
import { createEnemies } from '../../logic/hazards/enemies/index.ts';
import { raceOn } from '../../logic/test-world.ts';
import type { Enemy, EnemyMode, Vec } from '../../logic/types.ts';
import { Frame, Tex } from '../art/keys.ts';
import { defeatBurst, type EnemyMoments, eelWall, enemyLook } from './enemy-view.ts';

/** A shark (5, 2) in open water, a crab (5, 4) on the floor and an eel (12, 4) in the floor beside a wall. */
const REEF = `
  ####################
  #1................F#
  #2...S............F#
  #3................F#
  #4...K......E....#F#
  ####################
`;

const NONE: EnemyMoments = { bonkedAt: null, defeatedAt: null };
const FLOOR: Vec = { x: 0, y: 1 };

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
    const strokes = [0, 10].map((tick) => enemyLook(shark, FLOOR, NONE, tick, false));
    expect(strokes.map((look) => look.body?.frame)).toEqual([Frame.a, Frame.b]);
    expect(strokes[0]).toMatchObject({
      body: { texture: Tex.shark, x: 88, y: 40, flipX: false, fill: false, tint: null },
      alert: null,
      dizzy: null,
    });
    expect(enemyLook({ ...shark, facing: -1 }, FLOOR, NONE, 0, false).body?.flipX).toBe(true);
  });

  it('winds up jaws open with a ! over it, flashing white twice in its half second, and recoils', () => {
    const windup = (modeTicks: number) => enemyLook(enemy('shark', 'windup', { modeTicks }), FLOOR, NONE, 0, false);
    expect(windup(0)).toMatchObject({ body: { frame: Frame.enemyBite, fill: true }, alert: { x: 88, y: 25 } });
    const flashes = Array.from({ length: 30 }, (_, tick) => windup(tick).body?.fill);
    const starts = flashes.filter((on, tick) => on && !flashes[tick - 1]).length;
    expect(starts).toBe(2);
    // Facing left, it draws back to the right.
    expect(windup(8).body?.x).toBe(90);
  });

  it('keeps a steady warm tell and the ! under reduced motion, with no flash, recoil or shiver', () => {
    const looks = [0, 3, 9, 25].map((modeTicks) =>
      enemyLook(enemy('shark', 'windup', { modeTicks }), FLOOR, NONE, 0, true),
    );
    for (const look of looks) {
      expect(look).toMatchObject({ body: { x: 88, y: 40, fill: false, tint: 0xffb0a0 }, alert: { x: 88, y: 25 } });
    }
  });

  it('charges jaws open with no !, and staggers belly-up under a dizzy star', () => {
    expect(enemyLook(enemy('shark', 'charge'), FLOOR, NONE, 0, false)).toMatchObject({
      body: { frame: Frame.enemyBite },
      alert: null,
    });
    const staggered = enemyLook(enemy('shark', 'stagger'), FLOOR, NONE, 0, false);
    expect(staggered.body?.frame).toBe(Frame.enemyStagger);
    expect(staggered.dizzy?.y).toBeLessThan(40);
  });
});

describe('the crab', () => {
  it('walks in two strokes standing on the floor, and stands still on one when not moving', () => {
    const walking = enemy('crab', 'patrol', { vel: { x: -20, y: 0 } });
    expect([0, 8].map((tick) => enemyLook(walking, FLOOR, NONE, tick, false).body?.frame)).toEqual([Frame.a, Frame.b]);
    expect(enemyLook(walking, FLOOR, NONE, 0, false).body).toMatchObject({ texture: Tex.crab, x: 88, y: 74 });
    const resting = enemy('crab', 'patrol');
    expect(enemyLook(resting, FLOOR, NONE, 8, false).body?.frame).toBe(Frame.a);
  });

  it('holds one stroke under reduced motion', () => {
    const walking = enemy('crab', 'patrol', { vel: { x: -20, y: 0 } });
    expect(enemyLook(walking, FLOOR, NONE, 8, true).body?.frame).toBe(Frame.a);
  });
});

describe('the eel', () => {
  it('lives in the first rock beside its tile: floor, then ceiling, then the sides', () => {
    const { world } = raceOn(REEF);
    expect(eelWall(world.level, { x: 12, y: 4 })).toEqual({ x: 0, y: 1 });
    expect(eelWall(world.level, { x: 16, y: 4 })).toEqual({ x: 0, y: 1 });
    expect(eelWall(world.level, { x: 8, y: 1 })).toEqual({ x: 0, y: -1 });
  });

  it('shows only its hole in the wall while hidden', () => {
    expect(enemyLook(enemy('eel', 'hidden'), FLOOR, NONE, 0, false)).toEqual({
      body: null,
      alert: null,
      hole: { x: 200, y: 83, eyes: false },
      eelBody: null,
      bubbles: [],
      dizzy: null,
    });
  });

  it('warns with eyes in the hole and bubbles rising out of it', () => {
    const early = enemyLook(enemy('eel', 'windup', { modeTicks: 0 }), FLOOR, NONE, 0, false);
    const later = enemyLook(enemy('eel', 'windup', { modeTicks: 6 }), FLOOR, NONE, 0, false);
    expect(early.hole).toEqual({ x: 200, y: 83, eyes: true });
    expect(early.body).toBeNull();
    expect(early.bubbles).toHaveLength(2);
    for (const bubble of early.bubbles) expect(bubble.y).toBeLessThan(80);
    expect(later.bubbles[0]?.y).toBeLessThan(early.bubbles[0]?.y ?? 0);
  });

  it('keeps its warning bubbles still under reduced motion', () => {
    const at = (modeTicks: number) => enemyLook(enemy('eel', 'windup', { modeTicks }), FLOOR, NONE, 0, true).bubbles;
    expect(at(0)).toEqual(at(9));
    expect(at(0)).toEqual([
      { x: 200, y: 75 },
      { x: 200, y: 68 },
    ]);
  });

  it('lunges out of the wall as a head on a body reaching back to the hole', () => {
    // 24 px up out of the floor: the head's centre is 32 px from the hole, its neck 8 px back.
    const out = enemyLook(enemy('eel', 'lunge', { at: { x: 200, y: 48 } }), FLOOR, NONE, 0, false);
    expect(out.body).toMatchObject({ texture: Tex.eelHead, frame: Frame.b, x: 200, y: 48, rotation: -Math.PI / 2 });
    expect(out.eelBody).toEqual({ x: 200, y: 68, length: 24, rotation: -Math.PI / 2 });
    expect(out.hole?.eyes).toBe(false);
  });

  it('lunges out of a side wall without turning upside down', () => {
    const fromRight = enemyLook(enemy('eel', 'lunge', { at: { x: 180, y: 72 } }), { x: 1, y: 0 }, NONE, 0, false);
    expect(fromRight.body).toMatchObject({ flipX: true, rotation: 0 });
    expect(fromRight.eelBody).toMatchObject({ rotation: 0, length: 20 });
  });
});

describe('bonks and defeats', () => {
  it('squashes a bonked enemy wide and flat, easing back, and not under reduced motion', () => {
    const shark = enemy('shark', 'stagger');
    const bonked = { bonkedAt: 100, defeatedAt: null };
    const squashed = enemyLook(shark, FLOOR, bonked, 100, false).body;
    expect(squashed?.scaleX).toBeGreaterThan(1);
    expect(squashed?.scaleY).toBeLessThan(1);
    expect(enemyLook(shark, FLOOR, bonked, 108, false).body).toMatchObject({ scaleX: 1, scaleY: 1 });
    expect(enemyLook(shark, FLOOR, bonked, 100, true).body).toMatchObject({ scaleX: 1, scaleY: 1 });
  });

  it('lies flat a moment once defeated, then is gone; at once under reduced motion', () => {
    const crab = enemy('crab', 'defeated');
    const defeated = { bonkedAt: 100, defeatedAt: 100 };
    expect(enemyLook(crab, FLOOR, defeated, 102, false).body?.scaleY).toBeLessThan(1);
    expect(enemyLook(crab, FLOOR, defeated, 106, false).body).toBeNull();
    expect(enemyLook(crab, FLOOR, defeated, 100, true).body).toBeNull();
    // An eel that is beaten leaves no hole behind.
    expect(enemyLook(enemy('eel', 'defeated'), FLOOR, defeated, 120, false).hole).toBeNull();
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
