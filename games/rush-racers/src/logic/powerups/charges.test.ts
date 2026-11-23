import { describe, expect, it } from 'vitest';
import { POWER_UP_KINDS } from '../types.ts';
import { chargesFor } from './charges.ts';

describe('charges an item comes with', () => {
  it('gives each kind its fixed count in every place', () => {
    const fixed = POWER_UP_KINDS.filter((kind) => kind !== 'homingSquid');

    for (const place of [1, 2, 3, 4]) {
      expect(Object.fromEntries(fixed.map((kind) => [kind, chargesFor(kind, place)])), `place ${place}`).toEqual({
        jetFin: 3,
        bubbleShield: 1,
        puffer: 2,
        inkSac: 3,
        glowLantern: 2,
        riptide: 2,
        undertow: 1,
        mimic: 1,
        cannonball: 1,
      });
    }
  });

  it('gives a Homing Squid one charge in 1st and 2nd and three in 3rd and 4th', () => {
    expect([1, 2, 3, 4].map((place) => chargesFor('homingSquid', place))).toEqual([1, 1, 3, 3]);
  });
});
