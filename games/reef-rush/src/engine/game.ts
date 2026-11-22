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
import { HowToPlayScene } from './scenes/how-to-play.ts';
import { RaceScene } from './scenes/race.ts';
import { ResultsScene } from './scenes/results.ts';
import { SelectScene } from './scenes/select.ts';
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
  watchGame(ctx, game, rt);
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
    // Sound comes from audio/, which owns its own AudioContext; Phaser's would sit unused.
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    scene: [
      new BootScene(rt),
      new TitleScene(rt),
      new HowToPlayScene(rt),
      new SelectScene(rt),
      new RaceScene(rt),
      new ResultsScene(rt),
    ],
  });
}

function switchScene(game: Phaser.Game, scene: SceneKey): void {
  // stop() is queued but start() of a running scene restarts it at once; stopping the
  // target too would let the queued stop land after the restart and leave it blank.
  for (const running of game.scene.getScenes(true)) {
    if (running.scene.key !== scene) running.scene.stop();
  }
  game.scene.start(scene);
}

/**
 * Integer zoom that follows the container, the logic clock fed once per game step (not per
 * scene, so a scene switch mid-step can't tick twice), plus context-loss and audio-context
 * hookups once Phaser is ready.
 */
function watchGame(ctx: GameContext, game: Phaser.Game, rt: Runtime): void {
  game.events.on(Phaser.Core.Events.STEP, (_time: number, deltaMs: number) => rt.frame(deltaMs));
  const fitToContainer = () => game.scale.setZoom(integerScale(WIDTH, HEIGHT, ctx.container));
  new ResizeObserver(fitToContainer).observe(ctx.container);
  game.events.once(Phaser.Core.Events.READY, () => {
    fitToContainer();
    game.canvas.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));
    if (game.sound instanceof Phaser.Sound.WebAudioSoundManager) ctx.registerAudioContext(game.sound.context);
  });
}

function createHandle(rt: Runtime, game: Phaser.Game, saves: SaveStore<SaveData>): GameHandle {
  const idle = () => game.isBooted && !rt.loading && !rt.saving;
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
    debugSummary: () => debugSummary(rt, saves.status, game.scene.isActive(rt.scene)),
    debugState: () => debugState(rt, saves.status, game.scene.isActive(rt.scene)),
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
