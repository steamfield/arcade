/**
 * The Playwright side of a game's tests: the `game` fixture, scenario-file registration, and the
 * shared `playwright.config.ts` every game exports (dev server or production build, browser
 * projects, and any extra servers the game needs).
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { GameManifest } from '@arcade/config/manifest';
import { readManifest } from '@arcade/config/manifest-file';
import { test as base, defineConfig, devices, expect, type PlaywrightTestConfig } from '@playwright/test';
import { CHROMIUM_ARGS } from './chromium-args.ts';
import { GameDriver } from './driver.ts';
import { freePort } from './ports.ts';
import type { Scenario } from './scenario.ts';

export { expect };

type WebServer = Exclude<NonNullable<PlaywrightTestConfig['webServer']>, readonly unknown[]>;

/**
 * `game` fixture: a GameDriver for this game's page. After every test it
 * fails the test if anything went wrong without throwing (console errors,
 * failed requests, game errors, dropped events), and attaches the console log.
 */
export const test = base.extend<{ game: GameDriver; gamePath: string }>({
  gamePath: ['/', { option: true }],
  game: async ({ page, gamePath }, use, testInfo) => {
    const driver = new GameDriver(page, gamePath);
    await use(driver);
    await testInfo.attach('console.log', { body: driver.console.join('\n') || '(empty)', contentType: 'text/plain' });
    const problems = await driver.problems();
    if (problems.length > 0) {
      throw new Error(`Problems during the test:\n${problems.map((p) => `  ${p.kind}: ${p.message}`).join('\n')}`);
    }
  },
});

/**
 * Registers one test per scenario file in `dir` (every .ts file except kit.ts).
 * Use with top-level await in a spec file:
 *   await defineScenarioTests(new URL('../scenarios/', import.meta.url));
 *
 * @throws {Error} When a scenario file has no default export.
 */
export async function defineScenarioTests(dir: URL): Promise<void> {
  const path = fileURLToPath(dir);
  const files = readdirSync(path).filter((f) => f.endsWith('.ts') && f !== 'kit.ts');
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(path, file)).href)) as { default?: Scenario };
    const scenario = mod.default;
    if (!scenario) throw new Error(`${file} must default-export a scenario(...)`);
    const register = scenario.todo ? test.fail : test;
    register(`scenarios/${file}: ${scenario.description}`, async ({ game }) => {
      test.slow(scenario.slow === true, 'plays a long stretch of the game');
      await game.open({
        ...(scenario.start?.seed !== undefined && { seed: scenario.start.seed }),
        ...(scenario.start?.scene !== undefined && { scene: scenario.start.scene }),
        ...(scenario.start?.query !== undefined && { query: scenario.start.query }),
      });
      const result = await game.runScenario(scenario);
      await scenario.expect?.(result);
    });
  }
}

/** A server the game's tests need besides its own Vite server, such as an API Worker. */
export interface ExtraWebServer {
  /**
   * Environment variable that carries the server's port, chosen free once and inherited by the
   * Playwright workers and the game's dev server (so its Vite config can proxy to it).
   */
  portVar: string;
  /** Shell command that starts the server on `port`, run from the game folder. */
  command: (port: number) => string;
  /** Extra environment for the command. */
  env?: Record<string, string>;
}

/** Options for `gamePlaywrightConfig`. */
export interface GamePlaywrightOptions {
  /** Started before the game's dev server, and only against it (never against `arcade smoke`'s build). */
  extraWebServers?: readonly ExtraWebServer[];
}

/**
 * Playwright config for a game. In games/<slug>/playwright.config.ts:
 *   export default await gamePlaywrightConfig(import.meta.url);
 *
 * Default: starts this game's Vite dev server (and any `extraWebServers`) on free ports.
 * ARCADE_BASE_URL set (by `arcade smoke`): tests the assembled production build there instead.
 *
 * @throws {Error} When the game's `game.json` can't be read or fails the schema.
 */
export async function gamePlaywrightConfig(
  configUrl: string,
  options: GamePlaywrightOptions = {},
): Promise<PlaywrightTestConfig> {
  const gameDir = dirname(fileURLToPath(configUrl));
  const manifest = readManifest(gameDir);
  const gamePath = `/games/${manifest.slug}/`;
  const gamePort = await portFromEnv(`ARCADE_PORT_${manifest.slug.replace(/-/g, '_').toUpperCase()}`);
  const prodBaseUrl = process.env.ARCADE_BASE_URL;
  const baseURL = prodBaseUrl ?? `http://127.0.0.1:${gamePort}`;
  const servers = prodBaseUrl
    ? undefined
    : [
        ...(await extraServers(options.extraWebServers ?? [], gameDir)),
        gameServer(gameDir, gamePort, `${baseURL}${gamePath}`),
      ];
  return defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    // One retry on CI, and a test that passes only on it still fails the run: a flaky test is a
    // determinism bug to fix, and the retry's report says whether the failure repeats.
    retries: process.env.CI ? 1 : 0,
    failOnFlakyTests: Boolean(process.env.CI),
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
    use: {
      baseURL,
      gamePath,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    } as PlaywrightTestConfig['use'],
    projects: browserProjects(manifest),
    // A single server stays a plain object, the shape games that read `config.webServer` expect.
    webServer: servers?.length === 1 ? servers[0] : servers,
  });
}

/**
 * The port in `portVar`, choosing a free one first if it is unset. Playwright workers re-evaluate
 * the config, so the choice is made once and handed down through the environment.
 */
async function portFromEnv(portVar: string): Promise<number> {
  process.env[portVar] ??= String(await freePort());
  return Number(process.env[portVar]);
}

/** The game's own Vite dev server in test mode. */
function gameServer(gameDir: string, port: number, url: string): WebServer {
  return {
    command: `pnpm exec vite --port ${port} --strictPort`,
    env: { ARCADE_TEST_SERVER: '1' },
    cwd: gameDir,
    url,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  };
}

/** Playwright's entries for the extra servers, each on a free port published in its `portVar`. */
async function extraServers(extras: readonly ExtraWebServer[], gameDir: string): Promise<WebServer[]> {
  const servers: WebServer[] = [];
  for (const extra of extras) {
    const port = await portFromEnv(extra.portVar);
    servers.push({
      command: extra.command(port),
      ...(extra.env && { env: extra.env }),
      cwd: gameDir,
      port,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    });
  }
  return servers;
}

/** Desktop Chromium, a phone, and WebKit for 2D games. */
function browserProjects(manifest: GameManifest): PlaywrightTestConfig['projects'] {
  // Phones are held the way the game wants; otherwise the shell's rotate prompt covers the game.
  const phone = (name: 'Pixel 7' | 'iPhone 15') =>
    manifest.orientation === 'landscape' ? devices[`${name} landscape`] : devices[name];
  const launchOptions = { args: [...CHROMIUM_ARGS] };
  return [
    {
      name: 'desktop',
      // Tests tagged @touch need a touch device; they run in the mobile projects.
      grepInvert: /@touch/,
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'mobile',
      testMatch: '**/smoke.spec.ts',
      use: { ...phone('Pixel 7'), launchOptions },
    },
    // Real WebKit catches Safari-only breakage; 3D games skip it until headless WebGL there is proven.
    ...(manifest.engine === 'phaser'
      ? [{ name: 'webkit', testMatch: '**/smoke.spec.ts', use: { ...phone('iPhone 15') } }]
      : []),
  ];
}
