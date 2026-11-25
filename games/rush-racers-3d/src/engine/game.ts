/**
 * The three.js engine for the game: renderer, camera, the real-time loop and the `GameHandle` the
 * shell and tests drive. Gameplay lives in `Runtime`; this file reads input, renders its state and
 * nothing else.
 */
import { createLogger, TICK_DT } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, renderPixelRatio } from '@arcade/shell';
import * as THREE from 'three';
import { COURSES, DEFAULT_COURSE } from '../logic/courses/index.ts';
import type { SaveData } from '../logic/save.ts';
import { CHARACTER_IDS, type World } from '../logic/types.ts';
import { playerOf } from '../logic/world.ts';
import { configureRenderer, createAtmosphere } from './atmosphere.ts';
import { CameraRig } from './camera-rig.ts';
import { characterFor, courseFor, stageFor } from './capture-stages.ts';
import { input } from './input.ts';
import { createItemView } from './items/item-view.ts';
import { createPost } from './post.ts';
import { createPedestal } from './racers/pedestal.ts';
import { RacerViews } from './racers/racer-view.ts';
import { TrailDust } from './racers/trail-dust.ts';
import { Runtime, type Scene } from './runtime.ts';
import { themeFor } from './themes/index.ts';
import { loadForestCards } from './track/forest-cards.ts';
import { timberMaterial } from './track/timber.ts';
import { buildTrackFrames } from './track/track-geometry.ts';
import { createTrackView } from './track/track-view.ts';
import { Hud } from './ui/hud.ts';
import { createScreens } from './ui/screens.ts';

/** True when WebGL runs on a software rasterizer (SwiftShader, llvmpipe), which gets the low tier. */
function softwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  return /swiftshader|llvmpipe|software/i.test(name);
}

