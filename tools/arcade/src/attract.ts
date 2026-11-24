/**
 * `arcade attract`: records a game's landing-page loop and cover. Plays the scenario named in the
 * game's package.json headlessly, screenshots the chosen ticks into a temp folder, then encodes
 * public/attract.mp4 and public/cover.png with ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { type GameSession, type InputStep, openGameSession, type Scenario } from '@arcade/testing';
import { createServer } from 'vite';
import { findGame, type GameInfo, ROOT, UsageError } from './games.ts';
import { elapsed } from './run.ts';
import { loadScenario } from './see.ts';

/** Capture settings, from the game's package.json: "arcade": { "attract": { ... } }. */
export interface AttractSettings {
  /** Scenario whose input is played. */
  scenario: string;
  /** First and last tick of the loop. */
  from: number;
  to: number;
  /** Capture every N ticks; 3 gives 20 fps of game time. */
  every?: number;
  /** Tick for the still cover (og:image and the video poster). Defaults to the middle of the loop. */
  cover?: number;
}

/** The ticks to screenshot: the loop's frames and the cover. */
interface CaptureTicks {
  loop: number[];
  cover: number;
}

/**
 * Every tick to capture for the loop, plus the cover tick.
 *
 * @throws {UsageError} When the range is empty, backwards or not whole ticks, or `every` isn't a positive integer.
 */
export function captureTicks(s: AttractSettings): CaptureTicks {
  const every = s.every ?? 3;
  if (!Number.isInteger(s.from) || !Number.isInteger(s.to) || s.from < 0 || s.to <= s.from) {
    throw new UsageError('attract needs integer ticks with 0 <= from < to');
  }
  if (!Number.isInteger(every) || every < 1) throw new UsageError('attract "every" must be a positive integer');
  const loop: number[] = [];
  for (let t = s.from; t <= s.to; t += every) loop.push(t);
  const cover = s.cover ?? loop[Math.floor(loop.length / 2)] ?? s.from;
  return { loop, cover };
}

/**
 * Record the landing page's attract loop and cover for a game: plays a scenario headlessly,
 * screenshots every N ticks, and writes public/attract.mp4 and public/cover.png with ffmpeg.
 * Deterministic: the same scenario and seed give the same footage.
 *
 * @throws {UsageError} When the game has no attract settings or they are invalid.
 * @throws {Error} When the game reports problems while recording, or ffmpeg fails.
 */
