import * as THREE from 'three';
import type { PlanetId } from '../types';

export const ROAMING_RADIUS = 24;

export interface RockCollider {
  x: number;
  z: number;
  radius: number;
}

export interface WorldZoneFeature {
  kind: 'psr_crater' | 'methane_lake' | 'cryo_plume';
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface PlanetEnvironmentSpec {
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  terrainBaseHex: string;
  terrainAccentHex: string;
  rockColor: number;
  celestialBody?: {
    color: number;
    emissive: number;
    radius: number;
    position: [number, number, number];
    hasRings?: boolean;
    ringColor?: number;
  };
}

export function getPlanetEnvironmentSpec(planetId: PlanetId): PlanetEnvironmentSpec {
  switch (planetId) {
    case 'moon':
      return {
        skyColor: 0x03050a,
        fogColor: 0x050810,
        fogDensity: 0.008,
        sunColor: 0xfff8eb,
        sunIntensity: 1.52,
        hemiSkyColor: 0x64748b,
        hemiGroundColor: 0x1e293b,
        hemiIntensity: 0.40,
        terrainBaseHex: '#68707d',
        terrainAccentHex: '#3f4652',
        rockColor: 0x737b88,
        celestialBody: {
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          radius: 7.5,
          position: [-45, 36, -80],
        },
      };
    case 'mars':
      return {
        skyColor: 0x1c100a,
        fogColor: 0x2a160c,
        fogDensity: 0.014,
        sunColor: 0xffd7b3,
        sunIntensity: 1.44,
        hemiSkyColor: 0xc2611b,
        hemiGroundColor: 0x451a03,
        hemiIntensity: 0.46,
        terrainBaseHex: '#a34e2e',
        terrainAccentHex: '#6c2f1a',
        rockColor: 0x843b20,
        celestialBody: {
          color: 0xcbd5e1,
          emissive: 0x475569,
          radius: 2.3,
          position: [38, 32, -75],
        },
      };
    case 'titan':
      return {
        skyColor: 0x221608,
        fogColor: 0x2f1e0a,
        fogDensity: 0.017,
        sunColor: 0xfbbf24,
        sunIntensity: 1.32,
        hemiSkyColor: 0xd97706,
        hemiGroundColor: 0x3b240b,
        hemiIntensity: 0.50,
        terrainBaseHex: '#946a37',
        terrainAccentHex: '#593c1b',
        rockColor: 0x5c442b,
        celestialBody: {
          color: 0xeab308,
          emissive: 0x854d0e,
          radius: 10.5,
          position: [48, 35, -86],
          hasRings: true,
          ringColor: 0xfde68a,
        },
      };
    case 'europa':
      return {
        skyColor: 0x040812,
        fogColor: 0x071020,
        fogDensity: 0.01,
        sunColor: 0xe0f2fe,
        sunIntensity: 1.42,
        hemiSkyColor: 0x38bdf8,
        hemiGroundColor: 0x164e63,
        hemiIntensity: 0.45,
        terrainBaseHex: '#9dc8f5',
        terrainAccentHex: '#4b5e73',
        rockColor: 0xbae6fd,
        celestialBody: {
          color: 0xfdba74,
          emissive: 0x9a3412,
          radius: 13.5,
          position: [-50, 38, -92],
        },
      };
  }
}

export function getWorldZoneFeatures(planetId: PlanetId): WorldZoneFeature[] {
  if (planetId === 'moon') {
    return [
      { kind: 'psr_crater', label: 'Shackleton PSR Basin', x: -16.2, z: -14.8, radius: 4.8 },
      { kind: 'psr_crater', label: 'South Rim Shadow Pit', x: 16.5, z: -15.5, radius: 4.0 },
    ];
  }
  if (planetId === 'titan') {
    return [
      { kind: 'methane_lake', label: 'Kraken Methane Inlet', x: -15.8, z: 14.2, radius: 5.4 },
    ];
  }
  if (planetId === 'europa') {
    return [
      { kind: 'cryo_plume', label: 'Conamara Cryo-Plume Vent', x: -14.6, z: -13.6, radius: 2.6 },
    ];
  }
  return [];
}

export function getWorldRockColliders(planetId: PlanetId): RockCollider[] {
  const list: RockCollider[] = [];
  let seed = 4219 + planetId.charCodeAt(0) * 13;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const zones = getWorldZoneFeatures(planetId);
  for (let i = 0; i < 85; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 14.5 + rand() * 40;
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const s = 0.45 + rand() * 1.45;
    // Consume extra random values symmetrically with instancing loop
    const rScaleX = s * (0.85 + rand() * 0.35);
    rand();
    const rScaleZ = s * (0.85 + rand() * 0.35);
    rand();
    rand();
    rand();
    rand();
    // Skip rocks near Spaceship, Storm Flue, or Zone Features
    const nearZone = zones.some((z) => Math.hypot(rx - z.x, rz - z.z) < z.radius + 1.5);
    const nearShip = Math.hypot(rx - 12.4, rz - 4.4) < 4.5;
    if (!nearZone && !nearShip && radius <= ROAMING_RADIUS + 4) {
      list.push({
        x: rx,
        z: rz,
        radius: Math.max(rScaleX, rScaleZ) * 0.72,
      });
    }
  }
  return list;
}

export function groundHeightAt(planetId: PlanetId, x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);
  const padBlend = THREE.MathUtils.smoothstep(distFromCenter, 9.8, 16.5);
  if (padBlend <= 0.001) return 0;

