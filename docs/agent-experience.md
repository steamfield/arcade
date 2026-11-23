# Agent Experience (AX) Plan

Status: revised after devil's-advocate review. Companion to [architecture.md](architecture.md).

## TL;DR

Most of the code here will be written by agents. An agent working on a game can't watch it run or hear it, and every line of tool output costs it context. The foundation should remove those handicaps before the first game exists:

- **One CLI with three core commands.** `check` is fast, quiet and includes every game a change can affect. `see` runs a game headlessly to an exact state and writes a screenshot, state, events and console log to disk. `smoke` tests the production build.
- **Deterministic games.** The test harness steps the game tick by tick, randomness is seeded, and the harness waits for asset loads. The same input always gives the same state.
- **Silent failures fail loudly.** Loader errors, unknown asset keys, a lost WebGL context, a dropped event and a weakened test all make the run fail.
- **Lint and type rules give instructions.** Each message tells the agent what to do instead.

The test for every item below: does it let an agent find out whether its change actually worked, without a human opening a browser and without a misleading green result?

## The inner loop

1. Edit code. A hook formats the file.
2. `pnpm arcade test <slug> <paths or @groups>` and `pnpm arcade check <slug> --skip-tests`: the tests covering the change, then typecheck and lint. Quiet on success, short on failure. Seconds.
3. `pnpm arcade see <slug> --scenario <name>`: a headless run to a known state. The agent reads the screenshot and the state summary.
4. At the merge, once, by whoever merges: `pnpm arcade check <slug>` (every unit test), any slow project the game defines, and `pnpm arcade smoke <slug>`, the production-build smoke test. Subagents stop at step 3 (AGENTS.md "Test scope").

CI runs the same `arcade` commands, so "passes locally" and "passes in CI" mean the same thing.

| Command                    | What it does                                                                                            | Prints                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `arcade check [slug]`      | Typecheck, lint and Vitest for the game plus every dependent of any changed package (Turbo `...[base]`) | One line per failure with `file:line` and the fix hint. A line like "packages/input changed: also checked 6 games" |
| `arcade see <slug> [opts]` | Headless run to a state, then capture                                                                   | A short summary plus artifact paths                                                                                |
| `arcade smoke [slug]`      | Production build, assemble, Playwright smoke; also the file-size and file-count limits                  | Pass/fail per game, artifact paths on failure                                                                      |

Everything else is a plain `package.json` script until it earns a place in the CLI:

- `pnpm new-game` (the Turbo generator)
- `pnpm dev <slug>`
- `pnpm fix`
- `pnpm test:update` (snapshots and baselines, only ever run deliberately)

`check` never passes `-u`, so an agent can't make a failing snapshot pass by accident.

Output goes to files. A passing run of 200 tests costs one line of context. Turborepo runs with `--output-logs=errors-only`, Vitest with `dot` and Playwright with `line`, and the CLI sets those flags so agents don't have to. Run artifacts go to `.arcade/runs/<timestamp>-<slug>/` (gitignored), with a `latest` link. Ports are never fixed.

## Determinism

`see`, scenarios and smoke tests only mean something if the same inputs give the same state every time. Playwright's fake clock can't provide that alone. Real time keeps flowing through boot and asset loads until the harness pauses the clock. Fake `requestAnimationFrame` ticks every 16 ms, which doesn't line up with a 60 Hz step. `AudioContext` time is never faked.

So the shell owns stepping in test mode:

- **Ticks are the unit.** A "frame" in every CLI option, scenario and assertion means one fixed logic tick, 1/60 s.
- **Shell-owned loop.** In test mode the shell holds the game loop after `ready`. `__arcade.advance(ticks)` steps exactly N fixed ticks and renders once. The Phaser template stops Phaser's own loop and calls its step directly. The three.js template calls its own update and render. The fake clock is still installed, so engine timers and `Date` stay frozen between steps.
- **One clock per game.** In Phaser games, the core accumulator drives `physics.world.step(dt)`, and Phaser's own fixed step is turned off. Logic and physics can't drift onto different ticks.
- **Wait for loads.** `__arcade.idle()` resolves once no asset loads or decodes are pending. The harness waits on it before the first tick and after every scene change, so a battle scene that loads assets doesn't shift which tick `battle.started` fires on.
- **Seeded randomness.** It comes from `createRng(seed)` in `@arcade/core`. `Math.random`, `Date.now` and `new Date()` are lint errors in `logic/`.
- **Semantic assertions.** Scenarios assert on scene, flags, counts and events, or on positions with tolerances. They never compare raw float positions exactly. Local runs (arm64 macOS) and CI (x86 Linux, Chromium and WebKit) can differ in the last bits of `Math.sin`.

The first build task is a spike that proves stepping, idle-waiting and the single clock in both templates, before the scenario format is built on top.

## Seeing the game

### `arcade see`

```
pnpm arcade see rpg --scenario first-battle --at 0,30,90 --device mobile
```

`see` starts a dev server for this worktree or reuses one, then opens it in headless Chromium:

- **Server reuse** is keyed by worktree root plus slug, recorded in `.arcade/servers.json`. The server reports its absolute root on a health endpoint, and `see` refuses any server whose root doesn't match. An agent in worktree A can't screenshot worktree B's code.
- **Idle servers** exit after 10 idle minutes, or when their worktree directory disappears.
- **First run in a fresh worktree:** `defineGameConfig` lists the engines in `optimizeDeps.include`, so this run doesn't hit Vite's mid-run dependency reload.

Then `see` loads the scenario's start save through `__arcade.loadState()`, waits for `idle()`, plays the input, and advances to each requested tick. It writes:

- **`summary.txt`**, also printed:
  - active renderer and GL vendor
  - ticks captured
  - error count
  - deduplicated console warnings with counts
  - dropped-event count
  - the game's small `debugSummary()` at each capture
  - paths to everything else

  The renderer line matters. A black screenshot from a headless WebGL failure otherwise looks like a bug in the agent's code.
- **`frame-<tick>.png`** per capture, plus `frames.png`, a contact sheet when there are several. The contact sheet is capped in total size so pixel art stays readable after the image is downscaled on read. The default is a single frame, and `--crop x,y,w,h` zooms in.
- **`state.json`**: the full `debugState()` per capture. It can be large, so the CLI prints only the summary and `--field player.pos` selects specific paths.
- **`events.jsonl`** and **`console.log`**. `arcade see --events <type>` filters events from the latest run.

Other options:

- `--input` for ad hoc input
- `--seed`
- `--debug` (overlay on)
- `--ascii` (tile grid as text)
- `--device mobile` (Playwright device descriptor with touch)

### Launch parameters and the test hook

The shell reads `?seed=`, `?scene=`, `?debug=1` and `?log=` so humans and agents can jump straight to the part they're working on. Save fixtures are passed through `__arcade.loadState(obj)`, not by URL.

The `__arcade` hook is write-capable: it can load state, inject input and advance ticks. It ships in every build because smoke tests run on the production build. In a free, single-player arcade, a player using it to skip content harms no one. A game that later has a leaderboard must validate scores on the server regardless.

### Debug overlay and text views

Each template has an overlay, toggled with `?debug=1`, that shows:

- FPS
- physics bodies
- tile coordinates
- entity labels
- the scene name

For tile games, `logic/` exposes `toAscii(world)`. Unit tests snapshot it, `see --ascii` prints it, and diffs of it are easy to read. Small platformer levels can be authored as ASCII, which agents write more reliably than Tiled JSON. 3D games get the same information through `debugSummary()`: player position, velocity, grounded flag and nearby objects.

## Silent failures, made loud

- **Errors:** the shell catches `error` and `unhandledrejection`. The template adapters also route events that aren't exceptions into `__arcade.errors`:
  - Phaser loader errors
  - audio decode failures
  - `webglcontextlost`

  Any entry fails `see` and smoke, and shows as a red banner in dev.
