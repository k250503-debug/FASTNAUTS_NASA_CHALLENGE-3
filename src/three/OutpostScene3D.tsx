import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import type { AstronautId, MissionState, PlanetId } from '../types';
import {
  createAstronautMesh,
  createBuildingMesh,
  createContactShadowTexture,
  createDataNodeMesh,
  createNasaSpaceshipMesh,
  createRoverMesh,
  createSolarGridTexture,
  createStormFlueMesh,
} from './models';
import {
  createTerrainAndSkyGroup,
  getPlanetEnvironmentSpec,
  groundHeightAt,
} from './terrain';

export interface NearbyTarget {
  kind: 'storm_flue' | 'data_node' | 'building';
  id: string;
  label: string;
  sublabel: string;
  actionLabel: string;
}

interface OutpostScene3DProps {
  state: MissionState;
  cameraMode: 'follow' | 'overview';
  onProximityChange: (target: NearbyTarget | null) => void;
  onSelectAstronaut: (id: AstronautId) => void;
  onSelectBuilding: (uid: string) => void;
  onServiceBuilding: (uid: string) => void;
  onInteractStormFlue: () => void;
  onCollectDataNode: (nodeId: string) => void;
  onFieldWork?: () => void;
  interactRef: React.MutableRefObject<(() => void) | null>;
  virtualMoveRef?: React.MutableRefObject<{ forward: number; right: number }>;
}

// Pre-allocated math helpers outside the render loop to prevent GC pressure
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetDelta = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _pointerNdc = new THREE.Vector2();

const STORM_FLUE_POS = { x: 0, z: 6.2 };
const SPACESHIP_POS = { x: 10.6, z: 3.4 };

export function getBuildingWorldPos(cellIndex: number): { x: number; z: number } {
  const col = cellIndex % 4;
  const row = Math.floor(cellIndex / 4);
  return {
    x: (col - 1.5) * 3.8,
    z: (row - 1) * 3.8 - 1.5,
  };
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugExt) return false;
    const rendererStr = String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return true;
  }
}

function findUserDataInAncestors(
  obj: THREE.Object3D | null
): {
  astronautId?: AstronautId;
  buildingUid?: string;
  interactType?: string;
  dataNodeId?: string;
} | null {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (
      curr.userData.astronautId ||
      curr.userData.buildingUid ||
      curr.userData.interactType ||
      curr.userData.dataNodeId
    ) {
      return curr.userData;
    }
    curr = curr.parent;
  }
  return null;
}

