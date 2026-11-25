import * as THREE from 'three';
import { configureRenderer, createAtmosphere } from '../src/engine/atmosphere.ts';
import { FOREST } from '../src/engine/themes/forest.ts';
import { loadNatureKit } from '../src/engine/track/nature-kit.ts';

/** Orthographic portraits with cutout alpha. Bounds retain each model's scale and planting origin. */
export async function renderForestAtlas() {
  const size = 1024;
  const kit = await loadNatureKit();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  configureRenderer(renderer, FOREST);
  renderer.setClearColor(0, 0);
  renderer.clear();
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  createAtmosphere(renderer, scene, FOREST, true);
  // Keep the kit lighting and environment bounce, and leave empty texels transparent.
  scene.background = null;
  scene.fog = null;
  for (const object of scene.children) {
    if (object instanceof THREE.Mesh) object.visible = false;
    if (object instanceof THREE.DirectionalLight) {
      object.position.set(...FOREST.light.sun.position);
      Object.assign(object.shadow.camera, { left: -10, right: 10, bottom: -10, top: 10 });
      object.shadow.camera.updateProjectionMatrix();
    }
  }
  const camera = new THREE.OrthographicCamera();
  const point = new THREE.Vector3();
  const bounds = new THREE.Box3();
  const frames = {};
  let trees = 0;
  let plants = 0;
  for (const name of kit.names) {
    const tree = /^(Pine|CommonTree|DeadTree)_/.test(name);
    const n = tree ? trees++ : plants++;
    const cell = tree ? 256 : 85;
    const columns = tree ? 4 : 12;
    const x = (n % columns) * cell;
    const y = (tree ? 0 : 768) + Math.floor(n / columns) * cell;
    if ((tree && y >= 768) || y + cell > size) throw new Error(`No atlas space for ${name}`);
    const group = new THREE.Group();
    for (const part of kit.parts(name)) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    scene.add(group);
    // Bushes and stones are seen from above the verge. Taller trees are usually seen side-on.
    camera.position.set(0, tree ? 4 : 12, 36);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    bounds.makeEmpty();
    for (const mesh of group.children) {
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(camera.matrixWorldInverse);
        bounds.expandByPoint(point);
      }
    }
    const left = bounds.min.x;
    const bottom = bounds.min.y;
    const width = bounds.max.x - left;
    const height = bounds.max.y - bottom;
    Object.assign(camera, { left, right: left + width, bottom, top: bottom + height });
    camera.updateProjectionMatrix();
    const pad = 3;
    const span = cell - 2 * pad;
    renderer.setViewport(x + pad, y + pad, span, span);
    renderer.setScissor(x + pad, y + pad, span, span);
    renderer.render(scene, camera);
    frames[name] = { left, bottom, width, height, u: (x + pad) / size, v: (y + pad) / size, span: span / size };
    scene.remove(group);
  }
  const image = renderer.domElement.toDataURL('image/webp', 0.9);
  renderer.dispose();
  return { image, frames };
}