- **Asset keys:** each template generates a typed key manifest from its asset imports, so `Keys.sprites.player` is checked by the compiler. Missing-texture warnings are errors under test. Imported URLs alone fix paths but not the string keys Phaser looks things up by.
- **Audio:** the engine's audio adapter emits `audio.played { key }` after the sound actually started, not when logic asked for it. Smoke checks that the AudioContext is `running` after the start gate, which only exists in test mode; players start straight into the game. That is how an agent "hears" the game.
- **Events:** the harness drains the event log with a cursor after every step. A run fails if the ring buffer dropped any events, so "fired once" is never judged on a truncated log.
- **Renderer:** smoke asserts the expected renderer, so a silent Canvas fallback fails.

## Logs and events

`@arcade/core` provides `createLogger('rpg:battle')`. Logs go to a sink the shell installs, because `console` isn't part of the no-DOM `logic/` environment. Lines are namespaced and filterable with `?log=debug` or `?log=rpg:battle`. Under Playwright they land in `console.log`.

Domain events record what happened in the game, and tests assert on them: `battle.started`, `player.damaged { amount, hp }`, `level.completed`, `save.written`. Logic emits typed events. The engine adapters emit `audio.played` and similar events.

## Guardrails: types and lint

Every rule exists because agents make that mistake, and every message says what to do instead.

TypeScript settings:

- `strict`
- `noUncheckedIndexedAccess`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`
- `verbatimModuleSyntax`

`src/logic/` compiles as its own project with `lib` set to ES only:

- **Excluded files:** test files are kept out, so Node and Vitest types don't bring timers back in.
- **Imports:** `logic/` may import only `@arcade/core` and Zod. Source-only packages are typechecked under the importer's settings, so importing `@arcade/save` would pull IndexedDB code into a no-DOM compile. Save-related types, such as the migration function type, live in `@arcade/core` for that reason.

Biome rules:

| Rule                                                                 | Scope                                          | The message tells the agent                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `noRestrictedImports`: engines                                       | `src/logic/**`                                 | Logic must be engine-free; rendering goes in `src/engine/`                               |
| `noRestrictedImports`: other games, package internals                | games, packages                                | Import only from `@arcade/<pkg>` entry points                                            |
| `noRestrictedGlobals`: `localStorage`, `indexedDB`, `sessionStorage` | games                                          | Use `@arcade/save`                                                                       |
| GritQL: `Math.random()`, `Date.now()`, `new Date()`                  | `src/logic/**` (confirm plugin scoping in 2.6) | Use `rng` / the `dt` you were given                                                      |
| `noConsole`                                                          | `games/**/src`, `packages/**/src`              | Use `createLogger`                                                                       |
| `noSkippedTests`, `noFocusedTests`                                   | tests                                          | Fix or delete the test; don't skip it                                                    |
| `noNonNullAssertion`                                                 | `src/logic/**`                                 | Handle the missing case; `!` hides the bugs `noUncheckedIndexedAccess` exists to find    |
| `noTsIgnore`                                                         | everywhere                                     | Fix the type                                                                             |
| `noFloatingPromises`                                                 | everywhere                                     | Await or `void` it. Biome's inference is partial, so this doesn't replace the save tests |

Checks are protected against weakening. CI posts a PR summary that lists:

- new `biome-ignore` and `@ts-expect-error` comments
- changed snapshot and baseline files
- any drop in test or scenario count

The owner sees in review when an agent made a check pass by changing the check.

`arcade check` also runs the fast repo rules:

- `game.json` is valid
- every game has a smoke script and scenarios
- tooling comes from the pnpm catalog
- engines are pinned exactly
- every third-party asset is listed in `assets/CREDITS.md`

The size and file-count limits need build output, so they run in `smoke`.

## Tests

| Layer     | Tool                                                         | Covers                                                                                                                        |
| --------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Logic     | Vitest                                                       | Rules, state, ASCII snapshots, save round-trip, migrate-from-every-fixture, every scenario's start fixture loads              |
| Scenarios | Playwright, shell-stepped                                    | Start save + input + semantic assertions on state and events                                                                  |
| Smoke     | Playwright on assembled prod build, Chromium and WebKit (2D) | Loads, no errors, right renderer, ticks advance, input works, audio running, save survives reload, touch overlay              |
| Visual    | `toHaveScreenshot`, CI container only                        | Menus, HUD and the touch overlay; never gameplay frames. Baselines have a platform suffix, so these run only in the container |

Scenarios use one typed format for tests and for `see`. Action names are typed per game, so a typo fails typecheck:

```ts
// games/rpg/scenarios/first-battle.ts
export default scenario({
  start: { save: 'fixtures/save-v3-new-game.json', scene: 'overworld', seed: 1 },
  input: [hold('up', 20), tap('confirm'), wait(10)],
  expect: ({ state, events }) => {
    expect(state.scene).toBe('battle');
    expect(events).toContainEvent('battle.started');
  },
});
```

Start states are save fixtures, loaded through `@arcade/save` with validation and migration, so a save version bump can't silently break every scenario. The CLI shorthand `--input "up*20 confirm right+jump"` parses into the same typed form:

- `*n` means hold for n ticks.
- A bare action is one tap.
- `+` presses actions together.

An agent that reproduces a bug with `see` saves the input as a scenario, and it becomes a regression test. Known bugs are written as `todo` scenarios, so they are tracked where the code is.

No sleeps anywhere: the harness waits on `ready`, `idle()`, ticks or events.

### Running tests

Agents prove a change with the tests that cover it, and the full suite runs once, before a merge (AGENTS.md "Test scope"). `pnpm arcade test <slug>` takes paths and named groups (`@courses`, defined under `"arcade": { "testGroups" }` in the game's `package.json`), and `pnpm arcade check <slug> --skip-tests` gives typecheck and lint without the unit tests. Several lanes building at once on one machine was the reason: each running the whole suite pushed a 5-second check past a minute and timed tests out.

`.rr.yaml` runs the same commands on the remote hosts in `~/.rr/config.yaml` through rr: `rr test -- <slug> <paths>`, `rr check -- <slug>`, and `rr suite -- <slug>`, which splits a game's whole Vitest suite into four shards across hosts. The hosts have Node but not the repo's pnpm, so the config runs `pnpm@12.9.1` through an npx shim (`.rr-bin/`, ignored) and installs before each run. Measured on Reef Rush in November 2026: the full suite takes about 33 s on an idle 16-core laptop and 51-56 s through `rr suite` (shards of 15-34 s plus sync and install), so rr is for when the laptop is busy with other agents or for long seeded reports, not a faster default. The fingerprint tests pass on the remote hosts (Node 26 on macOS, Node 24 on Linux), so results don't depend on the machine.

## Context for agents

`AGENTS.md` at the root is short:

- the three commands and the scripts
- directory rules and the reasoning behind the lint rules
- the package-change rule from the architecture doc
- version notes (Phaser 4 not 3, three r187, Vite 8, TS 7), with an instruction to use Context7 instead of memory for those libraries

`CLAUDE.md` contains `@AGENTS.md`, so Claude Code and Codex read the same conventions.

Each game's `DESIGN.md` stays short: pitch, core loop, controls per device, and its scenes and launch parameters. Status and known issues live in scenarios, not prose.

Project skills in `.claude/skills/`:

- `verify-game`: the inner loop, including how to read a summary and a contact sheet
- per-engine notes (`phaser-game`, `threejs-game`) that grow whenever an agent hits a version-specific gotcha

Claude Code hooks:

- **`PostToolUse`:** runs `biome format --write` on the edited file, with no output. It runs format only, not `check --write`. Safe fixes can delete an import the agent added for its next edit, and reformatting can make the agent's next `old_string` miss.
- **`Stop`:** runs `arcade check` on changed games, so an agent can't report done on a red tree. CI covers Codex and other tools.

`.claude/launch.json` lists each game's dev server for the in-app browser.

## Performance

Headless frame times say nothing about a mid-range phone, and agents would optimise against them. Budgets use device-independent numbers that `smoke` reports per game:

- draw calls and triangles (three.js `renderer.info`)
- JS heap after a scenario
- initial JS gzipped
- total asset size

Each budget is set in `game.json` once the templates give us baselines. `see --perf` reports FPS under CPU throttling as information only. Real-device performance comes from Cloudflare Web Analytics and the pre-publish phone check.

## Assets

Agents can't draw, so the templates generate labeled placeholder textures at boot. Gameplay can be built and tested before any art exists. Real art comes from the owner or from CC0 packs, credited in `assets/CREDITS.md`.

## Scope

Must, in the scaffold:

- the determinism spike in both templates
- `check` (with dependents), `see` (summary, frames, state, events, console), `smoke`
- shell stepping, `idle()`, `loadState`, error routing
- `@arcade/core`
- the lint and TS rules, including the anti-weakening ones
- the typed scenario format
- `AGENTS.md`
- the format and Stop hooks

Should, with the first real game:

- contact sheets and `--crop`
- `--ascii`
- debug overlays
- typed asset keys
- the PR weakening report
- performance budgets
- the `verify-game` skill

Could:

- `--json` output, once something consumes it
- an MCP server wrapping the CLI

Won't:

- video recording (contact sheets carry the same information for less context)
- a custom level editor
- an in-house test framework

Everything sits on Playwright, Vitest, Biome and Turborepo.

## As built (2026-11-22)

The scaffold implements this plan with these differences, found while building and testing it:

- **Stepping without Playwright's fake clock.** The engine's own loop keeps running in test mode but only renders. Logic advances only through `__arcade.advance(n)`, which stops early when the game stops being idle (a scene or asset loading), and the driver waits for `idle()` before continuing. That made the fake clock unnecessary. Screenshots wait two animation frames so they show the latest state.
- **One clock in Phaser games.** The 2D template keeps tile physics in `src/logic/` instead of using Phaser arcade physics. A game that wants arcade physics sets `arcade.customUpdate: true` and calls `physics.world.singleStep()` once per logic tick, never from Phaser's loop.
- **`see` starts its own Vite server for each run,** from the current worktree, on a free port, and closes it afterwards (about 1-2 s overhead). This removes the cross-worktree reuse risk and the orphan-server problem. Server reuse is a possible later optimization.
- **CLI surface:**
  - Commands: `check`, `test`, `see`, `smoke`, `dev`, `new`, `assemble`, `list`.
  - `see` options include `--events`, `--field`, `--ascii`, `--crop`, `--mobile`, `--at` (ticks past the input wait idle), `--query`, `--out` and `--compare`.
  - `new` replaces the Turbo generator. It formats the copied files and registers the game in `.claude/launch.json`.
  - `pnpm arcade` is a bin, so pnpm adds no echo or ELIFECYCLE lines.
- **Output budget:**
  - Biome uses its one-line GitHub reporter, and formatting issues collapse into one "run pnpm fix" line.
  - Vitest uses the `dot` reporter.
  - Turbo output is grouped by package with repo-relative paths.
  - Vite's browser console forwarding is off under test servers.
  - Duplicate problems (one exception seen as a page error, a console error and a game error) are reported once.
  - Captures are taken at CSS pixel size.
- **`check` before the first commit** checks every package, because it can't tell what changed.
- **Not built yet:**
  - the CI report on weakened checks (new suppressions, changed snapshots, test count drops)
  - `--perf` and size budgets
  - debug overlay for the 3D template
  - pointer-drag look
  - typed asset-key manifests
  - visual regression for menus
- **Claude Code hooks:** the format and Stop hooks exist as scripts in `.claude/hooks/`. Registering them in `.claude/settings.json` is left to the owner.
