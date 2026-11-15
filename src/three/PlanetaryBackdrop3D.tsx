import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createAAARenderPipeline } from './postfx';
import {
  createEarthCloudsTexture,
  createNebulaTexture,
  createPlanetSurfaceTexture,
  createPlanetaryRingTexture,
  createRadialGlowTexture,
  createSpiralGalaxyTexture,
} from './universeTextures';
import type { PlanetId } from '../types';

export type PlanetaryBackdropMode = 'orbit' | 'solar' | 'storm';

interface PlanetaryBackdrop3DProps {
  planetId?: PlanetId;
  mode?: PlanetaryBackdropMode;
  className?: string;
}

interface BackdropThemeSpec {
  textureId: string;
  atmoColor: number;
  atmoIntensity: number;
  atmoPower: number;
  sunColor: number;
  sunIntensity: number;
  rimColor: number;
  rimIntensity: number;
  nebulaPrimary: string;
  nebulaSecondary: string;
  particleColor: number;
  cloudOpacity: number;
  cloudTint: number;
  companion?: 'earth' | 'phobos' | 'saturn' | 'jupiter';
}

function getThemeSpec(planetId: PlanetId, mode: PlanetaryBackdropMode): BackdropThemeSpec {
  const stormBoost = mode === 'storm';
  switch (planetId) {
    case 'moon':
      return {
        textureId: 'luna',
        atmoColor: stormBoost ? 0x38bdf8 : 0x94a3b8,
        atmoIntensity: stormBoost ? 0.65 : 0.34,
        atmoPower: 3.6,
        sunColor: 0xfff7ed,
        sunIntensity: 2.35,
        rimColor: 0x38bdf8,
        rimIntensity: 0.72,
        nebulaPrimary: 'rgba(56, 189, 248, 0.24)',
        nebulaSecondary: 'rgba(99, 102, 241, 0.16)',
        particleColor: 0xbae6fd,
        cloudOpacity: 0,
        cloudTint: 0xffffff,
        companion: 'earth',
      };
    case 'mars':
      return {
        textureId: 'mars',
        atmoColor: stormBoost ? 0xf97316 : 0xfb923c,
        atmoIntensity: stormBoost ? 1.15 : 0.78,
        atmoPower: 2.8,
        sunColor: 0xffedd5,
        sunIntensity: 2.2,
        rimColor: stormBoost ? 0xf43f5e : 0x38bdf8,
        rimIntensity: 0.55,
        nebulaPrimary: 'rgba(249, 115, 22, 0.22)',
        nebulaSecondary: 'rgba(56, 189, 248, 0.14)',
        particleColor: 0xfdba74,
        cloudOpacity: stormBoost ? 0.36 : 0.16,
        cloudTint: 0xfdba74,
        companion: 'phobos',
      };
    case 'titan':
      return {
        textureId: 'titan',
        atmoColor: stormBoost ? 0xf59e0b : 0xfbbf24,
        atmoIntensity: stormBoost ? 1.25 : 0.96,
        atmoPower: 2.4,
        sunColor: 0xfef3c7,
        sunIntensity: 1.95,
        rimColor: 0x38bdf8,
        rimIntensity: 0.52,
        nebulaPrimary: 'rgba(245, 158, 11, 0.24)',
        nebulaSecondary: 'rgba(14, 165, 233, 0.15)',
        particleColor: 0xfde68a,
        cloudOpacity: stormBoost ? 0.45 : 0.32,
        cloudTint: 0xf59e0b,
        companion: 'saturn',
      };
    case 'europa':
      return {
        textureId: 'europa',
        atmoColor: stormBoost ? 0xf43f5e : 0x38bdf8,
        atmoIntensity: stormBoost ? 1.1 : 0.85,
        atmoPower: 2.8,
        sunColor: 0xe0f2fe,
        sunIntensity: 2.15,
        rimColor: 0x22d3ee,
        rimIntensity: 0.82,
        nebulaPrimary: 'rgba(34, 211, 238, 0.24)',
        nebulaSecondary: 'rgba(59, 130, 246, 0.18)',
        particleColor: 0x7dd3fc,
        cloudOpacity: 0.14,
        cloudTint: 0xbae6fd,
        companion: 'jupiter',
      };
  }
}

