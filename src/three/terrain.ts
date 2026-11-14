import * as THREE from 'three';
import type { PlanetId } from '../types';

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
        skyColor: 0x05070c,
        fogColor: 0x070a12,
        fogDensity: 0.011,
        sunColor: 0xfff6e5,
        sunIntensity: 2.35,
        hemiSkyColor: 0x64748b,
        hemiGroundColor: 0x1e293b,
        hemiIntensity: 0.65,
        terrainBaseHex: '#636b78',
        terrainAccentHex: '#414854',
        rockColor: 0x717885,
        celestialBody: {
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          radius: 7.5,
          position: [-45, 36, -80],
        },
      };
    case 'mars':
      return {
        skyColor: 0x1f120c,
        fogColor: 0x2b170e,
        fogDensity: 0.015,
        sunColor: 0xffd7b3,
        sunIntensity: 2.2,
        hemiSkyColor: 0xc2611b,
        hemiGroundColor: 0x451a03,
        hemiIntensity: 0.78,
        terrainBaseHex: '#a34e2e',
        terrainAccentHex: '#6c2f1a',
        rockColor: 0x843b20,
        celestialBody: {
          color: 0xcbd5e1,
          emissive: 0x475569,
          radius: 2.2,
          position: [38, 32, -75],
        },
      };
    case 'titan':
      return {
        skyColor: 0x24190a,
        fogColor: 0x2f200c,
        fogDensity: 0.018,
        sunColor: 0xfbbf24,
        sunIntensity: 1.9,
        hemiSkyColor: 0xd97706,
        hemiGroundColor: 0x3b240b,
        hemiIntensity: 0.85,
        terrainBaseHex: '#946a37',
        terrainAccentHex: '#593c1b',
        rockColor: 0x5c442b,
        celestialBody: {
          color: 0xeab308,
          emissive: 0x854d0e,
          radius: 10.5,
          position: [48, 34, -85],
          hasRings: true,
          ringColor: 0xfde68a,
        },
      };
    case 'europa':
      return {
        skyColor: 0x060b14,
        fogColor: 0x091322,
        fogDensity: 0.012,
        sunColor: 0xe0f2fe,
        sunIntensity: 2.1,
        hemiSkyColor: 0x38bdf8,
        hemiGroundColor: 0x164e63,
        hemiIntensity: 0.8,
        terrainBaseHex: '#93c5fd',
        terrainAccentHex: '#475569',
        rockColor: 0xbae6fd,
        celestialBody: {
          color: 0xfdba74,
          emissive: 0x9a3412,
          radius: 13.0,
          position: [-50, 38, -92],
        },
      };
  }
}

