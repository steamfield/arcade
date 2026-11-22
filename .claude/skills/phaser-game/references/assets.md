# Phaser assets in this repo

How to get images, atlases, maps, audio and fonts into a Phaser 4 game so they are hashed, build-checked, typed and testable. Loader API detail is in `node_modules/phaser/skills/loading-assets/SKILL.md` and `tilemaps/SKILL.md`.

## Import, don't path

```ts
// src/engine/assets.ts
import tilesPng from '../assets/tiles.png';
import heroPng from '../assets/hero.png';
import heroJson from '../assets/hero.json?url'; // ?url: a hashed file, not JSON parsed into the bundle
import level1Url from '../assets/level-1.tmj?url';
import jumpSfx from '../assets/sfx/jump.m4a';

export const Tex = { tiles: 'tiles', hero: 'hero' } as const;
export const Maps = { level1: 'level-1' } as const;
export const Sfx = { jump: 'jump' } as const;

export function loadPlayAssets(scene: Phaser.Scene): void {
  scene.load.image(Tex.tiles, tilesPng);
  scene.load.atlas(Tex.hero, heroPng, heroJson);
  scene.load.tilemapTiledJSON(Maps.level1, level1Url);
  scene.load.audio(Sfx.jump, jumpSfx);
}
```

- Images and audio import as URLs by default. JSON, `.tmj`, `.fnt`/`.xml` and anything else that should stay a separate file needs `?url`. Without it, Vite inlines JSON into the JS bundle.
- Vite inlines assets under 4 KB as `data:` URIs. Phaser's loader accepts `data:` URLs, so this is fine.
- Don't use `public/` for game assets. Those files keep fixed names, aren't build-checked, and revalidate on every load.
- Every third-party asset gets a line in `assets/CREDITS.md`; `arcade check` enforces it.
- Keep the key consts next to the imports. A typo in a key is then a type error, not a `__MISSING` texture at runtime.

## Atlases and sprite sheets

- One atlas per scene or per character family, rather than dozens of single images. Fewer textures means fewer batch breaks, and fewer files counts against the 20,000-file deploy limit shared by every game.
- Packing tools: TexturePacker (paid), free-tex-packer, or Aseprite's own export. Use JSON Hash or JSON Array output; Phaser's `load.atlas` reads both. Ignore the `image` field inside the JSON, since the PNG URL is passed separately.
- Aseprite: export the sheet with "JSON Array" plus tags, load with `this.load.aseprite(key, png, json)`, then call `this.anims.createFromAseprite(key)` once in the boot scene. Tag names become animation keys, so add them to a typed const too.
- `load.spritesheet` is for fixed-size grids referenced by frame index. Use atlases with named frames for anything else.
- Pixel art: enable 1-2 px extrude (or padding with border repeat) in the packer, and use power-of-two sheet sizes if you'll use `SpriteGPULayer` (bundled `v4-new-features` notes seams otherwise).
- Pre-v4 compressed textures need re-encoding with Y flipped. Plain PNG/WebP needs nothing.

## Tiled maps

The template uses ASCII levels parsed in `src/logic/level.ts`, which agents read and write reliably. Switch to Tiled when levels need art layers, object placement or more than a screen or two.

Keep logic engine-free by passing the parsed JSON in, not by importing Phaser into logic:

```ts
// src/logic/tiled.ts: pure TS, validated with Zod, unit tested with fixture JSON
export function levelFromTiled(json: unknown): Level { /* read the "collision" layer and the "spawns" object layer */ }

// src/engine/play-scene.ts
create() {
  const map = this.make.tilemap({ key: Maps.level1 });
  const tiles = map.addTilesetImage('tiles', Tex.tiles); // first arg: the tileset name inside Tiled
  if (!tiles) throw new Error('Tileset "tiles" not found in level-1.tmj');
  map.createLayer('ground', tiles, 0, 0);
  // The tilemap cache holds { format, data }; data is the raw Tiled JSON.
  const level = levelFromTiled(this.cache.tilemap.get(Maps.level1).data);
  // hand `level` to createWorld; logic does collision from it, Phaser only draws
}
```

Tiled rules (most fail with a `null` and a console warning, not an error):

- Embed tilesets in the map (Map > Embed Tileset). External `.tsx` tilesets and "Collection of Images" tilesets aren't supported.
- Tileset names and layer names must match the strings in code exactly. Group layers flatten to `Group/Layer`.
- Mark collision with a dedicated layer or a tile property (`collides: true`) that logic reads. Don't rely on Arcade's `setCollisionByProperty` unless you've chosen engine-side physics on purpose.
- Use object layers for spawns, pickups, triggers and doors. Give objects a `type`/class and custom properties, and have logic validate them with Zod so a bad map fails with a clear message.
- `TilemapGPULayer` (`createLayer(id, tileset, x, y, true)`) draws a whole layer in one quad: one tileset, orthographic only, and edits need `generateLayerDataTexture()`. Use it for large static background layers.
- Unit tests can read the same `.tmj` with `readFileSync` and call `levelFromTiled`, so collision and spawn parsing is covered without a browser.

## Audio

- One compressed format per sound. AAC in `.m4a` and MP3 both decode through Web Audio in current Chromium, Firefox and Safari. Don't ship Ogg-only audio; Safari's Ogg/Opus support through `decodeAudioData` has been unreliable (not re-verified for current Safari).
- Short SFX: mono, trimmed, 44.1 or 48 kHz. Several small SFX can share one audio sprite (`load.audioSprite`).
- Music: Web Audio decodes the whole file into memory, and Workers static assets answer range requests with the full file (architecture doc, decision 4), so streaming isn't an option. Keep loops short (about 1-2 MB) and load music after the first scene is playable, not before the title.
- Respect a volume or mute setting stored in the save (see `game-feel`), and set `this.sound.mute` / `volume` from it at boot.
- Register `game.sound.context` with `ctx.registerAudioContext` (see SKILL.md section 6). The shell's start gate is the first user gesture and resumes registered contexts.

## Fonts

- Pixel fonts: `BitmapText`. Load with `this.load.bitmapFont(key, pngUrl, fntOrXmlUrl)` from imported URLs. It's cheap to update every frame, unlike `Text`.
- Web fonts for `Text`: import the font file URL, register it with the `FontFace` API, and await `document.fonts.load('16px "Name"')` before the scene that uses it creates text. Phaser doesn't load web fonts and draws a fallback if the font isn't ready.
- Font names with spaces or digits need inner quotes: `fontFamily: '"Press Start 2P"'`.

## Load-time budget

The architecture target is under 5 s to interactive on a mid-range phone with a cold cache, and every game downloads its own Phaser copy. The template's production bundle is about 1.46 MB minified, about 380 KB gzipped (measured 2026-11-22), almost all of it Phaser. Budget the rest:

- Title screen assets only before the start gate. Everything else loads per scene.
- Prefer WebP or optimized PNG for art (pngquant or oxipng for pixel art; WebP lossless also works).
- Check the size `arcade smoke` reports after adding assets.
