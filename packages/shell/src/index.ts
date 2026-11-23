import { configureLogging, createLogger, type Drained, type EventLog, type LogEntry } from '@arcade/core';
import type { Input } from '@arcade/input';

/**
 * Boots every game the same way: container sizing and mobile hygiene, starting
 * at once (audio unlocks on the first gesture), pause and save on hide, error
 * capture, and the window.__arcade hook that tests and `arcade see` drive.
 *
 * In test mode (set by the harness) the shell owns time: the game must not run
 * its own loop, and only advances when __arcade.advance(ticks) is called.
 */

export interface LaunchParams {
  /** Seed for createRng. Default 1 in test mode, random otherwise. */
  seed: number;
  /** Scene to start in, if the game supports jumping (?scene=). */
  scene: string | null;
  /** Show the debug overlay (?debug=1). */
  debug: boolean;
  /** Harness-controlled stepping. */
  testMode: boolean;
}

export interface GameContext {
  /** game.json fields the shell was booted with. Use manifest.title on title screens. */
  manifest: BootOptions<string>['manifest'];
  /** The element the engine must render into. The shell owns its size; size the canvas to it. */
  container: HTMLElement;
  params: LaunchParams;
  /** Route errors that aren't exceptions (loader failures, context loss) so tests fail on them. */
  reportError(source: string, error: unknown): void;
  /** Show a short message over the game, e.g. a storage warning. */
  notice(text: string): void;
  /** Register an AudioContext so the shell resumes it after iOS interrupts it. */
  registerAudioContext(ctx: AudioContext): void;
}

/** What a game hands back to the shell once it has started. */
export interface GameHandle {
  /**
   * Test mode only. Run up to `ticks` fixed logic ticks, stopping early if the
   * game stops being idle (a scene started loading), then render once.
   * Returns how many ticks actually ran; the harness waits for idle() and
   * calls again for the rest, so load timing never changes the outcome.
   */
  advance(ticks: number): number;
  /** True when nothing is loading or decoding, so the next tick is deterministic. */
  idle(): boolean;
  /** Full state for state.json. Can be large. */
  debugState(): unknown;
  /** A few key fields for the CLI summary and quick assertions. */
  debugSummary(): Record<string, unknown>;
  events: EventLog;
  /** e.g. "webgl2", "canvas". Smoke asserts on this so a silent fallback fails. */
  renderer(): string;
  /** Apply a save fixture (already validated by the game's save store). */
  loadState?(save: unknown): Promise<void>;
  pause(): void;
  resume(): void;
  /** Last reliable moment to write on mobile. */
  onHide?(): void | Promise<void>;
}

export interface BootOptions<A extends string> {
  /** game.json contents. */
  manifest: { id: string; title: string; orientation: 'landscape' | 'portrait' | 'any' };
  input: Input<A, string>;
  start(ctx: GameContext): Promise<GameHandle>;
  /** Called from the player's first tap, click or key press, e.g. saves.requestPersistence(). */
  onFirstGesture?(): unknown;
}

export interface ArcadeHook {
  ready: boolean;
  gameId: string;
  errors: { source: string; message: string }[];
  logs: LogEntry[];
  tick: number;
  /** Runs up to `ticks`; returns how many ran (fewer if a load started). */
  advance(ticks: number): number;
  idle(): boolean;
  events(cursor?: number): Drained<{ type: string }>;
  debugState(): unknown;
  debugSummary(): Record<string, unknown>;
  renderer(): string;
  loadState(save: unknown): Promise<void>;
  inject(action: string, down: boolean): void;
  start(): Promise<void>;
}

declare global {
  interface Window {
    __arcade?: ArcadeHook;
    /** Set by the test harness before the page loads. */
    __ARCADE_TEST__?: boolean;
  }
}

const log = createLogger('arcade:shell');

