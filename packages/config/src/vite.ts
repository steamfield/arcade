/**
 * The shared Vite preset every game's `vite.config.ts` calls: base path and html tags from
 * `game.json`, hashed assets, engine pre-bundling, and the Vitest defaults.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ViteUserConfig as UserConfig } from 'vitest/config';
import { gameHtmlPlugin } from './game-html-plugin.ts';
import { readManifest } from './manifest-file.ts';
import { buildTestConfig, type SlowTests } from './test-config.ts';

export { readManifest } from './manifest-file.ts';
export type { SlowTests } from './test-config.ts';

const ENGINE_DEPS = ['phaser', 'three', '@dimforge/rapier3d-compat'];

/** Options of `defineGameConfig` that shape more than one part of the config. */
export interface GameConfigOptions {
  /** Moves these test files into their own Vitest project, leaving `unit` as the default. */
  slowTests?: SlowTests;
}

/**
 * Vite config for a game. Usage in games/<slug>/vite.config.ts:
 *   export default defineGameConfig(import.meta.url);
 *
 * Sets the base path from game.json, puts hashed assets under _v/ (the only
 * folder served as immutable), pre-bundles engines so the first dev run in a
 * fresh worktree doesn't reload mid-test, and injects title and share tags.
 * Every key of `overrides` reaches the result; `plugins`, `build`, `optimizeDeps`, `server` and
 * `test` merge with the defaults, and the rest (`define`, for one) pass straight through. `root` and
 * `base` always come from `game.json`, whatever `overrides` says.
 *
 * @throws {Error} When `game.json` is missing or invalid, or its slug differs from the game's folder name.
 */
export function defineGameConfig(
  configUrl: string,
  overrides: UserConfig = {},
  options: GameConfigOptions = {},
): UserConfig {
  const root = dirname(fileURLToPath(configUrl));
  const manifest = readManifest(root);
  const folder = basename(root);
  if (manifest.slug !== folder) {
    throw new Error(`game.json slug "${manifest.slug}" must match its folder name "${folder}" (${root})`);
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const engines = ENGINE_DEPS.filter((d) => pkg.dependencies?.[d]);

  return {
    ...overrides,
    root,
    base: `/games/${manifest.slug}/`,
    plugins: [gameHtmlPlugin(manifest), ...(overrides.plugins ?? [])],
    build: {
      assetsDir: '_v',
      target: 'es2023',
      // No production sourcemaps: they doubled the deploy (14 MB for Rush Racers) and approach Cloudflare's per-file limit.
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      ...overrides.build,
    },
    optimizeDeps: { include: engines, ...overrides.optimizeDeps },
    server: {
      host: '127.0.0.1',
      // Browser console lines show up in the dev server terminal, which helps agents running `pnpm dev`.
      // Test runs capture the console themselves, so they turn this off to keep output short.
      forwardConsole: !process.env.ARCADE_TEST_SERVER,
      ...overrides.server,
    },
    test: buildTestConfig(overrides.test, options.slowTests),
  };
}
