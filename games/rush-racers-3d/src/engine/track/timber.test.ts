import { CylinderGeometry } from 'three';
import { expect, it } from 'vitest';
import { timberUVs } from './timber.ts';

it('maps the caps into the cut rings and gives a snapped limb a matching length of bark', () => {
  const atlas = (length: number) => {
    const cylinder = new CylinderGeometry(1, 1, 2, 16);
    timberUVs(cylinder, length);
    const uv = cylinder.getAttribute('uv');
    const normals = cylinder.getAttribute('normal');
    let maxBarkU = 0;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(normals.getY(i)) > 0.8) expect(uv.getY(i)).toBeLessThan(0.37);
      else {
        expect(uv.getY(i)).toBeGreaterThan(0.38);
        maxBarkU = Math.max(maxBarkU, uv.getX(i));
      }
    }
    expect(uv.count).toBe(normals.count);
    const bytes = Array.from(uv.array);
    cylinder.dispose();
    return { bytes, maxBarkU };
  };
  const limb = atlas(0.15);
  expect(limb).toEqual(atlas(0.15));
  expect(limb.maxBarkU).toBeLessThan(0.16);
  expect(atlas(1).maxBarkU).toBeGreaterThan(0.98);
});
