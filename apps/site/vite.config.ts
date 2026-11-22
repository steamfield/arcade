import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type GameManifest, parseManifest } from '@arcade/config/manifest';
import { defineConfig, type Plugin } from 'vite';

const ROOT = resolve(import.meta.dirname, '../..');

/** Which statuses are listed. Production: published. PR previews: drafts too (ARCADE_INCLUDE=preview|all). */
function listedStatuses(): GameManifest['status'][] {
  const include = process.env.ARCADE_INCLUDE ?? 'published';
  if (include === 'all') return ['published', 'draft', 'template'];
  if (include === 'preview') return ['published', 'draft'];
  return ['published'];
}

function readGames(): GameManifest[] {
  const dir = join(ROOT, 'games');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name, 'game.json'))
    .filter((p) => existsSync(p))
    .map((p) => parseManifest(JSON.parse(readFileSync(p, 'utf8')), p))
    .filter((g) => listedStatuses().includes(g.status))
    .sort((a, b) => a.title.localeCompare(b.title));
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Renders the game list into index.html at build time from every games/<slug>/game.json. */
function gameIndex(): Plugin {
  return {
    name: 'arcade:game-index',
    transformIndexHtml(html) {
      const games = readGames();
      const cards = games.length
        ? games
            .map(
              (g) => `<li class="game">
  <a href="/games/${g.slug}/">
    <span class="title">${esc(g.title)}</span>
    <span class="pitch">${esc(g.pitch)}</span>
    <span class="meta">${esc(g.genre)}${g.status === 'draft' ? ' · draft' : ''}${g.inputs.includes('touch') ? ' · plays on phones' : ''}</span>
  </a>
</li>`,
            )
            .join('\n')
        : '<li class="empty">No games published yet.</li>';
      return html.replace('<!-- games -->', cards);
    },
  };
}

export default defineConfig({
  plugins: [gameIndex()],
  build: { assetsDir: '_v', target: 'es2023', rollupOptions: { input: { index: 'index.html', notFound: '404.html' } } },
  server: { host: '127.0.0.1' },
});
