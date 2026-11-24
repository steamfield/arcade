# Rush Racers 3D

A forest foot race seen from behind the runner. Pick one of eight animals, then race three rivals down Thornwood Trail: jump logs and pits, dash for bursts of speed and steer clear of mud. Items arrive in phase 3 (`plans/rush-racers-3d.md`). It shares Rush Racers' feel and Thornwood's cast, with its own code: nothing imports from `games/rush-racers`.

## Core loop

Title, then character select (a 4x2 grid of Thornwood's cast; the pick is saved), then a 3-2-1 countdown (steps 0, 60, 120; GO and the first racing step at 180) and the race against three rivals drawn by seed from the other seven. Hold forward to run, steer across the trail, jump over logs and pits, dash when it pays. The HUD shows your place and a progress strip. Results list every place and time; fire races again with the same character, back returns to select. The best time per course is saved, only from a finish of your own.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| run | Up, W | d-pad up |
| brake | Down, S | d-pad down |
| steer | Left/Right, A/D | d-pad left/right |
| jump (hold for higher) | Space | A |
| dash | Shift, X | B |
| fire, confirm on screens | Z, Enter | ★ |
| back on screens | Shift, X | B |
| move the select cursor | arrows, WASD | d-pad |
| previous / next item (phase 3) | Q / E, Tab | |

## Rules worth knowing

- Track space: logic places racers by `s` (meters along the course), `d` (meters sideways, + right) and `y` (meters up). `src/engine/track-geometry.ts` maps that onto the world; logic never sees world x/z.
- Logic uses no trig, `**` or `Math.pow`, so the world hash smoke pins is the same in every browser.
- Running: forward accelerates to run speed, release slows, brake slows faster. Steering moves sideways up to a cap and stops at the trail's edges.
- Jumping: a fresh press on the ground; holding rises higher; a press just after running off an edge or just before landing still jumps.
- Dash: a meter of two charges; a dash spends one and lifts speed over run speed, which glides back. Each charge returns 1.5 s after the meter dropped.
- Pits have no floor. Falling in takes you out for 1 s, then you're back at rest at your last safe spot with 1 s of invulnerability.
- Mud slows running; gusts push you sideways; logs are solid unless you jump them, and you can land on top.
- Rivals (`src/logic/ai.ts`) drive by the same rules from what a player could see: features ahead and other racers' positions. Each cast member has a rival profile (steer wobble, jump jitter, preferred line); noise comes from the world's seeded rng. A rival far behind you runs up to 10% faster, one far ahead up to 10% slower.
- Racers bump: overlapping racers are pushed apart sideways and trade some sideways speed; nobody passes through anyone.
- Places: finished racers by time, then the rest by distance, ties by grid slot.
- The race ends when you cross the finish, 10 s after the third rival finishes if you haven't, or at 4 minutes.

## Course

Thornwood Trail (`src/logic/courses/thornwood-trail.ts`), about 1.1 km in six sections: Forest Floor, Millstream Flats, The Ravine, Windy Ridge, Rotten Bridges, The Clearing. The file documents each section.

## Launch parameters

- `?seed=<n>`: the race seed.
- `?stage=mid-course|near-finish|before-pit|before-log`: start the race already running at that spot (only with `?debug=1` or in test mode; a staged session never saves). Positions derive from the course in `src/engine/capture-stages.ts`.
- `?scene=race`: skip the title and select screens and open on the race (any `?stage=` does too).
- `?character=grit|skip|blaze|shade|cheeks|duke|dusk|fang`: race as that character instead of the saved one; an unknown id logs a warning listing the valid ones.
- `?debug=1`: allows stages.

## Scenarios

`finish-line`, `log-bump`, `log-jump`, `pit-fall` (staged, asserting on the player's own events with `ofPlayer`), `title-to-race`, `rivals-race`. `scenarios/kit.ts` holds shared timings, `ofPlayer()` and `savedGame()`.