export function groundHeightAt(planetId: PlanetId, x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);
  const padBlend = THREE.MathUtils.smoothstep(distFromCenter, 9.5, 16.5);
  if (padBlend <= 0.001) return 0;

  let rawH = 0;
  if (planetId === 'moon') {
    const rim = Math.sin(x * 0.14) * Math.cos(z * 0.14) * 1.4;
    const crater = Math.max(0, 1.8 - Math.hypot(x - 18, z + 15) * 0.18) * 1.1;
    rawH = rim + crater + Math.sin(x * 0.35 + z * 0.25) * 0.25 + Math.cos(x * 0.7) * 0.08;
  } else if (planetId === 'mars') {
    const dune = Math.sin(x * 0.16 + z * 0.08) * 1.15 + Math.cos(z * 0.18) * 0.7;
    rawH = dune + Math.sin(x * 0.4) * 0.22 + Math.cos(z * 0.65) * 0.08;
  } else if (planetId === 'titan') {
    rawH = Math.sin(x * 0.22 + z * 0.1) * 1.25 + Math.cos(z * 0.12) * 0.45 + Math.sin(x * 0.55) * 0.08;
  } else {
    rawH =
      Math.abs(Math.sin(x * 0.2 + z * 0.15)) * 1.45 -
      0.35 +
      Math.cos(x * 0.45 - z * 0.3) * 0.25;
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
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 2.5;
    bCtx.strokeStyle = 'rgba(30,30,30,0.6)';
    bCtx.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
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
  } else if (planetId === 'moon') {
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 28; i++) {
      const cx = rand() * 512;
      const cy = rand() * 512;
      const cr = 8 + rand() * 24;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
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
    // Wind-blown regolith / hydrocarbon dune ripples
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
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
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.ellipse((i * 37) % 256, 20 + ((i * 23) % 85), 24, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (planetId === 'titan' || planetId === 'europa') {
    for (let y = 0; y < 128; y += 8) {
      ctx.fillStyle =
        planetId === 'titan'
          ? y % 16 === 0
            ? '#eab308'
            : '#ca8a04'
          : y % 16 === 0
          ? '#fdba74'
          : '#c2410c';
      ctx.fillRect(0, y, 256, 8);
    }
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
  dispose: () => void;
} {
  const group = new THREE.Group();
  const spec = getPlanetEnvironmentSpec(planetId);
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. High-Density Displaced Planetary Terrain (140m x 140m, 128x128 segments + bumpMap)
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
    bumpScale: 0.32,
    roughness: planetId === 'europa' ? 0.32 : 0.86,
    metalness: planetId === 'europa' ? 0.12 : 0.04,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, albedoMap, bumpMap, terrainMat);

  // 2. Subtle Outpost Perimeter Pad Ring (polygonOffset avoids Z-fighting)
  const padGeo = new THREE.RingGeometry(9.2, 9.5, 64);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const padRing = new THREE.Mesh(padGeo, padMat);
  padRing.position.y = 0.025;
  group.add(padRing);
  disposables.push(padGeo, padMat);

  // 3. Organic Sculpted Planetary Boulders + Secondary Pebbles (InstancedMesh)
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
    roughness: planetId === 'europa' ? 0.28 : 0.9,
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

  for (let i = 0; i < rockCount; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 13.5 + rand() * 42;
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const ry = groundHeightAt(planetId, rx, rz);
    const s = 0.45 + rand() * 1.5;
    dummy.position.set(rx, ry + s * 0.28, rz);
    dummy.rotation.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6);
    dummy.scale.set(
      s * (0.85 + rand() * 0.35),
      s * (0.55 + rand() * 0.75),
      s * (0.85 + rand() * 0.35)
    );
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

  // Secondary Small Pebbles Scattered Across Terrain
  const pebbleCount = 120;
  const pebbles = new THREE.InstancedMesh(rockGeo, rockMat, pebbleCount);
  pebbles.receiveShadow = true;
  for (let i = 0; i < pebbleCount; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 8.5 + rand() * 28;
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

  // 4. Starfield Points
  const starCount = 650;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = rand() * Math.PI * 0.46;
    const r = 96;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = 10 + r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe2e8f0,
    size: 0.44,
    sizeAttenuation: true,
    transparent: true,
    opacity: planetId === 'titan' ? 0.25 : 0.88,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);
  disposables.push(starGeo, starMat);

  // 5. Textured Celestial Horizon Body + Atmospheric Halo
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
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(...cb.position);
    group.add(bodyMesh);

    const haloGeo = new THREE.SphereGeometry(cb.radius * 1.12, 32, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: cb.color,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      fog: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.copy(bodyMesh.position);
    group.add(haloMesh);
    disposables.push(bodyTex, bodyGeo, bodyMat, haloGeo, haloMat);

    if (cb.hasRings) {
      const ringGeo = new THREE.RingGeometry(cb.radius * 1.35, cb.radius * 2.15, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: cb.ringColor || 0xfde68a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.52,
        fog: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(bodyMesh.position);
      ringMesh.rotation.set(Math.PI * 0.38, 0.2, 0.3);
      group.add(ringMesh);
      disposables.push(ringGeo, ringMat);
    }
  }

  return {
    group,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
