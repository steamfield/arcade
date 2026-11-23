import { describe, expect, it } from 'vitest';
import { includeForBranch } from './assemble.ts';

describe('which games a Cloudflare build ships', () => {
  it('ships published games only from the production branch', () => {
    expect(includeForBranch('main')).toBe('published');
  });

  it('adds drafts on any other branch, for preview URLs', () => {
    expect(includeForBranch('reef-rush-v3')).toBe('preview');
  });

  it('treats a build with no branch (a local run) as production', () => {
    expect(includeForBranch(undefined)).toBe('published');
    expect(includeForBranch('')).toBe('published');
  });
});