export async function attract(slug: string): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const settings = readSettings(game.dir, slug);
  const ticks = captureTicks(settings);
  const scenario = await loadScenario(game.dir, settings.scenario);
  const work = mkdtempSync(join(tmpdir(), `arcade-attract-${slug}-`));
  try {
    await recordFrames(game, scenario, ticks, work);
    const fps = Math.round(60 / (settings.every ?? 3));
    const { video, cover } = encodeAttract(work, join(game.dir, 'public'), fps);
    const kb = (f: string) => `${Math.round(statSync(f).size / 1024)} KB`;
    console.log(
      [
        `recorded ${slug} in ${elapsed(start)}: ${ticks.loop.length} frames at ${fps} fps (ticks ${settings.from}-${settings.to}), cover at tick ${ticks.cover}`,
        `  ${relative(ROOT, video)}  ${kb(video)}`,
        `  ${relative(ROOT, cover)}  ${kb(cover)}`,
        'Point game.json "cover" and "attract" at these files if they are not already.',
      ].join('\n'),
    );
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * The game's attract settings from its package.json.
 *
 * @throws {UsageError} When there are none.
 */
function readSettings(gameDir: string, slug: string): AttractSettings {
  const pkg = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as {
    arcade?: { attract?: AttractSettings };
  };
  const s = pkg.arcade?.attract;
  if (!s) {
    throw new UsageError(
      `${slug} has no attract settings. Add "arcade": { "attract": { "scenario": "...", "from": 0, "to": 600 } } to its package.json.`,
    );
  }
  return s;
}

/**
 * Plays the scenario and writes `loop-<n>.png` for each loop tick and `cover.png` into `work`.
 *
 * @throws {Error} When the game can't be opened or reports problems while recording.
 */
async function recordFrames(game: GameInfo, scenario: Scenario, ticks: CaptureTicks, work: string): Promise<void> {
  const steps: InputStep[] = [...scenario.input];
  const inputTicks = steps.reduce((n, s) => n + s.ticks, 0);
  const last = Math.max(ticks.cover, ticks.loop.at(-1) ?? 0);
  if (last > inputTicks) steps.push({ actions: [], ticks: last - inputTicks });

  const seed = scenario.start?.seed;
  const session = await openGameSession({
    game,
    createServer,
    open: {
      query: { ...scenario.start?.query },
      ...(seed !== undefined && { seed: Number(seed) }),
      ...(scenario.start?.scene !== undefined && { scene: scenario.start.scene }),
      debug: false,
    },
  });
  try {
    if (scenario.start?.save !== undefined) await session.driver.loadState(scenario.start.save);
    // The shell's back link sits over the canvas; it isn't part of the game.
    await session.page.addStyleTag({ content: '.arcade-back{display:none!important}' });
    await screenshotTicks(session, steps, ticks, work);
    const problems = await session.driver.problems();
    if (problems.length > 0) {
      throw new Error(
        `the game reported problems while recording:\n${problems.map((p) => `  ${p.kind}: ${p.message}`).join('\n')}`,
      );
    }
  } finally {
    await session.close();
  }
}

/** Plays `steps`, stopping at each loop and cover tick to write its screenshot into `work`. */
async function screenshotTicks(
  session: GameSession,
  steps: InputStep[],
  ticks: CaptureTicks,
  work: string,
): Promise<void> {
  const { page, driver } = session;
  const wanted = [...new Set([...ticks.loop, ticks.cover])].sort((a, b) => a - b);
  const loopSet = new Set(ticks.loop);
  let tick = 0;
  let n = 0;
  const capture = async () => {
    if (loopSet.has(tick)) await driver.screenshot(join(work, `loop-${String(n++).padStart(5, '0')}.png`));
    if (tick === ticks.cover) await driver.screenshot(join(work, 'cover.png'));
  };
  for (const step of steps) {
    await page.evaluate((a) => {
      for (const x of a) window.__arcade?.inject(x, true);
    }, step.actions);
    let left = step.ticks;
    while (left > 0) {
      while (wanted[0] === tick) {
        wanted.shift();
        await capture();
      }
      const next = wanted[0] !== undefined && wanted[0] < tick + left ? wanted[0] - tick : left;
      await driver.advance(next);
      tick += next;
      left -= next;
    }
    await page.evaluate((a) => {
      for (const x of a) window.__arcade?.inject(x, false);
    }, step.actions);
  }
  while (wanted[0] === tick) {
    wanted.shift();
    await capture();
  }
}

/**
 * Encodes the recorded frames in `work` into `<out>/attract.mp4` at `fps` and `<out>/cover.png`.
 *
 * @throws {Error} When ffmpeg is missing or fails.
 */
function encodeAttract(work: string, out: string, fps: number): { video: string; cover: string } {
  mkdirSync(out, { recursive: true });
  const video = join(out, 'attract.mp4');
  // H.264 at the capture size keeps pixel edges sharp enough; yuv420p and faststart so every browser streams it.
  ffmpeg([
    '-framerate',
    String(fps),
    '-i',
    join(work, 'loop-%05d.png'),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    video,
  ]);
  const cover = join(out, 'cover.png');
  ffmpeg(['-i', join(work, 'cover.png'), '-compression_level', '9', cover]);
  return { video, cover };
}

/**
 * Runs ffmpeg quietly, overwriting its output.
 *
 * @throws {Error} When ffmpeg is missing or exits non-zero; the message says how to install it.
 */
function ffmpeg(args: string[]): void {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`ffmpeg failed (is it installed? brew install ffmpeg): ${String(err)}`, { cause: err });
  }
}
