/**
 * The race screen. It assembles the views (backdrop, course, racers, HUD,
 * camera, debug overlay) over the runtime's world and syncs them every rendered
 * frame. Event-driven visuals arrive through the runtime's per-tick listener.
 * Ticking, input and the move to results all happen in the runtime.
 */
import { TICK_HZ } from '@arcade/core';
import Phaser from 'phaser';
import { playerOf } from '../../logic/racers.ts';
import type { World } from '../../logic/types.ts';
import type { Runtime } from '../runtime.ts';
import { createBackdrop } from '../view/backdrop.ts';
import { followRacer } from '../view/camera.ts';
import { createDebugOverlay } from '../view/debug-overlay.ts';
import { createHud } from '../view/hud.ts';
import { createLevelView } from '../view/level-view.ts';
import { createRacerView } from '../view/racer-view.ts';

/** Everything the race scene draws, rebuilt on each create(). */
interface RaceViews {
  sync(world: World): void;
}

/** Race scene. Expects the runtime to hold a fresh world from `startRace()`. */
export class RaceScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private views: RaceViews | null = null;

  constructor(rt: Runtime) {
    super('race');
    this.rt = rt;
  }

  create(): void {
    const world = this.rt.world;
    if (!world) throw new Error('The race scene started without a world; start races with Runtime.startRace()');
    this.views = this.createViews(world);
    this.rt.entered('race');
  }

  override update(): void {
    if (this.rt.world) this.views?.sync(this.rt.world);
  }

  private createViews(world: World): RaceViews {
    const backdrop = createBackdrop(this, world.level);
    const level = createLevelView(this, world.level);
    const racers = world.racers.map((racer) => ({ racer, view: createRacerView(this, racer) }));
    const hud = createHud(this);
    const camera = followRacer(this.cameras.main, playerOf(world).body, world.level);
    const debug = this.rt.ctx.params.debug ? createDebugOverlay(this) : null;

    const stopListening = this.rt.listen((events) => level.onEvents(events));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopListening);

    let lastTick = world.tick;
    const sync = (current: World) => {
      camera.update((current.tick - lastTick) / TICK_HZ);
      lastTick = current.tick;
      backdrop.update(current.tick);
      for (const { racer, view } of racers) view.sync(racer, current.tick);
      hud.sync(current);
      debug?.sync(current);
    };
    sync(world);
    return { sync };
  }
}
