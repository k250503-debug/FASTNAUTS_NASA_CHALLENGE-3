import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  JOURNEY_SEQUENCE_IDS,
  UNIVERSE_BODIES,
  getCelestialBodyById,
} from '../data/universe';
import { createAAARenderPipeline } from './postfx';
import {
  createEarthCloudsTexture,
  createNebulaTexture,
  createPlanetSurfaceTexture,
  createPlanetaryRingTexture,
  createRadialGlowTexture,
  createSpiralGalaxyTexture,
} from './universeTextures';

export type UniverseExperienceMode = 'journey' | 'click_to_start' | 'interactive';

interface UniverseScene3DProps {
  mode: UniverseExperienceMode;
  selectedBodyId: string | null;
  timeScale: number; // 0 = paused, 1 = normal, 5 = fast, 25 = rapid
  replaySignal: number;
  overviewSignal: number;
  onSelectBody: (id: string | null) => void;
  onJourneyFocusChange: (id: string | null, stopIndex: number, totalStops: number) => void;
  onJourneyComplete: () => void;
  onWebGLFallback?: () => void;
}

interface BodyRuntime {
  id: string;
  pivot: THREE.Group;
  meshRoot: THREE.Group;
  spinMesh?: THREE.Object3D;
  cloudsMesh?: THREE.Mesh;
  orbitAngle: number;
  worldPos: THREE.Vector3;
  prevWorldPos: THREE.Vector3;
}

const _camDesired = new THREE.Vector3();
const _lookDesired = new THREE.Vector3();
const _deltaVec = new THREE.Vector3();
const _sunToComet = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _ndc = new THREE.Vector2();
const _dummyObj = new THREE.Object3D();

const STOP_DURATION_SEC = 4.2;
const INTRO_FADE_SEC = 5.5;

function createRadialRingGeometry(
  innerRadius: number,
  outerRadius: number,
  thetaSegments = 96
): THREE.RingGeometry {
  const geo = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const u = Math.max(0, Math.min(1, (r - innerRadius) / (outerRadius - innerRadius)));
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

function createAtmosphereMesh(
  radius: number,
  colorHex: number,
  intensity = 0.72,
  power = 3.2
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uFade: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPower;
      uniform float uFade;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(0.0, dot(vNormalWorld, vViewDir)), uPower);
        gl_FragColor = vec4(uColor, fresnel * uIntensity * uFade);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

function createCompositeSatellite(
  kind: 'iss' | 'jwst' | 'voyager1'
): THREE.Group {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    metalness: 0.85,
    roughness: 0.28,
  });
  const goldFoil = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.18,
  });
  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.2,
    metalness: 0.6,
    roughness: 0.25,
  });
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.88,
    roughness: 0.2,
    side: THREE.DoubleSide,
  });

  if (kind === 'iss') {
    // Integrated central truss
    const truss = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), metal);
    root.add(truss);
    // Pressurized module spine
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.72, 12),
      metal
    );
    spine.rotation.x = Math.PI / 2;
    root.add(spine);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), goldFoil);
    root.add(node);
    // 4 pairs of double solar wings
    for (const sx of [-0.62, -0.38, 0.38, 0.62]) {
      for (const sz of [-0.36, 0.36]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.56), solarPanelMat);
        wing.position.set(sx, 0, sz);
        root.add(wing);
      }
    }
  } else if (kind === 'jwst') {
    // 5-layer diamond-shaped Kapton sunshield
    for (let i = 0; i < 3; i++) {
      const layer = new THREE.Mesh(new THREE.BoxGeometry(0.92 - i * 0.05, 0.015, 0.58 - i * 0.04), shieldMat);
      layer.position.y = -0.08 + i * 0.04;
      layer.rotation.y = Math.PI / 4;
      root.add(layer);
    }
    // Segmented gold hexagonal mirror dish
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 6), goldFoil);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, 0.25, -0.05);
    root.add(mirror);
    // Secondary tripod struts
    const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), metal);
    secMirror.rotation.x = Math.PI / 2;
    secMirror.position.set(0, 0.25, 0.34);
    root.add(secMirror);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), metal);
    mast.rotation.x = Math.PI / 2;
    mast.position.set(0, 0.25, 0.14);
    root.add(mast);
  } else {
    // Voyager 1: High-gain parabolic dish + bus + RTG & magnetometer booms
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.08, 0.14, 24, 1, true), metal);
    dish.rotation.x = Math.PI / 2;
    root.add(dish);
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 10), goldFoil);
    bus.rotation.x = Math.PI / 2;
    bus.position.z = -0.14;
    root.add(bus);
    const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 6), metal);
    magBoom.rotation.z = Math.PI / 2;
    magBoom.position.set(0.56, 0, -0.12);
    root.add(magBoom);
    const rtgBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), goldFoil);
    rtgBoom.rotation.z = -Math.PI / 3;
    rtgBoom.position.set(-0.28, -0.16, -0.14);
    root.add(rtgBoom);
  }

  return root;
}

