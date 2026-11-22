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
- Start states come from `start.save` fixtures (validated and migrated by the save store), `start.scene` and `start.seed`. Not from poking state directly.
- No sleeps or timeouts. The driver waits on `ready`, `idle()`, ticks and events.
- A known bug is a scenario with `todo: true` and the correct expectation. Remove `todo` when it's fixed. Don't skip, focus or loosen tests to get green.
- Touch-only smoke tests carry `@touch` in the title so they run in the phone projects.
- Each save version keeps its committed fixture in `tests/fixtures/`; the migrate-from-every-fixture test must keep passing.
- Snapshot and baseline updates happen only through `pnpm test:update`, deliberately, and show up in review.
