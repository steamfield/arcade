/**
 * Post-processing for the high quality tier: a multisampled HDR render, soft bloom on the bright
 * haze and highlights, a gentle colour grade, then tone mapping and sRGB output. The low tier
 * (touch devices) renders straight to the canvas.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Lifts contrast and saturation a little and warms the highlights, in linear HDR before tone mapping. */
const GRADE = {
  name: 'Grade',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 graded = mix(vec3(luma), color.rgb, 1.12);
      graded = pow(max(graded, 0.0), vec3(1.06));
      graded *= mix(vec3(0.97, 0.99, 1.04), vec3(1.05, 1.0, 0.93), smoothstep(0.1, 0.9, luma));
      gl_FragColor = vec4(graded, color.a);
    }`,
};

export interface Post {
  render(): void;
  setSize(width: number, height: number): void;
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  enabled: boolean,
): Post {
  if (!enabled) {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
    };
  }
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.55, 0.92);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(GRADE));
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    },
  };
}
