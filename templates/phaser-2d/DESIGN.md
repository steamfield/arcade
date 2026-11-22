# Coin Run (2D template)

Template platformer. Copy it with `pnpm arcade new <slug> --template phaser-2d`, then replace the gameplay.

## Core loop

Run right, jump the gaps and walls, collect coins, touch the flag. Coins autosave as they're collected.

## Controls

| Action            | Keyboard          | Touch    |
| ----------------- | ----------------- | -------- |
| left / right      | Arrow keys, A / D | d-pad    |
| up / down (menus) | Arrow keys, W / S | d-pad    |
| jump / confirm    | Space, Z, Enter   | A button |

Jump height depends on how long jump is held (released early = lower jump).

## Scenes and launch parameters

- `title`: menu with Continue (only when a save has progress) and New game.
- `play`: the level. `?scene=play` skips the title (continues the save if there is one).
- `?debug=1` draws the player hitbox plus tick and tile in the HUD.

## Structure

- `src/logic/level.ts`: ASCII level format (`#` solid, `o` coin, `P` spawn, `G` goal) and `LEVEL_1`.
- `src/logic/world.ts`: tile physics, coins, goal; `toAscii()` for tests and `arcade see --ascii`.
- `src/engine/game.ts`: Phaser scenes. `Runtime.tick()` is the only place logic advances.
- Placeholder textures are drawn at boot in `src/engine/textures.ts`.

## Scenarios

`collect-first-coin`, `complete-level`, `restore-save`.
