# 3D asset pipeline: glTF, meshopt, KTX2

The stack is glTF 2.0 binary (`.glb`), compressed with `@gltf-transform/cli` 4.5 (architecture doc), loaded with `GLTFLoader` from `three/addons`. Agents can't make art. Use the template's primitives as placeholders, and take real models from the owner or CC0 packs, credited in `assets/CREDITS.md`.

## Optimizing a model

```sh
# One-shot optimize: dedup, prune, weld, simplify, resize textures, meshopt geometry, KTX2 textures.
pnpm dlx @gltf-transform/cli optimize in.glb src/assets/hero.glb --compress meshopt --texture-compress ktx2
pnpm dlx @gltf-transform/cli inspect src/assets/hero.glb   # check sizes, vertex counts, texture formats
```

- Check the exact flags with `gltf-transform optimize -h` before relying on them. The `--compress meshopt` and `--texture-compress ktx2` values above weren't verified against 4.5 for this guide.
- KTX2 encoding shells out to KTX-Software (`toktx`/`ktx`), which must be installed. If it isn't, ask the owner rather than falling back to large PNGs silently.
- For finer control, run the individual commands: `etc1s` for color textures (small, lower quality), `uastc` for normal maps and other data textures (larger, much better quality), `meshopt` for geometry and animation, `resize` to cap texture size.
- Prefer meshopt over Draco. The meshopt decoder is small, has no worker or separate WASM file to host, and it also compresses animation and morph targets. Use Draco only for a model that's already Draco-compressed.
- Commit the optimized `.glb`, not the source `.blend`/`.fbx`, unless the owner wants sources in the repo.

## Importing so Vite hashes it

```ts
import heroGlb from '../assets/hero.glb?url'; // ?url: .glb isn't a type Vite treats as an asset by default
```

Pass the URL to the loader. Don't put models in `public/`: those have fixed names, aren't build-checked, and revalidate on every load.

## Loading

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ktx2 = new KTX2Loader().detectSupport(renderer);
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);

let pendingLoads = 0;
async function loadModel(url: string): Promise<THREE.Group> {
  pendingLoads++;
  try {
    return (await gltfLoader.loadAsync(url)).scene;
  } catch (err) {
    ctx.reportError('gltf', err);
    throw err;
  } finally {
    pendingLoads--;
  }
}
// idle: () => physics !== null && pendingLoads === 0
```

- Create the loaders once per game, not per model. `KTX2Loader` starts a worker pool; call `ktx2.dispose()` on teardown.
- Load errors go to `ctx.reportError` so `see` and smoke fail on them. `idle()` stays false while any load is pending, so `advance()` never ticks past a load.
- Clone loaded scenes for repeated placement (`SkeletonUtils.clone` from `three/addons/utils/SkeletonUtils.js` for skinned models). Cloned meshes share geometry and materials, which is what you want, but then don't dispose them per clone.
- Cache by URL: loading the same model twice downloads and parses it twice.

### The Basis transcoder under Vite

In r187, `KTX2Loader` and `DRACOLoader` find their WASM decoders by default with `new URL('../libs/basis/...', import.meta.url)` (checked in the r187 source). Vite's dependency pre-bundling can break that kind of URL in dev, and `defineGameConfig` pre-bundles `three`. Whether r187 deep imports work in Vite 8 dev without help wasn't verified for this guide. Check it with `pnpm arcade see` (dev) and `pnpm arcade smoke` (production build) the first time a game loads a KTX2 texture. If dev fails, the robust fallback is:

```ts
// Copy node_modules/three/examples/jsm/libs/basis/ to public/basis/ (fixed names; they revalidate, fine for two files)
ktx2.setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
```

`MeshoptDecoder` has its WASM inlined in the module, so it needs no path.

## Textures loaded by hand

- `GLTFLoader` sets `colorSpace` correctly on glTF textures. For textures you load yourself, set `colorSpace = THREE.SRGBColorSpace` on color and emissive maps and leave normal, roughness, metalness and AO maps at the default (`NoColorSpace`).
- Use `KTX2Loader` directly for standalone textures, or `TextureLoader` with an imported WebP for small UI images.
- glTF textures are not flipped (`flipY = false`). Keep that when swapping in your own texture on a glTF material.

## Animation

- `AnimationMixer` per animated model. Advance it in the tick with `mixer.update(TICK_DT)` so animation state lines up with logic ticks and repeats in `arcade see`. It's visual-only state, but driving it from ticks keeps captures reproducible.
- Crossfade between clips with `action.crossFadeTo(next, 0.15, false)`. Select the clip from logic state (grounded, speed, attacking), never from input directly.
- Root motion: keep it out. Logic decides movement; strip root translation from clips (gltf-transform or the DCC tool) so animation and gameplay don't fight.

## Size check

`arcade smoke` reports per-game asset totals and fails near Cloudflare's 25 MiB per-file and 20,000-file limits. A typical character `.glb` should be well under 1 MB after optimization. If one isn't, look at `gltf-transform inspect` for oversized textures first.
