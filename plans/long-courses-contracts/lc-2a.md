# Contract: Sunlit Shallows: The Maelstrom

## Goal

Implement lane 2/a of the plan at `/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses/plans/long-courses.md` (read its Spec, Phase 2 rules and your lane's brief; the brief is copied below and wins over anything else in the plan). The game is Rush Racers, `games/rush-racers/`. Your world's new mechanic from phase 1 is whirlpools (`scenarios/whirlpool-ride.ts` on its swim test course).

- Goal: lengthen Sunlit Shallows from par 7920 to 9000-10200 ticks with one new section, THE MAELSTROM, inserted at column 461 between THE SURFACE and URCHIN GAUNTLET (about 150-180 columns).
- Layout: a calm entry (open water, a pearl drift) as a rest after the surface; teach: one small whirlpool alone in open water with pearls along its forward side; test: two counter-rotating pools side by side so riding the top of one and the bottom of the other makes a figure eight, with urchins on each pool's drag side; twist: a big pool with a clam at its eye, a dive in for an item that costs time unless you spin out on the right side; exit into the urchin gauntlet. The landmark is a ring of giant shells round the big pool.
- Owns `race/flowfield.test.ts`'s coral gate columns indirectly: the gate (577-578 today) shifts right with the insertion, so that test needs its columns moved; that file is in your Owns.
- `TOP_ROUTE` (`scenarios/kit.ts`) must still finish: re-record the route through the new section and re-pin the hashes in `top-route.test.ts` with a sentence in its comment.
- Done when: the phase 2 rules above, plus `pnpm arcade test rush-racers src/logic/top-route.test.ts src/logic/race/flowfield.test.ts` and `pnpm arcade see rush-racers --scenario race-to-finish` pass.

## Read first

- `/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses/plans/long-courses.md`: Spec (intensity curves, "The four mechanics"), Contracts, and Phase 2. Phase 1 is merged: your world's new mechanic already works on its test course.
- `games/rush-racers/DESIGN.md`, `games/rush-racers/COURSES.md` ("Add a course", "Add a set piece", and the LevelDef fields for the new mechanics), `games/rush-racers/MAP.md`.
- Your course file, top to bottom, including its layout comment. Then the phase 1 test course for your world's mechanic and its scenario (named in your brief) to see the mechanic's legend and parse rules in use.
- `games/rush-racers/scripts/measure.ts` (`par` and `race`).

Read anything else when the work reaches it, not up front.

Phase 1 contracts you build on (don't change them): parse errors for set pieces come from `requireTile` (`logic/level/level-error.ts`) and open cells from `isOpenCell` (`logic/level/query.ts`); cannons chain (a rider passing over another cannon is caught by it, and `traceCannonShot` stops at it); `world.whirlpoolRiders` holds who rides each pool; two-way and one-way wormholes are priced by one `wormholeLinks(level, stepCost, warpCost)` shared by drift nav and the progress field; crumbling branches are `ledgeHolds` ledges that rivals' run nav plans through and the pilot skips while fallen.

## Skills to apply

The repo's `.claude/skills/game-feel`, `.claude/skills/verify-game` and `.claude/skills/phaser-game` (for theme art) apply. If a named skill is not installed, say so in the hand-off and continue with the repo's rules.

## Interface

Contracts are fixed: don't change `logic/types.ts`, `logic/events.ts`, `logic/world.ts`, `logic/level/`, `logic/race/`, `logic/setpieces/`, `logic/media/` or any rival AI. This lane is level design plus theme art: the course data and its theme. If the course can't do what the brief asks without a code change, ask the orchestrator.

Rules every phase 2 lane follows:
- Keep the course's opening as it is: columns before the first inserted section don't move, since scenarios, the coral-gate flowfield test and `TOP_ROUTE` pin them. Insert the new sections where the brief says; everything after an insertion shifts right, so update every column the course file names (sections, dark zones, surfaces, wells, lightning, vents, wind zones, asteroids, the layout comment) and any test you own that pins a shifted column.
- Every new section follows teach, test, twist: the mechanic or idea first alone and safe, then under pressure, then combined with something the course already taught. Every section has a safe road and a faster risky road where the course's width allows; the hardest bits sit on the risky road.
- Every new section has a landmark: at least one legend glyph with its own art key drawn by your theme (`engine/themes/<theme>/`, `terrain.glyphTiles`; `assertCourseAssets` checks it).
- Add each new section to `Course.sections` (name upper case, at most 18 characters) and to the course file's column-by-column layout comment; the intensity numbers in the plan's Spec are the target feel.
- Par: re-measure with `node games/rush-racers/scripts/measure.ts par <course> --seeds 40` and write it with a comment. It must land in 9000-10200 ticks; shorten or lengthen the new sections, never the opening, to get there.
- Rivals use your course's data as it is: course conformance (`@courses`) fails a racer that goes 600 ticks without progress, so place pools, branches, cannons, holes and hazards where rivals handle them.
- Don't edit DESIGN.md, COURSES.md, MAP.md or docs; report the lines they need. Smoke's browser hashes are the orchestrator's; say if you expect yours to move (they will, for any course whose level changed).

## Scope

- May change:
  - `games/rush-racers/src/logic/courses/sunlit-shallows.ts`
  - `games/rush-racers/src/logic/top-route.test.ts`
  - `games/rush-racers/src/logic/race/flowfield.test.ts`
  - `games/rush-racers/scenarios/kit.ts`
  - `games/rush-racers/src/engine/themes/ocean.ts`
  - `games/rush-racers/src/engine/themes/ocean.test.ts`
  - `games/rush-racers/src/engine/themes/ocean/`
- Must not change: everything else, in particular `games/rush-racers/src/logic/` outside your course file (and the tests listed above), other courses and themes, `games/rush-racers/src/engine/scenes/`, `audio/`, `fx/`, `view/`, `tests/`, docs, `package.json` and the lockfile.
- Locked: none.

Edit no file outside May change. If the task cannot be done inside it, ask the orchestrator before expanding scope. Do not commit, merge, remove worktrees or clean up the orchestrator's scratch files.

## Acceptance

Run from the worktree root (`/Users/riley/Projects/games/.claude/worktrees/lc-2a`) and iterate until these pass:

```sh
pnpm arcade test rush-racers @courses @seams @engine src/logic/top-route.test.ts src/logic/race/flowfield.test.ts
pnpm arcade check rush-racers --skip-tests
node games/rush-racers/scripts/measure.ts par sunlit-shallows --seeds 40
pnpm arcade see rush-racers --scenario race-to-finish
pnpm arcade see rush-racers --scenario dnf-results
pnpm fix
```

Then report, without tuning to them (the bars are phase 3's):

```sh
node games/rush-racers/scripts/measure.ts race sunlit-shallows --bot expert --difficulty hard --seeds 10
node games/rush-racers/scripts/measure.ts race sunlit-shallows --bot toddler --difficulty easy --seeds 10
```

This repo runs several agents on one machine: do not run the whole unit suite, `pnpm arcade check rush-racers` without `--skip-tests`, `@bars`, any `src/logic/balance/` file, or `pnpm arcade smoke`. The orchestrator runs those after merging.

Look at every new section: `pnpm arcade see rush-racers --scene race --query course=sunlit-shallows --input "right*N" --at ...` (or a scripted input that reaches it), reading `frame-<tick>.png` from the `run:` folder the summary prints (don't read `.arcade/runs/latest`). Then play it as a player would with `see` inputs that take the safe road, the risky road and a bad line, and fix what reads badly or feels unfair. Check `--mobile` once for a section with a tall climb, so the camera keeps the next ledge in view.

## Do not

- Commit or push; leave changes for review.
- Disable lint, weaken a test, add a cast or suppress a type error to get green.
- Add mechanics, code paths or options. This lane is course data and theme art.
- Use `Math.random`, `Date`, `**` or inexact `Math` members in `src/logic/`.
- Edit `~/.codex` config, hooks, trust or auth. Codex's own runtime session and log writes there are fine, including during the independent review.
- Mention any repository outside this one in a tracked file.

## Review before hand-off

Once acceptance checks pass, get one independent review in a fresh Codex process and resolve its findings. Run it from the worktree root.

Use separate simple commands and the file-writing tool, not a shell function, grouped command, heredoc or generated shell script. Run from the worktree root:

```sh
mktemp -d
```

Keep the printed absolute directory as the review directory, outside the worktree. With the file-writing tool, write `<review-directory>/prompt.md` containing these task instructions:

   "Review uncommitted changes and new files in /Users/riley/Projects/games/.claude/worktrees/lc-2a against its HEAD commit. Read the contract at /private/tmp/claude-501/-Users-riley-Projects-games/13be6121-5d7c-4962-8783-e8f7cd4d6a0c/scratchpad/contracts/lc-2a.md first. Your sandbox is read-only; don't run tests or edit files. The author already ran the checks. Check the contract and repo rules (AGENTS.md, `.claude/rules/`), that every shifted column in the course file and its tests moved together, that each new section has teach, test and twist with a safe and a risky road, that rivals can't stall in it, and report every real defect with a file:line reference."

Then run one plain command, replacing `{REVIEW DIR}` with that printed absolute path:

```sh
codex exec --ephemeral --sandbox read-only -m "gpt-6.2-sol" -c 'model_reasoning_effort="high"' -c 'service_tier="priority"' -o "{REVIEW DIR}/review.md" - < "{REVIEW DIR}/prompt.md"
```

Read the resulting `review.md`. Fix every finding or explain in the hand-off why it is wrong. Rerun affected acceptance checks after fixing. One independent review only. If the review cannot run, ask the orchestrator rather than claiming it passed.

## Hand-off

Finish when findings are resolved and acceptance passes, or when blocked. Leave everything uncommitted and end with this report:

1. Summary: what you built, in two or three sentences.
2. Files: each file changed and why.
3. Sections: for each new section, its columns, its teach/test/twist, its safe and risky roads, and its landmark glyph.
4. Checks: each command and result with test counts; par before and after; the two `measure.ts race` tables; the `see` frames you looked at and what you changed after looking.
5. Review: the review file's absolute path, each finding and its resolution or dispute.
6. Doc text and smoke: lines for DESIGN.md, sunlit-shallowsS.md, MAP.md; whether you expect smoke hashes to move.
7. Look closer at: anything rivals handle poorly, sections you're unsure are fun, numbers you picked.
8. Open: unfinished work, blockers and questions.