function createFresnelAtmosphere(
  radius: number,
  colorHex: number,
  intensity: number,
  power: number,
  side: THREE.Side = THREE.BackSide
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 64, 48);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uSunDir: { value: new THREE.Vector3(0.82, 0.42, 0.38).normalize() },
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
      uniform vec3 uSunDir;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float ndotv = abs(dot(vNormalWorld, vViewDir));
        float rim = pow(clamp(1.0 - ndotv, 0.0, 1.0), uPower);
        float sunWrap = smoothstep(-0.35, 0.75, dot(vNormalWorld, normalize(uSunDir)));
        float alpha = rim * uIntensity * (0.28 + 0.72 * sunWrap);
        gl_FragColor = vec4(uColor * (0.85 + 0.35 * sunWrap), clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

function createRadialRingGeometry(innerR: number, outerR: number): THREE.RingGeometry {
  const geo = new THREE.RingGeometry(innerR, outerR, 96, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    const u = Math.max(0, Math.min(1, (r - innerR) / (outerR - innerR)));
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

const _camBase = new THREE.Vector3();

export default function PlanetaryBackdrop3D({
  planetId = 'mars',
  mode = 'orbit',
  className = '',
}: PlanetaryBackdrop3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const planetIdRef = useRef<PlanetId>(planetId);
  const modeRef = useRef<PlanetaryBackdropMode>(mode);
  planetIdRef.current = planetId;
  modeRef.current = mode;

  const syncTargetRef = useRef<((p: PlanetId, m: PlanetaryBackdropMode) => void) | null>(null);

  useEffect(() => {
    syncTargetRef.current?.(planetId, mode);
  }, [planetId, mode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let contextLost = false;
    let rafId = 0;
    let timerId = 0;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x02050d);

      const width = container.clientWidth || window.innerWidth || 1280;
      const height = container.clientHeight || window.innerHeight || 720;

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 420);
      camera.position.set(0, 0.8, 17.5);
      camera.lookAt(1.6, 0, 0);

      const pipeline = createAAARenderPipeline(container, scene, camera, {
        bloomStrength: 0.14,
        bloomRadius: 0.45,
        bloomThreshold: 0.88,
        exposure: 1.0,
      });
      const { renderer, isSoftwareGl } = pipeline;
      const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.2;

      const disposables: Array<{ dispose: () => void }> = [envRT, roomEnv, pmremGenerator];

      // Lights
      const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050811, 0.22);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
      sunLight.position.set(16, 8.5, 9.5);
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
      rimLight.position.set(-14, -4, -10);
      scene.add(rimLight);

      // Deep-space multi-depth starfield
      const starCount = isSoftwareGl ? 900 : 2100;
      const starPos = new Float32Array(starCount * 3);
      const starCol = new Float32Array(starCount * 3);
      const colChoice = [
        new THREE.Color(0xf8fafc),
        new THREE.Color(0xbae6fd),
        new THREE.Color(0xfef3c7),
        new THREE.Color(0xc7d2fe),
      ];
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 90 + Math.random() * 140;
        starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.cos(phi);
        starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const c = colChoice[i % colChoice.length];
        const b = 0.55 + Math.random() * 0.45;
        starCol[i * 3] = c.r * b;
        starCol[i * 3 + 1] = c.g * b;
        starCol[i * 3 + 2] = c.b * b;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.52,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
      disposables.push(starGeo, starMat);

      // Distant Spiral Galaxy & Nebula Backdrop
      const galaxyTex = createSpiralGalaxyTexture(maxAnisotropy);
      const galaxyMat = new THREE.SpriteMaterial({
        map: galaxyTex,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const galaxySprite = new THREE.Sprite(galaxyMat);
      galaxySprite.position.set(-28, 16, -95);
      galaxySprite.scale.set(48, 32, 1);
      scene.add(galaxySprite);
      disposables.push(galaxyTex, galaxyMat);

      let nebulaTex = createNebulaTexture('rgba(56, 189, 248, 0.22)', 'rgba(99, 102, 241, 0.16)', maxAnisotropy);
      const nebulaMat = new THREE.SpriteMaterial({
        map: nebulaTex,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const nebulaSprite = new THREE.Sprite(nebulaMat);
      nebulaSprite.position.set(-14, -10, -78);
      nebulaSprite.scale.set(84, 54, 1);
      scene.add(nebulaSprite);
      disposables.push(nebulaTex, nebulaMat);

      // Floating Space Dust Particles (Foreground Parallax)
      const dustCount = isSoftwareGl ? 90 : 220;
      const dustPos = new Float32Array(dustCount * 3);
      const dustSpeeds = new Float32Array(dustCount);
      for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 34;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
        dustPos[i * 3 + 2] = -6 + Math.random() * 18;
        dustSpeeds[i] = 0.18 + Math.random() * 0.45;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      const dustMat = new THREE.PointsMaterial({
        size: 0.085,
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dustPoints = new THREE.Points(dustGeo, dustMat);
      scene.add(dustPoints);
      disposables.push(dustGeo, dustMat);

      // ========== ORBIT MODE: HERO PLANET + ATMOSPHERE + COMPANION ==========
      const orbitGroup = new THREE.Group();
      scene.add(orbitGroup);

      const planetTiltGroup = new THREE.Group();
      planetTiltGroup.position.set(4.4, -0.65, -2.5);
      planetTiltGroup.rotation.z = 0.22;
      orbitGroup.add(planetTiltGroup);

      const planetGeo = new THREE.SphereGeometry(5.55, 72, 54);
      const surfaceTextures: Record<string, THREE.CanvasTexture> = {
        luna: createPlanetSurfaceTexture('luna', maxAnisotropy),
        mars: createPlanetSurfaceTexture('mars', maxAnisotropy),
        titan: createPlanetSurfaceTexture('titan', maxAnisotropy),
        europa: createPlanetSurfaceTexture('europa', maxAnisotropy),
        earth: createPlanetSurfaceTexture('earth', maxAnisotropy),
        saturn: createPlanetSurfaceTexture('saturn', maxAnisotropy),
        jupiter: createPlanetSurfaceTexture('jupiter', maxAnisotropy),
      };
      Object.values(surfaceTextures).forEach((t) => disposables.push(t));

      const planetMat = new THREE.MeshStandardMaterial({
        map: surfaceTextures.mars,
        metalness: 0.04,
        roughness: 0.82,
      });
      const planetMesh = new THREE.Mesh(planetGeo, planetMat);
      planetTiltGroup.add(planetMesh);
      disposables.push(planetGeo, planetMat);

      const cloudTex = createEarthCloudsTexture(maxAnisotropy);
      const cloudGeo = new THREE.SphereGeometry(5.63, 64, 48);
      const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        roughness: 0.9,
      });
      const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      planetTiltGroup.add(cloudMesh);
      disposables.push(cloudTex, cloudGeo, cloudMat);

      // Dual-layer Fresnel atmospheric scattering halo
      const atmoOuter = createFresnelAtmosphere(5.98, 0xfb923c, 0.8, 2.8, THREE.BackSide);
      planetTiltGroup.add(atmoOuter);
      const atmoInner = createFresnelAtmosphere(5.59, 0xfb923c, 0.42, 3.6, THREE.FrontSide);
      planetTiltGroup.add(atmoInner);
      disposables.push(
        atmoOuter.geometry,
        atmoOuter.material as THREE.Material,
        atmoInner.geometry,
        atmoInner.material as THREE.Material
      );

      // Companion bodies (Earth / Saturn / Jupiter / Phobos)
      const companionGroup = new THREE.Group();
      orbitGroup.add(companionGroup);

      // Earth companion (for Moon)
      const earthComp = new THREE.Group();
      earthComp.position.set(-10.5, 4.4, -22);
      const earthCompGeo = new THREE.SphereGeometry(2.15, 48, 36);
      const earthCompMat = new THREE.MeshStandardMaterial({
        map: surfaceTextures.earth,
        roughness: 0.68,
        metalness: 0.08,
      });
      const earthCompMesh = new THREE.Mesh(earthCompGeo, earthCompMat);
      earthComp.add(earthCompMesh);
      const earthCompClouds = new THREE.Mesh(
        new THREE.SphereGeometry(2.19, 36, 28),
        new THREE.MeshStandardMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      );
      earthComp.add(earthCompClouds);
      const earthAtmo = createFresnelAtmosphere(2.36, 0x38bdf8, 0.95, 2.7, THREE.BackSide);
      earthComp.add(earthAtmo);
      companionGroup.add(earthComp);
      disposables.push(
        earthCompGeo,
        earthCompMat,
        earthCompClouds.geometry,
        earthCompClouds.material as THREE.Material,
        earthAtmo.geometry,
        earthAtmo.material as THREE.Material
      );

      // Saturn companion (for Titan)
      const saturnComp = new THREE.Group();
      saturnComp.position.set(-11.5, 5.2, -26);
      saturnComp.rotation.z = 0.42;
      saturnComp.rotation.x = 0.35;
      const saturnGeo = new THREE.SphereGeometry(2.8, 48, 36);
      const saturnMat = new THREE.MeshStandardMaterial({
        map: surfaceTextures.saturn,
        roughness: 0.72,
      });
      const saturnMesh = new THREE.Mesh(saturnGeo, saturnMat);
      saturnComp.add(saturnMesh);
      const saturnRingTex = createPlanetaryRingTexture('saturn', maxAnisotropy);
      const saturnRingGeo = createRadialRingGeometry(3.55, 6.45);
      const saturnRingMat = new THREE.MeshStandardMaterial({
        map: saturnRingTex,
        transparent: true,
        side: THREE.DoubleSide,
        opacity: 0.88,
        roughness: 0.8,
      });
      const saturnRingMesh = new THREE.Mesh(saturnRingGeo, saturnRingMat);
      saturnRingMesh.rotation.x = Math.PI / 2;
      saturnComp.add(saturnRingMesh);
      companionGroup.add(saturnComp);
      disposables.push(saturnGeo, saturnMat, saturnRingTex, saturnRingGeo, saturnRingMat);

      // Jupiter companion (for Europa)
      const jupiterComp = new THREE.Group();
      jupiterComp.position.set(-12.2, 4.6, -25);
      jupiterComp.rotation.z = -0.15;
      const jupGeo = new THREE.SphereGeometry(4.6, 56, 42);
      const jupMat = new THREE.MeshStandardMaterial({
        map: surfaceTextures.jupiter,
        roughness: 0.74,
      });
      const jupMesh = new THREE.Mesh(jupGeo, jupMat);
      jupiterComp.add(jupMesh);
      const jupAtmo = createFresnelAtmosphere(4.85, 0xfdba74, 0.52, 3.0, THREE.BackSide);
      jupiterComp.add(jupAtmo);
      companionGroup.add(jupiterComp);
      disposables.push(jupGeo, jupMat, jupAtmo.geometry, jupAtmo.material as THREE.Material);

      // Phobos moonlet (for Mars)
      const phobosGeo = new THREE.DodecahedronGeometry(0.45, 2);
      const phobosMat = new THREE.MeshStandardMaterial({
        color: 0x8b7e74,
        roughness: 0.92,
      });
      const phobosMesh = new THREE.Mesh(phobosGeo, phobosMat);
      phobosMesh.position.set(-7.2, 3.4, -7.5);
      phobosMesh.scale.set(1.25, 0.9, 1.0);
      companionGroup.add(phobosMesh);
      disposables.push(phobosGeo, phobosMat);

      // ========== SOLAR SYSTEM MODE: LUMINOUS SUN + ORBITS + PLANETS ==========
      const solarGroup = new THREE.Group();
      scene.add(solarGroup);

      const sunCoreGeo = new THREE.SphereGeometry(2.6, 48, 36);
      const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
      const sunCoreMesh = new THREE.Mesh(sunCoreGeo, sunCoreMat);
      sunCoreMesh.position.set(5.4, 0.2, -7.5);
      solarGroup.add(sunCoreMesh);
      disposables.push(sunCoreGeo, sunCoreMat);

      const sunGlowTex = createRadialGlowTexture(
        'rgba(255, 248, 220, 0.92)',
        'rgba(251, 146, 60, 0.42)',
        'rgba(0,0,0,0)'
      );
      const sunGlowMat = new THREE.SpriteMaterial({
        map: sunGlowTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sunCorona = new THREE.Sprite(sunGlowMat);
      sunCorona.scale.set(16, 16, 1);
      sunCoreMesh.add(sunCorona);
      disposables.push(sunGlowTex, sunGlowMat);

      const solarPlanets: Array<{
        pivot: THREE.Group;
        mesh: THREE.Mesh;
        speed: number;
      }> = [];

      const solarSpecs = [
        { tex: surfaceTextures.earth, radius: 0.72, orbitR: 6.2, speed: 0.14, phase: 0.9, atmo: 0x38bdf8 },
        { tex: surfaceTextures.mars, radius: 0.56, orbitR: 9.2, speed: 0.095, phase: 2.3, atmo: 0xf97316 },
        { tex: surfaceTextures.saturn, radius: 1.05, orbitR: 13.5, speed: 0.055, phase: 4.1, atmo: 0xfde68a, rings: true },
      ];

      solarSpecs.forEach((sp) => {
        const ringGeo = new THREE.RingGeometry(sp.orbitR - 0.025, sp.orbitR + 0.025, 112);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2 - 0.28;
        ringMesh.rotation.y = 0.14;
        sunCoreMesh.add(ringMesh);
        disposables.push(ringGeo, ringMat);

        const pivot = new THREE.Group();
        pivot.rotation.x = -0.28;
        pivot.rotation.z = 0.14;
        pivot.rotation.y = sp.phase;
        sunCoreMesh.add(pivot);

        const pGeo = new THREE.SphereGeometry(sp.radius, 36, 28);
        const pMat = new THREE.MeshStandardMaterial({ map: sp.tex, roughness: 0.72 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(sp.orbitR, 0, 0);
        pivot.add(pMesh);
        disposables.push(pGeo, pMat);

        const pAtmo = createFresnelAtmosphere(sp.radius * 1.12, sp.atmo, 0.75, 2.8, THREE.BackSide);
        pMesh.add(pAtmo);
        disposables.push(pAtmo.geometry, pAtmo.material as THREE.Material);

        if (sp.rings) {
          const rGeo = createRadialRingGeometry(sp.radius * 1.35, sp.radius * 2.2);
          const rMat = new THREE.MeshStandardMaterial({
            map: saturnRingTex,
            transparent: true,
            side: THREE.DoubleSide,
            opacity: 0.85,
          });
          const rMesh = new THREE.Mesh(rGeo, rMat);
          rMesh.rotation.x = Math.PI / 2 - 0.35;
          pMesh.add(rMesh);
          disposables.push(rGeo, rMat);
        }

        solarPlanets.push({ pivot, mesh: pMesh, speed: sp.speed });
      });

      // Apply current planet + mode theme
      const applyTheme = (pId: PlanetId, m: PlanetaryBackdropMode) => {
        const theme = getThemeSpec(pId, m);
        const isSolar = m === 'solar';
        orbitGroup.visible = !isSolar;
        solarGroup.visible = isSolar;

        planetMat.map = surfaceTextures[theme.textureId] || surfaceTextures.mars;
        planetMat.needsUpdate = true;

        cloudMat.opacity = theme.cloudOpacity;
        cloudMat.color.setHex(theme.cloudTint);
        cloudMesh.visible = theme.cloudOpacity > 0.01;

        const outerMat = atmoOuter.material as THREE.ShaderMaterial;
        outerMat.uniforms.uColor.value.setHex(theme.atmoColor);
        outerMat.uniforms.uIntensity.value = theme.atmoIntensity;
        outerMat.uniforms.uPower.value = theme.atmoPower;

        const innerMat = atmoInner.material as THREE.ShaderMaterial;
        innerMat.uniforms.uColor.value.setHex(theme.atmoColor);
        innerMat.uniforms.uIntensity.value = theme.atmoIntensity * 0.5;
        innerMat.uniforms.uPower.value = theme.atmoPower + 0.7;

        sunLight.color.setHex(theme.sunColor);
        sunLight.intensity = theme.sunIntensity;
        rimLight.color.setHex(theme.rimColor);
        rimLight.intensity = theme.rimIntensity;
        dustMat.color.setHex(theme.particleColor);
        nebulaMat.color.setHex(theme.atmoColor).lerp(new THREE.Color(0x6366f1), 0.35);

        earthComp.visible = theme.companion === 'earth';
        saturnComp.visible = theme.companion === 'saturn';
        jupiterComp.visible = theme.companion === 'jupiter';
        phobosMesh.visible = theme.companion === 'phobos';
      };

      syncTargetRef.current = applyTheme;
      applyTheme(planetIdRef.current, modeRef.current);

      // Pointer parallax tracking
      let pointerX = 0;
      let pointerY = 0;
      const onPointerMove = (e: PointerEvent) => {
        const w = window.innerWidth || 1280;
        const h = window.innerHeight || 720;
        pointerX = (e.clientX / w - 0.5) * 2;
        pointerY = (e.clientY / h - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      const onResize = () => {
        if (disposed) return;
        const w = container.clientWidth || window.innerWidth || 1280;
        const h = container.clientHeight || window.innerHeight || 720;
        pipeline.resize(w, h, camera);
      };
      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);

      const onContextLost = (e: Event) => {
        e.preventDefault();
        contextLost = true;
        cancelAnimationFrame(rafId);
        window.clearTimeout(timerId);
      };
      const onContextRestored = () => {
        contextLost = false;
        lastTime = performance.now();
        scheduleNext();
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
              if (status === gl.UNSIGNALED) timerId = window.setTimeout(poll, 6);
              else {
                gl.deleteSync(sync);
                timerId = window.setTimeout(cb, 55);
              }
            };
            timerId = window.setTimeout(poll, 6);
            return;
          }
        }
        timerId = window.setTimeout(cb, 55);
      };

      let lastTime = performance.now();
      let elapsed = 0;

      const scheduleNext = () => {
        if (disposed || contextLost) return;
        if (isSoftwareGl) afterDraw(tick);
        else rafId = requestAnimationFrame(tick);
      };

      const tick = () => {
        if (disposed || contextLost) return;
        const now = performance.now();
        const dt = Math.min(0.06, (now - lastTime) / 1000);
        lastTime = now;
        elapsed += dt;

        // Rotate primary world & clouds
        planetMesh.rotation.y += dt * 0.042;
        cloudMesh.rotation.y += dt * 0.058;
        stars.rotation.y += dt * 0.004;

        // Rotate companions
        if (earthComp.visible) {
          earthCompMesh.rotation.y += dt * 0.05;
          earthCompClouds.rotation.y += dt * 0.068;
        }
        if (saturnComp.visible) saturnMesh.rotation.y += dt * 0.05;
        if (jupiterComp.visible) jupMesh.rotation.y += dt * 0.06;
        if (phobosMesh.visible) {
          phobosMesh.rotation.y += dt * 0.25;
          phobosMesh.position.x = -7.2 + Math.cos(elapsed * 0.22) * 1.4;
          phobosMesh.position.y = 3.4 + Math.sin(elapsed * 0.22) * 0.5;
        }

        // Solar mode orbital motion
        if (solarGroup.visible) {
          solarPlanets.forEach((sp) => {
            sp.pivot.rotation.y += dt * sp.speed;
            sp.mesh.rotation.y += dt * 0.35;
          });
        }

        // Drift foreground cosmic dust particles
        const speedMul = modeRef.current === 'storm' ? 3.2 : 1.0;
        const dAttr = dustGeo.attributes.position as THREE.BufferAttribute;
        const arr = dAttr.array as Float32Array;
        for (let i = 0; i < dustCount; i++) {
          arr[i * 3] -= dustSpeeds[i] * dt * speedMul;
          if (arr[i * 3] < -17) arr[i * 3] = 17;
        }
        dAttr.needsUpdate = true;

        // Subtle orbital camera drift + pointer parallax
        _camBase.set(
          Math.sin(elapsed * 0.14) * 0.65 + pointerX * 0.75,
          0.7 + Math.cos(elapsed * 0.11) * 0.35 - pointerY * 0.45,
          17.4
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camBase.x, 3.2, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camBase.y, 3.2, dt);
        camera.lookAt(1.5, -0.1, 0);

        pipeline.renderFrame();
        scheduleNext();
      };

      scheduleNext();

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        window.clearTimeout(timerId);
        window.removeEventListener('pointermove', onPointerMove);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
        disposables.forEach((d) => d.dispose());
        pipeline.dispose();
      };
    } catch {
      setWebglFailed(true);
      return undefined;
    }
  }, []);

  if (webglFailed) {
    return (
      <div
        aria-hidden="true"
        className={`fixed inset-0 -z-10 pointer-events-none ${className}`}
        style={{
          background:
            'radial-gradient(circle at 75% 42%, rgba(56, 189, 248, 0.22) 0%, rgba(15, 23, 42, 0.92) 45%, #02050d 100%)',
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#02050d] ${className}`}
    >
      <div ref={mountRef} className="w-full h-full" />
      {/* Subtle atmospheric vignette for UI readability while keeping planet luminous */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 72% 46%, transparent 18%, rgba(2, 6, 16, 0.32) 72%, rgba(2, 5, 13, 0.68) 100%)',
        }}
      />
    </div>
  );
}
