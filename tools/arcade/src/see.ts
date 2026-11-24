import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GameDriver, type InputStep, parseInput, type Scenario } from '@arcade/testing';
import { chromium, devices } from '@playwright/test';
import { createServer } from 'vite';
import { findGame, ROOT, UsageError } from './games.ts';
import { elapsed } from './run.ts';

export interface SeeOptions {
  scenario?: string;
  input?: string;
  at?: string;
  seed?: string;
  scene?: string;
  /** Extra launch parameters as k=v strings; they override the scenario's `start.query`. */
  query?: string[];
  debug: boolean;
  mobile: boolean;
  /** Desktop viewport as WxH (default 960x540); not with `mobile`. */
  viewport?: string;
  ascii: boolean;
  field?: string;
  crop?: string;
  /** Write the run here instead of a dated folder under .arcade/runs (kept until you delete it). */
  out?: string;
  /** A folder of frame-<tick>.png from an earlier run to diff each captured frame against. */
  compare?: string;
  /** Print events with ticks: 'all' or a type prefix like 'player'. */
  events?: string;
}

/**
 * Run a game headlessly to an exact state and capture what an agent needs to
 * judge it: screenshots, summary, state, events, console. Starts its own Vite
 * server from this worktree on a free port and shuts it down afterwards.
 */
