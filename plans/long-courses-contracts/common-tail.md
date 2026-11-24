
Edit no file outside May change. If the task cannot be done inside it, ask the orchestrator before expanding scope. Do not commit, merge, remove worktrees or clean up the orchestrator's scratch files.

## Acceptance

Run from the worktree root (`/Users/riley/Projects/games/.claude/worktrees/LANE`) and iterate until these pass:

```sh
pnpm arcade test rush-racers @courses @seams @engine EXTRA_TESTS
pnpm arcade check rush-racers --skip-tests
node games/rush-racers/scripts/measure.ts par COURSE --seeds 40
EXTRA_CMDS
pnpm fix
```

Then report, without tuning to them (the bars are phase 3's):

```sh
node games/rush-racers/scripts/measure.ts race COURSE --bot expert --difficulty hard --seeds 10
node games/rush-racers/scripts/measure.ts race COURSE --bot toddler --difficulty easy --seeds 10
```

This repo runs several agents on one machine: do not run the whole unit suite, `pnpm arcade check rush-racers` without `--skip-tests`, `@bars`, any `src/logic/balance/` file, or `pnpm arcade smoke`. The orchestrator runs those after merging.

Look at every new section: `pnpm arcade see rush-racers --scene race --query course=COURSE --input "right*N" --at ...` (or a scripted input that reaches it), reading `frame-<tick>.png` from the `run:` folder the summary prints (don't read `.arcade/runs/latest`). Then play it as a player would with `see` inputs that take the safe road, the risky road and a bad line, and fix what reads badly or feels unfair. Check `--mobile` once for a section with a tall climb, so the camera keeps the next ledge in view.

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

   "Review uncommitted changes and new files in /Users/riley/Projects/games/.claude/worktrees/LANE against its HEAD commit. Read the contract at CONTRACT first. Your sandbox is read-only; don't run tests or edit files. The author already ran the checks. Check the contract and repo rules (AGENTS.md, `.claude/rules/`), that every shifted column in the course file and its tests moved together, that each new section has teach, test and twist with a safe and a risky road, that rivals can't stall in it, and report every real defect with a file:line reference."

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
6. Doc text and smoke: lines for DESIGN.md, COURSES.md, MAP.md; whether you expect smoke hashes to move.
7. Look closer at: anything rivals handle poorly, sections you're unsure are fun, numbers you picked.
8. Open: unfinished work, blockers and questions.