/** Starts the game in `ctx.container` and returns the handle the shell drives. */
export async function startThree(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  const log = createLogger(ctx.manifest.id);
  let syncViews = () => {};
  const stage = stageFor(ctx.params, window.location.search, log);
  const runtime = await Runtime.start({
    saves,
    course: courseFor(window.location.search, COURSES, DEFAULT_COURSE, log),
    seed: ctx.params.seed,
    character: characterFor(window.location.search, log),
    notice: ctx.notice,
    stage,
    startScene: stage !== null || ctx.params.scene === 'race' ? 'race' : 'title',
    gameId: ctx.manifest.id,
    readInput: () => {
      input.update();
      const move = input.vector('move');
      return {
        race: {
          forward: input.isDown('forward'),
          brake: input.isDown('back'),
          steer: move.x,
          jumpPressed: input.justPressed('jump'),
          jumpHeld: input.isDown('jump'),
          dashPressed: input.justPressed('dash'),
          firePressed: input.justPressed('fire'),
          nextPressed: input.justPressed('next'),
          prevPressed: input.justPressed('prev'),
        },
        confirmPressed: input.justPressed('fire'),
        menu: {
          left: input.justPressed('left'),
          right: input.justPressed('right'),
          up: input.justPressed('forward'),
          down: input.justPressed('back'),
          back: input.justPressed('dash'),
        },
      };
    },
    afterTick: () => syncViews(),
  });

  const pixelRatio = renderPixelRatio();
  const renderer = new THREE.WebGLRenderer({ antialias: pixelRatio < 2 });
  renderer.setPixelRatio(pixelRatio);
  // Count draw calls across every post pass of a frame, not just the last one.
  renderer.info.autoReset = false;
  ctx.container.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));

  const { course, seed } = runtime.world;
  const theme = themeFor(course);
  const small = window.matchMedia('(pointer: coarse)').matches || softwareRenderer(renderer);
  configureRenderer(renderer, theme);
  const scene = new THREE.Scene();
  const atmosphere = createAtmosphere(renderer, scene, theme, small);

  const scenery = small
    ? loadForestCards()
    : import('./track/nature-kit.ts').then(({ loadNatureKit }) => loadNatureKit());
  const kit = await scenery.catch((error: unknown) => {
    ctx.reportError(small ? 'forest atlas' : 'gltf', error);
    throw error;
  });
  const frames = buildTrackFrames(course);
  const timber = timberMaterial(theme.props);
  const trail = createTrackView(course, frames, seed, theme, kit, small, timber);
  const rig = new CameraRig(frames);
  const post = createPost(renderer, scene, rig.camera, !small);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hud = new Hud(ctx.container);
  const screens = createScreens(ctx.container);
  scene.add(trail.root);
  const items = createItemView(course, frames, small);
  scene.add(items.root);
  const pedestal = createPedestal(scene, frames, course, timber);

  const dust = small ? null : new TrailDust(seed);
  if (dust) scene.add(dust.points);

  let drawnWorld: World | undefined;
  const racers = new RacerViews(scene);
  let cursor = 0;
  const syncRaceViews = (world: World, screen: Scene, screenChanged: boolean): boolean => {
    const racing = screen === 'race' || screen === 'results';
    const newWorld = racing && world !== drawnWorld;
    if (newWorld) {
      racers.sync(world.racers);
      drawnWorld = world;
    }
    if (newWorld || screenChanged) dust?.clear();
    const leaveDust = dust && screen === 'race' && world.phase === 'racing' && !motion.matches;
    let snap = newWorld || (screenChanged && screen === 'race');
    const batch = runtime.events.drain(cursor);
    cursor = batch.cursor;
    for (const event of batch.events) {
      if (event.type === 'racer.respawned' && event.id === 'player') snap = true;
      if (leaveDust && (event.type === 'racer.landed' || event.type === 'racer.dashed')) {
        const racer = world.racers.find((runner) => runner.id === event.id);
        if (racer) dust.emit(racer, frames, world.tick, event.type === 'racer.landed' ? 6 : 4);
      }
      hud.onEvent(event, world);
    }
    if (racing) racers.tick(world, frames, course);
    else if (screenChanged) racers.hide();
    return snap;
  };

  let drawnScreen: Scene | undefined;
  let screenTicks = 0;
  let windTicks = 0;
  syncViews = () => {
    kit.setWind(motion.matches ? 0 : ++windTicks * TICK_DT);
    const { world, scene: screen } = runtime;
    const screenChanged = screen !== drawnScreen;
    screenTicks = screenChanged ? 0 : screenTicks + 1;
    drawnScreen = screen;

    const selected = screen === 'select' ? CHARACTER_IDS[runtime.cursor] : undefined;
    const preview = screen === 'title' || screen === 'select';
    pedestal.sync(preview ? (selected ?? runtime.character) : null, screenTicks);
    const snap = syncRaceViews(world, screen, screenChanged);
    switch (screen) {
      case 'title':
      case 'select':
        if (screenChanged) rig.select(pedestal.top);
        break;
      case 'race':
      case 'results':
        rig.tick(playerOf(world), snap);
        break;
    }
  };
  syncViews();

  const render = () => {
    const { world, scene: screen, bests } = runtime;
    trail.tick(world.tick);
    items.root.visible = screen === 'race' || screen === 'results';
    if (items.root.visible) items.sync(world);
    if (dust) {
      if (screen === 'race' && !motion.matches) dust.draw(world.tick);
      else dust.points.visible = false;
    }
    hud.sync(world, screen, bests);
    screens.sync({ scene: screen, cursor: runtime.cursor, character: runtime.character });
    atmosphere.follow(rig.camera);
    renderer.info.reset();
    post.render();
  };
  const resize = () => {
    const { width, height } = ctx.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    post.setSize(width, height);
    rig.resize(width, height);
    if (runtime.scene === 'title' || runtime.scene === 'select') rig.select(pedestal.top);
    render();
  };
  resize();
  new ResizeObserver(resize).observe(ctx.container);

  // Real-time loop. In test mode the shell drives advance() instead and we render after each call.
  let animation = 0;
  let last = performance.now();
  const loop = (now: number) => {
    runtime.frame((now - last) / 1000);
    last = now;
    render();
    animation = requestAnimationFrame(loop);
  };
  if (!ctx.params.testMode) animation = requestAnimationFrame(loop);

  return {
    events: runtime.events,
    idle: () => !runtime.saving,
    advance(ticks) {
      const ran = runtime.advance(ticks);
      render();
      return ran;
    },
    renderer: () => (renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl'),
    debugSummary: () => ({ ...runtime.summary(), drawCalls: renderer.info.render.calls }),
    debugState: () => ({
      worldHash: runtime.worldHash(),
      world: { ...runtime.world, events: undefined, course: undefined },
    }),
    pause() {
      cancelAnimationFrame(animation);
      animation = 0;
    },
    resume() {
      if (animation || ctx.params.testMode) return;
      last = performance.now();
      animation = requestAnimationFrame(loop);
    },
    onHide: () => runtime.settled(),
  };
}
