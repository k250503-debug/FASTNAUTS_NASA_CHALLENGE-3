import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createBuildingMesh,
  createContactShadowTexture,
  createSolarGridTexture,
  setShelterDoorsOpen,
} from './models';
import { createAAARenderPipeline, detectSoftwareWebGL } from './postfx';
import { createTerrainAndSkyGroup, getPlanetEnvironmentSpec, groundHeightAt } from './terrain';
import type { BuildingTypeId, PlacedBuilding, PlanetId } from '../types';

export const ALL_BUILDER_MODULE_IDS: BuildingTypeId[] = [
  'habitat',
  'solar',
  'water_recycler',
  'greenhouse',
  'radiation_shelter',
  'battery',
  'isru_plant',
  'comms',
  'medical_station',
  'workshop',
  'fuel_depot',
  'rover_garage',
  'research_lab',
  'storage_depot',
];

export const BUILDER_PAD_CELL_SLOTS: number[] = [
  5, 6, 9, 10, 1, 2, 4, 7, 8, 11, 0, 3, 12, 13, 14, 15,
];

export function getBuilderBuildingPos(cellIndex: number): { x: number; z: number } {
  const col = cellIndex % 4;
  const row = Math.floor(cellIndex / 4);
  return {
    x: (col - 1.5) * 3.8,
    z: (row - 1.5) * 3.8,
  };
}

/**
 * Generates crisp 3D isometric thumbnail data URLs for all outpost modules
 * using one ephemeral WebGLRenderer (immediately disposed, zero persistent extra contexts).
 */
