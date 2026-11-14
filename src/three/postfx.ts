import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface AAARenderPipeline {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer | null;
  bloomPass: UnrealBloomPass | null;
  isSoftwareGl: boolean;
  resize: (width: number, height: number, camera: THREE.PerspectiveCamera) => void;
  renderFrame: () => void;
  dispose: () => void;
}

export function createAAARenderPipeline(
  container: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  options?: {
    bloomStrength?: number;
    bloomRadius?: number;
    bloomThreshold?: number;
    exposure?: number;
  }
): AAARenderPipeline {
  const isSoftwareGl = detectSoftwareWebGL();
  const width = container.clientWidth || 1280;
  const height = container.clientHeight || 720;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options?.exposure ?? 0.92;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;

  if (!isSoftwareGl) {
    try {
      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2))),
        options?.bloomStrength ?? 0.07,
        options?.bloomRadius ?? 0.32,
        options?.bloomThreshold ?? 1.18
      );
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch {
      composer = null;
      bloomPass = null;
    }
  }

  return {
    renderer,
    composer,
    bloomPass,
    isSoftwareGl,
    resize: (nextW: number, nextH: number, cam: THREE.PerspectiveCamera) => {
      const safeW = Math.max(1, nextW);
      const safeH = Math.max(1, nextH);
      cam.aspect = safeW / safeH;
      cam.updateProjectionMatrix();
      renderer.setSize(safeW, safeH);
      if (composer) composer.setSize(safeW, safeH);
      if (bloomPass) {
        bloomPass.resolution.set(
          Math.max(1, Math.floor(safeW / 2)),
          Math.max(1, Math.floor(safeH / 2))
        );
      }
    },
    renderFrame: () => {
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    },
    dispose: () => {
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
