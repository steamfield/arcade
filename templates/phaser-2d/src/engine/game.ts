import { createLogger, EventLog, FixedStep } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, integerScale } from '@arcade/shell';
import Phaser from 'phaser';
import type { GameEvent } from '../logic/events.ts';
import { LEVEL_1, parseLevel, TILE } from '../logic/level.ts';
import { NEW_GAME, type SaveData } from '../logic/save.ts';
import { createWorld, stepWorld, summarize, toAscii, toSave, type World } from '../logic/world.ts';
import { input } from './input.ts';
import { createPlaceholderTextures, Tex } from './textures.ts';

const WIDTH = 320;
const HEIGHT = 180;
const SAVE_SLOT = 'main';
const log = createLogger('phaser-2d');

/** Events the engine adds on top of the world's. */
export type EngineEvent =
  | { type: 'scene.started'; scene: SceneKey }
  | { type: 'menu.selected'; option: string }
  | { type: 'save.written' }
  | { type: 'save.failed'; reason: string };

type SceneKey = 'boot' | 'title' | 'play';

/**
 * Shared state between scenes and the shell. Logic ticks happen only in
 * `tick()`, driven by FixedStep in real time or by advance() in test mode.
 * Phaser's own loop keeps running in both modes, but only to render.
 */
class Runtime {
  readonly events = new EventLog<GameEvent | EngineEvent>();
  readonly step = new FixedStep((dt) => this.tick(dt));
  scene: SceneKey = 'boot';
  /** True between scene.start() and the new scene's create(). */
  loading = true;
  world: World | null = null;
  save: SaveData | null;
  game!: Phaser.Game;
  menu = { options: [] as string[], selected: 0 };

  readonly ctx: GameContext;
  readonly saves: SaveStore<SaveData>;

  constructor(ctx: GameContext, saves: SaveStore<SaveData>, save: SaveData | null) {
    this.ctx = ctx;
    this.saves = saves;
    this.save = save;
  }

  /** Called from each scene's update(). Real-time only; in test mode the shell calls advance(). */
  frame(deltaMs: number): void {
    if (!this.ctx.params.testMode) this.step.frame(deltaMs / 1000);
  }

  goTo(scene: SceneKey, data?: object): void {
    this.loading = true;
    for (const s of this.game.scene.getScenes(true)) s.scene.stop();
    this.game.scene.start(scene, data);
  }

  entered(scene: SceneKey): void {
    this.scene = scene;
    this.loading = false;
    this.events.emit({ type: 'scene.started', scene });
  }

  startPlay(save: SaveData): void {
    this.world = createWorld(parseLevel(LEVEL_1), this.events, save);
    this.goTo('play');
  }

  private tick(dt: number): void {
    if (this.loading) return;
    this.events.tick = this.step.tick;
    input.update();
    if (this.scene === 'title') this.tickTitle();
    else if (this.scene === 'play') this.tickPlay(dt);
  }

  private tickTitle(): void {
    const { menu } = this;
    if (input.justPressed('down')) menu.selected = (menu.selected + 1) % menu.options.length;
    if (input.justPressed('up')) menu.selected = (menu.selected + menu.options.length - 1) % menu.options.length;
    if (input.justPressed('jump')) {
      const option = menu.options[menu.selected] ?? 'New game';
      this.events.emit({ type: 'menu.selected', option });
      this.startPlay(option === 'Continue' && this.save ? this.save : NEW_GAME);
    }
  }

  private tickPlay(dt: number): void {
    const world = this.world;
    if (!world) return;
    if (world.status === 'won' && input.justPressed('jump')) {
      this.goTo('title');
      return;
    }
    const before = world.collected.size;
    const wasPlaying = world.status === 'playing';
    stepWorld(
      world,
      { move: input.vector('move').x, jumpPressed: input.justPressed('jump'), jumpHeld: input.isDown('jump') },
      dt,
    );
    if (world.collected.size !== before || (wasPlaying && world.status === 'won')) void this.persist();
  }

  async persist(): Promise<void> {
    if (!this.world) return;
    const data = toSave(this.world);
    const result = await this.saves.save(SAVE_SLOT, data);
    if (result.ok) {
      this.save = data;
      this.events.emit({ type: 'save.written' });
    } else {
      log.warn(`save failed: ${result.reason}`);
      this.events.emit({ type: 'save.failed', reason: result.reason });
    }
  }
}

class BootScene extends Phaser.Scene {
  private readonly rt: Runtime;
  constructor(rt: Runtime) {
    super('boot');
    this.rt = rt;
  }
  create() {
    createPlaceholderTextures(this);
    const jump = this.rt.ctx.params.scene;
    if (jump === 'play') this.rt.startPlay(this.rt.save ?? NEW_GAME);
    else this.rt.goTo('title');
  }
}

