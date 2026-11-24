# Rush Racers

Race three rivals to the finish across worlds that each move differently: swim a reef in Reef, run and jump through a forest in Thornwood, flap and swoop through a sunset sky in Cloudreach, drift on thrusters through an asteroid belt in Farside. Grab items, hold up to three, and fire the one you pick.

This file says how the game plays. Where the code for each part lives is in `MAP.md`; how to add a course, medium, world, item, enemy, set piece, capture stage or net message is in `COURSES.md`; screen layouts, colours and motion are in `UI.md`.

## Worlds and courses

A world (`logic/worlds/<id>.ts`, a `WorldDef`) is a medium, the names of the cast and of the shared items, pickups, enemies and hazards, and its courses. The engine draws it through a world skin (`engine/worlds/<id>.ts`). Character ids (`rudy`, `gil`, ...) are slot ids every world shares, so the save's pick, abilities, rival profiles and the balance files don't change per world: picking Gil in Reef puts the cursor on Skip in Thornwood. Item ids and balance are shared too; only names and art change.

A course (`logic/courses/<id>.ts`) is data: its level, its world, a theme and a song set (three race tracks, "Look and sound"), whether course select lists it, its par time and any tuning. A theme (`engine/themes/<id>.ts`) is how a course looks. This table is the course list; course select shows the listed ones top to bottom in this order (the order of `COURSES` in `logic/courses/index.ts`).

| World | Medium | Theme | Song set | Course (`?course=` id) |
| --- | --- | --- | --- | --- |
| Reef | swim | `ocean` | `race` | Sunlit Shallows (`sunlit-shallows`) |
| Thornwood | run | `forest` | `thornwood` | Bramble Run (`bramble-run`) |
| Cloudreach | flight | `sky` | `cloudreach` | Thunderhead Pass (`thunderhead-pass`) |
| Farside | drift | `space` | `farside` | Slingshot Alley (`slingshot-alley`) |
| Thornwood | run | `forest` | `thornwood` | Run Test (`run-test`), unlisted |
| Cloudreach | flight | `sky` | `cloudreach` | Sky Test (`sky-test`), unlisted |
| Farside | drift | `space` | `farside` | Drift Test (`drift-test`), unlisted |

An unlisted course is reached only by `?course=` and tests: it never gets a best, never shows NEW BEST and is never the save's last course. Each test course holds its medium's mechanics scenarios, so they never depend on the listed course's layout. A course's file documents its layout column by column and says where its par and any catch-up override came from.

- **Sunlit Shallows**: six sections, the reef, a current highway, a jelly field, a surface stretch open to the sky where you breach for floating clams, an urchin gauntlet, then a coral gate and a dark cave of stalactites and eels to the finish.
- **Bramble Run**: the forest floor (pits, mud, crates), a treetop high route over a slower floor path, and a dark root cave with snakes. Every enemy kind and cell the run medium supports appears on it.
- **Thunderhead Pass**: a cloud bank, a ring line on a high road over a sheltered low road, and a storm cell of lightning zones with a puff-cloud shortcut. Every cell, enemy and set piece flight supports appears on it.
- **Slingshot Alley**: an asteroid belt with planets to swing round, an ice gate, a dust field and solar wind lane, a dark corridor in a moon's shadow, and a late lane between two black holes that saves time for whoever dares it.

## Core loop

Pick a course, pick a racer, then a 3-2-1 countdown and the race. In Reef, swim with momentum, dash for bursts of speed, ride currents and avoid kelp drag; in Thornwood, run and jump, stomp enemies, hit crates from below and don't fall in the pits; in Cloudreach, flap to stay up, glide, dive for speed, and don't fall out of the sky; in Farside, burn up to speed, coast, swing round planets and stay out of the black holes. Everywhere, fire items. Finish ahead of three rivals drawn from the rest of the cast. Results show place and time; the best finish on each course and level is saved.

## Controls

| Action                     | Keyboard          | Touch |
| -------------------------- | ----------------- | ----- |
| swim (Reef); run (Thornwood); thrust (Farside) | Arrow keys, WASD  | d-pad |
| jump (Thornwood), held for a higher jump | Up, W | d-pad up |
| flap (Cloudreach) on a fresh press; held after it, glide | Up, W | d-pad up |
| dive (Cloudreach), held | Down, S | d-pad down |
| fire the selected item, confirm | Space, Z, Enter | A |
| menu up/down               | Up/Down, W/S      | d-pad |
| dash, back                 | X, Shift          | B     |
| previous item              | Q                 |       |
| next item                  | E, Tab            | `⇄`   |