  let rawH = 0;
  if (planetId === 'moon') {
    const rim = Math.sin(x * 0.14) * Math.cos(z * 0.14) * 1.3;
    const craterRim = Math.max(0, 1.8 - Math.hypot(x - 19, z + 15) * 0.17) * 1.1;
    // Permanently Shadowed Region depression
    const psrDip =
      THREE.MathUtils.smoothstep(5.4 - Math.hypot(x + 16.2, z + 14.8), 0, 5.4) * -1.45;
    rawH = rim + craterRim + psrDip + Math.sin(x * 0.35 + z * 0.25) * 0.22;
  } else if (planetId === 'mars') {
    const dune = Math.sin(x * 0.16 + z * 0.08) * 1.1 + Math.cos(z * 0.18) * 0.65;
    // Layered canyon mesa stepped plateaus beyond r=28
    const mesaFactor = THREE.MathUtils.smoothstep(distFromCenter, 26, 36);
    const mesaStep = mesaFactor * Math.min(3.6, Math.floor(Math.max(0, Math.sin(x * 0.09) + Math.cos(z * 0.08)) * 3.2));
    rawH = dune + mesaStep + Math.sin(x * 0.4) * 0.2;
  } else if (planetId === 'titan') {
    const dune =
      Math.sin(x * 0.22 + z * 0.1) * 1.15 + Math.cos(z * 0.12) * 0.4 + Math.sin(x * 0.55) * 0.08;
    // Flatten basin for liquid methane lake at (-15.8, 14.2)
    const lakeDist = Math.hypot(x + 15.8, z - 14.2);
    const lakeBasin = THREE.MathUtils.smoothstep(6.2 - lakeDist, 0, 6.2);
    rawH = THREE.MathUtils.lerp(dune, -0.58, lakeBasin);
  } else {
    // Europa fractured ice blocks & chaotic ridges
    rawH =
      Math.abs(Math.sin(x * 0.2 + z * 0.15)) * 1.35 -
      0.32 +
      Math.cos(x * 0.45 - z * 0.3) * 0.24;
  }

  return rawH * padBlend;
}

