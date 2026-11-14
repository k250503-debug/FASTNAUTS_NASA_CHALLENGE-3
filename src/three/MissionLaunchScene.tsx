import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ASTRONAUTS } from '../data/astronauts';
import { getPlanetById } from '../data/planets';
import { speakNasaText, stopNasaSpeech } from '../utils/nasaVoice';
import {
  createAstronautMesh,
  createContactShadowTexture,
  createNasaSpaceshipMesh,
  createPlantedFlagMesh,
  setShipAirlockAndRamp,
} from './models';
import { createTerrainAndSkyGroup, getPlanetEnvironmentSpec, groundHeightAt } from './terrain';
import {
  createNebulaTexture,
  createPlanetSurfaceTexture,
  createPlanetaryRingTexture,
  createRadialGlowTexture,
} from './universeTextures';
import {
  createAltitudeSkyDome,
  createCoastalEarthLaunchSite,
  createEntryPlasmaShield,
  createRealisticEarthRig,
} from './launchCinematicAssets';
import type { PlanetId } from '../types';

export type LaunchStageId = 'boarding' | 'transit' | 'landing' | 'disembark';

export interface FlagLandingChoice {
  siteLabel: string;
  outpostX: number;
  outpostZ: number;
}

export const LANDED_SHIP_YAW = -0.52;

interface FlagPreset {
  id: string;
  siteLabel: string;
  localX: number;
  localZ: number;
  outpostX: number;
  outpostZ: number;
}

const FLAG_SITE_PRESETS: FlagPreset[] = [
  {
    id: 'overlook',
    siteLabel: 'Outpost Perimeter Overlook',
    localX: 2.35,
    localZ: 3.1,
    outpostX: 8.8,
    outpostZ: 8.2,
  },
  {
    id: 'north_ridge',
    siteLabel: 'North Crater Horizon',
    localX: -2.15,
    localZ: 3.4,
    outpostX: -8.6,
    outpostZ: 9.8,
  },
  {
    id: 'pad_beacon',
    siteLabel: 'Starship Touchdown Pad',
    localX: 3.3,
    localZ: 1.9,
    outpostX: 15.2,
    outpostZ: 6.4,
  },
];

interface MissionLaunchSceneProps {
  planetId: PlanetId;
  playerName: string;
  startStage?: 'boarding' | 'transit';
  isAudioMuted: boolean;
  onToggleAudio?: () => void;
  onComplete: (flagChoice: FlagLandingChoice) => void;
}

// Cinematic pacing: Coastal Earth Launch & Atmospheric Exit (9s) -> Earth Escape & Transit (22s) -> Realistic Planetary/Lunar Entry (13.5s) -> Disembark (8.2s)
const BOARDING_DURATION = 9.0;
const TRANSIT_DURATION = 22.0;
const LANDING_DURATION = 13.5;
const DISEMBARK_DURATION = 8.2;
const TOTAL_DURATION =
  BOARDING_DURATION + TRANSIT_DURATION + LANDING_DURATION + DISEMBARK_DURATION;

interface NasaFlightBriefing {
  officerName: string;
  etaLabel: string;
  weatherLabel: string;
  precautionsLabel: string;
  spokenScript: string;
}

const NASA_FLIGHT_BRIEFINGS: Record<PlanetId, NasaFlightBriefing> = {
  moon: {
    officerName: 'Flight Officer Elena Vance · NASA Capcom',
    etaLabel: '3 Days (72 hrs) · 384,400 km',
    weatherLabel: 'Vacuum, -170°C to +120°C swings, charged regolith dust & eclipses',
    precautionsLabel:
      'Seal visor locks, inspect storm flues for electrostatic dust, and maintain battery reserves for solar eclipses.',
    spokenScript:
      'Attention crew, this is NASA Mission Control Flight Officer Elena Vance. Estimated transit time to the Lunar South Pole at Shackleton Crater is three days, seventy-two hours total. Expect hard vacuum conditions with extreme thermal swings, Permanently Shadowed Regions rich in water ice, and periodic solar eclipses. Keep EVA suits sealed, inspect the storm flue immediately after landing, and monitor battery reserves.',
  },
  mars: {
    officerName: 'Flight Officer Elena Vance · NASA Capcom',
    etaLabel: '7 Months (210 days) · 225M km',
    weatherLabel: 'Thin CO₂ (0.65 kPa), -63°C, active iron-oxide dust storm',
    precautionsLabel:
      'Clear storm flue intake post-landing, verify O₂ scrubbers, and shelter during dust fronts.',
    spokenScript:
      'Attention crew, this is NASA Mission Control Flight Officer Elena Vance. Estimated interplanetary travel time to Jezero Crater on Mars is seven months, two hundred ten days. Surface telemetry shows thin carbon dioxide atmosphere at minus sixty-three degrees Celsius, with an active iron-oxide dust storm reducing solar yield. Clear the storm flue immediately upon touchdown and maintain shelter readiness.',
  },
  titan: {
    officerName: 'Flight Officer Elena Vance · NASA Capcom',
    etaLabel: '6 Years (2,190 days) · 1.2B km',
    weatherLabel: 'Dense 145 kPa N₂-CH₄ haze, -179°C cryogenic methane squalls',
    precautionsLabel:
      'Engage thermal suit heaters, survey liquid methane shore via Dragonfly drone, and clear cryo frost from flues.',
    spokenScript:
      'Attention crew, this is NASA Mission Control Flight Officer Elena Vance. Estimated deep-space travel time to Titan is six years. Weather sensors confirm a dense nitrogen-methane atmosphere at minus one hundred seventy-nine degrees Celsius with liquid hydrocarbon lakes and orange haze. Engage thermal heaters and deploy the Dragonfly rotorcraft after touchdown.',
  },
  europa: {
    officerName: 'Flight Officer Elena Vance · NASA Capcom',
    etaLabel: '5 Years (1,825 days) · 628M km',
    weatherLabel: 'Cryogenic -160°C ice crust, cryo-plumes, high Jovian radiation',
    precautionsLabel:
      'Limit EVA windows, shelter during Jovian radiation surges, and sterilize cryo-drill hardware.',
    spokenScript:
      'Attention crew, this is NASA Mission Control Flight Officer Elena Vance. Estimated transit time to Jupiter’s moon Europa is five years. Expect a cryogenic minus one hundred sixty degree Celsius fractured ice surface, active vapor plumes, and intense Jovian radiation belts. Prioritize radiation shelter integrity and keep storm flues clear of ice.',
  },
};

// Module-level reusable math helpers (zero GC inside render loop)
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _shipPos = new THREE.Vector3();
const _shipNext = new THREE.Vector3();
const _shipDir = new THREE.Vector3();
const _sideAxis = new THREE.Vector3();
const _fwdAxis = new THREE.Vector3();
const _basisMat = new THREE.Matrix4();
const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _zenithCol = new THREE.Color();
const _zenithEndCol = new THREE.Color();
const _horizonCol = new THREE.Color();
const _horizonEndCol = new THREE.Color();
const _sunGlowCol = new THREE.Color();
const _sunGlowEndCol = new THREE.Color();
const _sunDirVec = new THREE.Vector3();
const _earthLookAnchor = new THREE.Vector3(-10, -8, -8);

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

