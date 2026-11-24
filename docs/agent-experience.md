# Agent experience

How an agent working here verifies its own change: the `arcade` CLI, the test harness and the guardrails. Companion to [architecture.md](architecture.md). The commands an agent runs, and when, are in `AGENTS.md`; this doc explains how they work and why.

An agent can't watch a game run or hear it, and every line of tool output costs it context. So the tooling is built around four ideas:

- **Short output, details on disk.** Commands print one line on success and the failures otherwise; screenshots, state and logs go to files.
- **Deterministic games.** The harness steps the game tick by tick, randomness is seeded, and the harness waits for loads. The same input always gives the same state.
- **Silent failures fail loudly.** Game errors, console errors, failed requests and dropped events fail the run.
- **Rules that give instructions.** Each lint and type rule says what to do instead.

## The inner loop

1. Edit code.
2. `pnpm arcade test <slug> <paths or @groups>` and `pnpm arcade check <slug> --skip-tests`: the tests covering the change, then typecheck and lint.
3. `pnpm arcade see <slug> --scenario <name>`: a headless run to a known state. The agent reads the screenshot and the summary.
4. At the merge, once, by whoever merges: `pnpm arcade check <slug>` (every unit test), any slow project the game defines, and `pnpm arcade smoke <slug>`. Subagents stop at step 3 (AGENTS.md "Test scope").

CI runs the same `arcade` commands, so "passes locally" and "passes in CI" mean the same thing.

| Command | What it does |
| --- | --- |
| `arcade check [slug] [--all] [--skip-tests] [--base <ref>]` | Biome over the repo and, in parallel, Turbo `typecheck` and `test` for the game plus every package changed since HEAD and its dependents (`--filter=...[HEAD]`). `--base` checks what changed since a commit, as CI does. One line on success, saying how many tasks came from Turbo's cache. |
| `arcade test <slug> [paths \| @group] [-t name] [--project name]` | One game's Vitest run, narrowed. See "Running tests". |
| `arcade see <slug> [opts]` | Headless run to exact ticks, then capture. See "Seeing the game". |
| `arcade smoke [slug]` | Production build, `assemble`, one `wrangler dev` serving the site and the API Worker, then each game's Playwright suite against it. Also enforces Cloudflare's file-count and file-size limits. |
| `arcade affected --base <ref> [--json]` | Which packages and games the commits since `<ref>` need tested, or "everything" with the file that forced it. CI's job matrices come from `--json`. |
| `arcade attract <slug>` | Records the landing page's `public/attract.mp4` and `public/cover.png` from a scenario. See "Attract footage". |
| `arcade dev <slug> [--port n]` | Vite dev server for one game. |
| `arcade new <slug> --template phaser-2d\|three-3d [--title]` | Copies a template, renames it, formats the copy, adds the game to `.claude/launch.json` and installs. |
| `arcade assemble [--include ...]`, `arcade list` | Build the deployable `dist/`; list games and templates with their status. |

Plain `package.json` scripts cover the rest: `pnpm fix` (Biome safe fixes and formatting), `pnpm test:update` (snapshots, only ever run deliberately; `check` never passes `-u`), `pnpm deploy:api`.

Output is kept small. `pnpm arcade` is a bin, so pnpm adds no echo or ELIFECYCLE lines. Biome uses its one-line GitHub reporter, and formatting issues collapse into one "run pnpm fix" line. Vitest uses the `dot` reporter, Playwright `line`, and Turbo `--output-logs=errors-only`, grouped by package with repo-relative paths. Duplicate problems (one exception seen as a page error, a console error and a game error) are reported once. Ports are never fixed: servers take a free one from `freePort()` in `@arcade/testing`.

## Determinism

`see`, scenarios and smoke tests only mean something if the same inputs give the same state every time. The shell owns stepping in test mode (`?test=1`, or the flag the harness sets):

- **Ticks are the unit.** A "frame" in every CLI option, scenario and assertion is one fixed logic tick, 1/60 s.
- **Shell-owned stepping.** The engine's own loop keeps running but only renders. Logic advances only through `__arcade.advance(n)`, which stops early when the game stops being idle (a scene, asset or art chunk loading), and the driver waits for `idle()` before continuing. Load timing therefore never changes which tick something happens on. Playwright's fake clock isn't used. Screenshots wait two animation frames so they show the latest state.
- **One clock per game.** The 2D template keeps tile physics in `src/logic/`. A Phaser game that wants arcade physics sets `arcade.customUpdate: true` and calls `physics.world.singleStep()` once per logic tick, never from Phaser's loop.
- **Seeded randomness.** It comes from `createRng(seed)` in `@arcade/core`. `Math.random`, `Date.now` and `new Date()` are lint errors in `src/logic/` and `src/net/`.
- **Semantic assertions.** Scenarios assert on scene, counts, status and events, or on positions with tolerances, never raw floats.
- **A world hash.** Both templates and Rush Racers put `worldHash` (`hashState` from `@arcade/core` over logic state) in `debugState()`, and smoke pins one hash for a fixed input across desktop Chromium and the phone project, plus WebKit for Phaser (2D) games only (`browserProjects` in `packages/testing/src/playwright.ts` adds it only for them). Rush Racers' lockstep races depend on it holding bit for bit, which is why its logic also bans inexact `Math` (`tools/biome/no-inexact-math.grit`).

