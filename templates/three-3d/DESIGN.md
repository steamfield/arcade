# Orb Field (3D template)

Template 3D game. Copy it with `pnpm arcade new <slug> --template three-3d`, then replace the gameplay.

## Core loop

Walk the field, collect six orbs (one straight ahead, five placed by the seed), shove crates around. Orbs autosave as they're collected; the game resumes automatically.

## Controls

| Action | Keyboard         | Touch    |
| ------ | ---------------- | -------- |
| move   | Arrow keys, WASD | d-pad    |
| jump   | Space            | A button |

## Launch parameters

- `?seed=<n>` changes the orb layout for a new game (a saved game keeps its own seed).
- `?stage=nearly-cleared` leaves one orb to collect, for captures (only with `?debug=1` or in test mode; a staged game is never saved). Add stages in `src/engine/capture-stages.ts`.
- `?debug=1` is accepted; this template has no debug overlay yet.

## Structure

- `src/logic/world.ts`: player movement on the plane, jump, orbs (seeded), `summarize()`.
- `src/engine/runtime.ts`: no three.js or Rapier. Owns the world, the fixed step, the serialized save writes and `worldHash()` (logic state only, never Rapier's crates). Tested in `runtime.test.ts`.
- `src/engine/game.ts`: renderer, real-time loop, GameHandle for the shell; steps physics after each tick.
- `src/engine/world-view.ts`: the three.js scene, drawn from the world.
- `src/engine/capture-stages.ts`: `?stage=` capture stages.
- `src/engine/physics.ts`: Rapier, lazy-loaded after the first frame. The player is a kinematic body driven by logic; crates are dynamic. `idle()` is false until physics is ready.
- `src/engine/camera-rig.ts`: third-person follow camera (visual-only smoothing).

## Scenarios

`collect-first-orb`, `push-crate`, `restore-save`, `nearly-cleared`. `scenarios/kit.ts` holds the shared sequences and `savedGame()`.

## Not done yet

Pointer-drag camera look, debug overlay (collider wireframes), audio.
