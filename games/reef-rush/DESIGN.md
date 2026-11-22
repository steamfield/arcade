# Reef Rush

Swim a reef course against three rivals and reach the finish gate first. Grab power-ups from clams, stack up to three, and fire them together for combos.

This is the repo's first full game and its reference layout: logic in feature folders under `src/logic/`, one orchestrating `world.ts`, engine seams (`art/index.ts`, `art/font.ts`, `audio/index.ts`) that later work swaps behind.

## Core loop

Pick a racer, then a 3-2-1 countdown and the race. Swim with momentum, kick for bursts, ride currents, avoid kelp drag. Finish ahead of three rivals drawn from the rest of the cast. Results show place and time; the best finish is saved.

## Controls

| Action        | Keyboard          | Touch |
| ------------- | ----------------- | ----- |
| swim          | Arrow keys, WASD  | d-pad |
| kick, confirm | Space, Z, Enter   | A     |
| menu up/down  | Up/Down, W/S      | d-pad |
| burst, back   | X, Shift          | B     |

On the select screen the arrows (d-pad) move around the grid, kick races as the highlighted character, and burst goes back to the title.

## Rules worth knowing

- Tick order and determinism rules are in the header of `src/logic/world.ts`.
- Rivals steer by a distance-to-finish field (`race/flowfield.ts`); placing uses a separate uniform-cost field so places don't flicker.
- The race ends when you finish, 10 s after the third rival finishes (you DNF), or at 5 minutes.
- Rivals out-swim you (about 1.5x your swim force) but kick and burst rarely, so your kicks and power-ups are how you win. Catch-up scales their swim force by 0.05 per tile of gap, between 0.6x when far ahead of you and 1.15x when far behind (`ai/rival.ts` `CATCH_UP`). Rivals steer around urchins and jellies they can see coming (`ai/avoid.ts`). They burst items only at you, never at each other, and flash a lantern only at a racer just ahead (`ai/items.ts`). In a dark zone a rival that can't see (not Selene, no Glow Lantern) wobbles twice as much and replans half as often.
- Difficulty is measured per character in `logic/difficulty/<character>.test.ts` (shared bots in `race-bots.ts`) on 30 seeds: an expert bot wins with the lead rival within 8 s in at least 21, and a novice bot (loose steering, occasional kicks, no items) places 3rd or 4th in at least 21 and finishes within 1.3x the winner's time in at least 24. Each character's plain expert wins must land in 24-28 of 30, which keeps the roster within about 13 points of each other. On seeds 1-200 the expert close-win rate is 78-85% by character and the novice bars are 100%.
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

Clams (`?` in the course) open on touch, roll a power-up weighted by place (leaders get defensive kinds, trailers get speed) and stay shut for 4 s. You hold up to three, oldest first, never two of a kind; a fourth pushes out the oldest. Burst (B) fires everything you hold at once, then cools down for 2.5 s; bursting doesn't use them up.

| Power-up | Passive | Burst |
| --- | --- | --- |
| Jet Fins | +15% speed, faster kick | dash |
| Bubble Shield | absorbs one hit | fires a bubble that traps a rival |
| Puffer | doubles bump push | inflate: break coral, hit racers, urchin-proof |
| Ink Sac | | ink cloud that slows racers behind |
| Glow Lantern | pulls in pearls within 3 tiles | flash that stuns nearby racers and jellies |

Four more kinds are planned (Homing Squid, Riptide, Undertow, Mimic Octopus; see `plans/reef-rush.md` phase 7); their contracts exist but they don't roll from clams yet.

Held pairs combine: Cannonball (Jet Fins + Puffer, an inflated dash through coral), Ink Trail (Jet Fins + Ink Sac), Lantern Bubble (Bubble Shield + Glow Lantern), Ink Bomb (Puffer + Ink Sac), Comet (Jet Fins + Glow Lantern, flash at both ends of the dash). Combos are fixed when the burst fires.

A hit (urchin `*`, jelly `j`, bubble, puffer, flash) takes your shield if you hold one, else knocks off your newest power-up as a loose pickup anyone can grab after half a second; with nothing held you're stunned. Every hit gives a second of invulnerability. Pearls (`o`) give a short speed boost. Rivals burst when a held kind has a use (`ai/items.ts`).

## Scenes and launch parameters

