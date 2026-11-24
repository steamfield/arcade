/**
 * Thornwood Trail: a forest foot race of about 1.1 km in six sections, in this order.
 *
 * 1. Forest Floor (0-200 m): a full-width log to hop, then two half-width logs that reward a line.
 * 2. Millstream Flats (200-380 m): mud on alternating sides leaves a dry lane to steer into, then a
 *    crosswind.
 * 3. The Ravine (400-560 m): a full-width pit to jump, then half-width pits that send you right then
 *    left, then a log.
 * 4. Windy Ridge (560-760 m): a long climb with gusts pushing left, then right.
 * 5. Rotten Bridges (780-960 m): three short gaps in a row, a narrow bridge over a wide pit, a last gap.
 * 6. The Clearing (960-1140 m): downhill to the finish past a log and mud on both verges.
 *
 * The first crate sits on the player's starting line before the first log. Par is rounded up
 * from the clean run without dashes in the fairness test, about 82 s.
 */
import type { Course } from '../types.ts';

const FULL = { d0: -6, d1: 6 };

export const THORNWOOD_TRAIL: Course = {
  id: 'thornwood-trail',
  name: 'Thornwood Trail',
  halfWidth: 6,
  startS: 5,
  finishS: 1140,
  parTicks: 4900,
  path: [
    { kind: 'straight', length: 120 },
    { kind: 'turn', angleDeg: 60, radius: 60 },
    { kind: 'straight', length: 80 },
    { kind: 'turn', angleDeg: -90, radius: 50 },
    { kind: 'straight', length: 100 },
    { kind: 'turn', angleDeg: 45, radius: 80 },
    { kind: 'straight', length: 120 },
    { kind: 'turn', angleDeg: -60, radius: 70 },
    { kind: 'straight', length: 90 },
    { kind: 'turn', angleDeg: 90, radius: 40 },
    { kind: 'straight', length: 110 },
    { kind: 'turn', angleDeg: -30, radius: 100 },
    { kind: 'straight', length: 140 },
  ],
  hills: [
    { s: 0, y: 0 },
    { s: 150, y: 0 },
    { s: 200, y: 3 },
    { s: 260, y: 3 },
    { s: 300, y: 0 },
    { s: 560, y: 0 },
    { s: 640, y: 8 },
    { s: 760, y: 10 },
    { s: 800, y: 10 },
    { s: 860, y: 6 },
    { s: 960, y: 6 },
    { s: 1060, y: 0 },
    { s: 1152, y: 0 },
  ],
  features: [
    // 1. Forest Floor
    { kind: 'crate', s: 48, d: -1.25 },
    { kind: 'log', s: 60, ...FULL, height: 0.8 },
    { kind: 'crate', s: 90, d: 3 },
    { kind: 'log', s: 110, d0: -6, d1: 0, height: 1.2 },
    { kind: 'log', s: 150, d0: 0, d1: 6, height: 1.2 },
    // 2. Millstream Flats
    { kind: 'mud', s0: 210, s1: 260, d0: -6, d1: 2 },
    { kind: 'mud', s0: 280, s1: 330, d0: -2, d1: 6 },
    { kind: 'crate', s: 300, d: -4 },
    { kind: 'gust', s0: 340, s1: 380, ...FULL, push: 3 },
    // 3. The Ravine
    { kind: 'pit', s0: 410, s1: 417, ...FULL },
    { kind: 'pit', s0: 450, s1: 470, d0: -6, d1: -1 },
    { kind: 'crate', s: 480, d: 0 },
    { kind: 'pit', s0: 490, s1: 510, d0: 1, d1: 6 },
    { kind: 'log', s: 530, ...FULL, height: 0.8 },
    // 4. Windy Ridge
    { kind: 'gust', s0: 600, s1: 660, ...FULL, push: -4 },
    { kind: 'crate', s: 650, d: 1.5 },
    { kind: 'gust', s0: 680, s1: 740, ...FULL, push: 4 },
    // 5. Rotten Bridges
    { kind: 'pit', s0: 790, s1: 796, ...FULL },
    { kind: 'pit', s0: 810, s1: 816, ...FULL },
    { kind: 'pit', s0: 830, s1: 836, ...FULL },
    { kind: 'crate', s: 855, d: 0 },
    { kind: 'pit', s0: 870, s1: 900, d0: -6, d1: -1.5 },
    { kind: 'pit', s0: 870, s1: 900, d0: 1.5, d1: 6 },
    { kind: 'pit', s0: 920, s1: 926, ...FULL },
    // 6. The Clearing
    { kind: 'log', s: 1000, d0: -2, d1: 2, height: 1 },
    { kind: 'mud', s0: 1040, s1: 1070, d0: -6, d1: -2 },
    { kind: 'mud', s0: 1040, s1: 1070, d0: 2, d1: 6 },
  ],
};
