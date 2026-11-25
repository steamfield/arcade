import { createRng } from '@arcade/core';
import * as THREE from 'three';
import type { Course } from '../../logic/types.ts';
import type { TrackFrames } from '../track/track-geometry.ts';

/** Lay the light on both faces of any hill joint under the pickup. */
export function crateGlowGeometry(course: Course, track: TrackFrames, s: number, d: number): THREE.BufferGeometry {
  const radius = 1.7;
  const start = s - radius;
  const end = s + radius;
  const rows = [start, ...course.hills.map((hill) => hill.s).filter((at) => at > start && at < end), end];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [i, at] of rows.entries()) {
    const { x, y, z, rx, rz } = track.frameAt(at);
    for (const u of [0, 1]) {
      const side = d + (2 * u - 1) * radius;
      positions.push(x + rx * side, y + 0.045, z + rz * side);
      uvs.push(u, (at - start) / (end - start));
    }
    const j = i * 2;
    if (i > 0) indices.push(j - 2, j - 1, j + 1, j - 2, j + 1, j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** Paints the shared wooden crate face with a question mark readable from the chase camera. */
export function crateMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const face = canvas.getContext('2d');
  if (!face) return new THREE.MeshStandardMaterial({ color: 0xe9af54 });
  face.fillStyle = '#423329';
  face.fillRect(0, 0, 128, 128);
  const rng = createRng(0xc4a7e);
  for (let i = 0; i < 4; i++) {
    const y = i * 28 + 8;
    face.fillStyle = ['#a66339', '#c38449', '#ae7142', '#b97c4b'][i] ?? '#a66339';
    face.fillRect(7, y, 114, 26);
    face.fillStyle = '#daa96b';
    face.fillRect(7, y, 114, 2);
    for (let j = 0; j < 22; j++) {
      face.fillStyle = j % 3 ? '#70463264' : '#e8b27b8c';
      face.fillRect(8 + 90 * rng.next(), y + 3 + 21 * rng.next(), 5 + 23 * rng.next(), 1);
    }
  }
  face.save();
  face.translate(64, 64);
  face.rotate(Math.PI / 4);
  face.fillStyle = '#533e2d';
  face.fillRect(-38, -37, 78, 78);
  face.fillStyle = '#ffe1a1';
  face.fillRect(-39, -39, 78, 78);
  face.fillStyle = '#176b67';
  face.fillRect(-35, -35, 70, 70);
  face.strokeStyle = '#78cbc0';
  face.lineWidth = 2;
  face.strokeRect(-32, -32, 64, 64);
  face.restore();
  face.font = 'bold 76px Georgia, serif';
  face.textAlign = 'center';
  face.textBaseline = 'middle';
  face.fillStyle = '#123e3a';
  face.fillText('?', 65, 70);
  face.fillStyle = '#ffefb5';
  face.fillText('?', 64, 67);
  // Folded brass corner plates and rivets frame the light enamel on each rotating face.
  for (let i = 0; i < 4; i++) {
    face.save();
    face.translate(64, 64);
    face.rotate((i * Math.PI) / 2);
    face.translate(-64, -64);
    face.fillStyle = '#eac37d';
    face.beginPath();
    face.moveTo(1, 1);
    face.lineTo(32, 1);
    face.lineTo(26, 8);
    face.lineTo(9, 10);
    face.lineTo(8, 27);
    face.lineTo(1, 32);
    face.fill();
    face.fillStyle = '#64513a';
    face.beginPath();
    face.arc(7, 7, 2.3, 0, Math.PI * 2);
    face.fill();
    face.restore();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map, roughness: 0.64 });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      float enamel = smoothstep(0.01, 0.09, diffuseColor.g - diffuseColor.r);
      float lettering = smoothstep(0.49, 0.82, min(diffuseColor.g, diffuseColor.r));
      totalEmissiveRadiance += diffuseColor.rgb * (0.5 * enamel + 0.40 * lettering);
    `,
    );
  };
  return material;
}

/** Builds a centered, solid five-point star for the orbit above a stunned racer. */
export function starGeometry(): THREE.ExtrudeGeometry {
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? 1 : 0.43;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const geometry = new THREE.ExtrudeGeometry(star, { depth: 0.26, bevelEnabled: false });
  // The extrusion has two material groups by default. They share one material here.
  geometry.clearGroups();
  return geometry.translate(0, 0, -0.13);
}

/** Builds one Rocket Boots flame with vertex colors from a hot gold base to an orange tip. */
export function flameGeometry(): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(1, 2, 7, 4);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const orange = new THREE.Color(0xff4c28);
  const gold = new THREE.Color(0xffe681);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const heat = THREE.MathUtils.smoothstep(positions.getY(i), -0.7, 0.52);
    color
      .copy(gold)
      .lerp(orange, heat)
      .toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