class TitleScene extends Phaser.Scene {
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private readonly rt: Runtime;
  constructor(rt: Runtime) {
    super('title');
    this.rt = rt;
  }
  create() {
    const hasProgress = Boolean(this.rt.save && (this.rt.save.collected.length > 0 || this.rt.save.completed));
    this.rt.menu = { options: hasProgress ? ['Continue', 'New game'] : ['New game'], selected: 0 };
    this.add
      .text(WIDTH / 2, 50, this.rt.ctx.manifest.title.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffd23f',
      })
      .setOrigin(0.5);
    this.optionTexts = this.rt.menu.options.map((label, i) =>
      this.add.text(WIDTH / 2, 100 + i * 18, label, { fontFamily: 'monospace', fontSize: '12px' }).setOrigin(0.5),
    );
    this.rt.entered('title');
  }
  override update(_time: number, delta: number) {
    this.rt.frame(delta);
    this.optionTexts.forEach((t, i) => {
      const label = this.rt.menu.options[i] ?? '';
      t.setText(i === this.rt.menu.selected ? `> ${label} <` : label);
    });
  }
}

class PlayScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private coins: Phaser.GameObjects.Image[] = [];
  private hud!: Phaser.GameObjects.Text;
  private debug: Phaser.GameObjects.Graphics | null = null;
  private readonly rt: Runtime;
  constructor(rt: Runtime) {
    super('play');
    this.rt = rt;
  }
  create() {
    const world = this.rt.world;
    if (!world) throw new Error('PlayScene started without a world');
    const { level } = world;
    level.solid.forEach((row, y) => {
      row.forEach((solid, x) => {
        if (solid) this.add.image(x * TILE, y * TILE, Tex.tile).setOrigin(0);
      });
    });
    this.coins = level.coins.map((c) => this.add.image(c.x * TILE + 8, c.y * TILE + 8, Tex.coin));
    this.add.image(level.goal.x * TILE, level.goal.y * TILE, Tex.goal).setOrigin(0);
    this.player = this.add.image(0, 0, Tex.player).setOrigin(0);
    this.hud = this.add.text(6, 6, '', { fontFamily: 'monospace', fontSize: '10px' }).setScrollFactor(0);
    this.cameras.main.setBounds(0, 0, level.width * TILE, level.height * TILE).startFollow(this.player, true);
    if (this.rt.ctx.params.debug) this.debug = this.add.graphics();
    this.sync();
    this.rt.entered('play');
  }
  override update(_time: number, delta: number) {
    this.rt.frame(delta);
    this.sync();
  }
  private sync() {
    const world = this.rt.world;
    if (!world) return;
    this.player.setPosition(Math.round(world.player.x), Math.round(world.player.y));
    this.coins.forEach((c, i) => {
      c.setVisible(!world.collected.has(i));
    });
    const s = summarize(world);
    this.hud.setText(world.status === 'won' ? `Level complete! ${s.coins}  (A: title)` : `Coins ${s.coins}`);
    if (this.debug) {
      this.debug.clear().lineStyle(1, 0xff00ff).strokeRect(world.player.x, world.player.y, 10, 14);
      this.hud.setText(`${this.hud.text}\ntick ${world.tick} tile ${s.player.tile.join(',')}`);
    }
  }
}

export async function startPhaser(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  const loaded = await saves.load(SAVE_SLOT);
  if (loaded.kind === 'unreadable' || loaded.kind === 'newer-than-code') {
    ctx.notice('Your saved progress could not be loaded, so it will not be overwritten.');
  } else if (saves.status === 'memory-only') {
    ctx.notice('Progress will not be saved in this browser mode.');
  }
  const rt = new Runtime(ctx, saves, loaded.kind === 'ok' ? loaded.data : null);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: ctx.container,
    width: WIDTH,
    height: HEIGHT,
    pixelArt: true,
    backgroundColor: '#1d2b53',
    banner: false,
    scale: { mode: Phaser.Scale.NONE },
    scene: [new BootScene(rt), new TitleScene(rt), new PlayScene(rt)],
  });
  rt.game = game;

  const fitToContainer = () => game.scale.setZoom(integerScale(WIDTH, HEIGHT, ctx.container));
  new ResizeObserver(fitToContainer).observe(ctx.container);
  game.events.once(Phaser.Core.Events.READY, () => {
    fitToContainer();
    game.canvas.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));
  });

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
    debugSummary: () => ({ scene: rt.scene, save: saves.status, ...(rt.world ? summarize(rt.world) : {}) }),
    debugState: () => ({
      scene: rt.scene,
      menu: rt.scene === 'title' ? rt.menu : undefined,
      save: rt.save,
      world: rt.world && {
        player: rt.world.player,
        collected: [...rt.world.collected],
        status: rt.world.status,
        tick: rt.world.tick,
      },
      ascii: rt.world ? toAscii(rt.world) : undefined,
    }),
    async loadState(save) {
      const result = await saves.importJson(SAVE_SLOT, JSON.stringify(save));
      if (result.kind !== 'ok') throw new Error(`Fixture rejected by save store: ${JSON.stringify(result)}`);
      rt.save = result.data;
      rt.startPlay(result.data);
    },
    pause: () => game.loop.sleep(),
    resume: () => game.loop.wake(),
    onHide: () => (rt.scene === 'play' ? rt.persist() : undefined),
  };
}
