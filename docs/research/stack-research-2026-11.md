# Web game dev stack research (as of 2026-11-22)

Method: npm registry (versions and publish dates, queried directly), GitHub API (pushed_at, archived, releases), official docs pages. "Pushed" means last repo push. Unverified items are flagged at the end.

## 1. 2D engines

- **Phaser 4.2.1**, 2026-07-09. v4.0.0 "Caladan" was stable 2026-04-10 after RC7 on 2026-03-25; 4.1.0 on 04-30, 4.2.0 on 06-19. Repo pushed 2026-08-21 (the npm latest is 2026-07-09). Maintained, with fewer commits since July.
  - Source: https://github.com/phaserjs/phaser/releases
  - It ships its own types at `./types/phaser.d.ts`. The npm tarball is 112 MB unpacked, which is not a bundle size. I did not verify the minified v4 bundle size.
  - v4 has a new WebGL renderer with a node-based pipeline. The API is close to v3, so there is a migration guide.
  - Tilemaps are built in with Tiled JSON loading. v4 adds `TilemapGPULayer`, which draws a whole layer as one quad (orthographic only).
  - Arcade physics is still built in. I could not confirm any v4-specific arcade changes.
  - `phaser-box2d` 1.1.0 (2025-01-01) is the official Box2D option, but it looks stale.
  - Ecosystem: `phaser3-rex-plugins` 1.80.20 (2026-03-31), spine-phaser 4.1.56. I did not check whether the rex plugins work with v4.
- **PixiJS 8.23.0**, 2026-11-11, pushed 2026-11-20. Very active. It is a renderer and scene graph, not a game framework: no physics, no tilemaps, no game loop structure.
  - Tilemap and extras: `@pixi/tilemap` 5.0.2 (2025-07-14, slower cadence), `pixi-tiledmap` 2.11.1 (2026-11-20, third party), `@pixi/sound` 6.0.2 (2026-10-30), `@pixi/ui` 2.4.1, `@pixi/layout` 3.2.1.
- **Excalibur 1.0.1**, 2026-11-13, pushed 2026-11-19. Reached 1.0 recently, so the API is now stable. TypeScript-first, and it has built-in physics and its own tilemap.
  - `@excaliburjs/plugin-tiled` 1.0.0 and `plugin-ldtk` 1.0.0, both 2026-11-08, so it has first-party Tiled and LDtk support. Actively maintained, with a smaller community (2.4k stars).
- **Kaplay 3001.0.19**, 2025-06-15 (last stable). The v4000 line is still alpha: 4000.0.0-alpha.27.1, 2026-05-12. Repo pushed 2026-11-21, so it is active but stable releases are stale.
  - Source: https://github.com/kaplayjs/kaplay/releases
  - Kaboom 3000.1.17 is deprecated on npm. Avoid it.
- **LittleJS 1.31.0**, 2026-11-20. Very active and tiny. It is a minimalist, jam-oriented engine with built-in tilemap-ish layers. I did not check its TypeScript story.
- **melonJS 20.17.0**, 2026-11-21, pushed 2026-11-22. Very active, with built-in Tiled support and its own physics. It is a smaller community than Phaser.
- **Strongest default for tile RPG and platformer: Phaser 4.** It is the only option that bundles tilemaps with Tiled loading, arcade physics, an asset loader, scenes, input, audio and a camera in one stable package. A tile RPG needs very little physics, and a platformer is the arcade-physics case.
  - Alternative if you want a TS-first, ECS-flavoured engine with first-party Tiled and LDtk: Excalibur 1.x.
  - Phaser 4 is only about 7 months past stable, so expect some plugin lag.

## 2. 3D

- **three.js r187**, 2026-10-30 (npm `three` 0.187.0, `@types/three` 0.187.0). The migration guide already has a 187 to 188 entry, so r188 is imminent. The repo is pushed daily (119k stars).
  - WebGPURenderer and TSL (the node material system) are actively developed and have been renamed and reworked every release. The migration guide lists a TSL or WebGPURenderer entry for most releases from r180 to r187: `PostProcessing` became `RenderPipeline` in r183, and premultiplied alpha behavior changed in r185.
  - Source: https://github.com/mrdoob/three.js/wiki/Migration-Guide
  - I could not confirm whether WebGPURenderer falls back to WebGL automatically from the migration guide. Treat it as unverified.
  - Pin exact versions. Three has no semver stability.
  - Helper: `three-mesh-bvh` 0.9.18 (2026-11-03).
