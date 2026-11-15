import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import { getPlanetById } from '../data/planets';
import type { AstronautId, MissionState, PlanetId } from '../types';
import { LANDED_SHIP_YAW } from './MissionLaunchScene';
import {
  applyAstronautCustomization,
  createAstronautMesh,
  createBuildingMesh,
  createContactShadowTexture,
  createDataNodeMesh,
  createEuropaProbeMesh,
  createNasaSpaceshipMesh,
  createPlantedFlagMesh,
  createRoverMesh,
  createSolarGridTexture,
  createStormFlueMesh,
  createTitanDroneMesh,
  setShelterDoorsOpen,
  setShipAirlockAndRamp,
} from './models';
import { createAAARenderPipeline } from './postfx';
import {
  ROAMING_RADIUS,
  createTerrainAndSkyGroup,
  getPlanetEnvironmentSpec,
  getWorldRockColliders,
  getWorldZoneFeatures,
  groundHeightAt,
} from './terrain';

export interface NearbyTarget {
  kind: 'storm_flue' | 'data_node' | 'building' | 'spaceship';
  id: string;
  label: string;
  sublabel: string;
  actionLabel: string;
}

export type OutpostCameraMode = 'follow' | 'overview' | 'first_person';

interface OutpostScene3DProps {
  state: MissionState;
  cameraMode: OutpostCameraMode;
  onProximityChange: (target: NearbyTarget | null) => void;
  onBoundaryWarning?: (nearEdge: boolean) => void;
  onPositionUpdate?: (positions: {
    astronauts: Array<{ id: AstronautId; x: number; z: number }>;
    rover: { x: number; z: number; yaw: number };
  }) => void;
  onSelectAstronaut: (id: AstronautId) => void;
  onSelectBuilding: (uid: string) => void;
  onServiceBuilding: (uid: string) => void;
  onInteractStormFlue: () => void;
  onInteractSpaceship: () => void;
  onCollectDataNode: (nodeId: string) => void;
  onFieldWork?: () => void;
  interactRef: React.MutableRefObject<(() => void) | null>;
  jumpRef?: React.MutableRefObject<(() => void) | null>;
  virtualMoveRef?: React.MutableRefObject<{ forward: number; right: number }>;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetDelta = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _pointerNdc = new THREE.Vector2();
const _fpEye = new THREE.Vector3();
const _fpLook = new THREE.Vector3();

export const STORM_FLUE_POS = { x: 0, z: 8.6 };
export const SPACESHIP_POS = { x: 12.2, z: 4.4 };

export function getBuildingWorldPos(cellIndex: number): { x: number; z: number } {
  const col = cellIndex % 4;
  const row = Math.floor(cellIndex / 4);
  return {
    x: (col - 1.5) * 3.8,
    z: (row - 1.5) * 3.8,
  };
}


function findUserDataInAncestors(obj: THREE.Object3D | null): {
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

const ROVER_WAYPOINTS: Array<{ x: number; z: number }> = [
  { x: 9.8, z: 9.8 },
  { x: 0, z: 12.8 },
  { x: -10.2, z: 9.2 },
  { x: -12.6, z: 0 },
  { x: -10.5, z: -10.5 },
  { x: 0, z: -12.6 },
  { x: 10.6, z: -9.8 },
  { x: 16.5, z: -2.5 },
  { x: 16.2, z: 9.2 },
];

export default function OutpostScene3D({
  state,
  cameraMode,
  onProximityChange,
  onBoundaryWarning,
  onPositionUpdate,
  onSelectAstronaut,
  onSelectBuilding,
  onServiceBuilding,
  onInteractStormFlue,
  onInteractSpaceship,
  onCollectDataNode,
  onFieldWork,
  interactRef,
  jumpRef,
  virtualMoveRef,
}: OutpostScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stateRef = useRef(state);
  const cameraModeRef = useRef<OutpostCameraMode>(cameraMode);

  stateRef.current = state;
  cameraModeRef.current = cameraMode;

  const callbacksRef = useRef({
    onProximityChange,
    onBoundaryWarning,
    onPositionUpdate,
    onSelectAstronaut,
    onSelectBuilding,
    onServiceBuilding,
    onInteractStormFlue,
    onInteractSpaceship,
    onCollectDataNode,
    onFieldWork,
  });
  callbacksRef.current = {
    onProximityChange,
    onBoundaryWarning,
    onPositionUpdate,
    onSelectAstronaut,
    onSelectBuilding,
    onServiceBuilding,
    onInteractStormFlue,
    onInteractSpaceship,
    onCollectDataNode,
    onFieldWork,
  };

  const syncActionsRef = useRef<{
    syncPlanet: (planetId: PlanetId) => void;
    syncBuildings: () => void;
    syncDataNodes: () => void;
    syncFlag: () => void;
    syncCustomizations: () => void;
    focusAstronaut: (id: AstronautId) => void;
  } | null>(null);

  const nearbyTargetRef = useRef<NearbyTarget | null>(null);
  const triggerWorkAnimRef = useRef<
    ((kind: NearbyTarget['kind'] | 'field_work', targetX?: number, targetZ?: number) => void) | null
  >(null);
  const triggerJumpRef = useRef<(() => void) | null>(null);

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
    } else if (target.kind === 'spaceship') {
      tx = SPACESHIP_POS.x;
      tz = SPACESHIP_POS.z;
      callbacksRef.current.onInteractSpaceship();
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
  if (jumpRef) {
    jumpRef.current = () => triggerJumpRef.current?.();
  }

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const initialSpec = getPlanetEnvironmentSpec(stateRef.current.planetId);
    scene.background = new THREE.Color(initialSpec.skyColor);
    scene.fog = new THREE.FogExp2(initialSpec.fogColor, initialSpec.fogDensity);

    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.2,
      240
    );
    camera.position.set(0, 12.5, 20.5);

    const pipeline = createAAARenderPipeline(container, scene, camera, {
      bloomStrength: 0.07,
      bloomRadius: 0.32,
      bloomThreshold: 1.18,
      exposure: 0.92,
    });
    const { renderer, isSoftwareGl } = pipeline;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.455;
    controls.minDistance = 4.5;
    controls.maxDistance = 42;
    controls.target.set(0, 1.0, 2.0);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.28;

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
    sunLight.shadow.camera.left = -24;
    sunLight.shadow.camera.right = 24;
    sunLight.shadow.camera.top = 24;
    sunLight.shadow.camera.bottom = -24;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.28);
    rimLight.position.set(-16, 10, -18);
    scene.add(rimLight);

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(maxAnisotropy);

