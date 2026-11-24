import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineGameConfig } from '@arcade/config/vite';
import { configDefaults } from 'vitest/config';

/**
 * The 30-seed difficulty bars race thousands of whole races, so they run in their own `difficulty`
 * project (`pnpm test:difficulty`: the deliver gate and CI) and `arcade check` runs the `unit`
 * project. Folders under `src/logic/balance/` (a fast sanity bar) stay in `unit`.
 */
const DIFFICULTY_BARS = 'src/logic/balance/*.test.ts';
/** The shared config's own test files; repeated here because a project's `include` adds to the root's. */
const ALL_TESTS = ['src/**/*.test.ts', 'tests/**/*.test.ts'];

/** Where the room service listens in development: `pnpm --filter @arcade/api dev`, or the port a test run picked. */
const API_ORIGIN = `http://127.0.0.1:${process.env.ARCADE_API_PORT ?? '8788'}`;

/** The folders whose code every peer in an online race must share, relative to this file. */
const SIMULATION_SOURCES = ['src/logic', 'src/net', '../../packages/core/src'];

/**
 * Identifies the simulation code in this build. Peers in a room compare it, because lockstep only
 * holds when every browser steps the race with the same logic: a hash of every non-test source file
 * under `SIMULATION_SOURCES`, by path and content.
 */
function simulationBuildId(): string {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const hash = createHash('sha256');
  for (const folder of SIMULATION_SOURCES) {
    const files = readdirSync(join(root, folder), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .sort();
    for (const file of files) {
      const path = join(root, folder, file);
      hash.update(relative(root, path)).update(readFileSync(path));
    }
  }
  return hash.digest('hex').slice(0, 12);
}

const config = defineGameConfig(import.meta.url, {
  // Room requests go to the API Worker, as the site Worker's service binding sends them in production.
  server: { proxy: { '/api': { target: API_ORIGIN, ws: true } } },
  test: {
    include: [],
    projects: [
      {
        extends: true,
        // Some twenty tests here step a whole race (1 to 2 s each alone), and CI's runner under the full suite
        // takes about four times as long, past Vitest's 5 s default. A test that needs more still sets its own.
        test: {
          name: 'unit',
          include: ALL_TESTS,
          exclude: [...configDefaults.exclude, DIFFICULTY_BARS],
          testTimeout: 20_000,
        },
      },
      { extends: true, test: { name: 'difficulty', include: [DIFFICULTY_BARS] } },
    ],
  },
} as Parameters<typeof defineGameConfig>[1]);

// `defineGameConfig` passes on only the keys it knows, so the define is added to its result.
export default { ...config, define: { __BUILD_ID__: JSON.stringify(simulationBuildId()) } };
