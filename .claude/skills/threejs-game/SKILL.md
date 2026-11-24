---
name: threejs-game
description: Build, extend or review a three.js (r187) + Rapier 3D game in this repo (game.json engine set to three, or templates/three-3d). Use when writing or changing the renderer setup, scene graph, meshes, materials, lighting, shadows, glTF/KTX2 assets, instancing, the camera rig, the character controller or Rapier physics, or when a three.js API from memory might be out of date. Covers how three.js fits the logic/engine split and the shell's test mode, r187 version traps, performance rules for phones, and a review checklist.
---

# three.js + Rapier games in this repo

three.js is pinned to exactly 0.187.0 (r187) per game, with `@types/three` at the same version, and Rapier at `@dimforge/rapier3d-compat` 0.21.0. three.js has no semver: APIs move every release, and most tutorials and most of your memory predate r160. Check names against `node_modules/three/src` or the types before using them. Use `WebGLRenderer` only. No `three/webgpu`, no `three/tsl`, no node materials.

For the change-check-see loop, use the `verify-game` skill. For feel, juice, accessibility and mobile, use `game-feel`. Depth is in the references:

- [references/performance.md](references/performance.md): draw calls, instancing, reuse and disposal, textures, shadows, budgets, measuring.
- [references/assets-pipeline.md](references/assets-pipeline.md): glTF, gltf-transform, meshopt, KTX2, Draco, Vite imports.
- [references/physics-and-controls.md](references/physics-and-controls.md): Rapier integration, character controller, camera rig, interpolation.
- [references/look.md](references/look.md): color management, tone mapping, lighting that looks good cheaply.

## 1. How three.js fits this repo

`templates/three-3d/src/engine/game.ts` (`startThree`) is the reference:

- **One `FixedStep` drives everything that matters.** Its callback runs `input.update()`, then `stepWorld(world, {...}, dt)` from `src/logic/`, then `physics.step(...)`. Logic and Rapier advance together, one tick at a time.
- **The game's own rAF loop exists only outside test mode.** `let running = !ctx.params.testMode`. The loop calls `step.frame(seconds)` then `render()`. In test mode the shell calls `advance(ticks)`, which runs `step.advance(1)` per tick and then renders once.
- **`render()` is read-only with respect to logic.** It syncs meshes from logic and physics state, moves the camera and draws.
- **The canvas follows `ctx.container`.** A `ResizeObserver` calls `renderer.setSize` and updates the camera aspect. The pixel ratio comes from `renderPixelRatio()` in `@arcade/shell`, which caps it at 2.
- **Failures are reported.** `webglcontextlost` and physics load errors go to `ctx.reportError`. `renderer()` returns `webgl2`/`webgl` so smoke can assert it.
- **Rapier loads after the first frame.** `idle()` is false until it's ready, so `advance()` waits and ticks never run without physics.

Rules that follow from it:

- Gameplay rules, timers, spawn logic, pickups, health and scoring are in `src/logic/` with Vitest tests. three.js objects never hold the truth about gameplay.
- Nothing reads `performance.now()` or `timer.getDelta()` to move gameplay. Visual-only animation (orb bob, water scroll) may use wall time, but anything that affects collision or state goes through ticks.
- Randomness in logic comes from `createRng(seed)`. Purely cosmetic randomness in `engine/` should use its own `createRng` too, so `arcade see` frames repeat.
- Input comes from `src/engine/input.ts` (`@arcade/input`) inside the tick and enters logic as plain data (`TickInput`).
- Camera yaw that changes what "forward" means is gameplay input. If the player can turn the camera, logic owns the yaw (updated from input actions in ticks) and the engine renders from it. See the physics-and-controls reference.

## 2. r187 traps (things that changed under you)

