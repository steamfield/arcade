# Reef Rush UI spec

The kit lives in `src/engine/art/ui/` and `src/engine/art/font.ts`. Screens are built from it; nothing else draws text, frames or icons. Rects are `(x, y, w, h)` in game px from the top-left corner.

## Palette (`ui/palette.ts`)

| Role | Colour | Use |
| --- | --- | --- |
| ink | `#0b0a1e` | Text shadows and outlines (baked into the shadow fonts), panel outlines |
| indigo | `#211b48` | Panel body (never water blue) |
| foam | `#f6f0dc` | Primary text; the rim on icons and medals |
| sun | `#ffc53a` | Accent: selection, the player's place, gold, logo |
| coral | `#ff8a7a` | Alert: place lost, DNF, save failed |

Ramps, not new hues: `indigoLight`/`indigoDark` bevels, `well` inset fill, `sunDark` gold bevel, `dim` (`#a9a6d0`) secondary text. Pick text colours with `tone`. The `color` option is deprecated: use `tone`. Never let colour alone carry meaning: pair coral with an arrow, DNF text or a medal numeral.

- **Text on a panel:** any tone, with the default drop shadow. Every tone, plain or display-shaded, holds 4.5:1 on every panel fill.
- **Text over the water:** foam or sun only (`OFF_PANEL_TONES`), always with `outline: true`. Coral and dim fall below 4.5:1 on shallow water.
- `ui.test.ts` checks both rules, and checks icon and medal silhouettes at 3:1 on indigo and on the inset well.

## Type scale

| Size | Face | Px | Line | For |
| --- | --- | --- | --- | --- |
| `text` | 5x7 monospace caps, 6 px pitch | 7 | 9 | Menus, labels, timer, results rows |
| `display` | 12 px caps, digits 8 wide | 12 | 14 | Place numeral, headings |
| `display` + `scale: 2` | same at 2x | 24 | 28 | Countdown, GO / FINAL STRETCH / FINISH |

Text is drawn in capitals. Shadows and outlines are one glyph pixel wide (2 px at 2x). Scales are integers only.

## Grid and padding

- The screen is 320x180 on a 2 px grid, with a 6 px outer margin.
- Panels have a 3 px frame (`PANEL_INSET`).
- Single-line readouts (timer, buttons, ribbon) get 1 px padding inside the frame, which makes a one-line text panel 15 px tall. Every other panel gets at least 1 px of padding.
- HUD pieces sit 4 px apart.
- Panel sizes are layout constants and are never animated. `panelKey` throws on a fractional size.

## Safe zones

Game px = `(CSS extent - letterbox) / scale`. The extent is measured from the screen edge, and the letterbox is the CSS gap between that edge and the canvas. The worst case is letterbox 0 at the smallest scale.

| Zone | CSS source | Game px | Worst case |
| --- | --- | --- | --- |
| Back link | `packages/shell` `.arcade-back`: top 8, right 8, about 62x17 | x 248-320, y 0-26 | desktop at scale 1 |
| D-pad | `packages/input` `.dpad`: left 32, bottom 24; three 64 px buttons span 184x184 | x 0-108, y 76-180 | phone at scale 2 (640x360) |
| A/B buttons | `.actions`: right 24, bottom 24; B at right 90, bottom 30, 68 px with its border | x 228-320, y 118-180 | phone at scale 2 |

Every rect below stays clear of all three zones on every device, so the layout never changes when the overlay appears.

## Race HUD

| Element | Rect | Kit |
| --- | --- | --- |
| Place panel | 6, 6, 56, 24 | `accent` panel; portrait at (10, 10); display numeral plus suffix ("4TH", 26 wide) at (28, 12) |
| Place change arrow | 6, 34, 9, 9 | `arrowUp` / `arrowDown`, under the place panel |
| Timer | 66, 6, 52, 15 | `inset` panel; text centred, top at y 10 |
| Kick / power-up well | 66, 23, 61, 17 | `inset` panel; icons at y 27 and x 70, 81, 92, 103, 114 (kick, burst, a stack of 3) |
| Progress strip | 122, 6, 112, 15 | `inset` panel; 7x7 `ui-heads` at y 10, travelling over x 126-223 |
| Finish flag | 236, 9, 9, 9 | `finishFlag` at the strip's end, clear of the back link |
| Splash | centred on (160, 62) | display at 2x, `outline: true`, foam or sun; the widest (FINAL STRETCH) covers x 53-267, y 50-74 |

