---
paths:
  - "games/*/scenarios/**"
  - "games/*/tests/**"
  - "templates/*/scenarios/**"
  - "templates/*/tests/**"
---

# Game scenarios and tests

- Scenarios use the game's typed kit (`scenarios/kit.ts`: `scenario`, `hold`, `tap`, `wait`) from `@arcade/testing`. Durations are logic ticks (1/60 s), never milliseconds or rendered frames.
- Assert on `summary`, `state` and `events`. Never on pixels, and never on exact floats from physics or trig: round in `debugSummary` or use `toBeCloseTo`. Local runs are arm64 macOS and CI is x86 Linux.
- Start states come from `start.save` fixtures (validated and migrated by the save store), `start.scene`, `start.seed` and `start.query`, not from poking state from the test.
- A scenario whose outcome depends on tuning or a default setting (difficulty, assists, a character) pins it with an explicit `start.save` instead of relying on what a fresh save defaults to. Otherwise changing the default breaks every such scenario at once.
- A rare moment (an item a seed seldom rolls, the end of a long course, an attack on the player) is set up through the game's debug stage (`start: { query: { stage: '<name>' } }`, honoured only in test mode or with `?debug=1`), not by hunting for a seed. Seed-hunted scenarios break when tuning shifts.
- No sleeps or timeouts. The driver waits on `ready`, `idle()`, ticks and events.
- A scenario that plays several times a typical one's ticks (a whole race, say) sets `slow: true`, and a long smoke test calls `test.slow()`: Playwright triples their timeout. Don't raise a game's global timeout for one long test, and prefer a debug stage that starts near the moment under test over replaying the whole game to reach it.
- A known bug is a scenario with `todo: true` and the correct expectation. Remove `todo` when it's fixed. Don't skip, focus or loosen tests to get green.
- Touch-only smoke tests carry `@touch` in the title so they run in the phone projects.
- Each save version keeps its committed fixture in `tests/fixtures/`; the migrate-from-every-fixture test must keep passing.
- Snapshot and baseline updates happen only through `pnpm test:update`, deliberately, and show up in review.
