import { describe, expect, it } from 'vitest';
import { UsageError } from './games.ts';
import { expandGroups } from './test.ts';

const GROUPS = { courses: ['src/logic/courses', 'src/logic/conformance'], seams: ['src/logic/architecture.test.ts'] };

describe('expanding @group filters for arcade test', () => {
  it('replaces each group with its paths and keeps other filters in order', () => {
    expect(expandGroups(['@courses', 'src/engine', '-t', 'par', '@seams'], GROUPS, 'reef-rush')).toEqual([
      'src/logic/courses',
      'src/logic/conformance',
      'src/engine',
      '-t',
      'par',
      'src/logic/architecture.test.ts',
    ]);
  });

  it('rejects an unknown group and names the groups the game has', () => {
    expect(() => expandGroups(['@course'], GROUPS, 'reef-rush')).toThrow(UsageError);
    expect(() => expandGroups(['@course'], GROUPS, 'reef-rush')).toThrow('Its groups: @courses, @seams.');
  });

  it('rejects inherited object keys rather than treating them as groups', () => {
    expect(() => expandGroups(['@constructor'], GROUPS, 'reef-rush')).toThrow(UsageError);
  });

  it('says so when the game defines no groups', () => {
    expect(() => expandGroups(['@courses'], {}, 'phaser-2d')).toThrow('It defines none.');
  });
});
