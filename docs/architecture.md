# Architecture Plan

Status: revised after devil's-advocate review. Versions verified against npm on 2026-11-22. Agent tooling is covered in [agent-experience.md](agent-experience.md).

## TL;DR

This is a pnpm and Turborepo monorepo. Each game is its own Vite app with its own engine, deployed under its own path (`/games/<slug>/`) on one Cloudflare Workers static-assets site.

Two templates cover the target genres. Phaser 4 handles 2D (tile RPG, platformer). Plain three.js with Rapier, loaded lazily, handles 3D.

Shared code is limited to five small packages that every game needs and no engine provides well:

- `core`: logger, events, rng, timestep
- `save`
- `input`
- `shell`
- `config`

There is no shared game engine. The landing page is a small Vite app generated from each game's `game.json`. Each game's own page gets its share-preview tags from the same file.

Each game proves itself in CI in two ways: unit tests on its pure logic, and a Playwright smoke test against the assembled production build. Nothing runs on a server until a game needs one. When one does, a separate Cloudflare Worker using the free tier (D1, Durable Objects) sits behind `/api/*`, and static files remain free and uncapped.

## Goals and non-goals

Goals, from the [product vision](product-vision.md) and [problem statement](problem-statement.md):

- Any game builds, runs, tests and deploys on its own. A broken game cannot break another game's build, download size or saves.
- An AI agent can create a new game from a template and verify it without a human opening a browser.
- Players get a fast load on phones, real touch support, and saves that survive restarts, bad deploys and rollbacks.
- Static hosting only, free at any traffic level for static files.

Non-goals for now: a shared engine abstraction, accounts, cloud saves, multiplayer, native wrappers, offline/PWA.

## Prerequisites before the first public deploy

Two decisions can't be reversed once players have saves:

- **The final domain: `arcade.steamfield.io`**, set as a custom domain in `wrangler.jsonc`. IndexedDB is scoped to the origin, so moving later would leave every player's saves behind on the old one. Open Graph images also need absolute URLs; `cf:build` sets `ARCADE_SITE_URL` to this origin.
- **A stable `gameId` per game.** It lives in `game.json` and is independent of the folder slug. Saves are keyed by `gameId`. If a slug is renamed, it gets a `_redirects` entry so shared links keep working.

## Stack

