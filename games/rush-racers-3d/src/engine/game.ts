/**
 * The three.js engine for the game: renderer, camera, the real-time loop and the `GameHandle` the
 * shell and tests drive. Gameplay lives in `Runtime`; this file reads input, renders its state and
 * nothing else.
 */
import { createLogger } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, renderPixelRatio } from '@arcade/shell';
import * as THREE from 'three';
import { THORNWOOD_TRAIL } from '../logic/courses/thornwood-trail.ts';
import type { SaveData } from '../logic/save.ts';
import type { RacerId, World } from '../logic/types.ts';
import { playerOf } from '../logic/world.ts';
import { CameraRig } from './camera-rig.ts';
import { stageFor } from './capture-stages.ts';
import { Hud } from './hud.ts';
import { input } from './input.ts';
import { RacerView } from './racer-view.ts';
import { Runtime } from './runtime.ts';
import { buildTrackFrames } from './track-geometry.ts';
import { createTrackView } from './track-view.ts';

/** Starts the game in `ctx.container` and returns the handle the shell drives. */
export async function startThree(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  let syncViews = () => {};
  const runtime = await Runtime.start({
    saves,
    course: THORNWOOD_TRAIL,
    seed: ctx.params.seed,
    character: null,
    notice: ctx.notice,
    stage: stageFor(ctx.params, window.location.search, createLogger(ctx.manifest.id)),
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
      };
    },
    afterTick: () => syncViews(),
  });

  const pixelRatio = renderPixelRatio();
  const renderer = new THREE.WebGLRenderer({ antialias: pixelRatio < 2 });
  renderer.setPixelRatio(pixelRatio);
  ctx.container.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcec6a8);
  scene.fog = new THREE.Fog(scene.background, 28, 115);
  const sun = new THREE.DirectionalLight(0xffe1ae, 2.05);
  sun.position.set(-15, 25, 8);
  scene.add(sun, new THREE.HemisphereLight(0xfff0cf, 0x73605a, 1.55));

  const { course, seed } = runtime.world;
  const frames = buildTrackFrames(course);
  const trail = createTrackView(course, frames, seed);
  const rig = new CameraRig(frames);
  const hud = new Hud(ctx.container);
  scene.add(trail.root);

  let drawnWorld: World | undefined;
  const racers = new Map<RacerId, RacerView>();
  let cursor = 0;
  let goUntil = -1;
  let newBest = false;
  syncViews = () => {
    const world = runtime.world;
    let snap = world !== drawnWorld;
    if (snap) {
      for (const view of racers.values()) view.dispose();
      racers.clear();
      for (const racer of world.racers) {
        const view = new RacerView(racer.character);
        racers.set(racer.id, view);
        scene.add(view.root);
      }
      drawnWorld = world;
      goUntil = -1;
      newBest = false;
    }
    const batch = runtime.events.drain(cursor);
    cursor = batch.cursor;
    for (const event of batch.events) {
      if (event.type === 'racer.respawned' && event.id === 'player') snap = true;
      if (event.type === 'race.started') goUntil = world.tick + 45;
      if (event.type === 'best.new' && event.course === world.course.id) newBest = true;
    }
    for (const racer of world.racers) racers.get(racer.id)?.tick(racer, frames, course);
    rig.tick(playerOf(world), snap);
  };
  syncViews();

  const render = () => {
    const { world, scene: screen, bests } = runtime;
    trail.tick(world.tick);
    hud.sync(world, screen, bests, screen === 'race' && world.tick < goUntil, newBest);
    renderer.render(scene, rig.camera);
  };
  const resize = () => {
    const { width, height } = ctx.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    rig.resize(width, height);
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
