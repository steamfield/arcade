# Reef Rush UI spec

The kit lives in `src/engine/art/ui/` and `src/engine/art/font.ts`. Screens are built from it; nothing else draws text, frames or icons.

## Palette (`ui/palette.ts`)

| Role | Colour | Use |
| --- | --- | --- |
| ink | `#0b0a1e` | Outlines, text shadow |
| indigo | `#211b48` | Panel body (never water blue) |
| foam | `#f6f0dc` | Primary text, icons |
| sun | `#ffc53a` | Accent: selection, player's place, gold, logo |
| coral | `#ff8a7a` | Alert: place lost, DNF, save failed |

Ramps, not new hues: `indigoLight`/`indigoDark` bevels, `well` inset fill, `sunDark` gold bevel, `dim` (`#a9a6d0`) secondary text. Every tone, plain and display-shaded, holds 4.5:1 against the shadow and all panel fills (`ui.test.ts`). Never carry meaning by colour alone: pair coral with an arrow, DNF text or a medal numeral.

## Type scale

| Size | Face | Px | Line | For |
| --- | --- | --- | --- | --- |
| `text` | 5x7 monospace caps | 7 | 9 | Menus, labels, timer, results rows |
| `display` | 12 px caps, digits tabular | 12 | 14 | Place numeral, splashes, headings |
| `display` + `scale: 2` | same at 2x | 24 | 28 | Countdown, GO / FINAL STRETCH / FINISH |

Text is drawn in capitals. Every label gets a 1 px ink shadow (1 glyph px at 2x). Only integer scales.

## Grid and margins

320x180, 4 px grid. Outer margin 6 px. Panels: 3 px frame (`PANEL_INSET`), content 2 px inside that. Buttons 15 px tall, at least 64 wide, 4 px apart. Gaps between HUD panels 4 px.

## Safe zones (game px)

- Back link: top-right 56x14 (x 264-320, y 0-14). Nothing goes there.
- Phones (touch overlay): bottom-left 60x110 (x 0-60, y 70-180) for the d-pad; bottom-right 44x70 (x 276-320, y 110-180) for the buttons. HUD and menus stay out of both on every device so layout never changes.

## HUD zones (race)

| Element | Rect (x, y, w, h) | Kit |
| --- | --- | --- |
| Place panel | 6, 6, 50, 24 | `accent` panel, portrait 16x16, display numeral + suffix |
| Timer | 60, 6, 52, 13 | `inset` panel, text face |
| Kick / burst | 60, 21, 52, 9 | `kick`, `burst` icons + power-up icons (stack of 3) |
| Progress strip | 116, 6, 144, 12 | `inset` panel; portraits at 1x shrunk to head icons; `finishFlag` at right end |
| Place change | right of place panel, 58, 8 | `arrowUp` (sun) / `arrowDown` (coral) |
| Splash | centred at 160, 70 | display x2 |

## Motion (ticks at 60/s; `ui/motion.ts` owns the code)

| Motion | Normal | Reduced motion |
| --- | --- | --- |
| Menu cursor fin | 1 px nudge, 16 ticks each way | still |
| Place change | arrow rises/falls 4 px over 8 ticks, numeral tone pops 30 ticks | arrow and tone shown 30 ticks, no slide |
| Countdown numeral | drops 6 px in over 6 ticks, holds | appears in place |
| GO / FINAL STRETCH / FINISH | slides in from 12 px over 8 ticks, holds 45 | appears, holds 45 |
| PRESS A blink | 32 on / 16 off | always on |
| Results rows | one row every 20 ticks, slides 8 px over 6 ticks | one row every 20 ticks, no slide |
| NEW BEST ribbon | drops in over 10 ticks after last row | appears |

Nothing flashes faster than 3 times a second. Animate from the logic tick, never Phaser tweens, so captures repeat.

## Layouts

Race HUD:

```
+------------------------------------------------------------------+
|[@ 1ST ][0:24.46] ^ [#=====o===o=o====@=============F]   (back)   |
|[portr ][K> B* ** ]                                               |
|                                                                  |
|                          3 / GO! / FINISH!                      |
|                                                                  |
|(d-pad)                                                   (A)(B)  |
+------------------------------------------------------------------+
```

Title:

```
+------------------------------------------------------------------+
|                                                       (back)     |
|                  [ REEF RUSH logo at 2x, y 28 ]                 |
|        ~ racers swim past, left to right, y 84-104 ~             |
|                        >[   RACE   ]                             |
|                          PRESS A (blinks, y 128)                 |
|                 [ BEST  0:24.46   (medal 2) ]   card y 142       |
+------------------------------------------------------------------+
```

Results:

```
+------------------------------------------------------------------+
|                       RESULTS (display)              (back)      |
|           [Squib]                                                |
|   [Tess]  [ 1  ]  [Bo ]       portraits on a podium, medals      |
|   [ 2  ]  [    ]  [ 3 ]       below each, time under each        |
|   1ST SQUIB 0:14.78  ... rows reveal one per 20 ticks            |
|   > 4TH PIP 0:24.46   (accent panel row)      ~NEW BEST~ ribbon  |
|              >[ RACE AGAIN ]  [ TITLE ]                          |
+------------------------------------------------------------------+
```