export default function UniverseScene3D({
  mode,
  selectedBodyId,
  timeScale,
  replaySignal,
  overviewSignal,
  onSelectBody,
  onJourneyFocusChange,
  onJourneyComplete,
  onWebGLFallback,
}: UniverseScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef(mode);
  const selectedIdRef = useRef(selectedBodyId);
  const timeScaleRef = useRef(timeScale);

  modeRef.current = mode;
  selectedIdRef.current = selectedBodyId;
  timeScaleRef.current = timeScale;

  const callbacksRef = useRef({
    onSelectBody,
    onJourneyFocusChange,
    onJourneyComplete,
    onWebGLFallback,
  });
  callbacksRef.current = {
    onSelectBody,
    onJourneyFocusChange,
    onJourneyComplete,
    onWebGLFallback,
  };

  const actionsRef = useRef<{
    restartJourney: () => void;
    flyToOverview: () => void;
    focusBody: (id: string) => void;
  } | null>(null);

  useEffect(() => {
    if (replaySignal > 0) actionsRef.current?.restartJourney();
  }, [replaySignal]);

  useEffect(() => {
    if (overviewSignal > 0) actionsRef.current?.flyToOverview();
  }, [overviewSignal]);

  useEffect(() => {
    if (mode === 'interactive' && selectedBodyId) {
      actionsRef.current?.focusBody(selectedBodyId);
    }
  }, [mode, selectedBodyId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let pipeline: ReturnType<typeof createAAARenderPipeline> | null = null;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x010205);

      const camera = new THREE.PerspectiveCamera(
        48,
        (container.clientWidth || 1280) / (container.clientHeight || 720),
        0.2,
        1400
      );
      camera.position.set(0, 75, 220);

      pipeline = createAAARenderPipeline(container, scene, camera, {
        bloomStrength: 0.45,
        bloomRadius: 0.55,
        bloomThreshold: 0.72,
        exposure: 1.12,
      });

      const { renderer, isSoftwareGl } = pipeline;
      const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      pmremGenerator.dispose();

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.055;
      controls.enablePan = true;
      controls.minDistance = 1.6;
      controls.maxDistance = 380;
      controls.enabled = modeRef.current === 'interactive';

      // Subtle ambient fill + strong solar PointLight at center
      const ambient = new THREE.AmbientLight(0x1e293b, 0.35);
      scene.add(ambient);
      const hemi = new THREE.HemisphereLight(0x64748b, 0x0f172a, 0.28);
      scene.add(hemi);

      const sunLight = new THREE.PointLight(0xfff4d6, 3.2, 520, 0.28);
      sunLight.position.set(0, 0, 0);
      if (!isSoftwareGl) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.bias = -0.0008;
      }
      scene.add(sunLight);

      // ========= PHASE 1 LAYERED DEEP SPACE =========
      const disposables: Array<{ dispose: () => void }> = [envRT];
      const trackDisposable = <T extends { dispose: () => void }>(d: T): T => {
        disposables.push(d);
        return d;
      };

      // 1. Multi-spectral realistic distant stars
      const starCount = 6500;
      const starPos = new Float32Array(starCount * 3);
      const starCol = new Float32Array(starCount * 3);
      const spectral = [
        new THREE.Color(0x9bbcff), // O/B blue-white
        new THREE.Color(0xeef6ff), // A white
        new THREE.Color(0xfff4dc), // G warm
        new THREE.Color(0xffd2a1), // K amber
        new THREE.Color(0xfca5a5), // M red giant
      ];
      for (let i = 0; i < starCount; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        // Concentrate ~45% near galactic band
        const bandBias = i < starCount * 0.45 ? (Math.random() - 0.5) * 0.32 : Math.cos(phi);
        const sinPhi = Math.sqrt(Math.max(0, 1 - bandBias * bandBias));
        const r = 420 + Math.random() * 260;
        starPos[i * 3] = r * sinPhi * Math.cos(theta);
        starPos[i * 3 + 1] = r * bandBias;
        starPos[i * 3 + 2] = r * sinPhi * Math.sin(theta);

        const c = spectral[i % spectral.length];
        const lum = 0.55 + Math.random() * 0.45;
        starCol[i * 3] = c.r * lum;
        starCol[i * 3 + 1] = c.g * lum;
        starCol[i * 3 + 2] = c.b * lum;
      }
      const starGeo = trackDisposable(new THREE.BufferGeometry());
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
      const starMat = trackDisposable(
        new THREE.PointsMaterial({
          size: 1.35,
          vertexColors: true,
          transparent: true,
          opacity: 0,
          sizeAttenuation: true,
          depthWrite: false,
        })
      );
      const starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      // 2. Cosmic ecliptic dust particles
      const dustCount = 1200;
      const dustPos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 12 + Math.random() * 195;
        dustPos[i * 3] = Math.cos(ang) * rad;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
        dustPos[i * 3 + 2] = Math.sin(ang) * rad;
      }
      const dustGeo = trackDisposable(new THREE.BufferGeometry());
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      const dustMat = trackDisposable(
        new THREE.PointsMaterial({
          color: 0x67e8f9,
          size: 0.45,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const cosmicDust = new THREE.Points(dustGeo, dustMat);
      scene.add(cosmicDust);

      // 3. Background Nebulae Clouds (Milky Way / Cosmic Filaments)
      const nebTex1 = trackDisposable(
        createNebulaTexture('rgba(56, 189, 248, 0.24)', 'rgba(99, 102, 241, 0.18)', maxAnisotropy)
      );
      const nebTex2 = trackDisposable(
        createNebulaTexture('rgba(236, 72, 153, 0.22)', 'rgba(59, 130, 246, 0.16)', maxAnisotropy)
      );
      const nebSprites: THREE.Sprite[] = [];
      const nebCoords: Array<[number, number, number, number]> = [
        [220, 45, -240, 240],
        [-260, -35, -180, 260],
        [140, -65, 250, 230],
        [-190, 80, 210, 220],
      ];
      nebCoords.forEach(([nx, ny, nz, sc], idx) => {
        const spMat = trackDisposable(
          new THREE.SpriteMaterial({
            map: idx % 2 === 0 ? nebTex1 : nebTex2,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        const sp = new THREE.Sprite(spMat);
        sp.position.set(nx, ny, nz);
        sp.scale.set(sc, sc * 0.72, 1);
        scene.add(sp);
        nebSprites.push(sp);
      });

      // ========= THE SUN (Animated GLSL Photosphere + Corona + Flares) =========
      const sunBody = getCelestialBodyById('sun');
      const sunPivot = new THREE.Group();
      scene.add(sunPivot);
      const sunRoot = new THREE.Group();
      sunPivot.add(sunRoot);

      const sunShaderMat = trackDisposable(
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uReveal: { value: 0 },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPos;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float uTime;
            uniform float uReveal;
            varying vec3 vNormal;
            varying vec3 vPos;

            float hash(vec3 p) {
              p = fract(p * 0.3183099 + 0.1);
              p *= 17.0;
              return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }
            float noise3d(vec3 x) {
              vec3 i = floor(x);
              vec3 f = fract(x);
              f = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                    mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                    mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
                f.z
              );
            }
            float fbm3(vec3 p) {
              float v = 0.0;
              float a = 0.5;
              for (int i = 0; i < 4; i++) {
                v += a * noise3d(p);
                p = p * 2.05 + vec3(1.7, 9.2, 4.1);
                a *= 0.5;
              }
              return v;
            }
            void main() {
              vec3 p = normalize(vPos) * 3.8 + vec3(uTime * 0.12, -uTime * 0.09, uTime * 0.07);
              float gran = fbm3(p);
              float flareBand = fbm3(p * 1.9 - vec3(uTime * 0.22));
              vec3 darkSpot = vec3(0.82, 0.25, 0.03);
              vec3 midPlasma = vec3(1.0, 0.62, 0.12);
              vec3 hotCore = vec3(1.0, 0.95, 0.72);
              vec3 col = mix(darkSpot, midPlasma, smoothstep(0.28, 0.68, gran));
              col = mix(col, hotCore, smoothstep(0.58, 0.92, flareBand));
              float limb = pow(1.0 - max(0.0, vNormal.z), 2.0);
              col += vec3(1.0, 0.42, 0.08) * limb * 0.55;
              gl_FragColor = vec4(col * uReveal * 1.35, 1.0);
            }
          `,
        })
      );
      const sunMesh = new THREE.Mesh(
        trackDisposable(new THREE.SphereGeometry(sunBody.radius, 64, 48)),
        sunShaderMat
      );
      sunRoot.add(sunMesh);

      // Sun invisible hit sphere
      const sunHit = new THREE.Mesh(
        trackDisposable(new THREE.SphereGeometry(sunBody.radius * 1.25, 16, 12)),
        trackDisposable(new THREE.MeshBasicMaterial({ visible: false }))
      );
      sunHit.userData.celestialId = 'sun';
      sunRoot.add(sunHit);

      // Sun Corona Halo
      const sunGlowTex = trackDisposable(
        createRadialGlowTexture(
          'rgba(255, 232, 165, 0.95)',
          'rgba(249, 115, 22, 0.42)',
          'rgba(249, 115, 22, 0)'
        )
      );
      const sunCoronaMat = trackDisposable(
        new THREE.SpriteMaterial({
          map: sunGlowTex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const sunCorona = new THREE.Sprite(sunCoronaMat);
      sunCorona.scale.set(sunBody.radius * 4.4, sunBody.radius * 4.4, 1);
      sunRoot.add(sunCorona);

      // Solar Prominence Flare Loops
      const flareMats: THREE.MeshBasicMaterial[] = [];
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.5;
        const arc = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(ang) * sunBody.radius * 0.96, -0.7, Math.sin(ang) * sunBody.radius * 0.96),
          new THREE.Vector3(Math.cos(ang + 0.12) * (sunBody.radius + 1.8), 1.4, Math.sin(ang + 0.12) * (sunBody.radius + 1.8)),
          new THREE.Vector3(Math.cos(ang + 0.25) * sunBody.radius * 0.96, 0.6, Math.sin(ang + 0.25) * sunBody.radius * 0.96),
        ]);
        const fGeo = trackDisposable(new THREE.TubeGeometry(arc, 24, 0.14, 8, false));
        const fMat = trackDisposable(
          new THREE.MeshBasicMaterial({
            color: 0xfb923c,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        flareMats.push(fMat);
        const fMesh = new THREE.Mesh(fGeo, fMat);
        fMesh.rotation.z = i * 0.55;
        sunRoot.add(fMesh);
      }

      // ========= CELESTIAL BODIES & ORBIT REGISTRY =========
      const runtimeMap = new Map<string, BodyRuntime>();
      const pickables: THREE.Object3D[] = [sunHit];
      const orbitRingMats: THREE.LineBasicMaterial[] = [];
      const atmosMats: THREE.ShaderMaterial[] = [];

      runtimeMap.set('sun', {
        id: 'sun',
        pivot: sunPivot,
        meshRoot: sunRoot,
        spinMesh: sunMesh,
        orbitAngle: 0,
        worldPos: new THREE.Vector3(0, 0, 0),
        prevWorldPos: new THREE.Vector3(0, 0, 0),
      });

      const galaxyTex = trackDisposable(createSpiralGalaxyTexture(maxAnisotropy));

      // Create Planets, Moons, Small Bodies, Satellites, Deep Space
      for (const body of UNIVERSE_BODIES) {
        if (body.id === 'sun') continue;

        const pivot = new THREE.Group();
        pivot.rotation.z = THREE.MathUtils.degToRad(body.orbitInclinationDeg);

        if (body.parentId && runtimeMap.has(body.parentId)) {
          runtimeMap.get(body.parentId)!.meshRoot.add(pivot);
        } else {
          scene.add(pivot);
        }

        // Orbit Path Line for Planets & Key Moons
        if (body.orbitRadius > 0 && (body.category === 'planet' || body.category === 'moon')) {
          const segs = body.category === 'planet' ? 160 : 72;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * body.orbitRadius, 0, Math.sin(a) * body.orbitRadius));
          }
          const lineGeo = trackDisposable(new THREE.BufferGeometry().setFromPoints(pts));
          const lineMat = trackDisposable(
            new THREE.LineBasicMaterial({
              color: body.category === 'planet' ? 0x38bdf8 : 0x64748b,
              transparent: true,
              opacity: body.category === 'planet' ? 0.18 : 0.14,
              depthWrite: false,
            })
          );
          orbitRingMats.push(lineMat);
          const orbitLine = new THREE.LineLoop(lineGeo, lineMat);
          pivot.add(orbitLine);
        }

        const meshRoot = new THREE.Group();
        const ax = Math.cos(body.initialAngle) * body.orbitRadius;
        const az = Math.sin(body.initialAngle) * body.orbitRadius;
        meshRoot.position.set(ax, 0, az);
        pivot.add(meshRoot);

        let spinMesh: THREE.Object3D | undefined;
        let cloudsMesh: THREE.Mesh | undefined;

        if (body.category === 'planet' || body.category === 'moon') {
          const tiltGroup = new THREE.Group();
          tiltGroup.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg);
          meshRoot.add(tiltGroup);

          const surfTex = trackDisposable(createPlanetSurfaceTexture(body.id, maxAnisotropy));
          const sphereMat = trackDisposable(
            new THREE.MeshStandardMaterial({
              map: surfTex,
              roughness:
                body.id === 'earth' || body.id === 'europa' || body.id === 'enceladus'
                  ? 0.42
                  : body.category === 'planet' && body.planetType !== 'Terrestrial Planet'
                  ? 0.65
                  : 0.85,
              metalness: body.id === 'mercury' ? 0.15 : 0.04,
            })
          );
          const sphere = new THREE.Mesh(
            trackDisposable(new THREE.SphereGeometry(body.radius, 48, 36)),
            sphereMat
          );
          if (!isSoftwareGl) {
            sphere.castShadow = true;
            sphere.receiveShadow = true;
          }
          tiltGroup.add(sphere);
          spinMesh = sphere;

          // Earth clouds + blue atmosphere
          if (body.id === 'earth') {
            const cTex = trackDisposable(createEarthCloudsTexture(maxAnisotropy));
            cloudsMesh = new THREE.Mesh(
              trackDisposable(new THREE.SphereGeometry(body.radius * 1.018, 48, 32)),
              trackDisposable(
                new THREE.MeshStandardMaterial({
                  map: cTex,
                  transparent: true,
                  opacity: 0.85,
                  roughness: 0.9,
                  depthWrite: false,
                })
              )
            );
            tiltGroup.add(cloudsMesh);
            const atmo = createAtmosphereMesh(body.radius * 1.08, 0x38bdf8, 0.85, 3.0);
            trackDisposable(atmo.geometry);
            trackDisposable(atmo.material as THREE.Material);
            atmosMats.push(atmo.material as THREE.ShaderMaterial);
            tiltGroup.add(atmo);
          } else if (body.id === 'venus') {
            const atmo = createAtmosphereMesh(body.radius * 1.08, 0xfbbf24, 0.72, 2.8);
            trackDisposable(atmo.geometry);
            trackDisposable(atmo.material as THREE.Material);
            atmosMats.push(atmo.material as THREE.ShaderMaterial);
            tiltGroup.add(atmo);
          } else if (body.id === 'mars') {
            const atmo = createAtmosphereMesh(body.radius * 1.06, 0xf97316, 0.42, 3.4);
            trackDisposable(atmo.geometry);
            trackDisposable(atmo.material as THREE.Material);
            atmosMats.push(atmo.material as THREE.ShaderMaterial);
            tiltGroup.add(atmo);
          } else if (body.id === 'titan') {
            const atmo = createAtmosphereMesh(body.radius * 1.14, 0xf59e0b, 0.78, 2.4);
            trackDisposable(atmo.geometry);
            trackDisposable(atmo.material as THREE.Material);
            atmosMats.push(atmo.material as THREE.ShaderMaterial);
            tiltGroup.add(atmo);
          } else if (body.id === 'uranus' || body.id === 'neptune') {
            const atmo = createAtmosphereMesh(
              body.radius * 1.07,
              body.id === 'uranus' ? 0x22d3ee : 0x3b82f6,
              0.55,
              3.0
            );
            trackDisposable(atmo.geometry);
            trackDisposable(atmo.material as THREE.Material);
            atmosMats.push(atmo.material as THREE.ShaderMaterial);
            tiltGroup.add(atmo);
          }

          // Saturn & Uranus Ring Planes
          if (body.id === 'saturn' || body.id === 'uranus') {
            const rInner = body.id === 'saturn' ? body.radius * 1.32 : body.radius * 1.45;
            const rOuter = body.id === 'saturn' ? body.radius * 2.48 : body.radius * 1.95;
            const ringGeo = trackDisposable(createRadialRingGeometry(rInner, rOuter, 128));
            const ringTex = trackDisposable(
              createPlanetaryRingTexture(body.id === 'saturn' ? 'saturn' : 'uranus', maxAnisotropy)
            );
            const ringMat = trackDisposable(
              new THREE.MeshStandardMaterial({
                map: ringTex,
                transparent: true,
                side: THREE.DoubleSide,
                roughness: 0.72,
                metalness: 0.05,
                depthWrite: false,
              })
            );
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            if (!isSoftwareGl) ringMesh.receiveShadow = true;
            tiltGroup.add(ringMesh);
          }
        } else if (body.id === 'asteroid_belt') {
          // Dwarf Planet Ceres hero rock in the belt
          const ceresTex = trackDisposable(createPlanetSurfaceTexture('mercury', maxAnisotropy));
          const ceres = new THREE.Mesh(
            trackDisposable(new THREE.DodecahedronGeometry(body.radius, 2)),
            trackDisposable(
              new THREE.MeshStandardMaterial({
                map: ceresTex,
                roughness: 0.9,
                metalness: 0.08,
              })
            )
          );
          meshRoot.add(ceres);
          spinMesh = ceres;
        } else if (body.id === 'comet_halley') {
          // Cometary nucleus + glowing cyan coma + ion & dust tails
          const nuc = new THREE.Mesh(
            trackDisposable(new THREE.DodecahedronGeometry(0.45, 1)),
            trackDisposable(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }))
          );
          meshRoot.add(nuc);
          const comaSprite = new THREE.Sprite(
            trackDisposable(
              new THREE.SpriteMaterial({
                map: sunGlowTex,
                color: 0x67e8f9,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              })
            )
          );
          comaSprite.scale.set(3.2, 3.2, 1);
          meshRoot.add(comaSprite);

          const ionTailGeo = trackDisposable(new THREE.ConeGeometry(0.85, 12.5, 20, 1, true));
          ionTailGeo.translate(0, 6.25, 0);
          ionTailGeo.rotateX(Math.PI / 2);
          const ionTail = new THREE.Mesh(
            ionTailGeo,
            trackDisposable(
              new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.34,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false,
              })
            )
          );
          meshRoot.add(ionTail);

          const dustTailGeo = trackDisposable(new THREE.ConeGeometry(1.3, 9.5, 20, 1, true));
          dustTailGeo.translate(0, 4.75, 0);
          dustTailGeo.rotateX(Math.PI / 2);
          const dustTail = new THREE.Mesh(
            dustTailGeo,
            trackDisposable(
              new THREE.MeshBasicMaterial({
                color: 0xfde68a,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false,
              })
            )
          );
          dustTail.rotation.y = 0.22;
          meshRoot.add(dustTail);
        } else if (body.category === 'satellite') {
          const craft = createCompositeSatellite(
            body.id === 'iss' ? 'iss' : body.id === 'jwst' ? 'jwst' : 'voyager1'
          );
          meshRoot.add(craft);
          spinMesh = craft;
        } else if (body.category === 'deep_space') {
          const isGalaxy = body.id === 'andromeda';
          const planeMat = trackDisposable(
            new THREE.MeshBasicMaterial({
              map: isGalaxy ? galaxyTex : nebTex2,
              transparent: true,
              opacity: 0.92,
              blending: THREE.AdditiveBlending,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          const plane = new THREE.Mesh(
            trackDisposable(new THREE.PlaneGeometry(body.radius * 2.8, body.radius * 2.8)),
            planeMat
          );
          plane.rotation.set(
            THREE.MathUtils.degToRad(body.axialTiltDeg),
            Math.atan2(-ax, -az),
            0.35
          );
          meshRoot.add(plane);
          spinMesh = plane;
        }

        // Generous invisible raycast collider sphere for effortless clicking
        const hitR = Math.max(body.radius * 1.45, body.category === 'satellite' ? 1.15 : 1.0);
        const hitMesh = new THREE.Mesh(
          trackDisposable(new THREE.SphereGeometry(hitR, 12, 10)),
          trackDisposable(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitMesh.userData.celestialId = body.id;
        meshRoot.add(hitMesh);
        pickables.push(hitMesh);

        const wp = new THREE.Vector3();
        meshRoot.getWorldPosition(wp);
        runtimeMap.set(body.id, {
          id: body.id,
          pivot,
          meshRoot,
          spinMesh,
          cloudsMesh,
          orbitAngle: body.initialAngle,
          worldPos: wp.clone(),
          prevWorldPos: wp.clone(),
        });
      }

      // ========= INSTANCED ASTEROID BELT (1,000 rocky asteroids) =========
      const asteroidCount = 1000;
      const asteroidGeo = trackDisposable(new THREE.DodecahedronGeometry(0.24, 0));
      const asteroidMat = trackDisposable(
        new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.88,
          metalness: 0.1,
        })
      );
      const asteroidBelt = new THREE.InstancedMesh(asteroidGeo, asteroidMat, asteroidCount);
      asteroidBelt.frustumCulled = false;
      const astTint = new THREE.Color();
      for (let i = 0; i < asteroidCount; i++) {
        const ang = (i / asteroidCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const rad = 52 + Math.random() * 8.5;
        const y = (Math.random() - 0.5) * 2.6;
        _dummyObj.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        _dummyObj.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        const sc = 0.45 + Math.random() * 1.4;
        _dummyObj.scale.set(sc, sc * (0.65 + Math.random() * 0.5), sc);
        _dummyObj.updateMatrix();
        asteroidBelt.setMatrixAt(i, _dummyObj.matrix);
        astTint.setHSL(0.08, 0.08, 0.42 + Math.random() * 0.35);
        asteroidBelt.setColorAt(i, astTint);
      }
      asteroidBelt.instanceMatrix.needsUpdate = true;
      if (asteroidBelt.instanceColor) asteroidBelt.instanceColor.needsUpdate = true;
      scene.add(asteroidBelt);

      // ========= JOURNEY & INTERACTIVE CAMERA STATE =========
      let journeyElapsed = 0;
      let lastJourneyStop = -1;
      let manualFlyActive = false;
      let overviewFlyActive = false;
      const currentLookTarget = new THREE.Vector3(0, 0, 0);

      const updateAllWorldPositions = () => {
        scene.updateMatrixWorld(true);
        for (const rt of runtimeMap.values()) {
          rt.prevWorldPos.copy(rt.worldPos);
          rt.meshRoot.getWorldPosition(rt.worldPos);
        }
      };
      updateAllWorldPositions();

      const restartJourney = () => {
        journeyElapsed = 0;
        lastJourneyStop = -1;
        manualFlyActive = false;
        overviewFlyActive = false;
        controls.enabled = false;
        camera.position.set(0, 75, 220);
        currentLookTarget.set(0, 0, 0);
        camera.lookAt(currentLookTarget);
      };

      const flyToOverview = () => {
        manualFlyActive = false;
        overviewFlyActive = true;
        callbacksRef.current.onSelectBody(null);
      };

      const focusBody = (id: string) => {
        if (!runtimeMap.has(id)) return;
        overviewFlyActive = false;
        manualFlyActive = true;
      };

      actionsRef.current = { restartJourney, flyToOverview, focusBody };

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      // Pointer raycasting for clicking 3D celestial objects
      const raycaster = new THREE.Raycaster();
      let downX = 0;
      let downY = 0;

      const handlePointerDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
        // User dragging cancels auto-fly so controls never fight the player
        if (modeRef.current === 'interactive') {
          manualFlyActive = false;
          overviewFlyActive = false;
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (modeRef.current !== 'interactive') return;
        const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (dist > 6) return;

        const rect = renderer.domElement.getBoundingClientRect();
        _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(_ndc, camera);
        const hits = raycaster.intersectObjects(pickables, false);
        if (hits.length > 0) {
          const hitId = hits[0].object.userData.celestialId as string | undefined;
          if (hitId) {
            callbacksRef.current.onSelectBody(hitId);
            manualFlyActive = true;
            overviewFlyActive = false;
          }
        }
      };

      const handleDoubleClick = (e: MouseEvent) => {
        if (modeRef.current !== 'interactive') return;
        const rect = renderer.domElement.getBoundingClientRect();
        _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(_ndc, camera);
        const hits = raycaster.intersectObjects(pickables, false);
        if (hits.length === 0) {
          flyToOverview();
        }
      };

      renderer.domElement.addEventListener('pointerdown', handlePointerDown);
      renderer.domElement.addEventListener('pointerup', handlePointerUp);
      renderer.domElement.addEventListener('dblclick', handleDoubleClick);

      const handleContextLost = (ev: Event) => {
        ev.preventDefault();
        callbacksRef.current.onWebGLFallback?.();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth || 1280;
        const h = container.clientHeight || 720;
        pipeline?.resize(w, h, camera);
      };
      window.addEventListener('resize', handleResize);

      // ========= ANIMATION LOOP =========
      let disposed = false;
      let rafId = 0;
      let timerId = 0;
      let lastTime = performance.now();

      const afterDraw = (cb: () => void) => {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            timerId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(cb, 80);
          }
        };
        timerId = window.setTimeout(poll, 5);
      };

      const totalJourneyDuration = JOURNEY_SEQUENCE_IDS.length * STOP_DURATION_SEC + 3.5;

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        const dt = Math.min(0.08, (now - lastTime) / 1000);
        lastTime = now;

        const m = modeRef.current;
        const effectiveScale =
          m === 'journey'
            ? 0.28 // Slow orbital drift during close-up planetary tour
            : m === 'click_to_start'
            ? 0.65
            : timeScaleRef.current;

        // 1. Advance Phase 1 reveal intensity (starts dark -> cosmic bloom)
        const revealRaw = m === 'journey' ? Math.min(1, journeyElapsed / INTRO_FADE_SEC) : 1;
        const starFade = Math.min(1, revealRaw * 2.2);
        const nebFade = Math.max(0, Math.min(1, (revealRaw - 0.15) * 1.8));
        const sunFade = Math.max(0, Math.min(1, (revealRaw - 0.25) * 1.8));

        starMat.opacity = starFade * 0.92;
        dustMat.opacity = nebFade * 0.42;
        nebSprites.forEach((sp, i) => {
          (sp.material as THREE.SpriteMaterial).opacity = nebFade * (i % 2 === 0 ? 0.34 : 0.28);
        });
        sunShaderMat.uniforms.uTime.value = now * 0.001;
        sunShaderMat.uniforms.uReveal.value = sunFade;
        sunCoronaMat.opacity = sunFade * 0.85;
        sunLight.intensity = sunFade * 3.4;
        ambient.intensity = sunFade * 0.35;
        hemi.intensity = sunFade * 0.28;
        flareMats.forEach((fm, idx) => {
          fm.opacity = sunFade * (0.45 + 0.25 * Math.sin(now * 0.002 + idx));
        });
        atmosMats.forEach((am) => {
          am.uniforms.uFade.value = sunFade;
        });

        // 2. Advance Orbits & Spins
        const bodyStep = dt * effectiveScale;
        for (const body of UNIVERSE_BODIES) {
          const rt = runtimeMap.get(body.id);
          if (!rt) continue;
          if (body.orbitSpeed !== 0) {
            rt.orbitAngle += body.orbitSpeed * bodyStep;
            rt.meshRoot.position.set(
              Math.cos(rt.orbitAngle) * body.orbitRadius,
              0,
              Math.sin(rt.orbitAngle) * body.orbitRadius
            );
          }
          if (rt.spinMesh && body.spinSpeed !== 0) {
            rt.spinMesh.rotation.y += body.spinSpeed * dt * Math.max(0.25, effectiveScale * 0.5);
          }
          if (rt.cloudsMesh) {
            rt.cloudsMesh.rotation.y += 0.16 * dt;
          }
        }

        // Slowly rotate asteroid belt
        asteroidBelt.rotation.y += 0.025 * bodyStep;
        cosmicDust.rotation.y += 0.005 * dt;

        updateAllWorldPositions();

        // Point comet tail radially away from Sun
        const cometRt = runtimeMap.get('comet_halley');
        if (cometRt) {
          _sunToComet.copy(cometRt.worldPos).normalize();
          cometRt.meshRoot.lookAt(
            cometRt.worldPos.x + _sunToComet.x * 10,
            cometRt.worldPos.y + _sunToComet.y * 10,
            cometRt.worldPos.z + _sunToComet.z * 10
          );
        }

        // 3. Camera Choreography per Mode
        if (m === 'journey') {
          controls.enabled = false;
          journeyElapsed += dt;

          const stopIdx = Math.floor(journeyElapsed / STOP_DURATION_SEC);
          if (stopIdx < JOURNEY_SEQUENCE_IDS.length) {
            const targetId = JOURNEY_SEQUENCE_IDS[stopIdx];
            if (stopIdx !== lastJourneyStop) {
              lastJourneyStop = stopIdx;
              callbacksRef.current.onJourneyFocusChange(
                targetId,
                stopIdx,
                JOURNEY_SEQUENCE_IDS.length
              );
            }
            const rt = runtimeMap.get(targetId)!;
            const body = getCelestialBodyById(targetId);
            const localT = (journeyElapsed % STOP_DURATION_SEC) / STOP_DURATION_SEC;

            // Smooth orbital sweep around the sunlit side of each celestial object
            if (body.category === 'deep_space') {
              _camDesired.copy(rt.worldPos).multiplyScalar(0.78);
              _camDesired.y += 14 * Math.sin(localT * 1.4);
            } else {
              const toSun = _sunToComet.copy(rt.worldPos).negate();
              const baseAngle =
                rt.worldPos.lengthSq() > 1
                  ? Math.atan2(toSun.z, toSun.x) - 0.55 + localT * 0.95
                  : now * 0.0002;
              const dist = body.focusDistance;
              _camDesired.set(
                rt.worldPos.x + Math.cos(baseAngle) * dist,
                rt.worldPos.y + dist * (0.28 + 0.1 * Math.sin(localT * Math.PI)),
                rt.worldPos.z + Math.sin(baseAngle) * dist
              );
            }
            _lookDesired.copy(rt.worldPos);

            const camLambda = journeyElapsed < 2.5 ? 1.4 : 2.3;
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, camLambda, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, camLambda, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, camLambda, dt);
            currentLookTarget.x = THREE.MathUtils.damp(currentLookTarget.x, _lookDesired.x, 3.0, dt);
            currentLookTarget.y = THREE.MathUtils.damp(currentLookTarget.y, _lookDesired.y, 3.0, dt);
            currentLookTarget.z = THREE.MathUtils.damp(currentLookTarget.z, _lookDesired.z, 3.0, dt);
            camera.lookAt(currentLookTarget);
          } else {
            // Pull back smoothly to grand wide Solar System vista
            if (lastJourneyStop !== JOURNEY_SEQUENCE_IDS.length) {
              lastJourneyStop = JOURNEY_SEQUENCE_IDS.length;
              callbacksRef.current.onJourneyFocusChange(
                null,
                JOURNEY_SEQUENCE_IDS.length,
                JOURNEY_SEQUENCE_IDS.length
              );
            }
            _camDesired.set(18, 66, 152);
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 1.8, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 1.8, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 1.8, dt);
            currentLookTarget.x = THREE.MathUtils.damp(currentLookTarget.x, 0, 2.0, dt);
            currentLookTarget.y = THREE.MathUtils.damp(currentLookTarget.y, 0, 2.0, dt);
            currentLookTarget.z = THREE.MathUtils.damp(currentLookTarget.z, 0, 2.0, dt);
            camera.lookAt(currentLookTarget);

            if (journeyElapsed >= totalJourneyDuration) {
              callbacksRef.current.onJourneyComplete();
            }
          }
        } else if (m === 'click_to_start') {
          controls.enabled = false;
          const slowAngle = now * 0.00008 + 0.85;
          _camDesired.set(Math.cos(slowAngle) * 148, 56, Math.sin(slowAngle) * 148);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 1.8, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 1.8, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 1.8, dt);
          currentLookTarget.x = THREE.MathUtils.damp(currentLookTarget.x, 0, 2.5, dt);
          currentLookTarget.y = THREE.MathUtils.damp(currentLookTarget.y, 0, 2.5, dt);
          currentLookTarget.z = THREE.MathUtils.damp(currentLookTarget.z, 0, 2.5, dt);
          camera.lookAt(currentLookTarget);
          controls.target.copy(currentLookTarget);
        } else {
          // Interactive Universe Mode
          controls.enabled = true;
          const focusId = selectedIdRef.current;
          if (focusId && runtimeMap.has(focusId)) {
            const rt = runtimeMap.get(focusId)!;
            const body = getCelestialBodyById(focusId);

            // Carry camera smoothly with moving planet/moon/satellite
            _deltaVec.copy(rt.worldPos).sub(rt.prevWorldPos);
            camera.position.add(_deltaVec);
            controls.target.add(_deltaVec);

            controls.target.x = THREE.MathUtils.damp(controls.target.x, rt.worldPos.x, 5.5, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, rt.worldPos.y, 5.5, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, rt.worldPos.z, 5.5, dt);

            if (manualFlyActive) {
              if (body.category === 'deep_space') {
                _camDesired.copy(rt.worldPos).multiplyScalar(0.8);
                _camDesired.y += 8;
              } else {
                const radial = _sunToComet.copy(rt.worldPos);
                const sunAng =
                  radial.lengthSq() > 1 ? Math.atan2(-radial.z, -radial.x) - 0.5 : 0.7;
                const fd = body.focusDistance;
                _camDesired.set(
                  rt.worldPos.x + Math.cos(sunAng) * fd,
                  rt.worldPos.y + fd * 0.34,
                  rt.worldPos.z + Math.sin(sunAng) * fd
                );
              }
              camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 3.6, dt);
              camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 3.6, dt);
              camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 3.6, dt);
              if (camera.position.distanceTo(_camDesired) < 0.25) {
                manualFlyActive = false;
              }
            }
          } else if (overviewFlyActive) {
            controls.target.x = THREE.MathUtils.damp(controls.target.x, 0, 4.0, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, 0, 4.0, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, 0, 4.0, dt);
            _camDesired.set(18, 66, 152);
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 3.0, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 3.0, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 3.0, dt);
            if (camera.position.distanceTo(_camDesired) < 0.8) {
              overviewFlyActive = false;
            }
          }
          controls.update();
        }

        // Subtle orbit ring pulse when in interactive mode
        orbitRingMats.forEach((om) => {
          om.opacity = m === 'journey' ? 0.14 : m === 'click_to_start' ? 0.22 : 0.24;
        });

        // Prevent unused warning on _upAxis
        if (_upAxis.y < 0) camera.up.copy(_upAxis);

        pipeline?.renderFrame();

        if (isSoftwareGl) afterDraw(tick);
        else rafId = requestAnimationFrame(tick);
      };

      if (isSoftwareGl) afterDraw(tick);
      else rafId = requestAnimationFrame(tick);

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
        renderer.domElement.removeEventListener('pointerup', handlePointerUp);
        renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        pipeline?.dispose();
      };
    } catch {
      callbacksRef.current.onWebGLFallback?.();
      return undefined;
    }
  }, []);

  return <div ref={mountRef} className="fixed inset-0 w-full h-full bg-[#010205]" />;
}
