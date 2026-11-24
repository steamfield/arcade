/**
 * The Vitest half of a game's Vite config: the shared defaults, and the optional split into a fast
 * `unit` project and a slow one.
 */
import { configDefaults, type TestUserConfig } from 'vitest/config';

type TestConfig = TestUserConfig;

/** Where a game's tests live unless its `test.include` says otherwise. */
const TEST_FILES = ['src/**/*.test.ts', 'tests/**/*.test.ts'];

/** A group of slow test files that runs as its own Vitest project, apart from the fast `unit` one. */
export interface SlowTests {
  /** The Vitest project name, which `--project` and CI select by. */
  project: string;
  /** Globs of the slow files, relative to the game folder. They leave `unit`. */
  include: string[];
  /** Per-test timeout for the slow project; without it the project inherits the game's `test.testTimeout`. */
  testTimeout?: number;
}

/**
 * The `test` section of a game's config: shared defaults under the game's own `test` overrides.
 * With `slowTests`, the root includes nothing and two projects share the settings: `unit` runs every
 * test file except the slow ones (honouring the game's own `include` and `exclude`), and
 * `slowTests.project` runs only the slow ones.
 */
export function buildTestConfig(overrides: TestConfig | undefined, slowTests?: SlowTests): TestConfig {
  const shared: TestConfig = {
    include: TEST_FILES,
    environment: 'node',
    // Dots for passes, full detail for failures: keeps agent context small. Use --reporter=verbose to list tests.
    reporters: ['dot'],
    ...overrides,
  };
  if (!slowTests) return shared;

  const { testTimeout } = slowTests;
  return {
    ...shared,
    include: [],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: overrides?.include ?? TEST_FILES,
          // A project's `exclude` replaces Vitest's default list, so the defaults are repeated here.
          exclude: [...configDefaults.exclude, ...(overrides?.exclude ?? []), ...slowTests.include],
        },
      },
      {
        extends: true,
        test: {
          name: slowTests.project,
          include: slowTests.include,
          ...(testTimeout === undefined ? {} : { testTimeout }),
        },
      },
    ],
  };
}
