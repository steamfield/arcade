/**
 * Wiring between the shell and Phaser: loads the save, builds the Runtime and
 * the Phaser game with its scenes, fits the canvas at integer zoom, reports
 * WebGL context loss, registers the audio context, and returns the GameHandle
 * the shell and tests drive. No game rules or scene logic live here.
 */
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, integerScale } from '@arcade/shell';
import Phaser from 'phaser';
import type { SaveData } from '../logic/save.ts';
import { debugState, debugSummary } from './debug.ts';
import { Runtime, SAVE_SLOT, type SceneKey } from './runtime.ts';
import { BootScene } from './scenes/boot.ts';
import { RaceScene } from './scenes/race.ts';
import { ResultsScene } from './scenes/results.ts';
import { TitleScene } from './scenes/title.ts';

const WIDTH = 320;
const HEIGHT = 180;

/**
 * Starts Reef Rush inside `ctx.container`.
 *
 * @throws {LevelError} When the course data is invalid; the shell reports it as a start error.
 */
export async function startPhaser(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  const save = await loadSave(ctx, saves);
  let game: Phaser.Game | null = null;
  const rt = new Runtime({
    ctx,
    saves,
    save,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    startScene: (scene) => {
      if (game) switchScene(game, scene);
    },
  });
  game = createPhaserGame(ctx, rt);
  watchGame(ctx, game);
  return createHandle(rt, game, saves);
}

async function loadSave(ctx: GameContext, saves: SaveStore<SaveData>): Promise<SaveData | null> {
  const loaded = await saves.load(SAVE_SLOT);
  if (loaded.kind === 'unreadable' || loaded.kind === 'newer-than-code') {
    ctx.notice('Your saved progress could not be loaded, so it will not be overwritten.');
  } else if (saves.status === 'memory-only') {
    ctx.notice('Progress will not be saved in this browser mode.');
  }
  return loaded.kind === 'ok' ? loaded.data : null;
}

function createPhaserGame(ctx: GameContext, rt: Runtime): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: ctx.container,
    width: WIDTH,
    height: HEIGHT,
    pixelArt: true,
    backgroundColor: '#0b3d6b',
    banner: false,
    scale: { mode: Phaser.Scale.NONE },
    scene: [new BootScene(rt), new TitleScene(rt), new RaceScene(rt), new ResultsScene(rt)],
  });
}

function switchScene(game: Phaser.Game, scene: SceneKey): void {
  for (const running of game.scene.getScenes(true)) running.scene.stop();
  game.scene.start(scene);
}

/** Integer zoom that follows the container, plus context-loss and audio-context hookups once Phaser is ready. */
function watchGame(ctx: GameContext, game: Phaser.Game): void {
  const fitToContainer = () => game.scale.setZoom(integerScale(WIDTH, HEIGHT, ctx.container));
  new ResizeObserver(fitToContainer).observe(ctx.container);
  game.events.once(Phaser.Core.Events.READY, () => {
    fitToContainer();
    game.canvas.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));
    if (game.sound instanceof Phaser.Sound.WebAudioSoundManager) ctx.registerAudioContext(game.sound.context);
  });
}

function createHandle(rt: Runtime, game: Phaser.Game, saves: SaveStore<SaveData>): GameHandle {
  const idle = () => game.isBooted && !rt.loading;
  return {
    events: rt.events,
    idle,
    advance(ticks) {
      let ran = 0;
      while (ran < ticks && idle()) {
        rt.step.advance(1);
        ran++;
      }
      return ran;
    },
    renderer: () => (game.renderer?.type === Phaser.WEBGL ? 'webgl' : game.renderer ? 'canvas' : 'none'),
    debugSummary: () => debugSummary(rt, saves.status),
    debugState: () => debugState(rt, saves.status),
    async loadState(fixture) {
      const imported = await saves.importJson(SAVE_SLOT, JSON.stringify(fixture));
      if (imported.kind !== 'ok')
        throw new Error(`Save fixture rejected by the save store: ${JSON.stringify(imported)}`);
      rt.save = imported.data;
      rt.goTo('title');
    },
    pause: () => game.loop.sleep(),
    resume: () => game.loop.wake(),
  };
}