## Seeing the game

### `arcade see`

```
pnpm arcade see phaser-2d --scenario complete-level --at 0,180,end
```

Each run opens its own session through `openGameSession` (`packages/testing/src/game-session.ts`): a Vite server in test mode from the current worktree on a free port, headless Chromium with `CHROMIUM_ARGS`, and a `GameDriver` page. `close()` stops all of it, even when a step fails. Then `see` loads the scenario's start save through `__arcade.loadState()`, waits for `idle()`, plays the input and advances to each requested tick.

It writes a run folder, `.arcade/runs/<timestamp>-<slug>/` (the 50 most recent are kept) or `--out <dir>` (kept until deleted). The summary's first line, `run:`, is its absolute path; use that rather than `.arcade/runs/latest`, which another agent in the same checkout can repoint. In the folder:

- **`summary.txt`**, also printed: the renderer, the game's `debugSummary()` at each captured tick, event counts, deduplicated console warnings, PROBLEMS, the scenario verdict, and the file list. The renderer line matters: a black screenshot from a headless WebGL failure otherwise looks like a bug in the agent's code.
- **`frame-<tick>.png`** per capture, at CSS pixel size, plus `frames.png`, a contact sheet, when there are several. `--crop x,y,w,h` zooms in.
- **`state.json`** (the full `debugState()`), **`events.jsonl`** and **`console.log`**.
- **`diff-<tick>.png`** with `--compare <dir>`: changed pixels in red against an earlier run's frames.

Options: `--scenario`, `--input "<steps>"`, `--at`, `--seed`, `--scene`, `--debug`, `--mobile` (phone viewport and touch controls), `--viewport WxH` (desktop size, default 960x540), `--query k=v` (repeatable launch parameters), `--ascii`, `--field <path>`, `--events <type>`, `--crop`, `--out`, `--compare`. `pnpm arcade help` has the details. `see` exits non-zero when a scenario's expectations fail or the run had any problem.

### Attract footage

`arcade attract <slug>` plays the scenario named in the game's package.json `arcade.attract` (`scenario`, `from`, `to`, `every`, `cover`), screenshots every `every` ticks through the same session `see` uses, and encodes `public/attract.mp4` and `public/cover.png` with ffmpeg. The footage is deterministic, so rerunning it after a look change gives a reproducible loop.

### Launch parameters and the test hook

The shell reads `?seed=`, `?scene=`, `?debug=1`, `?test=1`, `?touch=1` and `?log=` (a level or namespace filter). Games add their own: both templates take `?stage=<name>` (only with `?debug=1` or in test mode), which puts the world in a known state right after it is built for a capture and never saves the result. Scenarios pass these through `start.query`; save fixtures go through `__arcade.loadState(obj)`, not the URL.

`window.__arcade` is write-capable: `start`, `advance`, `idle`, `events(cursor)`, `debugState`, `debugSummary`, `renderer`, `loadState`, `inject`, plus `errors` and `logs`. It ships in every build because smoke runs on the production build. In a free arcade a player using it to skip content harms no one; a game with a leaderboard would have to validate scores on the server anyway.

### Text views

For tile games, `logic/` exposes `toAscii(world)`. Unit tests assert on it, `see --ascii` prints it, and its diffs are easy to read. Small levels are authored as ASCII, which agents write more reliably than Tiled JSON. 3D games give the same information through `debugSummary()`: position, grounded flag, counts. With `?debug=1` the 2D template outlines the player's body.

## Silent failures, made loud

- **Errors:** the shell catches `error` and `unhandledrejection`, records them in `__arcade.errors` and shows a red banner on the page. Games report what isn't an exception through `ctx.reportError(source, error)`: both templates report a lost WebGL context, the 3D template a failed Rapier load, Rush Racers failed audio and a course-art chunk that won't load.
- **The `game` fixture** (`@arcade/testing/playwright`) fails any test that logged a console error, had a failed request, reported a game error or dropped events, and attaches the console log. When it can't read `__arcade.errors` from an open page, that is a problem too.
- **Events:** the driver drains the event log with a cursor after every step, and a run fails if the ring buffer dropped any, so "fired once" is never judged on a truncated log.
- **Renderer:** each template's smoke asserts the renderer (`webgl` for Phaser, `webgl2` for three.js), so a silent Canvas fallback fails.

