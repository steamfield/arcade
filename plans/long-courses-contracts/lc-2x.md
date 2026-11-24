# Contract: Slingshot Alley stalls (a plasma orb plugs a dust channel; slowed drifters freeze in dust)

## Goal

Fix two causes of long stalls on Slingshot Alley, the space course of Rush Racers (`games/rush-racers/`), found by scanning all eight characters × seeds 1-200 (expert bot as the player, Hard, `endsWhen: 'everyone'`, as `src/logic/balance/race-bots.ts` `raceOnce` builds them). The plan is `/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses/plans/long-courses.md`; this run fixes defects found at phase 2's merge gate. Every race finishes, but 18 of 1600 have a racer stuck for 25-100 s.

Cause 1, a level layout problem (all the long player stalls). In THE DEBRIS STORM the low road runs through a 5-row nebula dust channel under the debris shield, cols 737-743, rows 21-25, and a plasma orb (`j`, a reskinned jelly) sits in it at col 742, row 22. `ai/avoid.ts` treats a jelly as reaching `jellyReachPx` (24 px) above and below its box for its bob, so the orb blocks nearly the whole channel; the pilot's aim swings ±90° each replan, it never commits to a side, and it sits in the dust at about (741, 22) for 1500-6200 ticks. Cases: gil 162 (6211 ticks), rudy 174 (3757), baron 63 (3568), streak 50 (3372), baron 122 (3248), onyx 132 (3022), baron 169, streak 52, baron 2, onyx 200/57, nib 22, rook 72/120, streak 117. Fix it in the layout: move or remove that orb so the dust channel is passable while the section keeps its plasma orbs as a hazard to steer round elsewhere (for example in the open space east of the shield, clear of the asteroid track at cols 754-756). Don't change `ai/avoid.ts` for this.

Cause 2, a drift physics problem (the rival freezes). Rival catch-up (`ai/rival.ts` `catchUpMul`, `difficulty-level.ts` `rivalCatchUp.min` 0.6) scales a far-ahead rival's force down to about 0.6. Drift thrust is `force` 260 × forceMul px/s², and in nebula dust drag is `drag` 16 + `dustDrag` 150 = 166 px/s² (`media/drift/physics.ts` `dragLoss`, `media/drift/tuning.ts`). Below forceMul ≈ 0.64 thrust can't beat dust drag, so a drifter at rest in dust can never move again: trace of bo on streak 50 at tick 9000, (947.9, 14.0) in the WORMWAYS dust, forceMul 0.612, stick full east, velocity exactly 0 for 2374 ticks; tess on gil 162 at (808.9, 13.1) for 5970 ticks. Fix the rule so a racer holding the stick in dust always makes headway at any forceMul the game can produce (the lowest is rival catch-up min 0.6 × the level's rivalForceMul, and Baron's Bulldozer ramp; check `abilities.ts`), while dust still slows racers to `dustCruiseMul` of cruise and still bleeds a fast racer's speed on entry. One clean shape: dust's extra drag acts only on speed above the dust cruise, or is bounded by the thrust; choose what reads simplest and say why. Don't fix it by raising catch-up's min.

## Read first

- `games/rush-racers/src/logic/courses/slingshot-alley.ts` (layout, legend, section comments, PAR_TICKS comment), `media/drift/physics.ts`, `media/drift/tuning.ts`, `media/drift/physics.test.ts`, `ai/avoid.ts`, `ai/rival.ts`, `modifiers.ts`, `abilities.ts`.
- `games/rush-racers/DESIGN.md` and `games/rush-racers/COURSES.md` for drift and dust.

## Scope

- May change:
  - `games/rush-racers/src/logic/courses/slingshot-alley.ts` (the orb placement, its section comment, and PAR_TICKS with its comment)
  - `games/rush-racers/src/logic/media/drift/physics.ts`, `media/drift/tuning.ts` and their doc comments
  - `games/rush-racers/src/logic/media/drift/physics.test.ts` and `games/rush-racers/src/logic/courses/slingshot-alley.test.ts` for regression tests
  - `games/rush-racers/src/logic/top-route.test.ts`, `games/rush-racers/src/engine/audio/sfx-pin.test.ts`, and any course or drift test that pins a hash or count your change moves (re-pin only, with a sentence saying why)
  - `games/rush-racers/src/logic/balance/*.test.ts` bar files for `slingshot-alley` or `drift-test`, only if your change moves a measured value they pin, with a sentence saying why
- Must not change: everything else, in particular `logic/types.ts`, `logic/events.ts`, `logic/world.ts`, `ai/`, `difficulty-level.ts`, other courses, docs, `tests/smoke.spec.ts`, `package.json`, the lockfile.

Edit no file outside May change. If the fix needs one, ask the orchestrator. Do not commit, merge, remove worktrees or clean up the orchestrator's scratch files.

## Acceptance

1. Two regression tests through the real code, each watched failing before its fix: a drift physics test that a racer at rest in nebula dust with forceMul 0.6 and the stick held moves (and one at full force still settles at the dust cruise, not the open cruise); and a test that the Debris Storm dust channel (cols 737-743, rows 21-25) holds no plasma orb, or better, that one of the stuck cases (gil 162) keeps the player's `longestStall` under 900 ticks.
2. A scratch scan (deleted afterwards) of all eight characters × seeds 1-200, expert on Hard, on `slingshot-alley`: zero DNFs and no racer (player or rival) with `longestStall` over 1500 ticks. Report the worst stall and where it is. If one remains over 1500, trace it and report the cause rather than widening the bar.
3. `node games/rush-racers/scripts/measure.ts par slingshot-alley` (no `--seeds`): write PAR_TICKS with its comment in the existing style (mean in seconds, seeds 1-200 and all eight characters, races finished, slowest finish, the previous value 9104 and why it changed). It must land in 9000-10200.
4. `node games/rush-racers/scripts/measure.ts par drift-test --seeds 20` before and after: report both. Courses that aren't drift must not move: `par bramble-run --seeds 10` unchanged.
5. `pnpm arcade test rush-racers @courses @seams @engine @media src/logic/top-route.test.ts`, the slingshot and drift bar files you touched, `pnpm arcade check rush-racers --skip-tests`, `pnpm arcade see rush-racers --scenario <a slingshot scenario> --at <a tick in the Debris Storm>` and look at the frame, `pnpm fix`.

Run from the worktree root (`/Users/riley/Projects/games/.claude/worktrees/lc-2x`). Don't run the whole unit suite, `pnpm arcade check rush-racers` without `--skip-tests`, `@bars`, or `pnpm arcade smoke`. The scan and par runs take minutes each; split the scan across processes if you like, but don't start more than four at once.

## Do not

- Commit or push; leave changes for review.
- Disable lint, weaken a test, add a cast or suppress a type error to get green.
- Add a "move right if stuck" fallback to the pilot.
- Use `Math.random`, `Date`, `**` or inexact `Math` members in `src/logic/`.
- Edit `~/.codex` config, hooks, trust or auth.
- Mention any repository outside this one in a tracked file.

## Hand-off

Leave everything uncommitted and end with: 1. what you changed for each cause and why that shape; 2. files changed; 3. checks with counts, the scan result and worst stall, the par output, the drift-test and bramble comparisons; 4. anything the orchestrator should look at; 5. open questions.
