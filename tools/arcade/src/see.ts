import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  debug: boolean;
  mobile: boolean;
  ascii: boolean;
  field?: string;
  crop?: string;
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
  const total = steps.reduce((n, s) => n + s.ticks, 0);
  const captureAt = opts.at ? opts.at.split(',').map((t) => (t.trim() === 'end' ? total : Number(t))) : [total];
  if (captureAt.some((t) => !Number.isInteger(t) || t < 0 || t > total)) {
    throw new UsageError(`--at ticks must be integers between 0 and ${total} (the input's length), or "end"`);
  }
  const captures = [...new Set(captureAt)].sort((a, b) => a - b);

  const runDir = makeRunDir(slug);
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
      ...(opts.mobile ? phone : { viewport: { width: 960, height: 540 } }),
      baseURL: `http://127.0.0.1:${address.port}`,
    });
    const page = await context.newPage();
    const driver = new GameDriver(page, `/games/${slug}/`);
    const seed = opts.seed ?? scenario?.start?.seed;
    const scene = opts.scene ?? scenario?.start?.scene;
    await driver.open({
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

    lines.push(`run: ${relative(ROOT, runDir)}  (${elapsed(start)})`);
    lines.push(`renderer: ${renderer}   ticks: ${total}   seed: ${seed ?? 1}${opts.mobile ? '   device: mobile' : ''}`);
    if (scenario) lines.push(`scenario ${opts.scenario}: ${scenarioResult || 'ran (no expectations)'}`);
    for (const f of frames) lines.push(`tick ${f.tick}: ${JSON.stringify(f.summary)}`);
    lines.push(`events: ${summarizeEvents(events)}`);
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

async function loadScenario(gameDir: string, name: string): Promise<Scenario> {
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

function makeRunDir(slug: string): string {
  const runs = join(ROOT, '.arcade', 'runs');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const dir = join(runs, `${stamp}-${slug}`);
  mkdirSync(dir, { recursive: true });
  const latest = join(runs, 'latest');
  rmSync(latest, { force: true });
  symlinkSync(dir, latest);
  // Keep the 20 most recent runs.
  const all = readdirSync(runs)
    .filter((d) => d !== 'latest')
    .sort();
  for (const old of all.slice(0, Math.max(0, all.length - 20)))
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