function createPlanetGroundMaps(
  planetId: PlanetId,
  maxAnisotropy: number
): { albedoMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const spec = getPlanetEnvironmentSpec(planetId);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = spec.terrainBaseHex;
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  let seed = planetId.charCodeAt(0) * 97 + planetId.charCodeAt(1) * 31;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 1800; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1 + rand() * 4.5;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright ? spec.terrainAccentHex : 'rgba(255,255,255,0.09)';
    ctx.globalAlpha = 0.22 + rand() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    bCtx.fillStyle = bright ? 'rgba(60,60,60,0.35)' : 'rgba(210,210,210,0.35)';
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  if (planetId === 'europa') {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 2.8;
    bCtx.strokeStyle = 'rgba(25,25,25,0.65)';
    bCtx.lineWidth = 3.2;
    for (let i = 0; i < 28; i++) {
      const x1 = rand() * 512;
      const y1 = rand() * 512;
      const x2 = rand() * 512;
      const y2 = rand() * 512;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x1, y1);
      bCtx.lineTo(x2, y2);
      bCtx.stroke();
    }
    // Luminous ice fracture highlights
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(rand() * 512, rand() * 512);
      ctx.lineTo(rand() * 512, rand() * 512);
      ctx.stroke();
    }
  } else if (planetId === 'moon') {
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 30; i++) {
      const cx = rand() * 512;
      const cy = rand() * 512;
      const cr = 8 + rand() * 24;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();

      bCtx.strokeStyle = 'rgba(225,225,225,0.4)';
      bCtx.lineWidth = 2;
      bCtx.beginPath();
      bCtx.arc(cx, cy, cr, 0, Math.PI * 2);
      bCtx.stroke();
    }
  } else if (planetId === 'mars' || planetId === 'titan') {
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 3;
    bCtx.strokeStyle = 'rgba(180,180,180,0.3)';
    bCtx.lineWidth = 4;
    for (let y = 0; y < 512; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + 8, 340, y - 8, 512, y);
      ctx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.bezierCurveTo(170, y + 8, 340, y - 8, 512, y);
      bCtx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(16, 16);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(16, 16);
  bumpMap.anisotropy = maxAnisotropy;

  return { albedoMap, bumpMap };
}

