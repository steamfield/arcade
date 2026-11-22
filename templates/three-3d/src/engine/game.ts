import { createLogger, createRng, EventLog, FixedStep } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import { type GameContext, type GameHandle, renderPixelRatio } from '@arcade/shell';
import * as THREE from 'three';
import type { GameEvent } from '../logic/events.ts';
import type { SaveData } from '../logic/save.ts';
import { createWorld, stepWorld, summarize, toSave, type World } from '../logic/world.ts';
import { CameraRig } from './camera-rig.ts';
import { input } from './input.ts';
import { CRATE_SPAWNS, loadPhysics, type Physics } from './physics.ts';

const SAVE_SLOT = 'main';
const log = createLogger('three-3d');

export type EngineEvent =
  | { type: 'physics.ready' }
  | { type: 'save.written' }
  | { type: 'save.failed'; reason: string };

export async function startThree(ctx: GameContext, saves: SaveStore<SaveData>): Promise<GameHandle> {
  const events = new EventLog<GameEvent | EngineEvent>();
  const loaded = await saves.load(SAVE_SLOT);
  if (loaded.kind === 'unreadable' || loaded.kind === 'newer-than-code') {
    ctx.notice('Your saved progress could not be loaded, so it will not be overwritten.');
  } else if (saves.status === 'memory-only') {
    ctx.notice('Progress will not be saved in this browser mode.');
  }
  const newGame = (): SaveData => ({ seed: createRng(ctx.params.seed).int(1, 1_000_000), collected: [] });
  let world: World = createWorld(events, loaded.kind === 'ok' ? loaded.data : newGame());

  // Renderer and scene.
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(renderPixelRatio());
  ctx.container.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', () => ctx.reportError('webgl', 'WebGL context lost'));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e5);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 4);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x5f9e4a }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const playerMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.8, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7 }),
  );
  scene.add(playerMesh);
  const orbGeometry = new THREE.SphereGeometry(0.3, 16, 12);
  const orbMaterial = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x996600 });
  let orbMeshes: THREE.Mesh[] = [];
  const buildOrbs = () => {
    for (const m of orbMeshes) scene.remove(m);
    orbMeshes = world.orbs.map((o) => {
      const m = new THREE.Mesh(orbGeometry, orbMaterial);
      m.position.set(o.x, o.y, o.z);
      scene.add(m);
      return m;
    });
  };
  buildOrbs();
  const crateMeshes = CRATE_SPAWNS.map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xa1673a }));
    scene.add(m);
    return m;
  });

  let physics: Physics | null = null;
  const rig = new CameraRig(1);
  const playerPos = new THREE.Vector3();
  const syncScene = () => {
    playerPos.set(world.player.x, world.player.y + 0.8, world.player.z);
    playerMesh.position.copy(playerPos);
    orbMeshes.forEach((m, i) => {
      m.visible = !world.collected.has(i);
    });
    physics?.crates().forEach((c, i) => {
      crateMeshes[i]?.position.set(c.x, c.y, c.z);
    });
  };
  const render = () => {
    syncScene();
    renderer.render(scene, rig.camera);
  };
  const resize = () => {
    const { width, height } = ctx.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    rig.resize(width, height);
    render();
  };
  new ResizeObserver(resize).observe(ctx.container);
  syncScene();
  rig.snapTo(playerPos);

  // Physics loads after the first frame. Ticks wait for it (idle() is false until then).
  const loadingLabel = Object.assign(document.createElement('div'), { textContent: 'Loading physics…' });
  loadingLabel.style.cssText = 'position:absolute;bottom:12px;right:12px;color:#fff;font:13px system-ui';
  ctx.container.append(loadingLabel);
  loadPhysics()
    .then((p) => {
      physics = p;
      loadingLabel.remove();
      events.emit({ type: 'physics.ready' });
      render();
    })
    .catch((err) => ctx.reportError('physics', err));

  const persist = async () => {
    const result = await saves.save(SAVE_SLOT, toSave(world));
    if (result.ok) events.emit({ type: 'save.written' });
    else {
      log.warn(`save failed: ${result.reason}`);
      events.emit({ type: 'save.failed', reason: result.reason });
    }
  };

  const step = new FixedStep((dt) => {
    if (!physics) return;
    events.tick = step.tick;
    input.update();
    const before = world.collected.size;
    stepWorld(world, { move: input.vector('move'), jumpPressed: input.justPressed('jump') }, dt);
    physics.step(world.player);
    rig.tick(playerPos.set(world.player.x, world.player.y + 0.8, world.player.z));
    if (world.collected.size !== before) void persist();
  });

  // Real-time loop. In test mode the shell drives advance() instead and we render after each call.
  let running = !ctx.params.testMode;
  let last = performance.now();
  const loop = (now: number) => {
    if (!running) return;
    step.frame((now - last) / 1000);
    last = now;
    render();
    requestAnimationFrame(loop);
  };
  if (running) requestAnimationFrame(loop);

  const idle = () => physics !== null;
  return {
    events,
    idle,
    advance(ticks) {
      let ran = 0;
      while (ran < ticks && idle()) {
        step.advance(1);
        ran++;
      }
      render();
      return ran;
    },
    renderer: () => (renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl'),
    debugSummary: () => ({ ...summarize(world), physics: physics ? 'ready' : 'loading', save: saves.status }),
    debugState: () => ({
      world: { ...world, events: undefined, collected: [...world.collected] },
      crates: physics?.crates().map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) })),
    }),
    async loadState(save) {
      const result = await saves.importJson(SAVE_SLOT, JSON.stringify(save));
      if (result.kind !== 'ok') throw new Error(`Fixture rejected by save store: ${JSON.stringify(result)}`);
      world = createWorld(events, result.data);
      buildOrbs();
      syncScene();
      rig.snapTo(playerPos);
      render();
    },
    pause() {
      running = false;
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
    },
    onHide: persist,
  };
}
