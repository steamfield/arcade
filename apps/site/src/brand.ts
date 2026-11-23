// The Steamfield Arcade brand pack: the invader mark, the wordmark, lockups and the link-preview image,
// drawn from bitmaps into crisp SVG and rendered to PNG with rsvg-convert.
// Run `pnpm --filter @arcade/site brand` after changing anything here; the output is committed.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GLYPHS, pixelLogo } from './pixel.ts';

export const COLORS = {
  ink: '#0b0a1e',
  night: '#120f2b',
  indigo: '#211b48',
  foam: '#f6f0dc',
  dim: '#a9a6d0',
  sunLight: '#ffe27a',
  sun: '#ffc53a',
  orange: '#ff7a3d',
  coral: '#ff5f5f',
  cyan: '#5fd4ff',
  magenta: '#c04bd6',
} as const;

/**
 * The mark: an invader with a steam vent on its crown. `#` body, `e` eye, `s` steam.
 * 15 x 12 cells; the body takes the cabinet's sunset bands row by row.
 */
const INVADER = [
  '.........ss....',
  '........ssss...',
  '.......s.......',
  '......###......',
  '...#########...',
  '..###########..',
  '.###ee###ee###.',
  '.###ee###ee###.',
  '###############',
  '#.###########.#',
  '#.#.........#.#',
  '...##.....##...',
];
const BODY_BANDS = ['#fff4c2', '#ffe27a', '#ffc53a', '#ffc53a', '#ff9f2e', '#ff7a3d', '#ff5f5f', '#ff5f5f'];
const STEAM = ['#f6f0dc', '#d6d2f0', '#a9a6d0'];

type Cell = { x: number; y: number };
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;

function cellsOf(rows: string[], ch: string): Cell[] {
  const out: Cell[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === ch) out.push({ x, y });
    });
  });
  return out;
}

/** Ink ring one cell wide around every filled cell, so the mark reads on light and dark grounds. */
function outlineOf(filled: Cell[]): Cell[] {
  const has = new Set(filled.map((c) => `${c.x},${c.y}`));
  const ring = new Map<string, Cell>();
  for (const { x, y } of filled)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (!has.has(k)) ring.set(k, { x: x + dx, y: y + dy });
      }
  return [...ring.values()];
}

/** The invader's cells as rects, offset by one cell so the outline fits. Size is 17 x 15 units. */
function invaderBody(): string {
  const body = cellsOf(INVADER, '#');
  const eyes = cellsOf(INVADER, 'e');
  const steam = cellsOf(INVADER, 's');
  const shift = (c: Cell) => ({ x: c.x + 1, y: c.y + 1 });
  const firstBodyRow = Math.min(...body.map((c) => c.y));
  let out = '';
  for (const c of outlineOf([...body, ...eyes, ...steam]).map(shift)) out += rect(c.x, c.y, 1, 1, COLORS.ink);
  for (const c of body.map(shift)) out += rect(c.x, c.y, 1, 1, BODY_BANDS[c.y - 1 - firstBodyRow] ?? COLORS.coral);
  for (const c of eyes.map(shift)) out += rect(c.x, c.y, 1, 1, c.y - 1 === 6 ? COLORS.foam : COLORS.cyan);
  for (const c of steam.map(shift)) out += rect(c.x, c.y, 1, 1, STEAM[c.y - 1] ?? COLORS.dim);
  return out;
}
const MARK_W = (INVADER[0]?.length ?? 0) + 2;
const MARK_H = INVADER.length + 2;

