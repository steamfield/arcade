# Rush Racers map

Where each part of the game lives. Paths are relative to `games/rush-racers/`; `<id>` stands for any world, theme or medium id. `src/map.test.ts` fails when a folder under `src/` is missing from this table or a listed folder no longer exists, so add a row in the same change that adds a folder. How the game plays is `DESIGN.md`; how to add a course, medium, world, item, enemy, set piece, capture stage or net message is `COURSES.md`; screen layouts are `UI.md`.

Three rules hold the layout together. Logic (`src/logic/`) compiles without DOM types (`tsconfig.logic.json`) and imports only `@arcade/core` and `zod`; `src/net/` compiles the same way and adds `@arcade/api/protocol`, except `transport/websocket.ts`, its one DOM file. `src/engine/runtime.ts` is the only place logic ticks: `engine/game.ts` feeds its clock once per Phaser step, and it reads input, steps the world or the menu, and drains each tick's events once to audio and the views. Scenes build views and sync them every frame; text goes only through `createLabel` (`engine/art/font.ts`), global textures through `engine/art/keys.ts`, and a course's own through its theme and world skin.

| Folder | Holds | Start here to |
| --- | --- | --- |
| `src/` | `main.ts`: boots the shell with the save store and starts Phaser. | Change what boot hands the shell. |
| `src/logic/` | The race as plain TypeScript: `world.ts` (`createWorld`, `stepRace`, `stepWorld`; its header is the tick order), `types.ts`, `characters.ts`, `abilities.ts`, `difficulty-level.ts` (`DIFFICULTY`), `guide.ts`, `hash.ts`, `num.ts`, `save.ts`, and repo-shape tests (`architecture.test.ts`). | Change a rule: find the system in the folders below, then the hook in `world.ts`. |
| `src/logic/ai/` | Rival steering, avoidance, item choice and the bot profiles balance tests drive. | Change how rivals race or fire items. |
| `src/logic/balance/` | Test-only difficulty bars and bots: one stub file per listed course, character and level, with the bars in `hard-bars.ts`, `normal-bars.ts`, `easy-bars.ts` and `rival-items.ts`. Runs in the `difficulty` Vitest project. | Retune a course or measure one (`scripts/measure.ts`). |
| `src/logic/balance/sanity/` | The fast bars `arcade check` runs: a sanity race and the bar-matrix completeness check. | Add a listed course (its bar files must exist). |
| `src/logic/conformance/` | Suites every course and medium must pass, the test-only glide and platform media, and `CASES_BY_MEDIUM` (`geometries.ts`). | Add a medium's conformance cases. |
| `src/logic/courses/` | One file per course (level, world, theme, song, par) and the registry `index.ts` (`COURSES`). | Add or change a course. |
| `src/logic/hazards/` | Hits, jellies, squids, latches, lightning and projectiles, with numbers in `tuning.ts`. | Change a hazard or an attack's effect on a racer. |
| `src/logic/hazards/enemies/` | Sharks, eels and crabs: one module per kind, the shared touch rule (`contact.ts`) and `tuning.ts`. | Add or change an enemy kind. |
| `src/logic/level/` | Level parsing (`parse.ts` documents the ASCII format), queries, surfaces, wells and lightning zones. | Add a level glyph or `LevelDef` field. |
| `src/logic/media/` | The `Medium` interface (`types.ts`), the registry `MEDIA`, and helpers several media share (fall-out, pilot kit, test kit). | Change a seam every medium answers. |
| `src/logic/media/<id>/` | One medium (swim, run, flight, drift): physics, navigation, pilot and `tuning.ts`. | Change how a world moves. |
| `src/logic/pickups/` | Clams, loose items, pearls and boost rings. | Change clam rolls or pickups. |
| `src/logic/powerups/` | Inventory, charges, the dash meter, passives and what each item does when fired (`use.ts`). | Change an item. |
| `src/logic/race/` | Generic movement, separation, coral, flow fields, catch-up, standings and seats. | Change race-wide physics or how a race ends. |
| `src/logic/worlds/` | One `WorldDef` per world (medium, cast names, item and enemy names) and the registry `WORLDS`. | Rename things in a world or add a world. |
| `src/net/` | Online play's game side: the lockstep session, wire codec, JSON messages, lobby, hash ledger and the client flow. Everything but `client.ts` and `transport/` is in the simulation build id. | Change a net message or lockstep. |
| `src/net/transport/` | The room connection interface, the browser WebSocket and the in-memory room tests use. | Change how the game talks to `apps/api`. |
| `src/engine/` | Phaser wiring (`game.ts`), the `Runtime` (`runtime.ts`), input, stage sizing, `debugSummary` (`debug.ts`), the local racer and capture stages (`capture-stages.ts`). | Add a launch parameter, a debug readout or a capture stage. |
| `src/engine/art/` | Global art: texture keys (`keys.ts`), the pixel-art drawer (`pixel.ts`), labels (`font.ts`) and the boot art builder (`index.ts`). | Add a global texture. |
| `src/engine/art/sprites/` | Global sprite sheets (HUD sprites, the guide arrow) and the contrast tests every world's racers must pass. | Change HUD art. |
| `src/engine/art/ui/` | The UI kit: palette, fonts, panels, buttons, icons, the logo and kit motion. | Change a UI colour, panel or font (`UI.md` first). |
| `src/engine/audio/` | The chip synth, sequencer, song notation parser, sound effects and the event-to-sound adapter. | Add or change a sound effect. |
| `src/engine/audio/notation/` | The notation parser's parts: tokens, header, bars, events and errors. | Extend the song notation. |
| `src/engine/audio/songs/` | One file per song in the notation, and the registry `songs`. | Add a song. |
| `src/engine/fx/` | Particles, bursts, trails and camera shake, all driven by logic events. | Add an effect for an event. |
| `src/engine/online/` | The online flow (`flow.ts`), Friends and room screen state, notices and the race HUD labels. Phaser-free. | Change an online screen's behaviour. |
| `src/engine/scenes/` | One Phaser scene per screen: boot, title, how to play, course, select, race, results, friends, room. | Change what a screen builds. |
| `src/engine/screens/` | Phaser-free screen state: menus, character select and How to Play paging. | Change menu or cursor behaviour. |
| `src/engine/themes/` | Theme data (`<id>.ts` built with `defineTheme`), `types.ts`, the registry `THEMES` and lazy `THEME_ART`, and the course asset check. | Add a theme or change how one draws. |
| `src/engine/themes/<id>/`, `src/engine/themes/<id>/sprites/` | One theme's keys, palettes and `art.ts`, which draws its sprite sheets; a chunk of its own. | Change a theme's art. |
| `src/engine/view/` | Everything drawn in a scene: level, racers, HUD, hints, power-ups, enemies, hazards, menus, online views, camera and layout. | Change how something looks or moves on screen. |
| `src/engine/view/how-to-play/` | How to Play's page builders and `MEDIUM_PAGES`. | Add a medium's pages. |
| `src/engine/view/set-pieces/` | Views for course set pieces: rings, lightning, wells and the storm reach measure. | Add a set piece's view. |
| `src/engine/worlds/` | World skins (`<id>.ts`), the skin interfaces, the registry `SKINS` with lazy `WORLD_ART`, the art loader `load.ts`, and the skin conformance suite. | Add a world skin or change art loading. |
| `src/engine/worlds/<id>/`, `src/engine/worlds/<id>/sprites/` | One world's keys, cast and object skins, palettes and `art.ts`, which draws its sprite sheets; a chunk of its own. | Change a world's racers, items, enemies or hazards art. |
| `scenarios/` | One Playwright scenario per file, plus `kit.ts` (saves, menu walks, `TOP_ROUTE`). | Add a scenario (`DESIGN.md` "Scenarios"). |
| `tests/` | Browser specs (`smoke.spec.ts`, course, hints, online, boot art and more), `save.test.ts` and the save fixtures. | Add a cross-browser check or a save version. |
| `tests/fixtures/` | One captured save per old save version. | Add the old version's fixture when bumping `SAVE_VERSION`. |
| `scripts/` | `measure.ts`: par and bar margins from the command line. | Measure a course (`COURSES.md` "parTicks"). |
