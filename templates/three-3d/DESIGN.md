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
- `?debug=1` is accepted; this template has no debug overlay yet.

## Structure

- `src/logic/world.ts`: player movement on the plane, jump, orbs (seeded), `summarize()`.
- `src/engine/game.ts`: renderer, scene, real-time loop, GameHandle for the shell.
- `src/engine/physics.ts`: Rapier, lazy-loaded after the first frame. The player is a kinematic body driven by logic; crates are dynamic. `idle()` is false until physics is ready.
- `src/engine/camera-rig.ts`: third-person follow camera (visual-only smoothing).

## Scenarios

`collect-first-orb`, `push-crate`, `restore-save`.

## Not done yet

Pointer-drag camera look, debug overlay (collider wireframes), audio.