    // Terrain & Sky container
    const environmentContainer = new THREE.Group();
    scene.add(environmentContainer);
    let currentTerrainBundle: ReturnType<typeof createTerrainAndSkyGroup> | null = null;
    let currentPlanetId: PlanetId | null = null;
    let currentRockColliders = getWorldRockColliders(stateRef.current.planetId);
    let currentZoneFeatures = getWorldZoneFeatures(stateRef.current.planetId);

    // World-specific autonomous robotics (Titan Dragonfly Drone & Europa Cryo Probe)
    const titanDrone = createTitanDroneMesh();
    scene.add(titanDrone);
    const europaProbe = createEuropaProbeMesh();
    scene.add(europaProbe);

    // Storm Flue Station
    const stormFlueGroup = createStormFlueMesh(shadowTex);
    stormFlueGroup.position.set(STORM_FLUE_POS.x, 0, STORM_FLUE_POS.z);
    stormFlueGroup.userData.interactType = 'storm_flue';
    scene.add(stormFlueGroup);

    // Autonomous / Manual ISRU Rover
    const roverGroup = createRoverMesh(shadowTex);
    scene.add(roverGroup);

    // Persistent NASA Starship (locked yaw matching landing cinematic!)
    const spaceshipGroup = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    spaceshipGroup.position.set(
      SPACESHIP_POS.x,
      groundHeightAt(stateRef.current.planetId, SPACESHIP_POS.x, SPACESHIP_POS.z),
      SPACESHIP_POS.z
    );
    spaceshipGroup.rotation.y = LANDED_SHIP_YAW;
    spaceshipGroup.userData.interactType = 'spaceship';
    setShipAirlockAndRamp(spaceshipGroup, 0.0, 0.0);
    scene.add(spaceshipGroup);

    // Permanent Planted Expedition Flag
    const plantedFlagGroup = createPlantedFlagMesh(shadowTex, maxAnisotropy);
    scene.add(plantedFlagGroup);

    const syncFlag = () => {
      const pid = stateRef.current.planetId;
      const flag = stateRef.current.flagsByWorld[pid];
      if (flag && flag.planted) {
        plantedFlagGroup.visible = true;
        plantedFlagGroup.position.set(flag.x, groundHeightAt(pid, flag.x, flag.z), flag.z);
      } else {
        plantedFlagGroup.visible = false;
      }
    };

