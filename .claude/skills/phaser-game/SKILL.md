---
name: phaser-game
description: Build, extend or review a Phaser 4 game in this repo (game.json engine set to phaser, or templates/phaser-2d). Use when writing or changing Phaser scenes, sprites, atlases, Tiled tilemaps, cameras, audio, pixel-art scaling or the HUD, when porting Phaser 3 examples, or when a Phaser API from memory might be out of date. Covers how Phaser fits the logic/engine split and the shell's test mode, Phaser 4 changes agents get wrong, asset imports, and a review checklist. Points to Phaser's own bundled skills for API detail.
---

# Phaser 4 games in this repo

Phaser here is pinned to 4.2.1 per game. Your memory is mostly Phaser 3. Treat any Phaser API you recall as suspect until you've checked it against the bundled skills or `node_modules/phaser/types/phaser.d.ts`.

For the change-check-see loop, use the `verify-game` skill. For game feel, juice, accessibility and mobile, use `game-feel`. This skill covers Phaser itself.

## 1. Read Phaser's bundled skills for API detail

Phaser 4.2.1 ships agent skills written against its own source. They are accurate for this version and this file doesn't repeat them. From a game directory they are at `node_modules/phaser/skills/<name>/SKILL.md`:

| Task | Bundled skill |
| --- | --- |
| Any code you remember from Phaser 3 | `v3-to-v4-migration`, `v4-new-features` |
| Scene lifecycle, restart, shutdown cleanup | `scenes` |
| Loader, atlases, audio, bitmap fonts | `loading-assets` |
| Tiled maps, collision tiles, object layers | `tilemaps` |
| Camera follow, bounds, deadzone, effects | `cameras` |
| Sprites, frame animation, Aseprite | `sprites-and-images`, `animations` |
| Text vs BitmapText | `text-and-bitmaptext` |
| Particles, tweens, timers | `particles`, `tweens`, `time-and-timers` |
| Glow, blur, masks, vignette | `filters-and-postfx` |
| Arcade bodies, colliders | `physics-arcade` |
| Sound manager, unlock, iOS | `audio-and-sound` |

Read the relevant one before writing code in that area, and read its "Gotchas" section first. Where a bundled skill conflicts with this file about how things fit together in this repo (game loop, input, scaling, saves), this file wins. Where it's about a Phaser API, the bundled skill wins.

## 2. How Phaser fits this repo

The template's `src/engine/game.ts` is the reference. Its shape:

- A `Runtime` object owns the `EventLog`, a `FixedStep` from `@arcade/core`, the current scene key, the logic `World`, and save state. Scenes get it through their constructor.
- **Logic ticks only inside `FixedStep`'s callback.** Each scene's `update(time, delta)` calls `rt.frame(delta)`, which feeds wall time to `FixedStep.frame()` only when `!ctx.params.testMode`. In test mode the shell calls the handle's `advance(ticks)`, which calls `rt.step.advance(1)` per tick.
- **Phaser's own loop renders.** Scenes read logic state in `update()` and sync game objects to it (`sync()` in `PlayScene`). They never decide gameplay.
- `rt.goTo(scene)` sets `loading = true` until the new scene's `create()` calls `rt.entered(scene)`. `idle()` is `game.isBooted && !rt.loading`, so `advance()` stops at scene changes and the harness waits. Keep that contract for every new scene, including ones that load assets in `preload()`.
- `startPhaser(ctx, saves)` returns the `GameHandle` (`advance`, `idle`, `renderer`, `debugSummary`, `debugState`, `loadState`, `pause`, `resume`, `onHide`). See `GameHandle` in `packages/shell/src/index.ts`.

```ts
// Gameplay that depends on time: count ticks in logic.
if (world.respawnTicks > 0 && --world.respawnTicks === 0) respawn(world);

// Not this: Phaser's clock isn't the logic clock, so tests and saves diverge.
this.time.delayedCall(500, () => respawn(world));
```

What that rules out:

- **Phaser time, tweens and physics never change logic state.** `this.time.delayedCall`, tween `onComplete` callbacks and Arcade overlap callbacks must not mutate the world. They run on Phaser's clock, which isn't the logic clock in test mode.
- **No Phaser input for gameplay.** Read `input` from `src/engine/input.ts` (`@arcade/input`) inside the tick: `input.update()` first, then `isDown`, `justPressed`, `vector`. Pass plain data into logic, as `stepWorld(world, { move, jumpPressed, jumpHeld }, dt)` does. Scenarios inject at the action level, so a `this.input.keyboard` path is invisible to them. Tap-to-select menus are planned for `@arcade/input` but not built; don't add a parallel Phaser pointer path for gameplay or menus without raising it first.
- **No `Phaser.Math.Between`, `RND`, or `Math.random` for anything logic reads.** Use `createRng(seed)`. Cosmetic randomness in `engine/` (particle spread) may use Phaser's RNG.
- **No storage.** Saves go through the `SaveStore` passed to `startPhaser`.

### Arcade physics, if you need it

The template has no Arcade physics: collision is tile AABB code in `src/logic/world.ts`, unit tested in Vitest. Keep that for platformers and tile RPGs. It's deterministic, testable without a browser, and saves are plain data.

If a game needs many moving bodies (bullets, debris) where engine-side physics pays off, put Arcade under the same clock:

```ts
// Game config: Phaser must not step the world on its own.
physics: { default: 'arcade', arcade: { customUpdate: true, fps: 60, gravity: { x: 0, y: 0 } } },

// In Runtime.tick(dt), after stepWorld and before reading contacts:
playScene.physics.world.singleStep(); // one step of 1/fps; postUpdate syncs game objects
```

`customUpdate: true` stops the scene's UPDATE event from stepping the world. `singleStep()` (since 3.70, present in 4.2.1) runs exactly one 1/60 step and syncs bodies. Then translate contacts into plain data for logic. Anything that should be in a save or asserted in a scenario must be in logic state, not only on a body. Verify with `arcade see` that the result repeats across runs.

## 3. Phaser 4 changes agents get wrong

| Phaser 3 habit | Phaser 4.2.1 |
| --- | --- |
| `sprite.preFX.addGlow()`, `postFX` | `sprite.enableFilters()` then `sprite.filters.internal.addGlow(...)` or `filters.external` |
| `new BitmapMask(...)`, `setMask` | `obj.filters.internal.addMask(maskObject)` |
| `setTintFill(c)` | `setTint(c).setTintMode(Phaser.TintModes.FILL)` |
| `setPipeline('Light2D')` | `setLighting(true)`; lights have a `z`. Cone lights are new in 4.2 |
| `this.textures.generate`, `Create.GenerateTexture` | Removed. Draw with `Graphics` and call `generateTexture` (see `src/engine/textures.ts`) |
| `Geom.Point` | `Phaser.Math.Vector2` |
| `Math.TAU` meaning PI/2 | `TAU` is now 2π; use `Math.PI_OVER_2` for the old value |
| `roundPixels` default true | Defaults to false. `pixelArt: true` turns it back on |
| `Phaser.Struct.Set` / `Map` | Native `Set` / `Map` |
| `Mesh`, `Plane`, Camera3D plugin | Removed. 4.2 adds a 2D `Mesh2D` |
| Drawing into a `RenderTexture` and seeing it right away | Draw calls are buffered; call `rt.render()` |
| `this.add.particles(key).createEmitter(cfg)` | `this.add.particles(x, y, key, cfg)` returns the emitter (changed in 3.60) |
| Custom WebGL pipelines, raw `gl` calls | Render nodes; never touch `gl` directly |
| Canvas renderer as a target | Deprecated. Filters and lighting are WebGL only, and smoke asserts `webgl` |
| Compressed textures from v3 | Must be re-encoded with Y flipped (GL orientation) |

## 4. Config, scaling and pixel art

Copy the template's `new Phaser.Game({...})`:

- `type: Phaser.AUTO`, `parent: ctx.container`, `banner: false`, a fixed logical `width`/`height` (the template uses 320x180).
- `scale: { mode: Phaser.Scale.NONE }` plus a `ResizeObserver` on `ctx.container` that calls `game.scale.setZoom(integerScale(WIDTH, HEIGHT, ctx.container))`. `integerScale` is exported by `@arcade/shell`.
- `pixelArt: true` for pixel art. It sets nearest filtering, turns antialiasing off and `roundPixels` on.

Don't switch to `Scale.FIT`, `ENVELOP` or `RESIZE` with `parent: ctx.container`. The shell puts safe-area padding on the container, and Phaser's ScaleManager ignores parent padding (gotcha 2 in the bundled `scale-and-responsive` skill). Fractional zoom also makes pixel art shimmer. For smooth (non-pixel) art, keep `Scale.NONE` and either set a fractional zoom from the container size or `game.scale.resize(w, h)` for a layout that adapts.

Pixel-art rules:

- Pick one base resolution and keep every asset at 1x on that grid. Don't scale individual sprites by non-integer amounts.
- Positions passed to sprites come from logic floats; round them when syncing (`Math.round(world.player.x)`, as `PlayScene.sync()` does). Camera follow with `roundPixels` (`startFollow(target, true)`) avoids sub-pixel jitter.
- Small `Text` at 320x180 rasterizes blurry or blocky after zoom. Use `BitmapText` with a pixel font, or a DOM HUD layer (section 6).
- Atlases for pixel art need 1-2 px extrusion or padding per frame, or neighbours bleed at some zoom levels.

## 5. Assets

Every asset is imported so Vite hashes it, follows `base`, and fails the build if it's missing. Keys come from a typed const, never string literals. Full patterns (atlases, Aseprite, Tiled, audio, fonts) are in [references/assets.md](references/assets.md).

```ts
import heroPng from '../assets/hero.png';
import heroJson from '../assets/hero.json?url';

export const Tex = { hero: 'hero' } as const;

preload() {
  this.load.on('loaderror', (file: Phaser.Loader.File) => this.rt.ctx.reportError('loader', `${file.key} ${file.url}`));
  this.load.atlas(Tex.hero, heroPng, heroJson);
}
```

- Never `setBaseURL`/`setPath` on the loader; imported URLs are already absolute and under `/games/<slug>/_v/`.
- `loaderror` must reach `ctx.reportError`, or a 404 shows up as a missing-texture warning instead of a failure. Audio decode errors don't emit `loaderror`. Phaser logs them with `console.error`, which the test driver already treats as a failure.
- Only load what the first scene needs before the title screen. Later scenes load in their own `preload()`, and `idle()` must stay false until `create()`.
- Placeholder textures from `createPlaceholderTextures` stay valid. Replacing one with real art means loading an image under the same key.

## 6. Scenes, HUD, cameras, audio

**Scenes.** Keep one scene per game mode (boot, title, play, pause overlay, dialogue). Reset per-run state in `create()` or `init()`, not the constructor; the template constructs scenes once with `rt`. Clean up listeners on `this.events.once('shutdown', ...)`. Scene changes go through `rt.goTo` so `loading` and `scene.started` stay correct. Running a HUD or pause scene in parallel (`scene.launch`) is fine; it renders and reads `rt`, but it doesn't tick logic.

**HUD and text.** HUD objects use `setScrollFactor(0)`. Update text only when the value changes; each `Text#setText` re-rasterizes a canvas and re-uploads a texture (bundled `text-and-bitmaptext` gotcha 1). For menus and longer text, a DOM layer appended to `ctx.container` gives crisp, scalable, screen-reader-visible text. Keep it in `engine/`, set `pointer-events: none` unless it's interactive, and keep it clear of the shell's back link (top right) and the touch overlay (bottom corners).

**Cameras.** `this.cameras.main.setBounds(0, 0, mapW, mapH).startFollow(player, true)` as in the template. Add `setDeadzone(w, h)` for platformers so small movements don't scroll the view, and a small lookahead in the facing direction (`setFollowOffset`). Camera shake, flash and fade are visual only: trigger them from logic events (see `game-feel`), and gate shake and flash on the reduced-motion setting.