export async function see(slug: string, opts: SeeOptions): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const scenario = opts.scenario ? await loadScenario(game.dir, opts.scenario) : undefined;
  const steps: InputStep[] = [...(scenario?.input ?? []), ...(opts.input ? parseInput(opts.input) : [])];
  const inputTicks = steps.reduce((n, s) => n + s.ticks, 0);
  const captureAt = opts.at
    ? opts.at.split(',').map((t) => (t.trim() === 'end' ? inputTicks : Number(t)))
    : [inputTicks];
  if (captureAt.some((t) => !Number.isInteger(t) || t < 0)) {
    throw new UsageError('--at ticks must be non-negative integers, or "end"');
  }
  const captures = [...new Set(captureAt)].sort((a, b) => a - b);
  // A capture past the input waits for it with nothing pressed, so idle scenes need no `_*N` padding.
  const padded = Math.max(0, (captures.at(-1) ?? 0) - inputTicks);
  if (padded > 0) steps.push({ actions: [], ticks: padded });
  const total = inputTicks + padded;
  const compareDir = opts.compare ? resolve(opts.compare) : undefined;
  if (compareDir && !existsSync(compareDir)) throw new UsageError(`--compare folder ${opts.compare} does not exist`);
  if (opts.mobile && opts.viewport) throw new UsageError('--viewport sets a desktop window; drop it or --mobile');

  const runDir = opts.out ? makeOutDir(opts.out) : makeRunDir(slug);
  process.env.ARCADE_TEST_SERVER = '1';
  const server = await createServer({
    configFile: join(game.dir, 'vite.config.ts'),
    root: game.dir,
    logLevel: 'error',
    server: { port: 0, host: '127.0.0.1' },
  });
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const lines: string[] = [];
  let failed = false;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Vite did not report a port');
    const phone = game.manifest.orientation === 'landscape' ? devices['Pixel 7 landscape'] : devices['Pixel 7'];
    const context = await browser.newContext({
      ...(opts.mobile ? phone : { viewport: parseViewport(opts.viewport ?? '960x540') }),
      baseURL: `http://127.0.0.1:${address.port}`,
    });
    const page = await context.newPage();
    const driver = new GameDriver(page, `/games/${slug}/`);
    const seed = opts.seed ?? scenario?.start?.seed;
    const scene = opts.scene ?? scenario?.start?.scene;
    const query = { ...scenario?.start?.query, ...parseQuery(opts.query ?? []) };
    await driver.open({
      query,
      ...(seed !== undefined && { seed: Number(seed) }),
      ...(scene !== undefined && { scene }),
      debug: opts.debug,
      touch: opts.mobile,
    });
    if (scenario?.start?.save !== undefined) await driver.loadState(scenario.start.save);

    // Play the input, pausing at each capture tick.
    const frames: { tick: number; file: string; summary: Record<string, unknown> }[] = [];
    let tick = 0;
    const capture = async () => {
      const file = join(runDir, `frame-${tick}.png`);
      await driver.screenshot(file);
      frames.push({ tick, file, summary: await driver.summary() });
    };
    for (const step of steps) {
      await page.evaluate((a) => {
        for (const x of a) window.__arcade?.inject(x, true);
      }, step.actions);
      let left = step.ticks;
      while (left > 0) {
        while (captures[0] === tick) {
          captures.shift();
          await capture();
        }
        const next = captures[0] !== undefined && captures[0] < tick + left ? captures[0] - tick : left;
        await driver.advance(next);
        tick += next;
        left -= next;
      }
      await page.evaluate((a) => {
        for (const x of a) window.__arcade?.inject(x, false);
      }, step.actions);
    }
    while (captures.length > 0) {
      captures.shift();
      await capture();
    }
    const comparisons = compareDir ? await compareFrames(page, frames, compareDir, runDir) : [];
    if (frames.length > 1) await contactSheet(page, frames, join(runDir, 'frames.png'), opts.crop);
    else if (opts.crop && frames[0]) await contactSheet(page, frames, frames[0].file, opts.crop);

    const state = await driver.state();
    const events = await driver.events();
    const problems = await driver.problems();
    const renderer = await driver.renderer();
    writeFileSync(join(runDir, 'state.json'), JSON.stringify(state, null, 2));
    writeFileSync(join(runDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n'));
    writeFileSync(join(runDir, 'console.log'), driver.console.join('\n'));

    let scenarioResult = '';
    if (scenario?.expect) {
      try {
        await scenario.expect({ summary: await driver.summary(), state, events });
        scenarioResult = scenario.todo ? 'PASSED, but it is marked todo: remove `todo` if the bug is fixed' : 'PASSED';
      } catch (err) {
        scenarioResult = scenario.todo
          ? 'failed as expected (todo)'
          : `FAILED\n${indent(String((err as Error).message))}`;
        failed = !scenario.todo;
      }
    }

    // Absolute, so an agent in a worktree or a subfolder reads this run, not another checkout's `latest`.
    lines.push(`run: ${runDir}  (${elapsed(start)})`);
    lines.push(
      `renderer: ${renderer}   ticks: ${total}${padded ? ` (input ${inputTicks} + ${padded} idle to reach --at)` : ''}   seed: ${seed ?? 1}${opts.mobile ? '   device: mobile' : ''}`,
    );
    if (scenario) lines.push(`scenario ${opts.scenario}: ${scenarioResult || 'ran (no expectations)'}`);
    for (const f of frames) lines.push(`tick ${f.tick}: ${JSON.stringify(f.summary)}`);
    lines.push(`events: ${summarizeEvents(events)}`);
    if (compareDir) {
      lines.push(`compare with ${relative(ROOT, compareDir)}:`);
      for (const c of comparisons) lines.push(`  tick ${c.tick}: ${c.result}`);
      const differing = comparisons.filter((c) => c.differs).length;
      lines.push(
        differing
          ? `  ${differing} of ${comparisons.length} frame(s) differ: see diff-<tick>.png (changes in red)`
          : '  all frames identical',
      );
    }
    if (opts.events) {
      const shown = events.filter((e) => opts.events === 'all' || e.type.startsWith(opts.events ?? ''));
      for (const e of shown.slice(0, 50)) {
        const { type, tick, seq: _seq, ...data } = e as { type: string; tick: number; seq?: number };
        lines.push(
          `  tick ${String(tick).padStart(5)}  ${type}${Object.keys(data).length ? ` ${JSON.stringify(data)}` : ''}`,
        );
      }
      if (shown.length > 50) lines.push(`  … ${shown.length - 50} more in events.jsonl`);
    }
    // GPU-stall notices come from our own screenshots (ReadPixels), not from the game.
    const warnings = dedupe(
      driver.console.filter(
        (l) => l.startsWith('[warning]') && !/GL Driver Message|GPU stall due to ReadPixels/.test(l),
      ),
    );
    if (warnings.length) lines.push(`console warnings:\n${warnings.map((w) => `  ${w}`).join('\n')}`);
    if (problems.length) {
      failed = true;
      lines.push(`PROBLEMS:\n${problems.map((p) => `  ${p.kind}: ${p.message.split('\n')[0]}`).join('\n')}`);
    }
    if (opts.ascii) {
      const ascii = (state as { ascii?: string } | null)?.ascii;
      lines.push(ascii ? `ascii:\n${ascii}` : 'ascii: this game does not expose debugState().ascii');
    }
    if (opts.field) lines.push(`${opts.field}: ${JSON.stringify(pick(state, opts.field), null, 2)}`);
    lines.push(
      `files: ${frames.length > 1 ? 'frames.png, ' : ''}${frames.map((f) => `frame-${f.tick}.png`).join(', ')}, state.json, events.jsonl, console.log`,
    );
  } finally {
    await browser.close();
    await server.close();
  }
  const text = lines.join('\n');
  writeFileSync(join(runDir, 'summary.txt'), text);
  console.log(text);
  return failed ? 1 : 0;
}