| From memory or an old tutorial | In r187 |
| --- | --- |
| `renderer.outputEncoding = sRGBEncoding`, `texture.encoding` | `renderer.outputColorSpace` (default `SRGBColorSpace`), `texture.colorSpace` |
| `physicallyCorrectLights`, `useLegacyLights` | Gone. Lighting is physical. Old intensity values are roughly π times too dim |
| `THREE.Clock` | Deprecated since r183; use `THREE.Timer` (`timer.update(timestamp)` each frame, then `getDelta()`) |
| `PCFSoftShadowMap` | Deprecated (r182). In r187 WebGL it logs that it was removed and falls back to `PCFShadowMap` |
| `RGBELoader` | Deprecated (r180); use `HDRLoader` |
| `BufferGeometryUtils.mergeBufferGeometries` | `mergeGeometries` |
| `three/examples/js/...`, global `THREE` add-ons | `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'` |
| `Geometry`, `BoxBufferGeometry` | `BufferGeometry`, `BoxGeometry` |
| `KTX2Loader.detectSupportAsync` | Deprecated (r181); use `detectSupport(renderer)` |
| `FileLoader.load()` return value | Returns nothing since r184; use the callback or `loadAsync` |
| `object.dispose()` frees GPU memory | `Object3D.dispose()` (r186) only fires a `dispose` event. Dispose geometries, materials and textures yourself |
| ACES output from older releases | r187 fixed the ACES Filmic fit, so ACES scenes look slightly different from older screenshots |

When upgrading a game past r187, read the "r187 → r188" section of the three.js migration guide first. Upgrades are per game and opt-in.

## 3. Renderer setup

```ts
const renderer = new THREE.WebGLRenderer({ antialias: renderPixelRatio() < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(renderPixelRatio());
renderer.toneMapping = THREE.AgXToneMapping; // or ACESFilmic / Neutral, see references/look.md
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// outputColorSpace is already SRGBColorSpace; don't change it.
```

- MSAA at a device pixel ratio of 2 costs a lot of fill rate on phones and adds little. The template keeps `antialias: true`; a game that's fill-bound should drop it when DPR is 2.
- Don't use `setAnimationLoop` and a manual rAF loop together. The template uses rAF so `pause`/`resume` and test mode are explicit.
- `renderer.info.render.calls` and `.triangles` are the numbers smoke budgets use. Expose them in `debugSummary` when you're working on performance.

## 4. Scene graph rules

- **Share geometry and materials.** One `SphereGeometry` and one material for every orb, not one per orb, as the template's `buildOrbs()` does.
- **Repeated objects are instanced.** More than a handful of the same mesh means `InstancedMesh` (same geometry and material) or `BatchedMesh` (different geometries, one material). Hide an instance by scaling it to zero or swapping it with the last one and reducing `count`.
- **Static level geometry is merged** per material with `mergeGeometries`, or exported merged from the asset pipeline.
- **No allocation in the frame or tick loop.** Keep scratch `Vector3`/`Quaternion`/`Matrix4` at module or class scope, as `CameraRig` does with `offset` and `target`.
- **Dispose what you remove.** `scene.remove(mesh)` frees nothing. Call `geometry.dispose()`, `material.dispose()` and every texture's `dispose()` unless they are shared and still in use.
- **Logic state to meshes is one-way.** `syncScene()` copies positions from logic and physics. Meshes never write back.
- **HUD is DOM, not WebGL text.** Append HUD and menus to `ctx.container`, as the template does with its loading label. Update DOM only when values change, and keep it clear of the shell's back link (top right) and the touch controls (bottom corners).

## 5. Rapier in one paragraph

Load it lazily (`await import('@dimforge/rapier3d-compat')`, then `RAPIER.init()`), as `src/engine/physics.ts` does. Set `world.timestep = TICK_DT` and call `world.step()` exactly once per logic tick, never with frame time. Use fixed bodies for the level, dynamic bodies for props, and kinematic position-based bodies (or the `KinematicCharacterController`) for the player and moving platforms. Rapier objects are WASM handles: free the world on teardown. The compat build is deterministic on one machine but not guaranteed across platforms, so scenario assertions on physics positions use tolerances. Details and the controller pattern are in the physics-and-controls reference.

