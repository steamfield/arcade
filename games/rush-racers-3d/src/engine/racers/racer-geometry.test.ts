import { expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../logic/types.ts';
import { geometryFor } from './racer-geometry.ts';

const triangles = (geometry: { index: { count: number } | null }) => (geometry.index?.count ?? 0) / 3;

it.each(CHARACTER_IDS)('builds %s as painted pieces within the triangle budget', (id) => {
  const { torso, head, face, ears, arms, legs, tail } = geometryFor(id);
  const pieces = [torso, head.geometry, face, ...arms.map((arm) => arm.geometry), ...legs.map((leg) => leg.geometry)];
  if (ears) pieces.push(ears.geometry);
  if (tail) pieces.push(tail.geometry);
  let total = 0;
  for (const piece of pieces) {
    expect(piece.getAttribute('color').count).toBe(piece.getAttribute('position').count);
    total += triangles(piece);
  }
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThan(18_000);
});

it('gives every racer a left and a right limb that mirror each other about the centreline', () => {
  for (const id of CHARACTER_IDS) {
    const { arms, legs } = geometryFor(id);
    for (const [left, right] of [arms, legs]) {
      expect(left.pivot.x).toBeCloseTo(-right.pivot.x);
      expect(left.pivot.y).toBeCloseTo(right.pivot.y);
      expect(left.pivot.x).toBeLessThan(0);
    }
  }
});

it("merges Grit's trail pack with his jersey into a single drawable trunk", () => {
  const { torso } = geometryFor('grit');
  torso.computeBoundingBox();
  // The pack hangs behind the trunk (+z is behind a racer), further back than the chest reaches forward.
  expect(torso.boundingBox?.max.z).toBeGreaterThan(-(torso.boundingBox?.min.z ?? 0));
});