    const syncPlanet = (planetId: PlanetId) => {
      if (currentPlanetId === planetId) return;
      currentPlanetId = planetId;

      if (currentTerrainBundle) {
        currentTerrainBundle.dispose();
        currentTerrainBundle = null;
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

      currentTerrainBundle = createTerrainAndSkyGroup(planetId, maxAnisotropy);
      environmentContainer.add(currentTerrainBundle.group);
      currentRockColliders = getWorldRockColliders(planetId);
      currentZoneFeatures = getWorldZoneFeatures(planetId);

      spaceshipGroup.position.y = groundHeightAt(planetId, SPACESHIP_POS.x, SPACESHIP_POS.z);
      stormFlueGroup.position.y = groundHeightAt(planetId, STORM_FLUE_POS.x, STORM_FLUE_POS.z);

      titanDrone.visible = planetId === 'titan';
      europaProbe.visible = planetId === 'europa';
      if (planetId === 'europa') {
        const px = -12.8;
        const pz = -12.0;
        europaProbe.position.set(px, groundHeightAt('europa', px, pz), pz);
      }

      syncFlag();
    };

    // Live Outpost Storm Particles (Methane rain / Iron-oxide dust / Cryo mist / Charged dust)
    const stormCount = 240;
    const stormPos = new Float32Array(stormCount * 3);
    for (let i = 0; i < stormCount; i++) {
      stormPos[i * 3] = ((i * 37) % 44) - 22;
      stormPos[i * 3 + 1] = 0.25 + ((i * 19) % 12);
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

    // Outpost Buildings Container (with animated refuge doors & damage state)
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);
    const buildingMeshMap = new Map<string, { typeId: string; mesh: THREE.Group; x: number; z: number }>();
    let lastBuildingsSig = '';

    const syncBuildings = () => {
      const buildings = stateRef.current.buildings;
      const sig = buildings
        .map(
          (b) =>
            `${b.uid}:${b.level}:${b.online ? 1 : 0}:${b.damaged ? 1 : 0}:${Math.floor(
              (b.dustPct || 0) / 25
            )}`
        )
        .join('|');
      if (sig === lastBuildingsSig) return;
      lastBuildingsSig = sig;

      while (buildingsGroup.children.length > 0) {
        buildingsGroup.remove(buildingsGroup.children[0]);
      }
      buildingMeshMap.clear();

      buildings.forEach((b) => {
        const pos = getBuildingWorldPos(b.cellIndex);
        const mesh = createBuildingMesh(b.typeId, b.level, b.online, shadowTex, solarTex, {
          damaged: b.damaged,
          dustPct: b.dustPct,
        });
        mesh.position.set(
          pos.x,
          groundHeightAt(stateRef.current.planetId, pos.x, pos.z),
          pos.z
        );
        mesh.userData.buildingUid = b.uid;
        buildingsGroup.add(mesh);
        buildingMeshMap.set(b.uid, { typeId: b.typeId, mesh, x: pos.x, z: pos.z });
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

    // 6 Articulated Astronauts with real gravity jump state & shelter refuge state
    const astronautsGroup = new THREE.Group();
    scene.add(astronautsGroup);

    const astroEntries = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(
        profile,
        shadowTex,
        true,
        stateRef.current.crewCustomizations?.[profile.id]
      );
      const sx = idx < 3 ? -7.4 + idx * 1.4 : 7.6;
      const sz = idx < 3 ? 8.2 : -2.2 + (idx - 3) * 2.2;
      mesh.position.set(sx, groundHeightAt(stateRef.current.planetId, sx, sz), sz);
      astronautsGroup.add(mesh);
      return {
        profile,
        mesh,
        x: sx,
        z: sz,
        yaw: 0,
        airOffset: 0,
        vy: 0,
        grounded: true,
        walkPhase: idx * 1.1,
        patrolAngle: idx * ((Math.PI * 2) / ASTRONAUTS.length),
        shelteredInside: false,
      };
    });

    // Rover Navigation State (collision-free waypoint + obstacle avoidance)
    const roverNav = {
      x: 10.5,
      z: 9.8,
      yaw: Math.PI * 0.65,
      speed: 2.3,
      waypointIdx: 1,
      wheelSpin: 0,
    };

    let fpYaw = 0;
    let fpPitch = -0.05;
    let isFpDragging = false;
    let fpLastPointer = { x: 0, y: 0 };

    const focusAstronaut = (id: AstronautId) => {
      const found = astroEntries.find((e) => e.profile.id === id);
      if (!found) return;
      if (cameraModeRef.current === 'first_person') {
        fpYaw = found.yaw;
        fpPitch = -0.05;
        controls.enabled = false;
        return;
      }
      controls.enabled = true;
      if (cameraModeRef.current === 'follow') {
        const py = groundHeightAt(stateRef.current.planetId, found.x, found.z) + found.airOffset;
        controls.target.set(found.x, py + 1.15, found.z);
      }
    };

    const syncCustomizations = () => {
      astroEntries.forEach((entry) => {
        const custom = stateRef.current.crewCustomizations?.[entry.profile.id];
        if (custom) applyAstronautCustomization(entry.mesh, custom);
      });
    };

    syncPlanet(stateRef.current.planetId);
    syncBuildings();
    syncDataNodes();
    syncFlag();
    syncCustomizations();
    syncActionsRef.current = {
      syncPlanet,
      syncBuildings,
      syncDataNodes,
      syncFlag,
      syncCustomizations,
      focusAstronaut,
    };

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

    triggerJumpRef.current = () => {
      const active = astroEntries.find((e) => e.profile.id === stateRef.current.activeAstronautId);
      if (active && active.grounded && !active.shelteredInside) {
        active.vy = 3.35;
        active.grounded = false;
      }
    };

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const code = e.code;
      keys.add(code);
      if (code === 'KeyE' && !e.repeat) {
        triggerNearbyInteract();
      }
      if (code === 'Space' && !e.repeat) {
        e.preventDefault();
        triggerJumpRef.current?.();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };

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
    };

    const onPointerUp = (e: PointerEvent) => {
      isFpDragging = false;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        [astronautsGroup, stormFlueGroup, spaceshipGroup, dataNodesGroup, buildingsGroup],
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
      } else if (hitData.interactType === 'spaceship') {
        callbacksRef.current.onInteractSpaceship();
      } else if (hitData.dataNodeId) {
        callbacksRef.current.onCollectDataNode(hitData.dataNodeId);
      } else if (hitData.buildingUid) {
        callbacksRef.current.onSelectBuilding(hitData.buildingUid);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      pipeline.resize(w, h, camera);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let disposed = false;
    let contextLost = false;
    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastReportedTargetKey = '';
    let lastBoundaryHit = false;
    let shelterDoorOpen01 = 0;
    let posUpdateCooldown = 0;

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
      if (isSoftwareGl) afterDraw(tick);
      else rafId = requestAnimationFrame(tick);
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

    // Push any entity (astronaut or rover) out of buildings, Storm Flue, Ship, Flag, Rocks, and Titan Lake
    const resolveObstaclesAndPerimeter = (
      x: number,
      z: number,
      entityRadius: number,
      allowShipAirlock = false
    ): { x: number; z: number; hitBoundary: boolean } => {
      let nx = x;
      let nz = z;

      const pushCircle = (cx: number, cz: number, minDist: number) => {
        const dx = nx - cx;
        const dz = nz - cz;
        const d = Math.hypot(dx, dz);
        if (d < minDist) {
          if (d > 0.001) {
            const p = minDist - d;
            nx += (dx / d) * p;
            nz += (dz / d) * p;
          } else {
            nx += minDist;
          }
        }
      };

      for (const b of stateRef.current.buildings) {
        const bp = getBuildingWorldPos(b.cellIndex);
        pushCircle(bp.x, bp.z, 1.72 + entityRadius);
      }

      pushCircle(STORM_FLUE_POS.x, STORM_FLUE_POS.z, 1.55 + entityRadius);

      if (!allowShipAirlock) {
        pushCircle(SPACESHIP_POS.x, SPACESHIP_POS.z, 2.55 + entityRadius);
      }

      const flag = stateRef.current.flagsByWorld[stateRef.current.planetId];
      if (flag?.planted) {
        pushCircle(flag.x, flag.z, 0.55 + entityRadius);
      }

      for (const rock of currentRockColliders) {
        pushCircle(rock.x, rock.z, rock.radius + entityRadius);
      }

      for (const zf of currentZoneFeatures) {
        if (zf.kind === 'methane_lake') {
          pushCircle(zf.x, zf.z, zf.radius + entityRadius);
        } else if (zf.kind === 'cryo_plume') {
          pushCircle(zf.x, zf.z, 1.4 + entityRadius);
        }
      }

      // Smooth Radial Roaming Boundary Lock (R = 23.6m inside 24m pylons)
      const maxR = ROAMING_RADIUS - 0.55;
      const distFromOrigin = Math.hypot(nx, nz);
      let hitBoundary = false;
      if (distFromOrigin > maxR) {
        hitBoundary = true;
        const scale = maxR / distFromOrigin;
        nx *= scale;
        nz *= scale;
      } else if (distFromOrigin > maxR - 1.1) {
        hitBoundary = true;
      }

      return { x: nx, z: nz, hitBoundary };
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
      const planetConfig = getPlanetById(planetId);
      const gravity = planetConfig.gravityMs2; // Real planetary gravity: 1.62 / 3.71 / 1.35 / 1.31
      const atmoDrag = planetId === 'titan' ? 0.35 : 0; // Dense 145kPa Titan air damping

      // Find nearest Shelter / Habitat / Starship door target for storm refuge
      const refugeTargets: Array<{ x: number; z: number; doorX: number; doorZ: number; uid?: string }> = [];
      currentState.buildings.forEach((b) => {
        if (b.typeId === 'radiation_shelter' || b.typeId === 'habitat') {
          const bp = getBuildingWorldPos(b.cellIndex);
          refugeTargets.push({ x: bp.x, z: bp.z + 1.35, doorX: bp.x, doorZ: bp.z + 2.25, uid: b.uid });
        }
      });
      // Starship door world coords
      const shipDoorLocalZ = 3.2;
      const shipRefuge = {
        x: SPACESHIP_POS.x + Math.sin(LANDED_SHIP_YAW) * 1.6,
        z: SPACESHIP_POS.z + Math.cos(LANDED_SHIP_YAW) * 1.6,
        doorX: SPACESHIP_POS.x + Math.sin(LANDED_SHIP_YAW) * shipDoorLocalZ,
        doorZ: SPACESHIP_POS.z + Math.cos(LANDED_SHIP_YAW) * shipDoorLocalZ,
      };
      refugeTargets.push(shipRefuge);

      const isRefugeActive = currentState.shelterRefugeActive;
      const targetDoorOpen = isRefugeActive ? 1 : 0;
      shelterDoorOpen01 = THREE.MathUtils.damp(shelterDoorOpen01, targetDoorOpen, 4.5, dt);

      buildingMeshMap.forEach((bEntry) => {
        if (bEntry.typeId === 'radiation_shelter' || bEntry.typeId === 'habitat') {
          setShelterDoorsOpen(bEntry.mesh, shelterDoorOpen01);
        }
      });
      setShipAirlockAndRamp(spaceshipGroup, shelterDoorOpen01, shelterDoorOpen01);

      // Keyboard movement inputs (route to Rover if rover.manualControl, else active Astronaut)
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

      const isDrivingRover = Boolean(currentState.rover.manualControl && !currentState.rover.damaged);

      let workProgress = 0;
      let workEnvelope = 0;
      if (workAnim) {
        workAnim.timer += dt;
        workProgress = Math.min(1, workAnim.timer / workAnim.duration);
        workEnvelope = Math.sin(workProgress * Math.PI);
        if (workAnim.timer >= workAnim.duration) workAnim = null;
      }

      const activeEntry = astroEntries.find((e) => e.profile.id === activeId) || astroEntries[0];
      let activeMoving = false;
      let boundaryWarningActive = false;

      astroEntries.forEach((entry, idx) => {
        const isControlled = entry.profile.id === activeId && !isDrivingRover;
        let moving = false;

        if (isRefugeActive) {
          // Storm / Hazard Refuge Behavior: walk smoothly through open door into nearest shelter/ship
          let nearestRef = shipRefuge;
          let minD = Infinity;
          for (const rt of refugeTargets) {
            const d = Math.hypot(entry.x - rt.doorX, entry.z - rt.doorZ);
            if (d < minD) {
              minD = d;
              nearestRef = rt;
            }
          }
          const distToDoor = Math.hypot(entry.x - nearestRef.doorX, entry.z - nearestRef.doorZ);
          if (distToDoor < 0.72) {
            // Walk straight inside doorway at 1.0 scale, then shield indoors
            entry.x = THREE.MathUtils.lerp(entry.x, nearestRef.x, dt * 3.5);
            entry.z = THREE.MathUtils.lerp(entry.z, nearestRef.z, dt * 3.5);
            if (Math.hypot(entry.x - nearestRef.x, entry.z - nearestRef.z) < 0.55) {
              entry.shelteredInside = true;
            }
          } else if (!entry.shelteredInside) {
            const dx = nearestRef.doorX - entry.x;
            const dz = nearestRef.doorZ - entry.z;
            const step = Math.min(distToDoor, 5.2 * dt);
            entry.x += (dx / distToDoor) * step;
            entry.z += (dz / distToDoor) * step;
            entry.yaw = Math.atan2(dx, dz);
            moving = true;
          }
        } else {
          // Exit shelter smoothly when hazard clears
          if (entry.shelteredInside) {
            entry.shelteredInside = false;
            entry.x += 0.35;
            entry.z += 1.4;
          }

          if (isControlled && (Math.abs(fwdInput) > 0.01 || Math.abs(rightInput) > 0.01)) {
            if (cameraModeRef.current === 'first_person') {
              _forward.set(Math.sin(fpYaw), 0, Math.cos(fpYaw)).normalize();
            } else {
              camera.getWorldDirection(_forward);
              _forward.y = 0;
              if (_forward.lengthSq() < 0.0001) _forward.set(0, 0, -1);
              _forward.normalize();
            }
            _right.crossVectors(_forward, _upAxis).normalize();
            _moveDir.set(0, 0, 0).addScaledVector(_forward, fwdInput).addScaledVector(_right, rightInput);

            if (_moveDir.lengthSq() > 0.001) {
              _moveDir.normalize();
              // Subtle gravity-responsive walk speed
              const speed = planetId === 'mars' ? 6.8 : planetId === 'titan' ? 5.6 : 6.2;
              const rawX = entry.x + _moveDir.x * speed * dt;
              const rawZ = entry.z + _moveDir.z * speed * dt;
              const resolved = resolveObstaclesAndPerimeter(rawX, rawZ, 0.45);
              entry.x = resolved.x;
              entry.z = resolved.z;
              boundaryWarningActive = resolved.hitBoundary;

              if (cameraModeRef.current !== 'first_person') {
                const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
                let diff = targetYaw - entry.yaw;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                entry.yaw += diff * Math.min(1, dt * 12);
              }
              moving = true;
              activeMoving = true;
            }
          } else if (!isControlled) {
            // Non-active crew gently patrol around their assigned zone inside perimeter
            entry.patrolAngle += dt * (0.25 + idx * 0.025);
            const anchorX = idx < 3 ? -7.8 + idx * 1.8 : 7.8;
            const anchorZ = idx < 3 ? 8.8 : -2.4 + (idx - 3) * 2.4;
            const tx = anchorX + Math.cos(entry.patrolAngle) * 1.1;
            const tz = anchorZ + Math.sin(entry.patrolAngle * 0.85) * 1.1;
            const dx = tx - entry.x;
            const dz = tz - entry.z;
            if (Math.hypot(dx, dz) > 0.06) {
              const resolved = resolveObstaclesAndPerimeter(
                entry.x + dx * Math.min(1, dt * 1.4),
                entry.z + dz * Math.min(1, dt * 1.4),
                0.45
              );
              entry.x = resolved.x;
              entry.z = resolved.z;
              entry.yaw = Math.atan2(dx, dz);
              moving = true;
            }
          } else {
            const resolved = resolveObstaclesAndPerimeter(entry.x, entry.z, 0.45);
            entry.x = resolved.x;
            entry.z = resolved.z;
            boundaryWarningActive = resolved.hitBoundary;
          }
        }

        // Planetary Gravity Jump & Landing Physics (g = 1.62 / 3.71 / 1.35 / 1.31)
        if (!entry.grounded || entry.airOffset > 0) {
          entry.vy -= (gravity + atmoDrag * entry.vy) * dt;
          entry.airOffset += entry.vy * dt;
          if (entry.airOffset <= 0) {
            entry.airOffset = 0;
            entry.vy = 0;
            entry.grounded = true;
          }
        }

        const isWorking = Boolean(workAnim && workAnim.astronautId === entry.profile.id && !moving);
        if (isWorking && workAnim && workAnim.targetX !== undefined && workAnim.targetZ !== undefined) {
          const targetYaw = Math.atan2(workAnim.targetX - entry.x, workAnim.targetZ - entry.z);
          let diff = targetYaw - entry.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          entry.yaw += diff * Math.min(1, dt * 10);
        }

        const gy = groundHeightAt(planetId, entry.x, entry.z);
        entry.mesh.position.set(entry.x, gy + entry.airOffset, entry.z);
        entry.mesh.rotation.y = entry.yaw;
        entry.mesh.scale.setScalar(1); // NEVER scale-pop!

        const isFirstPersonSelf =
          cameraModeRef.current === 'first_person' && entry.profile.id === activeId;
        entry.mesh.visible = !entry.shelteredInside && !isFirstPersonSelf;

        const refs = entry.mesh.userData.animRefs;
        if (refs) {
          refs.selectionRing.visible = entry.profile.id === activeId && !isDrivingRover;
          let targetHeadX = 0;
          let targetHeadY = 0;
          let targetChestGlow = 0.28;
          let targetVisorGlow = 0.12;

          if (!entry.grounded) {
            // Low-G airborne leap pose
            refs.leftLeg.rotation.x = 0.35;
            refs.rightLeg.rotation.x = -0.35;
            refs.leftArm.rotation.x = -0.65;
            refs.rightArm.rotation.x = -0.65;
          } else if (moving) {
            const cadence = (isControlled ? 9.5 : 4.8) * Math.sqrt(Math.max(0.45, gravity / 2.2));
            entry.walkPhase += dt * cadence;
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
            targetHeadX = 0.24 * workEnvelope;
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
            refs.headPivot.rotation.x = THREE.MathUtils.damp(refs.headPivot.rotation.x, targetHeadX, 10, dt);
            refs.headPivot.rotation.y = THREE.MathUtils.damp(refs.headPivot.rotation.y, targetHeadY, 10, dt);
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

      if (boundaryWarningActive !== lastBoundaryHit) {
        lastBoundaryHit = boundaryWarningActive;
        callbacksRef.current.onBoundaryWarning?.(boundaryWarningActive);
      }

      // 2. Collision-Free Rover Navigation + Smooth Steering + Obstacle Avoidance + Wheel Spin + Terrain Slope
      if (!currentState.rover.damaged) {
        let driveStep = 0;
        if (isDrivingRover) {
          const turnRate = 1.9;
          roverNav.yaw -= rightInput * turnRate * dt;
          const driveSpeed = fwdInput * 5.4;
          driveStep = driveSpeed * dt;
          const rx = roverNav.x + Math.sin(roverNav.yaw) * driveStep;
          const rz = roverNav.z + Math.cos(roverNav.yaw) * driveStep;
          const resolved = resolveObstaclesAndPerimeter(rx, rz, 0.95);
          roverNav.x = resolved.x;
          roverNav.z = resolved.z;
          if (resolved.hitBoundary) callbacksRef.current.onBoundaryWarning?.(true);
        } else {
          // Autonomous waypoint steering with potential-field obstacle avoidance
          const wp = ROVER_WAYPOINTS[roverNav.waypointIdx];
          let steerX = wp.x - roverNav.x;
          let steerZ = wp.z - roverNav.z;
          const wpDist = Math.hypot(steerX, steerZ);
          if (wpDist < 1.6) {
            roverNav.waypointIdx = (roverNav.waypointIdx + 1) % ROVER_WAYPOINTS.length;
          }
          if (wpDist > 0.01) {
            steerX /= wpDist;
            steerZ /= wpDist;
          }

          // Repel smoothly from every building, Storm Flue, Ship, Flag, Astronaut, and Rock
          const addRepulsion = (ox: number, oz: number, safeDist: number, weight: number) => {
            const dx = roverNav.x - ox;
            const dz = roverNav.z - oz;
            const d = Math.hypot(dx, dz);
            if (d < safeDist && d > 0.01) {
              const strength = ((safeDist - d) / safeDist) * weight;
              steerX += (dx / d) * strength;
              steerZ += (dz / d) * strength;
            }
          };

          for (const b of currentState.buildings) {
            const bp = getBuildingWorldPos(b.cellIndex);
            addRepulsion(bp.x, bp.z, 3.6, 2.8);
          }
          addRepulsion(STORM_FLUE_POS.x, STORM_FLUE_POS.z, 3.3, 2.6);
          addRepulsion(SPACESHIP_POS.x, SPACESHIP_POS.z, 4.4, 3.0);
          for (const ae of astroEntries) {
            if (!ae.shelteredInside) addRepulsion(ae.x, ae.z, 2.2, 2.5);
          }
          for (const rk of currentRockColliders) {
            addRepulsion(rk.x, rk.z, rk.radius + 2.4, 2.4);
          }
          for (const zf of currentZoneFeatures) {
            if (zf.kind === 'methane_lake') addRepulsion(zf.x, zf.z, zf.radius + 2.4, 3.2);
          }

          const targetYaw = Math.atan2(steerX, steerZ);
          let yawDiff = targetYaw - roverNav.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          roverNav.yaw += yawDiff * Math.min(1, dt * 2.8);

          driveStep = roverNav.speed * dt;
          const rx = roverNav.x + Math.sin(roverNav.yaw) * driveStep;
          const rz = roverNav.z + Math.cos(roverNav.yaw) * driveStep;
          const resolved = resolveObstaclesAndPerimeter(rx, rz, 0.95);
          roverNav.x = resolved.x;
          roverNav.z = resolved.z;
        }

        const ry = groundHeightAt(planetId, roverNav.x, roverNav.z);
        const fSampleY = groundHeightAt(
          planetId,
          roverNav.x + Math.sin(roverNav.yaw) * 0.75,
          roverNav.z + Math.cos(roverNav.yaw) * 0.75
        );
        const rSampleY = groundHeightAt(
          planetId,
          roverNav.x + Math.cos(roverNav.yaw) * 0.65,
          roverNav.z - Math.sin(roverNav.yaw) * 0.65
        );
        roverGroup.position.set(roverNav.x, ry, roverNav.z);
        roverGroup.rotation.order = 'YXZ';
        roverGroup.rotation.set(
          Math.atan2(ry - fSampleY, 0.75) * 0.85,
          roverNav.yaw,
          Math.atan2(ry - rSampleY, 0.65) * 0.7
        );

        const roverRefs = roverGroup.userData.roverRefs;
        if (roverRefs?.wheelRefs) {
          roverNav.wheelSpin += driveStep / 0.24;
          roverRefs.wheelRefs.forEach((wPivot: THREE.Group) => {
            wPivot.rotation.x = roverNav.wheelSpin;
          });
        }
      }

      // 3. Animate Titan Dragonfly Drone / Europa Cryo-Drill / Flag cloth / Storm Flue / Starship
      if (planetId === 'titan') {
        const dAng = elapsed * 0.35;
        const dx = Math.sin(dAng) * 11.5;
        const dz = Math.sin(dAng * 2) * 7.5 + 2.0;
        const dy = groundHeightAt('titan', dx, dz) + 4.4 + Math.sin(elapsed * 2.1) * 0.4;
        titanDrone.position.set(dx, dy, dz);
        titanDrone.rotation.y = Math.atan2(Math.cos(dAng) * 11.5, Math.cos(dAng * 2) * 15);
        const dRefs = titanDrone.userData.droneRefs;
        if (dRefs?.rotors) {
          dRefs.rotors.forEach((r: THREE.Group, idx: number) => {
            r.rotation.y += dt * (idx % 2 === 0 ? 28 : -28);
          });
        }
      }

      if (planetId === 'europa') {
        const pRefs = europaProbe.userData.probeRefs;
        if (pRefs?.drillShaft) {
          pRefs.drillShaft.rotation.y += dt * 4.5;
          pRefs.drillShaft.position.y = 0.72 + Math.sin(elapsed * 5) * 0.08;
        }
      }

      if (plantedFlagGroup.visible && plantedFlagGroup.userData.plantedFlagRefs?.flagPivot) {
        const breezeSpeed = planetId === 'moon' || planetId === 'europa' ? 1.8 : 3.6;
        plantedFlagGroup.userData.plantedFlagRefs.flagPivot.rotation.y =
          Math.sin(elapsed * breezeSpeed) * 0.16;
      }

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

      dataNodesGroup.children.forEach((nodeObj, idx) => {
        const nodeRefs = nodeObj.userData.nodeRefs;
        if (nodeRefs) {
          nodeRefs.scanRing.rotation.y += dt * 1.4;
          nodeRefs.scanRing.position.y = 1.55 + Math.sin(elapsed * 2.2 + idx) * 0.08;
        }
      });

      const shipRefs = spaceshipGroup.userData.spaceshipRefs;
      if (shipRefs) {
        shipRefs.beaconMat.emissiveIntensity = 0.45 + 0.35 * Math.sin(elapsed * 3.1);
      }

      // 4. Deep Sky Meteors + Solar Eclipse Dimming + Surface Weather Particles
      const eclipseFactor = planetId === 'moon' && currentState.lunarState.eclipseActive ? 1 : 0;
      currentTerrainBundle?.updateSkyEffects(elapsed, dt, {
        eclipseFactor,
        earthVisPct: currentState.comms.earthVisibilityPct,
      });

      const evtId = currentState.activeEvent?.id;
      const isStormActive =
        currentState.shelterRefugeActive ||
        currentState.stormFlue.cloggedPct >= 55 ||
        evtId === 'dust_storm' ||
        evtId === 'storm_flue_clog' ||
        evtId === 'europa_cryo_surge';
      const baseSpec = getPlanetEnvironmentSpec(planetId);

      // Smooth Sun/Hemi intensity with Lunar Solar Eclipse
      const targetSunInt = baseSpec.sunIntensity * (1 - eclipseFactor * 0.84) * (isStormActive ? 0.62 : 1.0);
      const targetHemiInt = baseSpec.hemiIntensity * (1 - eclipseFactor * 0.55);
      sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, targetSunInt, 2.5, dt);
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, targetHemiInt, 2.5, dt);

      const targetStormAlpha = isStormActive ? 0.62 : planetId === 'titan' ? 0.25 : 0;
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
        const fallDown = planetId === 'titan'; // Methane rain on Titan!
        for (let i = 0; i < stormCount; i++) {
          let sx = stormPos[i * 3] + (fallDown ? 4.5 : 15.5) * dt;
          let sy = stormPos[i * 3 + 1] + (fallDown ? -7.5 : 0) * dt;
          let sz = stormPos[i * 3 + 2] + (fallDown ? 1.5 : 6.5) * dt;
          if (sx > 22) sx -= 44;
          if (sz > 20) sz -= 40;
          if (sy < 0.2) sy = 12;
          stormPos[i * 3] = sx;
          stormPos[i * 3 + 1] = sy;
          stormPos[i * 3 + 2] = sz;
        }
        sAttr.needsUpdate = true;
      }

      // 5. Camera Modes: First-Person Visor POV vs Follow vs Overview
      const camMode = cameraModeRef.current;
      if (camMode === 'first_person') {
        controls.enabled = false;
        const bob = activeMoving && activeEntry.grounded ? Math.sin(activeEntry.walkPhase * 2) * 0.03 : 0;
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
        controls.enabled = true;
        if (camMode === 'follow') {
          const focusX = isDrivingRover ? roverNav.x : activeEntry.x;
          const focusY = isDrivingRover ? roverGroup.position.y + 1.0 : activeEntry.mesh.position.y + 1.15;
          const focusZ = isDrivingRover ? roverNav.z : activeEntry.z;
          _desiredTarget.set(focusX, focusY, focusZ);
          _targetDelta.subVectors(_desiredTarget, controls.target).multiplyScalar(Math.min(1, dt * 6));
          controls.target.add(_targetDelta);
          camera.position.add(_targetDelta);
        }
        controls.update();
      }

      // 6. Proximity Target Detection
      let closestTarget: NearbyTarget | null = null;
      let bestDist = Infinity;

      const flueDist = Math.hypot(activeEntry.x - STORM_FLUE_POS.x, activeEntry.z - STORM_FLUE_POS.z);
      if (flueDist < 3.7) {
        bestDist = flueDist;
        closestTarget = {
          kind: 'storm_flue',
          id: 'storm_flue',
          label: 'Outpost Storm Flue',
          sublabel: `Clog ${currentState.stormFlue.cloggedPct}% · ${currentState.stormFlue.pressureKpa} kPa`,
          actionLabel: 'Inspect Storm Flue',
        };
      }

      const shipDist = Math.hypot(activeEntry.x - SPACESHIP_POS.x, activeEntry.z - SPACESHIP_POS.z);
      if (shipDist < 4.5 && shipDist < bestDist) {
        bestDist = shipDist;
        closestTarget = {
          kind: 'spaceship',
          id: 'spaceship',
          label: 'NASA Expedition Starship',
          sublabel: `Ship Propellant ${currentState.fuel.shipTankPct}% · Outpost Reserve ${currentState.fuel.current}%`,
          actionLabel: 'Open Fuel & Propellant Bay',
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
            sublabel: b.damaged
              ? `DAMAGED (${b.conditionPct}%) — Needs Spare Parts`
              : doneToday
              ? `${activeAstro.name} completed shift today`
              : activeAstro.taskTitle,
            actionLabel: b.damaged
              ? 'Inspect Damage'
              : doneToday
              ? 'Inspect Module'
              : `Run ${activeAstro.name}'s Shift`,
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

      // Throttled 2D minimap coordinate sync
      posUpdateCooldown -= dt;
      if (posUpdateCooldown <= 0 && callbacksRef.current.onPositionUpdate) {
        posUpdateCooldown = 0.25;
        callbacksRef.current.onPositionUpdate({
          astronauts: astroEntries.map((ae) => ({ id: ae.profile.id, x: ae.x, z: ae.z })),
          rover: { x: roverNav.x, z: roverNav.z, yaw: roverNav.yaw },
        });
      }

      // 7. Render with AAA bloom & ACES tone mapping
      pipeline.renderFrame();

      // 8. Project Floating Labels
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      astroEntries.forEach((entry) => {
        if (!entry.mesh.visible) {
          const el = labelRefs.current[`astro-${entry.profile.id}`];
          if (el) el.style.opacity = '0';
          return;
        }
        projectLabelToScreen(
          `astro-${entry.profile.id}`,
          entry.x,
          entry.mesh.position.y + 2.15,
          entry.z,
          w,
          h
        );
      });
      projectLabelToScreen(
        'storm-flue',
        STORM_FLUE_POS.x,
        stormFlueGroup.position.y + 4.1,
        STORM_FLUE_POS.z,
        w,
        h
      );
      projectLabelToScreen(
        'nasa-spaceship',
        SPACESHIP_POS.x,
        spaceshipGroup.position.y + 5.7,
        SPACESHIP_POS.z,
        w,
        h
      );
      const curFlag = currentState.flagsByWorld[planetId];
      if (curFlag?.planted) {
        projectLabelToScreen(
          'planted-flag',
          curFlag.x,
          plantedFlagGroup.position.y + 3.1,
          curFlag.z,
          w,
          h
        );
      } else {
        const el = labelRefs.current['planted-flag'];
        if (el) el.style.opacity = '0';
      }
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
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();

      if (currentTerrainBundle) currentTerrainBundle.dispose();
      [spaceshipGroup, plantedFlagGroup, roverGroup, stormFlueGroup, titanDrone, europaProbe].forEach(
        (grp) => {
          grp.traverse((obj) => {
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
        }
      );
      stormGeo.dispose();
      stormMat.dispose();
      shadowTex.dispose();
      solarTex.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      controls.dispose();
      pipeline.dispose();
    };
  }, []);

  useEffect(() => {
    syncActionsRef.current?.syncPlanet(state.planetId);
    syncActionsRef.current?.syncBuildings();
    syncActionsRef.current?.syncDataNodes();
    syncActionsRef.current?.syncFlag();
    syncActionsRef.current?.syncCustomizations();
  }, [
    state.planetId,
    state.buildings,
    state.dataNodes,
    state.flagsByWorld,
    state.crewCustomizations,
  ]);

  useEffect(() => {
    syncActionsRef.current?.focusAstronaut(state.activeAstronautId);
  }, [state.activeAstronautId, cameraMode]);

  const activeFlag = state.flagsByWorld[state.planetId];

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ASTRONAUTS.map((astro) => {
          const isActive = state.activeAstronautId === astro.id;
          const done = state.crewProgress[astro.id]?.currentTaskDone;
          const hasMed = state.crewVitals[astro.id]?.medicalAlert;
          return (
            <div
              key={astro.id}
              ref={(el) => {
                labelRefs.current[`astro-${astro.id}`] = el;
              }}
              style={{ opacity: 0 }}
              className={`absolute top-0 left-0 px-2 py-0.5 rounded-full astra-glass-pill text-[11px] font-mono whitespace-nowrap transition-colors ${
                hasMed
                  ? 'border-rose-400/75 text-rose-100 font-bold'
                  : isActive
                  ? 'border-cyan-400/75 text-white font-bold'
                  : 'border-white/20 text-slate-200'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: astro.suitColor }}
              />
              {astro.name}
              {done && <span className="ml-1 text-emerald-400">✓</span>}
              {hasMed && <span className="ml-1 text-rose-300">✚</span>}
            </div>
          );
        })}

        <div
          ref={(el) => {
            labelRefs.current['storm-flue'] = el;
          }}
          style={{ opacity: 0 }}
          className={`absolute top-0 left-0 px-2 py-0.5 rounded-full astra-glass-pill text-[10px] font-mono whitespace-nowrap ${
            state.stormFlue.status === 'critical'
              ? 'border-rose-400/75 text-rose-200'
              : state.stormFlue.status === 'warning'
              ? 'border-amber-400/75 text-amber-200'
              : 'border-white/20 text-emerald-300'
          }`}
        >
          Storm Flue · {state.stormFlue.cloggedPct}% Clog
        </div>

        <div
          ref={(el) => {
            labelRefs.current['nasa-spaceship'] = el;
          }}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 px-2 py-0.5 rounded-full astra-glass-pill border-emerald-400/60 text-[10px] font-mono text-emerald-200 whitespace-nowrap"
        >
          NASA Starship · Fuel {state.fuel.shipTankPct}%
        </div>

        <div
          ref={(el) => {
            labelRefs.current['planted-flag'] = el;
          }}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 px-2 py-0.5 rounded-full astra-glass-pill border-emerald-400/75 text-[10px] font-mono text-emerald-100 whitespace-nowrap"
        >
          ⚑ {activeFlag?.siteLabel || 'Expedition Flag'}
        </div>

        {state.dataNodes.map((node) => (
          <div
            key={node.id}
            ref={(el) => {
              labelRefs.current[`node-${node.id}`] = el;
            }}
            style={{ opacity: 0 }}
            className={`absolute top-0 left-0 px-2 py-0.5 rounded-full astra-glass-pill text-[10px] font-mono whitespace-nowrap ${
              node.collected
                ? 'border-emerald-400/60 text-emerald-200'
                : 'border-cyan-400/60 text-cyan-200'
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
