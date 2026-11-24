import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { GameManifest } from '@arcade/config/manifest';
import { readManifestsIn } from '@arcade/config/manifest-file';
import { defineConfig, type Plugin } from 'vite';
import { pixelIcon, pixelLogo } from './src/pixel.ts';

const ROOT = resolve(import.meta.dirname, '../..');

/** Which statuses are listed. Production: published. PR previews: drafts too (ARCADE_INCLUDE=preview|all). */
function listedStatuses(): GameManifest['status'][] {
  const include = process.env.ARCADE_INCLUDE ?? 'published';
  if (include === 'all') return ['published', 'draft', 'template'];
  if (include === 'preview') return ['published', 'draft'];
  return ['published'];
}

function readGames(): GameManifest[] {
  return readManifestsIn(join(ROOT, 'games'))
    .map((entry) => entry.manifest)
    .filter((g) => listedStatuses().includes(g.status))
    .sort((a, b) => a.title.localeCompare(b.title));
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const INPUT_LABEL: Record<GameManifest['inputs'][number], string> = {
  keyboard: 'Keyboard',
  touch: 'Touch',
  gamepad: 'Gamepad',
};

/** What the select screen's script needs per game. Rendered into the page as JSON. */
export interface SiteGame {
  id: string;
  slug: string;
  title: string;
  pitch: string;
  genre: string;
  draft: boolean;
  href: string;
  cover: string | null;
  attract: string | null;
  inputs: { name: string; label: string; icon: string }[];
}

function toSiteGame(g: GameManifest): SiteGame {
  const href = `/games/${g.slug}/`;
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    pitch: g.pitch,
    genre: g.genre,
    draft: g.status !== 'published',
    href,
    cover: g.cover ? href + g.cover.replace(/^\.?\//, '') : null,
    attract: g.attract ? href + g.attract.replace(/^\.?\//, '') : null,
    inputs: g.inputs.map((name) => ({ name, label: INPUT_LABEL[name], icon: pixelIcon(name) })),
  };
}

function inputsHtml(g: SiteGame): string {
  return g.inputs.map((i) => `<li title="${i.label}">${i.icon}<span>${i.label}</span></li>`).join('');
}

/** The monitor always carries all three layers (loop, still, test card) so the script can switch games. */
function monitorHtml(g: SiteGame | undefined): string {
  const mode = g?.attract ? 'video' : g?.cover ? 'still' : 'none';
  const hide = (m: string) => (mode === m ? '' : ' hidden');
  const label = g ? `${esc(g.title)} gameplay` : '';
  const video = `<video class="attract"${g?.attract ? ` src="${g.attract}" autoplay` : ''}${g?.cover ? ` poster="${g.cover}"` : ''} muted loop playsinline preload="metadata" aria-label="${label}"${hide('video')}></video>`;
  const still = `<img class="attract still"${g?.cover ? ` src="${g.cover}"` : ''} alt="${label}"${hide('still')} />`;
  return `${video}${still}<div class="no-signal" aria-hidden="true"${hide('none')}></div>`;
}

function featureHtml(g: SiteGame | undefined): string {
  if (!g)
    return `<div class="monitor">${monitorHtml(undefined)}</div><div class="details"><h2 class="feature-title">No games yet</h2><p class="feature-pitch">The first cabinet is still being wired up.</p></div>`;
  return `<div class="monitor">${monitorHtml(g)}</div>
<div class="details">
  <h2 class="feature-title" data-field="title">${esc(g.title)}</h2>
  <p class="feature-pitch" data-field="pitch">${esc(g.pitch)}</p>
  <dl class="specs">
    <div><dt>Genre</dt><dd data-field="genre">${esc(g.genre)}${g.draft ? ' (draft)' : ''}</dd></div>
    <div><dt>Plays with</dt><dd><ul class="inputs" data-field="inputs">${inputsHtml(g)}</ul></dd></div>
    <div><dt>Progress</dt><dd data-field="progress">Saves on this device</dd></div>
  </dl>
  <a class="start-btn" data-field="href" href="${g.href}"><span class="start-label">Press start</span></a>
</div>`;
}

function shelfHtml(games: SiteGame[]): string {
  return games
    .map(
      (g, i) => `<li><a class="cart" href="${g.href}" data-index="${i}"${i === 0 ? ' aria-current="true"' : ''}>
  <span class="cart-art">${g.cover ? `<img src="${g.cover}" alt="" loading="lazy" />` : '<span class="no-signal"></span>'}</span>
  <span class="cart-title">${esc(g.title)}</span>
</a></li>`,
    )
    .join('\n');
}

/** Renders the select screen into index.html at build time from every games/<slug>/game.json. */
function selectScreen(): Plugin {
  return {
    name: 'arcade:select-screen',
    transformIndexHtml(html) {
      const games = readGames().map(toSiteGame);
      return html
        .replaceAll('<!-- logo:arcade -->', pixelLogo('Arcade'))
        .replaceAll('<!-- logo:game-over -->', pixelLogo('Game over'))
        .replace('<!-- feature -->', featureHtml(games[0]))
        .replace('<!-- shelf -->', shelfHtml(games))
        .replace(
          '<!-- games-data -->',
          `<script type="application/json" id="games-data">${JSON.stringify(games).replace(/</g, '\\u003c')}</script>`,
        );
    },
  };
}

const MIME: Record<string, string> = { '.png': 'image/png', '.mp4': 'video/mp4', '.webp': 'image/webp' };

/** Dev only: serve each game's public/ media at /games/<slug>/<file>, as the assembled site does. */
function gameMedia(): Plugin {
  return {
    name: 'arcade:game-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/games\/([a-z][a-z0-9-]*)\/([\w.-]+)$/.exec(req.url?.split('?')[0] ?? '');
        const file = m ? join(ROOT, 'games', m[1] ?? '', 'public', m[2] ?? '') : '';
        if (!m || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        res.setHeader('Content-Length', statSync(file).size);
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [selectScreen(), gameMedia()],
  build: { assetsDir: '_v', target: 'es2023', rollupOptions: { input: { index: 'index.html', notFound: '404.html' } } },
  server: { host: '127.0.0.1' },
});
