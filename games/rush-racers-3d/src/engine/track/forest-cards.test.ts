import { expect, it } from 'vitest';
import type { Prop } from './forest.ts';
import { forestCardGeometry } from './forest-cards.ts';

it('uses two triangles per plant and mirrors the outline around the same planting point', () => {
  const tree: Prop = {
    model: 'Pine_3',
    x: 21,
    y: 1,
    z: -32,
    scale: 1.3,
    stretch: 0.95,
    angle: 0,
    tint: 0xffffff,
    casts: true,
  };
  const props = [tree, { ...tree, angle: Math.PI }];
  const geometry = forestCardGeometry(props);
  const offsets = geometry.getAttribute('cardOffset');
  expect(geometry.index?.count).toBe(2 * 3 * props.length);
  expect(offsets.count).toBe(4 * props.length);
  expect(offsets.getX(0)).toBeCloseTo(-offsets.getX(5));
  expect(offsets.getX(1)).toBeCloseTo(-offsets.getX(4));
  const repeat = forestCardGeometry(props);
  expect(repeat.getAttribute('position').array).toEqual(geometry.getAttribute('position').array);
  expect(repeat.getAttribute('cardOffset').array).toEqual(offsets.array);
});
