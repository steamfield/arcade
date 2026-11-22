import { createLogger, EventLog, FixedStep } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, integerScale } from '@arcade/shell';
import Phaser from 'phaser';
import type { GameEvent } from '../logic/events.ts';
import { OCEAN_LEVEL } from '../logic/level/levels.ts';
import { parseLevel } from '../logic/level/parse.ts';
import { NEW_GAME, type SaveData } from '../logic/save.ts';
import { type RaceResult, type RacerId, TILE, type World } from '../logic/types.ts';
import { createWorld, playerOf, stepWorld, summarize, toAscii } from '../logic/world.ts';
import { input } from './input.ts';
import { createPlaceholderTextures, Tex } from './textures.ts';

const WIDTH = 320;
const HEIGHT = 180;
const SAVE_SLOT = 'main';
const log = createLogger('reef-rush');

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

  startPlay(): void {
    this.recorded = false;
    this.world = createWorld(parseLevel(OCEAN_LEVEL), this.events, { seed: this.ctx.params.seed });
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
    if (input.justPressed('kick')) {
      const option = menu.options[menu.selected] ?? 'Race';
      this.events.emit({ type: 'menu.selected', option });
      this.startPlay();
    }
  }

  private tickPlay(dt: number): void {
    const world = this.world;
    if (!world) return;
    if (world.race.phase === 'finished' && input.justPressed('kick')) {
      this.goTo('title');
      return;
    }
    const move = input.vector('move');
    stepWorld(
      world,
      { move: { x: move.x, y: move.y }, kick: input.justPressed('kick'), burst: input.justPressed('burst') },
      dt,
    );
    const result = world.race.result;
    if (result && !this.recorded) {
      this.recorded = true;
      void this.persist(recordResult(this.save ?? NEW_GAME, result));
    }
  }

  /** True once the current race's result has been written into the save. */
  private recorded = false;

  async persist(data: SaveData): Promise<void> {
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
    if (jump === 'play') this.rt.startPlay();
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
    this.rt.menu = { options: ['Race'], selected: 0 };
    const best = this.rt.save?.best;
    if (best) {
      this.add
        .text(WIDTH / 2, 140, `Best ${formatTicks(best.ticks)}  (${ordinal(best.place)})`, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#9fe7ff',
        })
        .setOrigin(0.5);
    }
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

const CELL_TEXTURE = {
  rock: Tex.rock,
  coral: Tex.coral,
  kelp: Tex.kelp,
  'current-right': Tex.current,
  'current-left': Tex.current,
  'current-up': Tex.current,
  'current-down': Tex.current,
} as const;

const CURRENT_ANGLE = { 'current-right': 0, 'current-down': 90, 'current-left': 180, 'current-up': 270 } as const;

class PlayScene extends Phaser.Scene {
  private racers = new Map<RacerId, Phaser.GameObjects.Image>();
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
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
    level.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 'water') return;
        const image = this.add.image(x * TILE + 8, y * TILE + 8, CELL_TEXTURE[cell]);
        if (cell in CURRENT_ANGLE) image.setAngle(CURRENT_ANGLE[cell as keyof typeof CURRENT_ANGLE]);
      });
    });
    for (let y = 0; y < level.height; y++) {
      if (level.cells[y]?.[level.finishX] === 'water')
        this.add.image(level.finishX * TILE, y * TILE, Tex.finish).setOrigin(0);
    }
    this.racers = new Map(world.racers.map((r) => [r.id, this.add.image(0, 0, Tex[r.id]).setOrigin(0)]));
    const player = this.racers.get('player');
    if (!player) throw new Error('PlayScene has no player sprite');
    player.setDepth(1);
    this.hud = this.add.text(6, 6, '', { fontFamily: 'monospace', fontSize: '10px' }).setScrollFactor(0).setDepth(2);
    this.banner = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 20, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2);
    this.cameras.main.setBounds(0, 0, level.width * TILE, level.height * TILE).startFollow(player, true);
    if (this.rt.ctx.params.debug) this.debug = this.add.graphics().setDepth(3);
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
    for (const racer of world.racers) {
      const sprite = this.racers.get(racer.id);
      sprite?.setPosition(Math.round(racer.body.x), Math.round(racer.body.y)).setFlipX(racer.facing < 0);
    }
    const { race } = world;
    const player = playerOf(world);
    const time = race.phase === 'countdown' ? formatTicks(0) : formatTicks(race.raceTick);
    this.hud.setText(`${ordinal(player.place)}  ${time}`);
    this.banner.setText(bannerText(world));
    if (this.debug) {
      this.debug.clear().lineStyle(1, 0xff00ff);
      for (const r of world.racers) this.debug.strokeRect(r.body.x, r.body.y, r.body.w, r.body.h);
      this.hud.setText(`${this.hud.text}\ntick ${world.tick} tile ${summarize(world).player.tile.join(',')}`);
    }
  }
}

function bannerText(world: World): string {
  const { race } = world;
  if (race.phase === 'countdown') return String(3 - Math.floor(race.raceTick / 60));
  if (race.phase === 'racing') return race.raceTick < 45 ? 'GO!' : '';
  const result = race.result;
  if (!result) return '';
  const time = result.playerTicks === null ? 'DNF' : formatTicks(result.playerTicks);
  return `${result.playerTicks === null ? 'DNF' : ordinal(result.playerPlace)}  ${time}\nA: title`;
}

/** Adds a finished race to the save: one more race, and a new best when the player finished faster. */
function recordResult(save: SaveData, result: RaceResult): SaveData {
  const ticks = result.playerTicks;
  const faster = ticks !== null && (save.best === null || ticks < save.best.ticks);
  return {
    ...save,
    races: save.races + 1,
    best: faster ? { ticks, place: result.playerPlace } : save.best,
  };
}

function formatTicks(ticks: number): string {
  const centis = Math.floor((ticks * 100) / 60);
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis % 100).padStart(2, '0')}`;
}

function ordinal(place: number): string {
  return `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;
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
    backgroundColor: '#0b3d6b',
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
        race: rt.world.race,
        racers: rt.world.racers.map((r) => ({
          id: r.id,
          body: r.body,
          place: r.place,
          progress: r.progress,
          finished: r.finished,
        })),
        tick: rt.world.tick,
      },
      ascii: rt.world ? toAscii(rt.world) : undefined,
    }),
    async loadState(save) {
      const result = await saves.importJson(SAVE_SLOT, JSON.stringify(save));
      if (result.kind !== 'ok') throw new Error(`Fixture rejected by save store: ${JSON.stringify(result)}`);
      rt.save = result.data;
      rt.goTo('title');
    },
    pause: () => game.loop.sleep(),
    resume: () => game.loop.wake(),
  };
}