**Audio.** Phaser uses Web Audio by default, which is what the repo wants. After boot, register its context so the shell can resume it after iOS interrupts it:

```ts
game.events.once(Phaser.Core.Events.READY, () => {
  if (game.sound instanceof Phaser.Sound.WebAudioSoundManager) ctx.registerAudioContext(game.sound.context);
});
```

Play sounds from logic events (drain the `EventLog`, see `game-feel`), never from inside logic. The sound manager is global: stop looping music on scene shutdown yourself. The AX plan calls for an engine audio adapter that emits `audio.played { key }` once playback has actually started, so tests can "hear" the game. Neither template has one yet; add it when you add the game's first sound.

## 7. Debug views

- `debugSummary()` is small and stable: scene, status, counts, the player's tile. It's printed by `arcade see` and asserted in scenarios.
- `debugState()` can be big: full logic state plus `ascii` for tile games (`toAscii(world)`), which `arcade see --ascii` prints.
- Debug stages make rare moments reviewable: `?stage=<name>`, honoured only with `?debug=1` or in test mode, writes plain world state right after the world is built (an item in the player's stack, a rival mid-attack, the player at a hard spot) and marks the run so it never saves. Keep the gate a pure function of the launch params and the stage names in one exported list, as in `games/rush-racers/src/engine/capture-stages.ts`. A stage that needs a level feature throws an error naming it when the level has none. Scenarios reach a stage with `start.query`, and `arcade see` with `--query stage=<name>`. Add a stage whenever a new level or feature has a moment a seed rarely reaches.
- `?debug=1` (`ctx.params.debug`) shows an overlay: hitboxes from logic state, tick and tile. Draw it from logic data, not from Phaser bodies, so it shows what logic believes.

## 8. Pitfalls seen in practice

- Calling `rt.frame()` from more than one active scene's `update()` runs `FixedStep.frame` twice per frame and doubles game speed. Only one scene per frame should feed it.
- `this.scene.start()` is queued, not immediate. Don't read the new scene's objects in the same frame.
- Animations are global (`this.anims.create` once, in boot). Recreating them per scene logs warnings that clutter `arcade see`.
- `this.sound.play(key)` is fire and forget. Use `this.sound.add` for anything you need to stop.
- Tweens and timers left running on a shut-down scene's objects throw on restart. Kill them in the shutdown handler.
- Tiled: the tileset name passed to `addTilesetImage` must match Tiled exactly, and tilesets must be embedded in the map JSON. Mismatches return `null` with only a console warning.
- `Phaser.WEBGL` has no fallback and fails silently. Keep `AUTO`; smoke asserts `renderer() === 'webgl'`.

## 9. Checklist before handing back

- [ ] Gameplay rules, timers, randomness and collision live in `src/logic/` and have Vitest coverage; the engine only reads state and forwards input.
- [ ] Nothing in `engine/` mutates the world outside the `FixedStep` callback. Test mode doesn't tick from Phaser's loop.
- [ ] No Phaser 3 APIs from section 3. Typecheck passes against Phaser's own `.d.ts`.
- [ ] Every asset is imported, keyed through a typed const, and loaded with `loaderror` routed to `ctx.reportError`.
- [ ] New scenes keep `idle()` false until `create()` has run and call `rt.entered()`.
- [ ] Pixel art: integer zoom, `pixelArt: true`, rounded positions, extruded atlases, legible HUD text at 1x.
- [ ] Audio context registered with the shell; sounds triggered from events; music stops on scene shutdown.
- [ ] `debugSummary` has the fields new scenarios assert on, and a scenario covers the new behavior.
- [ ] `pnpm arcade test <slug>` on the tests covering your files and `pnpm arcade check <slug> --skip-tests` pass, and `see` on the changed scene (desktop and `--mobile`) looks right. Whoever merges runs the full `check` and `smoke` (`verify-game`, AGENTS.md "Test scope").
