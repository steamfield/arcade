import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, UserConfig } from 'vite';
import { type GameManifest, parseManifest } from './manifest.ts';

const ENGINE_DEPS = ['phaser', 'three', '@dimforge/rapier3d-compat'];

/**
 * Vite config for a game. Usage in games/<slug>/vite.config.ts:
 *   export default defineGameConfig(import.meta.url);
 *
 * Sets the base path from game.json, puts hashed assets under _v/ (the only
 * folder served as immutable), pre-bundles engines so the first dev run in a
 * fresh worktree doesn't reload mid-test, and injects title and share tags.
 */
export function defineGameConfig(configUrl: string, overrides: UserConfig = {}): UserConfig {
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
    root,
    base: `/games/${manifest.slug}/`,
    plugins: [gameHtmlPlugin(manifest), ...(overrides.plugins ?? [])],
    build: {
      assetsDir: '_v',
      target: 'es2023',
      sourcemap: true,
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
    test: {
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
      environment: 'node',
      // Dots for passes, full detail for failures: keeps agent context small. Use --reporter=verbose to list tests.
      reporters: ['dot'],
      ...(overrides as { test?: object }).test,
    },
  } as UserConfig;
}

export function readManifest(gameDir: string): GameManifest {
  const path = join(gameDir, 'game.json');
  return parseManifest(JSON.parse(readFileSync(path, 'utf8')), path);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/** Injects <title>, description and Open Graph tags so a shared /games/<slug>/ link previews properly. */
function gameHtmlPlugin(manifest: GameManifest): Plugin {
  const siteUrl = process.env.ARCADE_SITE_URL?.replace(/\/$/, '') ?? '';
  return {
    name: 'arcade:game-html',
    transformIndexHtml() {
      const url = `${siteUrl}/games/${manifest.slug}/`;
      const tags: [string, string][] = [
        ['og:title', manifest.title],
        ['og:description', manifest.pitch],
        ['og:type', 'website'],
        ['twitter:card', manifest.cover ? 'summary_large_image' : 'summary'],
      ];
      if (siteUrl) tags.push(['og:url', url]);
      if (siteUrl && manifest.cover) tags.push(['og:image', `${url}${manifest.cover.replace(/^\.?\//, '')}`]);
      return [
        { tag: 'title', children: escapeHtml(manifest.title), injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'description', content: manifest.pitch }, injectTo: 'head' },
        ...tags.map(([property, content]) => ({
          tag: 'meta',
          attrs: { property, content },
          injectTo: 'head' as const,
        })),
      ];
    },
  };
}