Fire uses the item in the selected slot, the one framed in gold on the HUD, and spends one of its charges. Q and E (or Tab, or `⇄` on touch) move the frame to the previous or next held item; pressing next and fire on one tick fires the item it moved to. The dash (the logic's kick) runs off a meter of two charges, the pips beside the item well: a dash spends one, and each comes back 1.5 s later (`powerups/dash-meter.ts`), so a dash is saved for a gap, a latch or a squid rather than pressed all race. Rivals use the same meter. Whether a dash dodges a squid, shakes a latch or fights an Undertow is the medium's `kickRules` (on foot in Thornwood it does none of these).

On course select up and down move the cursor, fire picks the course and dash goes back to the title. On the select screen the arrows move around the grid, fire races as the highlighted character, and dash goes back (to course select when it is shown, else the title). On How to Play, fire or right turns to the next page and dash or left to the previous one; only dash on the first page and fire on the last page return to the title.

## Rules worth knowing

- Tick order and determinism rules are in the header of `src/logic/world.ts`.
- A race must compute the same on every JavaScript engine, because online play runs it in each player's browser from inputs alone. `hashWorld` (`src/logic/hash.ts`) reduces a world's state to one 32-bit number; it is pinned for the top route in `src/logic/top-route.test.ts`, and smoke asserts one number on Chromium, the phone project and WebKit. Logic may not use `**`, and may call only the exactly specified `Math` members on the allowlist in `tools/biome/no-inexact-math.grit` (such as `floor`, `sqrt` and `imul`); `src/logic/num.ts` has exact replacements for the rest.
- The race ends when you finish, 10 s after the third rival finishes (you get TIME UP), or at the race limit (`RACE_LIMIT_TICKS`, 5 minutes).
- Rivals steer by a distance-to-finish field (`race/flowfield.ts`); placing uses a separate uniform-cost field so places don't flicker.
- Rivals race at par with you (each character's rival profile in `logic/characters.ts`), so holding forward keeps you in the race and dashes, items and pearls decide it. They fire items often (`itemAggression`, `ai/items.ts`), aim attacks at any racer ahead of them, and flash a lantern only at a racer just ahead; a leader with a Mimic drops it on a chaser. Catch-up scales a rival's force by its gap to the leading human, within each level's `rivalCatchUp` bounds in `DIFFICULTY` (`logic/difficulty-level.ts`), which a course may override with `catchUp`. Rivals steer around urchins and jellies they can see coming (`ai/avoid.ts`). Rival Baron plans through coral on a cheap `ram` flow field, since he breaks it by swimming into it. In a dark zone a rival that can't see wobbles more and replans less often.
- Each difficulty level is a row of knobs in `DIFFICULTY` (`logic/difficulty-level.ts`, which says what each level changes). The bars every listed course must pass, and the numbers they were measured at, are in `logic/balance/` (`hard-bars.ts`, `normal-bars.ts`, `easy-bars.ts`, `rival-items.ts`); COURSES.md "Difficulty bars" says how to run them.
- Easy way-finding (`logic/guide.ts`, knobs in `DIFFICULTY[level].guide`, off on Normal and Hard): `guideFor(world, racer)` gives the neighbour tile that lowers the steer field most (the way on) and `world.guide.stuckTicks`, the ticks the player has pushed without reaching a tile closer to the finish. Once the player has pushed for a moment without progress while nearly at rest, the steering assist adds the part of the rivals' steer aim that is sideways to the stick for a while, a slide along the wall toward the way on. It never adds speed, is skipped for a stick held far away from the way on, and never touches rivals or bots. The guide arrow (Scenes, Hints) shows after 1.5 s stuck. `balance/easy-guide.test.ts` keeps the effect from regressing.
- Slots and humans: a race has four fixed slots (`player`, `tess`, `squib`, `bo`), and `world.humans` lists the ones a person started in (`['player']` unless `createWorld({ humans })` says otherwise). `stepRace(world, inputs, dt)` drives each human slot from its own entry; `stepWorld` is `stepRace` with `{ player: input }` and refuses a world whose `humans` is not `['player']`. A human slot with no entry on a tick is taken over by the AI for the rest of the race (`racer.takeover`): it races with its character's rival profile and attacks like a rival, but keeps a human's status lengths, clam roll and protection. Rules about the player apply to every human slot (`isHuman`, `isRival` in `logic/racers.ts`); rivals measure catch-up against the leading unfinished human (`race/catch-up.ts`), and every human slot, taken over or not, gets the human catch-up push (`playerCatchUpMul`, `modifiers.ts`) while it trails. With several humans the race ends once no active human is left racing; once every rival is home and at most one active human is still racing, that human gets `DNF_GRACE_TICKS` before the race ends without them (`race/standings.ts`). Easy is single-player in slot 1. The screen follows one slot, the local racer (`engine/local-racer.ts`, `Runtime.localRacer`): camera, HUD, hints, sounds, effects and results are about it.

## Roster

You race as one of eight characters; the race fills the three rival slots with three of the other seven, drawn by seed from the `roster` random stream (`assignCharacters` in `logic/characters.ts`). Characters are data in fixed slots, so tick order, random streams and tie-breaks never depend on who is picked. Abilities live in `logic/abilities.ts` (numbers in `ABILITY`), called from hooks in the systems they change. Each character has its own rival profile in `logic/characters.ts` and its own art in each world's skin. The roster is fixed at eight; COURSES.md "A ninth character" says why.

Reef's cast:

| Character | Look | Ability |
| --- | --- | --- |
| Rudy | red snapper in a brass diving helmet | Shake it off: stuns and bubble traps last 40% as long |
| Gil | lanky green seahorse | Spring kick: kicks aimed steeply upward push 1.8x as hard |
| Streak | electric-blue sailfish | Wind-up: up to +10% swim force after 3 s swimming straight; a hard turn, stop or hit resets it |
| Onyx | black barracuda with a scarred fin | Ambush: bumping a racer from behind (within 45° of its heading) takes 12% of its speed |
| Nib | cleaner shrimp in goggles | Deep pockets: holds 4 power-ups instead of 3 |
| Baron Barnacle | huge spider crab with a crusted crown | Bulldozer: breaks coral by ramming, bumps with 2x mass, ramps from 0.4 to full force over 1 s after the start or a hit |
| Selene | moon jellyfish with a starlight glow | Moonlight: sees through dark zones, immune to jelly stings |
| Rook | hammerhead shark | Frenzy: +25% swim force for 1.5 s when a racer within 5 tiles is hit |

Dark zones (`Level.dark`) draw a veil (`view/dark-view.ts`) with a light pool around each racer: yours leans ahead as you move, a Glow Lantern widens it, and urchins and jellies show a faint glint so you can see them coming. Racers who see in the dark (`racerSeesInDark`) get only a light tint. On Easy the player carries a Glow Lantern's light without holding one (`DIFFICULTY.easy.playerLantern`). Sizes are in `UI.md` "Race HUD", Darkness.

## Reef: the swim medium

`logic/media/swim/`, numbers in its `tuning.ts`. Swim with momentum toward the stick; currents push, kelp drags, coral is solid until broken. A course may open stretches of the sea to the sky with a surface (`LevelDef.surface`, `level/surface.ts`): a racer swimming up through it fast enough breaches, arcs under gravity with little steering (a dash or Jet Fins still push), and splashes back in (`racer.breached`, `racer.splashed`). Enemies, loose power-ups and drifting pearls stay in the water.

## Thornwood: the run medium

A forest raced on foot. The cast, slot by slot, each with its slot's ability (the wording is Thornwood's; only Skip's works differently):

| Slot | Thornwood | Look | Ability |
| --- | --- | --- | --- |
| rudy | Grit | badger in a miner's lamp helmet | Shake it off |
| gil | Skip | lanky hare | Spring jump: jumps 1.12x as fast off the ground (`jumpMulFor` in `abilities.ts`), so higher |
| streak | Blaze | red fox | Wind-up |
| onyx | Shade | black panther cub | Ambush |
| nib | Cheeks | chipmunk in goggles | Deep pockets |
| baron | Duke Mossback | huge tortoise with a mossy crown | Bulldozer: breaks cracked stone by ramming |
| selene | Dusk | little owl in a scarf | Night eyes: sees in the root cave, immune to wasp stings |
| rook | Fang | grey wolf | Frenzy |

Thornwood's names: clam = `?` crate, pearl = acorn, urchin = thorn bush, jelly = wasp, shark = boar, eel = snake, crab = beetle. Items: Jet Fins = Rocket Boots, Bubble Shield = Sap Shield, Puffer = Burr Ball, Ink Sac = Mud Pie, Glow Lantern = Firefly Jar, Cannonball = Boulder, Homing Squid = Homing Bee, Riptide = Tailwind, Undertow = Snare Vine, Mimic = Copycat. Cells: open water = air, rock = earth, coral = cracked stone, kelp = mud, left and right currents = wind gusts, up and down currents = updraft and downdraft, and `=` is a branch (a ledge).

`logic/media/run/`, numbers in its `tuning.ts`:

- Left and right run. Up jumps from the ground on a fresh press; holding it jumps higher, and letting go early cuts the jump short. A press just before landing still jumps on landing, and so does one just after running off an edge. There is no wall jump and no dropping through a branch.
- Dash is the same button and meter as in Reef: a horizontal burst along facing that never changes vertical speed, usable once in the air until you land. A jump never spends a dash charge. While you keep steering the same way, a dash's speed over running pace glides back slowly (`dashDrag`); mud, a gust that drops, a hit or letting go of the stick slow you at full friction, and a wall stops you dead.
- Landing on an enemy from above stomps it (`enemy.bonked` with `how: 'stomp'`) and bounces you up; meeting it from the side or from below is a hit, unless you're dashing, as in Reef.
- A shut `?` crate is solid: you stand on it, and jumping into it from below opens it for you. A full inventory leaves it shut.
- A branch (`=`) holds you from above and lets you jump up through it from below.
- Pits are open at the bottom. Falling out of the level (`racer.fell`) takes you out for 1 s, then you come back on the last solid ground you stood on with both feet (never a crate), backed off from the edge you fell from as far as the ground allows, with 1 s of invulnerability (`racer.respawned`). The lost time is the penalty.
- Wind gusts push you along, updrafts and downdrafts push you up and down, and mud slows your running.
- A run level can't have a sea surface: open ground is already air on foot, so `validateLevel` rejects any `air` tile.
- Racers push each other sideways only: landing on another racer passes through it, while side bumps, Shade's ambush and Duke's bump mass still work.
- Rivals plan on a jump-link graph (`links.ts`, `nav.ts`): walks, drops and jumps between stand tiles, solved for the least time to the finish, so they take a high route when it is quicker. Breaking coral re-traces only the stand tiles near it. In the air a rival checks where it would come down at its speed and steers back when that spot is a pit or a wall. A runner closing on a slower one just ahead on flat ground hops over it. A loose rival sometimes lets go of the stick on flat ground, which is how loose steering costs time on foot. The Easy steering assist only adds sideways input, so it never jumps for you; the guide arrow points up at a jump.

## Cloudreach: the flight medium

A sunset sky. The cast, slot by slot, each with its slot's ability:

| Slot | Cloudreach | Look | Ability |
| --- | --- | --- | --- |
| rudy | Bumper | puffin in aviator goggles | Shake it off |
| gil | Zip | hummingbird | Spring flap: a flap lifts 1.12x as fast (`jumpMulFor`); no spring kick in flight |
| streak | Dart | swift | Wind-up |
| onyx | Nox | bat | Ambush |
| nib | Pip | flying squirrel with a satchel | Deep pockets |
| baron | Admiral Pouch | heavy pelican | Bulldozer: pops puff clouds by ramming |
| selene | Luna | moth | Storm sight: sees in storms, immune to static wisps |
| rook | Talon | hawk | Frenzy |

Cloudreach's names: clam = `?` balloon, pearl = feather, urchin = spark cloud, jelly = static wisp, shark = Storm Crow, eel = Sky Eel, crab = Cloud Crab. Items: Jet Fins = Jet Pack, Bubble Shield = Cloud Shield, Puffer = Puffball, Ink Sac = Smoke Bomb, Glow Lantern = Star Lamp, Cannonball = Meteor, Homing Squid = Homing Gull, Riptide = Jet Stream, Undertow = Headwind, Mimic = Mirage. Cells: open water = sky, rock = thunderhead, coral = puff cloud, kelp = fog bank, left and right currents = wind gusts, up and down currents = updraft and downdraft, plus the bounce cloud (`B`) and the boost ring (`@`).

`logic/media/flight/`, numbers in its `tuning.ts`:

- Gravity always pulls. A fresh press of Up flaps, at most once every few ticks, as often as you like. Up held after a flap glides, capping the fall. Down held dives, and part of the dive's speed carries forward when you let go. Left and right fly with momentum toward a cruise speed; there is no stopping on a dime. A flap never spends a dash charge. A racer's force multiplier (the rivals' difficulty speed and catch-up, a speed boost) reaches flight at half strength (`media/flight/cruise.ts`), in acceleration, cruise, the dash and a dive's carry alike, and never in a gust's drift.
- The dash is a horizontal burst, scaled by that force share, on the same button and meter as everywhere. For its first ticks it pops any puff cloud it touches, from any side; a dive alone never pops one. As in Reef a dash dodges a Homing Gull, shakes a latch and fights a Headwind.
- Thunderheads are solid. Fog banks cut cruise, wind gusts push you sideways, updrafts and downdrafts push you up and down, and spark clouds hurt like urchins.
- Falling out of the bottom of the sky (`racer.fell`) takes you out for 1 s, then you come back (`racer.respawned`) at the last safe spot: where you last had thunderhead (never puff cloud, which can break) under you and for 2 columns either side, so a flyer who does nothing there falls onto cloud. You get 1 s of invulnerability; the lost time is the penalty.
- Flyers bump each other, balloons open on touch, trapped racers and loose power-ups sink slowly, and there are no ledges or stomps.
- Easy flies every racer under lighter gravity with stronger flaps (`FLIGHT_TUNING.byDifficulty`). The Easy steering assist only slides the horizontal stick, so it never flaps or ends a glide for you, and the guide arrow points up or down at the way on.
- Rivals fly a flow field that prices low sky over open gaps dear, so their way climbs clear of a fall; they carry speed through their waypoints, flap on rhythm to hold altitude, pass slower flyers, wait out a lightning strike, take a bounce cloud only when it saves time over flapping, and head for a ring only when it is close, on their way, reachable, in clear sight and their wobble roll lets them (`media/flight/ring-line.ts`).

### Sky set pieces

Course features any medium could carry, used by Cloudreach's courses (format in `level/parse.ts`):

- **Bounce cloud** (`B`): solid like thunderhead, and a flyer coming down onto it is sprung back up at twice a flap (`racer.bounced`, `race/bounce.ts`). Only a medium with `effects.bounceSpeed` allows one.
- **Boost ring** (`@`, `Level.rings`): each racer is boosted once per ring per race (`ring.passed`), its speed and cruise raised for a moment (`pickups/rings.ts`). Lines of rings read like coin trails.
- **Lightning** (`LevelDef.lightning`, `hazards/lightning.ts`): a column range with a period and an offset. Each period ends with a warning (`lightning.warned`) and a strike (`lightning.struck`) that stuns any racer in the zone like a flash (cause `lightning`); invulnerable, fallen and finished racers are skipped. It runs only while racing, as a pure function of the race tick.

## Farside: the drift medium

Space, flown on thrusters. The cast, slot by slot, each with its slot's ability (the wording is Farside's; only Zib's works differently):

| Slot | Farside | Look | Ability |
| --- | --- | --- | --- |
| rudy | Bolt | boxy red robot with a glass dome and a yellow visor | Shake it off |
| gil | Zib | small green alien, one big eye, long thin legs | Spring burn: a dash aimed steeply up or down is 1.8x as strong on that axis (`springKick` in `abilities.ts`) |
| streak | Flare | round blue alien trailing a comet tail | Wind-up |
| onyx | Umbra | flat charcoal stealth drone with a teal sheen and an amber eye | Ambush |
| nib | Widget | tiny lilac alien in mint goggles with a jet backpack | Deep pockets |
| baron | Admiral Crater | huge cratered moon-rock golem with a crown of antennae | Bulldozer: breaks ice by ramming |
| selene | Nova | five-pointed yellow star with a small face | Starlight: sees in a moon's shadow, immune to plasma orbs |
| rook | Krag | hunched grey raider with back spikes and a red visor | Frenzy |

Farside's names: clam = supply pod, pearl = stardust, urchin = space mine, jelly = plasma orb, shark = Rocket Ray, eel = Moon Worm, crab = Moon Mite. Items: Jet Fins = Ion Thrusters, Bubble Shield = Force Field, Puffer = Shock Bubble, Ink Sac = Gas Bomb, Glow Lantern = Star Flare, Cannonball = Comet, Homing Squid = Homing Probe, Riptide = Ion Stream, Undertow = Tractor Beam, Mimic = Hologram. Cells: rock is asteroid rock, coral is ice, kelp is nebula dust, currents are solar wind.

`logic/media/drift/`, numbers in its `tuning.ts`:

- There is no up or down and almost no friction. Holding a direction burns the thrusters that way up to a cruise speed; letting go leaves you coasting at nearly the speed you had (thin dust and a small idle brake, larger on Easy). To stop or turn you burn against your motion. A burn can turn or slow a racer above cruise but never adds speed past it.
- Dash is the same button and meter as in Reef: a burst along the stick on both axes, along facing with the stick idle. Speed over cruise bleeds off at `overDrag`, so a dash lasts a second or two.
- Walls bounce: hitting rock returns half the speed into it (`racer.rebounded` for a hard enough impact). The level is walled all round and has no pits.
- Supply pods open on touch, enemies can't be stomped (a dash bonks them, as in Reef), nebula dust cuts cruise and drags, and solar wind pushes along its arrow and can carry you past cruise.
- Gravity wells (`LevelDef.wells`, `level/wells.ts`) are planets and black holes. Each pulls every racer inside its reach toward its centre, strongest at the centre and fading to nothing at the reach (`pull * (1 - d / reach)`), and like wind it can carry a racer past cruise, which is the slingshot: a pass round a planet on the inside of a turn bends your path for free. Easy weakens every pull. A trapped racer feels no pull.
- A black hole is a well with a `horizon`. A racer whose centre crosses it is swallowed (`racer.fell`), is out for 1 s, and comes back at rest on the last spot where it was outside every hole's reach, with 1 s of invulnerability (`racer.respawned`). No shield, Comet or item dash saves it.
- Only a medium with `effects.gravityWells` may race a level that has wells; `createWorld` throws `LevelError` for them elsewhere, and for a start inside a black hole's reach.
- Rivals steer by velocity (`pilot.ts`, `thrust-plan.ts`): they aim down the distance field, look ahead far enough to brake for a corner, and burn only against the part of a well's pull that carries them off their line, so they ride a planet's pull round a turn. Their distance field charges extra for tiles inside a hole's reach, more the deeper, and never enters a horizon (`nav.ts`).

## Enemies

Course creatures you beat with a dash bonk, or in Thornwood also by landing on them (`logic/hazards/enemies/`, numbers in its `tuning.ts`). Below are Reef's names; every world's behave the same. Touching an enemy just after a dash, or while boosting, cannonballing or inflated, bonks it; touching it otherwise is a hit. Beaten enemies stay gone and burst into loose pearls. Glyphs: `S` shark, `E` eel, `K` crab.

| Enemy | Does | Beat it |
| --- | --- | --- |
| Shark | patrols its lane; sees a racer ahead, winds up (flash and `!`), charges, then rests. Sight, patrol, rest and whether it turns mid-charge are per level (`DIFFICULTY[level].shark`): Easy's sees less, rests longer and charges straight | two bonks (each staggers it), or one Homing Squid; bursts 5 pearls |
| Eel | hides in a wall hole; eyes and bubbles warn, then it lunges 2 tiles out and back on a cycle. Each eel starts at a point in its cycle set by its tile (`startEel`), so neighbours lunge out of step | one bonk while it is out; 2 pearls |
| Crab | walks the floor, turning at walls and drops | one bonk; 1 pearl |

On Easy a shark never winds up on the player. Rivals steer around enemies, keep out of a winding-up or charging shark's path, and dash into a crab, an out eel or a charging shark about to reach them when they have a charge.

## Power-ups

Clams (`?` in the course) open on touch, roll an item weighted by place (leaders get defensive kinds, Glow Lantern and Mimic; trailers get speed and the attack kinds; Undertow only rolls in 3rd or 4th, Cannonball mostly there) and stay shut for 1.5 s. You have three item slots (Nib four), never two of a kind. An item picked up goes into the first empty slot with its charges, and items never slide between slots. With every slot full you don't open a clam: it stays ready for the next racer that touches it, and you don't grab loose items either. Fire uses only the selected item and spends one charge, then item use cools down briefly. An item's last charge empties its slot and the selection moves to the next held slot to the right (wrapping). There are no combos: each item does one thing.

An item's passive works only while its slot is selected, except that a Bubble Shield in any slot absorbs a hit.

| Item | Charges | Passive (selected) | Fire |
| --- | --- | --- | --- |
| Jet Fins | 3 | +15% speed, faster kick | a short boost along your input |
| Bubble Shield | 1 | absorbs one hit from any slot | fires a bubble that traps a rival |
| Puffer | 2 | doubles bump push | inflate for 1 s: break coral, hit racers, urchin-proof (never shortens a longer inflation) |
| Ink Sac | 3 | | one ink cloud that slows racers behind |
| Glow Lantern | 2 | pulls in nearby pearls, lights the dark | flash that stuns nearby racers and jellies |
| Cannonball | 1 | | in Reef, a long fast dash, inflated and invulnerable the whole way: smashes coral gates and hits racers it touches; every other world fires its own shot instead ("World shots and course set pieces" below) |
| Homing Squid | 1 (3 in 3rd or 4th) | | a squid that locks the nearest racer ahead within range and chases it; on contact it wraps them (slower swimming for a while; in Reef three kicks shake it off, on foot the latch runs its time). Where the medium allows (`kickRules.dodgesSquid`), a kick just before it arrives dodges it, and it never chases that racer again; on foot a Sap Shield or invulnerability is what stops it. It loses its lock in ink and passes harmlessly through an invulnerable racer |
| Riptide | 2 | every current pushes you 1.5x harder | lays an 8-tile current lane along your aim (snapped to the main axis) that pushes anyone in it for 3 s |
| Undertow | 1 | | pulls every racer ahead of you back for 1.5 s, harder the bigger their lead; where `kickRules.countersUndertow` allows, their kicks fight it |
| Mimic | 1 | squids lock on you only from half the usual range | a see-through copy of you races on along the course for 5 s; a squid that picks it pops it instead of you |

Charges are `CHARGES` (`powerups/charges.ts`); the rest of the numbers are in `powerups/tuning.ts`. Jet Fins and Cannonball do nothing while a dash is already running (no charge is spent). A hit ends a Jet Fins boost; nothing ends a Cannonball early.

A hit (urchin `*`, jelly `j`, bubble, puffer, flash) pops a Bubble Shield from any slot if you hold one, else knocks the selected item and all its charges off as a loose pickup anyone with room can grab after half a second; it floats up in water and sinks on land, stopping at the first solid tile, crate or (from above) ledge. With nothing held you're stunned. The selection then moves on as for a used-up item. Every hit gives a second of invulnerability. A stunned, trapped or latched racer doesn't collide with other racers: you pass straight through it and take the place, and the pair keeps passing through until it separates (`race/separate.ts`, `hazards/contacts.ts`). A stunned or trapped racer can still move the selection, but can't fire, dash or move. Pearls (`o`) work like coins: each adds 1% to your force, up to 10, and gives a short boost; the HUD counts them and a chime plays. A hit that lands (not one a shield absorbs) knocks up to three loose behind you; anyone can grab them at once, you after half a second, and they fade after 10 s (`pickups/pearls.ts`). Rivals fire one slot at a time (`ai/items.ts`): a Puffer or Cannonball first when coral is just ahead, else the first held slot whose kind has a use.

## World shots and course set pieces

Each world outside Reef fires its own Cannonball shot (`WorldDef.cannonball`, `logic/powerups/cannonball/<style>.ts`, live in `World.shots`, events `shot.launched`, `shot.warned`, `shot.ended`), and each listed course has one set piece of its own (`LevelDef.vents`, `.shiftingWind`, `.asteroids`, `logic/setpieces/`). They are drawn as theme extra layers (`engine/view/*-view.ts`), and each shot lands with its world's sound (`engine/audio/setpiece-cues.ts`). On Easy a rival's shot never targets or hits a human.

- Sunlit Shallows' set piece is geyser vents: each is a fissure in the floor that rumbles for 45 ticks (`vent.warned`, the fissure glows) and then erupts for 60 (`vent.erupted`), pushing any racer whose centre is in its two-tile column, from the vent up to its `height` above, upward at 480 px/s². That throws an idle swimmer through the surface, and in the air it just beats gravity. Finished, fallen and trapped racers are skipped. One sits under the jelly room's last high jellies (column 332) and three under the surface section (388, 402, 436), which erupt in turn; riding one up gives a long breach. Reef keeps the Cannonball dash.
- Thornwood's Boulder rolls along the ground ahead of the thrower for up to 4 s, drops into pits, breaks cracked stone and hits the first rival it reaches; it ends on a wall it rolls into. Bramble Run's set piece is spring mushrooms (`B`): landing on one launches a runner about 5 tiles up, about 6 with jump held (`media/run/spring.ts`). They sit at the lips of two pits and on a stump under the branch path, where only a held launch gets back up to the treetops, and rivals' nav takes them when they are quicker.
- Cloudreach's Meteor marks the best-placed racer you may attack with a shadow for 1 s, follows where they are heading (leading them by the fall time from each column they could reach), locks for the last quarter second, then falls from the open sky above and hits anyone within 1.5 tiles except you. Thunderhead Pass's set piece is a shifting wind zone over both roads mid-way (cols 250-289) that turns its gust round every 3 s, with a windsock that swings through a 1 s warning (`wind.warned`, `wind.shifted`; no turn is announced at GO). Flyers feel it as a gust either way, and never respawn inside it.
- Farside's Comet flies along the aim and every gravity well bends it (twice the wells' raw pull). It breaks ice, ends in a black hole's horizon, against rock or after 3 s, and hits the first other racer it touches, passing through one that is invulnerable. A Meteor kicks up dust where it lands and a Comet ends in a burst of sparks. In a world with its own Cannonball the item never dashes, so it fires even during a Jet Fins dash. Slingshot Alley's set piece is five drifting asteroids that glide across the opening straight and the dust field's lanes on timers, out of step; one that touches a racer hits it (no owner). Rivals slow or stop to let one pass.

Two more items are reworked per world (`WorldDef.itemTwists`, `logic/powerups/twists/<style>.ts`, live in `World.twists`, events `twist.launched`, `twist.landed`, `twist.ended`), each acting through its medium's own environment:

- In Thornwood the Ink Sac is the Mud Pie: lobbed forward in an arc (carrying the thrower's speed), it splats where it lands into a 3-tile mud patch that slows every runner but its thrower to mud speed for 5 s, then shrinks away. On Easy a rival's mud never slows the player. Rivals throw it at a runner on the ground 3-6 tiles ahead.
- In Cloudreach the Undertow is the Headwind: a gust front 6 tiles wide sweeps forward from the user at 180 px/s for 30 tiles. Every flyer it passes over (not the user, and never a human from an Easy rival) flies into a strong headwind for about a second and loses about 3 tiles; updrafts still lift, and a Jet Stream lane overrides it. Rivals fire it from 3rd or 4th at a racer 8-16 tiles ahead, the most the front can catch.
- In Farside the Gas Bomb is a gravity bomb: it drops one tile behind you and for 4 s pulls every other racer within 5 tiles toward it like a small planet, at 1.5x Slingshot Alley's planets (never you; on Easy a rival's bomb never pulls you). Rivals drop one when someone is within 4 tiles behind them, and don't steer around bombs.

## Scenes and launch parameters

- `boot`: builds the global art (`engine/art/index.ts`) and the UI kit, waits for the world and theme art of the session's course and the menu course (they differ with `?course=`), then routes. Any other world's and theme's art loads the first time a screen draws it (course select's pick, results, a race); Friends and a `?room=` link load every world's before anyone joins or creates a room, since a guest races whatever the host picks. Ticks wait meanwhile (`idle()` is false). A chunk that fails to load is reported as an `art` game error and shows "Couldn't load the course art. Reload the page to try again.", leaving the player on the screen they were on; the next pick (on boot, any press) tries again. `debugSummary` carries `textures` (Phaser texture keys) and `art` (world and theme ids loaded).
- `title`: the logo over the racing cast and the backdrop of the last listed course raced (`DEFAULT_COURSE` until then), then six buttons: Race, Friends (online races, below), How to play, Level (EASY, NORMAL or HARD with 1-3 pips, cycling on each press and saved; a fresh save starts on Easy and every race is built on the saved level), Sound (mute) and Motion (reduced motion); PRESS A on touch screens only; a line above the logo saying why online play ended, when it ended with a notice (it clears on any press there or on opening Friends); and your best time and place on the current course at the selected level beside the buttons when it has one. Settings save at once and apply for the session even if the save fails; a fresh save follows the OS reduced-motion preference.
- `howToPlay`: seven picture pages with a heading, page dots and a NEXT / BACK footer; each page turn emits `howToPlay.page` (1-based) and plays the menu-move sound. The pages draw the real sprites of the current course's world, animated unless reduced motion is on, the player's saved racer, and key caps on a keyboard or the round A and B buttons on touch. Page 1 teaches the course's medium: SWIM AND DASH in Reef, RUN AND JUMP in Thornwood, FLAP AND SWOOP in Cloudreach, THRUST AND DRIFT in Farside. Thornwood also has its own pages 2, 5 and 7 (crates from below, stomping, and a shield stopping a bee, since a dash on foot dodges nothing); every other page is shared (`MEDIUM_PAGES` in `engine/view/how-to-play/index.ts`). Headings and captions use the world's names. Paging is in `engine/screens/how-to-play.ts`; what each page shows is `UI.md` "How to Play".
- `course`: course select, one row per listed course with its name and your best there on the level in force; the cursor starts on the current course, fire picks it and goes to `select`, dash goes back, and like menus it ignores fire for its first 20 ticks. It is skipped while only one course is listed, and when the course in force is an unlisted one from `?course=`: Title Race then goes straight to `select` and the race keeps that course. Layout in `UI.md` "Course select".
- `select`: the eight characters of the picked course's world in a 4x2 grid and a card with the highlighted character's full name, ability and what it does. The cursor starts on your last pick. Fire saves the pick and races; dash goes back. Like menus, it ignores fire for its first 20 ticks. Under the card the highlighted racer moves in place, and a footer shows the controls. Layout in `UI.md` "Select".
- `race`: 3-2-1-GO countdown with the level you are racing on under the numeral (`debugSummary().levelBanner`), beside an intro card naming the course with its world and a tagline (`view/course-intro.ts`), then the race, with FINAL STRETCH and FINISH splashes, or TIME UP if you run out of time. The HUD shows your place and portrait, the timer, a progress strip with each racer's head, and a well with the dash meter and one slot per inventory place (`UI.md` "Race HUD"). The camera follows you with a deadzone and lookahead; in the sky it can scroll up past the ceiling by the HUD's height so the HUD covers sky rather than you (`hudOverSky` on the theme). Each listed course names its zones (`Course.sections`); the first time the local racer reaches a later zone, its name slides in under the place panel for 2 s (`view/section-callout.ts`). 90 ticks after the race ends you go to results.
- Hints for young players (`view/hints.ts`): on the first race of a save and on every Easy race, PRESS [fire]! when an item first lands, [dash] DASH! when a locked-on squid is about to reach the player and a dash would dodge it (`dodgeTicks(world)`, wider on easier levels; only where `kickRules.dodgesSquid`), SWAP! the first time the player holds two items, and a pulsing fire glyph by the HUD once items sit unused. On Easy the guide arrow (`view/guide-view.ts`) points the way on once the player has been stuck 1.5 s. One hint shows at a time; rank, timing and look are `UI.md` "Hints". On touch screens the A button also shows the selected item's icon (`view/fire-button.ts`). `debugSummary()` reports `difficulty` (the setting), `raceDifficulty` (what the race was built on) and `hints` during a race (`hints.guide` is the arrow's tile offset, or null).
- Attack warnings: a squid locked on you shows an edge arrow, a LOCKED ON! caption and a rising ping; a latched squid shows DASH! beside you (PRESS B on touch) where dashes shake it (`kickRules.shakesLatch`). Details in `UI.md`.
- `results`: a podium with medals for the top three, standings with names and times revealed row by row (TIME UP if not finished), a NEW BEST (for this course and level) or BEST NOT SAVED readout, then three buttons (Race again, Character, Title), over the course's own backdrop. While course select is shown, the course's name sits top left.
- Menus ignore fire for their first 20 ticks, so a fire still being pressed from the race can't skip the results.
- Title Race goes to `course` (or `select` while one course is listed or an unlisted course is in force). Results' Race again races the same course and character without either select screen (a course picked on course select counts only once select races it: backing out keeps the course in force before them), while results' Character opens `course` (or `select`, on the same terms) with the cursor on the current pick. B on those screens goes back to results with Character selected when they were opened from results, and to the title when opened from Title.
- `?scene=race` (or `?scene=play`) skips the title and races as the saved pick (Rudy on a fresh save). `?seed=7` changes rival behaviour and which characters you race. Each race is seeded with `seed + races in the save`, so a rematch plays differently while a test run still repeats exactly.
- `?course=<id>` races that course, listed or not (`debugSummary().course` and `.medium` say which; ids in "Worlds and courses"). A listed one is where the course select cursor starts; an unlisted one skips course select and keeps its course. An unknown id logs one warning naming it and races the default (`DEFAULT_COURSE`). Without it the session races the save's last listed course, else the default.
- `?track=<n>` pins every race to track `n` (1 to 3) of its course's set; a number past the set wraps round it, and anything that is not a positive whole number is warned about once and ignored. `debugSummary().track` names the race's track during race and results.
- `?scene=jukebox` opens the sound test, which no menu leads to: every song by title under its set, with its key, tempo, meter and loop length. Up and down move, fire plays the highlighted song, left and right restart it at the previous or next section, dash stops it and, with nothing playing, goes to the title. `debugSummary().jukebox` is `{ selected, playing, section, tracks }`.
- `?debug=1` draws hitboxes from logic state and shows the tick and your tile.
- `?stage=<name>` (needs `?debug=1`, or the test harness) stages a moment before the race's first frame, so its view can be reviewed without waiting for a roll; the names (`STAGES`) and what each sets up are in the header of `engine/capture-stages.ts`. A staged race never saves a result. Without the gate the parameter is ignored; with it, an unknown name logs one warning listing the valid ones.
- `?local=<slot>` (needs `?debug=1`, even in the test harness) races with `<slot>` as the only human: the keyboard drives it, the screen follows it, and the AI races slot 1. `debugSummary()` then describes that racer and adds `local: '<slot>'` (also for `?local=player`), and a `?stage=` is set up around it. An unknown slot logs one warning naming it and races as slot 1, saved as usual. On an Easy save a slot other than `player` races on Normal, with one warning. A `?local=` race never saves a result or shows NEW BEST (`src/engine/runtime.test.ts`, `tests/local-racer.spec.ts`).
- `?room=<code>` joins that room straight from boot (letters are read case-insensitively). A value that is not a six-character room code logs one warning naming it and opens the title. `?scene=friends` opens Friends straight from boot. A code nobody created lands on the title with NO ROOM WITH THAT CODE.

