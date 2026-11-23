# Reef Rush

Swim a reef course against three rivals and reach the finish gate first. Grab power-ups from clams, stack up to three, and fire them together for combos.

This is the repo's first full game and its reference layout: logic in feature folders under `src/logic/`, one orchestrating `world.ts`, engine seams (`art/index.ts`, `art/font.ts`, `audio/index.ts`, `themes/index.ts`) that later work swaps behind.

## Courses and themes

A course is data in a registry: `logic/courses/<id>.ts` holds its level, the medium it is raced in (`swim`), its theme, its race song, whether it is listed on course select, its par time and any tuning, and `logic/courses/index.ts` (`COURSES`, `LISTED_COURSES`, `DEFAULT_COURSE`, `courseById`) is the only file that imports a course file. Sunlit Shallows is the one shipped course. How to add a course or a medium is in `COURSES.md`.

A theme is how a course looks, in the engine: `engine/themes/<id>.ts` built with `defineTheme` (types in `themes/types.ts`) registers its own textures and animations at boot and says how the views draw it: terrain tiles per cell and per legend glyph art, flowing cells (kelp, currents), the finish gate and debris chunk, backdrop bands and painted layers, caustics, light rays and motes (each optional), particle physics (how things rise, fall, drift and splash), hazard skins, the dark-zone tint, the contrast bands sprites and text must stand off, and any extra race layers. `THEMES` and `themeFor(course)` are in `themes/index.ts`. The ocean theme (`themes/ocean.ts`, art, keys and colours in `themes/ocean/`) keeps the texture key strings from before themes existed. Racers, pickups, power-ups, the HUD and the UI are global art (`art/keys.ts`) and look the same on every course; adding a theme never edits `art/keys.ts` or `art/index.ts`. A course whose theme or song the engine doesn't have, or whose legend names art its theme has no tile for, fails `themes/course-assets.test.ts`, and the course a session starts on is checked at boot (it throws naming the course and what is missing). The race song is the course's (`Course.song`).

Best times are kept per course and per level (save v6 `bests[courseId][level]`), and the save remembers the last listed course raced (`lastCourse`). An unlisted course (tests, previews, reachable only by `?course=`) never gets a best, never shows NEW BEST and is never the last course.

## Core loop

Pick a course (only once more than one is listed), pick a racer, then a 3-2-1 countdown and the race. Swim with momentum, kick for bursts, ride currents, avoid kelp drag. Finish ahead of three rivals drawn from the rest of the cast. Results show place and time; the best finish on each course and level is saved.

## Controls

| Action        | Keyboard          | Touch |
| ------------- | ----------------- | ----- |
| swim          | Arrow keys, WASD  | d-pad |
| kick, confirm | Space, Z, Enter   | A     |
| menu up/down  | Up/Down, W/S      | d-pad |
| burst, back   | X, Shift          | B     |

Burst (B on touch, X or Shift on a keyboard) uses every power-up you hold at once. There is no cycling between held power-ups and no way to fire one on its own: the stack is spent together (see Power-ups). How to Play says so in pictures, and on the first race and every Easy race a hint prompts the first press.

On course select up and down move the cursor, kick picks the course and burst goes back to the title. On the select screen the arrows (d-pad) move around the grid, kick races as the highlighted character, and burst goes back (to course select when it is shown, else the title). On How to Play, kick or right turns to the next page and burst or left to the previous one. Left and right stop at the first and last page; only burst on the first page and kick on the last page return to the title (with How to play still selected).

## Rules worth knowing