- `boot`: builds every texture (`engine/art/index.ts`), then routes.
- `title`: the logo over the swimming cast, Race, Sound (mute) and Motion (reduced motion) buttons, PRESS A on touch screens only, and your best time and place when you have one. Settings save at once and apply for the session even if the save fails; a fresh save follows the OS reduced-motion preference.
- `select`: the eight characters in a 4x2 grid (portrait and short name, the cursor's cell in a gold frame) and a card with the highlighted character's full name, ability and what it does. The cursor starts on your last pick. Kick saves the pick and races; burst goes back. Like menus, it ignores kick for its first 20 ticks. Under the card the highlighted racer swims at 2x, and a footer shows the controls (icons on desktop, A/B letters on touch). Layout in `UI.md` "Select".
- `race`: 3-2-1-GO countdown, then the race, with FINAL STRETCH and FINISH splashes. HUD (laid out in `UI.md`; the stack well has one slot per item your racer can hold, so four for Nib): place with your portrait (hidden during the countdown; pops up or down on a change), timer, a progress strip with each racer's head, and a well with kick, burst (a dim ring while it recharges) and three stack slots (empty ones show a dot). Combo names appear beside you, clear of your sprite. The camera follows you with a deadzone and lookahead. 90 ticks after the race ends you go to results.
- `results`: a podium with medals for the top three, standings with names and times revealed row by row (DNF if not finished), your row in sun with your head beside it, a NEW BEST or BEST NOT SAVED readout, then Race again or Title.
- Menus ignore kick for their first 20 ticks, so a kick still being pressed from the race can't skip the results.
- Title Race goes to `select`; results' Race again races the same character again without the select screen.
- `?scene=race` (or `?scene=play`) skips the title and races as the saved pick (Rudy on a fresh save). `?seed=7` changes rival behaviour and which characters you race. Each race is seeded with `seed + races in the save`, so a rematch plays differently while a test run still repeats exactly.
- Save version 3: the best finish, races run, settings, and `character`, the last pick. A v2 save loads as Rudy.
- `?debug=1` draws hitboxes from logic state and shows the tick and your tile.
- `?stage=<name>` (needs `?debug=1`, or the test harness) puts attack power-ups into the race before its first frame, to review their views without waiting for a roll: `icons-a`, `icons-b`, `squid-flight`, `squid-lockon`, `squid-lockon-far`, `squid-latched`, `riptide`, `decoy`, `undertow` (`engine/debug-stage.ts`). A staged race never saves a result. Without the gate the parameter is ignored.
- Attack power-up warnings: a squid locked on you shows an edge arrow, a LOCKED ON! caption and a rising ping (at most once per 1.5 s); a latched squid shows KICK! beside you (PRESS A on touch). Details in `UI.md`.

## Engine layout

`engine/game.ts` wires Phaser to the shell. `engine/runtime.ts` is the only place logic ticks (`game.ts` feeds its clock once per Phaser step): it reads input, steps the world or the menu, drains each tick's events once and hands them to audio and to views that listen. Scenes in `engine/scenes/` build views from `engine/view/` and sync them every frame. Screens follow `UI.md` (palette, type scale, layout grid, safe zones, motion). Text goes only through `art/font.ts` `createLabel`; textures and animations only through `art/keys.ts`.

## Art and audio

Every sprite is palette-indexed pixel text in `engine/art/sprites/`, drawn at boot by `art/pixel.ts` (at most 4 colours per frame; hazards and each racer's main colour hold 3:1 contrast against every water band, and at least a quarter of every racer frame's pixels do, spread over most of its height, enforced in `sprites.test.ts`). The UI kit (fonts, panels, icons, portraits, logo) lives in `engine/art/ui/`. Sound is a four-voice chip synth (`audio/synth.ts`, `sequencer.ts`); songs are written in a small text notation (`audio/notation.ts`, songs in `audio/songs/`) and parsed at load, so a malformed song fails tests. The race theme speeds up for the final stretch.

## Effects

`engine/fx/` turns logic events into particles and camera shake; racer squash, invulnerability flicker and the 2x Puffer live in the racer and power-up views. Effects run per logic tick from events, use their own cosmetic rng (never `world.rngs`), and never change logic state. Shake only ever moves the camera for the player's own hits, shield pops (lighter) and cannonball impacts, capped at 4 px. Reduced motion turns shake off, holds particles still, swaps the flicker for a steady half alpha, drops squash and the place flash, and shows the lantern ring at full reach.

## The course

About 90 s for a good player, 616 columns in five sections: the reef (columns 0-94, the opening the power-up scenarios rely on); the current highway (95-246: a current tunnel up top or a kelp bed with clams below, then a floor-current hall); the jelly field (247-364: jellies bobbing high and low in step); the urchin gauntlet (365-466: an urchin-lined tube or clean roads over and under, with a clam pair at its exit); and the coral gate and final drop (467-615: smash the 2-tile gate with a Puffer or climb over it, then ride a downward current to the finish at column 611).

## Course format

ASCII in `src/logic/level/levels.ts`, documented in `src/logic/level/parse.ts`.

## Scenarios

`countdown-holds-racers`, `race-to-finish`, `results-after-finish`, `results-ignores-early-kick`, `dnf-results`, `race-again`, `results-to-title`, `title-best`, `clam-stack`, `hit-pops-newest`, `cannonball-combo`, `audio-plays`, `settings-toggle`, `pick-character`. The top route most share is `TOP_ROUTE` in `scenarios/kit.ts`, a recorded no-kick run on seed 1 that finishes the whole course; any change to the course or rival tuning means re-recording it. Idle scenarios wait `IDLE_TO_RESULTS`, which the race limit guarantees. Power-up scenarios pin a seed because clam rolls depend on it.
