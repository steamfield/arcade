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
| burst         | X, Shift          | B     |

## Rules worth knowing

- Tick order and determinism rules are in the header of `src/logic/world.ts`.
- Rivals steer by a distance-to-finish field (`race/flowfield.ts`); placing uses a separate uniform-cost field so places don't flicker.
- The race ends when you finish, 10 s after the third rival finishes (you DNF), or at 5 minutes.
- Rivals get mild catch-up: a little slower when far ahead of you, a little faster when far behind (`ai/rival.ts` `CATCH_UP`).

## Scenes and launch parameters

- `title`: Race, and your best time.
- `play`: the race. `?scene=play` skips the title. `?seed=7` changes rival behaviour.
- `?debug=1` draws hitboxes and the tick.

## Course format

ASCII in `src/logic/level/levels.ts`, documented in `src/logic/level/parse.ts`.

## Scenarios

`countdown-holds-racers`.