export function renderAllModuleThumbnails(): Partial<Record<BuildingTypeId, string>> {
  if (typeof document === 'undefined' || detectSoftwareWebGL()) return {};
  try {
    const width = 360;
    const height = 240;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(3.45, 2.6, 3.9);
    camera.lookAt(0, 0.95, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.35;

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1d6, 1.55);
    key.position.set(5, 7, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(2);
    const result: Partial<Record<BuildingTypeId, string>> = {};

    ALL_BUILDER_MODULE_IDS.forEach((id) => {
      const mesh = createBuildingMesh(id, 1, true, shadowTex, solarTex);
      mesh.rotation.y =
        id === 'habitat' || id === 'radiation_shelter' || id === 'medical_station'
          ? -0.35
          : 0.28;
      scene.add(mesh);
      renderer.render(scene, camera);
      result[id] = renderer.domElement.toDataURL('image/png');
      scene.remove(mesh);
      mesh.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
    });

    shadowTex.dispose();
    solarTex.dispose();
    envRT.dispose();
    roomEnv.dispose();
    pmrem.dispose();
    renderer.dispose();
    return result;
  } catch {
    return {};
  }
}

export const renderCoreModuleThumbnails = renderAllModuleThumbnails;

interface BuiltAnimEntry {
  uid: string;
  typeId: BuildingTypeId;
  root: THREE.Group;
  mesh: THREE.Group;
  dustRing: THREE.Mesh;
  dustRingMat: THREE.MeshBasicMaterial;
  dustParticles: THREE.Points;
  dustParticlesMat: THREE.PointsMaterial;
  dustGeo: THREE.BufferGeometry;
  dustSeeds: Float32Array;
  growLight?: THREE.PointLight;
  age: number;
  duration: number;
  baseY: number;
  x: number;
  z: number;
}

interface OutpostBuilderScene3DProps {
  planetId: PlanetId;
  buildings: PlacedBuilding[];
  focusedTypeId?: BuildingTypeId | null;
}

const DUST_COUNT = 26;

export default function OutpostBuilderScene3D({
  planetId,
  buildings,
  focusedTypeId,
}: OutpostBuilderScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const planetRef = useRef(planetId);
  const buildingsRef = useRef(buildings);
  const focusRef = useRef(focusedTypeId);

  planetRef.current = planetId;
  buildingsRef.current = buildings;
  focusRef.current = focusedTypeId;

  const syncRefs = useRef<{
    syncPlanet: (id: PlanetId) => void;
    syncBuildings: (next: PlacedBuilding[]) => void;
  } | null>(null);

  useEffect(() => {
    syncRefs.current?.syncPlanet(planetId);
  }, [planetId]);

  useEffect(() => {
    syncRefs.current?.syncBuildings(buildings);
  }, [buildings]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const spec = getPlanetEnvironmentSpec(planetRef.current);
    scene.background = new THREE.Color(spec.skyColor);
    scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || 720) / (container.clientHeight || 460),
      0.2,
      200
    );
    camera.position.set(11.2, 9.4, 14.6);

    const pipeline = createAAARenderPipeline(container, scene, camera, {
      bloomStrength: 0.08,
      bloomRadius: 0.32,
      bloomThreshold: 1.15,
      exposure: 0.94,
    });
    const { renderer, isSoftwareGl } = pipeline;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.455;
    controls.minDistance = 6.5;
    controls.maxDistance = 32;
    controls.target.set(0, 0.9, 0);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.3;

    const hemiLight = new THREE.HemisphereLight(
      spec.hemiSkyColor,
      spec.hemiGroundColor,
      spec.hemiIntensity
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(spec.sunColor, spec.sunIntensity);
    sunLight.position.set(16, 24, 14);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 65;
    sunLight.shadow.camera.left = -18;
    sunLight.shadow.camera.right = 18;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -18;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.28);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(maxAnisotropy);

    const envGroup = new THREE.Group();
    scene.add(envGroup);
    let terrainBundle: ReturnType<typeof createTerrainAndSkyGroup> | null = null;
    let currentPlanetId: PlanetId | null = null;

    // Subtle holographic construction pads on the terrain (all 16 grid positions)
    const padsGroup = new THREE.Group();
    scene.add(padsGroup);
    const padRings: THREE.Mesh[] = [];
    BUILDER_PAD_CELL_SLOTS.forEach((cellIdx) => {
      const p = getBuilderBuildingPos(cellIdx);
      const ringGeo = new THREE.RingGeometry(1.48, 1.66, 36);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(p.x, 0.04, p.z);
      padsGroup.add(ring);
      padRings.push(ring);
    });

    const buildingsLayer = new THREE.Group();
    scene.add(buildingsLayer);
    const activeEntries = new Map<string, BuiltAnimEntry>();

    const disposeEntry = (entry: BuiltAnimEntry) => {
      buildingsLayer.remove(entry.root);
      entry.dustGeo.dispose();
      entry.dustParticlesMat.dispose();
      entry.dustRing.geometry.dispose();
      entry.dustRingMat.dispose();
      entry.mesh.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            const std = mat as THREE.MeshStandardMaterial;
            if (std.map && std.map !== shadowTex && std.map !== solarTex) std.map.dispose();
            mat.dispose();
          });
        }
      });
    };

    const spawnBuildingEntry = (b: PlacedBuilding) => {
      const pos = getBuilderBuildingPos(b.cellIndex);
      const baseY = groundHeightAt(planetRef.current, pos.x, pos.z);
      const root = new THREE.Group();
      root.position.set(pos.x, baseY, pos.z);

      const mesh = createBuildingMesh(b.typeId, b.level, true, shadowTex, solarTex);
      root.add(mesh);

      const ringGeo = new THREE.RingGeometry(1.1, 1.55, 36);
      ringGeo.rotateX(-Math.PI / 2);
      const dustRingMat = new THREE.MeshBasicMaterial({
        color:
          planetRef.current === 'mars'
            ? 0xfb923c
            : planetRef.current === 'titan'
            ? 0xfacc15
            : 0xbae6fd,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      const dustRing = new THREE.Mesh(ringGeo, dustRingMat);
      dustRing.position.y = 0.06;
      root.add(dustRing);

      const dustPositions = new Float32Array(DUST_COUNT * 3);
      const dustSeeds = new Float32Array(DUST_COUNT * 2);
      for (let i = 0; i < DUST_COUNT; i++) {
        dustSeeds[i * 2] = (i / DUST_COUNT) * Math.PI * 2 + (i % 3) * 0.2;
        dustSeeds[i * 2 + 1] = 0.75 + ((i * 17) % 10) * 0.08;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dustParticlesMat = new THREE.PointsMaterial({
        color:
          planetRef.current === 'mars'
            ? 0xfdba74
            : planetRef.current === 'titan'
            ? 0xfde047
            : 0xe2e8f0,
        size: 0.24,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const dustParticles = new THREE.Points(dustGeo, dustParticlesMat);
      root.add(dustParticles);

      let growLight: THREE.PointLight | undefined;
      if (b.typeId === 'greenhouse') {
        growLight = new THREE.PointLight(0x4ade80, 0, 5.5, 1.8);
        growLight.position.set(0, 0.9, 0);
        root.add(growLight);
      } else if (b.typeId === 'radiation_shelter') {
        growLight = new THREE.PointLight(0xf59e0b, 0, 4.5, 1.8);
        growLight.position.set(0, 0.85, 1.25);
        root.add(growLight);
      }

      buildingsLayer.add(root);

      activeEntries.set(b.uid, {
        uid: b.uid,
        typeId: b.typeId,
        root,
        mesh,
        dustRing,
        dustRingMat,
        dustParticles,
        dustParticlesMat,
        dustGeo,
        dustSeeds,
        growLight,
        age: 0,
        duration: 1.45,
        baseY,
        x: pos.x,
        z: pos.z,
      });
    };

    const syncBuildings = (nextList: PlacedBuilding[]) => {
      const nextIds = new Set(nextList.map((b) => b.uid));
      Array.from(activeEntries.keys()).forEach((uid) => {
        if (!nextIds.has(uid)) {
          const entry = activeEntries.get(uid);
          if (entry) disposeEntry(entry);
          activeEntries.delete(uid);
        }
      });

      nextList.forEach((b) => {
        if (!activeEntries.has(b.uid)) {
          spawnBuildingEntry(b);
        }
      });
    };

    const syncPlanet = (id: PlanetId) => {
      if (currentPlanetId === id) return;
      currentPlanetId = id;
      if (terrainBundle) {
        terrainBundle.dispose();
        terrainBundle = null;
      }
      while (envGroup.children.length > 0) {
        envGroup.remove(envGroup.children[0]);
      }

      const nextSpec = getPlanetEnvironmentSpec(id);
      scene.background = new THREE.Color(nextSpec.skyColor);
      scene.fog = new THREE.FogExp2(nextSpec.fogColor, nextSpec.fogDensity);
      hemiLight.color.setHex(nextSpec.hemiSkyColor);
      hemiLight.groundColor.setHex(nextSpec.hemiGroundColor);
      hemiLight.intensity = nextSpec.hemiIntensity;
      sunLight.color.setHex(nextSpec.sunColor);
      sunLight.intensity = nextSpec.sunIntensity;

      terrainBundle = createTerrainAndSkyGroup(id, maxAnisotropy);
      envGroup.add(terrainBundle.group);

      BUILDER_PAD_CELL_SLOTS.forEach((cellIdx, i) => {
        const p = getBuilderBuildingPos(cellIdx);
        padRings[i].position.y = groundHeightAt(id, p.x, p.z) + 0.04;
      });
      activeEntries.forEach((entry) => {
        entry.baseY = groundHeightAt(id, entry.x, entry.z);
        entry.root.position.y = entry.baseY;
      });
    };

    syncRefs.current = { syncPlanet, syncBuildings };
    syncPlanet(planetRef.current);
    syncBuildings(buildingsRef.current);

    let disposed = false;
    let contextLost = false;
    let frameId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
    const onContextRestored = () => {
      contextLost = false;
      lastTime = performance.now();
      scheduleNext();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const tick = () => {
      if (disposed || contextLost) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      terrainBundle?.updateSkyEffects(elapsed, dt);

      activeEntries.forEach((entry) => {
        entry.age += dt;
        const p = Math.min(1, entry.age / entry.duration);
        const easeOut = 1 - Math.pow(1 - p, 3);
        const isFocused = focusRef.current === entry.typeId;

        if (entry.typeId === 'habitat') {
          const dropY = (1 - easeOut) * 3.4;
          entry.mesh.position.y = dropY;
          entry.mesh.scale.set(
            0.55 + 0.45 * easeOut,
            0.4 + 0.6 * easeOut,
            0.55 + 0.45 * easeOut
          );
          const doorCycle =
            p > 0.55 && p < 0.92 ? Math.sin(((p - 0.55) / 0.37) * Math.PI) : 0;
          setShelterDoorsOpen(entry.mesh, doorCycle);
        } else if (entry.typeId === 'radiation_shelter') {
          // Heavy armored bunker drops solidly onto pad and cycles its blast doors
          const dropY = (1 - easeOut) * 3.1;
          entry.mesh.position.y = dropY;
          entry.mesh.scale.set(
            0.7 + 0.3 * easeOut,
            0.45 + 0.55 * easeOut,
            0.7 + 0.3 * easeOut
          );
          const doorCycle =
            p > 0.52 && p < 0.94 ? Math.sin(((p - 0.52) / 0.42) * Math.PI) : 0;
          setShelterDoorsOpen(entry.mesh, doorCycle);
          if (entry.growLight) {
            entry.growLight.intensity = 0.7 * easeOut + 0.25 * doorCycle;
          }
        } else if (entry.typeId === 'solar') {
          const mastP = Math.min(1, p / 0.48);
          const wingP = Math.max(0, Math.min(1, (p - 0.35) / 0.65));
          const mastEase = 1 - Math.pow(1 - mastP, 3);
          const wingEase = 1 - Math.pow(1 - wingP, 3);
          entry.mesh.position.y = 0;
          entry.mesh.scale.set(
            0.28 + 0.72 * wingEase,
            0.15 + 0.85 * mastEase,
            0.5 + 0.5 * wingEase
          );
          entry.mesh.rotation.y = Math.sin(elapsed * 0.35 + entry.x) * 0.14;
        } else if (entry.typeId === 'water_recycler') {
          const assembleEase = 1 - Math.pow(1 - p, 3);
          entry.mesh.position.y = (1 - assembleEase) * 1.4;
          entry.mesh.scale.set(
            0.65 + 0.35 * assembleEase,
            0.25 + 0.75 * assembleEase,
            0.65 + 0.35 * assembleEase
          );
          const refs = entry.mesh.userData.buildingRefs as
            | { statusMat?: THREE.MeshStandardMaterial }
            | undefined;
          if (refs?.statusMat) {
            refs.statusMat.color.setHex(0x22d3ee);
            refs.statusMat.emissive.setHex(0x06b6d4);
            refs.statusMat.emissiveIntensity = 0.55 + 0.35 * Math.sin(elapsed * 3.5);
          }
        } else if (entry.typeId === 'greenhouse') {
          const cropEase = 1 - Math.pow(1 - Math.min(1, p / 0.7), 3);
          entry.mesh.position.y = 0;
          entry.mesh.scale.set(
            0.7 + 0.3 * easeOut,
            0.22 + 0.78 * cropEase,
            0.7 + 0.3 * easeOut
          );
          if (entry.growLight) {
            entry.growLight.intensity = 1.4 * easeOut + Math.sin(elapsed * 2.2) * 0.15;
          }
        } else if (entry.typeId === 'comms') {
          entry.mesh.position.y = (1 - easeOut) * 1.1;
          entry.mesh.scale.set(0.6 + 0.4 * easeOut, 0.2 + 0.8 * easeOut, 0.6 + 0.4 * easeOut);
          entry.mesh.rotation.y = Math.sin(elapsed * 0.45 + entry.z) * 0.28;
        } else if (entry.typeId === 'isru_plant') {
          entry.mesh.position.y = (1 - easeOut) * 2.2;
          entry.mesh.scale.set(0.65 + 0.35 * easeOut, 0.3 + 0.7 * easeOut, 0.65 + 0.35 * easeOut);
          if (p < 0.95) {
            entry.mesh.rotation.y = (1 - easeOut) * Math.PI * 1.5;
          }
        } else if (entry.typeId === 'battery') {
          entry.mesh.position.y = (1 - easeOut) * 1.8;
          entry.mesh.scale.set(0.7 + 0.3 * easeOut, 0.25 + 0.75 * easeOut, 0.7 + 0.3 * easeOut);
          const refs = entry.mesh.userData.buildingRefs as
            | { statusMat?: THREE.MeshStandardMaterial }
            | undefined;
          if (refs?.statusMat) {
            refs.statusMat.color.setHex(0xf59e0b);
            refs.statusMat.emissive.setHex(0xf59e0b);
            refs.statusMat.emissiveIntensity = 0.5 + 0.4 * Math.sin(elapsed * 4.0);
          }
        } else {
          entry.mesh.position.y = (1 - easeOut) * 2.2;
          entry.mesh.scale.set(
            0.6 + 0.4 * easeOut,
            0.35 + 0.65 * easeOut,
            0.6 + 0.4 * easeOut
          );
        }

        // Subtle focus beacon pulse when hovering a module card
        const refs = entry.mesh.userData.buildingRefs as
          | { beacon?: THREE.Mesh }
          | undefined;
        if (refs?.beacon) {
          const pulse = isFocused ? 1.45 + 0.35 * Math.sin(elapsed * 6) : 1.0;
          refs.beacon.scale.setScalar(pulse);
        }

        // Dust impact ring & radial construction particles during assembly
        if (p < 1) {
          const impactP = Math.max(0, Math.min(1, (p - 0.12) / 0.88));
          entry.dustRing.visible = true;
          entry.dustRing.scale.setScalar(0.65 + impactP * 2.1);
          entry.dustRingMat.opacity = (1 - impactP) * 0.65;

          entry.dustParticles.visible = true;
          entry.dustParticlesMat.opacity = (1 - impactP) * 0.7;
          const attr = entry.dustGeo.attributes.position as THREE.BufferAttribute;
          const posArr = attr.array as Float32Array;
          for (let i = 0; i < DUST_COUNT; i++) {
            const ang = entry.dustSeeds[i * 2];
            const spd = entry.dustSeeds[i * 2 + 1];
            const rad = 0.6 + impactP * 2.7 * spd;
            posArr[i * 3] = Math.cos(ang) * rad;
            posArr[i * 3 + 1] = 0.15 + Math.sin(impactP * Math.PI) * 0.75 * spd;
            posArr[i * 3 + 2] = Math.sin(ang) * rad;
          }
          attr.needsUpdate = true;
        } else {
          entry.dustRing.visible = false;
          entry.dustParticles.visible = false;
        }
      });

      controls.update();
      pipeline.renderFrame();
      scheduleNext();
    };

    const scheduleNext = () => {
      if (disposed || contextLost) return;
      if (isSoftwareGl) timerId = window.setTimeout(tick, 75);
      else frameId = requestAnimationFrame(tick);
    };

    const handleResize = () => {
      pipeline.resize(container.clientWidth || 720, container.clientHeight || 460, camera);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      activeEntries.forEach((entry) => disposeEntry(entry));
      activeEntries.clear();
      padRings.forEach((r) => {
        r.geometry.dispose();
        (r.material as THREE.Material).dispose();
      });
      terrainBundle?.dispose();
      shadowTex.dispose();
      solarTex.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      controls.dispose();
      pipeline.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}