```
 6       62 66        118 122                      234 236   248
 +-------+  +----------+  +-------------------------+  F    (back link)
 |@@ 4TH |  | 0:24.46  |  | o    o  o      @        |
 +-------+  +----------+  +-------------------------+
 ^          [K][B][p][p][p]
                   FINAL STRETCH        (centred on 160,62)
 (d-pad x<108, y>=76)                      (A/B x>=228, y>=118)
```

## Title

| Element | Rect | Notes |
| --- | --- | --- |
| Logo | 67, 28, 186, 30 | `ui-logo` at 2x |
| Racer lane | 0, 62, 320, 12 | racers swim past left to right (sprites, not text) |
| Race button | 128, 82, 64, 15 | cursor fin at x 117-125 |
| PRESS A | 140, 104, 41, 7 | foam, outlined, blinks |
| Best card | 110, 120, 100, 24 | `raised`; medal at (114, 125); "BEST 2ND" in dim at (130, 124); time in foam at (130, 133) |

```
                                            (back link)
              R E E F   R U S H   (2x)
  ~ ~ racers ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
                >[ RACE ]
                 PRESS A
              [(2) BEST 2ND  ]
 (d-pad)      [    0:24.46   ]                   (A/B)
```

## Results

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | 130, 6, 60, 12 | "RESULTS", display, sun, outlined |
| 1st plinth | 140, 44, 40, 32 | `accent`; portrait at (152, 27); medal at (154, 47) |
| 2nd plinth | 96, 50, 40, 26 | `raised`; portrait at (108, 33); medal at (110, 53) |
| 3rd plinth | 184, 56, 40, 20 | `raised`; portrait at (196, 39); medal at (198, 59) |
| Standing rows | 120, 80, 107, 7, pitch 10 | "4TH  SQUIB 0:24.46"; rivals in foam, the player in sun, all outlined; cursor fin at (109, row y - 1) on the player's row; the last row ends at y 116 |
| Ribbon | 114, 120, 92, 15 | `accent`; "NEW BEST" in sun or "BEST NOT SAVED" in coral, otherwise hidden |
| Race again | 122, 139, 76, 15 | button |
| Title | 122, 158, 76, 15 | button; cursor fin at x 111-119 |

```
                  RESULTS                    (back link)
                   [@@]
           [@@]  +------+  [@@]
         +------+| (1)  |
         | (2)  ||      |+------+
         +------++------+| (3)  |
 (d-pad)     > 1ST  SQUIB 0:14.78
               2ND  TESS  0:14.96 ...
            [   NEW BEST   ]
           >[  RACE AGAIN  ]
            [    TITLE     ]                    (A/B)
```

## Motion (ticks at 60/s; `ui/motion.ts` owns the code)

| Motion | Normal | Reduced motion |
| --- | --- | --- |
| Menu cursor fin | 1 px nudge, 16 ticks each way (`button.animate(tick, reducedMotion)`) | still |
| Place change | arrow slides 4 px into place over 8 ticks; the numeral's tone pops for 30 ticks | arrow and tone shown for 30 ticks, no slide |
| Countdown numeral | drops 6 px in over 6 ticks, then holds | appears in place |
| GO / FINAL STRETCH / FINISH | slides in 12 px from the right over 8 ticks, holds 45 | appears, holds 45 |
| PRESS A blink | 32 on / 16 off | always on |
| Results rows | one row every 20 ticks, each sliding in 8 px from the left over 6 ticks | one row every 20 ticks, no slide |
| Ribbon | drops 4 px in over 10 ticks after the last row | appears |

- Nothing flashes more than 3 times a second.
- Positions animate from the logic tick, never from Phaser tweens, so captures repeat.
- Every slide starts and ends clear of the safe zones.