- **React Three Fiber 9.8.2**, 2026-10-14 (repo pushed 2026-10-21). v10 is canary/alpha only.
  - Peers: `react >=19 <19.4`, `three >=0.156`. React 19 is required.
  - **drei 10.7.9**, 2026-09-25: peer `react ^19`, `@react-three/fiber ^9`.
  - `@react-three/rapier` 2.2.0 (2025-11-03, repo touched 2026-08).
  - Related: `@react-three/postprocessing` 3.2.2, `@react-three/xr` 6.6.32, `@pmndrs/uikit` 1.0.78, all current.
  - Tradeoff: great ergonomics for scene composition and drei helpers, but game-loop code is awkward in React render semantics. It adds React as a dependency across every 3D game.
- **Babylon.js 9.37.1**, 2026-11-18. Major version is 9; the 8.x to 9.x move is not documented in my sources. Repo pushed 2026-11-21.
  - It is batteries-included: PBR, built-in physics via Havok (`@babylonjs/havok` 1.3.14, 2026-07-29), a character controller, inspector, and GUI. It has a large npm footprint, so use tree-shakeable `@babylonjs/core` imports.
  - It has the best fit for "write game code, not engine code" in 3D.
- **PlayCanvas engine 2.24.2**, 2026-11-18 (a 1.77.0 LTS tag exists). `@playcanvas/react` 0.11.7 (2026-09-25, still 0.x), `@playcanvas/web-components` 0.31.0. Active.
  - It is an engine with an optional hosted editor, with a smaller code-only community than three or Babylon.
- **Strongest default for 3D:** plain three.js (WebGLRenderer, with version pinning), or Babylon.js 9 if you want physics, controllers and tooling included. R3F is worth it only if the team is already React-native.

## 3. Physics

- **Rapier 0.21.0**, 2026-09-25: `@dimforge/rapier2d`, `rapier3d`, `rapier2d-compat`, `rapier3d-compat`, plus `-simd-compat` and `-deterministic-compat` variants.
  - **The `dimforge/rapier.js` repo is archived** (pushed 2026-07-12). Its description says it was merged into `dimforge/rapier` under `typescript/`. The main `dimforge/rapier` repo was pushed 2026-11-01. So it is maintained, just relocated.
  - A web search result earlier suggested rapier.js was still the official home. That is stale. The GitHub API is authoritative.
  - Compat vs non-compat: the non-compat package's `module` entry is `rapier.mjs` and it ships WASM as a separate import, so with Vite you typically need `vite-plugin-wasm` plus top-level-await. The `-compat` package embeds the WASM as base64 in `dist/rapier.mjs`, so it works with no Vite plugin. The compat tarball is about 15 MB unpacked, versus about 5 MB for non-compat. This is from package metadata and my own knowledge, not tested here.
  - Use `-compat` unless the extra ~1.4x size matters.
- **cannon-es 0.20.0**, 2022-08-12. Repo pushed 2024-01. Effectively abandoned, so avoid.
- **Jolt (`jolt-physics`) 1.1.2**, 2026-11-21 (the JoltPhysics.js repo was pushed 2026-11-21). Very active. Best fit for character controllers and heavier 3D.
- **Box2D WASM:**
  - `box2d3-wasm` 6.0.0, 2026-10-26 (Box2D v3 port, active, 69 stars).
  - `box2d-wasm` 7.0.0, 2021/2022. Repo pushed 2024-12. Stale.
- **planck.js 1.5.1**, 2026-10-12. Active, TypeScript-friendly Box2D port in pure JS.
- **Matter.js 0.20.0**, 2024-06-23. Repo pushed 2026-09-30. Low release cadence but not dead.
- **Havok** for Babylon: `@babylonjs/havok` 1.3.14.
- **Strongest default:** Phaser arcade for tile RPG and platformer; planck.js or Rapier2D if real 2D rigid bodies are needed; Rapier3D (compat) or Jolt for 3D.

## 4. ECS

- **miniplex 2.0.0**, 2023-07-16. No new stable since; the repo was not returned by the GitHub API (name or owner differs). Treat it as dormant.
- **bitECS 0.4.0**, 2025-12-06 (repo pushed 2026-08-24). Active. Data-oriented with typed arrays and a minimal API.
- **koota 0.6.6**, 2026-04-09 (repo pushed 2026-11-19). Active pmndrs project, React-friendly. Still 0.x.
- **becsy**: npm `@lastolivegames/becsy` 0.16.1, 2026-10-02. Active but small (299 stars), with TypeScript decorators.
- **ecsy** 0.4.3: dead, avoid.
- **Worth using?** Optional. Phaser, Excalibur and Babylon already have entity models. A thin ECS pays off mostly in 3D or large-entity-count games. If you want one, koota or bitECS. Not needed for a tile RPG or platformer.