const svg = (w: number, h: number, body: string, title: string, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" shape-rendering="crispEdges"><title>${title}</title>${body}</svg>\n`;

/** Place a pixel SVG (anything with a viewBox) at x,y scaled by a whole number, as a nested <svg>. */
function place(inner: string, x: number, y: number, scale: number): { svg: string; w: number; h: number } {
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(inner);
  if (!m) throw new Error('place() needs an svg with a viewBox');
  const w = Number(m[1]) * scale;
  const h = Number(m[2]) * scale;
  const open = inner.slice(0, inner.indexOf('>') + 1);
  const nested = inner.replace(
    open,
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${m[1]} ${m[2]}">`,
  );
  return { svg: nested, w, h };
}

const markInner = () => `<svg viewBox="0 0 ${MARK_W} ${MARK_H}">${invaderBody()}</svg>`;

/** Plain 5x7 text in one colour (no bold, no outline), for taglines. */
function pixelText(text: string, fill: string): string {
  let out = '';
  let cursor = 0;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch];
    if (!glyph) throw new Error(`pixelText has no glyph for "${ch}"`);
    glyph.forEach((row, y) => {
      [...row].forEach((p, x) => {
        if (p === '#') out += rect(cursor + x, y, 1, 1, fill);
      });
    });
    cursor += (glyph[0]?.length ?? 0) + 1;
  }
  return `<svg viewBox="0 0 ${cursor - 1} 7">${out}</svg>`;
}

/** STEAMFIELD over ARCADE, sized so the two lines are close to the same width. */
function wordmarkInner(): { svg: string; w: number; h: number } {
  const top = place(pixelLogo('Steamfield'), 0, 0, 8);
  const bottom = place(pixelLogo('Arcade'), 0, 0, 13);
  const w = Math.max(top.w, bottom.w);
  const gap = -8;
  const a = place(pixelLogo('Steamfield'), Math.round((w - top.w) / 2), 0, 8);
  const b = place(pixelLogo('Arcade'), Math.round((w - bottom.w) / 2), top.h + gap, 13);
  return { svg: a.svg + b.svg, w, h: top.h + gap + bottom.h };
}

/** The cabinet marquee's dusk: hard-stop bands top to bottom. */
const DUSK: [number, string][] = [
  [0, '#140f36'],
  [0.18, '#1d1546'],
  [0.34, '#2a1b5c'],
  [0.5, '#43206e'],
  [0.64, '#6a2470'],
  [0.76, '#9a2c62'],
  [0.86, '#c9454c'],
  [0.94, '#ff7a3d'],
];
function duskBands(w: number, h: number): string {
  return DUSK.map(([at, fill], i) => {
    const y = Math.round(at * h);
    const next = Math.round((DUSK[i + 1]?.[0] ?? 1) * h);
    return rect(0, y, w, next - y, fill);
  }).join('');
}

function stars(w: number, h: number, size: number): string {
  // A fixed scatter (no randomness, so the output is stable between runs).
  const spots = [
    [0.05, 0.08, 1],
    [0.13, 0.3, 0.6],
    [0.22, 0.12, 0.8],
    [0.31, 0.44, 0.4],
    [0.38, 0.06, 1],
    [0.47, 0.22, 0.5],
    [0.56, 0.1, 0.9],
    [0.63, 0.36, 0.4],
    [0.71, 0.05, 0.7],
    [0.79, 0.26, 1],
    [0.86, 0.14, 0.5],
    [0.94, 0.4, 0.8],
    [0.97, 0.07, 0.6],
    [0.09, 0.52, 0.4],
    [0.9, 0.55, 0.3],
  ] as const;
  return spots
    .map(([x, y, o]) => rect(Math.round(x * w), Math.round(y * h), size, size, '#fff4c2', ` opacity="${o}"`))
    .join('');
}

function scanlines(w: number, h: number, every: number): string {
  let out = '';
  for (let y = 0; y < h; y += every) out += rect(0, y, w, 1, '#000', ' opacity="0.14"');
  return out;
}

