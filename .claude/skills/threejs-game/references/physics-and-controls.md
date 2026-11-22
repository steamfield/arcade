# Rapier, character control and the camera rig

Package: `@dimforge/rapier3d-compat` 0.21.0. API names below were checked against its `.d.ts` files. Rapier's own docs are at rapier.rs; use Context7 or the `.d.ts` files rather than memory, because the JS API has changed across 0.x releases.

## Who owns what

| Concern | Lives in | Why |
| --- | --- | --- |
| Intent: desired velocity, jump, gravity on the player, health, pickups, win/lose | `src/logic/` | Unit tested, saved, deterministic |
| Collision resolution against level geometry, pushing props | `src/engine/physics.ts` (Rapier) | Needs real geometry and a broad phase |
| Results logic needs (corrected position, grounded, what was hit) | Passed into logic as plain data | `logic/` can't import Rapier (Biome rule) |
| Meshes, camera smoothing, animation blending | `src/engine/` | Visual only |

The template takes the simplest route: logic moves the player on a flat arena and Rapier only follows a kinematic body so crates get shoved. When a game has real level geometry (walls, ramps, steps), use the two-phase tick below.

## One step per tick, fixed dt

```ts
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = TICK_DT; // 1/60, from @arcade/core
// Inside the FixedStep callback only:
world.step();             // or world.step(eventQueue)
```

- Never call `world.step()` from the rAF loop, and never with a measured frame delta.
- Load lazily, as `loadPhysics()` does: `const RAPIER = (await import('@dimforge/rapier3d-compat')).default; await RAPIER.init();`. `idle()` stays false until it resolves, so test ticks wait.
- Free on teardown: `world.free()` frees its bodies and colliders. Event queues and character controllers are freed separately (`eventQueue.free()`, `world.removeCharacterController(controller)`).

## Body types

| Body | Use for | Drive with |
| --- | --- | --- |
| Fixed (`RigidBodyDesc.fixed()`, or colliders with no body) | Level geometry | Nothing |
| Dynamic (`RigidBodyDesc.dynamic()`) | Props, debris, physics puzzles | Forces, impulses, gravity |
| Kinematic position-based (`kinematicPositionBased()`) | Player, moving platforms, doors | `setNextKinematicTranslation` / `setNextKinematicRotation` once per tick, before `step()` |
| Kinematic velocity-based | Conveyor-style movers | `setLinvel` |

- Colliders for level geometry: boxes, capsules and convex hulls are cheap; `ColliderDesc.trimesh(vertices, indices)` for static terrain only. Build them from a simplified collision mesh, not the render mesh.
- Triggers (doors, kill zones): `ColliderDesc...setSensor(true)` plus collision events, or keep simple pickups in logic with distance checks, as the template does for orbs.

## Two-phase tick with the character controller

Rapier's `KinematicCharacterController` resolves a desired movement against colliders (slopes, steps, sliding along walls). It doesn't apply gravity; logic does.

```ts
// engine/physics.ts, at load
const controller = world.createCharacterController(0.02); // skin offset in meters
controller.setUp({ x: 0, y: 1, z: 0 });
controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
controller.enableAutostep(0.3, 0.2, true); // max step height, min step width, include dynamic bodies
controller.enableSnapToGround(0.3);
controller.setApplyImpulsesToDynamicBodies(true); // shove crates

// engine/game.ts, inside the FixedStep callback
const intent = planMove(world, tickInput, dt);           // logic: desired { dx, dy, dz } this tick
controller.computeColliderMovement(playerCollider, { x: intent.dx, y: intent.dy, z: intent.dz });
const moved = controller.computedMovement();
const p = playerBody.translation();
playerBody.setNextKinematicTranslation({ x: p.x + moved.x, y: p.y + moved.y, z: p.z + moved.z });
rapierWorld.step();
applyMove(world, { ...moved, grounded: controller.computedGrounded() }); // logic: position, landed events, coyote
```

- `planMove` and `applyMove` are pure functions in `logic/` that take and return plain objects. Vitest can call them with made-up move results (blocked by a wall, landed) without Rapier.
- Store the authoritative player position in logic after `applyMove`, so saves and `debugSummary` don't read from Rapier.
- `computedCollision(i)` (with `numComputedCollisions()`) tells you what was hit, for "landed on enemy" or "touched hazard". Translate hits to entity ids and pass them in as data.