function createHorizonBodyTexture(planetId: PlanetId, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  if (planetId === 'moon') {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(0.25, '#0284c7');
    grad.addColorStop(0.75, '#0369a1');
    grad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(90, 56, 30, 18, 0.2, 0, Math.PI * 2);
    ctx.ellipse(185, 68, 36, 22, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.44)';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.ellipse((i * 37) % 256, 20 + ((i * 23) % 85), 24, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (planetId === 'titan') {
    for (let y = 0; y < 128; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? '#eab308' : '#ca8a04';
      ctx.fillRect(0, y, 256, 8);
    }
  } else if (planetId === 'europa') {
    // Jupiter cloud belts + Great Red Spot
    for (let y = 0; y < 128; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? '#fed7aa' : y % 24 === 0 ? '#9a3412' : '#fb923c';
      ctx.fillRect(0, y, 256, 8);
    }
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(152, 82, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc((i * 41) % 256, (i * 29) % 128, 6 + (i % 4) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSpiralGalaxyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 58);
  grad.addColorStop(0, 'rgba(255, 248, 225, 0.92)');
  grad.addColorStop(0.28, 'rgba(186, 230, 253, 0.55)');
  grad.addColorStop(0.6, 'rgba(167, 139, 250, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // Faint spiral arms
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
  ctx.lineWidth = 3;
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    for (let t = 0; t < 3.2; t += 0.15) {
      const a = t * 1.9 + arm * Math.PI;
      const r = 4 + t * 14;
      const px = 64 + Math.cos(a) * r;
      const py = 64 + Math.sin(a) * r * 0.65;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlanetGroundTexture(
  planetId: PlanetId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  return createPlanetGroundMaps(planetId, maxAnisotropy).albedoMap;
}

export function createTerrainAndSkyGroup(
  planetId: PlanetId,
  maxAnisotropy: number
): {
  group: THREE.Group;
  updateSkyEffects: (elapsed: number, dt: number, opts?: { eclipseFactor?: number; earthVisPct?: number }) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const spec = getPlanetEnvironmentSpec(planetId);
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. High-Density Displaced Planetary Terrain (140m x 140m)
  const terrainGeo = new THREE.PlaneGeometry(140, 140, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, groundHeightAt(planetId, vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const { albedoMap, bumpMap } = createPlanetGroundMaps(planetId, maxAnisotropy);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: albedoMap,
    bumpMap,
    bumpScale: 0.34,
    roughness: planetId === 'europa' ? 0.3 : 0.86,
    metalness: planetId === 'europa' ? 0.14 : 0.04,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, albedoMap, bumpMap, terrainMat);

  // 2. Outpost Central Pad Ring (r=8.2m) + Visible Roaming Perimeter Boundary (ROAMING_RADIUS = 24m)
  const padGeo = new THREE.RingGeometry(8.1, 8.35, 64);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.32,
    roughness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const padRing = new THREE.Mesh(padGeo, padMat);
  padRing.position.y = 0.025;
  group.add(padRing);
  disposables.push(padGeo, padMat);

  // Clear Roaming Perimeter Boundary Ring & 16 Glowing Pylon Markers at R=24m
  const boundaryGroup = new THREE.Group();
  const boundaryPylonGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.95, 10);
  const boundaryTipGeo = new THREE.SphereGeometry(0.11, 10, 10);
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 });
  const boundaryTipMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
  });
  const boundarySegments = 64;
  const lineVerts: number[] = [];
  for (let i = 0; i < boundarySegments; i++) {
    const a1 = (i / boundarySegments) * Math.PI * 2;
    const a2 = ((i + 1) / boundarySegments) * Math.PI * 2;
    const x1 = Math.cos(a1) * ROAMING_RADIUS;
    const z1 = Math.sin(a1) * ROAMING_RADIUS;
    const x2 = Math.cos(a2) * ROAMING_RADIUS;
    const z2 = Math.sin(a2) * ROAMING_RADIUS;
    if (i % 2 === 0) {
      lineVerts.push(
        x1,
        groundHeightAt(planetId, x1, z1) + 0.14,
        z1,
        x2,
        groundHeightAt(planetId, x2, z2) + 0.14,
        z2
      );
    }
  }
  const boundLineGeo = new THREE.BufferGeometry();
  boundLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
  const boundLineMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.72,
  });
  boundaryGroup.add(new THREE.LineSegments(boundLineGeo, boundLineMat));

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const px = Math.cos(a) * ROAMING_RADIUS;
    const pz = Math.sin(a) * ROAMING_RADIUS;
    const py = groundHeightAt(planetId, px, pz);
    const pole = new THREE.Mesh(boundaryPylonGeo, pylonMat);
    pole.position.set(px, py + 0.46, pz);
    const tip = new THREE.Mesh(boundaryTipGeo, boundaryTipMat);
    tip.position.set(px, py + 0.98, pz);
    boundaryGroup.add(pole, tip);
  }
  group.add(boundaryGroup);
  disposables.push(boundaryPylonGeo, boundaryTipGeo, pylonMat, boundaryTipMat, boundLineGeo, boundLineMat);

  // 3. World-Specific Terrain Landmarks (Moon PSR Craters / Mars Layered Mesas / Titan Methane Lake / Europa Fractures & Plumes)
  let plumePoints: THREE.Points | null = null;
  let plumePos: Float32Array | null = null;
  let methaneLakeMat: THREE.MeshPhysicalMaterial | null = null;

  if (planetId === 'moon') {
    // Permanently Shadowed Regions (PSRs) with dark regolith & crystalline water-ice glint
    const psrMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.95,
      metalness: 0.05,
    });
    const frostMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.3,
    });
    for (const zFeat of getWorldZoneFeatures('moon')) {
      const basinGeo = new THREE.CircleGeometry(zFeat.radius, 32);
      basinGeo.rotateX(-Math.PI / 2);
      const basin = new THREE.Mesh(basinGeo, psrMat);
      basin.position.set(zFeat.x, groundHeightAt('moon', zFeat.x, zFeat.z) + 0.04, zFeat.z);
      group.add(basin);
      disposables.push(basinGeo);

      const iceGeo = new THREE.OctahedronGeometry(0.28, 0);
      for (let k = 0; k < 7; k++) {
        const ia = (k / 7) * Math.PI * 2;
        const ir = 1.1 + (k % 3) * 0.85;
        const ix = zFeat.x + Math.cos(ia) * ir;
        const iz = zFeat.z + Math.sin(ia) * ir;
        const shard = new THREE.Mesh(iceGeo, frostMat);
        shard.position.set(ix, groundHeightAt('moon', ix, iz) + 0.14, iz);
        shard.rotation.set(k, k * 0.7, 0);
        group.add(shard);
      }
      disposables.push(iceGeo);
    }
    disposables.push(psrMat, frostMat);
  } else if (planetId === 'mars') {
    // Layered Martian Canyon Buttes outside main roaming perimeter
    const mesaMat = new THREE.MeshStandardMaterial({
      color: 0x8b3a1e,
      roughness: 0.9,
      metalness: 0.05,
    });
    const mesaCapMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.85,
    });
    const mesaSpots: Array<[number, number, number, number]> = [
      [-32, -26, 5.5, 4.2],
      [34, -24, 6.2, 5.0],
      [-35, 22, 5.2, 3.8],
      [30, 32, 4.8, 4.4],
    ];
    mesaSpots.forEach(([mx, mz, mr, mh]) => {
      const mGeo = new THREE.CylinderGeometry(mr * 0.72, mr, mh, 9);
      const mMesh = new THREE.Mesh(mGeo, mesaMat);
      mMesh.position.set(mx, groundHeightAt('mars', mx, mz) + mh * 0.45, mz);
      mMesh.castShadow = true;
      const cGeo = new THREE.CylinderGeometry(mr * 0.65, mr * 0.72, mh * 0.22, 9);
      const cMesh = new THREE.Mesh(cGeo, mesaCapMat);
      cMesh.position.set(mx, groundHeightAt('mars', mx, mz) + mh * 0.95, mz);
      group.add(mMesh, cMesh);
      disposables.push(mGeo, cGeo);
    });
    disposables.push(mesaMat, mesaCapMat);
  } else if (planetId === 'titan') {
    // Liquid Methane / Ethane Lake at (-15.8, 14.2)
    const lakeGeo = new THREE.CircleGeometry(5.5, 42);
    lakeGeo.rotateX(-Math.PI / 2);
    methaneLakeMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f292e,
      emissive: 0x164e63,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      metalness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const lake = new THREE.Mesh(lakeGeo, methaneLakeMat);
    lake.position.set(-15.8, -0.32, 14.2);
    group.add(lake);

    const shoreGeo = new THREE.RingGeometry(5.3, 6.1, 42);
    shoreGeo.rotateX(-Math.PI / 2);
    const shoreMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.75,
    });
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.position.set(-15.8, -0.28, 14.2);
    group.add(shore);
    disposables.push(lakeGeo, methaneLakeMat, shoreGeo, shoreMat);
  } else if (planetId === 'europa') {
    // Glowing Ice Lineae Fissures + Cryo-Plume Vapor Vent Particles
    const fissureMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.52,
    });
    const fissureLines: Array<[number, number, number, number]> = [
      [-21, -20, -8, -8],
      [9, -18, 22, -6],
      [-20, 12, -9, 21],
    ];
    fissureLines.forEach(([x1, z1, x2, z2]) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const fGeo = new THREE.BoxGeometry(0.24, 0.06, len);
      const fMesh = new THREE.Mesh(fGeo, fissureMat);
      fMesh.position.set((x1 + x2) / 2, groundHeightAt('europa', (x1 + x2) / 2, (z1 + z2) / 2) + 0.05, (z1 + z2) / 2);
      fMesh.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      group.add(fMesh);
      disposables.push(fGeo);
    });
    disposables.push(fissureMat);

    // Active cryo-vapor plume geyser at (-14.6, -13.6)
    const pCount = 90;
    plumePos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const h = (i / pCount) * 8.5;
      plumePos[i * 3] = -14.6 + Math.sin(i * 1.7) * (0.2 + h * 0.14);
      plumePos[i * 3 + 1] = 0.2 + h;
      plumePos[i * 3 + 2] = -13.6 + Math.cos(i * 2.3) * (0.2 + h * 0.14);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.42,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    plumePoints = new THREE.Points(pGeo, pMat);
    plumePoints.frustumCulled = false;
    group.add(plumePoints);
    disposables.push(pGeo, pMat);
  }

  // 4. Organic Sculpted Planetary Boulders + Secondary Pebbles (Deterministic + Collidable)
  const rockGeo = new THREE.IcosahedronGeometry(0.9, 2);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const crag = 1 + 0.22 * Math.sin(vx * 3.1 + vy * 2.4) * Math.cos(vz * 3.7);
    rPos.setXYZ(i, vx * crag, vy * crag * 0.78, vz * crag);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: spec.rockColor,
    bumpMap,
    bumpScale: 0.18,
    roughness: planetId === 'europa' ? 0.26 : 0.9,
    metalness: 0.06,
  });

  const rockCount = 85;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let seed = 4219 + planetId.charCodeAt(0) * 13;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const zones = getWorldZoneFeatures(planetId);

  for (let i = 0; i < rockCount; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 14.5 + rand() * 40;
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const ry = groundHeightAt(planetId, rx, rz);
    const s = 0.45 + rand() * 1.45;
    const sx = s * (0.85 + rand() * 0.35);
    const sy = s * (0.55 + rand() * 0.75);
    const sz = s * (0.85 + rand() * 0.35);
    const rotX = rand() * 0.6;
    const rotY = rand() * Math.PI * 2;
    const rotZ = rand() * 0.6;

    const nearZone = zones.some((z) => Math.hypot(rx - z.x, rz - z.z) < z.radius + 1.5);
    const nearShip = Math.hypot(rx - 12.4, rz - 4.4) < 4.5;
    if (nearZone || nearShip) {
      dummy.position.set(0, -25, 0);
      dummy.scale.setScalar(0.01);
    } else {
      dummy.position.set(rx, ry + s * 0.26, rz);
      dummy.rotation.set(rotX, rotY, rotZ);
      dummy.scale.set(sx, sy, sz);
    }
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);

    const shade = 0.78 + rand() * 0.38;
    tint.setHex(spec.rockColor).multiplyScalar(shade);
    rocks.setColorAt(i, tint);
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.computeBoundingSphere();
  group.add(rocks);

  // Secondary Small Pebbles
  const pebbleCount = 120;
  const pebbles = new THREE.InstancedMesh(rockGeo, rockMat, pebbleCount);
  pebbles.receiveShadow = true;
  for (let i = 0; i < pebbleCount; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 8.8 + rand() * 28;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const py = groundHeightAt(planetId, px, pz);
    const ps = 0.12 + rand() * 0.2;
    dummy.position.set(px, py + ps * 0.35, pz);
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.scale.set(ps * 1.2, ps * 0.75, ps);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    tint.setHex(spec.rockColor).multiplyScalar(0.85 + rand() * 0.3);
    pebbles.setColorAt(i, tint);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  group.add(pebbles);
  disposables.push(rockGeo, rockMat);

  // 5. Rich Deep Space Environment: Multi-magnitude Stars + Milky Way Band + Distant Galaxies + High-Altitude Meteors
  const starCount = 850;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = rand() * Math.PI * 0.47;
    const r = 98 + (i % 5) * 4;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = 10 + r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf8fafc,
    size: 0.48,
    sizeAttenuation: true,
    transparent: true,
    opacity: planetId === 'titan' ? 0.28 : 0.92,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);
  disposables.push(starGeo, starMat);

  // Distant Milky Way star band
  const mwCount = 320;
  const mwPos = new Float32Array(mwCount * 3);
  for (let i = 0; i < mwCount; i++) {
    const t = rand() * Math.PI * 2;
    const scatter = (rand() - 0.5) * 0.22;
    const elev = 0.45 + Math.sin(t) * 0.32 + scatter;
    const r = 104;
    mwPos[i * 3] = Math.cos(t) * r * Math.cos(elev);
    mwPos[i * 3 + 1] = 14 + Math.sin(elev) * r * 0.72;
    mwPos[i * 3 + 2] = Math.sin(t) * r * Math.cos(elev);
  }
  const mwGeo = new THREE.BufferGeometry();
  mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
  const mwMat = new THREE.PointsMaterial({
    color: 0xa5b4fc,
    size: 0.75,
    transparent: true,
    opacity: planetId === 'titan' ? 0.12 : 0.35,
    fog: false,
  });
  group.add(new THREE.Points(mwGeo, mwMat));
  disposables.push(mwGeo, mwMat);

  // Two Distant Spiral Galaxies in Deep Sky
  const galaxyTex = createSpiralGalaxyTexture();
  disposables.push(galaxyTex);
  const galaxySpots: Array<[number, number, number, number]> = [
    [62, 58, -74, 14],
    [-68, 52, 48, 10],
  ];
  galaxySpots.forEach(([gx, gy, gz, gs]) => {
    const gMat = new THREE.SpriteMaterial({
      map: galaxyTex,
      transparent: true,
      opacity: planetId === 'titan' ? 0.16 : 0.62,
      fog: false,
      depthWrite: false,
    });
    const gSprite = new THREE.Sprite(gMat);
    gSprite.position.set(gx, gy, gz);
    gSprite.scale.set(gs * 1.4, gs, 1);
    group.add(gSprite);
    disposables.push(gMat);
  });

  // High-Altitude Shooting Meteors (strictly high in the celestial dome, y=42..72)
  const meteorCount = 4;
  const meteorVerts = new Float32Array(meteorCount * 6);
  const meteorState = Array.from({ length: meteorCount }, (_, i) => ({
    phase: i * 3.7,
    period: 7.5 + i * 2.1,
    ox: -45 + i * 28,
    oy: 58 + (i % 2) * 8,
    oz: -75 + (i % 3) * 18,
  }));
  const meteorGeo = new THREE.BufferGeometry();
  meteorGeo.setAttribute('position', new THREE.BufferAttribute(meteorVerts, 3));
  const meteorMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: planetId === 'titan' ? 0.22 : 0.78,
    fog: false,
  });
  const meteorLines = new THREE.LineSegments(meteorGeo, meteorMat);
  meteorLines.frustumCulled = false;
  group.add(meteorLines);
  disposables.push(meteorGeo, meteorMat);

  // 6. Textured Celestial Horizon Body + Atmospheric Halo (+ Lunar Eclipse Shadow Ring on Moon)
  let bodyMesh: THREE.Mesh | null = null;
  let haloMesh: THREE.Mesh | null = null;
  let eclipseDisc: THREE.Mesh | null = null;

  if (spec.celestialBody) {
    const cb = spec.celestialBody;
    const bodyTex = createHorizonBodyTexture(planetId, maxAnisotropy);
    const bodyGeo = new THREE.SphereGeometry(cb.radius, 36, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: bodyTex,
      emissive: cb.emissive,
      emissiveIntensity: 0.35,
      roughness: 0.6,
      fog: false,
    });
    bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(...cb.position);
    group.add(bodyMesh);

    const haloGeo = new THREE.SphereGeometry(cb.radius * 1.13, 32, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: cb.color,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      fog: false,
    });
    haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.copy(bodyMesh.position);
    group.add(haloMesh);
    disposables.push(bodyTex, bodyGeo, bodyMat, haloGeo, haloMat);

    if (cb.hasRings) {
      const ringGeo = new THREE.RingGeometry(cb.radius * 1.35, cb.radius * 2.15, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: cb.ringColor || 0xfde68a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.54,
        fog: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(bodyMesh.position);
      ringMesh.rotation.set(Math.PI * 0.38, 0.2, 0.3);
      group.add(ringMesh);
      disposables.push(ringGeo, ringMat);
    }

    if (planetId === 'moon') {
      // Solar corona glow visible overhead when solar eclipse dims sunlight
      const ecGeo = new THREE.RingGeometry(2.8, 3.6, 48);
      const ecMat = new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        fog: false,
      });
      eclipseDisc = new THREE.Mesh(ecGeo, ecMat);
      eclipseDisc.position.set(28, 48, -68);
      eclipseDisc.lookAt(0, 0, 0);
      group.add(eclipseDisc);
      disposables.push(ecGeo, ecMat);
    }
  }

  const updateSkyEffects = (
    elapsed: number,
    dt: number,
    opts?: { eclipseFactor?: number; earthVisPct?: number }
  ) => {
    stars.rotation.y += dt * 0.0025;

    // Update high-altitude meteors
    const mAttr = meteorGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < meteorCount; i++) {
      const m = meteorState[i];
      const local = (elapsed + m.phase) % m.period;
      if (local < 1.1) {
        const p = local / 1.1;
        const hx = m.ox + p * 26;
        const hy = m.oy - p * 14;
        const hz = m.oz + p * 8;
        meteorVerts[i * 6] = hx;
        meteorVerts[i * 6 + 1] = hy;
        meteorVerts[i * 6 + 2] = hz;
        meteorVerts[i * 6 + 3] = hx - 4.2;
        meteorVerts[i * 6 + 4] = hy + 2.2;
        meteorVerts[i * 6 + 5] = hz - 1.3;
      } else {
        meteorVerts[i * 6] = 0;
        meteorVerts[i * 6 + 1] = -999;
        meteorVerts[i * 6 + 2] = 0;
        meteorVerts[i * 6 + 3] = 0;
        meteorVerts[i * 6 + 4] = -999;
        meteorVerts[i * 6 + 5] = 0;
      }
    }
    mAttr.needsUpdate = true;

    if (bodyMesh) {
      bodyMesh.rotation.y += dt * 0.03;
      if (planetId === 'moon' && opts?.earthVisPct !== undefined && haloMesh) {
        // Moon libration shifts Earth slightly along horizon
        const normVis = THREE.MathUtils.clamp((opts.earthVisPct - 30) / 70, 0, 1);
        const ty = 18 + normVis * 22;
        bodyMesh.position.y = ty;
        haloMesh.position.y = ty;
      }
    }

    if (eclipseDisc) {
      const ecMat = eclipseDisc.material as THREE.MeshBasicMaterial;
      ecMat.opacity = (opts?.eclipseFactor || 0) * 0.88;
    }

    if (methaneLakeMat) {
      methaneLakeMat.emissiveIntensity = 0.22 + Math.sin(elapsed * 1.4) * 0.08;
    }

    if (plumePoints && plumePos) {
      const pAttr = plumePoints.geometry.attributes.position as THREE.BufferAttribute;
      const count = plumePos.length / 3;
      for (let i = 0; i < count; i++) {
        let py = plumePos[i * 3 + 1] + dt * 3.4;
        if (py > 9.0) py = 0.2;
        const spread = 0.2 + py * 0.16;
        plumePos[i * 3] = -14.6 + Math.sin(elapsed * 2.2 + i) * spread;
        plumePos[i * 3 + 1] = py;
        plumePos[i * 3 + 2] = -13.6 + Math.cos(elapsed * 1.9 + i) * spread;
      }
      pAttr.needsUpdate = true;
    }
  };

  return {
    group,
    updateSkyEffects,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
