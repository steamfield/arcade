import pathlib
SCR = '/private/tmp/claude-501/-Users-riley-Projects-games/13be6121-5d7c-4962-8783-e8f7cd4d6a0c/scratchpad/contracts'
PLAN = '/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses/plans/long-courses.md'
G = 'games/rush-racers/'
MARGINS = """Measured before this phase (expert bot, Hard, seeds 1-30, rival gap = seconds the expert finished ahead of the best rival):
- sunlit-shallows: expert wins 22-28 of 30 per character, median gap 1-4 s.
- bramble-run: wins 30/30 for every character, median gap 10.8-12.5 s, only 0-4 of 30 within 8 s.
- thunderhead-pass: wins 30/30, median gap 10.4-13.1 s, 2-8 of 30 within 8 s.
- slingshot-alley: wins 26-30, median gap 8.1-10.7 s, 9-15 of 30 within 8 s.
The Hard close-win bar (`balance/hard-bars.ts`, `CLOSE_WIN_PAR_SHARE` 0.072 of par, about 11 s now) wants most wins close, so expect it to miss on bramble-run and thunderhead-pass and on some slingshot-alley characters. A course's `catchUp` override in its course file (`Course.catchUp`, see the catch-up comment in `slingshot-alley.ts` for an example) is course data and in scope; so are layout changes that give rivals a better line."""
lanes = {
 'a': dict(course='sunlit-shallows', title='Sunlit Shallows', owns=['src/logic/courses/sunlit-shallows.ts','src/logic/top-route.test.ts','src/logic/race/flowfield.test.ts','scenarios/kit.ts','src/engine/themes/ocean.ts','src/engine/themes/ocean/'],
   extra='You also own `TOP_ROUTE` in `top-route.test.ts`: keep it finishing and re-pin its hash with a sentence if your course change moves it. If you change the level, `TOP_ROUTE_BROWSER_HASH` in `tests/smoke.spec.ts` will move; say so, the orchestrator re-pins it.', tests='src/logic/top-route.test.ts src/logic/race/flowfield.test.ts'),
 'b': dict(course='bramble-run', title='Bramble Run', owns=['src/logic/courses/bramble-run.ts','src/engine/themes/forest.ts','src/engine/themes/forest/'],
   extra="""Also trace and fix four rival stalls found by a 200-seed x 8-character scan (expert player, Hard, `race()` in `balance/race-bots.ts` returns `longestStall` per racer, in ticks): player rudy seed 133 rival bo 1923 ticks; gil seed 14 tess 1921; rudy seed 18 squib 1650; nib seed 93 bo 1593. Never the player. Find where each happens with a scratch script under the worktree's `scripts/` (deleted afterwards) that steps `createWorld`/`stepWorld` and records the racer's tile when its progress stops improving. A likely cause is rivals dropping off the Rotten Bridges' high spans. Fix them in the layout if they come from a course spot; if the cause is in AI code, report it and don't change the AI. Afterwards, rescan all eight characters x seeds 1-200 for this course (split over at most four processes) and report the worst stall; none should exceed 1500 ticks.""", tests='src/logic/media/run/nav.test.ts'),
 'c': dict(course='thunderhead-pass', title='Thunderhead Pass', owns=['src/logic/courses/thunderhead-pass.ts','src/engine/themes/sky.ts','src/engine/themes/sky/'],
   extra='Phase 2 noted Gil is the slowest toddler on this course (watch the Easy toddler bar).', tests=''),
 'd': dict(course='slingshot-alley', title='Slingshot Alley', owns=['src/logic/courses/slingshot-alley.ts','src/logic/courses/slingshot-alley.test.ts','src/engine/themes/space.ts','src/engine/themes/space/'],
   extra='This course already has `catchUp` overrides and a `tuning: { extra: { dustCruiseMul: 0.45 } }` override (keep the Debris Storm dust channel at cols 736-744 rows 19-27 free of plasma orbs; `slingshot-alley.test.ts` pins that).', tests='src/logic/courses/slingshot-alley.test.ts'),
}
for k, l in lanes.items():
    lane = f'lc-3{k}'; c = l['course']; wt = f'/Users/riley/Projects/games/.claude/worktrees/{lane}'
    owns = ''.join(f'  - `{G}{p}`\n' for p in l['owns'])
    out = f"""# Contract: {l['title']} passes its difficulty bars

## Goal

Lane 3/{k} of the plan at `{PLAN}` (read its Spec and the "Phase 3" section). The game is Rush Racers, `games/rush-racers/`. Phase 2 lengthened `{c}` to a par of about 150 s (expert bot, Hard). Make every bar file `games/rush-racers/src/logic/balance/{c}-*.test.ts` (26 files: per character Hard, `-normal`, `-novice`, plus `-easy-level` and `-easy-toddler`) pass on the lengthened course, by changing the course data and its theme only.

Start by running each bar file once and listing which bars miss and by how much. Read the printed per-seed tables to find where the misses come from (`node games/rush-racers/scripts/measure.ts race {c} --bot <bot> --difficulty <d> --seeds 10 --trace` helps), then change the section that causes them. Usual causes on a long course: a novice or toddler stuck at one hazard (easy and novice bars: stuns, finishing within the rival multiple), an expert losing time on a risky road it always takes (expert wins), rivals that can't handle a new mechanic (rivals finishing far behind), or rivals finishing too far behind for the close-win bar.

{MARGINS}

{l['extra']}

Phase 2 lanes also noted: on Easy, toddlers win almost every race.

## Rules

- The bars are fixed: `hard-bars.ts`, `normal-bars.ts`, `easy-bars.ts`, `race-bots.ts`, `bot-driver.ts`, `kid-bot.ts` and every `balance/*.test.ts` are read-only. A missed bar is fixed in the course or its theme only (a hazard moved, a road widened, a pearl line added, a shortcut's risk eased or raised, the course's `catchUp` override), never by loosening a bar and never in AI code.
- Run only your course's bar files, one or a few at a time (`pnpm arcade test rush-racers src/logic/balance/{c}-rudy.test.ts`); each takes tens of seconds. Run all 26 once before reporting, in at most two batches.
- Keep each section's teach-test-twist shape and its landmark; trim or soften inside a section rather than deleting one. Keep the course's opening columns (before the first phase 2 section) unchanged. If you shift columns, update every column the course file names and any test you own that pins one.
- Par stays in 9000-10200 ticks: after your last change, re-measure over all seeds and characters with `node games/rush-racers/scripts/measure.ts par {c}` (no `--seeds`, about 12 minutes) and write PAR_TICKS with its comment in the file's existing style.
- Course conformance (`@courses`) fails a racer that goes 600 ticks without progress; place things where rivals handle them.
- Don't edit DESIGN.md, COURSES.md, MAP.md or docs; report the lines they need. Smoke's browser hashes in `tests/smoke.spec.ts` are the orchestrator's; say whether you expect them to move.

## Scope

- May change:
{owns}- Must not change: everything else, in particular `logic/types.ts`, `logic/events.ts`, `logic/world.ts`, `logic/level/`, `logic/race/` (except a test you own), `logic/setpieces/`, `logic/media/`, `logic/ai/`, `difficulty-level.ts`, `logic/balance/`, other courses and themes, `tests/`, docs, `package.json`, the lockfile.

Edit no file outside May change. If the bars can't be met inside it, stop and ask the orchestrator with the numbers. Do not commit, merge, remove worktrees or clean up the orchestrator's scratch files.

## Acceptance

Run from the worktree root (`{wt}`):

```sh
pnpm arcade test rush-racers src/logic/balance/{c}-*.test.ts   # all 26, in at most two batches
pnpm arcade test rush-racers @courses @seams @engine {l['tests']}
pnpm arcade check rush-racers --skip-tests
node games/rush-racers/scripts/measure.ts par {c}
pnpm fix
```

Look at every section you changed with `pnpm arcade see rush-racers --scene race --query course={c} --input "right*N" --at ...`, reading `frame-<tick>.png` from the `run:` folder the summary prints (don't read `.arcade/runs/latest`).

This repo runs several agents on one machine: don't run the whole unit suite, `pnpm arcade check rush-racers` without `--skip-tests`, `@bars`, other courses' bar files, or `pnpm arcade smoke`. Don't start more than four long processes at once.

## Do not

- Commit or push; leave changes for review.
- Disable lint, weaken a test, add a cast or suppress a type error to get green.
- Add mechanics, code paths or options. This lane is course data and theme art.
- Use `Math.random`, `Date`, `**` or inexact `Math` members in `src/logic/`.
- Edit `~/.codex` config, hooks, trust or auth.
- Mention any repository outside this one in a tracked file.

## Hand-off

Leave everything uncommitted and end with:

1. Summary in two or three sentences.
2. Files changed and why; each change with the bar it fixed.
3. Checks: every bar file's result (26 lines), the other test commands with counts, par before and after.
4. Doc lines for DESIGN.md or COURSES.md; whether smoke hashes should move.
5. Look closer at, and open questions.
"""
    pathlib.Path(f'{SCR}/{lane}.md').write_text(out)
    print(lane, len(out))