## 6. Assets in one paragraph

Models are glTF binary (`.glb`) run through `@gltf-transform/cli` with meshopt geometry compression and KTX2 textures, imported with `?url` so Vite hashes them, and loaded with `GLTFLoader` plus `MeshoptDecoder` and `KTX2Loader`. Route load errors to `ctx.reportError` and keep `idle()` false until loads resolve. Details are in the assets-pipeline reference.

## 7. Performance targets for phones

These are starting points until `game.json` budgets exist. Measure with `renderer.info` and the numbers `arcade smoke` reports, not headless FPS.

- Draw calls: aim under about 100 on mobile. Triangles: a few hundred thousand at most.
- One shadow-casting directional light with a 1024 map fitted tightly around the player, or blob shadows on mobile.
- Textures: KTX2, at most 1024 px for most surfaces and 2048 px only for hero assets.
- Pixel ratio capped at 2 (already done by the shell). Consider a lower internal ratio when the frame time is high.
- Rapier compat is about 4.3 MB of JS (WASM inlined as base64), about 1.65 MB gzipped. It's the biggest download in a 3D game, which is why it loads after first paint.

## 8. Pitfalls seen in practice

- **Camera smoothing per render frame.** `camera.position.lerp(target, 0.15)` per render runs faster on 120 Hz screens, and in test mode it lags because `advance(120)` renders once. Smooth per tick with `1 - Math.exp(-lambda * TICK_DT)`, as the template's `CameraRig.tick` does.
- **`InstancedMesh` culled wrongly after moving instances.** Its bounding sphere is computed once, lazily. Call `computeBoundingSphere()` after moving instances far, or set `frustumCulled = false` on small sets.
- **Skinned meshes vanish at screen edges** because their bounding sphere is computed once, from the pose at first use, and not updated as animations move the limbs. Call `computeBoundingSphere()` after posing, enlarge the sphere, or disable culling for that mesh.
- **Color maps look washed out or too dark** because of a missing `texture.colorSpace = THREE.SRGBColorSpace` on hand-loaded color textures. `GLTFLoader` sets this itself.
- **Transparent sorting artifacts** from foliage and particles. Prefer `alphaTest` cutouts over blended transparency, and set `depthWrite: false` on additive particles.
- **Shadow acne or peter-panning.** Tune `shadow.bias` and `shadow.normalBias` together, and keep the shadow camera frustum tight.
- **Stepping Rapier from the render loop** or with a variable dt makes runs diverge. Only `FixedStep` steps it.

## 9. Checklist before handing back

- [ ] Gameplay lives in `src/logic/` with Vitest coverage; `engine/` only renders, forwards input and runs physics inside the tick.
- [ ] The rAF loop doesn't run in test mode; `advance()` renders once after its ticks; `idle()` covers physics and asset loads.
- [ ] No pre-r187 APIs from section 2; typecheck passes against `@types/three` 0.187.0.
- [ ] Geometry and materials are shared; repeated meshes are instanced; removed objects are disposed.
- [ ] No per-frame allocations in `render()`, the tick callback, or the camera rig.
- [ ] Assets are compressed glTF/KTX2, imported with `?url`, with load errors routed to `ctx.reportError`.
- [ ] Draw calls and triangles checked in `debugSummary` or `renderer.info` for a busy view.
- [ ] Camera motion is frame-rate independent and reproducible in `arcade see`.
- [ ] `pnpm arcade test <slug>` on the tests covering your files and `pnpm arcade check <slug> --skip-tests` pass, and `see` (desktop and `--mobile`) looks right. Whoever merges runs the full `check` and `smoke` (`verify-game`, AGENTS.md "Test scope").