- Tick order and determinism rules are in the header of `src/logic/world.ts`.
- Rivals steer by a distance-to-finish field (`race/flowfield.ts`); placing uses a separate uniform-cost field so places don't flicker.
- The race ends when you finish, 10 s after the third rival finishes (you get TIME UP), or at 5 minutes.
- Rivals out-swim you (about 1.5x your swim force) but kick and burst rarely, so your kicks and power-ups are how you win. Catch-up scales their swim force by 0.05 per tile of gap, between 0.6x when far ahead of you and 1.25x when far behind (Hard's `DIFFICULTY.hard.rivalCatchUp` in `difficulty-level.ts`). Rivals steer around urchins and jellies they can see coming (`ai/avoid.ts`). They aim attacks at any racer ahead of them, you or another rival, and flash a lantern only at a racer just ahead (`ai/items.ts`). Rival Baron plans through coral on a cheap `ram` flow field, since he breaks it by swimming into it. In a dark zone a rival that can't see (not Selene, no Glow Lantern) wobbles twice as much and replans half as often.
- Difficulty is measured per character in `logic/difficulty/<character>.test.ts` and, for the novice bar, `<character>-novice.test.ts`, so Vitest runs them in parallel (these bars are Hard's; Easy and Normal only soften Hard through the one knob table in `logic/difficulty-level.ts`: Normal's novice wins about a third of races, Easy's novice wins nearly all and a bot that wobbles, never kicks and never bursts places top two in about 80%, and no rival power-up ever lands on the player on Easy; their bars are `easy-*.test.ts` and `normal-*.test.ts` there) (shared bots in `race-bots.ts`) on 30 seeds: an expert bot wins with the lead rival within 8 s in at least 21, and a novice bot (loose steering, occasional kicks, no items) places 3rd or 4th in at least 21 and finishes within 1.3x the winner's time in at least 24. Each character's plain expert wins must land in 24-28 of 30, which keeps the roster within about 13 points of each other. On seeds 1-200 the expert plain-win rate is 82.5-88.5% by character (close wins 81.5-88%) and the novice bars are 97.5-100%; profiles use two-decimal numbers, and any change to rival tuning moves several characters by 2-4 points, so re-measure.
- Easy way-finding (`logic/guide.ts`, knobs in `DIFFICULTY[level].guide`, off on Normal and Hard so Hard is unchanged): a player who holds toward the finish and steers only after hitting a wall used to sit against it for many seconds (once about 13 s at the wall at tile 41,4). `guideFor(world, racer)` gives the neighbour tile that lowers the steer field most (the way on, one of 8 offsets) and `world.guide.stuckTicks`, the ticks the player has pushed without reaching a tile closer to the finish by that field. The steering assist: once the player has pushed 0.5 s without progress while nearly at rest, for the next 90 ticks of pushing the part of the rivals' steer aim that is sideways to the stick is added to it (a slide along the wall toward the way on). It never adds speed (swimming normalises the stick), is skipped for a stick held more than 120 degrees away from the way on, and never touches rivals or bots. The arrow (engine, below) shows after 1.5 s stuck. Measured with the stuck-prone kid (`logic/difficulty/kid-bot.ts`: holds right, tries up or down for as long as it keeps getting closer after 1.5 s without progress by the uniform progress field, alternating, kicks every 8 s, never bursts), 40 seeds per character on Easy, stuck time = ticks past the first second of each spell without a step closer by the steer field: Rudy 14.8 -> 2.6 s per race, Gil 19.0 -> 3.1, Onyx 22.7 -> 4.4, Baron 21.1 -> 1.0; mean place 1.70 -> 1.05, 1.82 -> 1.00, 2.10 -> 1.02, 1.40 -> 1.00; DNFs 0, 3, 5, 0 -> 0. `difficulty/easy-guide.test.ts` keeps a 4-seed version of this.
- Logic never calls `Math.sin`, `cos`, `atan2`, `hypot`, `exp`, `pow` or `log`: engines may approximate them, and a seeded race must replay identically on Chromium and WebKit. Use `src/logic/num.ts`.

## Roster

You race as one of eight characters; the race fills the three rival slots with three of the other seven, drawn by seed from the `roster` random stream (`pickRivals` in `logic/characters.ts`). Characters are data in fixed slots (`player`, `tess`, `squib`, `bo`), so tick order, random streams and tie-breaks never depend on who is picked. Abilities live in `logic/abilities.ts` (numbers in `ABILITY`), called from hooks in the systems they change. Each character also has its own rival profile in `logic/characters.ts`. Each character has its own art (`art/sprites/racers.ts`, portraits and heads in `art/ui/portraits.ts`).

| Character | Look | Ability |
| --- | --- | --- |
| Rudy | red snapper in a brass diving helmet | Shake it off: stuns and bubble traps last 40% as long |
| Gil | lanky green seahorse | Spring kick: kicks aimed steeply upward push 1.8x as hard |
| Streak | electric-blue sailfish | Wind-up: up to +10% swim force after 3 s swimming straight; a hard turn, stop or hit resets it |
| Onyx | black barracuda with a scarred fin | Ambush: bumping a racer from behind (within 45° of its heading) takes 12% of its speed |
| Nib | cleaner shrimp in goggles | Deep pockets: holds 4 power-ups instead of 3 |
| Baron Barnacle | huge spider crab with a crusted crown | Bulldozer: breaks coral by ramming, bumps with 2x mass, ramps from 0.4 to full force over 1 s after the start or a hit |
| Selene | moon jellyfish with a starlight glow | Moonlight: sees through dark zones, immune to jelly stings |
| Rook | hammerhead shark | Frenzy: +25% swim force for 1.5 s when a racer within 5 tiles is hit |

Dark zones (`Level.dark`) draw a veil (`view/dark-view.ts`, maths in `view/dark-math.ts`) with a light pool around each racer: yours is 64 px and leans ahead as you swim, a Glow Lantern widens it, and urchins and jellies show a faint glint so you can see them coming. Racers who see in the dark (`racerSeesInDark`) get only a light tint. The course has one dark range, columns 530-610 (the last ledge and drop).

## Power-ups

Clams (`?` in the course) open on touch, roll a power-up weighted by place (leaders get defensive kinds, Glow Lantern and Mimic; trailers get speed and the attack kinds; Undertow only rolls in 3rd or 4th) and stay shut for 4 s. You hold up to three, oldest first, never two of a kind; a fourth pushes out the oldest. Burst (B) fires everything you hold at once, then cools down for 2.5 s; bursting doesn't use them up, except Undertow, which is gone once fired. There is no cycling between held power-ups.

| Power-up | Passive | Burst |
| --- | --- | --- |
| Jet Fins | +15% speed, faster kick | dash |
| Bubble Shield | absorbs one hit | fires a bubble that traps a rival |
| Puffer | doubles bump push | inflate: break coral, hit racers, urchin-proof |
| Ink Sac | | ink cloud that slows racers behind |
| Glow Lantern | pulls in pearls within 3 tiles | flash that stuns nearby racers and jellies |
| Homing Squid | | a squid that locks the nearest racer ahead within 10 tiles and chases it; on contact it wraps them (70% swim force for 1.5 s, three kicks shake it off). A kick just before it arrives dodges it, and it never chases that racer again. It loses its lock in ink and passes harmlessly through an invulnerable racer |
| Riptide | every current pushes you 1.5x harder | lays an 8-tile current lane along your aim (snapped to the main axis) that pushes anyone in it at 2x a plain current for 3 s |
| Undertow | | one use: pulls every racer ahead of you back for 1.5 s, harder the bigger their lead; their kicks fight it |
| Mimic | squids lock on you only from half the usual range | a see-through copy of you swims on along the course for 5 s; a squid that picks it pops it instead of you |

Held pairs combine: Cannonball (Jet Fins + Puffer, an inflated dash through coral), Ink Trail (Jet Fins + Ink Sac), Lantern Bubble (Bubble Shield + Glow Lantern), Ink Bomb (Puffer + Ink Sac), Comet (Jet Fins + Glow Lantern, flash at both ends of the dash), Surfline (Jet Fins + Riptide, a longer 3x lane laid at the end of the dash), Ink Squid (Homing Squid + Ink Sac, ink bursts on whoever the squid wraps) and Bubble Decoy (Mimic + Bubble Shield, whatever pops the decoy traps its owner in a bubble, drawn as a bubble trail from the decoy). Lantern Bubble fires a bubble that lights the dark around it and stuns jellies it passes. Combos are fixed when the burst fires.

A hit (urchin `*`, jelly `j`, bubble, puffer, flash) takes your shield if you hold one, else knocks off your newest power-up as a loose pickup anyone can grab after half a second; with nothing held you're stunned. Every hit gives a second of invulnerability. Pearls (`o`) give a short speed boost. Rivals burst when a held kind has a use (`ai/items.ts`): a squid when a racer ahead is in lock range, a Riptide when the water ahead is open and a racer is close behind, Undertow when they trail, Mimic when a squid is chasing them. Each rival bursts about three times a race.

## Scenes and launch parameters

- `boot`: builds every texture (the global art in `engine/art/index.ts`, the UI kit and every theme's own), then routes.
- `title`: the logo over the swimming cast and the backdrop of the last listed course raced (Sunlit Shallows until then), then five buttons: Race, How to play, Level (EASY, NORMAL or HARD with 1-3 pips, cycling on each press and saved; a new save starts on Easy and every race is built on the saved level), Sound (mute) and Motion (reduced motion), PRESS A on touch screens only, and your best time and place on the current course at the selected level beside the buttons when it has one (it changes as Level cycles). Settings save at once and apply for the session even if the save fails; a fresh save follows the OS reduced-motion preference. What each level changes is in `logic/difficulty-level.ts`.
- `howToPlay`: five picture pages (swim and kick; open clams and hold three; B uses every held power-up at once, drawn as the held-stack well beside the B control, with a trail from each slot to its effect and the well dimming through the cooldown; the four attack power-ups; kicking to dodge a squid) with a heading, page dots and a NEXT / BACK footer; each page turn emits `howToPlay.page` (1-based) and plays the menu-move sound. It draws the real sprites, animated unless reduced motion is on, the player's saved racer, key caps on a keyboard and the round A and B buttons on touch. Pages live in `engine/view/how-to-play/`, the control glyphs in `view/control-glyphs.ts`, the paging in `engine/how-to-play.ts` and the page number on the runtime. Layout in `UI.md` "How to Play".
- `course`: course select, one row per listed course with its name and your best there on the level in force; the cursor starts on the current course, kick picks it and goes to `select`, burst goes back, and like menus it ignores kick for its first 20 ticks. It is skipped while only one course is listed (today), so Title Race goes straight to `select`. It is drawn by `view/course-view.ts` and holds five courses; layout in `UI.md` "Course select".
- `select`: the eight characters in a 4x2 grid (portrait and short name, the cursor's cell in a gold frame) and a card with the highlighted character's full name, ability and what it does. The cursor starts on your last pick. Kick saves the pick and races; burst goes back. Like menus, it ignores kick for its first 20 ticks. Under the card the highlighted racer swims at 2x, and a footer shows the controls (icons on desktop, A/B letters on touch). Layout in `UI.md` "Select".
- Hints for young players (`view/hints.ts`, drawn by `view/hint-view.ts`): on the first race of a save and on every Easy race, PRESS B! shows beside the player when a power-up first lands in the stack (until they fire it), KICK! shows when a locked-on squid is inside the dodge window (`dodgeTicks(world)`: 12 ticks on Hard, 18 on Normal, 24 on Easy) plus a short lead and the player's kick is ready (PRESS B! has no timeout on Easy), and the burst glyph pulses beside the HUD well once the stack has held something unused for 5 s. On Easy a fourth hint, the guide arrow (`view/guide-view.ts`), points the way on beside the player once they have been stuck 1.5 s; KICK! always outranks it and PRESS B! does for the first 4.5 s of being stuck. On touch screens the B button also shows the newest held power-up's icon (`view/burst-button.ts`). `debugSummary()` reports `difficulty` (the setting), `raceDifficulty` (what the race was built on) and `hints` during a race (`hints.guide` is the arrow's tile offset, or null).
- `race`: 3-2-1-GO countdown (the level you are racing on sits under the numeral: its word and 1-3 lit pips, in `debugSummary().levelBanner`), then the race, with FINAL STRETCH and FINISH splashes, or TIME UP if you run out of time. HUD (laid out in `UI.md`; the stack well has one slot per item your racer can hold, so four for Nib): place with your portrait (hidden during the countdown; pops up or down on a change), timer, a progress strip with each racer's head, and a well with kick, burst (a dim ring while it recharges) and three stack slots (empty ones show a dot). Combo names appear beside you, clear of your sprite. The camera follows you with a deadzone and lookahead. 90 ticks after the race ends you go to results.
- `results`: a podium with medals for the top three, standings with names and times revealed row by row (TIME UP if not finished), your row in sun with your head beside it, a NEW BEST (for this course and level) or BEST NOT SAVED readout, then Race again or Title, over the course's own backdrop. While course select is shown, the course's name sits top left.
- Menus ignore kick for their first 20 ticks, so a kick still being pressed from the race can't skip the results.
- Title Race goes to `course` (or `select` while one course is listed); results' Race again races the same course and character again without either select screen.
- `?scene=race` (or `?scene=play`) skips the title and races as the saved pick (Rudy on a fresh save). `?seed=7` changes rival behaviour and which characters you race. Each race is seeded with `seed + races in the save`, so a rematch plays differently while a test run still repeats exactly.
- `?course=<id>` races that course, listed or not (`debugSummary().course` and `.medium` say which); an unknown id logs one warning naming it and races the default (Sunlit Shallows). Without it the session races the save's last listed course, else the default.
- Save version 6: the best finish per course and level (`bests['sunlit-shallows'].hard`, each a time and place or null; a v5 save's bests move under Sunlit Shallows, and a key for a course the game doesn't know is kept and never shown), `lastCourse`, races run, settings (sound, motion, and `difficulty`: easy, normal or hard) and `character`, the last pick. A v2 save loads as Rudy; a v3 save loads on Easy, like a new one.
- `?debug=1` draws hitboxes from logic state and shows the tick and your tile.
- `?stage=<name>` (needs `?debug=1`, or the test harness) puts attack power-ups into the race before its first frame, to review their views without waiting for a roll: `icons-a`, `icons-b`, `icons-c`, `squid-flight`, `squid-lockon`, `squid-lockon-far`, `squid-latched`, `riptide`, `decoy`, `undertow`, `dark`, `guide` (`engine/debug-stage.ts`). A staged race never saves a result. Without the gate the parameter is ignored.
- Attack power-up warnings: a squid locked on you shows an edge arrow, a LOCKED ON! caption and a rising ping (at most once per 1.5 s); a latched squid shows KICK! beside you (PRESS A on touch). Details in `UI.md`.

## Engine layout

`engine/game.ts` wires Phaser to the shell. `engine/runtime.ts` is the only place logic ticks (`game.ts` feeds its clock once per Phaser step): it reads input, steps the world or the menu, drains each tick's events once and hands them to audio and to views that listen. Scenes in `engine/scenes/` build views from `engine/view/` and sync them every frame. Screens follow `UI.md` (palette, type scale, layout grid, safe zones, motion). Text goes only through `art/font.ts` `createLabel`; global textures through `art/keys.ts`, a course's own through its theme (`themeFor(course)`).

## Art and audio

Every sprite is palette-indexed pixel text, global art in `engine/art/sprites/` and a theme's in `engine/themes/<id>/sprites/`, drawn at boot by `art/pixel.ts` (at most 4 colours per frame; each racer's main colour holds 3:1 contrast against every theme's contrast bands, and at least a quarter of every racer frame's pixels do, spread over most of its height, enforced in `sprites.test.ts`; the ocean urchin holds 3:1 against the ocean's bands in `themes/ocean.test.ts`). The UI kit (fonts, panels, icons, portraits, logo) lives in `engine/art/ui/`. Sound is a four-voice chip synth (`audio/synth.ts`, `sequencer.ts`); songs are written in a small text notation (`audio/notation.ts`, songs in `audio/songs/`) and parsed at load, so a malformed song fails tests. The race theme speeds up for the final stretch.

## Effects

`engine/fx/` turns logic events into particles and camera shake; racer squash, invulnerability flicker and the 2x Puffer live in the racer and power-up views. How bubbles rise, debris sinks and ink and droplets drift comes from the course theme's particle physics. Effects run per logic tick from events, use their own cosmetic rng (never `world.rngs`), and never change logic state. Shake only ever moves the camera for the player's own hits, shield pops (lighter) and cannonball impacts, capped at 4 px. Reduced motion turns shake off, holds particles still, swaps the flicker for a steady half alpha, drops squash and the place flash, and shows the lantern ring at full reach.

## The course

About 90 s for a good player, 616 columns in five sections: the reef (columns 0-94, the opening the power-up scenarios rely on); the current highway (95-246: a current tunnel up top or a kelp bed with clams below, then a floor-current hall); the jelly field (247-364: jellies bobbing high and low in step); the urchin gauntlet (365-466: an urchin-lined tube or clean roads over and under, with a clam pair at its exit); and the coral gate and final drop (467-615: smash the 2-tile gate with a Puffer or climb over it, then ride a downward current to the finish at column 611).

## Course format

ASCII in the course file (`src/logic/courses/sunlit-shallows.ts`), documented in `src/logic/level/parse.ts`.

## Scenarios

`countdown-holds-racers`, `race-to-finish`, `results-after-finish`, `results-ignores-early-kick`, `dnf-results`, `race-again`, `results-to-title`, `title-best`, `clam-stack`, `hit-pops-newest`, `cannonball-combo`, `audio-plays`, `settings-toggle`, `pick-character`, `how-to-play`, `difficulty-setting`, `first-race-hint`, `countdown-level`, `title-best-per-level`. The top route most share is `TOP_ROUTE` in `scenarios/kit.ts`, a recorded no-kick run on seed 1 on Hard that finishes the whole course; any change to the course or Hard's rival tuning means re-recording it. A fresh save races on Easy, so scenarios that depend on Hard's speeds or clam rolls start from `HARD_SAVE` and swim `TITLE_TO_RACE` first (both in `kit.ts`). `src/logic/top-route.test.ts` replays it in logic and fails if it ends less than 300 ticks before the DNF cutoff, so a break shows in `check`, not only in smoke. The squid lock-on warning is checked in `tests/attack-warning.spec.ts` from a staged squid (`?stage=`), since no fixed seed's route reliably draws one; the hints on Normal, Easy and a squid lock-on, and the B button's power-up icon on touch, are in `tests/hints.spec.ts` the same way, and the guide arrow (Easy shows it, Normal does not, it clears once the player swims the way it points) in `tests/guide.spec.ts` from the `?stage=guide` stage. `?course=` is checked in `tests/course.spec.ts`, since scenarios can't pass a query. Idle scenarios wait `IDLE_TO_RESULTS`, which the race limit guarantees. Power-up scenarios pin a seed because clam rolls depend on it.