export default function OutpostScene3D({
  state,
  cameraMode,
  onProximityChange,
  onSelectAstronaut,
  onSelectBuilding,
  onServiceBuilding,
  onInteractStormFlue,
  onCollectDataNode,
  onFieldWork,
  interactRef,
  virtualMoveRef,
}: OutpostScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stateRef = useRef(state);
  const cameraModeRef = useRef(cameraMode);

  stateRef.current = state;
  cameraModeRef.current = cameraMode;

  const callbacksRef = useRef({
    onProximityChange,
    onSelectAstronaut,
    onSelectBuilding,
    onServiceBuilding,
    onInteractStormFlue,
    onCollectDataNode,
    onFieldWork,
  });
  callbacksRef.current = {
    onProximityChange,
    onSelectAstronaut,
    onSelectBuilding,
    onServiceBuilding,
    onInteractStormFlue,
    onCollectDataNode,
    onFieldWork,
  };

  // Persistent mutable scene synchronization hooks
  const syncActionsRef = useRef<{
    syncPlanet: (planetId: PlanetId) => void;
    syncBuildings: () => void;
    syncDataNodes: () => void;
    focusAstronaut: (id: AstronautId) => void;
  } | null>(null);

  const nearbyTargetRef = useRef<NearbyTarget | null>(null);
  const triggerWorkAnimRef = useRef<
    ((kind: NearbyTarget['kind'] | 'field_work', targetX?: number, targetZ?: number) => void) | null
  >(null);

  // Trigger proximity interaction & hand-work animation from keyboard [E] or HUD button
  const triggerNearbyInteract = () => {
    const target = nearbyTargetRef.current;
    if (!target) {
      triggerWorkAnimRef.current?.('field_work');
      callbacksRef.current.onFieldWork?.();
      return;
    }

    let tx: number | undefined;
    let tz: number | undefined;
    if (target.kind === 'storm_flue') {
      tx = STORM_FLUE_POS.x;
      tz = STORM_FLUE_POS.z;
      callbacksRef.current.onInteractStormFlue();
    } else if (target.kind === 'data_node') {
      const node = stateRef.current.dataNodes.find((n) => n.id === target.id);
      if (node) {
        tx = node.x;
        tz = node.z;
      }
      callbacksRef.current.onCollectDataNode(target.id);
    } else if (target.kind === 'building') {
      const bld = stateRef.current.buildings.find((b) => b.uid === target.id);
      if (bld) {
        const bp = getBuildingWorldPos(bld.cellIndex);
        tx = bp.x;
        tz = bp.z;
      }
      callbacksRef.current.onServiceBuilding(target.id);
    }

    triggerWorkAnimRef.current?.(target.kind, tx, tz);
  };

  interactRef.current = triggerNearbyInteract;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialSpec = getPlanetEnvironmentSpec(stateRef.current.planetId);
    scene.background = new THREE.Color(initialSpec.skyColor);
    scene.fog = new THREE.FogExp2(initialSpec.fogColor, initialSpec.fogDensity);

    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.2,
      220
    );
    camera.position.set(0, 12.5, 19.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.455;
    controls.minDistance = 5.5;
    controls.maxDistance = 40;
    controls.target.set(0, 1.0, 2.0);

    // Studio/Outpost environment lighting for realistic metallic visors & solar panels
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const hemiLight = new THREE.HemisphereLight(
      initialSpec.hemiSkyColor,
      initialSpec.hemiGroundColor,
      initialSpec.hemiIntensity
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(initialSpec.sunColor, initialSpec.sunIntensity);
    sunLight.position.set(18, 26, 14);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = isSoftwareGl ? 1024 : 2048;
    sunLight.shadow.mapSize.height = isSoftwareGl ? 1024 : 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 22;
    sunLight.shadow.camera.bottom = -22;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-16, 10, -18);
    scene.add(rimLight);

    // Shared procedural textures
    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(maxAnisotropy);

    // Terrain & Sky container
    const environmentContainer = new THREE.Group();
    scene.add(environmentContainer);
    let currentTerrainCleanup: (() => void) | null = null;
    let currentPlanetId: PlanetId | null = null;

    const syncPlanet = (planetId: PlanetId) => {
      if (currentPlanetId === planetId) return;
      currentPlanetId = planetId;

      if (currentTerrainCleanup) {
        currentTerrainCleanup();
        currentTerrainCleanup = null;
      }
      while (environmentContainer.children.length > 0) {
        environmentContainer.remove(environmentContainer.children[0]);
      }

      const spec = getPlanetEnvironmentSpec(planetId);
      scene.background = new THREE.Color(spec.skyColor);
      scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);
      hemiLight.color.setHex(spec.hemiSkyColor);
      hemiLight.groundColor.setHex(spec.hemiGroundColor);
      hemiLight.intensity = spec.hemiIntensity;
      sunLight.color.setHex(spec.sunColor);
      sunLight.intensity = spec.sunIntensity;

      const { group, dispose } = createTerrainAndSkyGroup(planetId, maxAnisotropy);
      environmentContainer.add(group);
      currentTerrainCleanup = dispose;
      spaceshipGroup.position.y = groundHeightAt(planetId, SPACESHIP_POS.x, SPACESHIP_POS.z);
    };

    // Storm Flue Station
    const stormFlueGroup = createStormFlueMesh(shadowTex);
    stormFlueGroup.position.set(STORM_FLUE_POS.x, 0, STORM_FLUE_POS.z);
    stormFlueGroup.userData.interactType = 'storm_flue';
    scene.add(stormFlueGroup);

    // Autonomous ISRU Rover
    const roverGroup = createRoverMesh(shadowTex);
    scene.add(roverGroup);

    // NASA Expedition Spaceship with Pakistan Flag near the work area
    const spaceshipGroup = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    spaceshipGroup.position.set(
      SPACESHIP_POS.x,
      groundHeightAt(stateRef.current.planetId, SPACESHIP_POS.x, SPACESHIP_POS.z),
      SPACESHIP_POS.z
    );
    spaceshipGroup.rotation.y = -Math.PI * 0.58;
    scene.add(spaceshipGroup);

    // Live Outpost Storm Dust / Ice Squall Particle Layer
    const stormCount = 220;
    const stormPos = new Float32Array(stormCount * 3);
    for (let i = 0; i < stormCount; i++) {
      stormPos[i * 3] = ((i * 37) % 44) - 22;
      stormPos[i * 3 + 1] = 0.25 + ((i * 19) % 10);
      stormPos[i * 3 + 2] = ((i * 53) % 40) - 20;
    }
    const stormGeo = new THREE.BufferGeometry();
    stormGeo.setAttribute('position', new THREE.BufferAttribute(stormPos, 3));
    const stormMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.42,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const stormPoints = new THREE.Points(stormGeo, stormMat);
    stormPoints.frustumCulled = false;
    scene.add(stormPoints);

    // Outpost Buildings Container
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);
    let lastBuildingsSig = '';

    const syncBuildings = () => {
      const buildings = stateRef.current.buildings;
      const sig = buildings.map((b) => `${b.uid}:${b.level}:${b.online ? 1 : 0}`).join('|');
      if (sig === lastBuildingsSig) return;
      lastBuildingsSig = sig;

      while (buildingsGroup.children.length > 0) {
        buildingsGroup.remove(buildingsGroup.children[0]);
      }

      buildings.forEach((b) => {
        const pos = getBuildingWorldPos(b.cellIndex);
        const mesh = createBuildingMesh(b.typeId, b.level, b.online, shadowTex, solarTex);
        mesh.position.set(
          pos.x,
          groundHeightAt(stateRef.current.planetId, pos.x, pos.z),
          pos.z
        );
        mesh.userData.buildingUid = b.uid;
        buildingsGroup.add(mesh);
      });
    };

    // Planetary Data Nodes Container
    const dataNodesGroup = new THREE.Group();
    scene.add(dataNodesGroup);
    let lastNodesSig = '';

    const syncDataNodes = () => {
      const nodes = stateRef.current.dataNodes;
      const planetId = stateRef.current.planetId;
      const sig = `${planetId}|${nodes.map((n) => `${n.id}:${n.collected ? 1 : 0}`).join('|')}`;
      if (sig === lastNodesSig) return;
      lastNodesSig = sig;

      while (dataNodesGroup.children.length > 0) {
        dataNodesGroup.remove(dataNodesGroup.children[0]);
      }

      nodes.forEach((node) => {
        const mesh = createDataNodeMesh(node.collected, shadowTex);
        mesh.position.set(node.x, groundHeightAt(planetId, node.x, node.z), node.z);
        mesh.userData.dataNodeId = node.id;
        dataNodesGroup.add(mesh);
      });
    };

    // 6 Articulated Astronauts
    const astronautsGroup = new THREE.Group();
    scene.add(astronautsGroup);

    const astroEntries = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(profile, shadowTex);
      mesh.position.set(
        profile.startX,
        groundHeightAt(stateRef.current.planetId, profile.startX, profile.startZ),
        profile.startZ
      );
      astronautsGroup.add(mesh);
      return {
        profile,
        mesh,
        x: profile.startX,
        z: profile.startZ,
        yaw: 0,
        walkPhase: idx * 1.1,
        patrolAngle: idx * ((Math.PI * 2) / ASTRONAUTS.length),
      };
    });

    const focusAstronaut = (id: AstronautId) => {
      const found = astroEntries.find((e) => e.profile.id === id);
      if (!found) return;
      if (cameraModeRef.current === 'follow') {
        const py = groundHeightAt(stateRef.current.planetId, found.x, found.z);
        controls.target.set(found.x, py + 1.15, found.z);
      }
    };

    syncPlanet(stateRef.current.planetId);
    syncBuildings();
    syncDataNodes();
    syncActionsRef.current = { syncPlanet, syncBuildings, syncDataNodes, focusAstronaut };

    let workAnim: {
      astronautId: AstronautId;
      kind: NearbyTarget['kind'] | 'field_work';
      targetX?: number;
      targetZ?: number;
      timer: number;
      duration: number;
    } | null = null;

    triggerWorkAnimRef.current = (kind, targetX, targetZ) => {
      workAnim = {
        astronautId: stateRef.current.activeAstronautId,
        kind,
        targetX,
        targetZ,
        timer: 0,
        duration: 1.65,
      };
    };

    // Keyboard & Pointer controls
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const code = e.code;
      keys.add(code);
      if (code === 'KeyE' && !e.repeat) {
        triggerNearbyInteract();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Raycast Click vs Orbit Drag Detection
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        [astronautsGroup, stormFlueGroup, dataNodesGroup, buildingsGroup],
        true
      );
      if (hits.length === 0) return;

      const hitData = findUserDataInAncestors(hits[0].object);
      if (!hitData) return;

      if (hitData.astronautId) {
        callbacksRef.current.onSelectAstronaut(hitData.astronautId);
        focusAstronaut(hitData.astronautId);
      } else if (hitData.interactType === 'storm_flue') {
        callbacksRef.current.onInteractStormFlue();
      } else if (hitData.dataNodeId) {
        callbacksRef.current.onCollectDataNode(hitData.dataNodeId);
      } else if (hitData.buildingUid) {
        callbacksRef.current.onSelectBuilding(hitData.buildingUid);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp canvas sizing
    const handleResize = () => {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation loop state
    let disposed = false;
    let contextLost = false;
    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastReportedTargetKey = '';

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
    const onContextRestored = () => {
      contextLost = false;
      lastTime = performance.now();
      scheduleNextTick();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const afterDraw = (fn: () => void) => {
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          const poll = () => {
            if (disposed || contextLost) {
              gl.deleteSync(sync);
              return;
            }
            const status = gl.clientWaitSync(sync, 0, 0);
            if (status === gl.WAIT_FAILED || status !== gl.TIMEOUT_EXPIRED) {
              gl.deleteSync(sync);
              timerId = window.setTimeout(fn, 80);
            } else {
              timerId = window.setTimeout(poll, 16);
            }
          };
          timerId = window.setTimeout(poll, 0);
          return;
        }
      }
      timerId = window.setTimeout(fn, 80);
    };

    const scheduleNextTick = () => {
      if (disposed || contextLost) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const projectLabelToScreen = (
      key: string,
      wx: number,
      wy: number,
      wz: number,
      width: number,
      height: number
    ) => {
      const el = labelRefs.current[key];
      if (!el) return;
      _projVec.set(wx, wy, wz).project(camera);
      if (_projVec.z > 1 || _projVec.z < -1) {
        el.style.opacity = '0';
        return;
      }
      const sx = (_projVec.x * 0.5 + 0.5) * width;
      const sy = (-_projVec.y * 0.5 + 0.5) * height;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    };

    const tick = () => {
      if (disposed || contextLost) return;

      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      const currentState = stateRef.current;
      const activeId = currentState.activeAstronautId;
      const planetId = currentState.planetId;

      // 1. Move Active Astronaut via WASD / Arrow Keys (camera-relative XZ)
      let fwdInput = 0;
      let rightInput = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwdInput += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwdInput -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) rightInput += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) rightInput -= 1;
      if (virtualMoveRef?.current) {
        fwdInput += virtualMoveRef.current.forward;
        rightInput += virtualMoveRef.current.right;
      }

      let workProgress = 0;
      let workEnvelope = 0;
      if (workAnim) {
        workAnim.timer += dt;
        workProgress = Math.min(1, workAnim.timer / workAnim.duration);
        workEnvelope = Math.sin(workProgress * Math.PI);
        if (workAnim.timer >= workAnim.duration) {
          workAnim = null;
        }
      }

      const activeEntry = astroEntries.find((e) => e.profile.id === activeId) || astroEntries[0];

      astroEntries.forEach((entry, idx) => {
        const isControlled = entry.profile.id === activeId;
        let moving = false;

        if (isControlled && (Math.abs(fwdInput) > 0.01 || Math.abs(rightInput) > 0.01)) {
          camera.getWorldDirection(_forward);
          _forward.y = 0;
          if (_forward.lengthSq() < 0.0001) _forward.set(0, 0, -1);
          _forward.normalize();
          _right.crossVectors(_forward, _upAxis).normalize();

          _moveDir
            .set(0, 0, 0)
            .addScaledVector(_forward, fwdInput)
            .addScaledVector(_right, rightInput);
          if (_moveDir.lengthSq() > 0.001) {
            _moveDir.normalize();
            const speed = 6.4;
            entry.x = THREE.MathUtils.clamp(entry.x + _moveDir.x * speed * dt, -20, 20);
            entry.z = THREE.MathUtils.clamp(entry.z + _moveDir.z * speed * dt, -20, 20);

            // Smooth yaw toward movement vector
            const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
            let diff = targetYaw - entry.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            entry.yaw += diff * Math.min(1, dt * 12);
            moving = true;
          }
        } else if (!isControlled) {
          // Gentle autonomous crew patrol around their NASA work sector
          entry.patrolAngle += dt * (0.28 + idx * 0.03);
          const targetX = entry.profile.startX + Math.cos(entry.patrolAngle) * 1.15;
          const targetZ = entry.profile.startZ + Math.sin(entry.patrolAngle * 0.85) * 1.15;
          const dx = targetX - entry.x;
          const dz = targetZ - entry.z;
          if (Math.hypot(dx, dz) > 0.05) {
            entry.x += dx * Math.min(1, dt * 1.6);
            entry.z += dz * Math.min(1, dt * 1.6);
            entry.yaw = Math.atan2(dx, dz);
            moving = true;
          }
        }

        // Simple collision push-out from buildings & Storm Flue
        for (const b of currentState.buildings) {
          const bp = getBuildingWorldPos(b.cellIndex);
          const dx = entry.x - bp.x;
          const dz = entry.z - bp.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.85 && dist > 0.001) {
            const push = 1.85 - dist;
            entry.x += (dx / dist) * push;
            entry.z += (dz / dist) * push;
          }
        }
        {
          const dx = entry.x - STORM_FLUE_POS.x;
          const dz = entry.z - STORM_FLUE_POS.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.65 && dist > 0.001) {
            const push = 1.65 - dist;
            entry.x += (dx / dist) * push;
            entry.z += (dz / dist) * push;
          }
        }
        {
          const dx = entry.x - SPACESHIP_POS.x;
          const dz = entry.z - SPACESHIP_POS.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 2.65 && dist > 0.001) {
            const push = 2.65 - dist;
            entry.x += (dx / dist) * push;
            entry.z += (dz / dist) * push;
          }
        }

        const isWorking = Boolean(
          workAnim && workAnim.astronautId === entry.profile.id && !moving
        );
        if (
          isWorking &&
          workAnim &&
          workAnim.targetX !== undefined &&
          workAnim.targetZ !== undefined
        ) {
          const targetYaw = Math.atan2(workAnim.targetX - entry.x, workAnim.targetZ - entry.z);
          let diff = targetYaw - entry.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          entry.yaw += diff * Math.min(1, dt * 10);
        }

        const gy = groundHeightAt(planetId, entry.x, entry.z);
        entry.mesh.position.set(entry.x, gy, entry.z);
        entry.mesh.rotation.y = entry.yaw;

        // Articulated walk & E-key hand-work limb animations
        const refs = entry.mesh.userData.animRefs;
        if (refs) {
          refs.selectionRing.visible = isControlled;
          let targetHeadX = 0;
          let targetHeadY = 0;
          let targetChestGlow = 0.28;
          let targetVisorGlow = 0.12;

          if (moving) {
            entry.walkPhase += dt * (isControlled ? 10 : 5);
            const swing = Math.sin(entry.walkPhase) * (isControlled ? 0.55 : 0.3);
            refs.leftLeg.rotation.x = swing;
            refs.rightLeg.rotation.x = -swing;
            refs.leftArm.rotation.x = -swing * 0.75;
            refs.rightArm.rotation.x = swing * 0.75;
            refs.leftArm.rotation.z = THREE.MathUtils.damp(refs.leftArm.rotation.z, 0, 8, dt);
            refs.rightArm.rotation.z = THREE.MathUtils.damp(refs.rightArm.rotation.z, 0, 8, dt);
          } else if (isWorking) {
            refs.leftLeg.rotation.x *= 0.85;
            refs.rightLeg.rotation.x *= 0.85;
            const strokeL = Math.sin(workProgress * Math.PI * 6) * 0.38;
            const strokeR = Math.cos(workProgress * Math.PI * 6) * 0.38;
            refs.leftArm.rotation.x = THREE.MathUtils.damp(
              refs.leftArm.rotation.x,
              (-1.15 + strokeL) * workEnvelope,
              18,
              dt
            );
            refs.rightArm.rotation.x = THREE.MathUtils.damp(
              refs.rightArm.rotation.x,
              (-1.22 + strokeR) * workEnvelope,
              18,
              dt
            );
            refs.leftArm.rotation.z = THREE.MathUtils.damp(
              refs.leftArm.rotation.z,
              (0.24 + Math.sin(workProgress * Math.PI * 4) * 0.1) * workEnvelope,
              14,
              dt
            );
            refs.rightArm.rotation.z = THREE.MathUtils.damp(
              refs.rightArm.rotation.z,
              (-0.24 - Math.cos(workProgress * Math.PI * 4) * 0.1) * workEnvelope,
              14,
              dt
            );
            targetHeadX = 0.24 * workEnvelope;
            targetHeadY = Math.sin(workProgress * Math.PI * 3) * 0.14 * workEnvelope;
            targetChestGlow = 0.28 + 1.45 * workEnvelope;
            targetVisorGlow = 0.12 + 0.55 * workEnvelope;
          } else {
            refs.leftLeg.rotation.x *= 0.85;
            refs.rightLeg.rotation.x *= 0.85;
            refs.leftArm.rotation.x *= 0.85;
            refs.rightArm.rotation.x *= 0.85;
            refs.leftArm.rotation.z = THREE.MathUtils.damp(refs.leftArm.rotation.z, 0, 8, dt);
            refs.rightArm.rotation.z = THREE.MathUtils.damp(refs.rightArm.rotation.z, 0, 8, dt);
          }

          if (refs.headPivot) {
            refs.headPivot.rotation.x = THREE.MathUtils.damp(
              refs.headPivot.rotation.x,
              targetHeadX,
              10,
              dt
            );
            refs.headPivot.rotation.y = THREE.MathUtils.damp(
              refs.headPivot.rotation.y,
              targetHeadY,
              10,
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
          if (refs.visorMat) {
            refs.visorMat.emissiveIntensity = THREE.MathUtils.damp(
              refs.visorMat.emissiveIntensity,
              targetVisorGlow,
              12,
              dt
            );
          }
        }
      });

      // 2. Animate Storm Flue Turbine & Status Beacon
      const flueRefs = stormFlueGroup.userData.stormFlueRefs;
      if (flueRefs) {
        const spinRate = Math.max(0.4, 5.5 * (1 - currentState.stormFlue.cloggedPct / 110));
        flueRefs.fanGroup.rotation.y += dt * spinRate;
        const statusHex =
          currentState.stormFlue.status === 'critical'
            ? 0xef4444
            : currentState.stormFlue.status === 'warning'
            ? 0xf59e0b
            : 0x10b981;
        flueRefs.beaconMat.color.setHex(statusHex);
        flueRefs.beaconMat.emissive.setHex(statusHex);
      }

      // 3. Animate Planetary Data Scan Rings
      dataNodesGroup.children.forEach((nodeObj, idx) => {
        const nodeRefs = nodeObj.userData.nodeRefs;
        if (nodeRefs) {
          nodeRefs.scanRing.rotation.y += dt * 1.4;
          nodeRefs.scanRing.position.y = 1.55 + Math.sin(elapsed * 2.2 + idx) * 0.08;
        }
      });

      // 4. Animate Autonomous Rover along base perimeter & NASA Spaceship Pakistan Flag
      const roverAngle = elapsed * 0.14;
      const rx = Math.cos(roverAngle) * 8.3;
      const rz = Math.sin(roverAngle) * 8.3;
      const ry = groundHeightAt(planetId, rx, rz);
      roverGroup.position.set(rx, ry, rz);
      roverGroup.rotation.y = -roverAngle;

      const shipRefs = spaceshipGroup.userData.spaceshipRefs;
      if (shipRefs) {
        shipRefs.beaconMat.emissiveIntensity = 0.75 + 0.65 * Math.sin(elapsed * 3.1);
      }

      // 4b. Live Outpost Storm Particles & Dynamic Fog Density when storm/flue alert is active
      const evtId = currentState.activeEvent?.id;
      const isStormActive =
        currentState.stormFlue.cloggedPct >= 55 ||
        evtId === 'dust_storm' ||
        evtId === 'storm_flue_clog' ||
        evtId === 'cryo_plume';
      const baseSpec = getPlanetEnvironmentSpec(planetId);
      const targetStormAlpha = isStormActive ? 0.58 : 0;
      stormMat.opacity = THREE.MathUtils.damp(stormMat.opacity, targetStormAlpha, 3.5, dt);
      if (scene.fog instanceof THREE.FogExp2) {
        const targetFog = isStormActive ? baseSpec.fogDensity * 1.9 : baseSpec.fogDensity;
        scene.fog.density = THREE.MathUtils.damp(scene.fog.density, targetFog, 2.5, dt);
      }
      if (stormMat.opacity > 0.02) {
        const stormHex =
          planetId === 'mars'
            ? 0xfb923c
            : planetId === 'titan'
            ? 0xfacc15
            : planetId === 'europa'
            ? 0xe0f2fe
            : 0xcbd5e1;
        stormMat.color.setHex(stormHex);
        const sAttr = stormGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < stormCount; i++) {
          let sx = stormPos[i * 3] + 15.5 * dt;
          let sz = stormPos[i * 3 + 2] + 6.5 * dt;
          if (sx > 22) sx -= 44;
          if (sz > 20) sz -= 40;
          stormPos[i * 3] = sx;
          stormPos[i * 3 + 2] = sz;
        }
        sAttr.needsUpdate = true;
      }

      // 5. Camera Follow / Overview Tracking
      if (cameraModeRef.current === 'follow') {
        _desiredTarget.set(
          activeEntry.x,
          activeEntry.mesh.position.y + 1.15,
          activeEntry.z
        );
        _targetDelta.subVectors(_desiredTarget, controls.target).multiplyScalar(Math.min(1, dt * 6));
        controls.target.add(_targetDelta);
        camera.position.add(_targetDelta);
      }
      controls.update();

      // 6. Proximity Target Detection for [E] NASA Work
      let closestTarget: NearbyTarget | null = null;
      let bestDist = Infinity;

      const flueDist = Math.hypot(
        activeEntry.x - STORM_FLUE_POS.x,
        activeEntry.z - STORM_FLUE_POS.z
      );
      if (flueDist < 3.7) {
        bestDist = flueDist;
        closestTarget = {
          kind: 'storm_flue',
          id: 'storm_flue',
          label: 'Outpost Storm Flue',
          sublabel: `Clog ${currentState.stormFlue.cloggedPct}% · ${currentState.stormFlue.pressureKpa} kPa`,
          actionLabel: 'Inspect & Clear Storm Flue',
        };
      }

      for (const node of currentState.dataNodes) {
        const d = Math.hypot(activeEntry.x - node.x, activeEntry.z - node.z);
        if (d < 3.4 && d < bestDist) {
          bestDist = d;
          closestTarget = {
            kind: 'data_node',
            id: node.id,
            label: node.label,
            sublabel: node.collected ? `Verified: ${node.reading}` : node.reading,
            actionLabel: node.collected ? 'Data Already Logged' : `Collect Data (+${node.scienceValue} SCI)`,
          };
        }
      }

      for (const b of currentState.buildings) {
        const bp = getBuildingWorldPos(b.cellIndex);
        const d = Math.hypot(activeEntry.x - bp.x, activeEntry.z - bp.z);
        if (d < 3.3 && d < bestDist) {
          bestDist = d;
          const def = getBuildingDef(b.typeId);
          const activeAstro = getAstronautById(activeId);
          const doneToday = currentState.crewProgress[activeId]?.currentTaskDone;
          closestTarget = {
            kind: 'building',
            id: b.uid,
            label: `${def?.shortName || b.typeId} (Lv ${b.level})`,
            sublabel: doneToday
              ? `${activeAstro.name} completed NASA shift today`
              : activeAstro.taskTitle,
            actionLabel: doneToday
              ? 'Inspect Module'
              : `Run ${activeAstro.name}'s NASA Maintenance`,
          };
        }
      }

      nearbyTargetRef.current = closestTarget;
      const targetKey = closestTarget
        ? `${closestTarget.kind}:${closestTarget.id}:${closestTarget.actionLabel}`
        : 'none';
      if (targetKey !== lastReportedTargetKey) {
        lastReportedTargetKey = targetKey;
        callbacksRef.current.onProximityChange(closestTarget);
      }

      // 7. Render 3D Frame
      renderer.render(scene, camera);

      // 8. Project 3D Floating Nameplates cleanly to DOM
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      astroEntries.forEach((entry) => {
        projectLabelToScreen(
          `astro-${entry.profile.id}`,
          entry.x,
          entry.mesh.position.y + 2.15,
          entry.z,
          w,
          h
        );
      });
      projectLabelToScreen('storm-flue', STORM_FLUE_POS.x, 4.1, STORM_FLUE_POS.z, w, h);
      projectLabelToScreen(
        'nasa-spaceship',
        SPACESHIP_POS.x,
        spaceshipGroup.position.y + 5.7,
        SPACESHIP_POS.z,
        w,
        h
      );
      currentState.dataNodes.forEach((node) => {
        const ny = groundHeightAt(planetId, node.x, node.z);
        projectLabelToScreen(`node-${node.id}`, node.x, ny + 2.25, node.z, w, h);
      });

      scheduleNextTick();
    };

    scheduleNextTick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();

      if (currentTerrainCleanup) currentTerrainCleanup();
      spaceshipGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const std = m as THREE.MeshStandardMaterial;
            if (std.map && std.map !== shadowTex && std.map !== solarTex) std.map.dispose();
            m.dispose();
          });
        }
      });
      stormGeo.dispose();
      stormMat.dispose();
      shadowTex.dispose();
      solarTex.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync planetary environment, buildings, and nodes without rebuilding WebGL context
  useEffect(() => {
    syncActionsRef.current?.syncPlanet(state.planetId);
    syncActionsRef.current?.syncBuildings();
    syncActionsRef.current?.syncDataNodes();
  }, [state.planetId, state.buildings, state.dataNodes]);

  useEffect(() => {
    syncActionsRef.current?.focusAstronaut(state.activeAstronautId);
  }, [state.activeAstronautId, cameraMode]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Projected 3D Labels (Direct Transform Updates, No Backdrop Blur) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ASTRONAUTS.map((astro) => {
          const isActive = state.activeAstronautId === astro.id;
          const done = state.crewProgress[astro.id]?.currentTaskDone;
          return (
            <div
              key={astro.id}
              ref={(el) => {
                labelRefs.current[`astro-${astro.id}`] = el;
              }}
              style={{ opacity: 0 }}
              className={`absolute top-0 left-0 px-2 py-0.5 rounded border text-[11px] font-mono whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#0F1623]/95 border-sky-400 text-white font-bold'
                  : 'bg-[#07090E]/85 border-slate-700 text-slate-200'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: astro.suitColor }}
              />
              {astro.name}
              {done && <span className="ml-1 text-emerald-400">✓</span>}
            </div>
          );
        })}

        <div
          ref={(el) => {
            labelRefs.current['storm-flue'] = el;
          }}
          style={{ opacity: 0 }}
          className={`absolute top-0 left-0 px-2 py-0.5 rounded border text-[10px] font-mono whitespace-nowrap ${
            state.stormFlue.status === 'critical'
              ? 'bg-rose-950/95 border-rose-500 text-rose-200'
              : state.stormFlue.status === 'warning'
              ? 'bg-amber-950/95 border-amber-500 text-amber-200'
              : 'bg-[#07090E]/90 border-slate-700 text-emerald-300'
          }`}
        >
          Storm Flue · {state.stormFlue.cloggedPct}% Clog
        </div>

        <div
          ref={(el) => {
            labelRefs.current['nasa-spaceship'] = el;
          }}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 px-2 py-0.5 rounded border border-emerald-500/60 bg-[#07090E]/90 text-[10px] font-mono text-emerald-300 whitespace-nowrap"
        >
          NASA Starship
        </div>

        {state.dataNodes.map((node) => (
          <div
            key={node.id}
            ref={(el) => {
              labelRefs.current[`node-${node.id}`] = el;
            }}
            style={{ opacity: 0 }}
            className={`absolute top-0 left-0 px-2 py-0.5 rounded border text-[10px] font-mono whitespace-nowrap ${
              node.collected
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                : 'bg-[#0F1623]/90 border-sky-500/60 text-sky-300'
            }`}
          >
            {node.collected ? '✓ ' : '◆ '}
            {node.label}
          </div>
        ))}
      </div>
    </div>
  );
}
