import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
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
 * The folders whose code every peer in an online race must share, relative to this file: the rules,
 * the core helpers they use, and the net modules that decide what peers simulate or send. Every
 * non-test `.ts` file under them counts, so a new net file is hashed without anyone listing it.
 * That means every file on disk, tracked or not: a scratch `.ts` file left in one of these folders
 * changes a local build's id, so a dev server with it can't join rooms with one without it.
 */
const SIMULATION_FOLDERS = ['src/logic', '../../packages/core/src', 'src/net'];

/**
 * Paths under `SIMULATION_FOLDERS` left out on purpose, each with its reason. A path ending in `/`
 * leaves out the whole folder. Test files are always left out.
 */
const NOT_SIMULATION: Record<string, string> = {
  'src/net/client.ts': 'the flow around a race (rooms, joining, leaving), not what a race steps',
  'src/net/transport/': 'how messages travel (WebSocket, in-memory), which peers may differ in',
};

/** Whether `path` (relative to this file) is a test or one of `NOT_SIMULATION`'s exclusions. */
function leftOut(path: string): boolean {
  if (path.endsWith('.test.ts')) return true;
  return Object.keys(NOT_SIMULATION).some((excluded) =>
    excluded.endsWith('/') ? path.startsWith(excluded) : path === excluded,
  );
}

/** The simulation `.ts` files under `folder`, sorted, as paths relative to `root`. */
function sourceFilesUnder(root: string, folder: string): string[] {
  // POSIX separators, so the id (and the exclusions) are the same on every OS.
  return readdirSync(join(root, folder), { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .map((file) => `${folder}/${file}`)
    .filter((path) => !leftOut(path));
}

/**
 * Identifies the simulation code in this build. Peers in a room compare it, because lockstep only
 * holds when every browser steps the race with the same logic: a hash of every simulation file
 * under `SIMULATION_FOLDERS`, by path and content.
 */
function simulationBuildId(): string {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const hash = createHash('sha256');
  for (const folder of SIMULATION_FOLDERS) {
    for (const path of sourceFilesUnder(root, folder)) {
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