| Concern                   | Choice                                           | Version                      | Why                                                                                                            |
| ------------------------- | ------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime / package manager | Node 24 LTS, pnpm workspaces                     | pnpm 12                      | Strict dependency isolation per game; `catalog:` for shared tooling versions                                   |
| Task runner               | Turborepo                                        | 2.11                         | Caching and `--affected` runs, so CI only rebuilds and re-tests games that changed                             |
| Bundler / dev server      | Vite                                             | 8.3                          | Rolldown-based, the default for TS game apps, first-class `base` path support                                  |
| Language                  | TypeScript                                       | 7.0                          | Native compiler makes typecheck fast enough to run on every agent edit                                         |
| Lint + format             | Biome                                            | 2.6                          | One fast binary; `noRestrictedImports`, `noRestrictedGlobals` and GritQL plugins enforce repo rules            |
| Unit tests                | Vitest                                           | 5.1                          | Shares Vite config; runs pure game logic without a browser                                                     |
| Browser tests             | Playwright                                       | 1.65                         | Chromium and WebKit, fake clock for deterministic frames, device emulation                                     |
| 2D engine                 | Phaser                                           | 4.2                          | Only stable option that bundles tilemaps (Tiled JSON), arcade physics, scenes, loader, camera, audio and input |
| 3D renderer               | three.js                                         | 0.187, pinned exact per game | Largest ecosystem and the most agent familiarity; `WebGLRenderer` until WebGPU/TSL APIs settle                 |
| 3D physics                | Rapier (`@dimforge/rapier3d-compat`)             | 0.21                         | Maintained, fast WASM; lazy-loaded after the first frame (spike the size before committing)                    |
| Maps                      | Tiled editor (JSON), ASCII levels for small maps | 1.12                         | Native Phaser loader; LDtk has no maintained Phaser loader                                                     |
| 3D assets                 | glTF + `@gltf-transform/cli`, meshopt, KTX2      | 4.5                          | Standard compression pipeline for models and textures                                                          |
| Save storage              | `idb-keyval`                                     | 6.3                          | Tiny IndexedDB wrapper; one database per game                                                                  |
| Validation                | Zod                                              | 4.6                          | Save files, imported saves, `game.json` manifests                                                              |
| Landing page              | Vite app + build-time render from `game.json`    |                              | One index page; Astro would add a second toolchain and a TS 6 pin for one page                                 |
| Hosting                   | Cloudflare Workers static assets via Wrangler    | 4.166                        | Static requests free and unlimited; Cloudflare now points new projects to Workers                              |
| Production telemetry      | Cloudflare Web Analytics                         |                              | Free, cookieless, real-user load metrics with no backend                                                       |
| Real-time multiplayer     | Lockstep over a relay Durable Object (`apps/api`, one SQLite `Room` per room code, reached through the site's `/api/*` service binding) | | Every browser steps the same deterministic simulation from the players' inputs, so the room only relays inputs and world hashes and never runs the game: no server tick, no game code on the server, and a desync shows as a hash mismatch. Rush Racers races up to four friends this way |
| CI / deploy               | GitHub Actions checks; Cloudflare Workers Builds deploys the site; `arcade-api` by hand |                       | Actions runs check and smoke; the Git connector runs `pnpm cf:build`, then `wrangler deploy` on main and `wrangler versions upload` (preview URLs) on other branches. Workers Builds never deploys `arcade-api` (`apps/api`): deploy it by hand with `pnpm deploy:api` when the owner asks for it, before the site, since the site's service binding needs it to exist |

Considered and not chosen:

- **Excalibur 1.0**: a good TS-first engine, but it reached 1.0 this month and has a far smaller community.
- **Babylon.js 9**: more batteries included, but a heavier download and less agent familiarity. Allowed per game by explicit decision.
- **React Three Fiber**: brings React render semantics into game loops.
- **Astro**: the per-game pages it would generate aren't the URLs players share, and `@astrojs/check` requires TypeScript ≤ 6.
- **Vite+**: promising, but it replaces lint, test and task running all at once. Worth a spike later.
- **Nx**: more machinery than Turborepo with no benefit here.
- **Dexie**: we have no query needs.
- **Howler**: no release since 2023, and the engines already ship audio.
- **An ECS library**: a 3D game can adopt bitECS or koota on its own.

## Repository layout

```
games/<slug>/               one Vite app per game
  game.json                 id, slug, title, pitch, engine, inputs, orientation, status, cover
  DESIGN.md                 mechanics, controls, scenes, scenarios, status (agents keep it current)
  index.html                title/description/OG tags injected from game.json at build
  vite.config.ts            defineGameConfig(import.meta.url)
  src/
    main.ts                 boot via @arcade/shell
    logic/                  pure TS, own tsconfig with no DOM lib; rules, state, save schema + migrations
    engine/                 Phaser scenes or three.js world
    assets/                 imported by URL, so hashed and build-checked
  scenarios/                start state + input script + expectations (tests and `arcade see`)
  tests/                    logic tests, save fixtures per version, smoke script
templates/phaser-2d, templates/three-3d   real games CI checks but never deploys
packages/
  core/                     @arcade/core: logger, event log, seeded rng, fixed-step accumulator. No DOM
  save/                     @arcade/save
  input/                    @arcade/input
  shell/                    @arcade/shell
  config/                   @arcade/config: tsconfig bases, Vite preset, Playwright preset
apps/site/                  landing page
tools/arcade/               the agent/dev CLI (see agent-experience.md)
wrangler.jsonc              Worker serving dist/ as static assets; only /api/* runs its script, forwarding to arcade-api
AGENTS.md                   conventions; CLAUDE.md imports it
```

Dependencies point one way. `games/* → packages/*`. `logic/` may import only `@arcade/core` and Zod. `apps/site` reads `game.json` files and never imports game code. Games never import other games. Packages never import games or engines, which is why they work with both Phaser and three.js.

Packages are source-only (Turborepo's "just-in-time" packages). Their `exports` point at `.ts` files, and each game's Vite build compiles them. Packages have no build step and no `dist/`.

## How the pieces fit

```mermaid
flowchart LR
  subgraph repo
    G1[games/rpg] --> P[packages]
    G2[games/platformer] --> P
    G3[games/3d-*] --> P
    S[apps/site] -. reads game.json .-> G1 & G2 & G3
  end
  G1 -- vite build --> D1[rpg/dist]
  G2 -- vite build --> D2[platformer/dist]
  S -- vite build --> DS[site/dist]
  D1 & D2 & DS --> A[assemble] --> OUT[dist/]
  OUT --> SM[smoke: one wrangler dev, Playwright project per game] --> CF[wrangler deploy]
```

Each game builds into its own `dist/` so Turborepo can cache it, and a root-level `assemble` task copies every build into `dist/games/<slug>/`. Smoke tests run against that assembled output served by a single `wrangler dev`, the same asset handling production uses. A wrong `base` path or missing file only shows up there.

`assemble` and `smoke` are root tasks, not per-game tasks, so there is only one server and one Playwright run, with a project per game. `--filter <slug>` lets an agent assemble and smoke just its own game.

The site's Turbo task declares `$TURBO_ROOT$/games/*/game.json` and cover images as inputs, so publishing a game or editing a pitch invalidates the landing page cache.

## Key decisions

### 1. Engine per game, no shared engine layer

A tile RPG wants tilemaps and scene management. A 3D game wants a renderer, physics and asset streaming. An abstraction over both would be the lowest common denominator and a large thing to maintain, so each game depends on its engine directly and the templates set the default per genre.

Agent drift happens inside a genre, and the templates are where it gets fixed. The 3D template ships these, ready to use:

- a loading and progress screen
- a fixed-step loop
- a camera rig
- a character controller
- lazy Rapier loading

The 2D template ships:

- scene flow (title → continue/new → play)
- a pixel-art scaling setup
- a dialogue box

When two games need the same piece of template code, it moves into a package. It does not move before that.

As built, the 2D template keeps tile physics in `src/logic/` rather than using Phaser arcade physics, so there is exactly one clock. A game that adopts arcade physics sets `arcade.customUpdate: true` and calls `physics.world.singleStep()` once per logic tick (see `.claude/skills/phaser-game`).

### 2. Logic separated from engine inside each game

`src/logic/` holds the rules and state as plain TypeScript: battle math, inventory, tile collision, save schema and migrations. `src/engine/` renders the logic and feeds input into it.

`logic/` compiles under its own tsconfig with no DOM types, so `window`, `document`, `localStorage` and `performance` are type errors there. Biome blocks engine imports, and a GritQL rule blocks `Math.random` and `Date.now`.

The split lets an agent unit test the parts most likely to be wrong in milliseconds, and it keeps games deterministic (see the AX plan). Real-time feel, like jump arcs, stays in `engine/`, because it gets tuned by playing.

### 3. Single origin, path per game

Every game is served from one origin under `/games/<slug>/`. That means one Worker, one deploy and one domain. It also means one storage origin. `@arcade/save` gives each game its own IndexedDB database (`arcade-<gameId>`). Games can't touch storage directly: the logic tsconfig and Biome's `noRestrictedGlobals` both enforce this.

Vendor chunks such as Phaser live under each game's path, so they aren't shared between games. A player moving from one game to another downloads the engine again. Load budgets assume a cold cache.

### 4. Asset hashing and caching

Game assets are imported (`import mapUrl from './assets/l1.json?url'`) and passed to the engine's loader. They get content hashes, follow `base` automatically, and a missing file fails the build.

`defineGameConfig` sets `build.assetsDir` to `_v`. `_headers` marks only `/games/*/_v/*` as `immutable`. Everything else, including `public/` files with fixed names and HTML, revalidates.

Audio goes through Web Audio, which is Phaser's default. Workers static assets answer range requests with the full file instead of a 206, and iOS `<audio>`/`<video>` streaming depends on 206 responses.

### 5. Share previews and the landing page

Players share links to `/games/<slug>/`, which is the game's own `index.html`. `defineGameConfig` uses `transformIndexHtml` to inject title, description, canonical URL and OG/Twitter tags from `game.json` into that page.

The landing page (`apps/site`) is a single Vite page whose HTML is rendered at build time from the validated manifests, styled as a cabinet select screen. Each game's `cover` and `attract` (a muted gameplay loop recorded by `pnpm arcade attract` from a scenario, so it is deterministic and reproducible) live in the game's `public/` and are served from `/games/<slug>/`. The page works as plain links without JavaScript; `select.ts` adds keyboard, gamepad, sound and the transitions. If the site grows to need content pages, Astro can replace it then.

Only `published` games appear on the production site. `draft` games are assembled into PR preview builds, unlisted, so they can be opened on a real phone before publishing.

### 6. Hosting on Workers static assets

`wrangler.jsonc` declares an assets directory and a one-line script, `apps/api/src/forward.ts`, that runs only for `/api/*` (`run_worker_first`) and forwards to the `arcade-api` Worker through a service binding. Every other request, unmatched paths included, is a static asset request: free, unlimited, and never counted toward the Worker request cap.

The limits are 20,000 files per deployment, shared by all games, and 25 MiB per file. `arcade smoke` reports per-game file counts and fails as the total approaches the limit. Files over 25 MiB would mean R2 behind a custom domain, which adds an origin and CORS, so the policy is to compress or split them instead.

### 7. Deploys scale with changed games, not total games

CI tests only what a change affects. A `plan` job runs `pnpm arcade affected --base <sha>` (the PR's base, or main before the push): changed workspace packages and their dependents by `turbo ls --filter=...[base...HEAD]`, or everything when CI, the CLI, the site, the Worker config or root config changed. `check` typechecks and unit tests those packages and lints the whole repo. `smoke` is one job per affected game, in Playwright's container image (`mcr.microsoft.com/playwright:v<version>-noble`, kept equal to the catalog version by `tools/arcade/src/ci.test.ts`), so runners never apt-install browser libraries. A game's suites too slow for `check` are declared in its package.json (`"arcade": { "ci": { "slow": { "script", "shards" } } }`) and run as a sharded `slow` job, only when that game is affected. A docs-only change runs lint and nothing else.

The merge gate is a green PR. Cloudflare Workers Builds deploys the site on every push to `main` without waiting for Actions, so `main` needs branch protection that requires the `ci` job, which fails when any other job failed or was cancelled and passes over skipped ones. A failing game blocks the deploy only if that game was affected. Playwright retries a failed test once on CI and still fails the run if the retry passes (`failOnFlakyTests`), because a flaky test here is a determinism bug and the retry only tells us whether it repeats. We are not building a "ship last-good build" fallback until flakes prove it's needed.

Changes under `packages/` affect every game, so they go in their own PR. That PR runs every game's smoke test plus a screenshot diff of the touch overlay. `AGENTS.md` states this rule, and CODEOWNERS routes those PRs to the owner.

## Shared packages

Each package has one `index.ts` entry, and nothing imports a package's internals.

`@arcade/core` is pure TypeScript with no DOM: `createLogger`, a typed event log, `createRng(seed)` and a fixed-step accumulator. Both `logic/` and the shell use it.

`@arcade/save` stores versioned save data per game. It assumes agent-written migrations will sometimes be wrong. Losing a save to a bad deploy is the likeliest way players lose progress, so the API makes that hard:

```ts
const saves = createSaveStore({ gameId, version: 3, schema: SaveSchema, migrate: { 1: v1to2, 2: v2to3 } });
const result = await saves.load('slot-1');
// { kind: 'ok', data } | { kind: 'empty' } | { kind: 'unreadable', error } | { kind: 'newer-than-code', version }
await saves.save('slot-1', data); // refuses if this slot's last load was unreadable or newer-than-code
saves.exportFile('slot-1'); // exports the raw blob, quarantined or not
await saves.importFile(file); // validates before accepting
saves.status; // 'persistent' | 'best-effort' | 'memory-only' | 'read-only (open in another tab)'
```

The package's protections:

- **Before migrating:** it copies the raw blob to a backup key.
- **Unreadable saves and saves from newer code:** these are quarantined, never overwritten. A rollback to older code therefore leaves newer saves intact.
- **Second tab:** a Web Locks guard opens the game read-only in the second tab.
- **`navigator.storage.persist()`:** called from the player's first tap or key press in the game (`onFirstGesture`) rather than from an autosave, because Firefox shows a permission prompt.
- **Saving on hide:** the shell triggers a save on `visibilitychange` to hidden, which is the last reliable moment to write on mobile.
- **Template tests:** the template includes a round-trip test plus a migrate-from-every-fixture test, and each save version must have a committed fixture.
- **Safari eviction:** export and import exist because Safari can delete a site's storage after 7 days without interaction.

`@arcade/input` maps physical inputs to named actions and analog vectors: `isDown('jump')`, `on('confirm')`, `vector('move')`. Keyboard and touch come first. On touch devices it renders a DOM overlay: a d-pad or stick plus action buttons, inset from the screen edges and safe areas so they don't trigger Safari's swipe-back.

It is a package from day one, not template code, because it is also the test seam. Scenarios and smoke tests inject input at the action level (`press('jump', { frames: 10 })`), and that needs to work the same in every game.

Its scope is limited to what the first two games prove they need:

- **Pointer-drag look:** the 3D template adds this.
- **Direct-tap menus:** the RPG uses tap-to-select in menus instead of d-pad navigation.
- **Gamepad:** waits until a game wants it.

`@arcade/shell` owns a container element. The engine sizes its canvas inside it (Phaser via `scale.parent`, three.js via a ResizeObserver), so two systems never fight over the canvas size. The shell handles:

- safe-area insets (`viewport-fit=cover`)
- a "rotate your device" screen for games whose orientation doesn't match the phone
- gesture suppression (`touch-action: none`, `overscroll-behavior: none`, `user-select: none`)
- `visualViewport` resizes, debounced
- device pixel ratio capped at 2
- an integer-scale `pixelArt` mode
- starting the game as soon as it loads (players arrive from a click on the landing page), with audio unlocked by the first tap or key press; a start gate only in test mode, so the harness controls when a game starts
- resuming an interrupted iOS AudioContext after backgrounding
- pause and save on hide
- a back-to-arcade link
- the storage warning
- error capture and the `__arcade` test hook (see the AX plan)

iPhone Safari supports neither orientation lock nor element fullscreen, so the shell doesn't try to use them.

`@arcade/config` holds:

- the tsconfig bases: game, logic (no DOM), tooling
- `defineGameConfig`: base path from the slug, `_v` assets dir, HTML meta injection
- the shared Playwright config, with Chromium and WebKit projects

## Version policy

Tooling (Vite, TypeScript, Vitest, Playwright, Biome, Zod) comes from a pnpm catalog and upgrades in one PR for the whole repo.

Engines are pinned to an exact version per game. A new game gets its template's version, and upgrading an existing game's engine is a separate, opt-in change. three.js has no semver, so this keeps the r188 upgrade from becoming a forced migration of every 3D game at once. Templates track the latest version we've vetted.

## Verification

The agent-facing loop is in [agent-experience.md](agent-experience.md). The smoke test for each game:

1. Load `/games/<slug>/` from the assembled build. Fail on any console error or failed request.
2. Check `debugState().renderer` against the expected renderer (WebGL, not a silent Canvas fallback).
3. Play the game's own smoke script, starting from launch parameters (`?seed=`, `?scene=`), and assert on state and events.
4. Save, reload, and assert that "continue" is offered.
5. Repeat in a mobile viewport with touch, in Chromium for every game and in WebKit for 2D games.

Headless WebGL on GitHub runners needs a spike before we build the 3D smoke test on it. Chrome no longer falls back to SwiftShader automatically, so it may need `--enable-unsafe-swiftshader`.

Chromium emulation doesn't reproduce real iOS behaviour. Moving a game from `draft` to `published` therefore requires a check on a real iPhone and a real Android phone through the PR preview URL.

In production, Cloudflare Web Analytics reports real-user load times. That is how the load-time metric gets measured. The lab target uses Lighthouse's mobile throttling profile (150 ms RTT, 1.6 Mbps).

## Backend later, on Cloudflare

Shared state lives in a separate Worker, `arcade-api` under `apps/api` (today the room service for online races), reached through a service binding from `run_worker_first: ["/api/*"]` on the assets Worker. Keeping it separate protects PR preview URLs: Cloudflare has said preview URLs aren't generated for Workers that contain Durable Objects, and we should verify that this still holds.

Before adding any script, check how `not_found_handling` routes unmatched paths. Bots probing random URLs must not consume the Worker request cap.

| Feature                         | Product                                              | Free-tier reality                                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaderboards                    | D1                                                   | 100k rows written/day, and each indexed column a write touches counts as another row, so about 33k submissions/day with two indexes                                        |
| Turn-based or async multiplayer | Durable Objects (SQLite) with hibernating WebSockets | Fits the free tier                                                                                                                                                         |
| Real-time multiplayer           | Durable Objects (SQLite) with hibernating WebSockets | Fits light use. A lockstep relay room never ticks, so it hibernates whenever nobody is sending. A racer sends one input message per tick (60/s), and 100k requests/day at 20:1 is about 2M incoming messages, roughly 9 racer-hours a day. Past that, the paid plan |
| Abuse protection                | Turnstile                                            | Free; stops bots, not fake client-side scores                                                                                                                              |
| Config / flags                  | KV                                                   | 1,000 writes/day                                                                                                                                                           |

Free caps fail hard and reset at 00:00 UTC. They are account-wide, so one viral leaderboard takes every game's online features down for the rest of the day. Every online feature must degrade gracefully: the game keeps playing and the leaderboard shows as unavailable.

The response to sustained success is the $5/month Workers Paid plan. That plan has no hard spending cap, so it comes with the Workers rate-limiting binding and billing alerts.

Public leaderboards also need name moderation and server-side score plausibility checks. That is real work, and it belongs in that feature's scope.

Cross-device cloud saves need accounts and stay out of scope until there is a reason to add them.

## Risks

| Risk                                                                    | Likelihood | Mitigation                                                                              |
| ----------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Agent-written migration or schema bug drops saves                       | High       | Result-typed load, quarantine, pre-migration backup, fixture-per-version tests          |
| Agents write Phaser 3, older three.js, or Vite 7 code                   | High       | Version notes in `AGENTS.md`, Context7 for docs, templates with current APIs, typecheck |
| A package change breaks other games                                     | Medium     | Package changes in their own PR, all-games smoke, overlay screenshot diff               |
| iOS-only behaviour (gestures, audio, viewport) missed by Chromium tests | Medium     | WebKit project, shell handles known cases, real-device check before publishing          |
| Headless WebGL unavailable or falls back silently in CI                 | Medium     | Spike first, renderer assertion in smoke                                                |
| three.js breaks APIs between releases                                   | Medium     | Exact pins per game, opt-in upgrades, avoid WebGPU/TSL for now                          |
| Rapier compat build too heavy for the 3D load target                    | Medium     | Lazy-load after first frame; spike size before the template commits to it               |
| Phaser 4 plugins lag v3                                                 | Medium     | Templates avoid plugins                                                                 |
| Safari evicts saves for lapsed players                                  | Medium     | `persist()` on user action, export/import                                               |
| Asset growth hits 20k files or 25 MiB                                   | Low now    | Per-game counts in `arcade smoke`, atlases                                              |

## Success metrics

- `pnpm new-game` to a deployed, smoke-tested draft in one agent session.
- 100% of published games pass smoke on every deploy that touches them.
- `arcade check <slug>` under 10 seconds.
- Real-user load to interactive (Web Analytics, mobile): under 5 s for 2D and under 10 s for 3D.
- Zero lost saves across deploys and rollbacks, verified by the fixture tests.

## Open questions

- The domain (blocking the first public deploy).
- Whether the repo is public or private. GitHub Actions minutes are unlimited for public repos and 2,000 per month free for private ones.
- Per-game size budgets, set after measuring the templates.
