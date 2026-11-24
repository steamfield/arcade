import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { GameDriver, type InputStep } from '@arcade/testing';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { findGame, ROOT, UsageError } from './games.ts';
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

/** Every tick to capture for the loop, plus the cover tick, ascending and unique. */
export function captureTicks(s: AttractSettings): { loop: number[]; cover: number } {
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
 * Record the landing page's attract loop and cover for a game: plays a scenario headlessly,
 * screenshots every N ticks, and writes public/attract.mp4 and public/cover.png with ffmpeg.
 * Deterministic: the same scenario and seed give the same footage.
 */
export async function attract(slug: string): Promise<number> {
  const start = performance.now();
  const game = findGame(slug);
  const settings = readSettings(game.dir, slug);
  const { loop, cover } = captureTicks(settings);
  const scenario = await loadScenario(game.dir, settings.scenario);
  const wanted = [...new Set([...loop, cover])].sort((a, b) => a - b);
  const steps: InputStep[] = [...scenario.input];
  const inputTicks = steps.reduce((n, s) => n + s.ticks, 0);
  const last = wanted.at(-1) ?? 0;
  if (last > inputTicks) steps.push({ actions: [], ticks: last - inputTicks });

  const work = mkdtempSync(join(tmpdir(), `arcade-attract-${slug}-`));
  try {
    process.env.ARCADE_TEST_SERVER = '1';
    const server = await createServer({
      configFile: join(game.dir, 'vite.config.ts'),
      root: game.dir,
      logLevel: 'error',
      server: { port: 0, host: '127.0.0.1' },
    });
    const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    try {
      await server.listen();
      const address = server.httpServer?.address();
      if (!address || typeof address === 'string') throw new Error('Vite did not report a port');
      const context = await browser.newContext({
        viewport: { width: 960, height: 540 },
        baseURL: `http://127.0.0.1:${address.port}`,
      });
      const page = await context.newPage();
      const driver = new GameDriver(page, `/games/${slug}/`);
      const seed = scenario.start?.seed;
      await driver.open({
        query: { ...scenario.start?.query },
        ...(seed !== undefined && { seed: Number(seed) }),
        ...(scenario.start?.scene !== undefined && { scene: scenario.start.scene }),
        debug: false,
        touch: false,
      });
      if (scenario.start?.save !== undefined) await driver.loadState(scenario.start.save);
      // The shell's back link sits over the canvas; it isn't part of the game.
      await page.addStyleTag({ content: '.arcade-back{display:none!important}' });

      const loopSet = new Set(loop);
      let tick = 0;
      let n = 0;
      const capture = async () => {
        if (loopSet.has(tick)) await driver.screenshot(join(work, `loop-${String(n++).padStart(5, '0')}.png`));
        if (tick === cover) await driver.screenshot(join(work, 'cover.png'));
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
      const problems = await driver.problems();
      if (problems.length > 0) throw new Error(`the game reported problems while recording:\n${problems.join('\n')}`);
    } finally {
      await browser.close();
      await server.close();
    }

    const out = join(game.dir, 'public');
    mkdirSync(out, { recursive: true });
    const fps = Math.round(60 / (settings.every ?? 3));
    const ffmpeg = (args: string[]) => {
      try {
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
      } catch (err) {
        throw new Error(`ffmpeg failed (is it installed? brew install ffmpeg): ${String(err)}`);
      }
    };
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
    const coverOut = join(out, 'cover.png');
    ffmpeg(['-i', join(work, 'cover.png'), '-compression_level', '9', coverOut]);

    const kb = (f: string) => `${Math.round(statSync(f).size / 1024)} KB`;
    console.log(
      [
        `recorded ${slug} in ${elapsed(start)}: ${loop.length} frames at ${fps} fps (ticks ${settings.from}-${settings.to}), cover at tick ${cover}`,
        `  ${relative(ROOT, video)}  ${kb(video)}`,
        `  ${relative(ROOT, coverOut)}  ${kb(coverOut)}`,
        'Point game.json "cover" and "attract" at these files if they are not already.',
      ].join('\n'),
    );
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
