/**
 * Loads the nature kit (`assets/nature.glb`, built by `scripts/build-nature-kit.sh` from a CC0 pack)
 * and hands out each model as flat parts ready for instancing, with wind sway on foliage.
 */
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import natureUrl from '../assets/nature.glb?url';

/** One mesh of a model, its transform baked into the geometry. */
export interface ModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Leaves and grass sway in the wind; bark and stone don't. */
  sways: boolean;
}

/** Model names in the kit; each is a root node of the same name in the glb. */
export type ModelName =
  | `Pine_${1 | 2 | 3 | 4 | 5}`
  | `CommonTree_${1 | 2 | 3 | 4 | 5}`
  | `DeadTree_${1 | 2}`
  | 'Bush_Common'
  | 'Bush_Common_Flowers'
  | 'Fern_1'
  | 'Plant_1_Big'
  | 'Plant_7'
  | `Clover_${1 | 2}`
  | `Flower_${3 | 4}_Group`
  | 'Mushroom_Common'
  | 'Mushroom_Laetiporus'
  | `Grass_${'Common' | 'Wispy'}_${'Short' | 'Tall'}`
  | `Rock_Medium_${1 | 2 | 3}`
  | `Pebble_Round_${1 | 2 | 3}`
  | `Pebble_Square_${1 | 2}`;

export interface NatureKit {
  readonly names: Iterable<string>;
  parts(name: ModelName): readonly ModelPart[];
  /** Sets the wind phase, in seconds of game time. Visual only. */
  setWind(seconds: number): void;
}

const SWAYING = /leaf|leaves|grass|flower|fern|plant|clover|bush/i;

/**
 * The kit's leaf-card textures are shape masks meant for its own shader. Those materials take
 * only the mask's alpha and shade from `low` at the base to `high` at `top` meters up the model.
 */
const FOLIAGE: Record<string, { low: number; high: number; top: number }> = {
  Leaves_Pine: { low: 0x1f3a1f, high: 0x6c8c3e, top: 7.5 },
  Leaves_NormalTree: { low: 0x34511f, high: 0x9db446, top: 8 },
  Leaves_TwistedTree: { low: 0x33501f, high: 0x8ea642, top: 1.4 },
};

interface Shading {
  wind: { value: number } | null;
  foliage: { low: number; high: number; top: number } | undefined;
}

/** Wind sways the tops of foliage with world-position waves; foliage recolours mask textures. */
function shade(material: THREE.Material, { wind, foliage }: Shading): void {
  if (!wind && !foliage) return;
  material.onBeforeCompile = (shader) => {
    let vertex = shader.vertexShader;
    let fragment = shader.fragmentShader;
    if (wind) {
      shader.uniforms.windTime = wind;
      vertex = `uniform float windTime;\n${vertex}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 base = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            base = instanceMatrix * base;
          #endif
          base = modelMatrix * base;
          float bend = max(position.y, 0.0);
          float phase = windTime * 1.7 + base.x * 0.21 + base.z * 0.17;
          float gust = sin(phase) * 0.6 + sin(phase * 2.3 + 1.3) * 0.25;
          transformed.x += gust * bend * 0.035;
          transformed.z += cos(phase * 1.3) * bend * 0.02;
        }`,
      );
    }
    if (foliage) {
      shader.uniforms.foliageLow = { value: new THREE.Color(foliage.low) };
      shader.uniforms.foliageHigh = { value: new THREE.Color(foliage.high) };
      vertex = `varying float vFoliage;\n${vertex}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvFoliage = clamp(position.y / ${foliage.top.toFixed(2)}, 0.0, 1.0);`,
      );
      fragment = `uniform vec3 foliageLow;\nuniform vec3 foliageHigh;\nvarying float vFoliage;\n${fragment}`.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor.a *= texture2D(map, vMapUv).a;
        #endif
        diffuseColor.rgb *= mix(foliageLow, foliageHigh, smoothstep(0.0, 1.0, vFoliage));`,
      );
    }
    shader.vertexShader = vertex;
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => `rr3d-${wind ? 'wind' : ''}-${material.name}`;
}

/**
 * Copies a geometry with float positions, normals and uvs. Meshopt stores them as normalised
 * integers, which `applyMatrix4` would clamp to [-1, 1].
 */
function floatGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const attribute = source.getAttribute(name);
    if (!attribute) continue;
    const { count, itemSize } = attribute;
    const values = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i++) {
      values[i * itemSize] = attribute.getX(i);
      if (itemSize > 1) values[i * itemSize + 1] = attribute.getY(i);
      if (itemSize > 2) values[i * itemSize + 2] = attribute.getZ(i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, itemSize));
  }
  const index = source.getIndex();
  if (index) geometry.setIndex(index.clone());
  return geometry;
}

/** Loads and prepares the kit. Rejects with the loader's error if the file is missing or corrupt. */
export async function loadNatureKit(): Promise<NatureKit> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(natureUrl);
  const time = { value: 0 };
  const prepared = new Set<THREE.Material>();
  const models = new Map<string, ModelPart[]>();
  gltf.scene.updateMatrixWorld(true);
  for (const node of gltf.scene.children) {
    const parts: ModelPart[] = [];
    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material as THREE.MeshStandardMaterial;
      const sways = SWAYING.test(material.name);
      if (!prepared.has(material)) {
        prepared.add(material);
        // The kit's vertex colours are wind masks for its own shader, not tints.
        material.vertexColors = false;
        material.roughness = 0.9;
        material.metalness = 0;
        // The kit's bark reads orange-red under ACES; pull it toward grey-brown.
        if (material.name.startsWith('Bark')) material.color.setHex(0x8f8580);
        shade(material, { wind: sways ? time : null, foliage: FOLIAGE[material.name] });
      }
      // World matrix, not relative to the root: meshopt's dequantisation scale lives on the mesh node.
      const geometry = floatGeometry(child.geometry as THREE.BufferGeometry);
      geometry.applyMatrix4(child.matrixWorld);
      parts.push({ geometry, material, sways });
    });
    models.set(node.name, parts);
  }
  return {
    get names() {
      return models.keys();
    },
    parts(name) {
      const parts = models.get(name);
      if (!parts) throw new RangeError(`nature.glb has no model "${name}"`);
      return parts;
    },
    setWind(seconds) {
      time.value = seconds;
    },
  };
}
