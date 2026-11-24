/**
 * `arcade see`: runs a game headlessly to exact ticks and writes what an agent needs to judge it
 * (frames, a contact sheet, summary, state, events, console, optional diffs against a baseline)
 * to a run folder, then prints the summary.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type GameDriver,
  type GameSession,
  type InputStep,
  openGameSession,
  type Problem,
  parseInput,
  type Scenario,
  type ScenarioResult,
} from '@arcade/testing';
import { createServer } from 'vite';
import { findGame, ROOT, UsageError } from './games.ts';
import { elapsed } from './run.ts';
import { type Comparison, compareFrames, contactSheet } from './see-images.ts';

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

/** The input to play and the ticks to stop and capture at. */
interface RunPlan {
  steps: InputStep[];
  /** Ticks to capture at, ascending and unique. */
  captures: number[];
  inputTicks: number;
  /** Idle ticks added after the input to reach the last `--at`. */
  padded: number;
}

interface Frame {
  tick: number;
  file: string;
  summary: Record<string, unknown>;
}

/** Everything a finished run produced, for the summary. */
interface RunRecord {
  frames: Frame[];
  comparisons: Comparison[];
  state: unknown;
  events: ScenarioResult['events'];
  problems: Problem[];
  renderer: string;
  consoleLines: string[];
  /** Empty when the run has no scenario expectations. */
  scenarioResult: string;
  scenarioFailed: boolean;
}

/**
 * Run a game headlessly to an exact state and capture what an agent needs to
 * judge it: screenshots, summary, state, events, console. Starts its own Vite
 * server from this worktree on a free port and shuts it down afterwards.
 *
 * @throws {UsageError} When an option is malformed or names a scenario or folder that doesn't exist.
 * @throws {Error} When the dev server or browser can't start, the game fails to open, a Playwright
 *   step fails during the run, or stopping the session fails. An AggregateError carries both causes
 *   when opening fails and stopping what had started fails too.
 */
export async function see(slug: string, opts: SeeOptions): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const scenario = opts.scenario ? await loadScenario(game.dir, opts.scenario) : undefined;
  const plan = planRun(scenario, opts);
  const compareDir = opts.compare ? resolve(opts.compare) : undefined;
  if (compareDir && !existsSync(compareDir)) throw new UsageError(`--compare folder ${opts.compare} does not exist`);
  if (opts.mobile && opts.viewport) throw new UsageError('--viewport sets a desktop window; drop it or --mobile');
  const viewport = opts.viewport ? parseViewport(opts.viewport) : undefined;

  const runDir = opts.out ? makeOutDir(opts.out) : makeRunDir(slug);
  const seed = opts.seed ?? scenario?.start?.seed;
  const scene = opts.scene ?? scenario?.start?.scene;
  const session = await openGameSession({
    game,
    createServer,
    mobile: opts.mobile,
    ...(viewport && { viewport }),
    open: {
      query: { ...scenario?.start?.query, ...parseQuery(opts.query ?? []) },
      ...(seed !== undefined && { seed: Number(seed) }),
      ...(scene !== undefined && { scene }),
      debug: opts.debug,
    },
  });
  let record: RunRecord;
  try {
    if (scenario?.start?.save !== undefined) await session.driver.loadState(scenario.start.save);
    const frames = await captureFrames(session, plan, runDir);
    record = await recordRun(session, frames, { scenario, compareDir, runDir, crop: opts.crop });
  } finally {
    await session.close();
  }
  const lines = [
    // Absolute, so an agent in a worktree or a subfolder reads this run, not another checkout's `latest`.
    `run: ${runDir}  (${elapsed(start)})`,
    `renderer: ${record.renderer}   ticks: ${plan.inputTicks + plan.padded}${plan.padded ? ` (input ${plan.inputTicks} + ${plan.padded} idle to reach --at)` : ''}   seed: ${seed ?? 1}${opts.mobile ? '   device: mobile' : ''}`,
    ...(scenario ? [`scenario ${opts.scenario}: ${record.scenarioResult || 'ran (no expectations)'}`] : []),
    ...summaryLines(record, opts, compareDir),
  ];
  const text = lines.join('\n');
  writeFileSync(join(runDir, 'summary.txt'), text);
  console.log(text);
  return record.scenarioFailed || record.problems.length > 0 ? 1 : 0;
}

/**
 * The scenario's input then `--input`, the `--at` capture ticks, and idle padding so a capture
 * past the input waits for it with nothing pressed (idle scenes need no `_*N` padding).
 *
 * @throws {UsageError} When an `--at` tick isn't a non-negative integer or "end".
 */
function planRun(scenario: Scenario | undefined, opts: SeeOptions): RunPlan {
  const steps: InputStep[] = [...(scenario?.input ?? []), ...(opts.input ? parseInput(opts.input) : [])];
  const inputTicks = steps.reduce((n, s) => n + s.ticks, 0);
  const captureAt = opts.at
    ? opts.at.split(',').map((t) => (t.trim() === 'end' ? inputTicks : Number(t)))
    : [inputTicks];
  if (captureAt.some((t) => !Number.isInteger(t) || t < 0)) {
    throw new UsageError('--at ticks must be non-negative integers, or "end"');
  }
  const captures = [...new Set(captureAt)].sort((a, b) => a - b);
  const padded = Math.max(0, (captures.at(-1) ?? 0) - inputTicks);
  if (padded > 0) steps.push({ actions: [], ticks: padded });
  return { steps, captures, inputTicks, padded };
}