## Saves

Save version 6 (`SAVE_VERSION` in `src/logic/save.ts`): the best finish per course and level (`bests['sunlit-shallows'].hard`, each a time and place or null; a v5 save's bests move under Sunlit Shallows, and a key for a course the game doesn't know is kept and never shown), `lastCourse` (the last listed course raced), races run, settings (sound, motion, and `difficulty`: easy, normal or hard) and `character`, the last pick. A v2 save loads as Rudy; a v3 save loads on Easy, like a fresh one. Ids are plain strings, so adding or removing a course needs no migration.

## Online races

Up to four friends race one course, every browser running the same simulation from the inputs the others send through a room on the room service (`apps/api`). The game's side is `src/net/` and `engine/online/` (`MAP.md`).

- `friends` (Friends on the title): Create room, Join and Back. Create room asks the room service for a room (CREATING ROOM... meanwhile; the game is not idle until it answers) and joins it; if no room can be had it says so and stays. Join spells a six-character code with the d-pad and joins it. Back goes to the title.
- `room`: the code, the players in join order (P1 to P4, character, ping, HOST, YOU, AWAY) and your rows: Character for everyone, Course, Level (Normal or Hard; a save on Easy starts the room on Normal) and Start for the host, Copy link (puts `?room=<code>` on the clipboard; LINK COPIED, or a notice when the browser refuses) and Leave (or B) for everyone. The host's course starts on the course in force (an unlisted `?course=` is offered too). Start races every ready player; two players with one pick are resolved in join order. Like menus, the screen ignores fire and B for its first 20 ticks.
- An online race is the usual race scene, but the world is the one the start message built on every page and only the lockstep session steps it, a tick at a time when every racer's input for it has arrived; a page waiting on the others shows the same frame. The ready players take slots in join order, and each page follows its own. It saves nothing: no best, no race count, no pick. Results offer Race again (back to the room) and Title (leave the room). A player still on results when the host starts the next race is taken into it.
- A race whose world hashes differ between pages stops and goes back to the room with THE RACE WENT OUT OF SYNC. A closed connection, a join that fails included, goes to the title with its reason (`online/notices.ts`, at most 40 characters per line, also `debugSummary().onlineNotice` there): THAT ROOM IS FULL, NO ROOM WITH THAT CODE, GAME VERSIONS DIFFER: EVERYONE RELOAD (the room has another build; the notice can't tell whose is older), ROOMS ARE UNAVAILABLE RIGHT NOW (also when a room can't be created), YOU WERE DROPPED FROM THE RACE (kicked), CONNECTION LOST.
- When the room service hits its daily limit, the notice shows the next midnight UTC in local time. The page skips room requests until then. Solo races still work.
- Departures: a racer whose page closes, whose tab hides, or who goes silent is handed to the AI on the same tick on every page that stays, and the race carries on to results with standings and hashes equal among them. Hiding the tab during a race that is still running leaves the room and goes to the title with YOU LEFT THE RACE (the shell's `onHide`; nothing reconnects). Hidden in the room or on online results, the player shows AWAY (not ready) until the tab shows again. A racer silent for 5 s while the others wait is kicked by the room at their request (`kickAfterMs`, never in test mode). Offline, hiding the tab only pauses.
- In an online race each racer a person drives wears its lobby label (P1 to P4) over its sprite, the local one included; a racer the AI took over loses it. Once the race has stood still 500 ms on someone, WAITING FOR P2 (every label it waits on) shows at the bottom of the screen until it steps again (`online/race-hud.ts`, drawn by `view/online-race-view.ts`).
- B on Friends while a room is being created goes to the title and drops the room when it arrives. B in a room that has not answered yet (JOINING ROOM...) leaves it for the title. A link copied in a room the player has since left shows no notice.
- Going to the title from online play (Title, Leave or a closed connection) lets go of the room: the next race is an ordinary offline one, saved as usual.
- `debugSummary().net` is present while a room is open, until the player goes to the title; during an online race `course` and `medium` are the race's (the host's pick): `status`, `reason`, `code`, `phase`, `canStart`, `host`, `you`, `peers` (label, character, ready, pingMs), `notice`, `dropped`, and during a race `race` (`local`, `delay`, `simTick`, `targetTick`, `waitingOn`, `stalled` (WAITING FOR is showing), `over`, `desync`). On Friends the summary has `friends` (mode, selected option, the code cells and cursor, notice). The flow is `engine/online/flow.ts`; `tests/online.spec.ts` races two browser pages on the real room service, and `tests/online-leave.spec.ts` covers a page closing mid-race, leaving the room, an unknown code and Race again.

