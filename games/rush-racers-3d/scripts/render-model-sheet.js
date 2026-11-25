import * as THREE from 'three';
import { configureRenderer, createAtmosphere } from '../src/engine/atmosphere.ts';
import { RacerView } from '../src/engine/racers/racer-view.ts';
import { FOREST } from '../src/engine/themes/forest.ts';
import { buildTrackFrames } from '../src/engine/track/track-geometry.ts';
import { THORNWOOD_TRAIL } from '../src/logic/courses/thornwood-trail.ts';
import { CHARACTER_IDS } from '../src/logic/types.ts';

/** Where the camera stands: `yaw` degrees round the racer from dead ahead, `pitch` degrees above level. */
const ANGLES = {
  front: { yaw: 0, pitch: 6 },
  'front 3/4': { yaw: 40, pitch: 10 },
  side: { yaw: 90, pitch: 6 },
  'back 3/4': { yaw: 140, pitch: 10 },
  back: { yaw: 180, pitch: 6 },
  // The race camera's line of sight (8.7 m behind, 4.45 m up), zoomed in on the racer.
  chase: { yaw: 180, pitch: 22 },
};

/** A racer's logic state for each pose, and how many ticks of it to run before the picture. */
const POSES = {
  idle: { ticks: 1 },
  'run A': { vs: 14, ticks: 4 },
  'run B': { vs: 14, ticks: 12 },
  jump: { vs: 14, vy: 9, lift: 1.3, ticks: 4 },
  dash: { vs: 24, ticks: 4 },
  steer: { vs: 14, vd: 7, ticks: 4 },
};

const SHEETS = {
  cast: { rows: ['front 3/4', 'side', 'back 3/4', 'chase'].map((angle) => ({ angle, pose: 'idle' })) },
};

/**
 * Draws one sheet and returns it as a PNG data URL. `name` is `cast` (every racer as a column, one
 * angle per row) or a character id (angles as columns, poses as rows).
 */
export function renderModelSheet({ name, cell = 300 }) {
  if (name !== 'cast' && !CHARACTER_IDS.includes(name)) {
    throw new Error(`Unknown sheet "${name}". Use cast or one of: ${CHARACTER_IDS.join(', ')}`);
  }
  const cast = name === 'cast';
  const columns = cast ? CHARACTER_IDS : Object.keys(ANGLES);
  const rows = cast ? SHEETS.cast.rows : Object.keys(POSES).map((pose) => ({ pose }));
  const width = cell;
  const height = Math.round(cell * 1.15);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(columns.length * width, rows.length * height, false);
  configureRenderer(renderer, FOREST);
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  const atmosphere = createAtmosphere(renderer, scene, FOREST, false);
  // Keep the forest's light and bounce; swap the sky for a flat backdrop that shows silhouettes.
  for (const object of scene.children) if (object instanceof THREE.Mesh) object.visible = false;
  scene.background = new THREE.Color(0x9fb3a8);
  scene.fog = null;

  const frames = buildTrackFrames(THORNWOOD_TRAIL);
  const s = THORNWOOD_TRAIL.startS + 4;
  const frame = frames.frameAt(s);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8d7a5c, roughness: 1 }),
  );
  ground.position.set(frame.x, frame.y - 0.01, frame.z);
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(16, width / height, 0.1, 100);
  const labels = [];
  rows.forEach((row, r) => {
    columns.forEach((column, c) => {
      const character = cast ? column : name;
      const angle = ANGLES[cast ? row.angle : column];
      const pose = POSES[row.pose];
      const view = new RacerView(character);
      scene.add(view.root);
      const racer = {
        state: 'racing',
        s,
        d: 0,
        y: frame.y + (pose.lift ?? 0),
        vs: pose.vs ?? 0,
        vd: pose.vd ?? 0,
        vy: pose.vy ?? 0,
        grounded: pose.lift === undefined,
        invulnTicks: 0,
      };
      for (let i = 0; i < pose.ticks; i++) view.tick(racer, frames, THORNWOOD_TRAIL);

      const yaw = THREE.MathUtils.degToRad(angle.yaw);
      const pitch = THREE.MathUtils.degToRad(angle.pitch);
      const reach = 11.5 * Math.cos(pitch);
      const target = new THREE.Vector3(frame.x, racer.y + 1.05, frame.z);
      camera.position.set(
        target.x + (frame.tx * Math.cos(yaw) + frame.rx * Math.sin(yaw)) * reach,
        target.y + 11.5 * Math.sin(pitch),
        target.z + (frame.tz * Math.cos(yaw) + frame.rz * Math.sin(yaw)) * reach,
      );
      camera.lookAt(target);
      atmosphere.follow(camera);
      const top = (rows.length - 1 - r) * height;
      renderer.setViewport(c * width, top, width, height);
      renderer.setScissor(c * width, top, width, height);
      renderer.render(scene, camera);
      view.dispose();
      labels.push({
        x: c * width + 8,
        y: r * height + 18,
        text: cast ? `${column} · ${row.angle}` : `${row.pose} · ${column}`,
      });
    });
  });

  const sheet = document.createElement('canvas');
  sheet.width = renderer.domElement.width;
  sheet.height = renderer.domElement.height;
  const pen = sheet.getContext('2d');
  pen.drawImage(renderer.domElement, 0, 0);
  pen.font = '600 13px system-ui, sans-serif';
  pen.fillStyle = '#1d2a24';
  for (const label of labels) pen.fillText(label.text, label.x, label.y);
  renderer.dispose();
  return sheet.toDataURL('image/png');
}