/** Plays the plan's input, stopping at each capture tick to screenshot and read the summary. */
async function captureFrames(session: GameSession, plan: RunPlan, runDir: string): Promise<Frame[]> {
  const { page, driver } = session;
  const captures = [...plan.captures];
  const frames: Frame[] = [];
  let tick = 0;
  const capture = async () => {
    const file = join(runDir, `frame-${tick}.png`);
    await driver.screenshot(file);
    frames.push({ tick, file, summary: await driver.summary() });
  };
  for (const step of plan.steps) {
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
  return frames;
}

/**
 * Builds the contact sheet and diffs, writes state.json, events.jsonl and console.log, and runs the
 * scenario's expectations against the final state.
 */
async function recordRun(
  session: GameSession,
  frames: Frame[],
  where: { scenario: Scenario | undefined; compareDir: string | undefined; runDir: string; crop: string | undefined },
): Promise<RunRecord> {
  const { page, driver } = session;
  const comparisons = where.compareDir ? await compareFrames(page, frames, where.compareDir, where.runDir) : [];
  if (frames.length > 1) await contactSheet(page, frames, join(where.runDir, 'frames.png'), where.crop);
  else if (where.crop && frames[0]) await contactSheet(page, frames, frames[0].file, where.crop);

  const state = await driver.state();
  const events = await driver.events();
  const problems = await driver.problems();
  const renderer = await driver.renderer();
  writeFileSync(join(where.runDir, 'state.json'), JSON.stringify(state, null, 2));
  writeFileSync(join(where.runDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n'));
  writeFileSync(join(where.runDir, 'console.log'), driver.console.join('\n'));
  const verdict = where.scenario ? await judgeScenario(where.scenario, driver, state, events) : undefined;
  return {
    frames,
    comparisons,
    state,
    events,
    problems,
    renderer,
    consoleLines: [...driver.console],
    scenarioResult: verdict?.text ?? '',
    scenarioFailed: verdict?.failed ?? false,
  };
}

/** Runs a scenario's expectations, reading a `todo` scenario's pass or failure the other way round. */
async function judgeScenario(
  scenario: Scenario,
  driver: GameDriver,
  state: unknown,
  events: ScenarioResult['events'],
): Promise<{ text: string; failed: boolean } | undefined> {
  if (!scenario.expect) return undefined;
  try {
    await scenario.expect({ summary: await driver.summary(), state, events });
    const text = scenario.todo ? 'PASSED, but it is marked todo: remove `todo` if the bug is fixed' : 'PASSED';
    return { text, failed: false };
  } catch (err) {
    if (scenario.todo) return { text: 'failed as expected (todo)', failed: false };
    return { text: `FAILED\n${indent(String((err as Error).message))}`, failed: true };
  }
}

/** The summary lines after the run header: frames, events, diffs, warnings, problems and asked-for fields. */
function summaryLines(record: RunRecord, opts: SeeOptions, compareDir: string | undefined): string[] {
  const { frames, comparisons, events, problems, state } = record;
  const lines: string[] = [];
  for (const f of frames) lines.push(`tick ${f.tick}: ${JSON.stringify(f.summary)}`);
  lines.push(`events: ${summarizeEvents(events)}`);
  if (compareDir) lines.push(...comparisonLines(comparisons, compareDir));
  if (opts.events) lines.push(...eventLines(events, opts.events));
  // GPU-stall notices come from our own screenshots (ReadPixels), not from the game.
  const warnings = dedupe(
    record.consoleLines.filter(
      (l) => l.startsWith('[warning]') && !/GL Driver Message|GPU stall due to ReadPixels/.test(l),
    ),
  );
  if (warnings.length) lines.push(`console warnings:\n${warnings.map((w) => `  ${w}`).join('\n')}`);
  if (problems.length) {
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
  return lines;
}

/** One line per compared frame, then a count of the ones that differ. */
function comparisonLines(comparisons: Comparison[], compareDir: string): string[] {
  const differing = comparisons.filter((c) => c.differs).length;
  return [
    `compare with ${relative(ROOT, compareDir)}:`,
    ...comparisons.map((c) => `  tick ${c.tick}: ${c.result}`),
    differing
      ? `  ${differing} of ${comparisons.length} frame(s) differ: see diff-<tick>.png (changes in red)`
      : '  all frames identical',
  ];
}

/** Up to 50 events matching `--events` ('all' or a type prefix), each with its tick and data. */
function eventLines(events: ScenarioResult['events'], filter: string): string[] {
  const shown = events.filter((e) => filter === 'all' || e.type.startsWith(filter));
  const lines = shown.slice(0, 50).map((e) => {
    const { type, tick, seq: _seq, ...data } = e as { type: string; tick: number; seq?: number };
    return `  tick ${String(tick).padStart(5)}  ${type}${Object.keys(data).length ? ` ${JSON.stringify(data)}` : ''}`;
  });
  if (shown.length > 50) lines.push(`  … ${shown.length - 50} more in events.jsonl`);
  return lines;
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
