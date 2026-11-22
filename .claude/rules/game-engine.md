---
paths:
  - "games/*/src/engine/**"
  - "games/*/src/main.ts"
  - "templates/*/src/engine/**"
  - "templates/*/src/main.ts"
---

# Game engine layer (`src/engine/`)

This code renders logic state, feeds it input, and runs engine-side physics. Check the game's `game.json` `engine` and load the matching skill before non-trivial changes: `phaser-game` (Phaser 4.2.1) or `threejs-game` (three.js r187 + Rapier 0.21). Your memory of both APIs is older than these versions.

- Logic changes only inside the `FixedStep` callback. In test mode (`ctx.params.testMode`) the engine's own loop must not tick logic; the shell calls the handle's `advance(ticks)`, which renders once afterwards.
- Engine clocks (Phaser `time`/tweens, physics callbacks, `performance.now`, `THREE.Timer`) may drive visuals only, never gameplay.
- Input: read `@arcade/input` actions in the tick (`input.update()` first) and pass plain data into logic. No engine keyboard or pointer handlers for gameplay.
- Saves: only through the `SaveStore` passed in. Never `localStorage`/`indexedDB`.
- Assets: import them (`?url` for JSON, maps, models) and key them through typed consts. Route loader, decode and context-loss errors to `ctx.reportError`. Keep `idle()` false while anything loads.
- The canvas fits `ctx.container`, which the shell sizes and pads for safe areas. Don't size the canvas from `window`.
- Effects (shake, particles, sounds) fire from drained logic events and keep their own visual state; see `game-feel`.
- Logging through `createLogger`, not `console`.
- Keep `debugSummary()` small and add fields that new scenarios need.
- Verify with `pnpm arcade see <slug>` (and `--mobile` for HUD or controls) before claiming a visual change works; see `verify-game`.