## Logs and events

`@arcade/core` provides `createLogger('ns')`. Logs go to a sink the shell installs, because `console` isn't part of the no-DOM logic environment and `noConsole` bans it in game and package source. Lines are namespaced and filterable with `?log=debug` or `?log=<namespace>`; under Playwright they land in `console.log`.

Domain events record what happened in the game, and tests assert on them (`coin.collected`, `save.written`, `menu.selected`). Logic emits typed events; the engine adds its own.

## Guardrails

Every rule exists because agents make that mistake, and every message says what to do instead.

TypeScript (`packages/config/tsconfig.base.json`): `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Each game's `tsconfig.logic.json` compiles `src/logic/` (and `src/net/` where it exists) with `lib` set to ES only and test files excluded, so `window`, timers and storage are type errors there. Logic may import only `@arcade/core` and Zod; save types such as `Migration` live in `@arcade/core` so logic never pulls in `@arcade/save`'s IndexedDB code.

Biome (`biome.json`):

| Rule | Scope | The message tells the agent |
| --- | --- | --- |
| `noRestrictedImports`: `phaser`, `three`, Rapier, `@arcade/shell`, `@arcade/save`, `@arcade/input` | `src/logic/`, `src/net/` | Logic is engine-free; rendering goes in `src/engine/` |
| `noRestrictedImports`: `@arcade/*/src` internals | game and template `src/`, logic included | Import from the package entry |
| `noRestrictedGlobals`: `localStorage`, `sessionStorage`, `indexedDB` | game and template `src/` | Use `@arcade/save` |
| GritQL `tools/biome/no-nondeterminism.grit`: `Math.random()`, `Date.now()`, `new Date()` | `src/logic/`, `src/net/` (not `src/net/transport/websocket.ts`) | Use `createRng` and the `dt` you were given |
| GritQL `tools/biome/no-inexact-math.grit`: `**`, `Math.pow`, `Math` members off an exact list | Rush Racers `src/logic/`, `src/net/` | Multiply, or use `src/logic/num.ts` |
| `noNonNullAssertion` | `src/logic/`, `src/net/` | Handle the missing case |
| `noConsole` | game, template and package `src/` | Use `createLogger` |
| `noSkippedTests`, `noFocusedTests` | test files and scenarios | Fix or delete the test |
| `noTsIgnore`, `noFloatingPromises` | everywhere | Fix the type; await or `void` the promise |

Tests in `tools/arcade/` guard the guardrails. They run in `@arcade/cli`'s test task, whose Turbo inputs include every file they read, so a cached `arcade check --all` reruns them when a rule, game source or doc they read changes:

- `guardrails.test.ts` lints probe files against a copy of `biome.json` and proves each ban fires and a near miss passes. It also resolves every relative import in `games/*` and `templates/*` and fails, naming file and specifier, when one leaves its own game or template folder (a glob in `biome.json` can't express that).
- `repo-map.test.ts` keeps `docs/repo-map.md` in step with the disk.
- `ci.test.ts` keeps CI's Playwright container on the catalog's Playwright version and checks that a run on main is never cancelled.

## Tests

| Layer | Tool | Covers |
| --- | --- | --- |
| Logic | Vitest | Rules and state through `createWorld`/`stepWorld`, ASCII views, save round-trip, every committed save fixture (`checkSaveFixtures`) |
| Runtime | Vitest | Both templates' Phaser- or three-free `src/engine/runtime.ts`: scene flow, save queue, capture-stage gate |
| Scenarios | Playwright, shell-stepped | Start state plus input plus semantic assertions on summary, state and events; also run by `see --scenario` |
| Smoke | Playwright on the assembled production build: desktop Chromium, a phone, and WebKit for Phaser (2D) games | Loads, no errors, right renderer, input, save survives reload, touch controls (`GameDriver.touch`), the pinned world hash |

Scenarios use one typed format for tests and `see`. Action names are typed per game, so a typo fails typecheck:

```ts
// templates/phaser-2d/scenarios/collect-first-coin.ts
export default scenario({
  description: 'starting a new game from the title and running right collects the first ground coin and autosaves',
  input: [...TITLE_TO_PLAY, hold('right', 120)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'play', coins: '1/9', player: { grounded: true } });
    expect(events.map((e) => e.type)).toContain('save.written');
  },
});
```

`start` takes `save`, `scene`, `seed` and `query`. Each game's `scenarios/kit.ts` holds its typed `scenario`, `hold`, `tap`, `wait` and shared presets (navigation such as `TITLE_TO_PLAY`, and save fixtures built from the current `SAVE_VERSION`). The CLI shorthand `--input "up*20 confirm right+jump"` parses into the same steps: `*n` holds for n ticks, a bare action is one tap, `+` presses actions together, `_*n` waits. A known bug is a scenario with `todo: true`: it runs and must still fail, and passing tells you to remove `todo`. A long scenario sets `slow: true` for Playwright's tripled timeout.

No sleeps anywhere: the harness waits on `ready`, `idle()`, ticks or events.

### Running tests

Agents prove a change with the tests that cover it, and the full suite runs once, before a merge (AGENTS.md "Test scope"). Several lanes building at once on one machine is why: each running the whole suite pushed a 5-second check past a minute and timed tests out.

`pnpm arcade test <slug>` takes repo- or game-relative paths, `-t <name pattern>`, and named groups from the game's package.json (`"arcade": { "testGroups": { ... } }`). A group is a path list, or `{ "project": "<name>", "paths": [...] }` for files in another Vitest project (Rush Racers' `@bars` runs the `difficulty` project). By default it runs the game's fast project, the one its `test` script names with `--project`; explicit `.test.ts`/`.spec.ts` files, `--project <name>` or a project group turn that off. A filter that matches no test fails, and an unknown group lists the defined ones.

A game splits slow tests into their own Vitest project with `defineGameConfig`'s `slowTests` option and declares them in package.json (`"arcade": { "ci": { "slow": { "script", "shards" } } }`), so CI runs them as a sharded job only when that game is affected.

`.rr.yaml` runs the same commands on remote hosts through rr: `rr test -- <slug> <paths>`, `rr check -- <slug>`, and `rr suite -- <slug>`, which splits a game's whole Vitest suite (every project) into four shards across hosts. The hosts have Node but not the repo's pnpm, so the config runs the pinned pnpm through an npx shim (`.rr-bin/`, ignored) and installs before each run. rr is for when this machine is busy with other agents, not a faster default: on an idle laptop the local suite was quicker.

## Context for agents

- `AGENTS.md` (imported by `CLAUDE.md`, so Claude Code and Codex read the same conventions): commands, layout, rules, versions, test scope, definition of done.
- `docs/repo-map.md`: every shared source file and what it's for, checked by a test.
- Each game's `DESIGN.md`: pitch, core loop, controls, scenes and launch parameters, kept short.
- `.claude/skills/`: `verify-game` (the check, see, smoke loop and how to read its output), `phaser-game`, `threejs-game` (version-specific gotchas), `game-feel`.
- `.claude/rules/`: `game-logic.md`, `game-engine.md` and `game-tests.md`, loaded when an agent touches the matching paths.
- `.claude/agents/game-reviewer.md`: a read-only reviewer for game changes.
- `.claude/launch.json`: each game's dev server for the in-app browser; `arcade new` adds each game it creates.

Two Claude Code hooks exist as scripts in `.claude/hooks/`, inactive until the owner registers them in a `settings.json`. `format.ts` (PostToolUse) runs `biome format --write` on the edited file with no output; format only, because safe fixes can delete an import the agent added for its next edit. `check-on-stop.ts` (Stop) runs `pnpm arcade check --skip-tests` when game, template, package, tool or app code changed, and blocks the stop once with the failure output.

## Assets

The 2D template draws placeholder textures at boot and the 3D template uses plain meshes, so gameplay can be built and tested before any art exists. Rush Racers draws its pixel art in code and loads each world's and theme's art as its own chunk when a screen first needs it. Imported assets are hashed and a missing file fails the build (AGENTS.md "Rules").

## Not built yet

- A CI report on weakened checks: added Biome and TypeScript suppression comments, changed snapshots, drops in test or scenario count.
- Repo rules in `check`: tooling from the catalog, exact engine pins, every game having a smoke script and scenarios. `game.json` is validated wherever it is read.
- Performance budgets per game (draw calls, heap, initial JS, asset size) and `see --perf`.
- A debug overlay beyond the 2D template's player outline (FPS, bodies, tile coordinates, labels), and none in the 3D template.
- Typed asset-key manifests generated from imports, and missing-texture warnings treated as errors.
- `audio.played` events from the engines and a smoke check that the AudioContext is running.
- Visual regression (`toHaveScreenshot`) for menus, HUD and the touch overlay.
- Pointer-drag look in `@arcade/input`.