export function readLaunchParams(search = window.location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const testMode = window.__ARCADE_TEST__ === true || q.get('test') === '1';
  const seedParam = q.get('seed');
  return {
    testMode,
    seed: seedParam ? Number(seedParam) : testMode ? 1 : (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1),
    scene: q.get('scene'),
    debug: q.get('debug') === '1',
  };
}

export async function bootGame<A extends string>(options: BootOptions<A>): Promise<void> {
  const params = readLaunchParams();
  const logs: LogEntry[] = [];
  configureLogging((entry) => {
    logs.push(entry);
    if (logs.length > 500) logs.shift();
    const line = `[${entry.namespace}] ${entry.message}`;
    const method = entry.level === 'debug' ? 'log' : entry.level;
    // biome-ignore lint/suspicious/noConsole: the shell is the log sink for every game.
    entry.data === undefined ? console[method](line) : console[method](line, entry.data);
  }, new URLSearchParams(window.location.search).get('log') ?? '');

  const root = document.getElementById('arcade-root') ?? document.body;
  installBaseStyles();
  const container = el('div', 'arcade-container');
  root.append(container);

  const hook: ArcadeHook = {
    ready: false,
    gameId: options.manifest.id,
    errors: [],
    logs,
    tick: 0,
    advance: () => {
      throw new Error('Game has not started. Call __arcade.start() first.');
    },
    idle: () => false,
    events: () => ({ events: [], cursor: 0, dropped: 0 }),
    debugState: () => null,
    debugSummary: () => ({}),
    renderer: () => 'none',
    loadState: async () => {
      throw new Error('Game has not started.');
    },
    inject: (action, down) => options.input.inject(action as A, down),
    start: async () => {},
  };
  window.__arcade = hook;

  const banner = el('div', 'arcade-error');
  const reportError = (source: string, error: unknown) => {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    hook.errors.push({ source, message });
    log.error(`${source}: ${message}`);
    banner.textContent = `${source}: ${message.split('\n')[0]}`;
    container.append(banner);
  };
  window.addEventListener('error', (e) => reportError('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError('unhandledrejection', e.reason));

  const audioContexts = new Set<AudioContext>();
  const resumeAudio = () => {
    for (const ac of audioContexts) if (ac.state !== 'running') void ac.resume();
  };

  const noticeEl = el('div', 'arcade-notice');
  const notice = (text: string) => {
    noticeEl.textContent = text;
    container.append(noticeEl);
  };

  const back = el('a', 'arcade-back');
  back.textContent = '← Arcade';
  (back as HTMLAnchorElement).href = '/';
  container.append(back);

  mountRotatePrompt(container, options.manifest.orientation);
  options.input.mount(container, { forceTouch: new URLSearchParams(window.location.search).get('touch') === '1' });

  const ctx: GameContext = {
    manifest: options.manifest,
    container,
    params,
    reportError,
    notice,
    registerAudioContext: (ac) => audioContexts.add(ac),
  };

  let handle: GameHandle | null = null;
  const startGame = async () => {
    if (handle) return;
    gate.remove();
    try {
      handle = await options.start(ctx);
    } catch (err) {
      reportError('start', err);
      return;
    }
    const h = handle;
    Object.assign(hook, {
      advance: (ticks: number) => {
        if (!params.testMode) throw new Error('advance() only works in test mode');
        if (!h.idle()) return 0;
        const ran = h.advance(ticks);
        hook.tick += ran;
        return ran;
      },
      idle: () => h.idle(),
      events: (cursor?: number) => h.events.drain(cursor),
      debugState: () => h.debugState(),
      debugSummary: () => h.debugSummary(),
      renderer: () => h.renderer(),
      loadState: async (save: unknown) => {
        if (!h.loadState) throw new Error(`${options.manifest.id} does not implement loadState`);
        await h.loadState(save);
      },
    } satisfies Partial<ArcadeHook>);
    hook.ready = true;
    log.info(`started ${options.manifest.id}`, {
      renderer: h.renderer(),
      seed: params.seed,
      testMode: params.testMode,
    });
  };
  hook.start = startGame;

  // Browsers only allow audio and storage persistence after a gesture on this page, and the click
  // that brought the player here (the landing page) doesn't carry over. So the game starts at once,
  // silent until the first tap or key press, which unlocks audio and runs onFirstGesture.
  const gestures = ['pointerdown', 'keydown', 'touchend'] as const;
  const firstGesture = () => {
    for (const type of gestures) window.removeEventListener(type, firstGesture, true);
    resumeAudio();
    Promise.resolve()
      .then(() => options.onFirstGesture?.())
      .catch((err: unknown) => reportError('first gesture', err));
  };
  for (const type of gestures) window.addEventListener(type, firstGesture, true);

  // Test mode keeps a start gate so the harness decides when the game starts (after init scripts
  // and save fixtures). Players never see it.
  const gate = el('button', 'arcade-gate');
  gate.dataset.arcadeStart = '';
  gate.textContent = `Play ${options.manifest.title}`;
  gate.addEventListener('click', () => void startGame());
  if (params.testMode) container.append(gate);
  else void startGame();

  document.addEventListener('visibilitychange', () => {
    if (!handle) return;
    if (document.hidden) {
      handle.pause();
      void handle.onHide?.();
    } else {
      resumeAudio();
      if (!params.testMode) handle.resume();
    }
  });
  window.addEventListener('pointerdown', resumeAudio);
}

/** Largest whole-number scale at which a base resolution fits the container (crisp pixel art). */
export function integerScale(baseWidth: number, baseHeight: number, container: HTMLElement): number {
  const { width, height } = container.getBoundingClientRect();
  return Math.max(1, Math.floor(Math.min(width / baseWidth, height / baseHeight)));
}

/** Device pixel ratio capped at 2: phones at 3x pay for pixels nobody can see. */
export const renderPixelRatio = (): number => Math.min(window.devicePixelRatio || 1, 2);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function mountRotatePrompt(container: HTMLElement, orientation: 'landscape' | 'portrait' | 'any') {
  if (orientation === 'any') return;
  const prompt = el('div', 'arcade-rotate');
  prompt.textContent = `Rotate your device to ${orientation}`;
  const query = window.matchMedia(
    `(orientation: ${orientation === 'landscape' ? 'portrait' : 'landscape'}) and (pointer: coarse)`,
  );
  const sync = () => (query.matches ? container.append(prompt) : prompt.remove());
  query.addEventListener('change', sync);
  sync();
}

function installBaseStyles() {
  const style = document.createElement('style');
  style.textContent = `
html, body { margin: 0; height: 100%; background: #111; overflow: hidden; overscroll-behavior: none; }
body { position: fixed; inset: 0; }
.arcade-container {
  position: absolute; inset: 0;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  display: flex; align-items: center; justify-content: center;
}
.arcade-container canvas { display: block; touch-action: none; }
.arcade-gate {
  position: absolute; z-index: 20; padding: 16px 28px; font: 600 20px system-ui, sans-serif;
  border-radius: 12px; border: 0; background: #ffd23f; color: #111; cursor: pointer;
}
.arcade-back {
  position: absolute; z-index: 15; top: calc(8px + env(safe-area-inset-top)); right: calc(8px + env(safe-area-inset-right));
  color: #fff8; font: 13px system-ui, sans-serif; text-decoration: none;
}
.arcade-error {
  position: absolute; z-index: 30; left: 0; right: 0; top: 0; padding: 8px 12px; background: #b00020; color: #fff;
  font: 13px ui-monospace, monospace; white-space: pre-wrap;
}
.arcade-notice {
  position: absolute; z-index: 15; bottom: calc(8px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
  padding: 6px 12px; border-radius: 8px; background: #000a; color: #fff; font: 13px system-ui, sans-serif;
}
.arcade-rotate {
  position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; background: #111; color: #fff;
  font: 600 18px system-ui, sans-serif;
}`;
  document.head.append(style);
}
