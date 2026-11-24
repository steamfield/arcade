# Rush Racers UI spec

The kit lives in `src/engine/art/ui/` and `src/engine/art/font.ts`. Screens are built from it; nothing else draws text, frames or icons. Rects are `(x, y, w, h)` in game px from the top-left corner.

## Palette (`ui/palette.ts`)

| Role | Colour | Use |
| --- | --- | --- |
| ink | `#0b0a1e` | Text shadows and outlines (baked into the shadow fonts), panel outlines |
| indigo | `#211b48` | Panel body (never water blue) |
| foam | `#f6f0dc` | Primary text; the rim on icons and medals |
| sun | `#ffc53a` | Accent: selection, the player's place, gold, logo |
| coral | `#ff8a7a` | Alert: place lost, save failed |

Ramps, not new hues: `indigoLight`/`indigoDark` bevels, `well` inset fill, `sunDark` gold bevel, `dim` (`#a9a6d0`) secondary text. Pick text colours with `tone`. The `color` option is deprecated: use `tone`. Never let colour alone carry meaning: pair coral with an arrow, TIME UP text or a medal numeral.

- **Text on a panel:** any tone, with the default drop shadow. Every tone, plain or display-shaded, holds 4.5:1 on every panel fill.
- **Text over the water:** foam or sun only (`OFF_PANEL_TONES`), always with `outline: true`. Coral and dim fall below 4.5:1 on shallow water.
- `ui.test.ts` checks both rules, and checks icon and medal silhouettes at 3:1 on indigo and on the inset well.

### Contrast bands per theme

Each theme lists its `contrastBands` (`engine/themes/types.ts`): every colour that can sit behind a racer or off-panel text in play, which for the ocean is each water band and each painted backdrop layer colour. The rules hold against every theme's bands, so a new theme that breaks them fails the build:

- Each racer's main colour and the Homing Squid's hold 3:1 off every band, and at least a quarter of each racer frame's pixels do, spread over most of its height (`art/sprites/sprites.test.ts`). Both hazard bodies of every world hold 3:1 off the bands of every listed course's theme (`view/hazard-view.test.ts`).
- Off-panel text (foam or sun, outlined) holds 4.5:1, or its ink outline 3:1, off every band and off the theme's brightest backdrop: its top band under its caustics (22%) and a ray (5%), when it has them (`art/ui/ui.test.ts`).
- Panels, the HUD and every UI colour are global, never part of a theme.

## Type scale

| Size | Face | Px | Line | For |
| --- | --- | --- | --- | --- |
| `text` | 5x7 monospace caps, 6 px pitch | 7 | 9 | Menus, labels, timer, results rows |
| `display` | 12 px caps, digits 8 wide | 12 | 14 | Place numeral, headings |
| `display` + `scale: 2` | same at 2x | 24 | 28 | Countdown, GO / FINAL STRETCH / FINISH |

Text is drawn in capitals. Shadows and outlines are one glyph pixel wide (2 px at 2x). Scales are integers only.

## Grid and padding

- Screens are laid out on a 320x180 base on a 2 px grid, with a 6 px outer margin. The view grows past the base to fill the window at a whole-number zoom, between 4:3 and 21:9 (`engine/stage.ts`): a 1600x1000 window is 320x200 at 5x, a phone in landscape about 420x180 at 2x. Menus centre the base layout over a backdrop that fills the view; the race shows more of the course, keeps the HUD row in the top-left corner, centres its splashes and caption on the view, and moves the zones below with the edges they hang from (`engine/view/screen-layout.ts`).
- Panels have a 3 px frame (`PANEL_INSET`).
- Single-line readouts (timer, buttons, ribbon) get 1 px padding inside the frame, which makes a one-line text panel 15 px tall. Every other panel gets at least 1 px of padding.
- HUD pieces sit 4 px apart.
- Panel sizes are layout constants and are never animated. `panelKey` throws on a fractional size.

## Safe zones

