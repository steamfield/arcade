/**
 * The Vite plugin that gives a game's page its title, description and share tags, so a link to
 * /games/<slug>/ previews properly.
 */
import type { Plugin } from 'vite';
import type { GameManifest } from './manifest.ts';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Injects `<title>`, description and Open Graph tags from the manifest into the game's index.html. */
export function gameHtmlPlugin(manifest: GameManifest): Plugin {
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
