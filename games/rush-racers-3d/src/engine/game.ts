/**
 * The three.js engine for the game: renderer, camera, the real-time loop and the `GameHandle` the
 * shell and tests drive. Gameplay lives in `Runtime`; this file reads input, renders its state and
 * nothing else.
 */
import { createLogger, type Logger, TICK_DT } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, renderPixelRatio } from '@arcade/shell';
import * as THREE from 'three';
import { THORNWOOD_TRAIL } from '../logic/courses/thornwood-trail.ts';
import type { SaveData } from '../logic/save.ts';
import type { RacerId, World } from '../logic/types.ts';
import { CHARACTER_IDS, type CharacterId } from '../logic/types.ts';
import { playerOf } from '../logic/world.ts';
import { CameraRig } from './camera-rig.ts';
import { stageFor } from './capture-stages.ts';
import { Hud } from './hud.ts';
import { input } from './input.ts';
import { RacerView } from './racer-view.ts';
import { Runtime, type Scene } from './runtime.ts';
import { createScreens } from './screens.ts';
import { buildTrackFrames } from './track-geometry.ts';
import { createTrackView } from './track-view.ts';

function reconcileRacerViews(scene: THREE.Scene, views: Map<RacerId, RacerView>, racers: World['racers']): void {
  for (const [id, view] of views) {
    if (racers.some((racer) => racer.id === id && racer.character === view.character)) {
      view.resetPose();
    } else {
      view.dispose();
      views.delete(id);
    }
  }
  for (const racer of racers) {
    if (views.has(racer.id)) continue;
    const view = new RacerView(racer.character);
    views.set(racer.id, view);
    scene.add(view.root);
  }
}

/** Starts the game in `ctx.container` and returns the handle the shell drives. */
export async function startThree(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  const log = createLogger(ctx.manifest.id);
  let syncViews = () => {};
  const stage = stageFor(ctx.params, window.location.search, log);
  const runtime = await Runtime.start({
    saves,
    course: THORNWOOD_TRAIL,
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
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hud = new Hud(ctx.container);
  const screens = createScreens(ctx.container);
  scene.add(trail.root);
  const stand = frames.frameAt(course.startS + 31);
  const podiumHeight = 0.55;
  const podiumTop = new THREE.Vector3(stand.x, stand.y + podiumHeight, stand.z);
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.55, podiumHeight, 16),
    new THREE.MeshLambertMaterial({ color: 0x806047 }),
  );
  podium.position.copy(podiumTop);
  podium.position.y -= podiumHeight / 2 + 0.01;
  scene.add(podium);

  let drawnWorld: World | undefined;
  let drawnScreen: Scene | undefined;
  let screenTicks = 0;
  let preview: RacerView | undefined;
  let previewStarted = 0;
  const racers = new Map<RacerId, RacerView>();
  let cursor = 0;
  let goUntil = -1;
  let newBest = false;
  syncViews = () => {
    const { world, scene: screen } = runtime;
    const screenChanged = screen !== drawnScreen;
    screenTicks = screenChanged ? 0 : screenTicks + 1;
    drawnScreen = screen;
    podium.visible = screen === 'select';
    if (screenChanged && screen !== 'select') {
      preview?.dispose();
      preview = undefined;
    }
    const racing = screen === 'race' || screen === 'results';
    const newWorld = racing && world !== drawnWorld;
    if (newWorld) {
      reconcileRacerViews(scene, racers, world.racers);
      drawnWorld = world;
      goUntil = -1;
      newBest = false;
    }
    let snap = newWorld || (screenChanged && screen === 'race');
    const batch = runtime.events.drain(cursor);
    cursor = batch.cursor;
    for (const event of batch.events) {
      if (event.type === 'racer.respawned' && event.id === 'player') snap = true;
      if (event.type === 'race.started') goUntil = world.tick + 45;
      if (event.type === 'best.new' && event.course === world.course.id) newBest = true;
    }
    if (racing) {
      for (const racer of world.racers) racers.get(racer.id)?.tick(racer, frames, course);
      rig.tick(playerOf(world), snap);
      return;
    }
    if (screenChanged) for (const view of racers.values()) view.root.visible = false;
    if (screen === 'title') {
      rig.title(motion.matches ? 0 : screenTicks * TICK_DT);
    } else {
      const character = CHARACTER_IDS[runtime.cursor] ?? runtime.character;
      if (preview?.character !== character) {
        preview?.dispose();
        preview = new RacerView(character);
        scene.add(preview.root);
        previewStarted = screenTicks;
      }
      preview.preview(podiumTop.x, podiumTop.y, podiumTop.z, 0.45 + (screenTicks - previewStarted) * TICK_DT * 0.85);
      if (screenChanged) rig.select(podiumTop);
    }
  };
  syncViews();

  const render = () => {
    const { world, scene: screen, bests } = runtime;
    trail.tick(world.tick);
    hud.sync(world, screen, bests, screen === 'race' && world.tick < goUntil, newBest);
    screens.sync({ scene: screen, cursor: runtime.cursor, character: runtime.character });
    renderer.render(scene, rig.camera);
  };
  const resize = () => {
    const { width, height } = ctx.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    rig.resize(width, height);
    if (runtime.scene === 'select') rig.select(podiumTop);
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

/**
 * The `?character=` the page was opened with, or null to race as the saved character. An unknown id
 * is logged as a warning that lists the valid ones.
 */
function characterFor(search: string, log: Logger): CharacterId | null {
  const name = new URLSearchParams(search).get('character');
  if (name === null) return null;
  const character = CHARACTER_IDS.find((id) => id === name);
  if (!character) log.warn(`unknown ?character=${name}; valid characters: ${CHARACTER_IDS.join(', ')}`);
  return character ?? null;
}
