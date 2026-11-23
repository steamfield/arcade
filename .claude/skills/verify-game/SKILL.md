---

name: verify-game
description: The loop for checking that a change to a game in this repo works, using pnpm arcade check, see and smoke. Use after editing anything under games/, templates/ or packages/, when asked to verify, debug or "look at" a game, when a scenario or smoke test fails, or before reporting a game change as done.
---

# Verify a game change

You can't watch the game, so verify through three commands that print short summaries and write details to files. Run them in this order and read what they say before changing more code.

Prove a change with the narrowest tests that cover it: `pnpm arcade test <slug> <paths or @groups> [-t name]` runs only those Vitest files (well under a second per file), and `pnpm arcade check <slug> --skip-tests` gives typecheck and lint in about a second. Use them instead of `pnpm exec vitest`, `npx vitest` or `pnpm --filter ... exec vitest`. `arcade test` fails when a filter matches no test, so a typo can't pass silently, and an unknown `@group` lists the game's groups. The full `check` and `smoke` below are the pre-merge gate: run them when you merge, or when your brief asks, not after every edit (AGENTS.md "Test scope").

## 1. `pnpm arcade check <slug>` (seconds; before a merge)

Typecheck, lint and unit tests for the game, plus every package changed since HEAD and everything depending on it. Green prints one line. Red prints one line per lint error (`file:line rule message`) and the failing typecheck/test output grouped by package.

- "N file(s) need formatting": run `pnpm fix`, then check again.
- A lint message names the fix (use `createRng`, use `@arcade/save`, move rendering to `src/engine/`). Do what it says rather than suppressing it. `biome-ignore` and `@ts-expect-error` show up in review.

## 2. `pnpm arcade see <slug>` (2-5 s)

Runs the game headlessly in test mode to an exact state and captures it.

```
pnpm arcade see <slug> --scenario <name>                  # replay a saved scenario and check its expectations
pnpm arcade see <slug> --scene play --input "right*60 jump right*30"
pnpm arcade see <slug> --scenario <name> --at 0,30,end    # contact sheet of several moments
pnpm arcade see <slug> --input "forward*40" --mobile      # phone viewport + touch controls
pnpm arcade see <slug> --ascii                            # tile games: the map as text
pnpm arcade see <slug> --field world.player               # one value from debugState()
pnpm arcade see <slug> --scene race --query stage=guide   # extra launch params (a game's debug stages)
pnpm arcade see <slug> --scene title --at 0,120           # ticks past the input wait idle; no _*N padding needed
```

Before a change that must not alter visuals (a refactor, a new seam), capture a baseline with `--out .arcade/baseline-<name>/<capture>` from the old code, then rerun the same command with `--compare` on that folder. It prints `identical` or the changed pixel count per frame and writes `diff-<tick>.png` with changes in red. Runs under `.arcade/runs/` keep only the last 50, so baselines go through `--out`.

Read the printed summary first. It has the renderer, the game's `debugSummary()` at each captured tick, event counts, console warnings and PROBLEMS. Then open `.arcade/runs/latest/frames.png` (or `frame-<tick>.png`) with your image tool to judge the visuals. `--crop x,y,w,h` zooms into a region when pixel art is too small to read. `state.json` and `events.jsonl` have the full detail.

How to read results:

- **`renderer: canvas` or `none`:** WebGL failed. It is not your code's rendering.
- **A PROBLEMS line:** there was a console error, a failed request, a game error or dropped events. Fix that first; it will also fail smoke.
- **A black or empty frame with no problems:** the scene probably hasn't rendered. Check `scene` in the summary.
- **Visuals vs state:** state is authoritative. Pixels show what a player sees (layout, readability, feel). Assertions belong on state and events.

When `see` reproduces a bug, copy the input into `scenarios/<bug-name>.ts` with `todo: true` and an `expect` describing correct behavior. It is then a failing regression test. Remove `todo` when it's fixed.

## Playing the user's dev server

When the user has the game open from `pnpm arcade dev` (or the preview pane), that tab's save is theirs. Don't drive it with synthetic key presses to test something: inputs on the same tick can be dropped, and a menu press lands in their real settings (it once flipped a player's difficulty to Hard). Verify with `see` or a scenario, and if you must use a browser, open a fresh tab with `?test=1` or a different port.

## 3. `pnpm arcade smoke <slug>` (10-30 s; before a merge)

Production build, assembled the way Cloudflare serves it, under `wrangler dev`. Runs the game's Playwright suite (scenarios plus `tests/smoke.spec.ts`) on desktop Chromium, a phone, and WebKit for 2D games. This catches wrong base paths, missing assets and Safari-only failures that dev mode hides. Run it before a merge, or before handing back work nobody else will merge.

Failure output shows Playwright's assertion diff. Traces and screenshots are in `<game>/test-results/`.

## Determinism rules (why runs repeat exactly)

- **Ticks:** in test mode the shell drives fixed 1/60 s ticks through `__arcade.advance()`. The engine's own loop only renders.
- **Loads:** `advance()` stops when the game isn't idle (a scene or asset is loading), and the driver waits for `idle()` before continuing. Load timing therefore never changes the result.
- **Seeds:** randomness comes from `createRng(seed)`. Pass `--seed` to try another layout.

A scenario that passes sometimes and fails sometimes is a determinism bug in the game: something reads a clock, uses `Math.random`, or ticks logic from the render loop. Find it; don't retry until it's green.

## Writing or fixing tests

- **Logic behavior:** Vitest in `src/logic/*.test.ts`, through `createWorld`/`stepWorld`, with small inline ASCII levels.
- **Whole-game behavior:** a scenario in `scenarios/`.
- **Load, render, input, save and touch:** `tests/smoke.spec.ts`. Touch-only tests get `@touch` in the title and run in the phone projects.
- **Watching a test fail:** break the behavior, confirm the test fails with a useful message, then restore it from a copy. Don't undo the change with a sed in reverse.
