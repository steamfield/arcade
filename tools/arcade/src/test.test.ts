import { describe, expect, it } from 'vitest';
import { UsageError } from './games.ts';
import { expandGroups, vitestArgs } from './test.ts';

const GROUPS = {
  courses: ['src/logic/courses', 'src/logic/conformance'],
  seams: ['src/logic/architecture.test.ts'],
  bars: { project: 'difficulty', paths: ['src/logic/difficulty/'] },
};

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

  it('expands a project group to its paths followed by --project', () => {
    expect(expandGroups(['@bars'], GROUPS, 'rush-racers')).toEqual([
      'src/logic/difficulty/',
      '--project',
      'difficulty',
    ]);
  });

  it('rejects an unknown group and names the groups the game has', () => {
    expect(() => expandGroups(['@course'], GROUPS, 'reef-rush')).toThrow(UsageError);
    expect(() => expandGroups(['@course'], GROUPS, 'reef-rush')).toThrow('Its groups: @courses, @seams, @bars.');
  });

  it('rejects inherited object keys rather than treating them as groups', () => {
    expect(() => expandGroups(['@constructor'], GROUPS, 'reef-rush')).toThrow(UsageError);
  });

  it('says so when the game defines no groups', () => {
    expect(() => expandGroups(['@courses'], {}, 'phaser-2d')).toThrow('It defines none.');
  });
});

describe('choosing the vitest project for arcade test', () => {
  const SCRIPT = 'vitest run --project unit';

  it('adds the default project when there are no filters', () => {
    expect(vitestArgs([], SCRIPT)).toEqual(['--project', 'unit']);
  });

  it('adds the default project after a folder filter', () => {
    expect(vitestArgs(['src/logic'], SCRIPT)).toEqual(['src/logic', '--project', 'unit']);
  });

  it('adds no project for an explicit test file', () => {
    expect(vitestArgs(['src/logic/num.test.ts'], SCRIPT)).toEqual(['src/logic/num.test.ts']);
    expect(vitestArgs(['tests/a.spec.ts'], SCRIPT)).toEqual(['tests/a.spec.ts']);
  });

  it('passes a named project through without adding the default', () => {
    expect(vitestArgs(['src/logic', '--project', 'difficulty'], SCRIPT)).toEqual([
      'src/logic',
      '--project',
      'difficulty',
    ]);
    expect(vitestArgs(['--project=difficulty'], SCRIPT)).toEqual(['--project=difficulty']);
  });

  it('adds nothing when the game test script names no project', () => {
    expect(vitestArgs(['src/logic'], 'vitest run')).toEqual(['src/logic']);
    expect(vitestArgs(['src/logic'], undefined)).toEqual(['src/logic']);
  });

  it('keeps a -t name filter untouched and still adds the default project', () => {
    expect(vitestArgs(['-t', 'par.test.ts'], SCRIPT)).toEqual(['-t', 'par.test.ts', '--project', 'unit']);
  });
});
