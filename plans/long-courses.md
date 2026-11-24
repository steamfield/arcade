# Plan: Rush Racers long courses

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/scripts/plan_graph.py
Started: 2026-11-24. Timebox: none. Landing branch: deliver/long-courses.
Gate: `pnpm arcade check rush-racers` (~20 s uncached) and `pnpm arcade smoke rush-racers` at every phase; each changed course's bars (`pnpm arcade test rush-racers src/logic/balance/<course>-*.test.ts`) from phase 3 on, since phase 2 lengthens courses the bars were measured on and phase 3 retunes them. Filtered tests: `pnpm arcade test rush-racers <paths or @group>`. Typecheck and lint: `pnpm arcade check rush-racers --skip-tests`.
Runner: plain commands (`rr suite -- rush-racers` offloads the slow project when the machine is busy).
Worktree setup: `pnpm install --frozen-lockfile --prefer-offline`.
Executors: every lane is a foreman run on Codex `gpt-6.2-sol` (high effort), started with `--new-worktree --from <phase scaffold sha>`; its branch is `foreman/<run name>`. Codex leaves its work uncommitted; the orchestrator reviews, commits on that branch, runs `check-lane`, and merges.

## HANDOFF (paused 2026-11-24, resume here)

The run was paused to save usage. Everything below is the state at the pause and the exact steps to finish. Read this section, then `/Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/lane-dag.md` (the deliver skill's lane rules), then carry on from "Next steps". The deliver skill is `ce:deliver`; this plan is its plan, and `plan_graph.py` (path in the header) reads the lane tables.

### Where things stand

- Landing branch `deliver/long-courses` in worktree `/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses`. Nothing is pushed and nothing is merged to main. Never push or merge to main without the user's approval.
- Phase 1 (four mechanics on the test courses): done, tagged `long-courses/phase-1`. (Plain `phase-N` tags already exist in this repo for other work, so this plan's tags are `long-courses/phase-N`.)
- Phase 2 (the long courses): lanes 2/a, 2/b, 2/c, 2/d merged, plus two fix lanes:
  - lc-2y: a Float32 tie in priced steering (`ai/steer.ts`) froze swim bots in Sunlit's Jelly Field once the course had whirlpools. Fixed and merged.
  - lc-2x: Slingshot Alley stalls. A 200-seed x 8-character stall scan found the expert stuck up to 100 s at a plasma orb in the Debris Storm dust channel (col 742 row 22), and rivals frozen in nebula dust because catch-up scaled their thrust (260 x 0.6) below dust drag (166). Turn 1 (orb removed; dust drag under thrust capped at overCruise + `dustThrustShare` 0.75 of thrust; `dustCruiseMul` 0.6 -> 0.45; par 9139) is committed and merged at `900e748`.
  - lc-2x turn 2 (review fixes) WAS STILL RUNNING in Codex at the pause, in worktree `/Users/riley/Projects/games/.claude/worktrees/lc-2x`, uncommitted. Its brief is `plans/long-courses-contracts/fu-2x.md`: cap only when the stick doesn't oppose motion; move `dustCruiseMul` 0.45 to a Slingshot-only course override and put drift back to 0.6; stronger regression tests; correct the forceMul floor comment; widen the orb-free test box by the bob reach; one DESIGN.md dust line; re-measure Slingshot par and drift-test par.
- Phase 2 gate on landing (before lc-2x turn 2): `pnpm arcade check rush-racers` passed; `pnpm arcade smoke rush-racers` passed 118/118 after re-pinning `TOP_ROUTE_BROWSER_HASH` to 1567330866 (commit `18b4d90`). DESIGN.md course summaries updated (`3bf2258`). Phase 2 is NOT tagged yet: it waits for lc-2x turn 2.
- Par now (expert bot, Hard, seeds 1-200 x 8 characters, all 1600 finished): Sunlit Shallows 9271 (154.5 s), Bramble Run 9033 (150.6 s), Thunderhead Pass 9267 (154.4 s), Slingshot Alley 9139 (152.3 s; will be re-measured by lc-2x turn 2). Before this work: 132, 69, 67, 59 s.
- Stall scans (no racer stuck over 1500 ticks = 25 s): Thunderhead clean (worst 719). Slingshot clean after lc-2x turn 1 (worst 601). Bramble has 4 of 1600 races where a RIVAL (never the player) is stuck 27-32 s: rudy seed 133 bo 1923 ticks, gil 14 tess 1921, rudy 18 squib 1650, nib 93 bo 1593. Not yet traced; likely rivals dropping off the Rotten Bridges' high spans. Phase 3 lane b should look (see below). Sunlit's last scan was clean after lc-2y.
- Phase 3 scaffold committed at `2fb4b6c` (on top of the phase 2 merges): `balance/hard-bars.ts` close-win window is now `CLOSE_WIN_PAR_SHARE` 0.072 of par (8 s of the old 111 s par, about 11 s now), and `balance/race-bots.ts` budget is 10 s a race. `sunlit-shallows-rudy.test.ts` passes with it.
- Measured before phase 3 (expert, Hard, seeds 1-30): Sunlit wins 22-28 per character with median rival gap 1-4 s (fine). Bramble, Thunderhead and Slingshot: the expert wins 26-30 of 30 with a median gap of 8-13 s, so the close-win bar (16 of 30 within ~11 s) will fail for many characters on Bramble and Thunderhead and some on Slingshot. The fix is course data: each course can set its own `catchUp` override (see Slingshot's catch-up comment in `slingshot-alley.ts` and `Course.catchUp`), or layout. Bars are read-only.
- Old foreman worktrees still on disk (kept for reference, all merged or superseded): lc-1a..lc-1d, lc-1z, lc-2a..lc-2d, lc-2x, lc-2y under `/Users/riley/Projects/games/.claude/worktrees/`. Remove them only after the final merge to main (`git worktree remove <path>` and `git branch -D foreman/<name>`).
- Contract templates for dispatching Codex lanes are in `plans/long-courses-contracts/`: `common-head.md`, `common-tail.md` and `build.py` built the phase 2 contracts (`lc-2a.md` is one built example; `lc-2x.md` is a single-fix contract). Phase 3 contracts can be built the same way from the phase 3 lane briefs below. Delete this folder when the plan moves to `plans/done/`.

### How lanes are run (conventions used so far)

- Executors are Codex `gpt-6.2-sol` through foreman: `foreman guide` first in a session; `foreman start <name> --new-worktree --from <scaffold sha> --setup "pnpm install --frozen-lockfile --prefer-offline" --contract <file> --write --model gpt-6.2-sol --budget 180m`; `foreman wait <names> --timeout 60m` as a background task; `foreman answer <run> qN "..."` for questions; `foreman followup <run> --file <brief>` for review fixes; `foreman result <run>` for the hand-off; `foreman archive <run> --keep-worktree` after merging.
- Codex leaves work uncommitted. The orchestrator reads the diff, runs the lane's covering tests plus `pnpm arcade check rush-racers --skip-tests`, commits by path on `foreman/<run>` (never `git add -A`), and merges into landing with `git merge --no-ff foreman/<run> -m "phase N: merge lane x (...)"`, then `python3 <plan_graph> mark plans/long-courses.md N/x merged` and commits the plan.
- Every lane gets a lane review: the "Lane review" prompt from `.../ce/6.0.4/shared/dispatch-prompts.md`, as a `ce:code-reviewer` agent on opus, given the merge commit range. Triage findings; send the ones that hold back to the same foreman run with `foreman followup`.
- Par numbers must be measured over all 200 seeds x 8 characters (`node games/rush-racers/scripts/measure.ts par <course>`, ~12 min); lanes have tended to measure 40 seeds, so check.
- Smoke browser hashes (`tests/smoke.spec.ts`) are re-pinned only by the orchestrator at a phase gate, each with a sentence saying why.

### Next steps, in order

1. Finish lc-2x turn 2.
   - `foreman status lc-2x`. If still running, `foreman wait lc-2x --timeout 60m` (background). If it stopped on a question, answer it.
   - `foreman result lc-2x` and read the hand-off. Check: drift `dustCruiseMul` back to 0.6 in `media/drift/tuning.ts`; Slingshot has `tuning: { extra: { dustCruiseMul: 0.45 } }` with a comment; the opposing-stick case brakes at least as hard as idle; the new tests fail when the rule is broken; Slingshot PAR_TICKS re-measured over 200 seeds and in 9000-10200; drift-test par back to about 1006 (`--seeds 20`); no stall over 1500 in its scan.
   - In `/Users/riley/Projects/games/.claude/worktrees/lc-2x`: `pnpm arcade test rush-racers src/logic/media src/logic/courses @seams src/logic/top-route.test.ts` and `pnpm arcade check rush-racers --skip-tests`; commit the 7 changed files by path ("lane 2/x: review fixes (...)"); merge into landing with `--no-ff`; `foreman archive lc-2x --keep-worktree`.
   - Add a log line for lc-2x and lc-2y to "## Log" below.
2. Phase 2 gate and tag, on landing:
   - `pnpm arcade check rush-racers` and `pnpm arcade smoke rush-racers`. If `DRIFT_WELLS_BROWSER_HASH` or another browser pin moves, check all three browsers agree, re-pin with a sentence, commit.
   - Look at one `pnpm arcade see` frame per course in a new section (e.g. `pnpm arcade see rush-racers --scene race --query course=slingshot-alley --input "right*2400" --at 2400`; read the frame from the printed `run:` folder).
   - `python3 <plan_graph> tag plans/long-courses.md 2 long-courses/phase-2`, commit the plan, tell the user in one line.
3. Phase 3 scaffold line: the scaffold commit `2fb4b6c` is already on landing, but phase 3 lanes must start from landing HEAD after step 2 (so they include lc-2x). Add `Scaffold: <landing HEAD sha after step 2>` under "Depends on: phase 2" in the Phase 3 section, run `python3 <plan_graph> validate plans/long-courses.md` and `ready`, commit.
4. Phase 3 lanes (4 Codex runs in parallel, one per course, briefs in the Phase 3 section): build each contract from `common-head.md`/`common-tail.md` adapted to phase 3 (owns: the course file and theme exactly as the Phase 3 table says; paste the phase 3 rules; bars read-only; done = all of `src/logic/balance/<course>-*.test.ts` pass and par stays in 9000-10200 over 200 seeds). Add to each contract:
   - The pre-phase-3 margin measurement above, and that a course's `catchUp` override in its course file is in scope (it is course data) for the close-win bar.
   - Lane b (Bramble): trace the four rival stalls listed above (`race()` in `balance/race-bots.ts` returns `longestStall`; find where with a scratch script that steps `createWorld`/`stepWorld` and records the racer's position when its progress stops improving) and fix them in the layout if they come from a course spot.
   - Phase 2 lanes noted: on Easy, toddlers win almost every race; Gil is the slowest toddler on Thunderhead; rivals sometimes drop off Bramble's high bridge.
   - Lanes may run only their own bar files, a few at a time, never `@bars` or the whole suite.
   Dispatch, lane-review each, merge, mark merged.
5. Phase 3 gate: `pnpm arcade check rush-racers`, every `src/logic/balance/*-*.test.ts` for the four courses (slow: run per course, or `rr suite -- rush-racers`), `pnpm arcade smoke rush-racers`, re-pin browser hashes if needed, tag `long-courses/phase-3`.
6. Exercise as a user: `pnpm arcade dev rush-racers`, race each course on Normal from the title (or drive it with `pnpm arcade see` inputs) and check the section banners show, each new landmark is readable, the race takes 2-3 minutes, and results/best times save (old bests cleared by the v7 save migration). Already checked: the PRESS FIRE hint staying up on Easy is by design (`engine/view/hints.ts`), not a bug.
7. Final review: dispatch the "Final review" prompt from `dispatch-prompts.md` on `git diff main...deliver/long-courses`, naming the skills `architecting-systems`, `writing-tests`, `game-feel`, `phaser-game`. Triage, fix (Codex followups or inline), at most one "Fix review", then the full gate again.
8. Docs before merge: DESIGN.md (course summaries done; check the dust line and any phase 3 changes), COURSES.md (set-piece fields already documented; add anything the lanes reported), `docs/repo-map.md` if files were added under packages/tools/apps/templates (none so far).
9. Report to the user: what each phase delivered and its tag, what reviews caught and what was rejected, anything open, how to try it (`pnpm arcade dev rush-racers`, `/games/rush-racers/`). Include the design research summary with sources: SuperTuxKart track design guidelines, Game Developer (pacing and intensity curves in racing level design), 34BigThings (racing track design), Apple's App Store story on Asphalt 9 (short race sessions), Giant Bomb (genre race lengths), Magnopus (level design rhythm and landmarks). Then ask the user to approve a local merge to main. Push nothing.
10. After approval: merge `deliver/long-courses` into main locally; remove the foreman worktrees and branches listed above and the landing worktree; move this plan to `plans/done/` with a `Status: done` line; delete `plans/long-courses-contracts/`.


## Spec

Rush Racers' four listed courses are too short: a good racer (par, the expert bot on Hard) finishes Bramble Run in about 69 s, Thunderhead Pass in 67 s, Slingshot Alley in 59 s and Sunlit Shallows in 132 s. The user wants a race to take 2 to 5 minutes. This work lengthens every listed course to a par of 150-170 s (9000-10200 ticks), so a good racer takes about 2.5-2.8 minutes, a typical player 3-4 and a slow child on Easy up to about 5, and makes the new stretches the most memorable part of each course by giving each world one new mechanic built for them.

Design research that shaped the sections (sources in the final report):
- A race needs an intensity curve, not a flat line: start low, rise, dip for a rest beat, then build to the hardest stretch near the end and a short release at the finish. Rest beats are what make the peaks read as peaks, and a course made only of tricky sections tires players.
- Teach, test, twist: each new idea appears first alone and safe, then under pressure, then combined with something the player already knows.
- Route splits create decisions. The hardest bits belong on the risky shortcut, never on the only way through, so a struggling player always has a safe road and an expert always has a faster one.
- Each section needs a landmark the player remembers it by (a hollow oak, a gas giant, a battery of cloud cannons), and alternating technical and fast stretches gives a race rhythm.
- Commercial arcade racers run 2-3 minute races and 60-90 s laps; this game's courses are point to point, so length comes from more sections, not laps.

In scope:
- Target par 150-170 s on all four listed courses. Each course gains new sections inserted so the course's existing hardest stretch or a new one sits near the end; the opening columns stay as they are (scenarios pin them).
- One new mechanic per world, each a course set piece in `logic/setpieces/`: Reef whirlpools, Thornwood crumbling branches, Cloudreach cloud cannons, Farside wormholes. Rivals understand each one.
- `RACE_LIMIT_TICKS` goes from 18000 (5 min) to 28800 (8 min), so slow players on the longer courses finish instead of timing out.
- Save v6 -> v7 drops the saved bests for the four listed courses (they were set on the short layouts and could never be beaten). Everything else in the save is kept.
- A new unlisted test course, Reef Test (`reef-test`), so the whirlpool's mechanics scenario does not depend on Sunlit Shallows' layout, as Run Test, Sky Test and Drift Test do for theirs.
- Every listed course re-measures par and passes all its difficulty bars again.

Out of scope: new listed courses or worlds, roster or item changes, laps, How to Play pages for the new mechanics (each course teaches them in its own teach section), online protocol changes beyond what the simulation build id already covers, music.

Assumptions (user can override):
- Phase 1 lanes write their own tests from the test-case list below, as the last sprint's set-piece lanes did; the numbers a test pins (forces, timings) are each lane's tuning, so the scaffold commits contracts and parse/registration tests, and the orchestrator checks each lane's tests against the case list at landing.
- New set pieces work in any medium (as vents do); each is only placed in its own world.
- Sections are named in each world's voice; names below are working names a lane may improve (upper case, at most 18 characters).

Error model: course data that names a bad set piece (off the map, on the wrong cell, overlapping, out-of-range numbers) throws `LevelError` with its position from `parseLevel`, like lightning zones, wells and vents. Engine views never throw on a level without the set piece. Logic stays deterministic: no `Math.random`, `Date`, `**` or inexact `Math` members (`logic/num.ts`); set piece state lives on `World`, so `hashWorld`'s generic walk covers it. A save that fails to parse is never overwritten (`@arcade/save`).

### Intensity curves (1 calm .. 9 hardest; NEW marks inserted sections)

Sunlit Shallows (par 132 -> ~160 s; about +150 columns at ~5.4 columns/s):
THE REEF 2, CURRENT HIGHWAY 3, JELLY FIELD 5, THE SURFACE 4, NEW THE MAELSTROM 6, URCHIN GAUNTLET 6, CORAL GATE 6, THE DARK CAVE 8.

Bramble Run (par 69 -> ~160 s; about +600 columns at ~7 columns/s, plus climbing):
THE FOREST FLOOR 3, THE TREETOPS 5, NEW THE MILLSTREAM 3, NEW THE HOLLOW OAK 6, THE ROOT CAVE 7, NEW THE ROTTEN BRIDGES 8, THE CLEARING 2.

Thunderhead Pass (par 67 -> ~160 s; about +750 columns at ~10 columns/s, plus climbing):
THE CLOUD BANK 3, THE TWO ROADS 5, NEW SUNBREAK 3, NEW THE CROW CLIFFS 6, NEW THE CANNON CLOUDS 7, THE STORM CELL 8, CLEAR SKIES 2.

Slingshot Alley (par 59 -> ~160 s; about +800 columns at ~10 columns/s, less where it is technical):
LAUNCH LANE 2, THE ICE GATE 4, THE DUST FIELD 5, SOLAR WIND LANE 4, NEW THE GAS GIANT 4, NEW THE DEBRIS STORM 7, MOON SHADOW 7, NEW THE WORMWAYS 7, BLACK HOLE SPLIT 9, the run home 2.

### The four mechanics

- Whirlpools (Reef). A swirl of water a few tiles across that carries a swimmer round its centre. Swim with the spin along its forward-moving side and it flings you on at well over cruise speed; cross it against the spin and you crawl. A strong swimmer heading outward always escapes. Rivals route along the side that helps.
- Crumbling branches (Thornwood). Rotten branch ledges that shake when a runner lands on them and drop away a moment later, then grow back a few seconds after. The leader breaks the high road for whoever is right behind, who either keeps moving over the shaking wood or takes the slower way underneath. Every crumbling branch has a way on below it.
- Cloud cannons (Cloudreach). Fly into a cloud cannon and it catches you, holds you a beat, then fires you along its fixed aim at high speed for a set time. Batteries of cannons aimed at different roads make a route choice; a cannon can fire into another to turn a corner.
- Wormholes (Farside). Paired mouths: drift into one and you come out of the other with your speed and heading kept. Some are two-way, some one-way (drawn differently). One is a shortcut, one a loop back, one a slingshot exit inside a planet's pull.

## Contracts (scaffold commit)

Committed in the phase 1 scaffold, read-only to lanes:

- `logic/types.ts`: `WhirlpoolDef { col; row; radius; spin: 1 | -1; push }` (radius in tiles; spin 1 turns clockwise on screen, so water moves right along the top; push the peak tangential acceleration in px/s²), `CrumbleDef { col; row; length }` (a run of ledge tiles from (col, row) rightward), `CannonDef { col; row; dir: readonly [dx, dy]; speed; flightTicks }` (dx, dy each -1, 0 or 1, not both 0; speed px/s), `WormholeDef { a: readonly [col, row]; b: readonly [col, row]; oneWay: boolean }`. `LevelDef` gains optional `whirlpools`, `crumbles`, `cannons`, `wormholes`; `Level` gains the same four as arrays (empty when left out). `World` gains `crumbles: CrumbleState[]` (`{ phase: 'solid' | 'shaking' | 'fallen'; ticks: number }`, one per `Level.crumbles` entry), `fallen: ReadonlySet<number>` (tile indices of fallen crumbling branches), `cannonRides: CannonRide[]` (`{ racer: RacerId; cannon: number; held: number; flight: number; reload: number }`) and `warps: WarpCooldown[]` (`{ racer: RacerId; ticks: number }`).
- `logic/events.ts`: `whirlpool.caught { racer, pool }`, `crumble.shook { crumble }`, `crumble.fell { crumble }`, `crumble.regrew { crumble }`, `cannon.loaded { racer, cannon }`, `cannon.fired { racer, cannon }`, `wormhole.warped { racer, hole, from: 'a' | 'b' }`.
- `logic/level/parse.ts` calls `parseWhirlpools`, `parseCrumbles`, `parseCannons`, `parseWormholes` (each in its set piece module, given the def list and the parsed grid, returning the checked array or throwing `LevelError`).
- `logic/world.ts`: `createWorld` fills the new `World` fields; the tick order calls `swirlWhirlpools`, `crumbleBranches`, `fireCannons`, `warpWormholes` after `strikeAsteroids`, before contacts; `moveRacer` first calls `rideCannon(world, racer, dt)` and skips the medium's movement (intent, latch, undertow, dash, trapped drift, `moveBody`, `afterMove`) for a racer it moved; `toAscii` shows a fallen branch as open.
- Fallen branches reach movement through `MoveRules`: `MoveRules.openLedges` (ledge tiles that hold nothing this tick) is `world.fallen` in `moveRulesFor(world)`, and `ledgeHolds(level, rules, tx, ty)` in `level/query.ts` is the race-time ledge test. Every caller that lands things on ledges (`race/move.ts`, the Boulder, the Mud Pie, loose pickups, run's terrain, pilot and respawn) switches from `isLedge` to it in lane b.
- `logic/race/flowfield.ts`: `NavLink { from: Vec; to: Vec; cost: number }` and `distancesToFinish(level, broken, cost, links = [])`. Links are forced: a racer entering `from` is carried to `to`, so `from`'s value is exactly `cost + distance(to)` and no neighbour reaches the finish through `from`. A loop-back mouth therefore prices high and rivals steer round it; a shortcut mouth prices low and they steer into it. A `from` tile is a sink in the field (no lower neighbour); `ai/steer.ts`'s `downhillPath` stops there, which is right because the racer is carried off on entering. Implemented and tested in the scaffold; media pass their own links.
- `logic/setpieces/{whirlpools,crumbles,cannons,wormholes}.ts`: stubs exporting the parse function (given the def list and the parsed `cells`), the tick function, `createCrumbles`, `rideCannon` and a constants object; a stub throws "not implemented" only when its level has data for it, so the gate stays green.
- `logic/courses/reef-test.ts` registered in `courses/index.ts` and `ShippedCourseId`: unlisted, world `reef`, theme `ocean`, song `race`, a plain stub level (starts, open water, finish).
- `logic/race/standings.ts`: `RACE_LIMIT_TICKS = 28800`.
- `logic/save.ts`: `SAVE_VERSION = 7`, `migrations[6]` drops `bests` entries for `sunlit-shallows`, `bramble-run`, `thunderhead-pass`, `slingshot-alley`; the committed `save-v6.json` (captured from v6, with a Sunlit best) is untouched, `save-v7.json` is added, and the save tests assert old saves lose their Sunlit bests at v7.
- Hash pins re-pinned for the new `World` keys in `top-route.test.ts`. Smoke's browser hashes (`TOP_ROUTE_BROWSER_HASH`, `DRIFT_WELLS_BROWSER_HASH` in `tests/smoke.spec.ts`) belong to the orchestrator, who re-pins them at each phase gate where a lane changed the simulation.
- Phase 1 boundary fixes (lc-1z): `rideCannon` returns `MoveContacts | null` and `moveRacer` runs the medium's `afterMove` on a ride's contacts; cannons chain (a shot reaching another ready barrel is caught there, and `traceCannonShot` returns its `receiver`), and flight nav prices a chain that loops through reloading barrels; `World.whirlpoolRiders` is required and always hashed; `wormholeLinks(level, stepCost, warpCost)` in `race/wormhole-links.ts` prices wormholes for drift nav and the progress field alike; set-piece parse errors go through `requireTile` (`level/level-error.ts`) and `isOpenCell` (`level/query.ts`) with one "Kind index field: expected x, got y" shape.
- Cost of the 8-minute limit: `IDLE_TO_RESULTS` (`scenarios/kit.ts`) waits the whole limit, so course.spec, dnf-results and `runtime.test.ts`'s idle race run about 60% longer. Accepted; revisit only if smoke time becomes a problem.

Layout of new modules:

    games/rush-racers/src/
      logic/setpieces/whirlpools.ts   parses whirlpools; tangential push on racers inside one; whirlpool.caught
      logic/setpieces/crumbles.ts     parses crumbling branches; shake/fall/regrow timers; the only writer of World.fallen
      logic/setpieces/cannons.ts      parses cloud cannons; catch, hold, fire and ride; World.cannonRides
      logic/setpieces/wormholes.ts    parses wormholes; warps a racer between mouths; World.warps cooldowns
      logic/courses/reef-test.ts      Reef Test, the unlisted course swim's set piece scenarios run on
      engine/view/set-pieces/whirlpool-view.ts, crumble-view.ts, cannon-view.ts, wormhole-view.ts
                                      each draws its set piece as a theme extra layer (ThemeLayer.sync)

## Phases

### Phase 1: four new mechanics on the test courses (MVP)

Scaffold: e2886b32cf4482c53bf5934998989efeab55705c
Tag: long-courses/phase-1
Demo: `pnpm arcade see rush-racers --scenario <whirlpool-ride|crumble-bridge|cannon-launch|wormhole-warp>` each shows its mechanic working, with a rival on its test course using it.
Test cases (each lane writes these as logic tests unless marked scenario):
- Whirlpools: each parse error (centre off the map or not open water, radius outside 2-10, push not positive, spin not 1 or -1, two pools whose discs overlap); a racer inside the radius is pushed along the spin, one outside is not; with the spin on the forward side a racer moves faster than cruise, against it slower; a racer swimming outward at full force from any point inside escapes within a bounded time; `whirlpool.caught` fires once per entry; a fallen or finished racer is not pushed; swim nav prices a pool's tiles so the steer field favours the forward side; scenario `whirlpool-ride` on Reef Test.
- Crumbling branches: each parse error (off the map, a tile in the run not a ledge, length outside 1-12, two runs sharing a tile); a racer landing on a solid branch starts its shake (`crumble.shook`) and it stays solid while shaking; it falls after the shake (`crumble.fell`), its tiles are in `World.fallen` and a racer on it drops through; it regrows after its fallen time (`crumble.regrew`) but not while a racer overlaps it; a branch nobody stood on never shakes; a rival on Run Test with the branch fallen still reaches the finish (no 600-tick stall); scenario `crumble-bridge` on Run Test.
- Cloud cannons: each parse error (off the map, tile not open, dir 0,0 or outside -1..1, speed or flightTicks out of range, two cannons on one tile); a racer entering the tile is caught (`cannon.loaded`), held at the centre, then fired (`cannon.fired`) along dir at speed for flightTicks, ignoring flaps and gravity; the flight ends early against solid; the same racer is not re-caught by that cannon during its reload; two racers can ride two cannons at once; a finished or fallen racer is not caught; flight nav gives a cannon a link so a rival takes it when it is quicker; scenario `cannon-launch` on Sky Test.
- Wormholes: each parse error (a mouth off the map or not open, mouths of one hole under 4 tiles apart, mouths of different holes under 3 tiles apart); a racer whose centre enters mouth a comes out at mouth b with velocity unchanged (`wormhole.warped`); with `oneWay` false it works both ways, with true only a to b; the cooldown stops an immediate warp back; drift nav links the mouths so a rival takes a shortcut hole; the local camera cuts to the exit instead of panning across; scenario `wormhole-warp` on Drift Test.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/setpieces/whirlpools.ts, games/rush-racers/src/logic/setpieces/whirlpools.test.ts, games/rush-racers/src/logic/media/swim/, games/rush-racers/src/logic/courses/reef-test.ts, games/rush-racers/scenarios/whirlpool-ride.ts, games/rush-racers/src/engine/themes/ocean.ts, games/rush-racers/src/engine/themes/ocean/, games/rush-racers/src/engine/view/set-pieces/whirlpool-view.ts, games/rush-racers/src/engine/view/set-pieces/whirlpool-view.test.ts, games/rush-racers/src/logic/ai/steer.ts, games/rush-racers/src/logic/types.ts | contracts, games/rush-racers/src/logic/setpieces/vents.ts | | sol 6.2 | merged | foreman/lc-1a | whirlpool tests, @courses, @media and the scenario pass |
| b | M | games/rush-racers/src/logic/setpieces/crumbles.ts, games/rush-racers/src/logic/setpieces/crumbles.test.ts, games/rush-racers/src/logic/race/move.ts, games/rush-racers/src/logic/race/ledge.test.ts, games/rush-racers/src/logic/powerups/cannonball/boulder.ts, games/rush-racers/src/logic/powerups/twists/mud-pie.ts, games/rush-racers/src/logic/pickups/loose.ts, games/rush-racers/src/logic/media/run/, games/rush-racers/src/logic/courses/run-test.ts, games/rush-racers/scenarios/crumble-bridge.ts, games/rush-racers/scenarios/boulder-roll.ts, games/rush-racers/scenarios/crate-from-below.ts, games/rush-racers/scenarios/ledge-jump.ts, games/rush-racers/scenarios/mud-pie.ts, games/rush-racers/scenarios/mushroom-bounce.ts, games/rush-racers/scenarios/pit-respawn.ts, games/rush-racers/scenarios/stomp.ts, games/rush-racers/src/engine/themes/forest.ts, games/rush-racers/src/engine/themes/forest/, games/rush-racers/src/engine/view/level-view.ts, games/rush-racers/src/engine/view/set-pieces/crumble-view.ts, games/rush-racers/src/engine/view/set-pieces/crumble-view.test.ts | contracts, games/rush-racers/src/logic/race/coral.ts | | sol 6.2 | merged | foreman/lc-1b | crumble tests, @courses, @media and every Run Test scenario pass |
| c | M | games/rush-racers/src/logic/setpieces/cannons.ts, games/rush-racers/src/logic/setpieces/cannons.test.ts, games/rush-racers/src/logic/media/flight/, games/rush-racers/src/logic/courses/sky-test.ts, games/rush-racers/scenarios/cannon-launch.ts, games/rush-racers/scenarios/flight-flap-glide.ts, games/rush-racers/scenarios/flight-dash-puff.ts, games/rush-racers/scenarios/flight-bounce.ts, games/rush-racers/scenarios/flight-fall-respawn.ts, games/rush-racers/scenarios/flight-ring-boost.ts, games/rush-racers/scenarios/headwind.ts, games/rush-racers/scenarios/meteor-strike.ts, games/rush-racers/scenarios/wind-shift.ts, games/rush-racers/src/engine/themes/sky.ts, games/rush-racers/src/engine/themes/sky/, games/rush-racers/src/engine/view/set-pieces/cannon-view.ts, games/rush-racers/src/engine/view/set-pieces/cannon-view.test.ts | contracts, games/rush-racers/src/logic/setpieces/vents.ts | | sol 6.2 | merged | foreman/lc-1c | cannon tests, @courses, @media and every Sky Test scenario pass |
| d | M | games/rush-racers/src/logic/setpieces/wormholes.ts, games/rush-racers/src/logic/setpieces/wormholes.test.ts, games/rush-racers/src/logic/media/drift/, games/rush-racers/src/logic/courses/drift-test.ts, games/rush-racers/scenarios/wormhole-warp.ts, games/rush-racers/scenarios/asteroid-hit.ts, games/rush-racers/scenarios/comet-bend.ts, games/rush-racers/scenarios/drift-bounce.ts, games/rush-racers/scenarios/drift-coast.ts, games/rush-racers/scenarios/gravity-bomb.ts, games/rush-racers/scenarios/hole-respawn.ts, games/rush-racers/scenarios/well-swing.ts, games/rush-racers/scenarios/well-pull.ts, games/rush-racers/src/engine/themes/space.ts, games/rush-racers/src/engine/themes/space/, games/rush-racers/src/engine/view/set-pieces/wormhole-view.ts, games/rush-racers/src/engine/view/set-pieces/wormhole-view.test.ts, games/rush-racers/src/engine/view/camera.ts, games/rush-racers/src/engine/view/camera.test.ts | contracts, games/rush-racers/src/logic/setpieces/asteroids.ts | | sol 6.2 | merged | foreman/lc-1d | wormhole tests, @courses, @media and every Drift Test scenario pass |

Rules every phase 1 lane follows (pasted into each contract):
- Logic stays deterministic (see Error model). Set piece state only in the `World` fields the scaffold added.
- Invulnerable, fallen (`racer.status.fallen`), finished and taken-out racers are handled as vents and asteroids handle them.
- Rivals: the medium's nav and pilot (owned by the lane) must make rivals use the mechanic sensibly and never stall on it; course conformance (`@courses`) fails a racer that goes 600 ticks without progress.
- Engine: draw the set piece as a theme extra layer (`extraLayers` in the theme file, `ThemeLayer.sync(world)` each frame, advanced from `world.tick` so a `see` capture is frame-split independent); under reduced motion it holds still but stays readable. Don't edit `scenes/race.ts`, `engine/audio/` or `engine/fx/`: report the sounds and effects you want, and the orchestrator adds them at landing.
- Your test course: add the mechanic past the course's documented features and update its layout comment; re-measure its par with `node games/rush-racers/scripts/measure.ts par <course> --seeds 40` if its length changed. Every existing scenario on your test course is yours and must keep passing (`pnpm arcade see rush-racers --scenario <name>` for each; adjust one only where the new stretch moved something it relied on, and say why). Smoke's pinned browser hashes are the orchestrator's: report if you expect yours to move. The listed course of your world is not yours in this phase.
- Don't edit DESIGN.md, COURSES.md, MAP.md or docs/repo-map.md; report the text they need.

#### Lane a brief (Reef: whirlpools)

- Goal: Reef gets whirlpools, swirls of water that carry a swimmer round their centre: a fast ride on the side going your way, a slog across it the other way.
- Interface: implement `parseWhirlpools`, `swirlWhirlpools` and `WHIRLPOOL` (constants) in `logic/setpieces/whirlpools.ts` against the scaffold's `WhirlpoolDef`. Push: a racer whose centre is within `radius` tiles of the pool centre gets a tangential acceleration in the spin direction, peaking at about mid-radius and fading to zero at the rim and near the eye, plus a small inward pull so the pool reads as a drain; pick the profile and the inward share, and say why. Velocity change goes through the racer's body as vents push (read `setpieces/vents.ts`). `whirlpool.caught` fires on the tick a racer's centre enters a radius.
- Rivals: in `media/swim/` price each tile inside a pool by the flow at its centre the way currents are priced (`alongCost` in `race/flowfield.ts`), so the steer field routes rivals along the forward side.
- Reef Test (`logic/courses/reef-test.ts`, stub in the scaffold): write its level: a short open-water run with one pool on the main line with its forward side toward the finish, pearls along that side, a rock island so the way round the other side exists, and the finish. Document it column by column like Run Test. Measure its par.
- Engine: `engine/view/set-pieces/whirlpool-view.ts` draws each pool as a spiral of streaks turning with the spin and a foam rim, from the ocean theme's palette (`engine/themes/ocean/`); reduced motion shows the spiral still.
- Scenario `scenarios/whirlpool-ride.ts` on `?course=reef-test`: the player swims into the pool on its forward side and comes out further along, faster than a swimmer who went round.
- Out of scope: Sunlit Shallows, items, rival item logic.
- Done when: `pnpm arcade test rush-racers src/logic/setpieces/whirlpools.test.ts src/engine/view/set-pieces/whirlpool-view.test.ts @courses @media` passes, `pnpm arcade check rush-racers --skip-tests` passes, `pnpm arcade see rush-racers --scenario whirlpool-ride` passes and you have looked at its frames.

#### Lane b brief (Thornwood: crumbling branches)

- Goal: Thornwood gets rotten branches that give way under a runner and grow back, so the leader breaks the high road for whoever is right behind.
- Interface: implement `parseCrumbles`, `crumbleBranches` and `CRUMBLE` in `logic/setpieces/crumbles.ts`. Timing: a racer standing on any tile of a solid branch (supported by it from above) starts `shaking` for about 40 ticks (`crumble.shook`; still solid), then it is `fallen` for about 300 ticks (`crumble.fell`; its tiles go into `World.fallen`), then it regrows (`crumble.regrew`) once no racer's box overlaps any of its tiles. `crumbles.ts` is the only writer of `World.fallen`. The scaffold already puts `world.fallen` into `MoveRules.openLedges` and adds `ledgeHolds(level, rules, tx, ty)`; switch every race-time ledge test you own from `isLedge` to it: `race/move.ts`, `powerups/cannonball/boulder.ts`, `powerups/twists/mud-pie.ts`, `pickups/loose.ts`, and `media/run/` (terrain, pilot, respawn), so a Boulder, a Mud Pie or a loose pearl on a branch drops when it falls too.
- Rivals: run nav (`buildNav`, the run links and their cache) does not see `fallen`, and that stays so: no nav rebuild when a branch falls or regrows. Rivals plan through crumbling branches as ledges; in `media/run/`'s pilot, a rival whose next link lands on or runs over a fallen tile treats that link as unavailable this tick (the pilot reads `world.fallen`) and takes its next best, so it never loops under a fallen branch. Every crumble a course places has a way on below it; enemies don't stand on crumbles.
- Run Test: add a two-height stretch past its documented features: a crumbling branch over a shallow dip whose floor leads on, and document it.
- Engine: in `engine/view/level-view.ts`, sync the branch tiles from `world.fallen` every frame (hide what is in it, show what isn't), not from events, so a world started mid-race by a debug stage or a missed event never leaves the tilemap out of step; `engine/view/set-pieces/crumble-view.ts` draws the shake (a jitter and falling bark bits) and the regrow (a quick sprout), forest palette.
- Scenario `scenarios/crumble-bridge.ts` on `?course=run-test`: the player crosses the branch, it falls behind them, and a rival just behind takes the low way and still finishes.
- Out of scope: Bramble Run, and any change to items beyond switching their ledge test to `ledgeHolds`.
- Done when: `pnpm arcade test rush-racers src/logic/setpieces/crumbles.test.ts src/logic/race src/engine/view/set-pieces/crumble-view.test.ts @courses @media` passes, `pnpm arcade check rush-racers --skip-tests` passes, `pnpm arcade see rush-racers --scenario crumble-bridge` passes and you have looked at its frames.

#### Lane c brief (Cloudreach: cloud cannons)

- Goal: Cloudreach gets cloud cannons that catch a flyer, hold it a beat and fire it along a fixed aim, so batteries of cannons make route choices and spectacle.
- Interface: implement `parseCannons`, `fireCannons`, `rideCannon` and `CANNON` in `logic/setpieces/cannons.ts`. `fireCannons` (after movement) catches: a racer whose centre is in a cannon's tile, with no ride and no reload on that cannon, gets a ride (`cannon.loaded`) and is snapped to the tile centre with zero velocity; it also counts reloads down. `rideCannon` (called by `moveRacer` before the medium moves a racer, which it skips when this returns true) moves a riding racer: while held (about 18 ticks) it stays at the centre; on the tick the hold ends it fires (`cannon.fired`) and from then sets velocity to `dir` (normalised) times `speed` and moves the body with `moveBody` for `flightTicks`, ending the flight early when the move's contacts show it stopped by a solid. Flaps, glides, dives, gravity, dashes and latches do nothing during a ride because the medium never runs for it. After the flight that racer can't be caught by that cannon for a reload of about 60 ticks. A hit during a ride stuns as usual and the ride carries on. If flight's own per-tick bookkeeping (fall-out, the pilot's memory) misreads a rider, fix that inside `media/flight/` and say how.
- Rivals: in `media/flight/` give each cannon a `NavLink` from its tile to the tile where its flight ends (about `speed * flightTicks / 60` px along `dir`, cut short at solid), costed in the field's units from the hold and flight time. Links are forced (see Contracts), so a cannon aimed somewhere slow prices high and rivals fly round it; make the pilot steer into a cannon tile the field sends it to.
- Sky Test: add a cannon past its documented features that fires over a wall too tall to flap over in time, and document it.
- Engine: `engine/view/set-pieces/cannon-view.ts` draws each cannon as a puffy cloud barrel aimed along `dir`, swelling while it holds a racer and puffing on fire, with a short streak behind a riding racer; sky palette.
- Scenario `scenarios/cannon-launch.ts` on `?course=sky-test`: the player flies into the cannon, is fired over the wall and lands past it ahead of where flapping would have got them.
- Out of scope: Thunderhead Pass, items, the Meteor.
- Done when: `pnpm arcade test rush-racers src/logic/setpieces/cannons.test.ts src/engine/view/set-pieces/cannon-view.test.ts @courses @media` passes, `pnpm arcade check rush-racers --skip-tests` passes, `pnpm arcade see rush-racers --scenario cannon-launch` passes and you have looked at its frames.

#### Lane d brief (Farside: wormholes)

- Goal: Farside gets wormholes, paired mouths that carry a drifting racer from one to the other with its speed and heading kept, for shortcuts, loop-back traps and slingshot exits.
- Interface: implement `parseWormholes`, `warpWormholes` and `WORMHOLE` in `logic/setpieces/wormholes.ts`. A racer whose centre comes within `WORMHOLE.mouthRadius` (about one tile) of an entry mouth (a; b too unless `oneWay`), with no entry in `World.warps`, is moved so its centre is at the other mouth's centre, velocity unchanged, and gets a warp cooldown of about 45 ticks (`World.warps`); `wormhole.warped` fires. Warping while stunned is fine; finished racers don't warp.
- Rivals: in `media/drift/` give each entry mouth a `NavLink` to its exit costed at about one tile. Links are forced (see Contracts), so the field routes rivals into a shortcut hole and round a loop-back one; make the pilot steer into a mouth it means to take and give a loop-back mouth room. Warp when the racer's centre tile is the mouth's tile or within `WORMHOLE.mouthRadius`, whichever you pick, as long as a rival steering at the mouth's tile is warped on reaching it.
- Drift Test: add a wall past its documented features with a two-way wormhole through it and a one-way hole that loops back before it, and document it.
- Engine: `engine/view/set-pieces/wormhole-view.ts` draws each mouth as a turning ring, each hole in its own colour from the space palette, a one-way exit drawn without the inward swirl so it reads as exit only, and a flash at both mouths on `wormhole.warped`. In `engine/view/camera.ts`, cut the camera instead of easing when its target jumps further than a few screens' worth in one update (the rig is built in `scenes/race.ts` from the body alone, which you don't own, so detect the jump inside the rig's `update`); this covers a warp and any long respawn.
- Scenario `scenarios/wormhole-warp.ts` on `?course=drift-test`: the player enters the two-way hole and comes out the far side with its speed kept, then finishes.
- Out of scope: Slingshot Alley, comets or other shots through wormholes, items.
- Done when: `pnpm arcade test rush-racers src/logic/setpieces/wormholes.test.ts src/engine/view/set-pieces/wormhole-view.test.ts src/engine/view/camera.test.ts @courses @media` passes, `pnpm arcade check rush-racers --skip-tests` passes, `pnpm arcade see rush-racers --scenario wormhole-warp` passes and you have looked at its frames.

### Phase 2: the long courses

Demo: `pnpm arcade see rush-racers --scene race --query course=<id> --input "right*N" --at ...` across each new section of each course, and `node games/rush-racers/scripts/measure.ts par <course> --seeds 40` within 9000-10200 ticks for each.
Depends on: phase 1
Scaffold: 0e0cbb2f026c4bc7ff5b942f452de32ec990fed6
Tag: long-courses/phase-2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/courses/sunlit-shallows.ts, games/rush-racers/src/logic/top-route.test.ts, games/rush-racers/src/engine/audio/sfx-pin.test.ts, games/rush-racers/src/logic/media/swim/way.test.ts, games/rush-racers/src/logic/balance/baron-gate.test.ts, games/rush-racers/src/logic/race/flowfield.test.ts, games/rush-racers/scenarios/kit.ts, games/rush-racers/src/engine/themes/ocean.ts, games/rush-racers/src/engine/themes/ocean/ | contracts | | sol 6.2 | merged | | Sunlit par in band, conformance and top route pass |
| b | L | games/rush-racers/src/logic/courses/bramble-run.ts, games/rush-racers/src/engine/themes/forest.ts, games/rush-racers/src/engine/themes/forest/ | contracts | | sol 6.2 | merged | | Bramble par in band, conformance passes |
| c | L | games/rush-racers/src/logic/courses/thunderhead-pass.ts, games/rush-racers/src/engine/themes/sky.ts, games/rush-racers/src/engine/themes/sky/ | contracts | | sol 6.2 | merged | | Thunderhead par in band, conformance passes |
| d | L | games/rush-racers/src/logic/courses/slingshot-alley.ts, games/rush-racers/src/logic/courses/slingshot-alley.test.ts, games/rush-racers/src/engine/themes/space.ts, games/rush-racers/src/engine/themes/space/ | contracts | | sol 6.2 | merged | | Slingshot par in band, conformance passes |

Rules every phase 2 lane follows (pasted into each contract):
- Keep the course's opening as it is: columns before the first inserted section don't move, since scenarios, the coral-gate flowfield test and `TOP_ROUTE` pin them. Insert the new sections where the brief says; everything after an insertion shifts right, so update every column the course file names (sections, dark zones, surfaces, wells, lightning, vents, wind zones, asteroids, the layout comment) and any test you own that pins a shifted column.
- Every new section follows teach, test, twist: the mechanic or idea first alone and safe, then under pressure, then combined with something the course already taught. Every section has a safe road and a faster risky road where the course's width allows; the hardest bits sit on the risky road.
- Every new section has a landmark: at least one legend glyph with its own art key drawn by your theme (`engine/themes/<theme>/`, `terrain.glyphTiles`; `assertCourseAssets` checks it), such as the hollow oak's bark, the gas giant's banded disc, the cannon clouds' rigging or the maelstrom's shell ring.
- Add each new section to `Course.sections` (name upper case, at most 18 characters) and to the course file's column-by-column layout comment; the intensity numbers in the plan's Spec are the target feel.
- Par: re-measure with `node games/rush-racers/scripts/measure.ts par <course> --seeds 40` and write it with a comment. It must land in 9000-10200 ticks; shorten or lengthen the new sections, never the opening, to get there.
- Done when: `pnpm arcade test rush-racers @courses @seams @engine` passes, `pnpm arcade check rush-racers --skip-tests` passes, par is in band, `node games/rush-racers/scripts/measure.ts race <course> --bot expert --difficulty hard --seeds 10` and `--bot toddler --difficulty easy --seeds 10` are reported (the bars are phase 3's; don't run `src/logic/balance/` test files), and you have looked at a `see` capture of every new section (`--query course=<id> --input "right*N" --at ...`, or a `--query stage=` if one helps).
- Don't edit DESIGN.md, COURSES.md or docs; report the lines they need.

#### Lane a brief (Sunlit Shallows: The Maelstrom)

- Goal: lengthen Sunlit Shallows from par 7920 to 9000-10200 ticks with one new section, THE MAELSTROM, inserted at column 461 between THE SURFACE and URCHIN GAUNTLET (about 150-180 columns).
- Layout: a calm entry (open water, a pearl drift) as a rest after the surface; teach: one small whirlpool alone in open water with pearls along its forward side; test: two counter-rotating pools side by side so riding the top of one and the bottom of the other makes a figure eight, with urchins on each pool's drag side; twist: a big pool with a clam at its eye, a dive in for an item that costs time unless you spin out on the right side; exit into the urchin gauntlet. The landmark is a ring of giant shells round the big pool.
- Owns `race/flowfield.test.ts`'s coral gate columns indirectly: the gate (577-578 today) shifts right with the insertion, so that test needs its columns moved; that file is in your Owns.
- `TOP_ROUTE` (`scenarios/kit.ts`) must still finish: re-record the route through the new section and re-pin the hashes in `top-route.test.ts` with a sentence in its comment.
- Done when: the phase 2 rules above, plus `pnpm arcade test rush-racers src/logic/top-route.test.ts src/logic/race/flowfield.test.ts` and `pnpm arcade see rush-racers --scenario race-to-finish` pass.

#### Lane b brief (Bramble Run: Millstream, Hollow Oak, Rotten Bridges)

- Goal: lengthen Bramble Run from par 4119 to 9000-10200 ticks with three new sections: THE MILLSTREAM and THE HOLLOW OAK inserted after THE TREETOPS (before THE ROOT CAVE), and THE ROTTEN BRIDGES inserted after THE ROOT CAVE (before THE CLEARING).
- THE MILLSTREAM (rest, about 150-180 columns): a stream valley where the stream is mud (the run medium's slow cell) and stepping-stone ledges above it make an even hop rhythm with pearl arcs over each hop; a mushroom launches onto a higher bank; one snake; crates.
- THE HOLLOW OAK (about 120-160 columns, plus height): a climb up the inside of a giant hollow tree on ledges and mushrooms with pearls up the spiral and a crate at the top, out through a knothole onto a long downhill branch run and a drop back to the floor. A cracked-stone shortcut at the trunk's base (a Boulder or Baron breaks it) skips the climb. Landmark: the oak's bark and knothole.
- THE ROTTEN BRIDGES (climax, about 220-260 columns): a gorge crossed by crumbling branches. Teach: a short crumbling branch over a shallow dip whose floor leads on. Test: a three-span high bridge over the gorge, with a low path along the gorge wall (mud, snakes) that is slower but safe. Twist: a staircase of short crumbling branches up to a high, fast pearl route, where stopping drops you; and one branch whose fall drops you onto a mushroom that throws you back up. The gorge's pits respawn as the forest floor's pits do. Landmark: rotten-wood bridge art for the crumbling ledges and rope posts.
- Done when: the phase 2 rules above.

#### Lane c brief (Thunderhead Pass: Sunbreak, Crow Cliffs, Cannon Clouds)

- Goal: lengthen Thunderhead Pass from par 4006 to 9000-10200 ticks with three new sections inserted after THE TWO ROADS and before THE STORM CELL: SUNBREAK, THE CROW CLIFFS, THE CANNON CLOUDS, in that order.
- SUNBREAK (rest, about 200-240 columns): wide bright sky, ring lines that dip and climb in long waves so the rhythm is dive into the trough, flap up the crest; feathers and balloons; a bounce cloud cluster; almost no hazards.
- THE CROW CLIFFS (about 180-220 columns, plus height): a tall cliff of thunderhead rock to weave up between ledges, storm crows roosting, puff clouds plugging gaps, a fog bank on the low road hiding a sky eel; then a long dive off the top. Landmark: the crows' roost.
- THE CANNON CLOUDS (about 220-280 columns): teach: one cannon across a gap too wide to flap in time; test: a battery of three cannons aimed up (the high road and a ring line), straight (through a lightning zone, fastest if timed) and down (a safe low road with bounce clouds); twist: a cannon that fires into a second cannon that turns the corner, and a cannon aimed through a ring line. Landmark: the battery's rigging.
- Done when: the phase 2 rules above.

#### Lane d brief (Slingshot Alley: Gas Giant, Debris Storm, Wormways)

- Goal: lengthen Slingshot Alley from par 3551 to 9000-10200 ticks with three new sections: THE GAS GIANT and THE DEBRIS STORM inserted after SOLAR WIND LANE (before MOON SHADOW), and THE WORMWAYS inserted after MOON SHADOW (before BLACK HOLE SPLIT).
- THE GAS GIANT (flowing rest, about 200-240 columns): a huge planet whose disc fills the middle of the section (its centre inside rock), so the way loops round it and a clean swing round its far side flings you on; ice moonlets on the inside line; a dust belt as the slow outside line. Landmark: the banded disc.
- THE DEBRIS STORM (about 180-220 columns): a corridor that asteroids cross at several periods and heights, plasma orbs, a fast lane through the crossings and a safer longer lane above.
- THE WORMWAYS (about 220-260 columns): teach: a sealed wall with one two-way wormhole through it; test: a chamber with three mouths, one a shortcut whose exit sits beside a black hole's reach, one neutral, one a one-way loop back to the chamber's start; twist: a wormhole whose exit sits inside a planet's reach for a slingshot, and a pair just before the black hole split. Landmark: the wormway's arch art.
- Owns `courses/slingshot-alley.test.ts`, which compares this course's width and par with Bramble Run's: update its bounds to the new lengths with a sentence saying why.
- Done when: the phase 2 rules above.

### Phase 3: difficulty bars on the long courses

Demo: every `src/logic/balance/<course>-*.test.ts` file passes for all four listed courses.
Depends on: phase 2
Scaffold: ada5b28

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/courses/sunlit-shallows.ts, games/rush-racers/src/logic/top-route.test.ts, games/rush-racers/src/logic/race/flowfield.test.ts, games/rush-racers/scenarios/kit.ts, games/rush-racers/src/engine/themes/ocean.ts, games/rush-racers/src/engine/themes/ocean/ | contracts | | sol 6.2 | merged | | all sunlit-shallows bars pass, par still in band |
| b | M | games/rush-racers/src/logic/courses/bramble-run.ts, games/rush-racers/src/engine/themes/forest.ts, games/rush-racers/src/engine/themes/forest/ | contracts | | sol 6.2 | merged | | all bramble-run bars pass, par still in band |
| c | M | games/rush-racers/src/logic/courses/thunderhead-pass.ts, games/rush-racers/src/engine/themes/sky.ts, games/rush-racers/src/engine/themes/sky/ | contracts | | sol 6.2 | pending | | all thunderhead-pass bars pass, par still in band |
| d | M | games/rush-racers/src/logic/courses/slingshot-alley.ts, games/rush-racers/src/logic/courses/slingshot-alley.test.ts, games/rush-racers/src/engine/themes/space.ts, games/rush-racers/src/engine/themes/space/ | contracts | | sol 6.2 | merged | | all slingshot-alley bars pass, par still in band |

Phase 3's scaffold (orchestrator, before dispatch) adjusts the shared bar files every lane needs: the close-win window in `balance/hard-bars.ts` (an absolute 8 s today) and the per-race budget in `balance/race-bots.ts` (6 s today), both scaled to the longer races after measuring them. Lanes own their course and theme exactly as in phase 2 (lane a also `TOP_ROUTE`, its hashes and the coral gate test), so a reshape that passes a bar can also keep par in band.

Rules every phase 3 lane follows (pasted into each contract):
- The bars are fixed: `hard-bars.ts`, `normal-bars.ts`, `easy-bars.ts`, `race-bots.ts` and every `balance/*.test.ts` are read-only. A missed bar is fixed in the course or its theme only (a hazard moved, a road widened, a pearl line added, a shortcut's risk eased or raised), never by loosening a bar.
- Run only your course's bar files, one or a few at a time (`pnpm arcade test rush-racers src/logic/balance/<course>-<char>.test.ts`), each takes tens of seconds; run all 26 of them once before reporting, in at most two batches.
- Keep each new section's teach-test-twist shape and its landmark; trim or soften inside a section rather than deleting a section. Report every change with the bar it fixed.
- Par stays in 9000-10200 (re-measure after the last change) and `pnpm arcade test rush-racers @courses @seams @engine` still passes.
- Don't edit DESIGN.md, COURSES.md or docs; report the lines they need.

#### Lane briefs (one per course, same shape)

- Goal: every `src/logic/balance/<course>-*.test.ts` passes on the lengthened course, where `<course>` is the lane's course id (a sunlit-shallows, b bramble-run, c thunderhead-pass, d slingshot-alley).
- Start by running each bar file once and listing which bars miss and by how much; read the printed per-seed table to find where in the course the misses come from (`measure.ts race <course> --bot <bot> --difficulty <d> --seeds 10 --trace` if it helps), then change the section that causes them.
- The usual causes on a long course: a novice or toddler stuck at one hazard (easy and novice bars: stuns, finishing within the rival multiple), an expert losing time on a risky road it always takes (expert wins), rivals that can't handle a new mechanic (rivals finishing far behind). Fix rival handling of a mechanic only through the course data (where pools, branches, cannons or holes sit), not the AI.
- Lane a additionally keeps `TOP_ROUTE` finishing and re-pins `top-route.test.ts` with a sentence if its course change moves the hash.
- Done when: all 26 bar files for the course pass, the phase 3 rules above hold, and the report lists each bar file's result and the par measurement.

## Log

- 2026-11-24: lane 3/d needed no change: all 26 slingshot-alley bar files pass at par 9140 (Streak Hard close wins 17/30, the narrowest). Lane 3/b merged after review: a Treetops lead-in step (col 178) fixes the four rival stalls, Millstream stones widened and the Rotten Bridges low road eased so Hard close wins pass at the table's catch-up; Normal lag 7; par 9078. Docs to do: DESIGN.md says Slingshot has five drifting asteroids, it has eleven.

- 2026-11-24: lc-2y (Float32 tie in priced steering froze swim bots in the Jelly Field) merged. lc-2x turn 2 (counter-thrust keeps full dust drag; drift dustCruiseMul back to 0.6, Slingshot-only 0.45 override; Slingshot par 9140, drift-test 1006) merged at ada5b28. Phase 2 gate: check passed, smoke 118/118. Tagged long-courses/phase-2.

- User decisions (2026-11-24): par 150-170 s on all four courses; clear old bests with a save migration; one new mechanic per world.
- Plan critique (opus devils-advocate), 8 findings, all held and applied: (1) links made forced, so loop-backs price high; a link start is a field sink, which `downhillPath` stopping on is fine for; (2) fallen branches moved from a `moveBody` argument to `MoveRules.openLedges` plus `ledgeHolds`, with every ledge caller in lane b; (3) run nav never sees `fallen` (no rebuilds), the pilot skips links onto fallen tiles; (4) `rideCannon` pre-move hook replaces the medium's movement for riders; (5) existing scenarios on each test course added to that lane, smoke hashes are the orchestrator's, the two-peers claim dropped (it pins no hash); (6) phase 3 shared bar files (`hard-bars.ts` close-win window, `race-bots.ts` per-race budget) go in phase 3's scaffold, phase 3 lanes get the same ownership as phase 2, bars leave the phase 1-2 gate; (7) camera cuts by jump detection in its own `update`, level-view syncs from `world.fallen`, `toAscii` shows fallen branches (scaffold); (8) save fixture left as captured, v7 fixture added, `IDLE_TO_RESULTS` cost accepted.
- Phase 1 boundary review (opus): 5 findings, all held and fixed in lc-1z (cannon chaining, `afterMove` on rides, one parse-error shape, required `whirlpoolRiders`, shared `wormholeLinks`). Smoke browser pins re-pinned after it.
- Phase 2: lanes a-d merged. Fix lane lc-2y (Float32 tie in priced swim steering froze bots in Sunlit's Jelly Field) merged with lane a. Stall scan over 1600 races per course found Slingshot stalls (Debris Storm orb, rivals frozen in dust by catch-up); fix lane lc-2x turn 1 merged (`900e748`), its lane review found 6 issues (opposing stick brakes weakly, drift-wide dust cruise, weak tests, wrong floor comment, narrow orb test box, DESIGN.md), sent back as turn 2. Full check and smoke pass on landing; TOP_ROUTE browser hash re-pinned.
- Phase 3 scaffold `2fb4b6c`: close-win window 0.072 of par, 10 s per-race test budget.
- Paused 2026-11-24 for usage; see HANDOFF at the top.
