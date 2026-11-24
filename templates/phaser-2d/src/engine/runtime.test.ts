/**
 * The game flow without a browser: a real `Runtime` over a real save store (fake IndexedDB), its
 * scenes coming up at once as Phaser's would, driven tick by tick through injected input.
 */
import 'fake-indexeddb/auto';
import { configureLogging, type LogEntry } from '@arcade/core';
import { createSaveStore, type SaveResult, type SaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrations, SAVE_VERSION, type SaveData, SaveSchema } from '../logic/save.ts';
import { summarize } from '../logic/world.ts';
import { type Action, input } from './input.ts';
import { Runtime, SAVE_SLOT } from './runtime.ts';

/** Ticks of holding right from the spawn that reach the first ground coin (index 7). */
const TO_FIRST_COIN = 120;

let storeCount = 0;
const realStore = () =>
  createSaveStore<SaveData>({
    gameId: `runtime-${storeCount++}`,
    version: SAVE_VERSION,
    schema: SaveSchema,
    migrate: migrations,
  });

interface Harness {
  rt: Runtime;
  /** Every `ctx.reportError` call's source. */
  gameErrors: string[];
}

/**
 * A booted runtime over `saves`, opened at `search`, its scenes coming up as soon as they are asked for.
 * The test steps it directly either way; `testMode` only changes what the runtime honours.
 */
function bootedRuntime(
  saves: SaveStore<SaveData>,
  { save = null, search = '', testMode = true }: { save?: SaveData | null; search?: string; testMode?: boolean } = {},
): Harness {
  const gameErrors: string[] = [];
  const ctx = {
    manifest: { id: 'runtime-test', title: 'Runtime test', orientation: 'landscape' },
    params: { seed: 1, scene: null, debug: false, testMode },
    reportError: (source: string) => gameErrors.push(source),
    notice: () => {},
  } as unknown as GameContext;
  const rt: Runtime = new Runtime({ ctx, saves, save, search, startScene: (scene) => rt.entered(scene) });
  rt.start();
  return { rt, gameErrors };
}

/** Presses `action` for one tick, then lets a tick pass with it released. */
function press(rt: Runtime, action: Action): void {
  input.inject(action, true);
  rt.step.advance(1);
  input.inject(action, false);
  rt.step.advance(1);
}

/** Holds `action` for `ticks` ticks, then releases it. */
function hold(rt: Runtime, action: Action, ticks: number): void {
  input.inject(action, true);
  rt.step.advance(ticks);
  input.inject(action, false);
}

/** Lets every queued save write run to its end. */
async function settled(rt: Runtime): Promise<void> {
  await vi.waitFor(() => expect(rt.saving).toBe(false));
}

const eventTypes = (rt: Runtime) => rt.events.all().map((e) => e.type);

let logged: LogEntry[] = [];
beforeEach(() => {
  logged = [];
  configureLogging((entry) => logged.push(entry));
});
afterEach(() => {
  configureLogging(() => {});
});

describe('a new game', () => {
  it('starts on a title offering only New game, and confirming it starts the level', async () => {
    const { rt } = bootedRuntime(await realStore());
    expect(rt.scene).toBe('title');
    expect(rt.menu).toEqual({ options: ['New game'], selected: 0 });

    press(rt, 'jump');

    expect(rt.scene).toBe('play');
    expect(rt.world && summarize(rt.world)).toMatchObject({ status: 'playing', coins: '0/9' });
    expect(eventTypes(rt)).toEqual(['scene.started', 'menu.selected', 'scene.started']);
  });

  it('saves the first coin it collects, and a reload continues from it', async () => {
    const saves = await realStore();
    const { rt, gameErrors } = bootedRuntime(saves);
    press(rt, 'jump');
    hold(rt, 'right', TO_FIRST_COIN);
    await settled(rt);

    expect(rt.events.all().filter((e) => e.type === 'coin.collected')).toMatchObject([{ index: 7, total: 1 }]);
    expect(eventTypes(rt)).toContain('save.written');
    const loaded = await saves.load(SAVE_SLOT);
    expect(loaded).toMatchObject({ kind: 'ok', data: { collected: [7], completed: false } });
    if (loaded.kind !== 'ok') return;

    const reloaded = bootedRuntime(saves, { save: loaded.data }).rt;
    expect(reloaded.menu.options).toEqual(['Continue', 'New game']);
    press(reloaded, 'jump');
    expect(reloaded.world && summarize(reloaded.world)).toMatchObject({ coins: '1/9' });
    expect(gameErrors).toEqual([]);
  });
});

describe('a capture stage', () => {
  it('puts the player beside the flag and never saves the staged win', async () => {
    const saves = await realStore();
    const { rt } = bootedRuntime(saves, { search: '?stage=near-goal' });
    press(rt, 'jump');
    expect(rt.staged).toBe(true);
    expect(rt.world && summarize(rt.world).player.tile).toEqual([36, 9]);

    hold(rt, 'right', 40);
    await rt.hide();
    await settled(rt);

    expect(rt.world?.status).toBe('won');
    expect(eventTypes(rt)).not.toContain('save.written');
    expect(await saves.load(SAVE_SLOT)).toMatchObject({ kind: 'empty' });
  });

  it('is ignored outside debug and test mode, so a shared link plays normally', async () => {
    const { rt } = bootedRuntime(await realStore(), { search: '?stage=near-goal', testMode: false });
    press(rt, 'jump');

    expect(rt.staged).toBe(false);
    expect(rt.world && summarize(rt.world).player.tile).toEqual([1, 9]);
  });
});

describe('a save that cannot be written', () => {
  it('reaches the player as save.failed with a warning, not as a game error, whether the store reports or throws', async () => {
    for (const failure of [
      () => Promise.resolve<SaveResult>({ ok: false, reason: 'disk full' }),
      () => Promise.reject(new Error('IndexedDB is gone')),
    ]) {
      const store = await realStore();
      const { rt, gameErrors } = bootedRuntime({ ...store, save: failure } as SaveStore<SaveData>);
      press(rt, 'jump');
      hold(rt, 'right', TO_FIRST_COIN);
      await settled(rt);

      expect(rt.events.all().filter((e) => e.type === 'save.failed')).toHaveLength(1);
      expect(eventTypes(rt)).not.toContain('save.written');
      expect(gameErrors).toEqual([]);
      expect(rt.save).toBeNull();
    }
    expect(logged.map((entry) => `${entry.level} ${entry.message}`)).toEqual([
      'warn progress not saved: disk full',
      'warn progress not saved: IndexedDB is gone',
    ]);
  });
});