## 5. Audio

- **Howler.js 2.2.4**, 2023-09-19. Repo pushed 2025-11-23 and 419 open issues. Stagnant but widely used and stable. No new release in 3 years.
- Alternatives: Phaser, Excalibur and Babylon all include audio. `@pixi/sound` 6.0.2 (2026-10-30) for Pixi.
- **Tone.js 15.1.22**, 2025-04-27 on the npm `latest` tag (GitHub shows a v15.1.22 release dated 2026-07-12). The `next` tag is 15.5.73 and the repo was pushed 2026-11-20. Maintained and the right tool for procedural or chiptune synthesis. It is large, so lazy-load it.
- Both Safari and Chrome need a user gesture to start audio.

## 6. Input

- `gamepad.js` 3.0.1 (2026-03-16) is the only maintained gamepad wrapper I confirmed. I did not find a widely adopted, well-maintained keyboard-mapping library. Engines (Phaser, Excalibur) have their own input abstractions, which is the realistic default. Unverified beyond this.

## 7. Asset tooling

- **Tiled** v1.12.2, 2026-05-27 (repo pushed 2026-11-21, 13k stars). Very active. Loaders: Phaser native, Excalibur `plugin-tiled` 1.0.0, melonJS native, Pixi via `pixi-tiledmap` 2.11.1.
- **LDtk** v1.5.3, 2024-01-15 (tags), repo pushed 2026-11-15. The editor is steady and mostly maintained. The npm `ldtk` package is 0.8.7 (2021), which is dead. Use Excalibur's `plugin-ldtk` 1.0.0 or generate types from the JSON schema. I did not verify a Phaser LDtk loader.
- **Texture packing:** `free-tex-packer-core` 0.3.9 (2026-07-24), TexturePacker (commercial). Aseprite pipeline details I did not verify. Phaser reads Aseprite JSON natively, but I did not fetch docs to confirm for v4.
- **glTF:** `@gltf-transform/core` 4.5.1 (2026-09-28, CLI and functions current, repo pushed 2026-10-20). Maintained. `gltfjsx` 6.5.3, 2024-11-04, repo untouched since 2024-11; stale but functional.
- **Compression:** `meshoptimizer` 1.3.0 (2026-09-25), `draco3d` 1.5.9 (2026-10-16), `ktx-parse` 2.0.0 (2026-09-05), Khronos KTX-Software (pushed 2026-11-17). All maintained.

## 8. Build and monorepo

- **Vite 8.3.8**, 2026-11-11. Vite 8 went stable 2026-03-12 with Rolldown as the single bundler; Rolldown 1.0 stable in May 2026 (now 1.3.3, 2026-11-18). Node requirement `^20.19.0 || >=22.12.0`. Sources: https://vite.dev/blog/announcing-vite8 , https://voidzero.dev/posts/announcing-rolldown-1-0
  - `rolldown-vite` 7.3.1 is deprecated on npm. Skip it.
- **Vite+ 1.7.0**, 2026-11-17. MIT licensed, exists, and is usable. Bundles Vite, Vitest, Oxlint, Oxfmt, Rolldown, tsdown and Vite Task (`vp` CLI), with monorepo `vp run` and caching. The README does not state a maturity label, but it is on a 1.x version. Source: https://github.com/voidzero-dev/vite-plus
  - Pricing: README is silent. I did not verify whether any paid tier exists.
- **pnpm 12.21.0** (2026-11-13), active. The `latest` tag is a surprisingly high major version, which I did not research. Bun workspaces were not checked.
- **Turborepo 2.11.13**, 2026-11-18. **Nx 24.0.6**, 2026-11-10. Both active. For many independent games, pnpm workspaces plus `pnpm -r`, or `vp run` caching, may be enough. Not researched further.
- **Vitest 5.1.1**, 2026-11-18.
- **Linting:** Biome 2.6.8 (2026-11-15), oxlint 1.94.0 (2026-11-16), ESLint 10.15.0 (2026-11-13), Prettier 3.10.1 (2026-11-12; 4.0 still alpha). All active.
- **TypeScript 7.0.2**, 2026-07-08 (GitHub release 2026-08-20). The native Go port shipped as TS 7. `microsoft/typescript-go` is archived (staging repo, pushed 2026-08-31) and `@typescript/native-preview` is stuck at 7.0.0-dev.20260707. Use `typescript@7`. Ecosystem plugin compatibility not verified.