function createAtmosphereHalo(
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
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float d = max(0.0, dot(-vNormalWorld, vViewDir));
        float fresnel = smoothstep(0.0, 0.34, d) * pow(1.0 - d, uPower) * 2.1;
        gl_FragColor = vec4(uColor, fresnel * uIntensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

function createFlameAssembly(vacuumMode = false) {
  const group = new THREE.Group();

  const coreGeo = new THREE.ConeGeometry(vacuumMode ? 0.54 : 0.46, vacuumMode ? 3.8 : 3.2, 24);
  coreGeo.rotateX(Math.PI);
  coreGeo.translate(0, vacuumMode ? -1.9 : -1.6, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: vacuumMode ? 0xe0f2fe : 0xfef9c3,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreCone = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreCone);

  const outerGeo = new THREE.ConeGeometry(vacuumMode ? 1.35 : 0.86, vacuumMode ? 5.8 : 4.8, 24);
  outerGeo.rotateX(Math.PI);
  outerGeo.translate(0, vacuumMode ? -2.9 : -2.4, 0);
  const outerMat = new THREE.MeshBasicMaterial({
    color: vacuumMode ? 0x60a5fa : 0xf97316,
    transparent: true,
    opacity: vacuumMode ? 0.42 : 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerCone = new THREE.Mesh(outerGeo, outerMat);
  group.add(outerCone);

  const shockGeo = new THREE.RingGeometry(0.16, 0.36, 20);
  shockGeo.rotateX(Math.PI / 2);
  const shockMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.68,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockDiamond = new THREE.Mesh(shockGeo, shockMat);
  shockDiamond.position.y = -0.95;
  group.add(shockDiamond);

  const light = new THREE.PointLight(vacuumMode ? 0x93c5fd : 0xfb923c, 6.2, 32, 1.5);
  light.position.set(0, -1.4, 0);
  group.add(light);

  return { group, coreCone, outerCone, shockDiamond, coreMat, outerMat, shockMat, light };
}

function createFireSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.28, 'rgba(254, 240, 138, 0.92)');
  grad.addColorStop(0.62, 'rgba(249, 115, 22, 0.45)');
  grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getStormOverlayRgba(planetId: PlanetId): { haze: string; streak: string } {
  switch (planetId) {
    case 'mars':
      return { haze: 'rgba(217, 107, 56, 0.30)', streak: 'rgba(253, 186, 116, 0.16)' };
    case 'titan':
      return { haze: 'rgba(234, 179, 8, 0.28)', streak: 'rgba(253, 224, 71, 0.15)' };
    case 'europa':
      return { haze: 'rgba(186, 230, 253, 0.22)', streak: 'rgba(224, 242, 254, 0.12)' };
    default:
      return { haze: 'rgba(148, 163, 184, 0.14)', streak: 'rgba(226, 232, 240, 0.08)' };
  }
}

function getStormColorHex(planetId: PlanetId): number {
  switch (planetId) {
    case 'mars':
      return 0xd96b38;
    case 'titan':
      return 0xeab308;
    case 'europa':
      return 0xbae6fd;
    default:
      return 0x94a3b8;
  }
}

export default function MissionLaunchScene({
  planetId,
  startStage = 'boarding',
  isAudioMuted,
  onComplete,
}: MissionLaunchSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const planet = getPlanetById(planetId);
  const briefing = NASA_FLIGHT_BRIEFINGS[planetId];
  const stormOverlayStyle = getStormOverlayRgba(planetId);
  const [stage, setStage] = useState<LaunchStageId>(startStage);
  const [stormOverlayLevel, setStormOverlayLevel] = useState(0);

  const selectedFlagPreset = FLAG_SITE_PRESETS[0];
  const selectedFlagRef = useRef(selectedFlagPreset);
  selectedFlagRef.current = selectedFlagPreset;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const mutedRef = useRef(isAudioMuted);
  mutedRef.current = isAudioMuted;
  const spokenStageKeyRef = useRef<string>('');

  const speakBriefing = (text: string, urgent = false) => {
    speakNasaText(text, {
      muted: mutedRef.current,
      urgent,
      rate: 0.96,
      pitch: 1.12,
    });
  };

  useEffect(() => {
    if (isAudioMuted) {
      stopNasaSpeech();
      return;
    }

    if (stage === 'transit') {
      const key = `transit-${planetId}`;
      if (spokenStageKeyRef.current !== key) {
        spokenStageKeyRef.current = key;
        speakBriefing(briefing.spokenScript, false);
      }
    } else if (stage === 'disembark') {
      const key = `disembark-${planetId}`;
      if (spokenStageKeyRef.current !== key) {
        spokenStageKeyRef.current = key;
        speakBriefing(
          `Touchdown confirmed on ${planet.name}. Airlock open and ramp deployed. Crew disembarking onto the surface.`,
          false
        );
      }
    } else {
      stopNasaSpeech();
    }
  }, [isAudioMuted, stage, planetId]);

  useEffect(() => {
    return () => {
      stopNasaSpeech();
    };
  }, []);

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
      const chosen = selectedFlagRef.current;
      onCompleteRef.current({
        siteLabel: chosen.siteLabel,
        outpostX: chosen.outpostX,
        outpostZ: chosen.outpostZ,
      });
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 960, container.clientHeight || 600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c1a);
    const fog = new THREE.FogExp2(0x060c1a, 0.008);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      48,
      (container.clientWidth || 960) / (container.clientHeight || 600),
      0.15,
      780
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.32;

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.45);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    keyLight.position.set(22, 28, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.32);
    rimLight.position.set(-18, 14, -20);
    scene.add(rimLight);

    const shadowTex = createContactShadowTexture();
    const fireTex = createFireSpriteTexture();
    const disposables: Array<{ dispose: () => void }> = [shadowTex, fireTex];

    // Dynamic Altitude Sky Dome shared between Earth Launch & Planetary Entry
    const altitudeSky = createAltitudeSkyDome(280);
    altitudeSky.mesh.renderOrder = -10;
    scene.add(altitudeSky.mesh);
    disposables.push(altitudeSky);

    // =========================================================================
    // ACT 1: COASTAL EARTH SPACEPORT, BOARDING, IGNITION & ATMOSPHERIC ESCAPE (9.0s)
    // =========================================================================
    const boardingGroup = new THREE.Group();
    scene.add(boardingGroup);

    const earthLaunchSite = createCoastalEarthLaunchSite(maxAnisotropy);
    boardingGroup.add(earthLaunchSite.group);
    disposables.push(earthLaunchSite);

    const shipBoarding = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    const liftoffFlame = createFlameAssembly(false);
    liftoffFlame.group.position.set(0, 0.35, 0);
    liftoffFlame.group.visible = false;
    shipBoarding.add(liftoffFlame.group);

    // Prandtl-Glauert supersonic vapor condensation cone around hull at Max-Q
    const maxQConeMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const maxQCone = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 1.5, 28, 1, true),
      maxQConeMat
    );
    maxQCone.position.y = 3.1;
    shipBoarding.add(maxQCone);
    boardingGroup.add(shipBoarding);

    // Cryogenic LOX tank chilldown venting steam (active before & during ignition)
    const loxCount = 60;
    const loxPos = new Float32Array(loxCount * 3);
    const loxGeo = new THREE.BufferGeometry();
    loxGeo.setAttribute('position', new THREE.BufferAttribute(loxPos, 3));
    const loxMat = new THREE.PointsMaterial({
      color: 0xf1f5f9,
      size: 0.72,
      map: fireTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const loxPts = new THREE.Points(loxGeo, loxMat);
    boardingGroup.add(loxPts);

    // High-volume deluge steam & launch trench exhaust plume
    const padSmokeCount = 160;
    const padSmokePos = new Float32Array(padSmokeCount * 3);
    const padSmokeSeeds = new Float32Array(padSmokeCount * 2);
    for (let i = 0; i < padSmokeCount; i++) {
      padSmokeSeeds[i * 2] = (i / padSmokeCount) * Math.PI * 2 + (i % 5) * 0.15;
      padSmokeSeeds[i * 2 + 1] = 0.5 + ((i * 19) % 12) * 0.12;
    }
    const padSmokeGeo = new THREE.BufferGeometry();
    padSmokeGeo.setAttribute('position', new THREE.BufferAttribute(padSmokePos, 3));
    const padSmokeMat = new THREE.PointsMaterial({
      color: 0xf1f5f9,
      size: 1.45,
      map: fireTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const padSmokePts = new THREE.Points(padSmokeGeo, padSmokeMat);
    boardingGroup.add(padSmokePts);

    // High-altitude stars (fade in smoothly as Starship exits blue sky above the Karman line)
    const padStarCount = 620;
    const padStarPos = new Float32Array(padStarCount * 3);
    for (let i = 0; i < padStarCount; i++) {
      const a = (i * 2.39996) % (Math.PI * 2);
      const elev = 0.08 + (((i * 73) % 100) / 100) * 0.9;
      const r = 185;
      padStarPos[i * 3] = Math.cos(a) * r * Math.cos(elev * 1.1);
      padStarPos[i * 3 + 1] = 14 + Math.sin(elev * 1.25) * 140;
      padStarPos[i * 3 + 2] = Math.sin(a) * r * Math.cos(elev * 1.1);
    }
    const padStarsGeo = new THREE.BufferGeometry();
    padStarsGeo.setAttribute('position', new THREE.BufferAttribute(padStarPos, 3));
    const padStarsMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.72,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    boardingGroup.add(new THREE.Points(padStarsGeo, padStarsMat));

    const boardingCrew = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(profile, shadowTex, false);
      const startZ = 4.6 + idx * 1.05;
      const laneX = idx % 2 === 0 ? -0.3 : 0.3;
      mesh.position.set(laneX, 0.16, startZ);
      mesh.rotation.y = Math.PI;
      mesh.scale.setScalar(1);
      boardingGroup.add(mesh);
      return { profile, mesh, startZ, laneX };
    });

    // =========================================================================
    // ACT 2: ESCAPING EARTH ORBIT -> DEEP SPACE CRUISE -> DESTINATION APPROACH (22s)
    // =========================================================================
    const transitGroup = new THREE.Group();
    scene.add(transitGroup);

    // Rich deep-space multi-depth starfield
    const spaceStarCount = 1700;
    const spaceStarPos = new Float32Array(spaceStarCount * 3);
    const spaceStarCol = new Float32Array(spaceStarCount * 3);
    for (let i = 0; i < spaceStarCount; i++) {
      const theta = ((i * 137.508) % 360) * (Math.PI / 180);
      const phi = Math.acos(1 - 2 * (((i * 29 + 11) % 100) / 100));
      const r = 290 + (i % 7) * 28;
      spaceStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      spaceStarPos[i * 3 + 1] = r * Math.cos(phi);
      spaceStarPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tint = i % 5;
      if (tint === 0) {
        spaceStarCol[i * 3] = 0.72;
        spaceStarCol[i * 3 + 1] = 0.88;
        spaceStarCol[i * 3 + 2] = 1.0;
      } else if (tint === 1) {
        spaceStarCol[i * 3] = 1.0;
        spaceStarCol[i * 3 + 1] = 0.92;
        spaceStarCol[i * 3 + 2] = 0.78;
      } else {
        spaceStarCol[i * 3] = 0.96;
        spaceStarCol[i * 3 + 1] = 0.98;
        spaceStarCol[i * 3 + 2] = 1.0;
      }
    }
    const spaceStarsGeo = new THREE.BufferGeometry();
    spaceStarsGeo.setAttribute('position', new THREE.BufferAttribute(spaceStarPos, 3));
    spaceStarsGeo.setAttribute('color', new THREE.BufferAttribute(spaceStarCol, 3));
    transitGroup.add(
      new THREE.Points(
        spaceStarsGeo,
        new THREE.PointsMaterial({
          size: 1.05,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          fog: false,
        })
      )
    );

    const nebTex = createNebulaTexture('rgba(56, 189, 248, 0.22)', 'rgba(99, 102, 241, 0.14)', maxAnisotropy);
    disposables.push(nebTex);
    const nebulaSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: nebTex,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    nebulaSprite.position.set(60, 48, -260);
    nebulaSprite.scale.set(240, 150, 1);
    transitGroup.add(nebulaSprite);

    // Distant Sun + corona lighting Earth, Spacecraft & Destination from a realistic Solar angle
    const sunCoreTex = createRadialGlowTexture(
      'rgba(255, 252, 235, 1)',
      'rgba(253, 186, 116, 0.45)',
      'rgba(0, 0, 0, 0)'
    );
    disposables.push(sunCoreTex);
    const sunAnchor = new THREE.Vector3(-120, 72, -195);
    const sunDirNorm = sunAnchor.clone().normalize();
    const sunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 24, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff7ed, fog: false })
    );
    sunDisk.position.copy(sunAnchor);
    transitGroup.add(sunDisk);

    const sunCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunCoreTex,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    sunCorona.position.copy(sunAnchor);
    sunCorona.scale.set(64, 64, 1);
    transitGroup.add(sunCorona);

    const transitSunLight = new THREE.DirectionalLight(0xfff5e4, 2.35);
    transitSunLight.position.copy(sunAnchor);
    transitGroup.add(transitSunLight);

    // Subtle deep-space parallax dust motes
    const streakCount = 120;
    const streakPositions = new Float32Array(streakCount * 6);
    const streakOffsets = new Float32Array(streakCount * 3);
    for (let i = 0; i < streakCount; i++) {
      streakOffsets[i * 3] = (((i * 47) % 80) - 40);
      streakOffsets[i * 3 + 1] = (((i * 61) % 44) - 22);
      streakOffsets[i * 3 + 2] = (((i * 83) % 80) - 40);
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    const streakMat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.24,
      fog: false,
    });
    transitGroup.add(new THREE.LineSegments(streakGeo, streakMat));

    // ORIGIN: Massive Realistic Earth (Day/Night Terminator City Lights, Ocean Specular, Rayleigh Rim)
    const earthOriginPos = new THREE.Vector3(-24, -31, -24);
    const earthRig = createRealisticEarthRig(36, sunDirNorm, maxAnisotropy);
    earthRig.group.position.copy(earthOriginPos);
    transitGroup.add(earthRig.group);
    disposables.push(earthRig);

    // DESTINATION PLANET / MOON far across the transfer corridor at true planetary scale
    const destWorldPos =
      planetId === 'moon'
        ? new THREE.Vector3(148, 12, -40)
        : new THREE.Vector3(172, 14, -46);
    const destRadius =
      planetId === 'moon' ? 28 : planetId === 'europa' ? 30 : planetId === 'titan' ? 33 : 35;

    const destGroup = new THREE.Group();
    destGroup.position.copy(destWorldPos);
    transitGroup.add(destGroup);

    const destTex = createPlanetSurfaceTexture(planetId === 'moon' ? 'luna' : planetId, maxAnisotropy);
    disposables.push(destTex);

    const destSphere = new THREE.Mesh(
      new THREE.SphereGeometry(destRadius, 56, 42),
      new THREE.MeshStandardMaterial({
        map: destTex,
        roughness: planetId === 'europa' ? 0.34 : 0.78,
        metalness: planetId === 'europa' ? 0.14 : 0.05,
        fog: false,
      })
    );
    destGroup.add(destSphere);

    const destAtmoColor =
      planetId === 'mars'
        ? 0xf97316
        : planetId === 'titan'
        ? 0xf59e0b
        : planetId === 'europa'
        ? 0x7dd3fc
        : 0x94a3b8;
    const destHalo = createAtmosphereHalo(
      destRadius * (planetId === 'titan' ? 1.09 : 1.06),
      destAtmoColor,
      planetId === 'moon' ? 0.14 : planetId === 'titan' ? 0.92 : 0.75,
      planetId === 'titan' ? 2.6 : 3.4
    );
    destGroup.add(destHalo);

    // Martian inner moon Phobos silhouette for Mars approach, Saturn+Rings for Titan, Jupiter for Europa
    if (planetId === 'mars') {
      const phobos = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.6, 1),
        new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.92, fog: false })
      );
      phobos.scale.set(1.25, 0.88, 1.0);
      phobos.position.set(destWorldPos.x - 36, destWorldPos.y + 18, destWorldPos.z + 18);
      transitGroup.add(phobos);
    } else if (planetId === 'titan') {
      const saturnTex = createPlanetSurfaceTexture('saturn', maxAnisotropy);
      const ringTex = createPlanetaryRingTexture('saturn', maxAnisotropy);
      disposables.push(saturnTex, ringTex);
      const saturnOrb = new THREE.Mesh(
        new THREE.SphereGeometry(36, 48, 36),
        new THREE.MeshStandardMaterial({ map: saturnTex, roughness: 0.72, fog: false })
      );
      saturnOrb.position.set(255, 42, -135);
      transitGroup.add(saturnOrb);

      const satRingGeo = new THREE.RingGeometry(46, 78, 84);
      const srPos = satRingGeo.attributes.position;
      const srUv = satRingGeo.attributes.uv;
      for (let i = 0; i < srPos.count; i++) {
        const vx = srPos.getX(i);
        const vy = srPos.getY(i);
        const rad = Math.sqrt(vx * vx + vy * vy);
        srUv.setXY(i, (rad - 46) / (78 - 46), 0.5);
      }
      const saturnRing = new THREE.Mesh(
        satRingGeo,
        new THREE.MeshBasicMaterial({
          map: ringTex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          fog: false,
        })
      );
      saturnRing.position.copy(saturnOrb.position);
      saturnRing.rotation.set(Math.PI * 0.38, 0.2, 0.28);
      transitGroup.add(saturnRing);
    } else if (planetId === 'europa') {
      const jupTex = createPlanetSurfaceTexture('jupiter', maxAnisotropy);
      disposables.push(jupTex);
      const jupiterOrb = new THREE.Mesh(
        new THREE.SphereGeometry(48, 48, 36),
        new THREE.MeshStandardMaterial({ map: jupTex, roughness: 0.68, fog: false })
      );
      jupiterOrb.position.set(252, 34, -132);
      transitGroup.add(jupiterOrb);
    }

    // Sweeping Interplanetary Transfer Trajectory starting right above Earth's glowing orbital limb
    const trajStart = new THREE.Vector3(-4, 2.2, 10);
    const trajMid1 = new THREE.Vector3(24, 11.5, 6);
    const trajMid2 = new THREE.Vector3(80, 14.5, -10);
    const trajEnd = new THREE.Vector3(
      destWorldPos.x - destRadius * 1.38,
      destWorldPos.y + 4.0,
      destWorldPos.z + 18.0
    );
    const transitCurve = new THREE.CatmullRomCurve3([trajStart, trajMid1, trajMid2, trajEnd]);

    const shipTransit = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    shipTransit.scale.setScalar(0.84);
    setShipAirlockAndRamp(shipTransit, 0, 0);
    const transitFlame = createFlameAssembly(true);
    transitFlame.group.position.set(0, 0.35, 0);
    shipTransit.add(transitFlame.group);
    transitGroup.add(shipTransit);

    // Subtle RCS cold-gas orientation thruster puff sprite at nose
    const rcsMat = new THREE.SpriteMaterial({
      map: fireTex,
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const rcsSprite = new THREE.Sprite(rcsMat);
    rcsSprite.position.set(0.62, 4.4, 0.2);
    rcsSprite.scale.set(1.4, 0.55, 1);
    shipTransit.add(rcsSprite);

    // Orbital entry plasma bow-warmth (Mars / Titan only during final approach)
    const transitEntryGlowMat = new THREE.MeshBasicMaterial({
      color: planetId === 'titan' ? 0xfbbf24 : 0xfb923c,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const transitEntryGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.48),
      transitEntryGlowMat
    );
    transitEntryGlow.position.y = 4.55;
    shipTransit.add(transitEntryGlow);

    const sparkCount = 110;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    transitGroup.add(
      new THREE.Points(
        sparkGeo,
        new THREE.PointsMaterial({
          color: 0xbae6fd,
          size: 0.34,
          transparent: true,
          opacity: 0.85,
          fog: false,
        })
      )
    );

    // =========================================================================
    // ACT 3 & ACT 4 SHARED SURFACE: REALISTIC ENTRY -> FLIP/PITCH-OVER -> TOUCHDOWN -> FLAG
    // =========================================================================
    const surfaceGroup = new THREE.Group();
    scene.add(surfaceGroup);

    const planetSpec = getPlanetEnvironmentSpec(planetId);
    const terrainBundle = createTerrainAndSkyGroup(planetId, maxAnisotropy);
    surfaceGroup.add(terrainBundle.group);

    // High-altitude atmospheric cloud strata (Mars thin dust deck / Titan thick golden methane layers)
    const entryCloudLayer = new THREE.Group();
    const isAtmoWorld = planetId === 'mars' || planetId === 'titan';
    if (isAtmoWorld) {
      const cloudTex = createNebulaTexture(
        planetId === 'titan' ? 'rgba(245, 158, 11, 0.44)' : 'rgba(234, 120, 68, 0.28)',
        planetId === 'titan' ? 'rgba(180, 83, 9, 0.35)' : 'rgba(194, 65, 12, 0.2)',
        maxAnisotropy
      );
      disposables.push(cloudTex);
      const deckHeights = planetId === 'titan' ? [34, 52, 72] : [46, 68];
      deckHeights.forEach((cy, idx) => {
        const deckMat = new THREE.MeshBasicMaterial({
          map: cloudTex,
          transparent: true,
          opacity: planetId === 'titan' ? 0.56 - idx * 0.08 : 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const deck = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), deckMat);
        deck.rotation.x = -Math.PI / 2;
        deck.rotation.z = idx * 0.8;
        deck.position.set(-16, cy, -12);
        entryCloudLayer.add(deck);
      });
    }
    surfaceGroup.add(entryCloudLayer);

    const lzRing = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 3.85, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      })
    );
    lzRing.rotation.x = -Math.PI / 2;
    lzRing.position.y = 0.04;
    surfaceGroup.add(lzRing);

    const shipLanding = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    const landingFlame = createFlameAssembly(planetId === 'moon' || planetId === 'europa');
    landingFlame.group.position.set(0, 0.35, 0);
    shipLanding.add(landingFlame.group);

    // Hypersonic GLSL Bow-Shock Plasma Shield (only visible on atmospheric Mars & Titan entry!)
    const entryPlasmaShield = createEntryPlasmaShield(
      planetId === 'titan' ? 0xf59e0b : 0xf97316,
      planetId === 'titan' ? 0xfde047 : 0xfdba74
    );
    shipLanding.add(entryPlasmaShield.group);
    disposables.push(entryPlasmaShield);

    // Ionized ablation plasma embers streaming off behind hull during Mars/Titan hypersonic entry
    const ablationCount = 110;
    const ablationPos = new Float32Array(ablationCount * 3);
    const ablationGeo = new THREE.BufferGeometry();
    ablationGeo.setAttribute('position', new THREE.BufferAttribute(ablationPos, 3));
    const ablationMat = new THREE.PointsMaterial({
      color: planetId === 'titan' ? 0xfcd34d : 0xfb923c,
      size: 0.62,
      map: fireTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ablationPts = new THREE.Points(ablationGeo, ablationMat);
    ablationPts.frustumCulled = false;
    surfaceGroup.add(ablationPts);

    surfaceGroup.add(shipLanding);

    const stormColor = getStormColorHex(planetId);

    const blastCount = 340;
    const blastPos = new Float32Array(blastCount * 3);
    const blastVel = new Float32Array(blastCount * 3);
    const blastAge = new Float32Array(blastCount);
    for (let i = 0; i < blastCount; i++) {
      const angle = (i / blastCount) * Math.PI * 2 + (i % 7) * 0.23;
      const spd = 4.6 + (i % 11) * 0.95;
      blastVel[i * 3] = Math.cos(angle) * spd;
      blastVel[i * 3 + 1] = 0.75 + (i % 5) * 0.55;
      blastVel[i * 3 + 2] = Math.sin(angle) * spd;
      blastAge[i] = (i % 20) / 20;
      blastPos[i * 3] = Math.cos(angle) * (0.4 + blastAge[i] * 6);
      blastPos[i * 3 + 1] = 0.2 + blastAge[i] * 1.8;
      blastPos[i * 3 + 2] = Math.sin(angle) * (0.4 + blastAge[i] * 6);
    }
    const blastGeo = new THREE.BufferGeometry();
    blastGeo.setAttribute('position', new THREE.BufferAttribute(blastPos, 3));
    const blastMat = new THREE.PointsMaterial({
      color: stormColor,
      size: 0.76,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    surfaceGroup.add(new THREE.Points(blastGeo, blastMat));

    const fireParticleCount = 240;
    const engineFirePos = new Float32Array(fireParticleCount * 3);
    const engineFireColors = new Float32Array(fireParticleCount * 3);
    const engineFireSeeds = new Float32Array(fireParticleCount * 3);
    for (let i = 0; i < fireParticleCount; i++) {
      engineFireSeeds[i * 3] = ((i * 73) % 100) / 100;
      engineFireSeeds[i * 3 + 1] = ((i * 137.5) % 360) * (Math.PI / 180);
      engineFireSeeds[i * 3 + 2] = 0.35 + ((i * 29) % 100) / 140;
    }
    const engineFireGeo = new THREE.BufferGeometry();
    engineFireGeo.setAttribute('position', new THREE.BufferAttribute(engineFirePos, 3));
    engineFireGeo.setAttribute('color', new THREE.BufferAttribute(engineFireColors, 3));
    const engineFireMat = new THREE.PointsMaterial({
      size: 0.96,
      map: fireTex,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const engineFireParticles = new THREE.Points(engineFireGeo, engineFireMat);
    engineFireParticles.frustumCulled = false;
    surfaceGroup.add(engineFireParticles);

    const windCount = 340;
    const windPos = new Float32Array(windCount * 3);
    for (let i = 0; i < windCount; i++) {
      windPos[i * 3] = ((i * 43) % 44) - 22;
      windPos[i * 3 + 1] = 0.25 + ((i * 19) % 14);
      windPos[i * 3 + 2] = ((i * 61) % 40) - 20;
    }
    const windGeo = new THREE.BufferGeometry();
    windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
    const windMat = new THREE.PointsMaterial({
      color: stormColor,
      size: 0.48,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    surfaceGroup.add(new THREE.Points(windGeo, windMat));

    const dustRingMat1 = new THREE.MeshBasicMaterial({
      color: stormColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const dustRing1 = new THREE.Mesh(new THREE.RingGeometry(1.4, 3.2, 36), dustRingMat1);
    dustRing1.rotation.x = -Math.PI / 2;
    dustRing1.position.y = 0.08;
    surfaceGroup.add(dustRing1);

    const dustRingMat2 = new THREE.MeshBasicMaterial({
      color: planetId === 'europa' ? 0xbae6fd : 0xfdba74,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const dustRing2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 2.2, 32), dustRingMat2);
    dustRing2.rotation.x = -Math.PI / 2;
    dustRing2.position.y = 0.12;
    surfaceGroup.add(dustRing2);

    // =========================================================================
    // ACT 4: CREW DISEMBARKS DOWN RAMP AT FULL 1.0 SCALE + FLAG PLANTING
    // =========================================================================
    const disembarkGroup = new THREE.Group();
    surfaceGroup.add(disembarkGroup);

    const plantedFlag = createPlantedFlagMesh(shadowTex, maxAnisotropy);
    plantedFlag.visible = false;
    disembarkGroup.add(plantedFlag);

    const flagTargetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.52, 32),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      })
    );
    flagTargetRing.rotation.x = -Math.PI / 2;
    disembarkGroup.add(flagTargetRing);

    const flagImpactRingMat = new THREE.MeshBasicMaterial({
      color: stormColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const flagImpactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.65, 32),
      flagImpactRingMat
    );
    flagImpactRing.rotation.x = -Math.PI / 2;
    disembarkGroup.add(flagImpactRing);

    const FORMATION_TARGETS: Array<{ x: number; z: number; yaw: number }> = [
      { x: 1.65, z: 3.25, yaw: 0.55 },
      { x: -1.8, z: 4.5, yaw: 0.2 },
      { x: 3.6, z: 4.3, yaw: -0.35 },
      { x: -3.2, z: 3.6, yaw: 0.4 },
      { x: 4.8, z: 3.1, yaw: -0.5 },
      { x: 0.1, z: 4.9, yaw: 0.08 },
    ];

    const heldFlagPole = new THREE.Group();
    const poleRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.036, 2.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 })
    );
    poleRod.position.set(0, -0.35, 0.25);
    poleRod.rotation.x = 0.25;
    heldFlagPole.add(poleRod);

    const disembarkCrew = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(profile, shadowTex, false);
      mesh.visible = false;
      mesh.scale.setScalar(1);
      disembarkGroup.add(mesh);
      if (idx === 0 && mesh.userData.animRefs?.rightArm) {
        mesh.userData.animRefs.rightArm.add(heldFlagPole);
      }
      return {
        profile,
        mesh,
        target: FORMATION_TARGETS[idx % FORMATION_TARGETS.length],
      };
    });

    // Procedural thruster & wind audio
    let audioCtx: AudioContext | null = null;
    let thrusterGain: GainNode | null = null;
    let windGain: GainNode | null = null;
    let noiseSrc: AudioBufferSourceNode | null = null;
    let bassOsc: OscillatorNode | null = null;

    if (!isAudioMuted) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtx = new AudioCtx();
          const bufLen = audioCtx.sampleRate * 2;
          const noiseBuf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
          const ch = noiseBuf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) ch[i] = Math.random() * 2 - 1;
          noiseSrc = audioCtx.createBufferSource();
          noiseSrc.buffer = noiseBuf;
          noiseSrc.loop = true;

          const lowFilter = audioCtx.createBiquadFilter();
          lowFilter.type = 'lowpass';
          lowFilter.frequency.value = 180;
          thrusterGain = audioCtx.createGain();
          thrusterGain.gain.value = 0.0001;

          const bandFilter = audioCtx.createBiquadFilter();
          bandFilter.type = 'bandpass';
          bandFilter.frequency.value = 340;
          bandFilter.Q.value = 0.9;
          windGain = audioCtx.createGain();
          windGain.gain.value = 0.0001;

          bassOsc = audioCtx.createOscillator();
          bassOsc.type = 'sawtooth';
          bassOsc.frequency.value = 46;
          const bassLow = audioCtx.createBiquadFilter();
          bassLow.type = 'lowpass';
          bassLow.frequency.value = 95;

          noiseSrc.connect(lowFilter);
          lowFilter.connect(thrusterGain);
          thrusterGain.connect(audioCtx.destination);
          noiseSrc.connect(bandFilter);
          bandFilter.connect(windGain);
          windGain.connect(audioCtx.destination);
          bassOsc.connect(bassLow);
          bassLow.connect(thrusterGain);

          noiseSrc.start();
          bassOsc.start();
          if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        }
      } catch {
        audioCtx = null;
      }
    }

    if (!isSoftwareGl) renderer.compile(scene, camera);

    const handleResize = () => {
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let disposed = false;
    let contextLost = false;
    let frameId = 0;
    let lastNow = performance.now();
    let elapsed = 0;
    let seqTime = startStage === 'transit' ? BOARDING_DURATION : 0;
    let completed = false;
    let lastReportedStage: LaunchStageId = startStage;
    let lastReportedStorm = -1;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
    };
    const onContextRestored = () => {
      contextLost = false;
      lastNow = performance.now();
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
            if (status === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
            else {
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
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    const tick = () => {
      if (disposed || contextLost) return;
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastNow) / 1000);
      lastNow = now;
      elapsed += dt;

      seqTime = Math.min(TOTAL_DURATION + 0.75, seqTime + dt);

      const curStage: LaunchStageId =
        seqTime < BOARDING_DURATION
          ? 'boarding'
          : seqTime < BOARDING_DURATION + TRANSIT_DURATION
          ? 'transit'
          : seqTime < BOARDING_DURATION + TRANSIT_DURATION + LANDING_DURATION
          ? 'landing'
          : 'disembark';

      if (curStage !== lastReportedStage) {
        lastReportedStage = curStage;
        setStage(curStage);
      }

      boardingGroup.visible = curStage === 'boarding';
      transitGroup.visible = curStage === 'transit';
      surfaceGroup.visible = curStage === 'landing' || curStage === 'disembark';
      disembarkGroup.visible = curStage === 'disembark';
      altitudeSky.mesh.visible = curStage !== 'transit';

      let targetThrustAudio = 0.0001;
      let targetWindAudio = 0.0001;

      if (curStage === 'boarding') {
        const t = seqTime;
        const liftoffStart = 4.2;
        const liftoffP = THREE.MathUtils.clamp((t - liftoffStart) / (BOARDING_DURATION - liftoffStart), 0, 1);

        // Coastal twilight azure -> upper stratosphere indigo -> starry black Karman line
        const skyAscent = THREE.MathUtils.clamp((liftoffP - 0.12) / 0.78, 0, 1);
        _zenithCol.setHex(0x0c2d5e).lerp(_zenithEndCol.setHex(0x010308), skyAscent);
        _horizonCol.setHex(0x3b82c4).lerp(_horizonEndCol.setHex(0x040916), skyAscent);
        _sunGlowCol.setHex(0xfdba74).lerp(_sunGlowEndCol.setHex(0x60a5fa), skyAscent);
        _sunDirVec.set(0.65, 0.25, -0.7).normalize();
        altitudeSky.setColors(_zenithCol, _horizonCol, _sunGlowCol, _sunDirVec, 1 - skyAscent * 0.85);
        altitudeSky.mesh.position.set(0, 0, 0);

        _skyColor.setHex(0x132b4d).lerp(_zenithEndCol.setHex(0x010308), skyAscent);
        scene.background = _skyColor;
        fog.color.copy(_horizonCol);
        fog.density = THREE.MathUtils.lerp(0.0045, 0.0006, skyAscent);

        keyLight.color.setHex(0xffe7c2);
        keyLight.intensity = 1.62;
        hemiLight.color.setHex(0x7dd3fc);
        hemiLight.groundColor.setHex(0x1e293b);
        hemiLight.intensity = THREE.MathUtils.lerp(0.54, 0.26, skyAscent);

        padStarsMat.opacity = THREE.MathUtils.smoothstep(skyAscent, 0.35, 0.95) * 0.92;

        // Crew boards (0..2.8s), airlock closes & ramp retracts (2.8..3.5s)
        const doorOpen = t < 2.9 ? Math.min(1, t / 0.45) : Math.max(0, 1 - (t - 2.9) / 0.45);
        const rampOpen = t < 3.0 ? 1 : Math.max(0, 1 - (t - 3.0) / 0.45);
        setShipAirlockAndRamp(shipBoarding, doorOpen, rampOpen);

        // Retract BOTH umbilical arm and upper clamp right before ignition
        const armRetract = THREE.MathUtils.clamp((t - 3.05) / 0.65, 0, 1);
        earthLaunchSite.umbilicalArm.rotation.y = -0.45 - armRetract * 1.05;
        earthLaunchSite.upperClampArm.rotation.y = -0.45 - armRetract * 1.1;

        const ignitionP = THREE.MathUtils.clamp((t - 3.6) / 0.65, 0, 1);
        const shipAlt = Math.pow(liftoffP, 2.35) * 66.0;
        const downrangeX = Math.pow(liftoffP, 2.6) * 22.0; // Eastward gravity turn over coastal ocean
        shipBoarding.position.set(downrangeX, shipAlt, 0);
        shipBoarding.rotation.set(0, 0, -Math.pow(liftoffP, 1.8) * 0.52);

        // Max-Q Prandtl-Glauert vapor shock flash around liftoffP = 0.36..0.64
        const maxQP = 1 - Math.abs(liftoffP - 0.5) / 0.16;
        maxQConeMat.opacity = maxQP > 0 ? maxQP * 0.34 : 0;
        maxQCone.scale.setScalar(0.95 + liftoffP * 0.4);

        const flameStrength = Math.max(ignitionP * 0.55, liftoffP > 0 ? 1 : 0);
        liftoffFlame.group.visible = flameStrength > 0.02;
        if (flameStrength > 0.02) {
          const fl = 0.9 + Math.sin(t * 44) * 0.15;
          liftoffFlame.coreCone.scale.set(1, fl * (0.72 + liftoffP * 1.3), 1);
          liftoffFlame.outerCone.scale.set(1.15, fl * (0.82 + liftoffP * 1.55), 1.15);
          liftoffFlame.shockDiamond.visible = liftoffP > 0.05;
          liftoffFlame.light.intensity = 7.4 * fl * flameStrength;
          targetThrustAudio = 0.072 * flameStrength;
        }

        // LOX cryogenic chilldown steam venting pre-ignition
        const loxFade = Math.max(0, 1 - liftoffP * 4.5);
        loxMat.opacity = 0.42 * loxFade;
        if (loxFade > 0.01) {
          const lxAttr = loxGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < loxCount; i++) {
            const cy = (t * 0.95 + i / loxCount) % 1;
            loxPos[i * 3] = downrangeX - 0.85 - cy * 3.8 + Math.sin(t * 2 + i) * 0.3;
            loxPos[i * 3 + 1] = shipAlt + 3.2 - cy * 1.4;
            loxPos[i * 3 + 2] = Math.cos(t * 1.8 + i) * (0.4 + cy * 1.1);
          }
          lxAttr.needsUpdate = true;
        }

        // Deluge flame trench blast steam clouds
        const smokeStrength = ignitionP * Math.max(0.05, 1 - liftoffP * 0.95);
        padSmokeMat.opacity = smokeStrength * 0.48;
        if (smokeStrength > 0.01) {
          const psAttr = padSmokeGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < padSmokeCount; i++) {
            const ang = padSmokeSeeds[i * 2];
            const spd = padSmokeSeeds[i * 2 + 1];
            const cycle = ((t - 3.5) * 1.35 + (i % 16) / 16) % 1;
            const rad = 1.4 + Math.max(0, cycle) * 14.5 * spd;
            padSmokePos[i * 3] = Math.cos(ang) * rad;
            padSmokePos[i * 3 + 1] = 0.3 + Math.sin(Math.max(0, cycle) * Math.PI) * 2.4;
            padSmokePos[i * 3 + 2] = Math.sin(ang) * rad;
          }
          psAttr.needsUpdate = true;
        }

        boardingCrew.forEach((member, idx) => {
          const walkDelay = idx * 0.25;
          const walkSpan = 1.5;
          const localP = THREE.MathUtils.clamp((t - walkDelay) / walkSpan, 0, 1);

          const zPos = THREE.MathUtils.lerp(member.startZ, 1.24, localP);
          const rampBlend = THREE.MathUtils.smoothstep(4.2 - zPos, 0, 2.9);
          const yPos = 0.16 + rampBlend * 1.82;
          const xPos = THREE.MathUtils.lerp(member.laneX, 0, rampBlend);

          member.mesh.scale.setScalar(1);
          member.mesh.visible = localP < 0.985;
          member.mesh.position.set(xPos, yPos, zPos);

          const walkCycle = t * 10.5 + idx * 1.1;
          const swing = Math.sin(walkCycle) * 0.55;
          const refs = member.mesh.userData.animRefs;
          if (refs) {
            refs.leftLeg.rotation.x = swing;
            refs.rightLeg.rotation.x = -swing;
            refs.leftArm.rotation.x = -swing * 0.75;
            refs.rightArm.rotation.x = swing * 0.75;
            refs.selectionRing.visible = false;
          }
        });

        const shipRefs = shipBoarding.userData.spaceshipRefs;
        if (shipRefs) {
          shipRefs.beaconMat.emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 4);
        }
        if (lastReportedStorm !== 0) {
          lastReportedStorm = 0;
          setStormOverlayLevel(0);
        }

        // Camera shifts smoothly from coastal launchpad crew framing -> soaring chase-cam climbing into space!
        const shakeAmt = liftoffP > 0.01 ? 0.11 * (1 - liftoffP * 0.55) : 0;
        const preLiftCam = THREE.MathUtils.clamp(t / liftoffStart, 0, 1);
        if (liftoffP <= 0.01) {
          _camPos.set(
            THREE.MathUtils.lerp(6.8, 9.2, preLiftCam),
            THREE.MathUtils.lerp(2.4, 3.8, preLiftCam),
            THREE.MathUtils.lerp(11.6, 13.8, preLiftCam)
          );
          _camLook.set(0, THREE.MathUtils.lerp(1.9, 3.2, preLiftCam), THREE.MathUtils.lerp(3.2, 0.2, preLiftCam));
        } else {
          // Dramatic tracking camera orbiting higher and looking down past roaring engines toward Earth coast below
          const climbEase = liftoffP * liftoffP * (3 - 2 * liftoffP);
          _camPos.set(
            downrangeX + THREE.MathUtils.lerp(9.2, -9.5, climbEase) + Math.sin(t * 49) * shakeAmt,
            shipAlt + THREE.MathUtils.lerp(3.8, 5.2, climbEase) + Math.cos(t * 43) * shakeAmt,
            THREE.MathUtils.lerp(13.8, 12.6, climbEase)
          );
          _camLook.set(
            downrangeX * THREE.MathUtils.lerp(0.85, 1.0, climbEase),
            shipAlt + THREE.MathUtils.lerp(2.8, 1.2, climbEase),
            0
          );
        }
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);
      } else if (curStage === 'transit') {
        const localT = seqTime - BOARDING_DURATION;
        const p = THREE.MathUtils.clamp(localT / TRANSIT_DURATION, 0, 1);

        _skyColor.setHex(0x010308);
        scene.background = _skyColor;
        fog.color.copy(_skyColor);
        fog.density = 0.00025;
        keyLight.color.setHex(0xfff8eb);
        keyLight.intensity = 1.5;
        hemiLight.color.setHex(0x38bdf8);
        hemiLight.groundColor.setHex(0x0f172a);
        hemiLight.intensity = 0.28;

        earthRig.earthMesh.rotation.y += dt * 0.045;
        earthRig.cloudMesh.rotation.y += dt * 0.068;
        destSphere.rotation.y += dt * 0.09;

        const ease = p * p * (3 - 2 * p);
        transitCurve.getPointAt(ease, _shipPos);
        const pNext = Math.min(1, ease + 0.008);
        transitCurve.getPointAt(pNext, _shipNext);
        _shipDir.subVectors(_shipNext, _shipPos);
        if (_shipDir.lengthSq() > 0.00001) {
          _shipDir.normalize();
          _fwdAxis.set(0, 0, 1);
          _sideAxis.crossVectors(_shipDir, _fwdAxis);
          if (_sideAxis.lengthSq() < 0.0001) _sideAxis.set(1, 0, 0);
          _sideAxis.normalize();
          _fwdAxis.crossVectors(_sideAxis, _shipDir).normalize();
          _basisMat.makeBasis(_sideAxis, _shipDir, _fwdAxis);
          shipTransit.quaternion.setFromRotationMatrix(_basisMat);
          shipTransit.rotateY(Math.sin(p * Math.PI * 1.5) * 0.35);

          // Pitch nose down toward entry interface in final 12% of approach
          const entryRotate = THREE.MathUtils.smoothstep(p, 0.85, 1.0);
          if (entryRotate > 0) {
            shipTransit.rotateX(entryRotate * 0.62);
          }
        }
        shipTransit.position.copy(_shipPos);

        // Burn profile: strong TLI Earth-escape burn (0..0.38), ballistic coast with RCS bursts (0.38..0.76), capture burn (0.76..1.0)
        const burnLevel =
          p < 0.38
            ? 1.05 - (p / 0.38) * 0.38
            : p < 0.76
            ? 0.24 + Math.sin(p * 10) * 0.05
            : 0.45 + ((p - 0.76) / 0.24) * 0.65;
        const flicker = 0.88 + Math.sin(localT * 36) * 0.13 + Math.cos(localT * 23) * 0.09;
        transitFlame.coreCone.scale.set(1, flicker * 1.15 * burnLevel, 1);
        transitFlame.outerCone.scale.set(1.1, flicker * 1.45 * burnLevel, 1.1);
        transitFlame.shockDiamond.visible = burnLevel > 0.55;
        transitFlame.light.intensity = 5.6 * flicker * burnLevel;

        // Periodic RCS cold-gas attitude bursts during mid-course coast
        const rcsWave = Math.max(0, Math.sin(localT * 2.4) - 0.65) * 2.8;
        rcsMat.opacity = p > 0.35 && p < 0.85 ? Math.min(0.75, rcsWave) : 0;

        // Subtle ionization shimmer on bow during final orbital entry approach (Mars & Titan only)
        const captureWarmup = THREE.MathUtils.clamp((p - 0.86) / 0.14, 0, 1);
        transitEntryGlowMat.opacity =
          planetId === 'moon' || planetId === 'europa'
            ? 0
            : captureWarmup * 0.48 * (0.85 + 0.15 * Math.sin(localT * 28));

        const sAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < sparkCount; i++) {
          const age = (localT * 2.2 + i / sparkCount) % 1;
          const spread = (i % 7) * 0.065;
          sparkPositions[i * 3] =
            _shipPos.x - _shipDir.x * (1.2 + age * 10.5 * burnLevel) + Math.sin(i * 1.7) * spread;
          sparkPositions[i * 3 + 1] =
            _shipPos.y - _shipDir.y * (1.2 + age * 10.5 * burnLevel) + Math.cos(i * 2.3) * spread;
          sparkPositions[i * 3 + 2] =
            _shipPos.z - _shipDir.z * (1.2 + age * 10.5 * burnLevel) + Math.sin(i * 3.1) * spread;
        }
        sAttr.needsUpdate = true;

        const stAttr = streakGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < streakCount; i++) {
          const ox = streakOffsets[i * 3];
          const oy = streakOffsets[i * 3 + 1];
          const oz = streakOffsets[i * 3 + 2];
          const shift = ((localT * 20 + i * 0.9) % 64) - 32;
          const bx = _shipPos.x + ox - _shipDir.x * shift;
          const by = _shipPos.y + oy - _shipDir.y * shift;
          const bz = _shipPos.z + oz - _shipDir.z * shift;
          streakPositions[i * 6] = bx;
          streakPositions[i * 6 + 1] = by;
          streakPositions[i * 6 + 2] = bz;
          streakPositions[i * 6 + 3] = bx - _shipDir.x * 1.1;
          streakPositions[i * 6 + 4] = by - _shipDir.y * 1.1;
          streakPositions[i * 6 + 5] = bz - _shipDir.z * 1.1;
        }
        stAttr.needsUpdate = true;

        // Dynamic 3-act space cinematography:
        // 1) Earth Orbit Escape (0..0.42): Look slightly back across ship toward colossal sunlit Earth & glowing limb receding behind!
        // 2) Deep-Space Cruise Swing (0.42..0.72): Orbit smoothly from Earth behind to Destination looming ahead!
        // 3) Planetary/Lunar Approach (0.72..1.0): Tight chase-shoulder shot framing the massive approaching target world!
        if (p < 0.42) {
          const sp = p / 0.42;
          const sEase = sp * sp * (3 - 2 * sp);
          _camPos.set(
            _shipPos.x + THREE.MathUtils.lerp(6.8, 5.2, sEase),
            _shipPos.y + THREE.MathUtils.lerp(4.4, 3.6, sEase),
            _shipPos.z + THREE.MathUtils.lerp(7.6, 11.2, sEase)
          );
          // Frame ship in foreground with Earth's massive curved horizon glowing directly behind/below
          _camLook.lerpVectors(
            _earthLookAnchor,
            _shipPos,
            THREE.MathUtils.lerp(0.68, 0.88, sEase)
          );
        } else if (p < 0.72) {
          const sp = (p - 0.42) / 0.3;
          const orbitAng = THREE.MathUtils.lerp(0.95, 2.25, sp);
          const camDist = THREE.MathUtils.lerp(11.6, 10.2, Math.sin(sp * Math.PI));
          _camPos.set(
            _shipPos.x + Math.cos(orbitAng) * camDist,
            _shipPos.y + THREE.MathUtils.lerp(3.6, 2.4, sp),
            _shipPos.z + Math.sin(orbitAng) * camDist
          );
          _camLook.lerpVectors(_shipPos, destWorldPos, THREE.MathUtils.lerp(0.06, 0.28, sp));
        } else {
          const sp = (p - 0.72) / 0.28;
          const sEase = sp * sp * (3 - 2 * sp);
          _camPos.set(
            _shipPos.x + THREE.MathUtils.lerp(-6.4, -8.8, sEase),
            _shipPos.y + THREE.MathUtils.lerp(2.4, 3.1, sEase),
            _shipPos.z + THREE.MathUtils.lerp(7.4, 6.4, sEase)
          );
          _camLook.lerpVectors(_shipPos, destWorldPos, THREE.MathUtils.lerp(0.28, 0.52, sEase));
        }
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        targetThrustAudio = 0.042 * burnLevel;
        if (lastReportedStorm !== 0) {
          lastReportedStorm = 0;
          setStormOverlayLevel(0);
        }
      } else if (curStage === 'landing') {
        // ACT 3 (13.5s): PHYSICALLY DIFFERENTIATED PLANETARY / LUNAR ENTRY
        const localT = seqTime - (BOARDING_DURATION + TRANSIT_DURATION);
        const descentDuration = 12.1;
        const p = THREE.MathUtils.clamp(localT / descentDuration, 0, 1);

        const inv = 1 - p;
        const afterTouch = Math.max(0, localT - descentDuration);
        const gravScale = planet.gravityMs2 / 3.71;
        const settleBounce =
          p >= 1
            ? Math.max(
                0,
                Math.exp(-afterTouch * (3.8 + gravScale * 1.5)) *
                  Math.sin(afterTouch * (12 + gravScale * 4)) *
                  0.11
              )
            : 0;

        // High-orbital entry trajectory starting from alt = 125m sweeping down to pad (0, 0, 0)
        const alt = 125 * Math.pow(inv, 2.45) + settleBounce;
        const glideX = -46 * Math.pow(inv, 1.9);
        const glideZ = -34 * Math.pow(inv, 1.95) + Math.sin(p * Math.PI) * 2.2 * inv;

        // Atmospheric worlds (Mars/Titan): hypersonic belly-flop (1.08 rad -> flip upright at p=0.45..0.68)
        // Vacuum worlds (Moon/Europa): PDI braking burn pitch-over (0.92 rad -> pitch upright at p=0.48..0.70)
        const flipStart = isAtmoWorld ? 0.45 : 0.48;
        const flipSpan = 0.23;
        const flipP = THREE.MathUtils.clamp((p - flipStart) / flipSpan, 0, 1);
        const flipEase = flipP * flipP * (3 - 2 * flipP);
        const entryAngle = isAtmoWorld ? 1.08 : 0.92;
        const pitch = (1 - flipEase) * entryAngle;
        const bankRoll = Math.sin(p * Math.PI) * (1 - flipEase) * -0.16;

        shipLanding.position.set(glideX, alt, glideZ);
        shipLanding.rotation.set(pitch, LANDED_SHIP_YAW, bankRoll);
        setShipAirlockAndRamp(shipLanding, 0, 0);

        // Realistic GLSL Bow-Shock Plasma + Ablation Embers ONLY on atmospheric worlds (Mars & Titan)
        const plasmaEnvelope =
          isAtmoWorld && p < 0.48 ? Math.sin((p / 0.48) * Math.PI) * (planetId === 'titan' ? 0.98 : 0.88) : 0;
        entryPlasmaShield.update(localT, plasmaEnvelope);

        ablationMat.opacity = plasmaEnvelope * 0.85;
        if (plasmaEnvelope > 0.02) {
          const abAttr = ablationGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < ablationCount; i++) {
            const age = (localT * 2.8 + i / ablationCount) % 1;
            const spread = ((i % 9) - 4) * 0.32;
            ablationPos[i * 3] = glideX - age * 14.5 + spread;
            ablationPos[i * 3 + 1] = alt + age * 9.5 + Math.sin(i * 2.1) * 1.1;
            ablationPos[i * 3 + 2] = glideZ - age * 10.5 + Math.cos(i * 1.7) * 0.8;
          }
          abAttr.needsUpdate = true;
        }

        // Entry cloud deck fades cleanly once ship descends below y = 30m
        entryCloudLayer.visible = isAtmoWorld && alt > 12;

        // Engine burn profile:
        // - Atmospheric worlds: engines silent during upper aerobraking (p<0.40), roar awake for belly-flip & hover-slam!
        // - Vacuum worlds (Moon/Europa): Powered Descent (PDI) braking burn active throughout entry & touchdown!
        const engineRamp = isAtmoWorld
          ? THREE.MathUtils.clamp((p - 0.38) / 0.14, 0, 1)
          : THREE.MathUtils.clamp(0.68 + p * 0.32, 0.65, 1);
        const fireFade = p < 1 ? engineRamp : Math.max(0, 1 - afterTouch / 1.1);
        const flicker = 0.86 + Math.sin(localT * 42) * 0.16 + Math.cos(localT * 29) * 0.1;

        landingFlame.group.visible = fireFade > 0.02;
        landingFlame.coreCone.scale.set(
          0.98 * fireFade + 0.1,
          1.35 * flicker * fireFade,
          0.98 * fireFade + 0.1
        );
        landingFlame.outerCone.scale.set(
          1.22 * fireFade + 0.1,
          1.6 * flicker * fireFade,
          1.22 * fireFade + 0.1
        );
        landingFlame.shockDiamond.visible = isAtmoWorld && fireFade > 0.45;
        landingFlame.coreMat.opacity = 0.94 * fireFade;
        landingFlame.outerMat.opacity = (isAtmoWorld ? 0.64 : 0.46) * fireFade;
        landingFlame.light.intensity = 9.0 * flicker * fireFade;

        engineFireParticles.visible = fireFade > 0.02;
        engineFireMat.opacity = 0.92 * fireFade;
        if (fireFade > 0.02) {
          const efPosAttr = engineFireGeo.attributes.position as THREE.BufferAttribute;
          const efColAttr = engineFireGeo.attributes.color as THREE.BufferAttribute;
          const nozzleY = alt + 0.38;
          for (let i = 0; i < fireParticleCount; i++) {
            const phase = (localT * 2.5 + engineFireSeeds[i * 3]) % 1;
            const angle = engineFireSeeds[i * 3 + 1] + localT * 3.2;
            const spread = engineFireSeeds[i * 3 + 2];

            const dropDist = phase * 5.8;
            let py = nozzleY - dropDist;
            let radial = (0.14 + phase * 0.95) * spread;
            let heat = 1 - phase;
            if (py < 0.14) {
              const impactDepth = Math.min(3.8, 0.14 - py);
              py = 0.1 + impactDepth * 0.28 * spread;
              radial += impactDepth * (1.45 + spread * 0.95);
              heat = Math.max(0.12, heat * 0.82);
            }

            engineFirePos[i * 3] =
              glideX + Math.cos(angle) * radial + Math.sin(localT * 18 + i) * 0.05;
            engineFirePos[i * 3 + 1] = py;
            engineFirePos[i * 3 + 2] =
              glideZ + Math.sin(angle) * radial + Math.cos(localT * 16 + i) * 0.05;

            engineFireColors[i * 3] = isAtmoWorld ? 0.84 + heat * 0.16 : 0.62 + heat * 0.38;
            engineFireColors[i * 3 + 1] = isAtmoWorld ? 0.18 + heat * heat * 0.78 : 0.65 + heat * 0.35;
            engineFireColors[i * 3 + 2] = isAtmoWorld
              ? heat > 0.65
                ? (heat - 0.65) * 2.0
                : 0.03
              : 0.85 + heat * 0.15;
          }
          efPosAttr.needsUpdate = true;
          efColAttr.needsUpdate = true;
        }

        const shipRefs = shipLanding.userData.spaceshipRefs;
        if (shipRefs) {
          shipRefs.beaconMat.emissiveIntensity = 0.4 + 0.35 * Math.sin(localT * 4);
          shipRefs.engineGlowMat.emissiveIntensity = 0.4 + 1.2 * fireFade;
        }

        const groundBlastStrength =
          alt < 20
            ? THREE.MathUtils.clamp((20 - alt) / 20, 0, 1) *
              (p < 1 ? 1 : Math.max(0.18, 1 - afterTouch * 0.6))
            : 0.06;
        const stormIntensity = isAtmoWorld
          ? 0.35 +
            0.62 *
              Math.sin(Math.min(1, localT / descentDuration) * Math.PI * 0.9) *
              (p < 1 ? 1 : Math.max(0.22, 1 - afterTouch * 0.45))
          : groundBlastStrength * 0.45;

        const quantizedStorm = Math.round(stormIntensity * 25) / 25;
        if (quantizedStorm !== lastReportedStorm) {
          lastReportedStorm = quantizedStorm;
          setStormOverlayLevel(quantizedStorm);
        }

        // Sky dome & fog match real physics:
        // - Mars/Titan: upper-atmosphere black airglow -> dense dusty/golden planetary sky & fog
        // - Moon/Europa: razor-sharp black starry vacuum from orbit to ground!
        const skyEntryBlend = isAtmoWorld ? THREE.MathUtils.clamp(p / 0.55, 0, 1) : 0;
        _zenithCol.setHex(0x02040a).lerp(_zenithEndCol.setHex(planetSpec.skyColor), skyEntryBlend);
        _horizonCol.setHex(0x050814).lerp(_horizonEndCol.setHex(planetSpec.fogColor), skyEntryBlend);
        _sunGlowCol.setHex(planetId === 'titan' ? 0xf59e0b : 0xfdba74);
        _sunDirVec.set(0.55, 0.38, -0.72).normalize();
        altitudeSky.setColors(_zenithCol, _horizonCol, _sunGlowCol, _sunDirVec, isAtmoWorld ? skyEntryBlend : 0);
        altitudeSky.mesh.position.set(0, 0, 0);

        _skyColor.copy(_zenithCol);
        _fogColor.copy(_horizonCol);
        scene.background = _skyColor;
        fog.color.copy(_fogColor);
        fog.density = isAtmoWorld
          ? planetSpec.fogDensity * (0.18 + skyEntryBlend * (0.82 + stormIntensity * 1.05))
          : 0.0025;
        keyLight.color.setHex(planetSpec.sunColor);
        keyLight.intensity = planetSpec.sunIntensity;
        hemiLight.color.setHex(planetSpec.hemiSkyColor);
        hemiLight.groundColor.setHex(planetSpec.hemiGroundColor);
        hemiLight.intensity = planetSpec.hemiIntensity;

        // Ground plume ejecta: atmospheric swirling dust vs vacuum radial ballistic rays
        blastMat.opacity = 0.86 * groundBlastStrength;
        const bAttr = blastGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < blastCount; i++) {
          blastAge[i] += dt * (1.25 + groundBlastStrength * 1.05);
          if (blastAge[i] > 1) blastAge[i] -= 1;
          const age = blastAge[i];
          const swirl = isAtmoWorld ? age * 1.25 : 0; // no swirl in vacuum!
          const vx = blastVel[i * 3];
          const vy = blastVel[i * 3 + 1];
          const vz = blastVel[i * 3 + 2];
          const cosS = Math.cos(swirl);
          const sinS = Math.sin(swirl);
          const radialMult = isAtmoWorld ? 1.7 : 2.35;
          blastPos[i * 3] = glideX + (vx * cosS - vz * sinS) * age * radialMult;
          blastPos[i * 3 + 1] = 0.16 + vy * Math.sin(age * Math.PI) * (isAtmoWorld ? 2.1 : 1.05);
          blastPos[i * 3 + 2] = glideZ + (vx * sinS + vz * cosS) * age * radialMult;
        }
        bAttr.needsUpdate = true;

        // Atmospheric wind streaks ONLY on Mars & Titan (zero wind in vacuum!)
        windMat.opacity = isAtmoWorld ? 0.62 * stormIntensity : 0;
        if (isAtmoWorld) {
          const wAttr = windGeo.attributes.position as THREE.BufferAttribute;
          const windSpeed = 16 + stormIntensity * 18;
          for (let i = 0; i < windCount; i++) {
            let wx = windPos[i * 3] + windSpeed * dt;
            let wy = windPos[i * 3 + 1] + Math.sin(localT * 3 + i) * 0.9 * dt;
            let wz = windPos[i * 3 + 2] + windSpeed * 0.42 * dt;
            if (wx > 22) wx -= 44;
            if (wz > 20) wz -= 40;
            if (wy < 0.2 || wy > 14) wy = 0.4 + ((i * 17) % 12);
            windPos[i * 3] = wx;
            windPos[i * 3 + 1] = wy;
            windPos[i * 3 + 2] = wz;
          }
          wAttr.needsUpdate = true;
        }

        const ringCycle1 = (localT * 1.15) % 1;
        const ringCycle2 = (localT * 1.15 + 0.5) % 1;
        dustRing1.scale.setScalar(0.85 + ringCycle1 * 4.8);
        dustRingMat1.opacity = (1 - ringCycle1) * 0.5 * groundBlastStrength;
        dustRing2.scale.setScalar(0.75 + ringCycle2 * 4.0);
        dustRingMat2.opacity = (1 - ringCycle2) * 0.35 * groundBlastStrength;

        lzRing.visible = p < 1;

        const shake =
          plasmaEnvelope * 0.09 +
          (p < 1 ? 0.08 * groundBlastStrength : 0.025 * Math.max(0, 1 - afterTouch));
        const shakeX = Math.sin(localT * 47) * shake;
        const shakeY = Math.cos(localT * 53) * shake;

        // Cinematic entry-to-touchdown camera:
        // Begins alongside the plunging ship in the upper sky -> pulls down & wide to frame the dramatic flip & touchdown!
        const camP = THREE.MathUtils.clamp(localT / LANDING_DURATION, 0, 1);
        const camEase = camP * camP * (3 - 2 * camP);
        if (p < 0.45) {
          const ep = p / 0.45;
          const eEase = ep * ep * (3 - 2 * ep);
          _camPos.set(
            glideX + THREE.MathUtils.lerp(8.5, 13.5, eEase) + shakeX,
            alt + THREE.MathUtils.lerp(3.2, -1.5, eEase) + shakeY,
            glideZ + THREE.MathUtils.lerp(10.5, 16.0, eEase)
          );
          _camLook.set(glideX + 2.5, Math.max(2.0, alt - 1.2), glideZ + 2.0);
        } else {
          const lp = THREE.MathUtils.clamp((camEase - 0.36) / 0.64, 0, 1);
          _camPos.set(
            THREE.MathUtils.lerp(glideX + 13.5, 8.2, lp) + shakeX,
            THREE.MathUtils.lerp(Math.max(8, alt - 1.5), 3.2, lp) + shakeY,
            THREE.MathUtils.lerp(glideZ + 16.0, 9.8, lp)
          );
          _camLook.set(
            glideX * 0.65,
            Math.max(1.85, alt * 0.72 + 1.4),
            glideZ * 0.65
          );
        }
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        targetThrustAudio = 0.068 * fireFade + 0.025 * plasmaEnvelope + 0.0001;
        targetWindAudio = isAtmoWorld ? 0.048 * stormIntensity + 0.0001 : 0.0001;
      } else {
        // ACT 4 (8.2s): SLIDING DOORS OPEN -> HINGED RAMP UNFOLDS -> FULL-SCALE CREW DISEMBARKS -> FLAG PLANTED
        const localT = seqTime - (BOARDING_DURATION + TRANSIT_DURATION + LANDING_DURATION);

        if (lastReportedStorm !== 0) {
          lastReportedStorm = 0;
          setStormOverlayLevel(0);
        }
        shipLanding.position.set(0, 0, 0);
        shipLanding.rotation.set(0, LANDED_SHIP_YAW, 0);
        landingFlame.group.visible = false;
        entryPlasmaShield.update(localT, 0);
        entryCloudLayer.visible = false;
        ablationMat.opacity = 0;
        engineFireParticles.visible = false;
        engineFireMat.opacity = 0;
        blastMat.opacity = 0;
        dustRingMat1.opacity = 0;
        dustRingMat2.opacity = 0;
        lzRing.visible = false;

        _zenithCol.setHex(planetSpec.skyColor);
        _horizonCol.setHex(planetSpec.fogColor);
        _sunGlowCol.setHex(planetId === 'titan' ? 0xf59e0b : 0xfdba74);
        _sunDirVec.set(0.55, 0.38, -0.72).normalize();
        altitudeSky.setColors(_zenithCol, _horizonCol, _sunGlowCol, _sunDirVec, isAtmoWorld ? 1 : 0);
        altitudeSky.mesh.position.set(0, 0, 0);

        _skyColor.setHex(planetSpec.skyColor);
        _fogColor.setHex(planetSpec.fogColor);
        scene.background = _skyColor;
        fog.color.copy(_fogColor);
        fog.density = planetSpec.fogDensity;
        keyLight.color.setHex(planetSpec.sunColor);
        keyLight.intensity = planetSpec.sunIntensity;
        hemiLight.color.setHex(planetSpec.hemiSkyColor);
        hemiLight.groundColor.setHex(planetSpec.hemiGroundColor);
        hemiLight.intensity = planetSpec.hemiIntensity;

        const doorOpen = THREE.MathUtils.clamp(localT / 0.8, 0, 1);
        const rampDeploy = THREE.MathUtils.clamp((localT - 0.2) / 1.0, 0, 1);
        setShipAirlockAndRamp(shipLanding, doorOpen, rampDeploy);

        windMat.opacity = isAtmoWorld ? 0.22 : 0;
        if (isAtmoWorld) {
          const wAttr = windGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < windCount; i++) {
            let wx = windPos[i * 3] + 7.5 * dt;
            let wz = windPos[i * 3 + 2] + 2.8 * dt;
            if (wx > 22) wx -= 44;
            if (wz > 20) wz -= 40;
            windPos[i * 3] = wx;
            windPos[i * 3 + 2] = wz;
          }
          wAttr.needsUpdate = true;
        }

        const shipYaw = LANDED_SHIP_YAW;
        const sinY = Math.sin(shipYaw);
        const cosY = Math.cos(shipYaw);
        const shipToWorldX = (lx: number, lz: number) => lx * cosY + lz * sinY;
        const shipToWorldZ = (lx: number, lz: number) => -lx * sinY + lz * cosY;

        const rampTopX = shipToWorldX(0, 1.38);
        const rampTopZ = shipToWorldZ(0, 1.38);
        const rampBotX = shipToWorldX(0, 4.4);
        const rampBotZ = shipToWorldZ(0, 4.4);

        const activePreset = selectedFlagRef.current;
        flagTargetRing.position.set(
          activePreset.localX,
          groundHeightAt(planetId, activePreset.localX, activePreset.localZ) + 0.05,
          activePreset.localZ
        );
        flagImpactRing.position.set(
          activePreset.localX,
          groundHeightAt(planetId, activePreset.localX, activePreset.localZ) + 0.06,
          activePreset.localZ
        );

        const flagPlantTime = 4.9;
        const isFlagLocked = localT >= flagPlantTime;
        flagTargetRing.visible = !isFlagLocked;

        disembarkCrew.forEach((member, idx) => {
          const delay = idx === 0 ? 0.75 : 1.25 + idx * 0.44;
          const rampDur = 1.25;
          const groundDur = idx === 0 ? 1.4 : 1.15;

          const tSinceStart = localT - delay;
          if (tSinceStart < 0) {
            member.mesh.visible = false;
            return;
          }

          member.mesh.visible = true;
          member.mesh.scale.setScalar(1);
          const refs = member.mesh.userData.animRefs;

          const destX = idx === 0 ? activePreset.localX - 0.68 : member.target.x;
          const destZ = idx === 0 ? activePreset.localZ + 0.16 : member.target.z;

          if (tSinceStart < rampDur) {
            const rp = tSinceStart / rampDur;
            const wx = THREE.MathUtils.lerp(rampTopX, rampBotX, rp);
            const wz = THREE.MathUtils.lerp(rampTopZ, rampBotZ, rp);
            const wy = THREE.MathUtils.lerp(
              1.94,
              groundHeightAt(planetId, rampBotX, rampBotZ),
              rp
            );
            member.mesh.position.set(wx, wy, wz);
            member.mesh.rotation.y = shipYaw;

            if (refs) {
              const swing = Math.sin(localT * 10 + idx) * 0.52;
              refs.leftLeg.rotation.x = swing;
              refs.rightLeg.rotation.x = -swing;
              refs.leftArm.rotation.x = -swing * 0.7;
              refs.rightArm.rotation.x = idx === 0 ? -0.55 : swing * 0.7;
              refs.selectionRing.visible = false;
            }
          } else {
            const gp = THREE.MathUtils.clamp((tSinceStart - rampDur) / groundDur, 0, 1);
            const easeG = gp * gp * (3 - 2 * gp);
            const wx = THREE.MathUtils.lerp(rampBotX, destX, easeG);
            const wz = THREE.MathUtils.lerp(rampBotZ, destZ, easeG);
            const gy = groundHeightAt(planetId, wx, wz);
            member.mesh.position.set(wx, gy, wz);

            if (gp < 1) {
              member.mesh.rotation.y = Math.atan2(destX - rampBotX, destZ - rampBotZ);
              if (refs) {
                const swing = Math.sin(localT * 10 + idx) * 0.55;
                refs.leftLeg.rotation.x = swing;
                refs.rightLeg.rotation.x = -swing;
                refs.leftArm.rotation.x = -swing * 0.75;
                refs.rightArm.rotation.x = idx === 0 ? -0.65 : swing * 0.75;
              }
            } else {
              const targetYaw =
                idx === 0
                  ? Math.atan2(activePreset.localX - destX, activePreset.localZ - destZ)
                  : member.target.yaw;
              member.mesh.rotation.y = targetYaw;
              if (refs) {
                refs.leftLeg.rotation.x = 0;
                refs.rightLeg.rotation.x = 0;
                if (idx === 0) {
                  if (localT < flagPlantTime) {
                    const plantP = THREE.MathUtils.clamp(
                      (localT - (delay + rampDur + groundDur)) / 1.15,
                      0,
                      1
                    );
                    const liftAngle =
                      plantP < 0.55
                        ? THREE.MathUtils.lerp(-0.65, -2.15, plantP / 0.55)
                        : THREE.MathUtils.lerp(-2.15, -0.55, (plantP - 0.55) / 0.45);
                    refs.rightArm.rotation.x = liftAngle;
                    refs.leftArm.rotation.x = liftAngle * 0.75;
                  } else {
                    const postP = THREE.MathUtils.clamp((localT - flagPlantTime) / 0.85, 0, 1);
                    member.mesh.rotation.y = THREE.MathUtils.lerp(targetYaw, 0.15, postP);
                    refs.rightArm.rotation.x = THREE.MathUtils.lerp(-0.55, -2.05, postP);
                    refs.rightArm.rotation.z = THREE.MathUtils.lerp(0, -0.35, postP);
                    refs.leftArm.rotation.x = THREE.MathUtils.lerp(-0.4, 0.08, postP);
                  }
                } else {
                  refs.leftArm.rotation.x = Math.sin(localT * 1.8 + idx) * 0.06;
                  refs.rightArm.rotation.x = -Math.sin(localT * 1.8 + idx) * 0.06;
                }
              }
            }
          }
        });

        heldFlagPole.visible = !isFlagLocked;
        plantedFlag.visible = isFlagLocked;

        if (isFlagLocked) {
          const sincePlant = localT - flagPlantTime;
          const dropDrop = Math.max(0, 1 - sincePlant / 0.28);
          const fy = groundHeightAt(planetId, activePreset.localX, activePreset.localZ);
          plantedFlag.position.set(activePreset.localX, fy + dropDrop * 0.42, activePreset.localZ);

          if (plantedFlag.userData.plantedFlagRefs?.flagPivot) {
            plantedFlag.userData.plantedFlagRefs.flagPivot.rotation.y =
              Math.sin(localT * 3.4) * 0.18;
          }

          const ringGrow = THREE.MathUtils.clamp(sincePlant / 0.9, 0, 1);
          flagImpactRing.scale.setScalar(0.6 + ringGrow * 3.2);
          flagImpactRingMat.opacity = (1 - ringGrow) * 0.65;
        } else {
          flagImpactRingMat.opacity = 0;
        }

        const camEase = THREE.MathUtils.clamp(localT / 6.8, 0, 1);
        _camPos.set(
          THREE.MathUtils.lerp(7.6, 2.8, camEase),
          THREE.MathUtils.lerp(3.2, 2.25, camEase),
          THREE.MathUtils.lerp(10.2, 9.0, camEase)
        );
        _camLook.set(
          THREE.MathUtils.lerp(0.5, activePreset.localX * 0.55, camEase),
          THREE.MathUtils.lerp(1.6, 1.35, camEase),
          THREE.MathUtils.lerp(1.5, 3.0, camEase)
        );
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        targetWindAudio = isAtmoWorld ? 0.016 : 0.0001;
      }

      terrainBundle.updateSkyEffects(elapsed, dt);

      if (audioCtx && thrusterGain && windGain && !mutedRef.current) {
        const ct = audioCtx.currentTime;
        thrusterGain.gain.setTargetAtTime(targetThrustAudio, ct, 0.08);
        windGain.gain.setTargetAtTime(targetWindAudio, ct, 0.08);
      } else if (audioCtx && thrusterGain && windGain && mutedRef.current) {
        const ct = audioCtx.currentTime;
        thrusterGain.gain.setTargetAtTime(0.0001, ct, 0.05);
        windGain.gain.setTargetAtTime(0.0001, ct, 0.05);
      }

      renderer.render(scene, camera);

      if (seqTime >= TOTAL_DURATION + 0.5 && !completed) {
        completed = true;
        stopNasaSpeech();
        const chosen = selectedFlagRef.current;
        onCompleteRef.current({
          siteLabel: chosen.siteLabel,
          outpostX: chosen.outpostX,
          outpostZ: chosen.outpostZ,
        });
        return;
      }

      scheduleNextTick();
    };

    scheduleNextTick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();

      if (audioCtx) {
        try {
          noiseSrc?.stop();
          bassOsc?.stop();
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
        } catch {
          // Ignore audio cleanup errors
        }
      }

      terrainBundle.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const std = m as THREE.MeshStandardMaterial;
            if (std.map) std.map.dispose();
            m.dispose();
          });
        }
      });
      disposables.forEach((d) => d.dispose());
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [planetId]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#05070C] text-slate-100 select-none">
      <div ref={mountRef} className="w-full h-full" />

      {stage === 'landing' && stormOverlayLevel > 0.02 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden transition-opacity duration-200"
          style={{ opacity: Math.min(0.88, stormOverlayLevel * 0.85) }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 48%, transparent 46%, ${stormOverlayStyle.haze} 100%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `repeating-linear-gradient(108deg, transparent 0px, transparent 22px, ${stormOverlayStyle.streak} 24px, transparent 28px)`,
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          stopNasaSpeech();
          onComplete({
            siteLabel: selectedFlagPreset.siteLabel,
            outpostX: selectedFlagPreset.outpostX,
            outpostZ: selectedFlagPreset.outpostZ,
          });
        }}
        className="fixed top-4 right-5 z-30 bg-transparent border-0 shadow-none p-1 text-xs font-mono tracking-wider text-white/25 hover:text-white/90 focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60 transition-opacity cursor-pointer"
      >
        Skip
      </button>
    </div>
  );
}