## Collision events

```ts
const events = new RAPIER.EventQueue(true);
world.createCollider(RAPIER.ColliderDesc.ball(0.5).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
world.step(events);
events.drainCollisionEvents((h1, h2, started) => { /* map collider handles to entity ids, queue for logic */ });
```

Keep a `Map<ColliderHandle, EntityId>` built at spawn time. Feed the collected contacts into the next logic step as data, in the order Rapier reports them.

## Determinism

- The `rapier3d-compat` build is deterministic on one machine for the same inputs. Cross-platform determinism is only promised by the separate `-deterministic` builds (`@dimforge/rapier3d-deterministic-compat`), which are slower. Whether a 0.21.0 deterministic build is published wasn't checked for this guide.
- Local runs are arm64 macOS and CI is x86 Linux, so scenarios that assert on physics-driven positions use tolerances: `toBeCloseTo(x, 1)` or rounded values in `debugSummary`, as the template rounds crate positions to two decimals in `debugState`.
- Create bodies in a fixed order from logic data (spawn lists), never by iterating a `Set` whose order depends on runtime history.
- Physics state isn't in saves. On load, rebuild from logic (positions of saved props). `world.takeSnapshot()` / `RAPIER.World.restoreSnapshot(bytes)` exist for in-memory rewinds, not for save files: the bytes are tied to the Rapier version.

## Camera rig

The template's `CameraRig` is a fixed-offset follow camera, smoothed once per tick in `tick()`. A polished third-person camera adds the following.

**Frame-rate independent smoothing, advanced per tick.** Update the camera's target state in the tick (visual-only state, deterministic) and interpolate when rendering:

```ts
// per tick, engine state
rig.goal.copy(playerPos).add(rig.offset);
rig.pos.lerp(rig.goal, 1 - Math.exp(-rig.lambda * TICK_DT)); // lambda ~ 8-12 for a snappy follow
// per render
camera.position.lerpVectors(rig.prevPos, rig.pos, alpha); // alpha = testMode ? 1 : step.alpha
```

That makes `arcade see --at 120` show the same framing whether the harness called `advance(120)` once or `advance(1)` 120 times. The template does the per-tick half and renders the latest position without interpolation, which matches its uninterpolated player mesh.

**Camera-relative movement.** Rotate the input vector by the camera's yaw so "up" on the stick moves away from the camera. If the player can orbit the camera, yaw is gameplay input: keep `cameraYaw` in logic, change it from input actions in the tick, and have the rig render from it. Pointer-drag look is planned for `@arcade/input`, not built.

**Collision.** Cast from the look-at point toward the desired camera position (`world.castRay(new RAPIER.Ray(origin, dir), maxToi, true)` or `castShape` with a small sphere) and pull the camera in to the hit distance minus a margin. Ease back out more slowly than you pull in.

**Comfort.** Look slightly ahead of the player in the movement direction and above the head. Keep the horizontal FOV reasonable on narrow portrait screens: recompute vertical FOV from a target horizontal FOV when the aspect ratio drops below about 1. Never roll the camera. Under reduced motion, cut camera shake and slow or remove automatic rotation.

## Render interpolation

`FixedStep.alpha` is the fraction of a tick left in the accumulator. At 60 Hz ticks on a 120 Hz screen, rendering only the latest tick shows each position twice and stutters. Keep the previous tick's positions for moving things (player, camera, dynamic props) and render `lerp(prev, current, alpha)`. In test mode render the current state (`alpha = 1`). The template doesn't do this yet. Add it when motion looks uneven on high-refresh screens.

## Character feel checklist

Jump buffering, coyote time, variable jump height, acceleration curves and landing feedback are logic concerns. See the `game-feel` skill. For 3D specifically:

- Turn the visual model toward its velocity with damping. The capsule doesn't rotate.
- Ground snapping (`enableSnapToGround`) so running down slopes doesn't become a series of small falls that fire `player.landed` repeatedly.
- A blob shadow or a ground marker under the player in the air: depth is hard to read in 3D without it.