/** `["stage=guide", "a=b"]` → `{ stage: 'guide', a: 'b' }`. */
export function parseQuery(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq <= 0) throw new UsageError(`--query takes key=value, got "${pair}"`);
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

export async function loadScenario(gameDir: string, name: string): Promise<Scenario> {
  const file = join(gameDir, 'scenarios', `${name.replace(/\.ts$/, '')}.ts`);
  if (!existsSync(file)) {
    const known = existsSync(join(gameDir, 'scenarios'))
      ? readdirSync(join(gameDir, 'scenarios'))
          .filter((f) => f.endsWith('.ts') && f !== 'kit.ts')
          .map((f) => f.replace(/\.ts$/, ''))
      : [];
    throw new UsageError(`No scenario "${name}". Known: ${known.join(', ') || '(none)'}`);
  }
  const mod = (await import(pathToFileURL(file).href)) as { default?: Scenario };
  if (!mod.default) throw new UsageError(`${file} must default-export a scenario(...)`);
  return mod.default;
}

/** `--viewport 1280x800` as Playwright's viewport. */
function parseViewport(value: string): { width: number; height: number } {
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(value);
  if (!m) throw new UsageError(`--viewport ${value}: use WIDTHxHEIGHT, for example 1280x800`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** `--out <dir>`: a run folder the caller names, emptied first. Refuses a folder that isn't a previous run. */
function makeOutDir(out: string): string {
  const dir = resolve(out);
  if (existsSync(dir) && readdirSync(dir).length > 0 && !existsSync(join(dir, 'summary.txt'))) {
    throw new UsageError(`--out ${out} has files that aren't an arcade see run; pick an empty or new folder`);
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const latest = join(ROOT, '.arcade', 'runs', 'latest');
  mkdirSync(dirname(latest), { recursive: true });
  rmSync(latest, { force: true });
  symlinkSync(dir, latest);
  return dir;
}

function makeRunDir(slug: string): string {
  const runs = join(ROOT, '.arcade', 'runs');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const dir = join(runs, `${stamp}-${slug}`);
  mkdirSync(dir, { recursive: true });
  const latest = join(runs, 'latest');
  rmSync(latest, { force: true });
  symlinkSync(dir, latest);
  // Keep the 50 most recent runs (a baseline sweep can be 30+); use --out for runs to keep.
  const all = readdirSync(runs)
    .filter((d) => d !== 'latest')
    .sort();
  for (const old of all.slice(0, Math.max(0, all.length - 50)))
    rmSync(join(runs, old), { recursive: true, force: true });
  return dir;
}

/** One image with every captured frame side by side, labeled by tick, capped so pixel art stays legible. */
async function contactSheet(
  page: import('@playwright/test').Page,
  frames: { tick: number; file: string }[],
  out: string,
  crop?: string,
): Promise<void> {
  const { readFileSync } = await import('node:fs');
  const images = frames.map((f) => ({
    tick: f.tick,
    src: `data:image/png;base64,${readFileSync(f.file).toString('base64')}`,
  }));
  const [cx, cy, cw, ch] = crop ? crop.split(',').map(Number) : [];
  const sheet = await page.context().newPage();
  const cell = crop ? `width:${cw}px;height:${ch}px;overflow:hidden;position:relative` : 'max-width:600px';
  const img = crop ? `position:absolute;left:-${cx}px;top:-${cy}px` : 'max-width:600px;display:block';
  await sheet.setContent(
    `<body style="margin:0;background:#222"><div id="sheet" style="background:#222;color:#fff;font:14px monospace;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:max-content;max-width:1880px">${images
      .map(
        (i) =>
          `<figure style="margin:0"><div style="${cell}"><img src="${i.src}" style="${img};image-rendering:pixelated"></div><figcaption>tick ${i.tick}</figcaption></figure>`,
      )
      .join('')}</div></body>`,
  );
  await sheet.locator('#sheet').screenshot({ path: out });
  await sheet.close();
}

interface Comparison {
  tick: number;
  differs: boolean;
  result: string;
}

/**
 * Diff each captured frame against `<dir>/frame-<tick>.png` in the browser (no image libraries), writing
 * `diff-<tick>.png` with changed pixels in red over a faded copy of the new frame. A channel must move by more
 * than 8 to count, which ignores encoder noise but not a moved sprite or a recoloured tile.
 */
async function compareFrames(
  page: import('@playwright/test').Page,
  frames: { tick: number; file: string }[],
  dir: string,
  runDir: string,
): Promise<Comparison[]> {
  const { readFileSync } = await import('node:fs');
  const out: Comparison[] = [];
  const sheet = await page.context().newPage();
  try {
    for (const f of frames) {
      const base = join(dir, `frame-${f.tick}.png`);
      if (!existsSync(base)) {
        out.push({ tick: f.tick, differs: true, result: `no baseline frame-${f.tick}.png` });
        continue;
      }
      const toUrl = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
      const r = await sheet.evaluate(
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
            return {
              size: `${x.width}x${x.height} vs baseline ${y.width}x${y.height}`,
              changed: -1,
              total: 0,
              png: '',
            };
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
        [toUrl(f.file), toUrl(base)],
      );
      if (r.changed < 0) {
        out.push({ tick: f.tick, differs: true, result: `size differs: ${r.size}` });
      } else if (r.changed === 0) {
        out.push({ tick: f.tick, differs: false, result: 'identical' });
      } else {
        writeFileSync(join(runDir, `diff-${f.tick}.png`), Buffer.from(r.png.split(',')[1] ?? '', 'base64'));
        const pct = ((100 * r.changed) / r.total).toFixed(2);
        out.push({ tick: f.tick, differs: true, result: `${r.changed} px differ (${pct}%), diff-${f.tick}.png` });
      }
    }
  } finally {
    await sheet.close();
  }
  return out;
}

function summarizeEvents(events: { type: string }[]): string {
  if (events.length === 0) return '(none)';
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(', ');
}

function dedupe(lines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l.slice(0, 200), (counts.get(l.slice(0, 200)) ?? 0) + 1);
  return [...counts].map(([l, n]) => (n > 1 ? `${l} (×${n})` : l));
}

function pick(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((v, key) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined), value);
}

const indent = (s: string) =>
  s
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
