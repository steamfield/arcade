import { expect, it } from 'vitest';
import { trailTile } from './trail-tile.ts';

it.each([128, 256])('rebuilds the %i px trail tile from its seed', (size) => {
  const first = trailTile(size, 19);
  const again = trailTile(size, 19);
  expect(first.length).toBe(size * size * 4);
  expect(first).toEqual(again);
  expect(first).not.toEqual(trailTile(size, 20));
});

it('keeps bright soil and stones earth-toned when packing their channels into bytes', () => {
  const tile = trailTile(256, 0x9a17);
  expect(tile.every((channel) => channel >= 30)).toBe(true);
});
