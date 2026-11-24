# Rush Racers 3D

A forest foot race seen from behind the runner. Run Thornwood Trail, jump logs and pits, dash for bursts of speed and steer clear of mud. Rivals, items and menus arrive in later phases (`plans/rush-racers-3d.md`). It shares Rush Racers' feel and Thornwood's cast, with its own code: nothing imports from `games/rush-racers`.

## Core loop

A 3-2-1 countdown, then the race. Hold forward to run, steer across the trail, jump over logs and pits, dash when it pays. Cross the finish line to see your time and best; press fire to race again. The best time per course is saved.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| run | Up, W | d-pad up |
| brake | Down, S | d-pad down |
| steer | Left/Right, A/D | d-pad left/right |
| jump (hold for higher) | Space | A |
| dash | Shift, X | B |
| fire, confirm on screens | Z, Enter | ★ |
| previous / next item (phase 3) | Q / E, Tab | |

## Rules worth knowing

- Track space: logic places racers by `s` (meters along the course), `d` (meters sideways, + right) and `y` (meters up). `src/engine/track-geometry.ts` maps that onto the world; logic never sees world x/z.
- Logic uses no trig, `**` or `Math.pow`, so the world hash smoke pins is the same in every browser.
- Running: forward accelerates to run speed, release slows, brake slows faster. Steering moves sideways up to a cap and stops at the trail's edges.
- Jumping: a fresh press on the ground; holding rises higher; a press just after running off an edge or just before landing still jumps.
- Dash: a meter of two charges; a dash spends one and lifts speed over run speed, which glides back. Each charge returns 1.5 s after the meter dropped.
- Pits have no floor. Falling in takes you out for 1 s, then you're back at rest at your last safe spot with 1 s of invulnerability.
- Mud slows running; gusts push you sideways; logs are solid unless you jump them, and you can land on top.
- The race ends when you cross the finish, or at 4 minutes.

## Course

Thornwood Trail (`src/logic/courses/thornwood-trail.ts`), about 1.1 km in six sections: Forest Floor, Millstream Flats, The Ravine, Windy Ridge, Rotten Bridges, The Clearing. The file documents each section.

## Launch parameters

- `?seed=<n>`: the race seed.
- `?stage=mid-course|near-finish|before-pit|before-log`: start the race already running at that spot (only with `?debug=1` or in test mode; a staged session never saves). Positions derive from the course in `src/engine/capture-stages.ts`.
- `?debug=1`: allows stages.

## Scenarios

`finish-line`, `log-bump`, `log-jump`, `pit-fall`. `scenarios/kit.ts` holds shared timings and `savedGame()`.