Game px = `CSS extent / scale`, measured from the screen edge. The table gives the zones on the base view; on a larger view the back link and A/B zones keep their distance from the right edge, and the d-pad and A/B zones from the bottom edge.

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
| Dash and item well | 66, 23, 71, 17 (87 wide for 4 slots) | `inset` panel; icons at y 27: the dash icon at x 70, then one slot per inventory place (`stackMaxFor`) 16 px apart from x 86 (86, 102, 118), so Nib's fourth slot sits at x 134 and the well ends at x 152 (x 136 with three), under the strip and clear of the back link (`wellLayout` in `hud-well.ts`). The dash icon shows at 50% opacity while it recharges (`hud.test.ts` holds that to 3:1 on the well). A held item shows its 9x9 icon and its charges as one text-face digit, foam and outlined, right edge at the slot's x + 14 and top at y 29, overlapping the icon's last column. The selected slot wears a 1 px `sun` frame round its icon (x - 1 to x + 9, y 26-36). An empty slot shows a 3x3 `dim` socket at its centre. Items never move between slots; no Burst icon |
| Dash meter | 141, 23, 24, 17 (157 for Nib) | `inset` panel 4 px right of the well: two 6x6 `kick-pip` pips 4 px apart, 4 px in, tops at y 28. A held charge is the filled pip; a spent one the hollow ring at 60%. A pip that comes back swells from 1.6x over 12 ticks (still under reduced motion). No icon, frame or digit, so it never reads as an item slot (`createDashMeter` in `hud-well.ts`) |
| Pearl counter | 169, 23, 29, 17 (185 for Nib) | `inset` panel 4 px right of the meter: the 7x7 pearl at (+4, 28), then the count in the text face, foam, at (+14, 28), capped at 99 (`pearlText` in `hud.ts`). Its right edge (x 198, Nib 214) is `Hud.right` |
| Progress strip | 122, 6, 112, 15 | `inset` panel; 7x7 `ui-heads` at y 10, travelling over x 126-223. Heads that would sit closer than 5 px are fanned out to 5 px apart (`spreadHeads` in `race-progress.ts`): the player's head keeps its true spot and draws on top, rivals move away from it, and a pack at the start fans right and a pack at the finish fans left so none leaves the strip |
| Finish flag | 236, 9, 9, 9 | `finishFlag` at the strip's end, clear of the back link |
| Splash | centred on (160, 62) | display at 2x, `outline: true`; countdown and TIME UP in foam (coral isn't allowed over the water), GO / FINAL STRETCH / FINISH in sun; the widest (FINAL STRETCH) covers x 53-267, y 50-74 (TIME UP, 7 letters, is narrower) |
| Countdown level | centred on x 160, word at y 88, pips at y 98 | during the countdown only, under the numeral: the level's word in `display`, foam, outlined, and three 6 px squares 4 px apart (x 147-173) with a 1 px ink outline, as many sun as the level's number (1 Easy, 2 Normal, 3 Hard) and the rest `indigoLight`, the same pips as the title's Level button. Clear of the d-pad and A/B zones and below the caption line |
| Caption | centred on (160, 45) | text, foam, outlined: TRAPPED!, STUNNED!, LOCKED ON! (a Homing Squid has locked on the player), SLOWED BY INK, or an off-screen bubble's direction (`< BUBBLE`). Words that name an item come from the course's world skin, so in Thornwood they read SLOWED BY MUD and `< SAP`. Empty while a squid is latched where a dash can shake it, when DASH! takes the spot |
| Lock-on arrow | `MARKER_BOUNDS` x 8-312, y 52-172 | `warnArrow` (9x9 coral wedge, foam rim) turned to the nearest 45 degrees toward the squid hunting the player. On the screen's edge when the squid is off-screen, 14 px short of it when in view. Off-screen it sits where the line from the player to the squid leaves the bounds. Never inside a touch zone, nor in the splash rectangle (x 53-267, y 50-74) while a banner shows (it slides to the nearest clear point). Blinks 14 ticks on, 6 off (3 Hz); steady under reduced motion. Paired with the LOCKED ON! caption and a rising three-ping sfx, so colour is never the only signal |
| DASH! prompt | centred on x 168, beside the player | display, sun, outlined, while a squid is latched on the player on a course whose medium lets dashes shake it (`kickRules.shakesLatch`; not in Thornwood, where the latch runs its time and no prompt shows), placed beside the player (`besidePlayerY` in `beside-player.ts`: 16 px clear of the player, above when it fits, within y 50-174); swaps sun and foam every 10 ticks (steady sun under reduced motion). On touch screens `PRESS B` in foam text sits 2 px under it as one block, since B is the dash button |
| Player tags (online) | centred over each human racer's sprite, bottom 2 px above it; 2 px below it where the tag, outline included, would reach above y 44 (the HUD rows end with the place arrow at 43) | the racer's lobby label (P1 to P4) in the text face, foam, outlined, in the world (it moves with the racer, over the racers' layer), the local racer's included; none for a racer the AI took over, and none offline. A racer so high that the tag would cover the HUD rows below it too shows no tag until it comes down. Flipping under the sprite reads better than hiding, since the tag stays with its racer (`online/race-hud.ts` `racerTags` and `tagTop`, `view/online-race-view.ts`) |
| Waiting line (online) | centred on the safe column's middle (x 168 on the base), bottom on the bottom margin: top at y 167 for one line, 158 for two | WAITING FOR P2 (every label the race waits on, space-separated), foam, outlined, pinned to the screen, once the race has stalled 500 ms on someone; gone the moment it steps again. Three labels break onto a second line (WAITING FOR / P2 P3 P4, 65 px wide), since one line of them is 121 px with its outline and the column between the d-pad and the A/B buttons (x 108-228) is 120 |
| Darkness | whole screen, over a dark zone's columns | `view/dark-view.ts`: a near-black veil (90%) under the HUD layer, faded in over 32 px at each end of the zone, with a light pool cut around every racer (player 64 px, leaning up to 16 px ahead along their velocity; rival 28; +32 holding a Glow Lantern; four 4 px rings of falling light at the edge), so at top speed a hazard is lit about 0.35 s before contact. Urchins (coral, 55%) and jellies (lilac, 60%) in a zone show a 5x5 glint above the veil. A player who sees in the dark (`racerSeesInDark`, Selene) gets only a 30% tint. One screen-sized render texture, redrawn only while a zone is on screen and the tick or scroll changed; numbers in `view/dark-math.ts` |

Every racer, portrait, head, item icon, attack, pickup and enemy on the HUD and in the world comes from the course's world skin (`skinFor(course)`), so a Thornwood race shows Grit, Skip and the rest, Rocket Boots and acorns, and a Cloudreach race Bumper, Zip and the rest, Jet Packs and feathers, at the same rects. Reef's held items in the well, 9x9 with a foam rim: Jet Fins (fin), Bubble Shield (ring), Puffer (spiny fish), Ink Sac (drop), Glow Lantern (lamp), Homing Squid (upright magenta-pink squid), Riptide (green swell peaks), Undertow (violet arrow pulling left), Mimic (lilac octopus with gold eyes), Cannonball (iron ball with an orange spark). While a Cannonball dashes, the racer wears the 12x12 Cannonball at 2x where an inflated Puffer would show. Each has a 12x12 world twin (the same rows padded, dark outline) for loose pickups and clam pops.

Enemies draw in the world between the tiles and the racers: an eel's hole over the rock tiles (tiles + 0.5), warning bubbles, the eel's body and every enemy body on the objects layer (objects + 0.1 to + 0.3, under every racer), and the shark's `!`, the dizzy star, defeat pop rings and flying pearls just over the racers (racers + 0.5 and + 0.6), so a tell is never hidden behind a racer. Nothing enemy-related draws on the HUD layers (`view/enemy-view.ts`).

```
 6       62 66        118 122                      234 236   248
 +-------+  +----------+  +-------------------------+  F    (back link)
 |@@ 4TH |  | 0:24.46  |  | o    o  o      @        |
 +-------+  +----------+  +-------------------------+
 ^          [D] [i]3 [i]1 [ ] [oo] [o 12] [SPACE]   (fire glyph pulse at x 201)
                   FINAL STRETCH        (centred on 160,62)
 (d-pad x<108, y>=76)                      (A/B x>=228, y>=118)
```

## Attack power-ups in the water

Drawn from world state by `view/attack-view.ts` (squids, lanes, decoys) and `view/powerup-view.ts` (what happens to a racer). Reef's art is in `worlds/reef/sprites/attack.ts` and `worlds/reef/sprites/items.ts`; each world draws its own.

| Thing | Look | Motion | Reduced motion |
| --- | --- | --- | --- |
| Homing Squid | 16x12 magenta-pink squid (a hue no racer uses) with an 11x9 body, white eye, trailing arms, drawn to the nearest 22.5 degrees of its heading (flipped, never upside down, when heading left) | two-frame swim, 6 ticks a frame | holds frame a |
| Latched squid | the same squid's latched pose over the racer (mantle on the head, arms across the body, a 1 px foam rim round its outside), above the racer sprite | squirms 1 px every 6 ticks | still |
| Riptide lane | the lane's box washed 16% green with a foam line on each long side and one `TileSprite` of arrowed streaks exactly the box's size (turned to the flow's axis, so it never spills past a lane that isn't tile-aligned), over any current beneath; fades over its last 30 ticks | streaks scroll 1.5 px a tick along the flow | still, the arrowheads keep the direction readable |
| Mimic decoy | the owner's own racer sprite at 72-90% opacity with a cool tint (`0xcfe8ff`), swimming; blinks at 40% for its last 45 ticks | shimmers on a 48-tick cycle | steady 80% (40% when expiring) |
| Undertow pull | three violet speed lines trailing the racer, 10 px behind its centre, for as long as `status.undertow` runs | two-frame flicker, 4 ticks a frame | holds frame a |

Event effects: a squid fired puffs bubbles at its owner; a shake-off pops bubbles on the racer; a squid that fizzles leaves an ink puff where it was; a new Riptide strings bubbles along its lane; Undertow trails bubbles from each racer it pulls; a popped decoy bursts into droplets. Sounds are in `audio/sfx.ts`, chosen by `audio/attack-sfx.ts`.

In dark zones a decoy carries the rival's 28 px light pool and a squid a 14 px one.

Review captures: `?stage=<name>` with `?debug=1` on the race URL (`debug-stage.ts`, applied by `Runtime.startRace`) puts staged state in the world before the first frame: `icons-a`, `icons-b`, `icons-c`, `squid-flight`, `squid-lockon`, `squid-lockon-far`, `squid-latched`, `riptide`, `decoy`, `undertow`, `dark`. It only writes plain world state the views read, and a staged race never saves.

## Title

| Element | Rect | Notes |
| --- | --- | --- |
| Online notice | centred on x 126, top 8, up to 240 wide | why online play ended (`rt.online.notice`), in the text face, foam, outlined, one line of at most 40 characters (`NOTICE_MAX_CHARS`), so it spans at most x 6-246: left of the back link and above the logo. Cleared by any press on the title or by opening Friends |
| Logo | 64, 28, 192, 30 | `ui-logo` at 2x |
| Racer lane | 0, 62, view width, 12 | racers swim past left to right across the whole view, not just the base (sprites, not text); still under reduced motion |
| Race button | 120, 76, 80, 15 | cursor fin at x 109-117. The six buttons are 16 px apart (a 1 px gap), the most that fits between the racer lane and the bottom margin |
| Friends button | 120, 92, 80, 15 | FRIENDS opens the friends screen (online races) |
| How to play button | 120, 108, 80, 15 | HOW TO PLAY opens the How to Play screen |
| Level button | 120, 124, 80, 15 | EASY / NORMAL / HARD, centred; each press cycles to the next and saves, and the text changes the moment the setting does. Three 3 px pips at x 126, 131 and 136 (y 130) show the level without reading: 1 lit (sun) for Easy, 2 Normal, 3 Hard, the rest dim |
| Sound button | 120, 140, 80, 15 | SOUND ON / SOUND OFF, changes the moment the setting does |
| Motion button | 120, 156, 80, 15 | MOTION FULL / MOTION LESS, ending at y 171. "MOTION REDUCED" is 83 px, too wide for a button whose fin clears the d-pad zone with the column centred on the logo |
| PRESS A | centred on x 264, top 110, 41 wide | touch screens only (`?touch=1` or a coarse pointer, the rule `@arcade/input` mounts the controls by); on a keyboard A is a move key. Foam, outlined, blinks. Under the best card and just above the A/B zone (y 118), next to the button it names: the six buttons leave no room under the column |
| Best card | 214, 82, 100, 24 | `raised`, right of the buttons so six buttons fit; clear of the back link above and the A/B zone (y 118 and below); medal at (218, 87), or the saved character's portrait for a 4th-place best; "BEST 2ND" in dim at (234, 86); time in foam at (234, 95). It shows the best on the current course at the level the Level button is on, and swaps as it cycles; a level with no best there shows no card |

The backdrop behind the title and course select is the last listed course raced (Sunlit Shallows until then), in that course's theme; select shows the picked course's, and How to Play the current course's level in its theme. All six buttons are 80 wide so the fins line up; 80 is the widest that keeps the fin (x 109-117) clear of the d-pad zone (x < 108). The longest Level text, NORMAL, starts at x 142, clear of the pips. A new save starts on Easy.

```
      NO ROOM WITH THAT CODE                (back link)
              R E E F   R U S H   (2x)
  ~ ~ racers ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
               >[    RACE    ]
                [  FRIENDS   ]       [BEST 2ND  ]
                [ HOW TO PLAY]       [  0:24.46 ]
                [ ■□□ EASY   ]          PRESS A   (touch only)
                [  SOUND ON  ]
 (d-pad)        [ MOTION FULL]                             (A/B)
```

## How to Play

Seven picture pages, built for a reader who may be six: at most four short words on any line, and every idea is also a moving picture of the game's own sprites (the player's saved racer, the clam, the item well, the dash meter's pips, pearls, the enemies, the squid). Opened from the title; A or right turns to the next page, B or left to the previous one. Left and right stop at the first and last page: only B on the first page and A on the last page leave, back to the title with HOW TO PLAY still selected. Each turn plays the menu-move sound. Like every menu it ignores presses for its first 20 ticks. Drawn over the current course's level in its theme, so words are foam or sun and outlined. The sprites, headings and captions are the course's world's: in Thornwood the player's saved racer is its Thornwood critter, crates and acorns replace clams and pearls, the enemies page shows a beetle, and the attacks are BEE, TAILWIND, SNARE VINE and COPYCAT; in Cloudreach balloons and feathers (BALLOON POP, FEATHERS), a Cloud Crab, a Storm Crow and a Sky Eel on the enemies page, and HOMING GULL, JET STREAM, HEADWIND and MIRAGE. Pages 1, 2, 5 and 7 belong to the medium (`MEDIUM_PAGES`; a medium without its own page 2, 5 or 7 shows the shared one); Thornwood's and Cloudreach's are below the table.

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | centred on (160, 12) | display, sun, outlined: SWIM AND DASH, OPEN CLAMS, A FIRES ONE, GRAB PEARLS, DASH TO BONK, ATTACKS, DASH TO DODGE (the key's name replaces A on a keyboard: SPACE FIRES ONE) |
| Pictures | anywhere in x 6-246, y 22-75, plus the safe column x 108-228 down to y 140 | nothing in the d-pad zone (x < 108, y 76+), the A/B zone (x 228+, y 118+) or the back link |
| Page dots | squares 10 px apart, centred on x 160, centred on y 142 | the current page a 7 px square in sun, the others 5 px and dim, so the current page isn't told by colour alone |
| Footer | 108, 153, 120, 21 | `inset`; the fire control and NEXT, the dash control and BACK, centred as one row |

Control glyphs (`view/control-glyphs.ts`) are drawn from kit colours: on a keyboard a key cap with the key's name (SPACE fires, X dashes, E selects the next item, the four arrow keys in an inverted T), on a touch screen the round A and B buttons, the round swap button with a drawn `⇄` (a right arrow over a left one, since the pixel font has no `⇄`) and the d-pad's plus of four arrows. A lit glyph has the gold frame. They are 15 px tall (arrow caps 11 px); pages 1, 3 and 7 draw the dash and fire controls at 2x (30 px, SPACE 78 px wide); page 5 draws the dash control at 1x beside each racer.

| Page | Pictures |
| --- | --- |
| 1 SWIM AND DASH | The arrows or d-pad with the pressed arrow lit while the racer swims round a loop the way it points (45 ticks a side). Below, at (112, 81) the dash control at 2x lights twice (ticks 30 and 80 of a 300-tick loop) and the racer at x 210 lurches 14 px forward with three speed lines behind it each time; under the control, the HUD's dash meter at 2x (an `inset` well at 112, 114, 40x22, two 12 px pips) spends a pip per dash and gets them back one at a time as the race does (90 ticks after the first spend, then 90 more), each swelling as it returns |
| 2 OPEN CLAMS | The racer, a clam, a power-up popping from it (the clam shuts for 30 ticks), flying into the next slot of a well at 2x. HOLD 3 under a well that fills one slot every 90 ticks, then empties; each held item shows its charges as a 2x digit tucked against its lower right, as on the HUD (Jet Fins 3, Puffer 2, Ink Sac 3) |
| 3 A FIRES ONE | The HUD's item well (jet fin, puffer, ink sac at 2x, each with its charge digit) with the selected slot in a 2 px gold frame, beside the fire control at 2x, an arrow and the racer. Every 100 ticks the control lights (30 ticks in): a starburst flashes behind the racer, only the framed item's effect pops out above it, a four-dot bubble trail runs from that slot to it and its digit drops by one. At 72 ticks the next-item control at 2x under the row (at 112, 83, with SWAP in sun beside it) lights and the frame moves to the next slot, which fires on the next press; the digits refill after all three have fired. Reduced motion holds the first shot just after firing (effect and trail out). ONE AT A TIME! under it, at y 122 |
| 4 GRAB PEARLS | The racer swims along a row of five pearls at y 48 (x 70-174) over 150 ticks; each one it reaches leaves the row and counts up on a 2x pearl counter (an `inset` well at 134, 80, 52x26) while one to three speed lines grow behind it. MORE = FASTER under the counter. At tick 170 a starburst flashes on the racer, it flickers, three pearls scatter back and sink, the counter drops by three and A HIT DROPS 3 shows in sun at y 126. 300-tick loop |
| 5 DASH TO BONK | Three scenes at 2x, each the dash control at 1x, the racer and an enemy, captioned with what it does (foam) and how to beat it (sun). Top left, centre y 42: a crab walks; the dash lights and the racer lurches 26 px into it, a pop ring and a pearl rise where it was (CRAB WALKS, 1 BONK). Top right: a shark facing the racer shows its `!` and open jaws, charges 14 px, is staggered by a dash under a dizzy star over its tail, and pops at a second dash (SHARK CHARGES, 2 BONKS). In the safe column, centre y 94: eyes show in an eel's hole, the eel lunges 48 px out, and a dash while it is out pops it (EEL LUNGES, BONK IT OUT). Captions end at y 75 left of x 108 and at y 126 in the column. 200-tick loop |
| 6 ATTACKS | Four scenes at 2x, each captioned with its 9 px icon and name. Across the top: SQUID (a squid chases a racer) and RIPTIDE (a green lane of streaks carrying a racer). Under them in the safe column: UNDERTOW (a racer swims ahead, then is dragged back with violet lines behind it) and MIMIC (a squid, an arrow pointing at a see-through copy, and the real racer swimming off the other way, so the squid chases the copy and not you). Captions end at y 113, names on the left at y 62 |
| 7 DASH TO DODGE | Alone at 2x in the safe column: the dash control at the top lights at the last moment, the racer hops up 20 px and the squid, which started at x 126, swims underneath and out |

In Thornwood (the run medium), four pages change:

| Page | Pictures |
| --- | --- |
| 1 RUN AND JUMP | The arrows light as the racer runs along a floor: a quick tap of Up makes a short hop and a longer hold a tall jump. Below, the dash control lights and the racer lurches forward with speed lines (`run-page.ts`) |
| 2 HIT CRATES | The racer jumps up under a crate, its head meets the crate's bottom at the jump's peak, the crate opens and a power-up rises over it (`run-crates-page.ts`) |
| 5 JUMP TO STOMP | A beetle walks toward the racer, which jumps and lands on it; the beetle pops into an acorn (`run-enemies-page.ts`) |
| 7 SHIELD STOPS THE BEE | On foot a dash dodges nothing, so the page shows what does stop a bee: the racer stands on the floor at x 196 inside its Sap Shield bubble (4x, as a race draws it at twice the racer's scale) with the Sap Shield icon at 2x over it; a bee flies in from x 118, the bubble pops with a pop ring where they meet, and the bee is gone while the racer stands unharmed. 150-tick loop; reduced motion holds the bee at the bubble's rim (`run-shield-page.ts`) |

In Cloudreach (the flight medium), only page 1 changes; the dash dodges a Homing Gull there, so page 7 is the shared DASH TO DODGE:

| Page | Pictures |
| --- | --- |
| 1 FLAP AND SWOOP | The arrows light as the racer flies right through open sky: taps of Up flap it higher, Up held on from a flap glides it down slowly, and Down held dives it, with one caption in foam at (168, 94) naming the move as it plays (TAP UP TO FLAP, HOLD UP TO GLIDE, HOLD DOWN TO DIVE). Below, the dash control lights and the racer lurches forward into a puff cloud, which pops and comes back. Reduced motion holds the flyer still with all three captions listed beside it (`flight-page.ts`) |

In Farside (the drift medium), page 1 changes:

| Page | Pictures |
| --- | --- |
| 1 THRUST AND DRIFT | The racer crosses open space three times, with a caption naming each beat. First pass: Right lights and it burns up to speed with a flame behind it (HOLD TO BURN), the arrows go dark and it coasts on with a faint trail (LET GO TO DRIFT), then Left lights and it burns to a stop, flame ahead (BURN BACK TO BRAKE). Second pass: it drifts past a small planet and its path bends up toward it (PLANETS PULL YOU IN). Third pass: it drifts at a small black disc with a bright rim at x 220 on its line, speeds up as it is pulled in and vanishes into it; the hole stays half a second with the racer gone (BLACK HOLES SWALLOW YOU). 340-tick loop. Under reduced motion it holds mid-burn with the planet above it and one caption lists all five (`drift-page.ts`) |

Reduced motion holds each page on its clearest still moment (the pressed arrow and loop halfway, the first dash half out with one pip spent, the last pop with all three held and their charges, the first item just fired, the pearls just scattered with the counter at two, the crab popping, the shark dizzy and the eel out, the dragged racer, the dodge made, on foot the bee at the shield's rim). The page's animation counts from the tick it came up on, so captures repeat.

## Hints

For the first race on a save and every Easy race, short prompts show beside the player (`view/hints.ts` decides, `view/hint-view.ts` draws; none on later Normal and Hard races; the guide arrow is drawn by `view/guide-view.ts`). Never more than one hint shows at a time; by rank: DASH!, then PRESS FIRE or the guide arrow (as below), then SWAP!, then the pulsing fire glyph.

| Hint | When | Look |
| --- | --- | --- |
| PRESS FIRE | The first time an item lands, until the player fires one (then never again that race). On Easy it has no timeout; on the first race of another level it gives up after 4 s | display, sun, outlined: `PRESS` then the fire glyph (the key cap SPACE on a keyboard or the round A on touch), then `!`. Centred on x 168, placed beside the player (`besidePlayerY`), and dropped below the player when that would sit in the centre splash's band (x 53-267, y 50-74) |
| DASH! | A locked-on squid is inside the dodge window plus 8 ticks of lead (`SQUID.dodgeTicks`, 12, at squid speed) and the player's dash is ready, since a dash only dodges just before contact and then cools down. Only where the medium lets a dash dodge (`kickRules.dodgesSquid`), so never in Thornwood | the dash glyph (X or B) and DASH!, placed like PRESS FIRE. Wins over PRESS FIRE when both apply. The latched squid's own DASH! prompt (above) takes over once it grips, where it shows |
| Guide arrow | Easy only: the player has pushed 1.5 s (`DIFFICULTY.easy.guide.showTicks`, 90 ticks) without reaching a tile closer to the finish, so a wall is in the way. Gone as soon as they do. DASH! always wins; PRESS FIRE wins for the first 4.5 s of being stuck, then the arrow takes over and PRESS FIRE hides | a 13x13 sun-yellow arrow with a near-black outline (`sprites/guide.ts`: right and down-right, turned in quarter turns for the 8 directions), centre 24 px from the player's centre along the way on, bobbing up to 3 px outward every 40 ticks. Clamped to the play area (x 8-312, y 52-172, below the HUD rows) and dropped under the centre splash's band when it would cross it. Fades in and out at 0.2 per frame |
| SWAP! | Once a race: the first time the player holds two or more items while no hint above wants the spot (so after PRESS FIRE is done). Gone when the player swaps (the selection moves off an item that is still held; using up or losing it doesn't count) or once it has been on screen 4 s (`SWAP_TICKS`; a hint that takes the spot pauses it), and never back that race. A latched squid's DASH! prompt also holds the spot | the next-item control (the E key cap, or `⇄` on touch) and SWAP!, placed like PRESS FIRE |
| Pulsing fire glyph by the well | Items have sat unused for 5 s on Easy, or from the moment PRESS FIRE gives up on another level (restarts after each use), and no other hint is up | the fire glyph 3 px right of the pearl counter (x 201, Nib 217), level with the well (top y 24), blinking its gold frame twice a second; steady gold under reduced motion. A glyph that would reach the back link (x 248 or more: Nib's SPACE cap ends at x 256) drops to top y 27, just under it |

Glyph frames and the pulse blink at most 3 times a second. On touch screens the real A button also shows the selected item's 9x9 icon at 4x above its letter (`view/fire-button.ts`), so a child can link the button to the item; it reverts to a plain A when nothing is held. A third touch button, `⇄`, selects the next item.

## Course select

Shown between the title and select while more than one course is listed, which is now: Sunlit Shallows, Bramble Run, Thunderhead Pass, then Slingshot Alley. With one course listed, or with an unlisted `?course=` in force (such as `run-test`, `sky-test` or `drift-test`), Race goes straight to select. Drawn by `view/course-view.ts`; `course-view.test.ts` holds three courses to this layout on desktop and phone.

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | centred on (160, 12) | "PICK A COURSE", display, sun, outlined |
| Course rows | from 110, 28; 188x15; 2 px apart | one `raised` single-line readout per listed course in `LISTED_COURSES` order, the cursor's row `accent` with its name in sun (foam otherwise). Name at (+4, +4), at most `COURSE_NAME_WIDTH` (133 px, 22 characters); the best time there on the level in force right-aligned at (+184, +4) in dim, or `-:--.--` with none. Right edge on the select card's (x 297); five rows end at y 111, above the A/B zone, and a sixth course throws until the screen gets a second page |
| Footer | 114, 159, 92, 15 | `inset`, as on select: fire icon at (122, 162) + PICK, dash icon at (164, 162) + BACK; on touch screens the button letters A and B in sun |

Up and down move the cursor and wrap; A (fire) picks the course and goes to select, B (dash) goes back to the title. Like select it ignores fire for its first 20 ticks. Back from select returns here.

```
                 PICK A COURSE               (back link)
               [SUNLIT SHALLOWS       1:24.31]
               [BRAMBLE RUN           -:--.--]
               [THUNDERHEAD PASS      -:--.--]
 (d-pad)                                         (A/B)
                  [>> PICK  <> BACK]
```

## Select

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | 112, 6, 96, 12 | "PICK A RACER", display, sun, outlined, centred on x 160 |
| Grid cells | from 22, 28; 66x22; 4 px between columns, 2 between rows | the picked course's world's cast (Reef: Rudy to Rook; Thornwood: Grit, Skip, Blaze, Shade, Cheeks, Duke, Dusk, Fang; Cloudreach: Bumper, Zip, Dart, Nox, Pip, Admiral, Luna, Talon; Farside: Bolt, Zib, Flare, Umbra, Widget, Admiral, Nova, Krag; short names being the first word), 4x2 in `CHARACTER_IDS` order: rows y 28-49 and 52-73. `raised`, the cursor's cell `accent` with its name in sun; 16x16 portrait at (+3, +3), short name in foam at (+22, +8). The top-right cell (x 232-297) starts below the back link; the bottom row ends above the d-pad zone |
| Card | 110, 78, 188, 40 | `raised`; right edge on the grid's, bottom at y 117 above the A/B zone. Portrait at 2x (32x32) at (114, 82); text column x 150-293 (`CARD_TEXT_WIDTH` 144): full name in display sun at y 83, ability in foam at y 98, blurb in dim at y 107. `character-select.test.ts` holds every line to the column |
| Preview | 144, 128, 32, 24 | the picked racer's sprite at 2x, centred on (160, 140), swimming in place |
| Footer | 114, 159, 92, 15 | `inset` readout: fire icon at (122, 162) + RACE, dash icon at (164, 162) + BACK, words in foam 11 px right of their icons. On touch screens (the PRESS A rule) the icons give way to the button letters A and B in sun |

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
| Course name | from 6, 9 | only while course select is shown: the course's name, text, foam, outlined, clear of the heading and the podium |
| 1st plinth | 140, 44, 40, 32 | `accent`; portrait at (152, 27); medal at (154, 47) |
| 2nd plinth | 96, 50, 40, 26 | `raised`; portrait at (108, 33); medal at (110, 53) |
| 3rd plinth | 184, 56, 40, 20 | `raised`; portrait at (196, 39); medal at (198, 59) |
| Standing rows | 120, 77, 107, 7, pitch 9 | 18 characters, place in 4, name in 7, time or TIME UP right-aligned in 7: "4TH BARON  0:24.46", "2ND STREAK 3:06.30"; rivals in foam, the player in sun, all outlined; the player's character's 7x7 head at (111, row y) on the player's row once it settles, never moving. The only cursor fin on screen is the menu's. The last row ends at y 110 (111 with its outline); outlines of neighbouring rows touch, which stays readable |
| Ribbon | 114, 113, 92, 15 | `inset`, so it reads as a readout and never as a selected button; "NEW BEST" (this course and level) in sun or "BEST NOT SAVED" in coral, otherwise hidden; an unlisted course never shows NEW BEST |
| Race again | 122, 129, 76, 15 | button |
| Character | 122, 144, 76, 15 | button; opens course select while it is shown, else character select, with the cursor on the current pick |
| Title | 122, 159, 76, 15 | button; cursor fin at x 111-119 |

The three buttons sit at pitch 15, frames touching, and end at y 173, inside the 6 px outer margin; the ribbon ends at y 127, with a 1 px gap above them.

```
                  RESULTS                    (back link)
                   [@@]
           [@@]  +------+  [@@]
         +------+| (1)  |
         | (2)  ||      |+------+
         +------++------+| (3)  |
 (d-pad)       1ST BARON  0:14.78
               2ND TESS   0:14.96 ...
            @  4TH PIP    0:24.46
            [   NEW BEST   ]
           >[  RACE AGAIN  ]
            [  CHARACTER   ]
            [    TITLE     ]                    (A/B)
```

## Friends

Create a room or join one by its code, over the title's backdrop. Drawn by `view/friends-view.ts` from `online.friends` (`online/friends-screen.ts` holds the cursor logic). A link (`?room=<code>`) is the usual way in; the cells are for typing a code a friend read out.

| Element | Rect | Notes |
| --- | --- | --- |
| Heading | centred on (160, 12) | "FRIENDS", display, sun, outlined |
| Notice | centred on (160, 40) | `online.notice` ("CREATING ROOM...", "ROOMS ARE UNAVAILABLE RIGHT NOW"), text, foam, outlined, in menu mode only; 40 characters span x 41-279, above the d-pad zone and under the back link |
| Menu buttons | 120, 62, 80, 15; pitch 17 | CREATE ROOM, JOIN, BACK; fin at x 109-117 as on the title. Hidden while the cells show |
| Hint | centred on (160, 28) | UP AND DOWN CHANGE A LETTER, text, foam, outlined; wider than the safe column, so it stays above y 76 |
| Code cells | from 101, 44; 18x20, 2 px apart | six `raised` cells (x 101-219), each one display character centred; the cursor's cell `accent` with its character in sun. The menu cursor fin turned to point up 1 px above the cursor's cell (y 34-42) and turned down 1 px below it (y 65-73), not the HUD's place-change arrows; the block ends at y 73, above the d-pad zone. A cell with no character draws empty |
| Footer | 114, 159, 92, 15 | as on course select: PICK / BACK on the menu, NEXT / BACK in the cells, JOIN / BACK on the last cell |

Menu: up and down wrap, A picks, B goes back. Cells: up and down step the cursor's character through the room-code alphabet, right or A moves on (A on the last cell joins), left or B steps back, and B from the first cell returns to the menu keeping the code.

```
                    FRIENDS                  (back link)
           UP AND DOWN CHANGE A LETTER
                        ^
              [7][K][Q][2][2][2]
 (d-pad)                v                        (A/B)
                  [>> NEXT  <> BACK]
```

## Room

The room before and between races, over the title's backdrop. Drawn by `view/room-view.ts` from `OnlineState` (`online/room-screen.ts` holds the rows and cursor logic). Until the room has welcomed this peer, and once the connection has closed, only `online.notice` shows, text, foam, outlined, centred on (160, 60), so 40 characters (x 41-279) sit above the d-pad zone.

| Element | Rect | Notes |
| --- | --- | --- |
| Code | from 6, 6 | the room code, display at 2x, sun, outlined (at most 106 wide) |
| Race card | 146, 6, 98, 24 | `raised`: the course's name in foam at (150, 10), the level in sun at (150, 19). Everyone sees it; only the host can change it. Ends at x 244, clear of the back link |
| Players | 6, 32, 238, 42 | `raised`, one text row per peer in join order at y 36 + 9n: label (x 10), character's short name (x 26; `-` before their first lobby message), ping right-aligned at x 160 (`45MS`, or `-`), HOST in sun (x 168), YOU (x 196), AWAY in coral (x 216) while not ready. This peer's label and name are in sun. Ends at y 74, above the d-pad zone, and at x 244, left of the status strip |
| Rows | 120, 76, 106, 15; pitch 15 | one button per row this peer has, frames touching: Character (the pick's short name), and for the host Course (its name), Level (NORMAL or HARD) and Start (START, or RACE IN PROGRESS while the room is racing), then COPY LINK and LEAVE. Fin at x 109-117; the right edge (x 226) stays out of the A/B zone. Six rows end at y 166 |
| Hints | 232, 82, 64, 36 | `inset`, under the status strip and above the A/B zone: fire PICK, dash LEAVE, `<>` CHANGE (left and right step a value), lines 10 px apart from y 86; on touch the letters A and B in sun |
| Status | from 248, 28; x 248-313 | `online.notice` ("LINK COPIED"), text, foam, outlined, word-wrapped at 11 characters a line (`wrapLines` in `view/wrap-lines.ts`; a longer word is split), 9 px lines. A 40-character notice takes at most six lines, ending at y 80, above the hints panel and under the back link. With no notice, a peer without a Start row shows RACE IN PROGRESS here while the room is racing |

Up and down move over the rows and wrap; left and right step Character, Course and Level; A on Start (while it can start), Copy link and Leave acts; B leaves from any row.

```
 7KQ2MX (2x)           [SUNLIT SHALLOWS ]    (back link)
                       [HARD            ]
 [P1 BARON          120MS HOST           ]  LINK
 [P2 SELENE          18MS      YOU       ]  COPIED
 [P3 NIB                -           AWAY ]
 (d-pad)        >[    SELENE    ]
                 [SUNLIT SHALLOWS] [>> PICK  ]
                 [     HARD     ] [>> LEAVE ]
                 [    START     ] [<> CHANGE]
                 [  COPY LINK   ]
                 [    LEAVE     ]            (A/B)
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
| Ribbon | drops 1 px in over 10 ticks after the last row, from y 112 so it never covers the last row's outline | appears |
| How to Play pages | each page loops its own picture from the tick it opened (periods 120-360 ticks; see "How to Play") | one still frame |
| Hint glyph | the gold frame blinks every 15 ticks | steady |
| Guide arrow | bobs 3 px outward every 40 ticks | holds still, appears and disappears without fading |

- Nothing flashes more than 3 times a second.
- Positions animate from the logic tick, never from Phaser tweens, so captures repeat.
- `ui/motion.ts` owns the kit's own motion (the cursor fin). Screen slides use `slideRemaining` in `view/race-text.ts` and move labels with `Label.setOffset`; the splash timing is `splashFrame` there, the place pop `trackPlace` in `view/hud.ts`.
- Every slide starts and ends clear of the safe zones.
