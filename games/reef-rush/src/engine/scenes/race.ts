/**
 * The race screen. It assembles the views, drawn in the course's theme (backdrop, course, pickups, hazards, enemies,
 * the attack power-ups in the water, racers and their power-up effects, the darkness
 * over dark zones, HUD, the hints for young players, camera, debug overlay, and any layers the theme adds) over the
 * runtime's world and syncs them every rendered frame.
 * Event-driven visuals arrive through the runtime's per-tick listener.
 * Ticking, input and the move to results all happen in the runtime.
 */
import { TICK_HZ } from '@arcade/core';
import Phaser from 'phaser';
import { courseOf } from '../../logic/courses/index.ts';
import { selectedItem } from '../../logic/powerups/inventory.ts';
import { playerOf } from '../../logic/racers.ts';
import type { World } from '../../logic/types.ts';
import { createFx } from '../fx/index.ts';
import type { Runtime } from '../runtime.ts';
import { themeFor } from '../themes/index.ts';
import { createAttackView } from '../view/attack-view.ts';
import { createBackdrop } from '../view/backdrop.ts';
import { besidePlayerY } from '../view/beside-player.ts';
import { followRacer } from '../view/camera.ts';
import { createDarkView } from '../view/dark-view.ts';
import { createDebugOverlay } from '../view/debug-overlay.ts';
import { createEnemyView } from '../view/enemy-view.ts';
import { createFireButtonIcon } from '../view/fire-button.ts';
import { createGuideView } from '../view/guide-view.ts';
import { createHazardView } from '../view/hazard-view.ts';
import { createHintView } from '../view/hint-view.ts';
import { createHud } from '../view/hud.ts';
import { createLevelView } from '../view/level-view.ts';
import { createPickupView } from '../view/pickup-view.ts';
import { createPowerupView } from '../view/powerup-view.ts';
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
    const course = courseOf(world);
    const theme = themeFor(course);
    const backdrop = createBackdrop(this, world.level, theme, this.rt.settings);
    const level = createLevelView(this, world.level, theme, course.level.legend);
    // The pickup and hazard views draw the course objects from world state, so the level's inert stand-ins go.
    for (const stand of Object.values(level.placeholders).flat()) stand.destroy();
    const { reducedMotion } = this.rt.settings;
    const pickups = createPickupView(this, world.level, reducedMotion);
    const hazards = createHazardView(this, world.level, theme.hazards, reducedMotion);
    const enemies = createEnemyView(this, world, reducedMotion);
    const attacks = createAttackView(this, reducedMotion);
    const racers = world.racers.map((racer) => ({
      racer,
      view: createRacerView(this, racer, reducedMotion),
      effects: createPowerupView(this, racer.id, reducedMotion),
    }));
    const themeLayers = theme.extraLayers(this, world);
    const dark = createDarkView(this, world, theme.dark, reducedMotion);
    const hud = createHud(this, world, reducedMotion);
    const hints = createHintView(this, reducedMotion, hud.right, besidePlayerY);
    const guide = createGuideView(this, reducedMotion);
    const fireIcon = createFireButtonIcon(this);
    const fx = createFx(this, world, theme, reducedMotion);
    const camera = followRacer(this.cameras.main, playerOf(world).body, world.level);
    const debug = this.rt.ctx.params.debug ? createDebugOverlay(this) : null;

    const stopListening = this.rt.listen((events) => {
      const tick = this.rt.world?.tick ?? 0;
      level.onEvents(events);
      enemies.onEvents(events, tick);
      for (const { view, effects } of racers) {
        view.onEvents(events, tick);
        effects.onEvents(events, tick);
      }
      fx.onEvents(events, tick);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopListening();
      fireIcon.destroy();
    });

    let lastTick = world.tick;
    const sync = (current: World) => {
      camera.update((current.tick - lastTick) / TICK_HZ);
      lastTick = current.tick;
      backdrop.update(current.tick);
      pickups.sync(current, current.tick);
      hazards.sync(current, current.tick);
      enemies.sync(current);
      attacks.sync(current, current.tick);
      for (const layer of themeLayers) layer.sync(current);
      for (const { racer, view, effects } of racers) {
        view.sync(racer, current.tick);
        effects.sync(racer, current.tick);
      }
      hud.sync(current);
      hints.sync(current, this.rt.hints, this.cameras.main.worldView);
      guide.sync(current, this.rt.hints.guide, this.cameras.main.worldView);
      fireIcon.sync(selectedItem(playerOf(current))?.kind ?? null);
      fx.sync(current);
      // After the camera moved, so the darkness lines up with this frame's scroll.
      dark.sync(current);
      debug?.sync(current);
    };
    sync(world);
    return { sync };
  }
}
