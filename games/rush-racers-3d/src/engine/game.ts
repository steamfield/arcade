/**
 * The three.js engine for the game: renderer, camera, the real-time loop and the `GameHandle` the
 * shell and tests drive. Gameplay lives in `Runtime`; this file reads input, renders its state and
 * nothing else. Scaffold: lane 1/b adds the track, racer and HUD views and the chase camera.
 */
import { createLogger } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, renderPixelRatio } from '@arcade/shell';
import * as THREE from 'three';
import { THORNWOOD_TRAIL } from '../logic/courses/thornwood-trail.ts';
import type { SaveData } from '../logic/save.ts';
import { CameraRig } from './camera-rig.ts';
import { stageFor } from './capture-stages.ts';
import { input } from './input.ts';
import { Runtime } from './runtime.ts';

/** Starts the game in `ctx.container` and returns the handle the shell drives. */
export async function startThree(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  const rig = new CameraRig(1);
  const scene = new THREE.Scene();

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
    afterTick: () => {},
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(renderPixelRatio());
  ctx.container.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));

  const render = () => renderer.render(scene, rig.camera);
  const resize = () => {
    const { width, height } = ctx.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    rig.resize(width, height);
    render();
  };
  new ResizeObserver(resize).observe(ctx.container);

  // Real-time loop. In test mode the shell drives advance() instead and we render after each call.
  let running = !ctx.params.testMode;
  let last = performance.now();
  const loop = (now: number) => {
    if (!running) return;
    runtime.frame((now - last) / 1000);
    last = now;
    render();
    requestAnimationFrame(loop);
  };
  if (running) requestAnimationFrame(loop);

  return {
    events: runtime.events,
    idle: () => !runtime.saving,
    advance(ticks) {
      const ran = runtime.advance(ticks);
      render();
      return ran;
    },
    renderer: () => (renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl'),
    debugSummary: () => runtime.summary(),
    debugState: () => ({
      worldHash: runtime.worldHash(),
      world: { ...runtime.world, events: undefined, course: undefined },
    }),
    pause() {
      running = false;
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
    },
    onHide: () => runtime.settled(),
  };
}
