/**
 * Image work for `arcade see`, done in a spare browser page so the CLI needs no image libraries:
 * the contact sheet of captured frames, and pixel diffs of each frame against a baseline run.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/** A screenshot `see` wrote, by the tick it shows. */
export interface CapturedFrame {
  tick: number;
  file: string;
}

/** How one captured frame compares with its baseline, as the summary prints it. */
export interface Comparison {
  tick: number;
  differs: boolean;
  result: string;
}

/** What the in-page diff reports: `changed` is -1 when the sizes differ, and `png` is set only when pixels changed. */
interface PixelDiff {
  size: string;
  changed: number;
  total: number;
  png: string;
}

/**
 * Writes one image with every captured frame side by side, labeled by tick, capped so pixel art
 * stays legible. `crop` ("x,y,w,h") shows only that part of each frame.
 *
 * @throws {Error} When a frame can't be read or the sheet can't be rendered or saved.
 */
export async function contactSheet(page: Page, frames: CapturedFrame[], out: string, crop?: string): Promise<void> {
  const images = frames.map((f) => ({ tick: f.tick, src: dataUrl(f.file) }));
  const [cx, cy, cw, ch] = crop ? crop.split(',').map(Number) : [];
  const cell = crop ? `width:${cw}px;height:${ch}px;overflow:hidden;position:relative` : 'max-width:600px';
  const img = crop ? `position:absolute;left:-${cx}px;top:-${cy}px` : 'max-width:600px;display:block';
  const sheet = await page.context().newPage();
  try {
    await sheet.setContent(
      `<body style="margin:0;background:#222"><div id="sheet" style="background:#222;color:#fff;font:14px monospace;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:max-content;max-width:1880px">${images
        .map(
          (i) =>
            `<figure style="margin:0"><div style="${cell}"><img src="${i.src}" style="${img};image-rendering:pixelated"></div><figcaption>tick ${i.tick}</figcaption></figure>`,
        )
        .join('')}</div></body>`,
    );
    await sheet.locator('#sheet').screenshot({ path: out });
  } finally {
    await sheet.close();
  }
}

/**
 * Diffs each captured frame against `<dir>/frame-<tick>.png`, writing `diff-<tick>.png` into
 * `runDir` with changed pixels in red over a faded copy of the new frame. A missing baseline frame
 * counts as a difference.
 *
 * @throws {Error} When a frame can't be read or decoded, or a diff can't be written.
 */
export async function compareFrames(
  page: Page,
  frames: CapturedFrame[],
  dir: string,
  runDir: string,
): Promise<Comparison[]> {
  const comparisons: Comparison[] = [];
  const sheet = await page.context().newPage();
  try {
    for (const f of frames) {
      const base = join(dir, `frame-${f.tick}.png`);
      if (!existsSync(base)) {
        comparisons.push({ tick: f.tick, differs: true, result: `no baseline frame-${f.tick}.png` });
        continue;
      }
      const diff = await diffInPage(sheet, dataUrl(f.file), dataUrl(base));
      comparisons.push(describeDiff(diff, f.tick, runDir));
    }
  } finally {
    await sheet.close();
  }
  return comparisons;
}

/** A PNG file as a `data:` URL a page can load. */
function dataUrl(file: string): string {
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
}

/** The summary's verdict for one frame, writing its diff image when pixels changed. */
function describeDiff(diff: PixelDiff, tick: number, runDir: string): Comparison {
  if (diff.changed < 0) return { tick, differs: true, result: `size differs: ${diff.size}` };
  if (diff.changed === 0) return { tick, differs: false, result: 'identical' };
  writeFileSync(join(runDir, `diff-${tick}.png`), Buffer.from(diff.png.split(',')[1] ?? '', 'base64'));
  const pct = ((100 * diff.changed) / diff.total).toFixed(2);
  return { tick, differs: true, result: `${diff.changed} px differ (${pct}%), diff-${tick}.png` };
}

/**
 * Compares two images pixel by pixel on a canvas in `page`. A channel must move by more than 8 to
 * count, which ignores encoder noise but not a moved sprite or a recoloured tile.
 */
function diffInPage(page: Page, current: string, baseline: string): Promise<PixelDiff> {
  return page.evaluate(
    async ([a, b]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((ok, fail) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.onerror = () => fail(new Error('could not decode a frame'));
          img.src = src;
        });
      const [x, y] = await Promise.all([load(a as string), load(b as string)]);
      if (x.width !== y.width || x.height !== y.height) {
        return { size: `${x.width}x${x.height} vs baseline ${y.width}x${y.height}`, changed: -1, total: 0, png: '' };
      }
      const read = (img: HTMLImageElement) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d') as CanvasRenderingContext2D;
        g.drawImage(img, 0, 0);
        return { c, g, d: g.getImageData(0, 0, img.width, img.height) };
      };
      const now = read(x);
      const was = read(y).d.data;
      const px = now.d.data;
      let changed = 0;
      for (let i = 0; i < px.length; i += 4) {
        const moved =
          Math.abs((px[i] ?? 0) - (was[i] ?? 0)) > 8 ||
          Math.abs((px[i + 1] ?? 0) - (was[i + 1] ?? 0)) > 8 ||
          Math.abs((px[i + 2] ?? 0) - (was[i + 2] ?? 0)) > 8;
        if (moved) {
          changed++;
          px[i] = 255;
          px[i + 1] = 0;
          px[i + 2] = 0;
        } else {
          px[i] = ((px[i] ?? 0) + 510) / 3;
          px[i + 1] = ((px[i + 1] ?? 0) + 510) / 3;
          px[i + 2] = ((px[i + 2] ?? 0) + 510) / 3;
        }
      }
      now.g.putImageData(now.d, 0, 0);
      return { size: '', changed, total: px.length / 4, png: changed ? now.c.toDataURL('image/png') : '' };
    },
    [current, baseline],
  );
}
