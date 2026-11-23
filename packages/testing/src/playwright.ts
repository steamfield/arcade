import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseManifest } from '@arcade/config/manifest';
import { test as base, defineConfig, devices, expect, type PlaywrightTestConfig } from '@playwright/test';
import { GameDriver } from './driver.ts';
import type { Scenario } from './scenario.ts';

export { expect };

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

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      srv.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

/**
 * Playwright config for a game. In games/<slug>/playwright.config.ts:
 *   export default await gamePlaywrightConfig(import.meta.url);
 *
 * Default: starts this game's Vite dev server on a free port.
 * ARCADE_BASE_URL set (by `arcade smoke`): tests the assembled production build there instead.
 */
export async function gamePlaywrightConfig(configUrl: string): Promise<PlaywrightTestConfig> {
  const gameDir = dirname(fileURLToPath(configUrl));
  const manifest = parseManifest(
    JSON.parse(readFileSync(join(gameDir, 'game.json'), 'utf8')),
    join(gameDir, 'game.json'),
  );
  const gamePath = `/games/${manifest.slug}/`;

  // Workers re-evaluate this file, so the port is chosen once and passed down through the environment.
  const portVar = `ARCADE_PORT_${manifest.slug.replace(/-/g, '_').toUpperCase()}`;
  process.env[portVar] ??= String(await freePort());
  const baseURL = process.env.ARCADE_BASE_URL ?? `http://127.0.0.1:${process.env[portVar]}`;
  const prodBuild = Boolean(process.env.ARCADE_BASE_URL);

  const chromiumArgs = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  // Phones are held the way the game wants; otherwise the shell's rotate prompt covers the game.
  const phone = (name: 'Pixel 7' | 'iPhone 15') =>
    manifest.orientation === 'landscape' ? devices[`${name} landscape`] : devices[name];
  return defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
    use: {
      baseURL,
      gamePath,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    } as PlaywrightTestConfig['use'],
    projects: [
      {
        name: 'desktop',
        // Tests tagged @touch need a touch device; they run in the mobile projects.
        grepInvert: /@touch/,
        use: { ...devices['Desktop Chrome'], launchOptions: { args: chromiumArgs } },
      },
      {
        name: 'mobile',
        testMatch: '**/smoke.spec.ts',
        use: { ...phone('Pixel 7'), launchOptions: { args: chromiumArgs } },
      },
      // Real WebKit catches Safari-only breakage; 3D games skip it until headless WebGL there is proven.
      ...(manifest.engine === 'phaser'
        ? [{ name: 'webkit', testMatch: '**/smoke.spec.ts', use: { ...phone('iPhone 15') } }]
        : []),
    ],
    webServer: prodBuild
      ? undefined
      : {
          command: `pnpm exec vite --port ${process.env[portVar]} --strictPort`,
          env: { ARCADE_TEST_SERVER: '1' },
          cwd: gameDir,
          url: `${baseURL}${gamePath}`,
          reuseExistingServer: false,
          stdout: 'ignore',
          stderr: 'pipe',
        },
  });
}
