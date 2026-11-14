import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Compass, Database, Eye, Fan, Globe, RotateCcw, User, Video } from 'lucide-react';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import { getPlanetById } from '../data/planets';
import {
  createAstronautMesh,
  createContactShadowTexture,
  createDataNodeMesh,
  createNasaSpaceshipMesh,
  createStormFlueMesh,
} from '../three/models';
import {
  createTerrainAndSkyGroup,
  getPlanetEnvironmentSpec,
  groundHeightAt,
} from '../three/terrain';
import type { AstronautId, MissionState, PlanetId, SuitPartId } from '../types';

export type AstronautCameraMode = 'orbit' | 'third_person' | 'first_person';

interface AstronautViewProps {
  state: MissionState;
  hudHidden?: boolean;
  onSelectAstronaut: (id: AstronautId) => void;
  onInspectStormFlue: () => void;
  onCollectDataNode: (nodeId: string) => void;
  onPerformSuitDiagnostic?: (partId: SuitPartId, astronautId: AstronautId) => void;
}

type DiagnosticKind = SuitPartId | 'storm_flue' | 'data_node';

const SUIT_PART_META: Record<
  SuitPartId,
  { label: string; shortLabel: string; action: string }
> = {
  helmet: {
    label: 'Helmet & Gold Visor',
    shortLabel: 'Helmet',
    action: 'Visor Optics & Radiation Scan (-3% Rad, +3 SCI)',
  },
  chest_pack: {
    label: 'Chest Biometrics Pack',
    shortLabel: 'Chest Pack',
    action: 'Suit Life-Support Telemetry (+3% O₂, +2% H₂O, +2 SCI)',
  },
  plss_backpack: {
    label: 'PLSS Backpack & Antenna',
    shortLabel: 'PLSS Pack',
    action: 'CO₂ Scrubber Purge & NASA Uplink (+2% O₂, +4 SCI)',
  },
  arms_tools: {
    label: 'EVA Gauntlets & Tools',
    shortLabel: 'Gauntlets',
    action: 'Actuator & Field Tool Calibration (+3 SCI)',
  },
  boots: {
    label: 'Magnetic Traction Boots',
    shortLabel: 'Boots',
    action: 'Regolith Dust Seal & Intake Sweep (-10% Flue, +2 SCI)',
  },
};

// Pre-allocated math helpers outside render loop (zero GC pressure)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _projVec = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _desiredTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _targetDelta = new THREE.Vector3();
const _fpEye = new THREE.Vector3();
const _fpLook = new THREE.Vector3();

const STAGE_SLOTS: Array<{ x: number; z: number; yaw: number }> = [
  { x: 0, z: 0.4, yaw: 0.15 },
  { x: -3.4, z: 1.6, yaw: 0.45 },
  { x: 3.4, z: 1.5, yaw: -0.45 },
  { x: -4.6, z: -2.0, yaw: 0.65 },
  { x: 4.5, z: -2.0, yaw: -0.65 },
  { x: -1.8, z: 3.1, yaw: 0.28 },
];

const FLUE_POS = { x: -3.2, z: -2.8 };
const SAMPLE_POS = { x: 3.2, z: -2.6 };
const SPACESHIP_POS = { x: 7.4, z: -5.4 };

function detectSoftwareWebGL(): boolean {
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

function findHitUserData(
  obj: THREE.Object3D | null
): {
  astronautId?: AstronautId;
  suitPart?: SuitPartId;
  interactType?: string;
} | null {
  let curr: THREE.Object3D | null = obj;
  let astronautId: AstronautId | undefined;
  let suitPart: SuitPartId | undefined;
  let interactType: string | undefined;

  while (curr) {
    if (!suitPart && curr.userData.suitPart) {
      suitPart = curr.userData.suitPart as SuitPartId;
    }
    if (!astronautId && curr.userData.astronautId) {
      astronautId = curr.userData.astronautId as AstronautId;
    }
    if (!interactType && curr.userData.interactType) {
      interactType = curr.userData.interactType as string;
    }
    curr = curr.parent;
  }

  if (!astronautId && !suitPart && !interactType) return null;
  return { astronautId, suitPart, interactType };
}

function disposeObjectTree(root: THREE.Object3D, sharedTex?: THREE.Texture) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map && std.map !== sharedTex) {
          std.map.dispose();
        }
        m.dispose();
      });
    }
  });
}

