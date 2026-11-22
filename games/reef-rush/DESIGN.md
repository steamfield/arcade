# Reef Rush

Swim a reef course against three rivals and reach the finish gate first. Grab power-ups from clams, stack up to three, and fire them together for combos.

This is the repo's first full game and its reference layout: logic in feature folders under `src/logic/`, one orchestrating `world.ts`, engine seams (`art/index.ts`, `art/font.ts`, `audio/index.ts`) that later work swaps behind.

## Core loop

3-2-1 countdown, then race. Swim with momentum, kick for bursts, ride currents, avoid kelp drag. Finish ahead of Tess (steady turtle), Squib (erratic squid) and Bo (heavy crab). Results show place and time; the best finish is saved.

## Controls

| Action        | Keyboard          | Touch |
| ------------- | ----------------- | ----- |
| swim          | Arrow keys, WASD  | d-pad |
| kick, confirm | Space, Z, Enter   | A     |
| menu up/down  | Up/Down, W/S      | d-pad |
| burst         | X, Shift          | B     |

## Rules worth knowing

- Tick order and determinism rules are in the header of `src/logic/world.ts`.
- Rivals steer by a distance-to-finish field (`race/flowfield.ts`); placing uses a separate uniform-cost field so places don't flicker.
- The race ends when you finish, 10 s after the third rival finishes (you DNF), or at 5 minutes.
- Rivals get mild catch-up: a little slower when far ahead of you, a little faster when far behind (`ai/rival.ts` `CATCH_UP`).

## Scenes and launch parameters

- `boot`: builds every texture (`engine/art/index.ts`), then routes.
- `title`: the Race option, and your best time and place when you have one.
- `race`: 3-2-1-GO countdown, then the race. HUD: big place, timer, kick-ready pip, and a progress strip with one marker per racer (Pip yellow circle, Tess green square, Squib purple triangle, Bo orange diamond). The camera follows you with a deadzone and lookahead. 90 ticks after the race ends you go to results.
- `results`: standings with names and times (DNF if not finished), your row highlighted, "New best!" or "Best time not saved", then Race again or Title.
- Menus ignore kick for their first 20 ticks, so a kick still being pressed from the race can't skip the results.
- `?scene=race` (or `?scene=play`) skips the title. `?seed=7` changes rival behaviour. Each race is seeded with `seed + races in the save`, so a rematch plays differently while a test run still repeats exactly.
- `?debug=1` draws hitboxes from logic state and shows the tick and your tile.

## Engine layout

`engine/game.ts` wires Phaser to the shell. `engine/runtime.ts` is the only place logic ticks (`game.ts` feeds its clock once per Phaser step): it reads input, steps the world or the menu, drains each tick's events once and hands them to audio (`audio/index.ts`, silent for now) and to views that listen. Scenes in `engine/scenes/` build views from `engine/view/` and sync them every frame. Text goes only through `art/font.ts` `createLabel`; textures and animations only through `art/keys.ts`.

## Course format

ASCII in `src/logic/level/levels.ts`, documented in `src/logic/level/parse.ts`.

## Scenarios

`countdown-holds-racers`, `race-to-finish`, `results-after-finish`, `results-ignores-early-kick`, `dnf-results`, `race-again`, `results-to-title`, `title-best`. The top route they share is `TOP_ROUTE` in `scenarios/kit.ts`.
