/**
 * Opens one game headlessly for the CLI (`arcade see`, `arcade attract`): the game's Vite dev
 * server in test mode on a free port, Chromium with the shared flags, and a page driven by
 * GameDriver. Owns tearing all of it down, including when a step on the way fails.
 */
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { GameManifest } from '@arcade/config/manifest';
import type { Browser, Page, devices as playwrightDevices } from '@playwright/test';
import { CHROMIUM_ARGS } from './chromium-args.ts';
import { GameDriver, type OpenOptions } from './driver.ts';

/** The desktop window a session gets when the caller names none. */
export const DEFAULT_VIEWPORT = { width: 960, height: 540 } as const;

/** The part of Vite's dev server a session uses. */
export interface GameDevServer {
  listen(): Promise<unknown>;
  close(): Promise<void>;
  httpServer: { address(): AddressInfo | string | null } | null;
}

/**
 * Vite's `createServer`, passed in by the caller so this package needs no Vite dependency of its
 * own and the game is served by the caller's Vite.
 */
export type GameDevServerFactory = (config: {
  configFile: string;
  root: string;
  logLevel: 'error';
  server: { port: number; host: string };
}) => Promise<GameDevServer>;

/** What to open and how. */
export interface GameSessionOptions {
  /** The game's folder and the manifest fields the session reads. */
  game: { dir: string; manifest: Pick<GameManifest, 'slug' | 'orientation'> };
  createServer: GameDevServerFactory;
  /** Desktop window size; ignored when `mobile` is set. Defaults to DEFAULT_VIEWPORT. */
  viewport?: { width: number; height: number };
  /** Emulate a Pixel 7 held the way the game wants, with the on-screen touch controls on. */
  mobile?: boolean;
  /** Seed, scene, debug and launch parameters for `GameDriver.open`. */
  open?: Omit<OpenOptions, 'touch'>;
}

/** An open game page. Call `close()` when done, also when something in between throws. */
export interface GameSession {
  page: Page;
  driver: GameDriver;
  /** Stops the browser, then the dev server. */
  close(): Promise<void>;
}

/**
 * Starts the game's dev server and a browser, and opens the game ready to play.
 *
 * @throws {Error} When the server or browser can't start or the game fails to open; whatever was
 *   already started is stopped first. An AggregateError carries both causes if stopping fails too.
 */
export async function openGameSession(options: GameSessionOptions): Promise<GameSession> {
  // Read by the game's Vite config: serve the test build (the shell's test hook enabled).
  process.env.ARCADE_TEST_SERVER = '1';
  const server = await options.createServer({
    configFile: join(options.game.dir, 'vite.config.ts'),
    root: options.game.dir,
    logLevel: 'error',
    server: { port: 0, host: '127.0.0.1' },
  });
  let browser: Browser | undefined;
  const close = async () => {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  };
  try {
    // Loaded here, not at the top: the package index is also imported by Vitest logic tests
    // (through scenario kits), which should not pay for loading Playwright.
    const { chromium, devices } = await import('@playwright/test');
    browser = await chromium.launch({ args: [...CHROMIUM_ARGS] });
    const baseURL = await listen(server);
    const context = await browser.newContext({ ...deviceFor(options, devices), baseURL });
    const page = await context.newPage();
    const driver = new GameDriver(page, `/games/${options.game.manifest.slug}/`);
    await driver.open({ ...options.open, touch: options.mobile === true });
    return { page, driver, close };
  } catch (openError) {
    await close().catch((closeError: unknown) => {
      throw new AggregateError([openError, closeError], 'opening the game failed, and so did stopping it');
    });
    throw openError;
  }
}

/** Starts the server listening and returns its base URL. */
async function listen(server: GameDevServer): Promise<string> {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    throw new Error(`Vite started but reported no TCP port (address: ${String(address)})`);
  }
  return `http://127.0.0.1:${address.port}`;
}

/** Playwright context options for the phone or desktop window the caller asked for. */
function deviceFor(options: GameSessionOptions, devices: typeof playwrightDevices) {
  if (!options.mobile) return { viewport: options.viewport ?? DEFAULT_VIEWPORT };
  return options.game.manifest.orientation === 'landscape' ? devices['Pixel 7 landscape'] : devices['Pixel 7'];
}
