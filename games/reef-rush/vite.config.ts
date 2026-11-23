import { defineGameConfig } from '@arcade/config/vite';
import { configDefaults } from 'vitest/config';

/**
 * The 30-seed difficulty bars race thousands of whole races, so they run in their own `difficulty`
 * project (`pnpm test:difficulty`: the deliver gate and CI) and `arcade check` runs the `unit`
 * project. Folders under `src/logic/difficulty/` (a fast sanity bar) stay in `unit`.
 */
const DIFFICULTY_BARS = 'src/logic/difficulty/*.test.ts';
/** The shared config's own test files; repeated here because a project's `include` adds to the root's. */
const ALL_TESTS = ['src/**/*.test.ts', 'tests/**/*.test.ts'];

export default defineGameConfig(import.meta.url, {
  test: {
    include: [],
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ALL_TESTS, exclude: [...configDefaults.exclude, DIFFICULTY_BARS] },
      },
      { extends: true, test: { name: 'difficulty', include: [DIFFICULTY_BARS] } },
    ],
  },
} as Parameters<typeof defineGameConfig>[1]);
