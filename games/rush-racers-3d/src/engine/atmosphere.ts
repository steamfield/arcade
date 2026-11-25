/**
 * Renderer look and the light around the trail: tone mapping, the gradient sky dome and the sun's
 * shadow map that follows the camera. Visual only; nothing here feeds back into logic.
 */
import * as THREE from 'three';
import type { Theme } from './themes/types.ts';

/** Half the width of the square the sun's shadow map covers, m. */
const SHADOW_REACH = 34;

/** Tone mapping and shadow setup for the renderer. */
export function configureRenderer(renderer: THREE.WebGLRenderer, theme: Theme): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

/** A sky dome that fades from the fog colour at the horizon to `zenith` overhead, centred on the camera. */
function skyDome(sky: Theme['sky']): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      horizon: { value: new THREE.Color(sky.color) },
      zenith: { value: new THREE.Color(sky.zenith) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 horizon;
      uniform vec3 zenith;
      varying vec3 vDir;
      void main() {
        float up = pow(smoothstep(-0.02, 0.32, vDir.y), 0.8);
        gl_FragColor = vec4(mix(horizon, zenith, up), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), material);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}

/**
 * A prefiltered environment map from a sky-to-ground gradient, so standard materials pick up the
 * blue sky from above and warm bounce light from the ground below.
 */
function environment(renderer: THREE.WebGLRenderer, sky: Theme['sky'], ground: number): THREE.Texture {
  const sphere = new THREE.SphereGeometry(1, 32, 16);
  const position = sphere.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const zenith = new THREE.Color(sky.zenith);
  const horizon = new THREE.Color(sky.color);
  const floor = new THREE.Color(ground);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const up = position.getY(i);
    if (up >= 0) color.lerpColors(horizon, zenith, Math.min(1, up / 0.5));
    else color.lerpColors(horizon, floor, Math.min(1, -up / 0.25));
    color.toArray(colors, i * 3);
  }
  sphere.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, 0.02).texture;
  pmrem.dispose();
  sphere.dispose();
  return texture;
}

/**
 * Adds the sky, environment light, sun and hemisphere light (`small` halves the shadow map for
 * phones); call `follow` before each render to keep the dome and shadows on the camera.
 */
export function createAtmosphere(renderer: THREE.WebGLRenderer, scene: THREE.Scene, theme: Theme, small: boolean) {
  const { sky, light } = theme;
  const horizon = new THREE.Color(sky.color);
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, sky.fogNear, sky.fogFar);
  scene.environment = environment(renderer, sky, theme.ground.grass);
  scene.environmentIntensity = light.environment;
  const dome = skyDome(sky);

  const sun = new THREE.DirectionalLight(light.sun.color, light.sun.intensity);
  const offset = new THREE.Vector3(...light.sun.position);
  sun.castShadow = true;
  const shadow = sun.shadow;
  const size = small ? 1024 : 2048;
  shadow.mapSize.set(size, size);
  Object.assign(shadow.camera, {
    left: -SHADOW_REACH,
    right: SHADOW_REACH,
    top: SHADOW_REACH,
    bottom: -SHADOW_REACH,
    near: 1,
    far: offset.length() + 60,
  });
  shadow.camera.updateProjectionMatrix();
  shadow.bias = -0.0004;
  shadow.normalBias = 0.04;
  shadow.radius = 3;
  const hemisphere = new THREE.HemisphereLight(
    light.hemisphere.sky,
    light.hemisphere.ground,
    light.hemisphere.intensity,
  );
  scene.add(dome, sun, sun.target, hemisphere);

  // Snap the shadow box to whole texels along the light's axes so shadows don't shimmer as it moves.
  const texel = (SHADOW_REACH * 2) / size;
  const toLight = new THREE.Matrix4().lookAt(offset, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  const fromLight = toLight.clone().invert();
  const focus = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  return {
    /** Centres the dome on the camera and the shadow box a little ahead of it. */
    follow(camera: THREE.Camera): void {
      dome.position.copy(camera.position);
      camera.getWorldDirection(ahead);
      ahead.y = 0;
      ahead.normalize();
      focus.copy(camera.position).addScaledVector(ahead, SHADOW_REACH * 0.55);
      focus.applyMatrix4(fromLight);
      focus.x = Math.round(focus.x / texel) * texel;
      focus.y = Math.round(focus.y / texel) * texel;
      focus.applyMatrix4(toLight);
      sun.target.position.copy(focus);
      sun.position.copy(focus).add(offset);
    },
  };
}