## Look and sound

Every sprite is palette-indexed pixel text, at most 4 colours per frame; racers and hazards must stand off each theme's contrast bands (`UI.md` "Contrast bands per theme"). The HUD and the UI are global art and look the same on every course; racers, portraits, items, pickups, enemies and hazards come from the course's world skin, so they look the same on every course of a world. Sound is a four-voice chip synth (two pulses, a triangle, noise) played the way late-80s consoles were: arpeggio chords, an echo of the lead on the second pulse, duty changes, pitch-dropped triangle kicks. Songs are written in a small text notation and parsed at load, so a malformed song fails tests. Each course's set holds three race tracks (`RACE_TRACKS` in `engine/audio/songs/index.ts`) of 60 to 96 seconds a loop; a course plays the next track of its set each race, starting from the save's race count, and nothing about the rotation is saved. `MUSIC.md` has the track list, the rules every race track is tested against (`songs/race-tracks.test.ts`) and how to write one. The race track speeds up for the final stretch. Each item kind fires its own sound, coloured by the world's skin (`fireFlavour`: lower and duller in Thornwood, airier in Cloudreach, square-edged in Farside). Only the local racer's movement sounds: swim's kick, flight's flap, a runner's hop and footsteps, a drifter's thruster burns and a clank off walls (`audio/move-cues.ts`; the skin's `moveSound` says whether a world steps or burns).

Effects (`engine/fx/`) turn logic events into particles and camera shake; racer squash, invulnerability flicker and the 2x Puffer live in the racer and power-up views. How bubbles rise, debris sinks and ink and droplets drift comes from the course theme's particle physics. Effects run per logic tick from events, use their own cosmetic rng (never `world.rngs`), and never change logic state. Each power-up's fire and each hit cause has its own burst in the world's materials (`fx/item-recipes.ts`, `fx/materials.ts`): bubbles in the Reef, leaves and dust in Thornwood, cloud puffs and feathers in Cloudreach, plasma and sparks in Farside. Movement sheds by medium: dust when a runner jumps, lands or skids, a feather on each flap and speed lines in a dive, a thruster flame behind a drifter's burn; the moments a world watches for are its skin's `moveMoments`. Shake only ever moves the camera for the player's own hits, shield pops (lighter) and cannonball impacts, capped at 4 px. Reduced motion turns shake off, holds particles still, swaps the flicker for a steady half alpha, drops squash and the place flash, and shows the lantern ring at full reach.

## Scenarios

Each file in `scenarios/` is one Playwright scenario (also runnable with `arcade see --scenario <name>`), named for the behaviour it checks: `ls games/rush-racers/scenarios` or `git grep -l <word> -- games/rush-racers/scenarios` finds one. Shared saves, menu walks and the recorded top route are in `scenarios/kit.ts`, whose comments say what each is for and when `TOP_ROUTE` needs re-recording. Behaviour no fixed seed reaches reliably, such as a squid lock-on, starts from a `?stage=`; the browser specs in `tests/` cover what a single scenario can't (`MAP.md`).