/** 1200 x 630 link preview: dusk sky, the mark, the wordmark, a tagline and the address. */
function ogImage(): string {
  const W = 1200;
  const H = 630;
  const mark = place(markInner(), 70, 0, 20);
  const word = wordmarkInner();
  const tag = place(pixelText('Free browser games', COLORS.foam), 0, 0, 5);
  const url = place(pixelText('arcade.steamfield.io', COLORS.sunLight), 0, 0, 3);
  const rightX = mark.w + 70 + 56;
  const blockH = word.h + 36 + tag.h;
  const top = Math.round((H - 40 - blockH) / 2);
  const markY = Math.round((H - 40 - mark.h) / 2);
  const wordX = rightX + Math.round((W - 60 - rightX - word.w) / 2);
  const tagX = wordX + Math.round((word.w - tag.w) / 2);
  // Floor: an ink strip at the bottom with the address, like the bottom HUD on the cabinet screen.
  const floor = rect(0, H - 56, W, 56, COLORS.ink) + rect(0, H - 60, W, 4, COLORS.sun);
  const body =
    duskBands(W, H - 56) +
    stars(W, H - 56, 6) +
    place(markInner(), 70, markY, 20).svg +
    `<g transform="translate(${wordX} ${top})">${word.svg}</g>` +
    place(pixelText('Free browser games', COLORS.foam), tagX, top + word.h + 36, 5).svg +
    floor +
    place(pixelText('arcade.steamfield.io', COLORS.sunLight), W - 48 - url.w, H - 28 - Math.round(url.h / 2), 3).svg +
    place(pixelText('No installs. No accounts.', COLORS.dim), 48, H - 28 - Math.round(url.h / 2), 3).svg +
    scanlines(W, H, 4);
  return svg(W, H, body, 'Steamfield Arcade');
}

/** Square mark on the ink ground with a margin, for app icons, avatars and the favicon. */
function tile(): string {
  const pad = 2;
  const s = MARK_W + pad * 2;
  const y = Math.round((s - MARK_H) / 2);
  return svg(
    s,
    s,
    rect(0, 0, s, s, COLORS.ink) + place(markInner(), pad, y, 1).svg,
    'Steamfield Arcade',
    `0 0 ${s} ${s}`,
  );
}

function lockup(): string {
  const mark = place(markInner(), 0, 0, 20);
  const word = wordmarkInner();
  const gap = 40;
  const h = Math.max(mark.h, word.h);
  const body =
    place(markInner(), 0, Math.round((h - mark.h) / 2), 20).svg +
    `<g transform="translate(${mark.w + gap} ${Math.round((h - word.h) / 2)})">${word.svg}</g>`;
  return svg(mark.w + gap + word.w, h, body, 'Steamfield Arcade');
}

function main(): void {
  const site = resolve(import.meta.dirname, '..');
  const out = join(site, 'public/brand');
  mkdirSync(out, { recursive: true });
  const word = wordmarkInner();
  const files: Record<string, string> = {
    'mark.svg': svg(MARK_W * 16, MARK_H * 16, invaderBody(), 'Steamfield Arcade', `0 0 ${MARK_W} ${MARK_H}`),
    'mark-tile.svg': tile(),
    'wordmark.svg': svg(word.w, word.h, word.svg, 'Steamfield Arcade'),
    'lockup.svg': lockup(),
    'og-image.svg': ogImage(),
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
  writeFileSync(join(site, 'src/favicon.svg'), tile());

  const png = (from: string, to: string, width: number) =>
    execFileSync('rsvg-convert', ['-w', String(width), '-o', join(out, to), join(out, from)]);
  for (const w of [64, 256, 512, 1024]) png('mark.svg', `mark-${w}.png`, w);
  for (const w of [180, 512, 1024]) png('mark-tile.svg', `mark-tile-${w}.png`, w);
  png('wordmark.svg', 'wordmark.png', word.w * 2);
  png('lockup.svg', 'lockup.png', 1600);
  png('og-image.svg', 'og-image.png', 1200);
  execFileSync('rsvg-convert', [
    '-w',
    '180',
    '-o',
    join(site, 'public/apple-touch-icon.png'),
    join(out, 'mark-tile.svg'),
  ]);
  console.log(`brand pack written to ${out}`);
}

if (import.meta.main) main();
