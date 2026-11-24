import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineGameConfig } from '@arcade/config/vite';

/**
 * The 30-seed difficulty bars race thousands of whole races, so they run in their own `difficulty`
 * project (`pnpm test:difficulty`: the deliver gate and CI) and `arcade check` runs the `unit`
 * project. Folders under `src/logic/balance/` (a fast sanity bar) stay in `unit`.
 */
const DIFFICULTY_BARS = 'src/logic/balance/*.test.ts';

/** Where the room service listens in development: `pnpm --filter @arcade/api dev`, or the port a test run picked. */
const API_ORIGIN = `http://127.0.0.1:${process.env.ARCADE_API_PORT ?? '8788'}`;

/**
 * The source files whose code every peer in an online race must share, relative to this file: the
 * rules, the core helpers they use, and the net modules that decide what peers simulate or send.
 * Left out: `client.ts` (flow around a race), `transport/` (sockets) and every test.
 */
const SIMULATION_FILES = [
  'src/logic',
  '../../packages/core/src',
  'src/net/codec.ts',
  'src/net/hash-ledger.ts',
  'src/net/lobby.ts',
  'src/net/messages.ts',
  'src/net/race-world.ts',
  'src/net/race.ts',
  'src/net/session.ts',
];

/** The non-test `.ts` files under `entry`, which is a file or a folder, as paths relative to `root`. */
function sourceFilesUnder(root: string, entry: string): string[] {
  if (entry.endsWith('.ts')) return [entry];
  return readdirSync(join(root, entry), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .sort()
    .map((file) => join(entry, file));
}

/**
 * Identifies the simulation code in this build. Peers in a room compare it, because lockstep only
 * holds when every browser steps the race with the same logic: a hash of every file named by
 * `SIMULATION_FILES`, by path and content.
 */
function simulationBuildId(): string {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const hash = createHash('sha256');
  for (const entry of SIMULATION_FILES) {
    for (const path of sourceFilesUnder(root, entry)) {
      hash.update(path).update(readFileSync(join(root, path)));
    }
  }
  return hash.digest('hex').slice(0, 12);
}

export default defineGameConfig(
  import.meta.url,
  {
    define: { __BUILD_ID__: JSON.stringify(simulationBuildId()) },
    // Room requests go to the API Worker, as the site Worker's service binding sends them in production.
    server: { proxy: { '/api': { target: API_ORIGIN, ws: true } } },
    // Some twenty tests here step a whole race (1 to 2 s each alone), and CI's runner under the full suite
    // takes about four times as long, past Vitest's 5 s default. A test that needs more still sets its own.
    test: { testTimeout: 20_000 },
  },
  // The difficulty project keeps Vitest's default timeout, as before the split.
  { slowTests: { project: 'difficulty', include: [DIFFICULTY_BARS], testTimeout: 5_000 } },
);
