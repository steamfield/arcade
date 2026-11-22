---
paths:
  - "games/*/src/logic/**"
  - "templates/*/src/logic/**"
---

# Game logic (`src/logic/`)

This code is the game's rules. It runs in Vitest without a browser and in the shell's test mode, tick by tick.

- Pure TypeScript. Imports only `@arcade/core`, `zod` and other files in `logic/`. No engines, no DOM, no `@arcade/input`/`save`/`shell` (Biome and `tsconfig.logic.json` enforce this).
- Time is the `dt` passed to the step function (always `TICK_DT`) and tick counts. Delays, cooldowns, coyote time, buffers and hit-stop are tick counters in state. No clocks.
- Randomness comes from `createRng(seed)`. Store the rng state (`rng.state()`) in the save if a resumed game must continue the same sequence.
- Input arrives as plain data (`TickInput`). Physics results from the engine arrive as plain data too (positions, grounded, contacts).
- Everything observable is a typed event in `events.ts`, emitted through the `EventSink`. Tests, `arcade see` and the engine's effects all read events. Emit on the tick it happens, once.
- Save shape lives in `save.ts`. Any change bumps `SAVE_VERSION`, adds `migrations[old]`, and commits `tests/fixtures/save-v<old>.json` captured from the old code.
- Keep `summarize()` small and stable (it's what scenarios assert on) and, for tile games, `toAscii()` current.
- Every rule change gets a Vitest test through `createWorld`/`stepWorld`, with small inline levels and edge cases at exact ticks.
- Feel techniques that change outcomes belong here; see the `game-feel` skill.
