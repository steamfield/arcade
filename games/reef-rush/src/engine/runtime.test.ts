import 'fake-indexeddb/auto';
import { configureLogging, type LogEntry } from '@arcade/core';
import type { SaveResult, SaveStore } from '@arcade/save';
import { createSaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrations, NEW_GAME, SAVE_VERSION, type SaveData, SaveSchema } from '../logic/save.ts';
import { input } from './input.ts';
import { Runtime } from './runtime.ts';

/** Title rows: Race, How to play, Level, Sound, Motion. Sound is three down. */
const SOUND_ROW = 3;
/** The title ignores kick for its first 20 ticks. */
const ARMED = 21;

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
  /** What `ctx.reportError` was called with, other than audio (there is no AudioContext under Node). */
  gameErrors: string[];
}

/** A runtime on its title screen, as the shell hands it over, over `saves`. */
function titleRuntime(saves: SaveStore<SaveData>): Harness {
  const gameErrors: string[] = [];
  const ctx = {
    params: { seed: 1, scene: null, debug: false, testMode: true },
    reportError: (source: string) => {
      if (source !== 'audio') gameErrors.push(source);
    },
    notice: () => {},
    registerAudioContext: () => {},
  } as unknown as GameContext;
  const rt = new Runtime({ ctx, saves, save: null, prefersReducedMotion: false, startScene: () => {} });
  rt.entered('title');
  rt.step.advance(ARMED);
  return { rt, gameErrors };
}

/** Presses `action` for one tick, then lets a tick pass so the next press registers. */
function press(rt: Runtime, action: 'down' | 'kick'): void {
  input.inject(action, true);
  rt.step.advance(1);
  input.inject(action, false);
  rt.step.advance(1);
}

function toggleSound({ rt }: Harness): void {
  for (let row = 0; row < SOUND_ROW; row++) press(rt, 'down');
  press(rt, 'kick');
}

/** Lets every queued save write run to its end. */
async function settled(rt: Runtime): Promise<void> {
  await vi.waitFor(() => expect(rt.saving).toBe(false));
}

let logged: LogEntry[] = [];
beforeEach(() => {
  logged = [];
  configureLogging((entry) => logged.push(entry));
});
afterEach(() => {
  configureLogging(() => {});
  vi.restoreAllMocks();
});

describe('a save that cannot be written', () => {
  it('reaches the player as save.failed, not as a game error, whether the store reports or throws', async () => {
    for (const failure of [
      () => Promise.resolve<SaveResult>({ ok: false, reason: 'disk full' }),
      () => Promise.reject(new Error('IndexedDB is gone')),
    ]) {
      const store = await realStore();
      const { rt, gameErrors } = titleRuntime({ ...store, save: failure } as SaveStore<SaveData>);
      toggleSound({ rt, gameErrors });
      await settled(rt);

      expect(rt.events.all().filter((e) => e.type === 'save.failed')).toHaveLength(1);
      expect(rt.events.all().filter((e) => e.type === 'save.written')).toHaveLength(0);
      expect(gameErrors).toEqual([]);
      // The change still holds for the session.
      expect(rt.settings.muted).toBe(true);
    }
  });

  it('warns once, naming what was being saved', async () => {
    const store = await realStore();
    const { rt, gameErrors } = titleRuntime({
      ...store,
      save: () => Promise.reject(new Error('IndexedDB is gone')),
    } as SaveStore<SaveData>);
    toggleSound({ rt, gameErrors });
    await settled(rt);

    expect(logged).toEqual([
      { level: 'warn', namespace: 'reef-rush', message: 'Settings not saved: IndexedDB is gone' },
    ]);
  });
});

describe('overlapping save writes', () => {
  it('runs them one at a time, keeps the runtime busy until the last lands, and leaves the latest choice in force', async () => {
    const store = await realStore();
    const written: SaveData[] = [];
    const releases: (() => void)[] = [];
    const slow: SaveStore<SaveData> = {
      ...store,
      save: (_slot, data) =>
        new Promise<SaveResult>((resolve) => {
          written.push(data);
          releases.push(() => resolve({ ok: true }));
        }),
    };
    const { rt, gameErrors } = titleRuntime(slow);

    toggleSound({ rt, gameErrors }); // sound off
    press(rt, 'kick'); // sound back on, while the first write is still out
    expect(rt.settings.muted).toBe(false);
    expect(rt.saving).toBe(true);
    await vi.waitFor(() => expect(written).toHaveLength(1));
    // The second write waits for the first, so a slow older write can never land after a newer one.
    expect(written.map((data) => data.settings.muted)).toEqual([true]);

    releases[0]?.();
    await vi.waitFor(() => expect(written).toHaveLength(2));
    // The first write finished, and it must not put its older choice back over the newer one.
    expect(rt.save?.settings.muted).toBe(false);
    expect(rt.saving).toBe(true);

    releases[1]?.();
    await settled(rt);
    expect(rt.save?.settings.muted).toBe(false);
    expect(written.map((data) => data.settings.muted)).toEqual([true, false]);
    expect(gameErrors).toEqual([]);
  });
});

describe('loading a save fixture', () => {
  it('applies its settings as a change from the title would', async () => {
    const store = await realStore();
    const { rt } = titleRuntime(store);
    const muted: SaveData = { ...NEW_GAME, settings: { ...NEW_GAME.settings, muted: true } };
    const setMuted = vi.spyOn(rt.audio, 'setMuted');

    rt.loadSave(muted);

    expect(rt.settings.muted).toBe(true);
    expect(setMuted).toHaveBeenCalledWith(true);
  });
});