## 9. Landing page and hosting

- **Astro 7.4.13**, 2026-11-18; `@astrojs/cloudflare` 14.4.9. Cloudflare acquired the Astro team on 2026-01-16 and says Astro stays open source. Source: https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-astro-to-accelerate-the-future-of-high-performance-web-development/
  - A static landing page needs no adapter. Plain Vite multi-page is also fine for a handful of links. Astro adds content-collections ergonomics if the arcade grows.
- **Many Vite builds under one host:** a standard pattern is to build each game with `base: '/games/<name>/'` and copy every `dist/` into a combined output (`public/games/<name>/` or a merged `dist/games/<name>/`). Use relative `base: './'` if you want path independence. I did not find a single canonical write-up and did not verify a specific recipe.
- **Pages limits** (https://developers.cloudflare.com/pages/platform/limits/): 20,000 files per site on Free (100,000 on paid, needs `PAGES_WRANGLER_MAJOR_VERSION=4`), 25 MiB per file, 500 builds per month on Free, 100 projects per account, `_headers` 100 rules, `_redirects` 2,000 static and 100 dynamic.
- **Workers static assets limits** (https://developers.cloudflare.com/workers/platform/limits/): 20,000 files per Worker version (100,000 on paid, needs Wrangler 4.34.0+), 25 MiB per file. Same as Pages.
- **Pages vs Workers:** see section 12.

## 10. Persistence

- **idb 8.0.4**, 2026-10-06. **idb-keyval 6.3.0**, 2026-07-08. **Dexie 4.4.7**, 2026-10-19 (repo pushed 2026-11-16). All maintained.
- **localForage 1.10.0**, 2021-08-18. Repo pushed 2024-07. Dormant, avoid for new work.
- **Safari ITP:** WebKit's ITP post says that after 7 days of Safari use without user interaction on a site, all script-writable storage is deleted, including IndexedDB and localStorage. Home Screen web apps count their own days of use, and WebKit says data loss there would be a bug. Source: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
  - Safari 17 supports `navigator.storage.persist()` and `persisted()`. Grants are heuristic, and adding to Home Screen is one heuristic. Per-origin quota is 60% of disk in the browser (15% elsewhere). Source: https://webkit.org/blog/14403/updates-to-storage-policy/
  - The 7-day rule's current scope, and whether `persist()` exempts a site from it, was not stated in the Safari 17 post. Unverified. Practical consequence: offer export and import of save files for Safari users.

## 11. 2025-2026 developments

- **WebGPU:** web.dev (Nov 2025) says it is supported in Chrome, Edge, Firefox and Safari. Safari 26 covers macOS, iOS, iPadOS and visionOS. Firefox ships it on Windows (141) and Apple Silicon macOS 26 (145), with Linux, Android and Intel Mac in progress. I found no 2026-dated update. Source: https://web.dev/blog/webgpu-supported-major-browsers
- Vite 8 and Rolldown 1.0, Phaser 4 stable, TypeScript 7 native, Cloudflare owning Astro, Excalibur 1.0.
- **Deprecated or stale to avoid:** `kaboom` (deprecated), `rolldown-vite` (deprecated), `cannon-es` (2022), `localForage` (2021), `ecsy`, `box2d-wasm` (2021), npm `ldtk` loader (2021), `@pixi/assets` 7.x line, `@react-three/offscreen` (2023). `gltfjsx` and Howler are stale but still work.
- I did not identify new game-specific frameworks that emerged in 2025-26 beyond the above.

## 12. Cloudflare free-tier limits

- **Pages vs Workers.** The Pages docs home page says "Are you sure you want to use Pages?" and "Start new projects with Workers", and calls Workers "Cloudflare's primary platform". I found no explicit deprecation or maintenance-mode wording on that page. Sources: https://developers.cloudflare.com/pages/ , https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/ . A third-party article quotes the Workers tech lead as saying Pages-specific features are being turned into general Workers features, and notes no forced migration deadline as of March 2026 (https://dev.to/rickcogley/cloudflare-pages-vs-workers-in-2026-migration-guide-ka7). Treat Pages as in de facto maintenance for new projects, though not formally deprecated. New projects should use Workers static assets. Pages is not deprecated by any official statement I found.
- **Static assets:** requests for static assets are documented as "free and unlimited" (https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). Limits: 20,000 files and 25 MiB per file on Free. Only requests that invoke the Worker script (SSR, API routes, or `run_worker_first` patterns) count against Worker billing. Free users over the limit get a 429 for those requests rather than static assets. Range requests return 200 with the full file rather than 206, which matters for large audio or video.
- **Workers Free:** 100,000 requests per day (resets 00:00 UTC, error 1027 past it), 10 ms CPU per request, 128 MB memory, 50 subrequests, 100 Workers per account. Source: https://developers.cloudflare.com/workers/platform/limits/
- **D1 Free:** 10 databases, 500 MB per database, 5 GB total, 5 million rows read per day, 100,000 rows written per day, 50 queries per invocation. Past daily limits, D1 returns errors until the reset. Sources: https://developers.cloudflare.com/d1/platform/limits/ , https://developers.cloudflare.com/d1/platform/pricing/
- **KV Free:** 100,000 reads per day, 1,000 writes per day (different keys), 1 write per second per key, 1 GB storage, 25 MiB values. Source: https://developers.cloudflare.com/kv/platform/limits/ . The 1,000 writes per day is the tightest of any storage product here.
- **Durable Objects Free:** SQLite-backed only. 100,000 requests per day, 13,000 GB-s duration per day, 5 million rows read per day, 100,000 rows written per day, 5 GB storage. Hibernating WebSockets are not billed for duration while idle. Calling `accept()` without hibernation bills duration for the full connection. Incoming WebSocket messages bill at 20:1 (100 messages is 5 requests); outgoing messages are free. Source: https://developers.cloudflare.com/durable-objects/platform/pricing/ . I did not find a per-request CPU limit on that page.
- **R2 Free tier (monthly):** 10 GB-month storage, 1 million Class A ops, 10 million Class B ops, no egress fees. Source: https://developers.cloudflare.com/r2/pricing/
- **Turnstile Free:** no cost, 20 widgets per account, 10 hostnames per widget, unlimited challenges. Source: https://developers.cloudflare.com/turnstile/plans/
- **What breaks if a game goes viral vs what just costs money:**
  - Static game files cost nothing and do not hit a request cap, so a viral static game is safe on Workers static assets (see Pages caveat below).
  - Hard stops on Free, where the product fails once the daily cap is hit: Worker invocations (100k per day), KV writes (1,000 per day), D1 writes (100k rows per day) and reads (5M per day), and Durable Object requests (100k per day). These reset at 00:00 UTC. A leaderboard written per score submission can exhaust KV writes or D1 rows written quickly.
  - Because free Workers return 429 for script-invoked requests past the cap, keep static assets served without invoking the Worker, and do not use `run_worker_first` for the whole site.
  - Paid plan removes these caps and bills per use. I did not retrieve the paid prices.
  - I did not verify whether the Pages 500 builds-per-month Free limit matters for a monorepo with many CI deploys.

## Flagged as unverified

Phaser v4 minified bundle size and v4 arcade changes; whether rex plugins work on Phaser 4; WebGPURenderer WebGL fallback in three; Babylon 8 to 9 changes; pnpm 12 and Bun workspace comparison; Vite+ maturity and pricing; Aseprite export docs; Phaser LDtk loader; current Safari 7-day rule scope relative to `persist()`; any 2026 Firefox or Safari WebGPU change after Nov 2025; Pages having an official deprecation date; per-request CPU limit for Durable Objects.

## Strongest default per category

- 2D: Phaser 4 (Excalibur 1.x as the TS-first alternative).
- 3D: three.js pinned (WebGLRenderer), or Babylon.js 9 for batteries-included.
- Physics: Phaser arcade for 2D; Rapier compat or Jolt for 3D.
- ECS: skip it, or koota/bitECS where needed.
- Audio: engine built-in, Tone.js for procedural.
- Assets: Tiled, glTF-Transform, meshopt and KTX2.
- Build: Vite 8 with pnpm workspaces, Vitest 5, TypeScript 7, plus oxlint or Biome. Vite+ is an option worth a spike.
- Landing: Astro 7 static or plain Vite, one Workers static-assets project, games built with their own `base` path.
- Persistence: idb-keyval for simple saves, Dexie for structured data, with export/import for Safari.