export default function AstronautView({
  state,
  hudHidden = false,
  onSelectAstronaut,
  onInspectStormFlue,
  onCollectDataNode,
  onPerformSuitDiagnostic,
}: AstronautViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [envSource, setEnvSource] = useState<'assigned' | 'outpost'>('assigned');
  const [cameraMode, setCameraMode] = useState<AstronautCameraMode>('orbit');
  const [webglFailed, setWebglFailed] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [diagnosticBanner, setDiagnosticBanner] = useState<{
    title: string;
    detail: string;
    kind: DiagnosticKind;
  } | null>(null);

  const activeAstronaut = getAstronautById(state.activeAstronautId);
  const activeWorldId: PlanetId =
    envSource === 'assigned' ? activeAstronaut.assignedWorldId : state.planetId;
  const activeWorldConfig = getPlanetById(activeWorldId);
  const activeProgress = state.crewProgress[state.activeAstronautId];
  const nextDataNode = state.dataNodes.find((n) => !n.collected) || state.dataNodes[0];

  const stateRef = useRef(state);
  const worldIdRef = useRef<PlanetId>(activeWorldId);
  const cameraModeRef = useRef<AstronautCameraMode>(cameraMode);
  stateRef.current = state;
  worldIdRef.current = activeWorldId;
  cameraModeRef.current = cameraMode;

  const callbacksRef = useRef({
    onSelectAstronaut,
    onInspectStormFlue,
    onCollectDataNode,
    onPerformSuitDiagnostic,
  });
  callbacksRef.current = {
    onSelectAstronaut,
    onInspectStormFlue,
    onCollectDataNode,
    onPerformSuitDiagnostic,
  };

  const syncWorldRef = useRef<((worldId: PlanetId) => void) | null>(null);
  const focusSelectedRef = useRef<((id: AstronautId, resetCam?: boolean) => void) | null>(null);
  const applyCameraModeRef = useRef<((mode: AstronautCameraMode) => void) | null>(null);
  const triggerDiagnosticRef = useRef<
    ((kind: DiagnosticKind, astronautId?: AstronautId) => void) | null
  >(null);

  const handleHudTrigger = (kind: DiagnosticKind) => {
    if (triggerDiagnosticRef.current) {
      triggerDiagnosticRef.current(kind, state.activeAstronautId);
      return;
    }
    if (kind === 'storm_flue') {
      onInspectStormFlue();
    } else if (kind === 'data_node') {
      const target = state.dataNodes.find((n) => !n.collected);
      if (target) onCollectDataNode(target.id);
    } else {
      onPerformSuitDiagnostic?.(kind, state.activeAstronautId);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    const isSoftwareGl = detectSoftwareWebGL();
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialSpec = getPlanetEnvironmentSpec(worldIdRef.current);
    scene.background = new THREE.Color(initialSpec.skyColor);
    scene.fog = new THREE.FogExp2(initialSpec.fogColor, initialSpec.fogDensity);

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.2,
      200
    );
    camera.position.set(2.8, 3.1, 6.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 2.6;
    controls.maxDistance = 18;
    controls.target.set(0, 1.05, 0.4);

    // Mandatory Studio Reflection Environment (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // 3-Point + Hemisphere Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialSpec.hemiSkyColor,
      initialSpec.hemiGroundColor,
      initialSpec.hemiIntensity
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(initialSpec.sunColor, initialSpec.sunIntensity);
    keyLight.position.set(10, 16, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = isSoftwareGl ? 1024 : 2048;
    keyLight.shadow.mapSize.height = isSoftwareGl ? 1024 : 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const shadowTex = createContactShadowTexture();

    // Planetary Terrain & Sky Backdrop
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);
    let terrainCleanup: (() => void) | null = null;
    let renderedWorldId: PlanetId | null = null;

    const syncWorld = (planetId: PlanetId) => {
      if (renderedWorldId === planetId) return;
      renderedWorldId = planetId;

      if (terrainCleanup) {
        terrainCleanup();
        terrainCleanup = null;
      }
      while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
      }

      const spec = getPlanetEnvironmentSpec(planetId);
      scene.background = new THREE.Color(spec.skyColor);
      scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);
      hemiLight.color.setHex(spec.hemiSkyColor);
      hemiLight.groundColor.setHex(spec.hemiGroundColor);
      hemiLight.intensity = spec.hemiIntensity;
      keyLight.color.setHex(spec.sunColor);
      keyLight.intensity = spec.sunIntensity;

      const { group, dispose } = createTerrainAndSkyGroup(planetId, maxAnisotropy);
      worldGroup.add(group);
      terrainCleanup = dispose;
    };

    // Interactive Storm Flue Vent & Planetary Data Sample Node
    const stormFlueGroup = createStormFlueMesh(shadowTex);
    stormFlueGroup.position.set(FLUE_POS.x, 0, FLUE_POS.z);
    stormFlueGroup.scale.setScalar(0.85);
    stormFlueGroup.userData.interactType = 'storm_flue';
    scene.add(stormFlueGroup);

    const dataSampleGroup = createDataNodeMesh(false, shadowTex);
    dataSampleGroup.position.set(SAMPLE_POS.x, 0, SAMPLE_POS.z);
    dataSampleGroup.userData.interactType = 'data_node';
    scene.add(dataSampleGroup);

    // NASA Expedition Spaceship with Pakistan Flag near crew work area
    const spaceshipGroup = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    spaceshipGroup.position.set(
      SPACESHIP_POS.x,
      groundHeightAt(worldIdRef.current, SPACESHIP_POS.x, SPACESHIP_POS.z),
      SPACESHIP_POS.z
    );
    spaceshipGroup.scale.setScalar(0.86);
    spaceshipGroup.rotation.y = -0.68;
    scene.add(spaceshipGroup);

    // 6 Articulated Astronauts (Sub-part picking enabled via includeHitCylinder = false)
    const crewGroup = new THREE.Group();
    scene.add(crewGroup);

    const astroEntries = ASTRONAUTS.map((profile, idx) => {
      const slot = STAGE_SLOTS[idx % STAGE_SLOTS.length];
      const mesh = createAstronautMesh(profile, shadowTex, false);
      mesh.position.set(slot.x, groundHeightAt(worldIdRef.current, slot.x, slot.z), slot.z);
      mesh.rotation.y = slot.yaw;
      crewGroup.add(mesh);
      return {
        profile,
        mesh,
        x: slot.x,
        z: slot.z,
        yaw: slot.yaw,
        walkPhase: idx * 0.9,
      };
    });

    let activeDiagnostic: {
      astronautId: AstronautId;
      kind: DiagnosticKind;
      timer: number;
      duration: number;
    } | null = null;
    let bannerTimeoutId = 0;

    const runDiagnosticAction = (kind: DiagnosticKind, targetAstroId?: AstronautId) => {
      const cur = stateRef.current;
      const astroId = targetAstroId || cur.activeAstronautId;
      const astro = getAstronautById(astroId);

      if (kind === 'storm_flue') {
        callbacksRef.current.onInspectStormFlue();
        activeDiagnostic = {
          astronautId: astroId,
          kind: 'storm_flue',
          timer: 0,
          duration: 1.9,
        };
        setDiagnosticBanner({
          kind: 'storm_flue',
          title: `${astro.name} · Storm Flue Purge`,
          detail: 'Turbine spin boosted & exhaust backpressure cleared (0% clog).',
        });
      } else if (kind === 'data_node') {
        const uncollected = cur.dataNodes.find((n) => !n.collected);
        const displayNode = uncollected || cur.dataNodes[0];
        if (uncollected) {
          callbacksRef.current.onCollectDataNode(uncollected.id);
        }
        activeDiagnostic = {
          astronautId: astroId,
          kind: 'data_node',
          timer: 0,
          duration: 1.9,
        };
        setDiagnosticBanner({
          kind: 'data_node',
          title: `${astro.name} · ${displayNode?.label || 'Data Node'} Scan`,
          detail: uncollected
            ? `Spectrometer logged ${uncollected.reading} (+${uncollected.scienceValue} SCI).`
            : `Node already archived — running telemetry verification sweep.`,
        });
      } else {
        const meta = SUIT_PART_META[kind];
        if (astroId !== cur.activeAstronautId) {
          callbacksRef.current.onSelectAstronaut(astroId);
        }
        callbacksRef.current.onPerformSuitDiagnostic?.(kind, astroId);
        focusSelected(astroId, false);
        activeDiagnostic = {
          astronautId: astroId,
          kind,
          timer: 0,
          duration: 1.85,
        };
        setDiagnosticBanner({
          kind,
          title: `${astro.name} · ${meta.label}`,
          detail: meta.action,
        });
      }

      window.clearTimeout(bannerTimeoutId);
      bannerTimeoutId = window.setTimeout(() => {
        setDiagnosticBanner(null);
      }, 4800);
    };

    triggerDiagnosticRef.current = runDiagnosticAction;

    // Smooth camera state (Orbit, Third-Person Chase, and First-Person Visor POV)
    let isGliding = false;
    const glideTarget = new THREE.Vector3(0, 1.05, 0.4);
    const glideCamOffset = new THREE.Vector3(2.8, 2.05, 5.8);
    let fpYaw = 0.15;
    let fpPitch = -0.05;
    let isFpDragging = false;
    let fpLastPointer = { x: 0, y: 0 };

    const focusSelected = (id: AstronautId, resetCam = false) => {
      const found = astroEntries.find((e) => e.profile.id === id);
      if (!found) return;
      const gy = groundHeightAt(worldIdRef.current, found.x, found.z);
      const mode = cameraModeRef.current;

      if (mode === 'first_person') {
        astroEntries.forEach((e) => {
          e.mesh.visible = e.profile.id !== id;
        });
        fpYaw = found.yaw;
        fpPitch = -0.05;
        camera.position.set(
          found.x + Math.sin(fpYaw) * 0.14,
          gy + 1.56,
          found.z + Math.cos(fpYaw) * 0.14
        );
        isGliding = false;
        return;
      }

      astroEntries.forEach((e) => {
        e.mesh.visible = true;
      });

      if (mode === 'third_person') {
        glideTarget.set(
          found.x + Math.sin(found.yaw) * 0.85,
          gy + 1.38,
          found.z + Math.cos(found.yaw) * 0.85
        );
        if (resetCam) {
          glideCamOffset.set(
            -Math.sin(found.yaw) * 3.5 + Math.cos(found.yaw) * 0.55,
            0.78,
            -Math.cos(found.yaw) * 3.5 - Math.sin(found.yaw) * 0.55
          );
        }
        isGliding = true;
        return;
      }

      glideTarget.set(found.x, gy + 1.05, found.z);
      if (resetCam) {
        glideCamOffset.set(2.8, 2.05, 5.8);
      }
      isGliding = true;
    };

    const applyCameraMode = (mode: AstronautCameraMode) => {
      const targetFov = mode === 'first_person' ? 60 : 46;
      if (camera.fov !== targetFov) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      if (mode === 'first_person') {
        controls.enabled = false;
        isGliding = false;
      } else if (mode === 'third_person') {
        controls.enabled = true;
        controls.minDistance = 2.0;
        controls.maxDistance = 8.0;
      } else {
        controls.enabled = true;
        controls.minDistance = 2.6;
        controls.maxDistance = 18;
      }

      focusSelected(stateRef.current.activeAstronautId, true);
    };

    controls.addEventListener('start', () => {
      isGliding = false;
    });

    syncWorld(worldIdRef.current);
    applyCameraMode(cameraModeRef.current);

    syncWorldRef.current = syncWorld;
    focusSelectedRef.current = focusSelected;
    applyCameraModeRef.current = applyCameraMode;

    // Pre-compile shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Keyboard WASD/Arrow movement & [E] Hand-Work action for active astronaut
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keys.add(e.code);
      if (e.code === 'KeyE' && !e.repeat) {
        const curActive =
          astroEntries.find((ent) => ent.profile.id === stateRef.current.activeAstronautId) ||
          astroEntries[0];
        const flueDist = Math.hypot(curActive.x - FLUE_POS.x, curActive.z - FLUE_POS.z);
        const sampleDist = Math.hypot(curActive.x - SAMPLE_POS.x, curActive.z - SAMPLE_POS.z);
        if (flueDist < 3.8) {
          runDiagnosticAction('storm_flue', curActive.profile.id);
        } else if (sampleDist < 3.8) {
          runDiagnosticAction('data_node', curActive.profile.id);
        } else {
          runDiagnosticAction('arms_tools', curActive.profile.id);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Raycast clicking & throttled hover on suit parts, storm flue, and data sample
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;
    let lastHoverLabel: string | null = null;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (cameraModeRef.current === 'first_person') {
        isFpDragging = true;
        fpLastPointer = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (cameraModeRef.current === 'first_person' && isFpDragging) {
        const dx = e.clientX - fpLastPointer.x;
        const dy = e.clientY - fpLastPointer.y;
        fpLastPointer = { x: e.clientX, y: e.clientY };
        fpYaw -= dx * 0.0055;
        fpPitch = THREE.MathUtils.clamp(fpPitch - dy * 0.0045, -1.05, 1.05);
      }

      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        [crewGroup, stormFlueGroup, dataSampleGroup],
        true
      );

      let nextLabel: string | null = null;
      if (hits.length > 0) {
        const hitData = findHitUserData(hits[0].object);
        const ignoreSelfInFp =
          cameraModeRef.current === 'first_person' &&
          hitData?.astronautId === stateRef.current.activeAstronautId;
        if (!ignoreSelfInFp) {
          if (hitData?.suitPart && hitData.astronautId) {
            const astro = getAstronautById(hitData.astronautId);
            nextLabel = `${astro.name}: ${SUIT_PART_META[hitData.suitPart].label}`;
          } else if (hitData?.astronautId) {
            const astro = getAstronautById(hitData.astronautId);
            nextLabel = `${astro.name} (${astro.role})`;
          } else if (hitData?.interactType === 'storm_flue') {
            nextLabel = 'Storm Flue Exhaust (Click to Clear)';
          } else if (hitData?.interactType === 'data_node') {
            nextLabel = 'Planetary Data Node (Click to Scan)';
          }
        }
      }

      if (nextLabel !== lastHoverLabel) {
        lastHoverLabel = nextLabel;
        renderer.domElement.style.cursor = nextLabel ? 'pointer' : 'grab';
        setHoveredInfo(nextLabel);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      isFpDragging = false;
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        [crewGroup, stormFlueGroup, dataSampleGroup],
        true
      );
      if (hits.length === 0) return;

      const hitData = findHitUserData(hits[0].object);
      if (!hitData) return;
      if (
        cameraModeRef.current === 'first_person' &&
        hitData.astronautId === stateRef.current.activeAstronautId
      ) {
        return;
      }

      if (hitData.suitPart && hitData.astronautId) {
        runDiagnosticAction(hitData.suitPart, hitData.astronautId);
      } else if (hitData.astronautId) {
        callbacksRef.current.onSelectAstronaut(hitData.astronautId);
        focusSelected(hitData.astronautId, false);
      } else if (hitData.interactType === 'storm_flue') {
        runDiagnosticAction('storm_flue', stateRef.current.activeAstronautId);
      } else if (hitData.interactType === 'data_node') {
        runDiagnosticAction('data_node', stateRef.current.activeAstronautId);
      }
    };

    const onPointerCancel = () => {
      isFpDragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    const handleResize = () => {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Context loss & recovery safety
    let disposed = false;
    let contextLost = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
    };
    const onContextRestored = () => {
      contextLost = false;
      lastTime = performance.now();
      scheduleNextTick();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const afterDraw = (cb: () => void) => {
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          const poll = () => {
            if (disposed || contextLost) {
              gl.deleteSync(sync);
              return;
            }
            const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (status === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      }
      frameId = window.setTimeout(cb, 80);
    };

    const scheduleNextTick = () => {
      if (disposed || contextLost) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const projectLabel = (
      key: string,
      wx: number,
      wy: number,
      wz: number,
      w: number,
      h: number
    ) => {
      const el = labelRefs.current[key];
      if (!el) return;
      _projVec.set(wx, wy, wz).project(camera);
      if (_projVec.z > 1 || _projVec.z < -1) {
        el.style.opacity = '0';
        return;
      }
      const sx = (_projVec.x * 0.5 + 0.5) * w;
      const sy = (-_projVec.y * 0.5 + 0.5) * h;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    };

    const tick = () => {
      if (disposed || contextLost) return;

      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      const curState = stateRef.current;
      const activeId = curState.activeAstronautId;
      const worldId = worldIdRef.current;

      // Move active astronaut with WASD / Arrow keys
      let fwd = 0;
      let right = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) right += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) right -= 1;

      const activeEntry = astroEntries.find((e) => e.profile.id === activeId) || astroEntries[0];

      // Advance active procedural diagnostic animation
      let diagProgress = 0;
      let diagEnvelope = 0;
      if (activeDiagnostic) {
        activeDiagnostic.timer += dt;
        diagProgress = Math.min(1, activeDiagnostic.timer / activeDiagnostic.duration);
        diagEnvelope = Math.sin(diagProgress * Math.PI);
        if (activeDiagnostic.timer >= activeDiagnostic.duration) {
          activeDiagnostic = null;
        }
      }

      const curCameraMode = cameraModeRef.current;
      let activeMoving = false;

      astroEntries.forEach((entry, idx) => {
        const isSelected = entry.profile.id === activeId;
        let moving = false;

        if (curCameraMode === 'first_person') {
          entry.mesh.visible = !isSelected;
          if (isSelected) {
            entry.yaw = fpYaw;
          }
        } else {
          entry.mesh.visible = true;
        }

        if (isSelected && (Math.abs(fwd) > 0.01 || Math.abs(right) > 0.01)) {
          isGliding = false;
          if (curCameraMode === 'first_person') {
            _forward.set(Math.sin(fpYaw), 0, Math.cos(fpYaw)).normalize();
          } else {
            camera.getWorldDirection(_forward);
            _forward.y = 0;
            if (_forward.lengthSq() < 0.0001) _forward.set(0, 0, -1);
            _forward.normalize();
          }
          _right.crossVectors(_forward, _upAxis).normalize();

          _moveDir.set(0, 0, 0).addScaledVector(_forward, fwd).addScaledVector(_right, right);
          if (_moveDir.lengthSq() > 0.001) {
            _moveDir.normalize();
            const speed = 4.8;
            entry.x = THREE.MathUtils.clamp(entry.x + _moveDir.x * speed * dt, -14, 14);
            entry.z = THREE.MathUtils.clamp(entry.z + _moveDir.z * speed * dt, -14, 14);

            if (curCameraMode !== 'first_person') {
              const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
              let diff = targetYaw - entry.yaw;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              entry.yaw += diff * Math.min(1, dt * 12);
            }
            moving = true;
            activeMoving = true;
          }
        }

        const gy = groundHeightAt(worldId, entry.x, entry.z);
        let posY = gy;
        let renderYaw = entry.yaw;

        const isDiagTarget =
          activeDiagnostic && activeDiagnostic.astronautId === entry.profile.id;
        const refs = entry.mesh.userData.animRefs;

        if (refs) {
          refs.selectionRing.visible = isSelected;

          // Base locomotion / idle pose
          if (moving) {
            entry.walkPhase += dt * 10;
            const swing = Math.sin(entry.walkPhase) * 0.55;
            refs.leftLeg.rotation.x = swing;
            refs.rightLeg.rotation.x = -swing;
            refs.leftArm.rotation.x = -swing * 0.75;
            refs.rightArm.rotation.x = swing * 0.75;
            refs.leftArm.rotation.z = THREE.MathUtils.damp(refs.leftArm.rotation.z, 0, 8, dt);
            refs.rightArm.rotation.z = THREE.MathUtils.damp(refs.rightArm.rotation.z, 0, 8, dt);
          } else {
            const idle = Math.sin(elapsed * 1.6 + idx * 1.2) * 0.05;
            refs.leftLeg.rotation.x *= 0.85;
            refs.rightLeg.rotation.x *= 0.85;
            refs.leftArm.rotation.x = THREE.MathUtils.damp(refs.leftArm.rotation.x, idle, 8, dt);
            refs.rightArm.rotation.x = THREE.MathUtils.damp(refs.rightArm.rotation.x, -idle, 8, dt);
            refs.leftArm.rotation.z = THREE.MathUtils.damp(refs.leftArm.rotation.z, 0, 8, dt);
            refs.rightArm.rotation.z = THREE.MathUtils.damp(refs.rightArm.rotation.z, 0, 8, dt);
          }

          // Smooth defaults for neck and emissive readouts
          let targetHeadY = 0;
          let targetHeadX = 0;
          let targetVisorGlow = 0.12;
          let targetChestGlow = 0.28;
          let targetBeaconGlow = 0.9;

          if (isDiagTarget && activeDiagnostic) {
            const kind = activeDiagnostic.kind;
            if (kind === 'helmet') {
              targetHeadY = Math.sin(diagProgress * Math.PI * 3) * 0.65 * diagEnvelope;
              targetHeadX = Math.sin(diagProgress * Math.PI * 2) * 0.16 * diagEnvelope;
              targetVisorGlow =
                0.12 + 0.9 * Math.abs(Math.sin(diagProgress * Math.PI * 4)) * diagEnvelope;
            } else if (kind === 'chest_pack') {
              refs.rightArm.rotation.x = -1.18 * diagEnvelope;
              refs.rightArm.rotation.z = -0.34 * diagEnvelope;
              targetHeadX = 0.24 * diagEnvelope;
              targetChestGlow = 0.28 + 1.45 * diagEnvelope;
            } else if (kind === 'plss_backpack') {
              renderYaw += diagEnvelope * 2.65;
              targetBeaconGlow =
                0.9 + 2.4 * Math.abs(Math.sin(diagProgress * Math.PI * 5)) * diagEnvelope;
            } else if (kind === 'arms_tools') {
              const strokeL = Math.sin(diagProgress * Math.PI * 6) * 0.42;
              const strokeR = Math.cos(diagProgress * Math.PI * 6) * 0.42;
              refs.leftArm.rotation.x = (-1.15 + strokeL) * diagEnvelope;
              refs.rightArm.rotation.x = (-1.2 + strokeR) * diagEnvelope;
              refs.leftArm.rotation.z =
                (0.24 + Math.sin(diagProgress * Math.PI * 4) * 0.1) * diagEnvelope;
              refs.rightArm.rotation.z =
                (-0.24 - Math.cos(diagProgress * Math.PI * 4) * 0.1) * diagEnvelope;
              targetHeadX = 0.22 * diagEnvelope;
              targetHeadY = Math.sin(diagProgress * Math.PI * 3) * 0.15 * diagEnvelope;
              targetChestGlow = 0.28 + 1.15 * diagEnvelope;
            } else if (kind === 'boots') {
              posY += Math.sin(diagProgress * Math.PI) * 0.34;
              const stomp = Math.sin(diagProgress * Math.PI * 4) * 0.58 * diagEnvelope;
              refs.leftLeg.rotation.x = stomp;
              refs.rightLeg.rotation.x = -stomp;
            } else if (kind === 'storm_flue') {
              const targetAngle = Math.atan2(FLUE_POS.x - entry.x, FLUE_POS.z - entry.z);
              renderYaw = THREE.MathUtils.lerp(entry.yaw, targetAngle, diagEnvelope);
              const strokeL = Math.sin(diagProgress * Math.PI * 6) * 0.35;
              const strokeR = Math.cos(diagProgress * Math.PI * 6) * 0.35;
              refs.leftArm.rotation.x = (-1.05 + strokeL) * diagEnvelope;
              refs.rightArm.rotation.x = (-1.25 + strokeR) * diagEnvelope;
              refs.leftArm.rotation.z = 0.2 * diagEnvelope;
              refs.rightArm.rotation.z = -0.2 * diagEnvelope;
              targetHeadX = 0.18 * diagEnvelope;
              targetChestGlow = 0.28 + 1.1 * diagEnvelope;
            } else if (kind === 'data_node') {
              const targetAngle = Math.atan2(SAMPLE_POS.x - entry.x, SAMPLE_POS.z - entry.z);
              renderYaw = THREE.MathUtils.lerp(entry.yaw, targetAngle, diagEnvelope);
              const strokeL = Math.sin(diagProgress * Math.PI * 5) * 0.32;
              const strokeR = Math.cos(diagProgress * Math.PI * 5) * 0.32;
              refs.leftArm.rotation.x = (-1.1 + strokeL) * diagEnvelope;
              refs.rightArm.rotation.x = (-1.05 + strokeR) * diagEnvelope;
              refs.leftArm.rotation.z = 0.22 * diagEnvelope;
              refs.rightArm.rotation.z = -0.22 * diagEnvelope;
              targetHeadX = 0.2 * diagEnvelope;
              targetVisorGlow = 0.12 + 0.75 * diagEnvelope;
            }
          }

          if (refs.headPivot) {
            refs.headPivot.rotation.y = THREE.MathUtils.damp(
              refs.headPivot.rotation.y,
              targetHeadY,
              10,
              dt
            );
            refs.headPivot.rotation.x = THREE.MathUtils.damp(
              refs.headPivot.rotation.x,
              targetHeadX,
              10,
              dt
            );
          }
          if (refs.visorMat) {
            refs.visorMat.emissiveIntensity = THREE.MathUtils.damp(
              refs.visorMat.emissiveIntensity,
              targetVisorGlow,
              12,
              dt
            );
          }
          if (refs.chestDisplayMat) {
            refs.chestDisplayMat.emissiveIntensity = THREE.MathUtils.damp(
              refs.chestDisplayMat.emissiveIntensity,
              targetChestGlow,
              12,
              dt
            );
          }
          if (refs.beaconMat) {
            refs.beaconMat.emissiveIntensity = THREE.MathUtils.damp(
              refs.beaconMat.emissiveIntensity,
              targetBeaconGlow,
              12,
              dt
            );
          }
        }

        entry.mesh.position.set(entry.x, posY, entry.z);
        entry.mesh.rotation.y = renderYaw;
      });

      // Ground & animate Storm Flue and Planetary Data Sample
      const flueY = groundHeightAt(worldId, FLUE_POS.x, FLUE_POS.z);
      stormFlueGroup.position.set(FLUE_POS.x, flueY, FLUE_POS.z);
      const flueRefs = stormFlueGroup.userData.stormFlueRefs;
      if (flueRefs) {
        const flueBoost =
          activeDiagnostic?.kind === 'storm_flue' ? 7.5 * diagEnvelope : 0;
        const spin =
          Math.max(0.5, 5.2 * (1 - curState.stormFlue.cloggedPct / 110)) + flueBoost;
        flueRefs.fanGroup.rotation.y += dt * spin;
        const hex =
          activeDiagnostic?.kind === 'storm_flue'
            ? 0x38bdf8
            : curState.stormFlue.status === 'critical'
            ? 0xef4444
            : curState.stormFlue.status === 'warning'
            ? 0xf59e0b
            : 0x10b981;
        flueRefs.beaconMat.color.setHex(hex);
        flueRefs.beaconMat.emissive.setHex(hex);
        flueRefs.beaconMat.emissiveIntensity =
          activeDiagnostic?.kind === 'storm_flue' ? 1.1 + 1.6 * diagEnvelope : 1.1;
      }

      const sampleY = groundHeightAt(worldId, SAMPLE_POS.x, SAMPLE_POS.z);
      dataSampleGroup.position.set(SAMPLE_POS.x, sampleY, SAMPLE_POS.z);
      const nodeRefs = dataSampleGroup.userData.nodeRefs;
      if (nodeRefs) {
        const nodeBoost =
          activeDiagnostic?.kind === 'data_node' ? 6.8 * diagEnvelope : 0;
        nodeRefs.scanRing.rotation.y += dt * (1.4 + nodeBoost);
        nodeRefs.scanRing.rotation.x = THREE.MathUtils.damp(
          nodeRefs.scanRing.rotation.x,
          activeDiagnostic?.kind === 'data_node'
            ? Math.sin(diagProgress * Math.PI * 2) * 0.45 * diagEnvelope
            : 0,
          10,
          dt
        );
        const anyRemaining = curState.dataNodes.some((n) => !n.collected);
        const nodeColor =
          activeDiagnostic?.kind === 'data_node'
            ? 0x34d399
            : anyRemaining
            ? 0x38bdf8
            : 0x10b981;
        nodeRefs.ringMat.color.setHex(nodeColor);
        nodeRefs.ringMat.emissive.setHex(nodeColor);
      }

      const shipY = groundHeightAt(worldId, SPACESHIP_POS.x, SPACESHIP_POS.z);
      spaceshipGroup.position.set(SPACESHIP_POS.x, shipY, SPACESHIP_POS.z);
      const shipRefs = spaceshipGroup.userData.spaceshipRefs;
      if (shipRefs) {
        shipRefs.beaconMat.emissiveIntensity = 0.75 + 0.65 * Math.sin(elapsed * 3.1);
      }

      // Camera mode positioning: First-Person Visor POV vs Third-Person Chase vs Orbit
      if (curCameraMode === 'first_person') {
        const bob = activeMoving ? Math.sin(activeEntry.walkPhase * 2) * 0.03 : 0;
        _fpEye.set(
          activeEntry.x + Math.sin(fpYaw) * 0.14,
          activeEntry.mesh.position.y + 1.56 + bob,
          activeEntry.z + Math.cos(fpYaw) * 0.14
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _fpEye.x, 18, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _fpEye.y, 18, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _fpEye.z, 18, dt);

        _fpLook.set(
          camera.position.x + Math.sin(fpYaw) * Math.cos(fpPitch) * 6,
          camera.position.y + Math.sin(fpPitch) * 6,
          camera.position.z + Math.cos(fpYaw) * Math.cos(fpPitch) * 6
        );
        camera.lookAt(_fpLook);
      } else {
        if (isGliding) {
          _desiredTarget.copy(glideTarget);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredTarget.x, 6, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredTarget.y, 6, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredTarget.z, 6, dt);

          _desiredCamPos.copy(glideTarget).add(glideCamOffset);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 5, dt);

          if (
            controls.target.distanceTo(_desiredTarget) < 0.03 &&
            camera.position.distanceTo(_desiredCamPos) < 0.05
          ) {
            isGliding = false;
          }
        } else if (curCameraMode === 'third_person' || Math.abs(fwd) > 0.01 || Math.abs(right) > 0.01) {
          const gy = activeEntry.mesh.position.y;
          const focusY = curCameraMode === 'third_person' ? gy + 1.38 : gy + 1.05;
          const ahead = curCameraMode === 'third_person' ? 0.65 : 0;
          _desiredTarget.set(
            activeEntry.x + Math.sin(activeEntry.yaw) * ahead,
            focusY,
            activeEntry.z + Math.cos(activeEntry.yaw) * ahead
          );
          _targetDelta.subVectors(_desiredTarget, controls.target).multiplyScalar(Math.min(1, dt * 8));
          controls.target.add(_targetDelta);
          camera.position.add(_targetDelta);
        }

        controls.update();
      }

      renderer.render(scene, camera);

      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      astroEntries.forEach((entry) => {
        if (curCameraMode === 'first_person' && entry.profile.id === activeId) {
          const selfEl = labelRefs.current[`av-astro-${entry.profile.id}`];
          if (selfEl) selfEl.style.opacity = '0';
          return;
        }
        projectLabel(
          `av-astro-${entry.profile.id}`,
          entry.x,
          entry.mesh.position.y + 2.15,
          entry.z,
          w,
          h
        );
      });
      projectLabel('av-flue', FLUE_POS.x, flueY + 3.55, FLUE_POS.z, w, h);
      projectLabel('av-sample', SAMPLE_POS.x, sampleY + 2.2, SAMPLE_POS.z, w, h);
      projectLabel('av-spaceship', SPACESHIP_POS.x, shipY + 4.95, SPACESHIP_POS.z, w, h);

      scheduleNextTick();
    };

    scheduleNextTick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.clearTimeout(bannerTimeoutId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();
      if (terrainCleanup) terrainCleanup();
      disposeObjectTree(crewGroup, shadowTex);
      disposeObjectTree(stormFlueGroup, shadowTex);
      disposeObjectTree(dataSampleGroup, shadowTex);
      disposeObjectTree(spaceshipGroup, shadowTex);
      shadowTex.dispose();
      envRT.dispose();
      roomEnv.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    syncWorldRef.current?.(activeWorldId);
  }, [activeWorldId]);

  useEffect(() => {
    focusSelectedRef.current?.(state.activeAstronautId, false);
  }, [state.activeAstronautId]);

  useEffect(() => {
    applyCameraModeRef.current?.(cameraMode);
  }, [cameraMode]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05070C] select-none">
      {webglFailed ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#07090E]">
          <Compass className="w-12 h-12 text-sky-400 mb-3" />
          <h2 className="font-display text-2xl font-bold text-white mb-1">
            {activeAstronaut.name} · {activeAstronaut.role}
          </h2>
          <p className="text-sm text-slate-300 max-w-md mb-4">{activeAstronaut.taskDescription}</p>
          <div className="text-xs font-mono text-slate-400">
            WebGL unavailable — use the astronaut switcher below to manage crew tasks.
          </div>
        </div>
      ) : (
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      )}

      {/* Projected 3D Crew & Equipment Labels */}
      {!webglFailed && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {ASTRONAUTS.map((astro) => {
            const isSelected = astro.id === state.activeAstronautId;
            return (
              <div
                key={astro.id}
                ref={(el) => {
                  labelRefs.current[`av-astro-${astro.id}`] = el;
                }}
                style={{ opacity: 0 }}
                className={`absolute top-0 left-0 px-2.5 py-0.5 rounded border text-[11px] font-mono whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#0F1623]/95 border-sky-400 text-white font-bold'
                    : 'bg-[#07090E]/90 border-slate-700 text-slate-200'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: astro.suitColor }}
                />
                {astro.name}
                {isSelected ? ' · Controlling' : ' · Click to Control'}
              </div>
            );
          })}

          <div
            ref={(el) => {
              labelRefs.current['av-flue'] = el;
            }}
            style={{ opacity: 0 }}
            className="absolute top-0 left-0 px-2 py-0.5 rounded border border-amber-500/60 bg-[#07090E]/90 text-[10px] font-mono text-amber-300 whitespace-nowrap"
          >
            Storm Flue · {state.stormFlue.cloggedPct}% Clog
          </div>

          <div
            ref={(el) => {
              labelRefs.current['av-sample'] = el;
            }}
            style={{ opacity: 0 }}
            className="absolute top-0 left-0 px-2 py-0.5 rounded border border-sky-500/60 bg-[#0F1623]/90 text-[10px] font-mono text-sky-300 whitespace-nowrap"
          >
            {nextDataNode?.collected ? '✓ ' : '◆ '}
            {nextDataNode?.label || 'Planetary Data'}
          </div>

          <div
            ref={(el) => {
              labelRefs.current['av-spaceship'] = el;
            }}
            style={{ opacity: 0 }}
            className="absolute top-0 left-0 px-2 py-0.5 rounded border border-emerald-500/60 bg-[#07090E]/90 text-[10px] font-mono text-emerald-300 whitespace-nowrap"
          >
            NASA Starship
          </div>
        </div>
      )}

      {/* First-Person EVA Helmet Visor Framing & Reticle */}
      {!webglFailed && cameraMode === 'first_person' && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-4 border border-amber-400/20 rounded-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
            <span className="w-3 h-[1px] bg-sky-300/75" />
            <span className="absolute h-3 w-[1px] bg-sky-300/75" />
          </div>
        </div>
      )}

      {/* Minimal Top-Left Selected Astronaut Spec Badge (Unobtrusive, No Backdrop Blur) */}
      {!hudHidden && (
        <div className="absolute top-14 left-4 z-10 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-[#0F1623]/94 border border-slate-800 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeAstronaut.suitColor }}
              />
              <span className="font-display font-bold text-white text-sm truncate">
                {activeAstronaut.name}
              </span>
              <span className="text-[11px] font-mono text-slate-400 truncate">
                · {activeWorldConfig.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => applyCameraModeRef.current?.(cameraMode)}
              title="Reset Camera View"
              className="p-1 rounded bg-[#07090E] border border-slate-700 hover:border-sky-400 text-slate-300 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[11px] text-sky-300 truncate mb-2">
            {activeAstronaut.role} · {activeProgress?.tasksCompleted || 0} tasks
          </div>

          {/* Camera Perspective Selector: Orbit / 3rd Person / 1st Person */}
          <div className="grid grid-cols-3 gap-1 bg-[#07090E] border border-slate-800 rounded-lg p-0.5 mb-2">
            {(
              [
                { id: 'orbit', label: 'Orbit', Icon: Video },
                { id: 'third_person', label: '3rd Person', Icon: User },
                { id: 'first_person', label: '1st Person', Icon: Eye },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCameraMode(id)}
                className={`px-2 py-1 rounded text-[10px] font-mono flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                  cameraMode === id
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Clickable 3D Suit Part Diagnostic Strip */}
          <div className="mb-2 pt-1.5 border-t border-slate-800/90">
            <div className="text-[10px] font-mono text-slate-400 mb-1 truncate">
              {hoveredInfo ? `Target: ${hoveredInfo}` : 'Suit Diagnostics (Click 3D Suit or Buttons)'}
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SUIT_PART_META) as SuitPartId[]).map((partId) => (
                <button
                  key={partId}
                  type="button"
                  onClick={() => handleHudTrigger(partId)}
                  title={SUIT_PART_META[partId].action}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                    diagnosticBanner?.kind === partId
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                      : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {SUIT_PART_META[partId].shortLabel}
                </button>
              ))}
            </div>
          </div>

          {diagnosticBanner && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-sky-950/60 border border-sky-500/50 text-[11px]">
              <div className="font-semibold text-sky-200 truncate">
                {diagnosticBanner.title}
              </div>
              <div className="text-slate-300 leading-snug">{diagnosticBanner.detail}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() =>
                setEnvSource((prev) => (prev === 'assigned' ? 'outpost' : 'assigned'))
              }
              className="px-2 py-1 rounded bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Globe className="w-3 h-3 text-sky-400" />
              {envSource === 'assigned' ? activeWorldConfig.name : state.planetName}
            </button>

            <button
              type="button"
              onClick={() => handleHudTrigger('storm_flue')}
              className="px-2 py-1 rounded bg-[#07090E] hover:bg-slate-800 border border-amber-500/40 text-amber-200 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Fan className="w-3 h-3 text-amber-400" />
              Flue ({state.stormFlue.cloggedPct}%)
            </button>

            {nextDataNode && !nextDataNode.collected && (
              <button
                type="button"
                onClick={() => handleHudTrigger('data_node')}
                className="px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Database className="w-3 h-3" />
                +{nextDataNode.scienceValue} SCI
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
