import * as THREE from 'three';
import frames from '../assets/forest-cards.json';
import atlasUrl from '../assets/forest-cards.webp?url';
import type { Prop } from './forest.ts';

/** The offsets are expanded by the active camera, including the sun's shadow camera. */
export function forestCardGeometry(props: readonly Prop[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const offsets: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tint = new THREE.Color();
  let margin = 0;
  for (const [i, p] of props.entries()) {
    const f = frames[p.model];
    tint.setHex(p.tint);
    const mirror = p.angle < Math.PI;
    const bend = /^(Rock|Pebble|DeadTree|Mushroom)/.test(p.model) ? 0 : 0.017 * f.height * p.scale;
    for (let corner = 0; corner < 4; corner++) {
      const u = corner === 1 || corner === 2 ? 1 : 0;
      const v = corner >= 2 ? 1 : 0;
      const textureU = mirror ? 1 - u : u;
      const across = (f.left + f.width * textureU) * p.scale * (mirror ? -1 : 1);
      positions.push(p.x, p.y + (f.bottom + f.height * v) * p.scale * p.stretch, p.z);
      offsets.push(across, v * bend);
      uvs.push(f.u + textureU * f.span, f.v + v * f.span);
      colors.push(tint.r, tint.g, tint.b);
      margin = Math.max(margin, Math.abs(across) + bend);
    }
    const j = 4 * i;
    indices.push(j, j + 1, j + 2, j, j + 2, j + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('cardOffset', new THREE.Float32BufferAttribute(offsets, 2));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += margin;
  return geometry;
}

/** Low-tier scenery, baked from the full kit. One static quad per plant, batched by shadow state. */
export async function loadForestCards() {
  const map = await new THREE.TextureLoader().loadAsync(atlasUrl);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.42, vertexColors: true, toneMapped: false });
  material.shadowSide = THREE.DoubleSide;
  const depth = new THREE.MeshDepthMaterial({
    map,
    alphaTest: material.alphaTest,
    depthPacking: THREE.RGBADepthPacking,
  });
  const wind = { value: 0 };
  // In the shadow pass the active view is the sun's. Its cutout projects onto the trail as well.
  material.onBeforeCompile = depth.onBeforeCompile = (shader) => {
    shader.uniforms.forestWind = wind;
    shader.vertexShader = `attribute vec2 cardOffset;
uniform float forestWind;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec2 right = vec2(viewMatrix[0][0], viewMatrix[2][0]);
      transformed.xz += right * cardOffset.x;
      transformed.x += sin(forestWind * 1.7 + position.x * 0.21 + position.z * 0.17) * cardOffset.y;`,
    );
  };

  return {
    setWind(seconds: number) {
      wind.value = seconds;
    },
    add(root: THREE.Group, props: Prop[], casts: boolean) {
      if (!props.length) return;
      const geometry = forestCardGeometry(props);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = casts;
      root.add(mesh);
    },
  };
}
