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
| Progress strip | 122, 6, 112, 15 | `inset` panel; 7x7 `ui-heads` at y 10, travelling over x 126-223. Heads that would sit closer than 5 px are fanned out to 5 px apart (`spreadHeads` in `race-progress.ts`): the player's head keeps its true spot and draws on top, rivals move away from it, and a pack at the start fans right and a pack at the finish fans left so none leaves the strip |
| Finish flag | 236, 9, 9, 9 | `finishFlag` at the strip's end, clear of the back link |
| Splash | centred on (160, 62) | display at 2x, `outline: true`; countdown and DNF in foam (coral isn't allowed over the water), GO / FINAL STRETCH / FINISH in sun; the widest (FINAL STRETCH) covers x 53-267, y 50-74 |
| Caption | centred on (160, 45) | text, foam, outlined: TRAPPED!, STUNNED!, LOCKED ON! (a Homing Squid has locked on the player), SLOWED BY INK, or an off-screen bubble's direction. Empty while a squid is latched, when KICK! takes the spot |
| Lock-on arrow | `MARKER_BOUNDS` x 8-312, y 52-172 | `warnArrow` (9x9 coral wedge, foam rim) turned to the nearest 45 degrees toward the squid hunting the player. On the screen's edge when the squid is off-screen, 14 px short of it when in view. Off-screen it sits where the line from the player to the squid leaves the bounds. Never inside a touch zone, nor in the splash rectangle (x 53-267, y 50-74) while a banner shows (it slides to the nearest clear point). Blinks 14 ticks on, 6 off (3 Hz); steady under reduced motion. Paired with the LOCKED ON! caption and a rising three-ping sfx, so colour is never the only signal |
| KICK! prompt | centred on x 168, beside the player | display, sun, outlined, while a squid is latched on the player, placed like the combo name (`comboCentreY`: 16 px clear of the player, above when it fits, within y 50-174), and the combo name is hidden while it shows; swaps sun and foam every 10 ticks (steady sun under reduced motion). On touch screens `PRESS A` in foam text sits 2 px under it as one block, since A is the kick button |
| Darkness | whole screen, over a dark zone's columns | `view/dark-view.ts`: a near-black veil (90%) under the HUD layer, faded in over 32 px at each end of the zone, with a light pool cut around every racer (player 64 px, leaning up to 16 px ahead along their velocity; rival 28; +32 holding a Glow Lantern; four 4 px rings of falling light at the edge), so at top speed a hazard is lit about 0.35 s before contact. Urchins (coral, 55%) and jellies (lilac, 60%) in a zone show a 5x5 glint above the veil. A player who sees in the dark (`racerSeesInDark`, Selene) gets only a 30% tint. One screen-sized render texture, redrawn only while a zone is on screen and the tick or scroll changed; numbers in `view/dark-math.ts` |
| Combo name | centred on x 168, y follows the player | display for 10 ticks then text, sun, outlined. x 168 is the middle of the safe column (x 108-228). Its nearest edge stays 16 px from the player's body centre (half an inflated puffer plus 4), above the player when that fits under the caption line, else below, always within y 50-174 (`comboCentreY`) |

Held power-ups in the well, 9x9 with a foam rim: Jet Fins (fin), Bubble Shield (ring), Puffer (spiny fish), Ink Sac (drop), Glow Lantern (lamp), Homing Squid (upright magenta-pink squid), Riptide (green swell peaks), Undertow (violet arrow pulling left), Mimic (lilac octopus with gold eyes). Each has a 12x12 world twin (the same rows padded, dark outline) for loose pickups and clam pops.

```
 6       62 66        118 122                      234 236   248
 +-------+  +----------+  +-------------------------+  F    (back link)
 |@@ 4TH |  | 0:24.46  |  | o    o  o      @        |
 +-------+  +----------+  +-------------------------+
 ^          [K][B][p][p][p]
                   FINAL STRETCH        (centred on 160,62)
 (d-pad x<108, y>=76)                      (A/B x>=228, y>=118)
```

## Attack power-ups in the water

Drawn from world state by `view/attack-view.ts` (squids, lanes, decoys) and `view/powerup-view.ts` (what happens to a racer). Art is in `art/sprites/attack.ts` and `art/sprites/powerups.ts`.

| Thing | Look | Motion | Reduced motion |
| --- | --- | --- | --- |
| Homing Squid | 16x12 magenta-pink squid (a hue no racer uses) with an 11x9 body, white eye, trailing arms, drawn to the nearest 22.5 degrees of its heading (flipped, never upside down, when heading left) | two-frame swim, 6 ticks a frame | holds frame a |
| Latched squid | the same squid's latched pose over the racer (mantle on the head, arms across the body, a 1 px foam rim round its outside), above the racer sprite | squirms 1 px every 6 ticks | still |
| Riptide lane | the lane's box washed 16% green with a foam line on each long side and one `TileSprite` of arrowed streaks exactly the box's size (turned to the flow's axis, so it never spills past a lane that isn't tile-aligned), over any current beneath; fades over its last 30 ticks | streaks scroll 1.5 px a tick along the flow | still, the arrowheads keep the direction readable |
| Mimic decoy | the owner's own racer sprite at 72-90% opacity with a cool tint (`0xcfe8ff`), swimming; blinks at 40% for its last 45 ticks | shimmers on a 48-tick cycle | steady 80% (40% when expiring) |
| Undertow pull | three violet speed lines trailing the racer, 10 px behind its centre, for as long as `status.undertow` runs | two-frame flicker, 4 ticks a frame | holds frame a |

Event effects: a squid fired puffs bubbles at its owner; a shake-off pops bubbles on the racer; a squid that fizzles leaves an ink puff where it was; a new Riptide strings bubbles along its lane; Undertow trails bubbles from each racer it pulls; a popped decoy bursts into droplets. Sounds are in `audio/sfx.ts`, chosen by `audio/attack-sfx.ts`.

In dark zones a decoy carries the rival's 28 px light pool and a squid a 14 px one.

Review captures: `?stage=<name>` with `?debug=1` on the race URL (`debug-stage.ts`, applied by `Runtime.startRace`) puts staged state in the world before the first frame: `icons-a`, `icons-b`, `squid-flight`, `squid-lockon`, `squid-lockon-far`, `squid-latched`, `riptide`, `decoy`, `undertow`. It only writes plain world state the views read, and a staged race never saves.

## Title

| Element | Rect | Notes |
| --- | --- | --- |
| Logo | 67, 28, 186, 30 | `ui-logo` at 2x |
| Racer lane | 0, 62, 320, 12 | racers swim past left to right (sprites, not text); still under reduced motion |
| Race button | 120, 78, 80, 15 | cursor fin at x 109-117 |
| Level button | 120, 95, 80, 15 | LEVEL EASY / LEVEL NORMAL / LEVEL HARD; each press cycles to the next and saves, and the text changes the moment the setting does |
| How to play button | 120, 112, 80, 15 | HOW TO PLAY opens the How to Play screen |
| Sound button | 120, 129, 80, 15 | SOUND ON / SOUND OFF, changes the moment the setting does |
| Motion button | 120, 146, 80, 15 | MOTION FULL / MOTION LESS. "MOTION REDUCED" is 83 px, too wide for a button whose fin clears the d-pad zone with the column centred on the logo |
| PRESS A | 140, 167, 41, 7 | touch screens only (`?touch=1` or a coarse pointer, the rule `@arcade/input` mounts the controls by); on a keyboard A is a move key. Foam, outlined, blinks. 6 px clear of the last button, ending on the bottom margin |
| Best card | 214, 82, 100, 24 | `raised`, right of the buttons so five buttons fit; clear of the back link above and the A/B zone (y 118 and below); medal at (218, 87), or the saved character's portrait for a 4th-place best; "BEST 2ND" in dim at (234, 86); time in foam at (234, 95) |

All five buttons are 80 wide so the fins line up; 80 is the widest that keeps the fin (x 109-117) clear of the d-pad zone (x < 108). The longest text is LEVEL NORMAL (71 px). A new save starts on Easy.

```
                                            (back link)
              R E E F   R U S H   (2x)
  ~ ~ racers ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
               >[    RACE    ]
                [ LEVEL EASY ]       [BEST 2ND  ]
                [ HOW TO PLAY]       [  0:24.46 ]
                [  SOUND ON  ]
                [ MOTION FULL]
 (d-pad)           PRESS A        (touch only)             (A/B)
```

## How to Play

Four picture pages, built for a reader who may be six: at most four short words on any line, and every idea is also a moving picture of the game's own sprites (the player's saved racer, the clam, the held-stack well, the squid). Opened from the title; A or right turns to the next page, B or left to the previous one, B (or left) on the first page returns to the title, and A on the last page does too. Like every menu it ignores presses for its first 20 ticks. Drawn over the reef backdrop, so words are foam or sun and outlined.

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | centred on (160, 12) | display, sun, outlined: SWIM AND KICK, OPEN CLAMS, B USES ALL!, ATTACKS (the key's name replaces B on a keyboard: X USES ALL!) |
| Pictures | anywhere in x 6-246, y 22-75, plus the safe column x 108-228 down to y 140 | nothing in the d-pad zone (x < 108, y 76+), the A/B zone (x 228+, y 118+) or the back link |
| Page dots | five px squares, 10 px apart, centred on x 160, top at y 140 | the current page in sun, the others dim |
| Footer | 108, 153, 120, 21 | `inset`; the kick control and NEXT, the burst control and BACK, centred as one row |

Control glyphs (`view/control-glyphs.ts`) are drawn from kit colours: on a keyboard a key cap with the key's name (SPACE kicks, X bursts, the four arrow keys in an inverted T), on a touch screen the round A and B buttons and the d-pad's plus of four arrows. A lit glyph has the gold frame. Both are 15 px tall (arrow caps 11 px).

| Page | Pictures |
| --- | --- |
| 1 SWIM AND KICK | The arrows or d-pad with the pressed arrow lit while the racer swims round a loop the way it points (45 ticks a side). Below, the kick control lights and the racer lurches 14 px forward with three speed lines behind it |
| 2 OPEN CLAMS | The racer, a clam, a power-up popping from it (the clam shuts for 30 ticks), flying into the next slot of a well at 2x. HOLD 3 over a well that fills one slot every 90 ticks, then empties |
| 3 B USES ALL! | The HUD's held-stack well (three icons at 2x) beside the burst control, an arrow and the racer. When the control lights (tick 50 of 150) a starburst flashes behind the racer and all three effects pop out around it at once. ALL AT ONCE! under it. This is the page a child must get without reading |
| 4 ATTACKS | Four cells across the top: each a 2x icon, a small scene and a name. SQUID chases a racer; RIPTIDE is a green lane with streaks pushing a racer; UNDERTOW drags a racer back with violet lines; MIMIC is a see-through decoy a squid heads for. Below, KICK TO DODGE: the kick control lights and the racer hops over an arriving squid |

Reduced motion holds each page on its clearest still moment (the pressed arrow and loop halfway, the lurch half out, the last pop with all three held, B lit with every effect out, the dragged racer, the dodge made). The page's animation counts from the tick it came up on, so captures repeat.

## Hints

For the first race on a save and every Easy race, short prompts show beside the player (`view/hints.ts` decides, `view/hint-view.ts` draws; none on later Normal and Hard races).

| Hint | When | Look |
| --- | --- | --- |
| PRESS B! | The first time a power-up lands in the stack, for 4 s or until the player fires one (then never again that race) | display, sun, outlined, with the burst glyph in the B's place: `PRESS` then the key cap X on a keyboard or the round B on touch, then `!`. Centred on x 168, placed like the combo name (`comboCentreY`), and dropped below the player when that would sit in the centre splash's band (x 53-267, y 50-74) |
| KICK! | A squid is locked on the player and has not latched yet | the kick glyph (SPACE or A) and KICK!, placed like PRESS B!. Wins over PRESS B! when both apply. The latched squid's own KICK! prompt (above) takes over once it grips |
| Pulsing B on the stack | The stack has held something unused for 5 s (restarts after each burst) | the burst glyph at 130, 24 (the well's right edge plus 3), blinking its gold frame twice a second; steady gold under reduced motion |

Glyph frames and the pulse blink at most 3 times a second. On touch screens the real B button also shows the newest held power-up's 9x9 icon at 4x above its letter (`view/burst-button.ts`), so a child can link the button to the item; it reverts to a plain B when the stack empties.

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
| Standing rows | 120, 80, 107, 7, pitch 10 | "4TH  BARON 0:24.46"; rivals in foam, the player in sun, all outlined; the player's character's 7x7 head at (111, row y) on the player's row once it settles, never moving. The only cursor fin on screen is the menu's. The last row ends at y 116 (117 with its outline) |
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
 (d-pad)       1ST  BARON 0:14.78
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
| How to Play pages | each page loops its own picture from the tick it opened (periods 120-360 ticks; see "How to Play") | one still frame |
| Hint glyph | the gold frame blinks every 15 ticks | steady |

- Nothing flashes more than 3 times a second.
- Positions animate from the logic tick, never from Phaser tweens, so captures repeat.
- `ui/motion.ts` owns the kit's own motion (the cursor fin). Screen slides use `slideRemaining` in `view/race-text.ts` and move labels with `Label.setOffset`; the splash timing is `splashFrame` there, the place pop `trackPlace` in `view/hud.ts`.
- Every slide starts and ends clear of the safe zones.
