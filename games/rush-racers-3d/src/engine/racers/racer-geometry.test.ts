import { expect, it } from 'vitest';
import { geometryFor } from './racer-geometry.ts';

it("merges Grit's trail pack with his fur into a single drawable body", () => {
  const { body } = geometryFor('grit');
  expect(body).toBeTruthy();
  expect(body.index?.count).toBeGreaterThan(0);
  expect(body.getAttribute('color').count).toBe(body.getAttribute('position').count);
});
