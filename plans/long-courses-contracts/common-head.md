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
