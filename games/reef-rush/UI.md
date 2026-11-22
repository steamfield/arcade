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
| Place panel | 6, 6, 56, 24 | `accent` panel; portrait at (10, 10); display numeral plus suffix ("4TH", 26 wide) at (28, 12). The numeral is hidden during the countdown (logic only places racers once they move) and the first racing frame sets it without a pop |
| Place change arrow | 6, 34, 9, 9 | `arrowUp` / `arrowDown`, under the place panel |
| Timer | 66, 6, 52, 15 | `inset` panel; text centred, top at y 10 |
| Kick / power-up well | 66, 23, 61, 17 (72 wide for a stack of 4) | `inset` panel; icons at y 27 and x 70, 81, 92, 103, 114 (kick, burst, a stack of 3). The well has one slot per power-up the player can hold (`stackMaxFor`), each 11 px further right, so Nib's fourth slot sits at x 125 and the well ends at x 137, under the strip and clear of the back link (`wellLayout` in `hud.ts`). Kick and burst show at 50% opacity when not ready (`hud.test.ts` holds that to 3:1 on the well). While the burst recharges a 1 px `dim` ring around it (x 80-90, y 26-36) fills clockwise from top centre; a ready burst is the icon at full opacity with no ring. An empty slot shows a 3x3 `dim` socket at its centre. No divider: x 90-91 is the ring's column and the gap |
| Progress strip | 122, 6, 112, 15 | `inset` panel; 7x7 `ui-heads` at y 10, travelling over x 126-223 |
| Finish flag | 236, 9, 9, 9 | `finishFlag` at the strip's end, clear of the back link |
| Splash | centred on (160, 62) | display at 2x, `outline: true`; countdown and DNF in foam (coral isn't allowed over the water), GO / FINAL STRETCH / FINISH in sun; the widest (FINAL STRETCH) covers x 53-267, y 50-74 |
| Caption | centred on (160, 45) | text, foam, outlined: TRAPPED!, STUNNED!, SLOWED BY INK, or an off-screen bubble's direction |
| Darkness | whole screen, over a dark zone's columns | `view/dark-view.ts`: a near-black veil (90%) under the HUD layer, faded in over 32 px at each end of the zone, with a light pool cut around every racer (player 64 px, leaning up to 16 px ahead along their velocity; rival 28; +32 holding a Glow Lantern; four 4 px rings of falling light at the edge), so at top speed a hazard is lit about 0.35 s before contact. Urchins (coral, 55%) and jellies (lilac, 60%) in a zone show a 5x5 glint above the veil. A player who sees in the dark (`racerSeesInDark`, Selene) gets only a 30% tint. One screen-sized render texture, redrawn only while a zone is on screen and the tick or scroll changed; numbers in `view/dark-math.ts` |
| Combo name | centred on x 168, y follows the player | display for 10 ticks then text, sun, outlined. x 168 is the middle of the safe column (x 108-228). Its nearest edge stays 16 px from the player's body centre (half an inflated puffer plus 4), above the player when that fits under the caption line, else below, always within y 50-174 (`comboCentreY`) |

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
| Racer lane | 0, 62, 320, 12 | racers swim past left to right (sprites, not text); still under reduced motion |
| Race button | 120, 82, 80, 15 | cursor fin at x 109-117 |
| Sound button | 120, 99, 80, 15 | SOUND ON / SOUND OFF, changes the moment the setting does |
| Motion button | 120, 116, 80, 15 | MOTION FULL / MOTION LESS. "MOTION REDUCED" is 83 px, too wide for a button whose fin clears the d-pad zone with the column centred on the logo |
| PRESS A | 140, 137, 41, 7 | touch screens only (`?touch=1` or a coarse pointer, the rule `@arcade/input` mounts the controls by); on a keyboard A is a move key. Foam, outlined, blinks. 6 px clear of the buttons and the card so it reads as a hint |
| Best card | 110, 150, 100, 24 | `raised`; medal at (114, 155), or the saved character's portrait for a 4th-place best; "BEST 2ND" in dim at (130, 154); time in foam at (130, 163) |

All three buttons are 80 wide so the fins line up; 80 is the widest that keeps the fin (x 109-117) clear of the d-pad zone (x < 108).

```
                                            (back link)
              R E E F   R U S H   (2x)
  ~ ~ racers ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
               >[    RACE    ]
                [  SOUND ON  ]
                [ MOTION FULL]
                   PRESS A        (touch only)
              [(2) BEST 2ND  ]
 (d-pad)      [    0:24.46   ]                   (A/B)
```

## Select

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | 112, 6, 96, 12 | "PICK A RACER", display, sun, outlined, centred on x 160 |
| Grid cells | from 22, 28; 66x22; 4 px between columns, 2 between rows | 4x2 in `CHARACTER_IDS` order: rows y 28-49 and 52-73. `raised`, the cursor's cell `accent` with its name in sun; 16x16 portrait at (+3, +3), short name in foam at (+22, +8). The top-right cell (x 232-297) starts below the back link; the bottom row ends above the d-pad zone |
| Card | 110, 78, 188, 40 | `raised`; right edge on the grid's, bottom at y 117 above the A/B zone. Portrait at 2x (32x32) at (114, 82); text column x 150-293 (`CARD_TEXT_WIDTH` 144): full name in display sun at y 83, ability in foam at y 98, blurb in dim at y 107. `character-select.test.ts` holds every line to the column |
| Preview | 144, 128, 32, 24 | the picked racer's sprite at 2x, centred on (160, 140), swimming in place |
| Footer | 114, 159, 92, 15 | `inset` readout: kick icon at (122, 162) + RACE, burst icon at (164, 162) + BACK, words in foam 11 px right of their icons. On touch screens (the PRESS A rule) the icons give way to the button letters A and B in sun |

The card, preview and footer stay in the safe column (x 108-228) below the grid, except the card's right part, which ends above the A/B zone.

```
                 PICK A RACER                (back link)
   [@ RUDY  ][@ GIL   ][@ STREAK][@ ONYX  ]
   [@ NIB   ][@ BARON ][@ SELENE][@ ROOK  ]
               [@@@@ BARON BARNACLE        ]
               [@@@@ BULLDOZER             ]
               [@@@@ RAMS CORAL, HARD TO BUMP]
 (d-pad)               ><(((*>                   (A/B)
                  [>> RACE  <> BACK]
```

## Results

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | 130, 6, 60, 12 | "RESULTS", display, sun, outlined |
| 1st plinth | 140, 44, 40, 32 | `accent`; portrait at (152, 27); medal at (154, 47) |
| 2nd plinth | 96, 50, 40, 26 | `raised`; portrait at (108, 33); medal at (110, 53) |
| 3rd plinth | 184, 56, 40, 20 | `raised`; portrait at (196, 39); medal at (198, 59) |
| Standing rows | 120, 80, 107, 7, pitch 10 | "4TH  SQUIB 0:24.46"; rivals in foam, the player in sun, all outlined; the player's character's 7x7 head at (111, row y) on the player's row once it settles, never moving. The only cursor fin on screen is the menu's. The last row ends at y 116 (117 with its outline) |
| Ribbon | 114, 120, 92, 15 | `inset`, so it reads as a readout and never as a selected button; "NEW BEST" in sun or "BEST NOT SAVED" in coral, otherwise hidden |
| Race again | 122, 139, 76, 15 | button |
| Title | 122, 158, 76, 15 | button; cursor fin at x 111-119 |

```
                  RESULTS                    (back link)
                   [@@]
           [@@]  +------+  [@@]
         +------+| (1)  |
         | (2)  ||      |+------+
         +------++------+| (3)  |
 (d-pad)       1ST  SQUIB 0:14.78
               2ND  TESS  0:14.96 ...
            @  4TH  PIP   0:24.46
            [   NEW BEST   ]
           >[  RACE AGAIN  ]
            [    TITLE     ]                    (A/B)
```

## Motion (ticks at 60/s)

| Motion | Normal | Reduced motion |
| --- | --- | --- |
| Menu cursor fin | 1 px nudge, 16 ticks each way (`button.animate(tick, reducedMotion)`) | still |
| Place change | arrow slides 4 px into place over 8 ticks; the numeral's tone pops for 30 ticks | arrow and tone shown for 30 ticks, no slide |
| Countdown numeral | drops 6 px in over 6 ticks, then holds | appears in place |
| GO / FINAL STRETCH / FINISH | slides in 12 px from the right over 8 ticks, holds 45 | appears, holds 45 |
| PRESS A blink | 32 on / 16 off | always on |
| Results rows | one row every 20 ticks, each sliding in 8 px from the left over 6 ticks (from x 112, clear of the d-pad zone) | one row every 20 ticks, no slide |
| Select card text | drops 2 px into place over 6 ticks on each cursor move (not when the screen opens) | appears |
| Select preview | swaps swim strokes every 8 ticks | still |
| Dark-zone light pools | shrink by 0-2 px in a fixed shuffle, changing at most every 20 ticks | still, full radius |
| Ribbon | drops 2 px in over 10 ticks after the last row, from y 118 so it never covers the last row's outline | appears |

- Nothing flashes more than 3 times a second.
- Positions animate from the logic tick, never from Phaser tweens, so captures repeat.
- `ui/motion.ts` owns the kit's own motion (the cursor fin). Screen slides use `slideRemaining` in `view/race-text.ts` and move labels with `Label.setOffset`; the splash timing is `splashFrame` there, the place pop `trackPlace` in `view/hud.ts`.
- Every slide starts and ends clear of the safe zones.
