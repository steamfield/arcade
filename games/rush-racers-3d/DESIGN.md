# Rush Racers 3D

A forest foot race seen from behind the runner. Pick one of eight animals, then race three rivals down Thornwood Trail: jump logs and pits, dash for bursts of speed, steer clear of mud, and open `?` crates for items to use on each other. It shares Rush Racers' feel and Thornwood's cast, with its own code: nothing imports from `games/rush-racers`.

## Core loop

Title, then character select (a 4x2 grid of Thornwood's cast; the pick is saved), then a 3-2-1 countdown (steps 0, 60, 120; GO and the first racing step at 180) and the race against three rivals drawn by seed from the other seven. Hold forward to run, steer across the trail, jump over logs and pits, dash when it pays, run through crates and fire what they give you. The HUD shows your place, a progress strip and your three item slots. Results list every place and time; fire races again with the same character, back returns to select. The best time per course is saved, only from a finish of your own.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| run | Up, W | d-pad up |
| brake | Down, S | d-pad down |
| steer | Left/Right, A/D | d-pad left/right |
| jump (hold for higher) | Space | A |
| dash | Shift, X | B |
| fire the selected item, confirm on screens | Z, Enter | ★ |
| back on screens | Shift, X | B |
| move the select cursor | arrows, WASD | d-pad |
| previous / next item | Q / E, Tab | ⇄ (next) |

## Rules worth knowing

- Track space: logic places racers by `s` (meters along the course), `d` (meters sideways, + right) and `y` (meters up). `src/engine/track/track-geometry.ts` maps that onto the world; logic never sees world x/z.
- Logic uses no trig, `**` or `Math.pow`, so the world hash smoke pins is the same in every browser.
- Running: forward accelerates to run speed, release slows, brake slows faster. Steering moves sideways up to a cap and stops at the trail's edges.
- Jumping: a fresh press on the ground; holding rises higher; a press just after running off an edge or just before landing still jumps.
- Dash: a meter of two charges; a dash spends one and lifts speed over run speed, which glides back. Each charge returns 1.5 s after the meter dropped.
- Pits have no floor. Falling in takes you out for 1 s, then you're back at rest at your last safe spot with 1 s of invulnerability.
- Mud slows running; gusts push you sideways; logs are solid unless you jump them, and you can land on top.
- Rivals (`src/logic/ai.ts`) drive by the same rules from what a player could see: features ahead and other racers' positions. Each cast member has a rival profile (steer wobble, jump jitter, preferred line); noise comes from the world's seeded rng. A rival far behind you runs up to 10% faster, one far ahead up to 10% slower.
- Racers bump: overlapping racers are pushed apart sideways and trade some sideways speed; nobody passes through anyone.
- Crates: running or jumping through a `?` crate puts a rolled item in your first empty slot, then that crate stays shut for 1.5 s for everyone. A full inventory, or a roll of a kind you already hold, leaves it shut for you. Rolls favour Sap Shield and Mud Pie in 1st and Rocket Boots and Burr Ball in 4th; every kind can roll in every place.
- Inventory: three slots. Next/previous cycle among held items; fire uses the selected one and spends a charge, then nothing fires for 1/3 s. An empty slot hands the selection to the next held one.
- Rocket Boots (3 charges): a 22 m/s burst for 2/3 s that glides back like a dash, without using dash charges.
- Sap Shield (1): held, it absorbs the next hit. Fired, it throws a sap glob 40 m straight ahead that traps the first racer it touches for 1 s.
- Burr Ball (2): puffs you up for 1 s; anyone you bump meanwhile takes a hit.
- Mud Pie (3): lobbed forward; it splats into a 6 by 4 m mud patch for 5 s that slows everyone but the thrower (the patch shrinks as it fades). A pie over a pit leaves nothing.
- Hits: a held shield absorbs it; otherwise you drop your selected item, or with nothing held you're stunned for 1 s. Stun and sap stop you along the ground (you still fall) and block firing and dashing, not selecting. Every hit gives 1 s of invulnerability; invulnerable racers can't be hit or trapped. Crossing the finish clears every item effect.
- Rivals open crates on their line and fire one item at a time when it pays: boots on a clear stretch, a pie or sap at someone ahead, a burr beside someone. They keep a shield for its guard.
- Places: finished racers by time, then the rest by distance, ties by grid slot.
- The race ends when you cross the finish, 10 s after the third rival finishes if you haven't, or at 4 minutes.

## Code layout

`src/logic/` holds the rules: movement (`racer.ts`, `logs.ts`, `bump.ts`), read-only item status (`status.ts`), items (`items/`, used from outside only through `items/index.ts`), rivals (`ai.ts`), courses (`courses/`) and the tick (`world.ts`). `src/logic/architecture.test.ts` guards those boundaries. `src/engine/` renders it: `themes/` (each course theme's sky, light and palettes), `track/` (the trail and scenery), `racers/`, `items/`, `ui/` (HUD and screens), with `game.ts` wiring them and `runtime.ts` running scene flow and saves.

## Course

Thornwood Trail (`src/logic/courses/thornwood-trail.ts`), about 1.1 km in six sections: Forest Floor, Millstream Flats, The Ravine, Windy Ridge, Rotten Bridges, The Clearing. The file documents each section.

To add a course, write `src/logic/courses/<id>.ts` and add it to `COURSES` in `src/logic/courses/index.ts`, the only file allowed to import course files. `courses/conformance.test.ts` then checks it: it must validate, rivals must finish within 1.25 times its `parTicks` with at most two falls, and on a course with crates they must open crates and fire items. Its `theme` picks a `Theme` from `src/engine/themes/`. A recoloured forest is a new `src/engine/themes/<id>.ts`, its id added to `ThemeId` and `THEME_IDS` in `src/logic/types.ts`, and an entry in `THEMES`. A different kind of place (beach, cave) also needs its own scenery planter, since `track/forest.ts` and `track/gust-leaves.ts` still plant forest shapes.

## Launch parameters

- `?seed=<n>`: the race seed.
- `?stage=mid-course|near-finish|before-pit|before-log`: start the race already running at that spot (only with `?debug=1` or in test mode; a staged session never saves). Positions derive from the course in `src/engine/capture-stages.ts`.
- `?scene=race`: skip the title and select screens and open on the race (any `?stage=` does too).
- `?character=grit|skip|blaze|shade|cheeks|duke|dusk|fang`: race as that character instead of the saved one; an unknown id logs a warning listing the valid ones.
- `?course=<id>`: race that course; an unknown id logs a warning listing the valid ones and races the default (`DEFAULT_COURSE`).
- `?debug=1`: allows stages.

## Scenarios

`finish-line`, `log-bump`, `log-jump`, `pit-fall` (staged, asserting on the player's own events with `ofPlayer`), `title-to-race`, `rivals-race`, `crate-and-fire`. `scenarios/kit.ts` holds shared timings, `ofPlayer()` and `savedGame()`.
