import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CheckCircle2,
  Clock,
  CloudLightning,
  Flag,
  Flame,
  Globe,
  MapPin,
  Mic,
  Rocket,
  ShieldAlert,
  SkipForward,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
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

const BOARDING_DURATION = 5.4;
const TRANSIT_DURATION = 30.0;
const LANDING_DURATION = 6.5;
const DISEMBARK_DURATION = 9.4;
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

function createEarthTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
  oceanGrad.addColorStop(0, '#bae6fd');
  oceanGrad.addColorStop(0.14, '#0369a1');
  oceanGrad.addColorStop(0.5, '#075985');
  oceanGrad.addColorStop(0.86, '#0369a1');
  oceanGrad.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 512, 256);

  const continents = [
    { x: 95, y: 95, rx: 34, ry: 44, c: '#15803d' },
    { x: 132, y: 158, rx: 24, ry: 38, c: '#166534' },
    { x: 255, y: 84, rx: 46, ry: 28, c: '#22c55e' },
    { x: 266, y: 136, rx: 32, ry: 44, c: '#a16207' },
    { x: 356, y: 92, rx: 64, ry: 34, c: '#15803d' },
    { x: 398, y: 168, rx: 28, ry: 22, c: '#b45309' },
  ];
  continents.forEach((m) => {
    ctx.fillStyle = m.c;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0.25, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
  for (let i = 0; i < 24; i++) {
    const cx = (i * 53) % 512;
    const cy = 28 + ((i * 37) % 200);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 34 + (i % 4) * 14, 7 + (i % 3) * 3, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createDestinationOrbTexture(
  planetId: PlanetId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const spec = getPlanetEnvironmentSpec(planetId);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = spec.terrainBaseHex;
  ctx.fillRect(0, 0, 512, 256);

  let seed = 109 + planetId.charCodeAt(0) * 41;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  if (planetId === 'titan') {
    for (let y = 0; y < 256; y += 10) {
      ctx.fillStyle = y % 20 === 0 ? 'rgba(251,191,36,0.22)' : 'rgba(120,53,15,0.25)';
      ctx.fillRect(0, y, 512, 8);
    }
  } else if (planetId === 'europa') {
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 32; i++) {
      ctx.beginPath();
      ctx.moveTo(rand() * 512, rand() * 256);
      ctx.lineTo(rand() * 512, rand() * 256);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    for (let i = 0; i < 65; i++) {
      const cx = rand() * 512;
      const cy = rand() * 256;
      const r = 4 + rand() * 22;
      ctx.fillStyle = spec.terrainAccentHex;
      ctx.globalAlpha = 0.3 + rand() * 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (planetId === 'mars') {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.fillRect(0, 0, 512, 16);
      ctx.fillRect(0, 240, 512, 16);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createLaunchpadDeckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(256, 256, 168, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createFlameAssembly() {
  const group = new THREE.Group();

  const coreGeo = new THREE.ConeGeometry(0.44, 3.1, 20);
  coreGeo.rotateX(Math.PI);
  coreGeo.translate(0, -1.55, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.92,
  });
  const coreCone = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreCone);

  const outerGeo = new THREE.ConeGeometry(0.78, 4.4, 22);
  outerGeo.rotateX(Math.PI);
  outerGeo.translate(0, -2.2, 0);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.58,
  });
  const outerCone = new THREE.Mesh(outerGeo, outerMat);
  group.add(outerCone);

  const light = new THREE.PointLight(0xfb923c, 5.8, 24, 1.6);
  light.position.set(0, -1.3, 0);
  group.add(light);

  return { group, coreCone, outerCone, coreMat, outerMat, light };
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
      return { haze: 'rgba(186, 230, 253, 0.26)', streak: 'rgba(224, 242, 254, 0.16)' };
    default:
      return { haze: 'rgba(148, 163, 184, 0.24)', streak: 'rgba(226, 232, 240, 0.14)' };
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

function getStageTimeOffset(stage: LaunchStageId): number {
  if (stage === 'boarding') return 0;
  if (stage === 'transit') return BOARDING_DURATION;
  if (stage === 'landing') return BOARDING_DURATION + TRANSIT_DURATION;
  return BOARDING_DURATION + TRANSIT_DURATION + LANDING_DURATION;
}

export default function MissionLaunchScene({
  planetId,
  playerName,
  startStage = 'boarding',
  isAudioMuted,
  onToggleAudio,
  onComplete,
}: MissionLaunchSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const planet = getPlanetById(planetId);
  const briefing = NASA_FLIGHT_BRIEFINGS[planetId];
  const stormOverlayStyle = getStormOverlayRgba(planetId);
  const [stage, setStage] = useState<LaunchStageId>(startStage);
  const [boardedCount, setBoardedCount] = useState(0);
  const [disembarkedCount, setDisembarkedCount] = useState(0);
  const [flagPlanted, setFlagPlanted] = useState(false);
  const [selectedFlagId, setSelectedFlagId] = useState<string>(FLAG_SITE_PRESETS[0].id);
  const [progressPct, setProgressPct] = useState(0);
  const [transitRemainingSec, setTransitRemainingSec] = useState(Math.ceil(TRANSIT_DURATION));
  const [touchdownReady, setTouchdownReady] = useState(false);
  const [stormOverlayLevel, setStormOverlayLevel] = useState(0);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [selectedVoiceLabel, setSelectedVoiceLabel] = useState('Flight Officer Elena Vance');

  const selectedFlagPreset =
    FLAG_SITE_PRESETS.find((f) => f.id === selectedFlagId) || FLAG_SITE_PRESETS[0];
  const selectedFlagRef = useRef(selectedFlagPreset);
  selectedFlagRef.current = selectedFlagPreset;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const jumpToStageRef = useRef<((target: LaunchStageId) => void) | null>(null);
  const mutedRef = useRef(isAudioMuted);
  mutedRef.current = isAudioMuted;
  const spokenStageKeyRef = useRef<string>('');

  const speakBriefing = (text: string, urgent = false) => {
    speakNasaText(text, {
      muted: mutedRef.current,
      urgent,
      rate: 0.96,
      pitch: 1.12,
      onStart: (voiceName) => {
        setSelectedVoiceLabel(voiceName);
        setIsVoiceSpeaking(true);
      },
      onEnd: () => setIsVoiceSpeaking(false),
    });
  };

  useEffect(() => {
    if (isAudioMuted) {
      stopNasaSpeech();
      setIsVoiceSpeaking(false);
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
          `Touchdown confirmed on ${planet.name}. Airlock open and ramp deployed. Crew disembarking onto the surface. Commander Abubakr, plant the expedition flag and begin storm flue inspection.`,
          false
        );
      }
    } else {
      stopNasaSpeech();
      setIsVoiceSpeaking(false);
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
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c1a);
    const fog = new THREE.FogExp2(0x060c1a, 0.012);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      48,
      (container.clientWidth || 960) / (container.clientHeight || 600),
      0.1,
      260
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.4);
    keyLight.position.set(16, 24, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.85);
    rimLight.position.set(-16, 12, -18);
    scene.add(rimLight);

    const shadowTex = createContactShadowTexture();
    const disposables: Array<{ dispose: () => void }> = [shadowTex];

    // =========================================================================
    // ACT 1: EARTH LAUNCHPAD & SMOOTH CREW BOARDING + IGNITION LIFTOFF
    // =========================================================================
    const boardingGroup = new THREE.Group();
    scene.add(boardingGroup);

    const padTex = createLaunchpadDeckTexture(maxAnisotropy);
    disposables.push(padTex);
    const padDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16.8, 0.45, 48),
      new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.72, metalness: 0.25 })
    );
    padDeck.position.y = -0.22;
    padDeck.receiveShadow = true;
    boardingGroup.add(padDeck);

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.55,
      metalness: 0.65,
    });
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 8.6), rampMat);
    walkway.position.set(0, 0.08, 6.4);
    walkway.receiveShadow = true;
    boardingGroup.add(walkway);

    const railGlowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    for (const sx of [-1.05, 1.05]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 8.2), railGlowMat);
      strip.position.set(sx, 0.22, 6.4);
      boardingGroup.add(strip);
    }

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.48,
      metalness: 0.72,
    });
    const towerMast = new THREE.Mesh(new THREE.BoxGeometry(1.1, 10.5, 1.1), towerMat);
    towerMast.position.set(-4.3, 5.25, -2.8);
    towerMast.castShadow = true;
    boardingGroup.add(towerMast);

    const umbilicalArm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 0.5), towerMat);
    umbilicalArm.position.set(-2.3, 3.6, -1.5);
    umbilicalArm.rotation.y = -0.45;
    boardingGroup.add(umbilicalArm);

    const shipBoarding = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    const liftoffFlame = createFlameAssembly();
    liftoffFlame.group.position.set(0, 0.35, 0);
    liftoffFlame.group.visible = false;
    shipBoarding.add(liftoffFlame.group);
    boardingGroup.add(shipBoarding);

    const padStarCount = 360;
    const padStarPos = new Float32Array(padStarCount * 3);
    for (let i = 0; i < padStarCount; i++) {
      const a = (i * 2.39996) % (Math.PI * 2);
      const elev = ((i * 73) % 100) / 100;
      const r = 80;
      padStarPos[i * 3] = Math.cos(a) * r * Math.cos(elev * 1.1);
      padStarPos[i * 3 + 1] = 10 + Math.sin(elev * 1.2) * 58;
      padStarPos[i * 3 + 2] = Math.sin(a) * r * Math.cos(elev * 1.1);
    }
    const padStarsGeo = new THREE.BufferGeometry();
    padStarsGeo.setAttribute('position', new THREE.BufferAttribute(padStarPos, 3));
    boardingGroup.add(
      new THREE.Points(
        padStarsGeo,
        new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.38, transparent: true, opacity: 0.8 })
      )
    );

    // Crew walks along walkway -> up the attached boarding ramp -> straight into the open cabin bay at 1.0 scale
    const boardingCrew = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(profile, shadowTex, false);
      const startZ = 4.4 + idx * 1.05;
      const laneX = idx % 2 === 0 ? -0.3 : 0.3;
      mesh.position.set(laneX, 0.16, startZ);
      mesh.rotation.y = Math.PI;
      mesh.scale.setScalar(1);
      boardingGroup.add(mesh);
      return { profile, mesh, startZ, laneX };
    });

    // =========================================================================
    // ACT 2: EARTH TO DESTINATION PLANET TRANSIT (30s, Stable Orientation)
    // =========================================================================
    const transitGroup = new THREE.Group();
    scene.add(transitGroup);

    const spaceStarCount = 680;
    const spaceStarPos = new Float32Array(spaceStarCount * 3);
    for (let i = 0; i < spaceStarCount; i++) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = Math.acos(1 - 2 * (((i * 29) % 100) / 100));
      const r = 84;
      spaceStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      spaceStarPos[i * 3 + 1] = r * Math.cos(phi);
      spaceStarPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const spaceStarsGeo = new THREE.BufferGeometry();
    spaceStarsGeo.setAttribute('position', new THREE.BufferAttribute(spaceStarPos, 3));
    transitGroup.add(
      new THREE.Points(spaceStarsGeo, new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.42, fog: false }))
    );

    const streakCount = 64;
    const streakPositions = new Float32Array(streakCount * 6);
    const streakOffsets = new Float32Array(streakCount * 3);
    for (let i = 0; i < streakCount; i++) {
      streakOffsets[i * 3] = ((i * 37) % 32) - 16;
      streakOffsets[i * 3 + 1] = ((i * 53) % 18) - 9;
      streakOffsets[i * 3 + 2] = ((i * 71) % 32) - 16;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    transitGroup.add(
      new THREE.LineSegments(
        streakGeo,
        new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45, fog: false })
      )
    );

    const earthTex = createEarthTexture(maxAnisotropy);
    disposables.push(earthTex);
    const earthSphere = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 36, 32),
      new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.65, metalness: 0.05, fog: false })
    );
    earthSphere.position.set(-14.5, -2.2, -14.0);
    transitGroup.add(earthSphere);

    const earthHalo = new THREE.Mesh(
      new THREE.SphereGeometry(6.05, 32, 28),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
        fog: false,
      })
    );
    earthHalo.position.copy(earthSphere.position);
    transitGroup.add(earthHalo);

    const destTex = createDestinationOrbTexture(planetId, maxAnisotropy);
    disposables.push(destTex);
    const destRadius = planetId === 'moon' ? 3.8 : planetId === 'europa' ? 4.2 : 4.8;
    const destSphere = new THREE.Mesh(
      new THREE.SphereGeometry(destRadius, 36, 32),
      new THREE.MeshStandardMaterial({
        map: destTex,
        roughness: planetId === 'europa' ? 0.35 : 0.8,
        metalness: 0.08,
        fog: false,
      })
    );
    destSphere.position.set(14.5, 2.0, -11.5);
    transitGroup.add(destSphere);

    if (planetId === 'titan') {
      const saturnOrb = new THREE.Mesh(
        new THREE.SphereGeometry(4.4, 28, 24),
        new THREE.MeshStandardMaterial({
          color: 0xeab308,
          emissive: 0x713f12,
          emissiveIntensity: 0.4,
          fog: false,
        })
      );
      saturnOrb.position.set(27, 9.5, -34);
      transitGroup.add(saturnOrb);
      const saturnRing = new THREE.Mesh(
        new THREE.RingGeometry(5.9, 9.5, 52),
        new THREE.MeshBasicMaterial({
          color: 0xfde68a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
          fog: false,
        })
      );
      saturnRing.position.copy(saturnOrb.position);
      saturnRing.rotation.set(Math.PI * 0.38, 0.2, 0.3);
      transitGroup.add(saturnRing);
    } else if (planetId === 'europa') {
      const jupiterOrb = new THREE.Mesh(
        new THREE.SphereGeometry(6.8, 32, 24),
        new THREE.MeshStandardMaterial({
          color: 0xfdba74,
          emissive: 0x9a3412,
          emissiveIntensity: 0.35,
          fog: false,
        })
      );
      jupiterOrb.position.set(28, 10, -36);
      transitGroup.add(jupiterOrb);
    }

    const shipTransit = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    shipTransit.scale.setScalar(0.75);
    setShipAirlockAndRamp(shipTransit, 0, 0);
    const transitFlame = createFlameAssembly();
    transitFlame.group.position.set(0, 0.35, 0);
    shipTransit.add(transitFlame.group);
    transitGroup.add(shipTransit);

    const sparkCount = 70;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    transitGroup.add(
      new THREE.Points(
        sparkGeo,
        new THREE.PointsMaterial({
          color: 0xfb923c,
          size: 0.28,
          transparent: true,
          opacity: 0.85,
          fog: false,
        })
      )
    );

    // =========================================================================
    // ACT 3 & ACT 4 SHARED SURFACE: LANDING -> AIRLOCK OPEN -> RAMP -> FLAG
    // =========================================================================
    const surfaceGroup = new THREE.Group();
    scene.add(surfaceGroup);

    const planetSpec = getPlanetEnvironmentSpec(planetId);
    const terrainBundle = createTerrainAndSkyGroup(planetId, maxAnisotropy);
    surfaceGroup.add(terrainBundle.group);

    const lzRing = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 3.8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      })
    );
    lzRing.rotation.x = -Math.PI / 2;
    lzRing.position.y = 0.04;
    surfaceGroup.add(lzRing);

    const shipLanding = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    const landingFlame = createFlameAssembly();
    landingFlame.group.position.set(0, 0.35, 0);
    shipLanding.add(landingFlame.group);
    surfaceGroup.add(shipLanding);

    const stormColor = getStormColorHex(planetId);

    const blastCount = 260;
    const blastPos = new Float32Array(blastCount * 3);
    const blastVel = new Float32Array(blastCount * 3);
    const blastAge = new Float32Array(blastCount);
    for (let i = 0; i < blastCount; i++) {
      const angle = (i / blastCount) * Math.PI * 2 + (i % 7) * 0.23;
      const spd = 4.0 + (i % 11) * 0.75;
      blastVel[i * 3] = Math.cos(angle) * spd;
      blastVel[i * 3 + 1] = 0.7 + (i % 5) * 0.55;
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
      size: 0.72,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    surfaceGroup.add(new THREE.Points(blastGeo, blastMat));

    const fireTex = createFireSpriteTexture();
    disposables.push(fireTex);
    const fireParticleCount = 220;
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
      size: 0.92,
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

    const windCount = 320;
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
      color: 0xfdba74,
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

    // Preview marker for selected flag site prior to Commander planting
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

    // Procedural audio
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
    let lastReportedBoarded = -1;
    let lastReportedDisembarked = -1;
    let lastReportedFlag = false;
    let lastReportedPct = -1;
    let lastReportedTransitRem = -1;
    let lastReportedStorm = -1;

    jumpToStageRef.current = (target: LaunchStageId) => {
      seqTime = getStageTimeOffset(target);
      completed = false;
      setTouchdownReady(false);
      setFlagPlanted(false);
      if (target !== 'landing') {
        lastReportedStorm = 0;
        setStormOverlayLevel(0);
      }
      if (target === 'transit' || target === 'disembark') {
        spokenStageKeyRef.current = '';
      }
    };

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

      seqTime = Math.min(TOTAL_DURATION + 0.85, seqTime + dt);

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

      const pct = Math.min(100, Math.round((seqTime / TOTAL_DURATION) * 100));
      if (pct !== lastReportedPct) {
        lastReportedPct = pct;
        setProgressPct(pct);
      }

      boardingGroup.visible = curStage === 'boarding';
      transitGroup.visible = curStage === 'transit';
      surfaceGroup.visible = curStage === 'landing' || curStage === 'disembark';
      disembarkGroup.visible = curStage === 'disembark';

      let targetThrustAudio = 0.0001;
      let targetWindAudio = 0.0001;

      if (curStage === 'boarding') {
        const t = seqTime;
        const tNorm = Math.min(1, t / BOARDING_DURATION);

        _skyColor.setHex(0x060d1c);
        scene.background = _skyColor;
        fog.color.copy(_skyColor);
        fog.density = 0.012;
        keyLight.color.setHex(0xfff1d6);
        keyLight.intensity = 2.35;
        hemiLight.color.setHex(0x93c5fd);
        hemiLight.groundColor.setHex(0x1e293b);
        hemiLight.intensity = 0.9;

        // Open airlock & ramp during boarding (t=0..3.6), close & stow cleanly (3.6..4.4), then ignition liftoff (4.4..5.4)!
        const doorOpen = t < 3.6 ? Math.min(1, t / 0.5) : Math.max(0, 1 - (t - 3.6) / 0.6);
        const rampOpen = t < 3.8 ? 1 : Math.max(0, 1 - (t - 3.8) / 0.55);
        setShipAirlockAndRamp(shipBoarding, doorOpen, rampOpen);

        const liftoffP = THREE.MathUtils.clamp((t - 4.35) / (BOARDING_DURATION - 4.35), 0, 1);
        const shipAlt = Math.pow(liftoffP, 2.1) * 7.5;
        shipBoarding.position.set(0, shipAlt, 0);
        shipBoarding.rotation.set(0, 0, 0);
        liftoffFlame.group.visible = liftoffP > 0.02;
        if (liftoffP > 0.02) {
          const fl = 0.9 + Math.sin(t * 40) * 0.14;
          liftoffFlame.coreCone.scale.set(1, fl * 1.2, 1);
          liftoffFlame.outerCone.scale.set(1.1, fl * 1.4, 1.1);
          liftoffFlame.light.intensity = 6.5 * fl;
          targetThrustAudio = 0.055;
        }

        let boarded = 0;
        boardingCrew.forEach((member, idx) => {
          const walkDelay = idx * 0.32;
          const walkSpan = 2.1;
          const localP = THREE.MathUtils.clamp((t - walkDelay) / walkSpan, 0, 1);

          // Walk smoothly from startZ -> bottom of ramp (4.1) -> top of ramp inside airlock alcove (1.26)
          const zPos = THREE.MathUtils.lerp(member.startZ, 1.24, localP);
          const rampBlend = THREE.MathUtils.smoothstep(4.2 - zPos, 0, 2.9);
          const yPos = 0.16 + rampBlend * 1.82;
          const xPos = THREE.MathUtils.lerp(member.laneX, 0, rampBlend);

          // Stay strictly full 1.0 scale until stepping cleanly inside doorway
          member.mesh.scale.setScalar(1);
          member.mesh.visible = localP < 0.985;
          member.mesh.position.set(xPos, yPos, zPos);

          const walkCycle = t * 9.5 + idx * 1.1;
          const swing = Math.sin(walkCycle) * 0.55;
          const refs = member.mesh.userData.animRefs;
          if (refs) {
            refs.leftLeg.rotation.x = swing;
            refs.rightLeg.rotation.x = -swing;
            refs.leftArm.rotation.x = -swing * 0.75;
            refs.rightArm.rotation.x = swing * 0.75;
            refs.selectionRing.visible = false;
          }

          if (localP >= 0.96) boarded += 1;
        });

        if (boarded !== lastReportedBoarded) {
          lastReportedBoarded = boarded;
          setBoardedCount(boarded);
        }

        const shipRefs = shipBoarding.userData.spaceshipRefs;
        if (shipRefs) {
          shipRefs.beaconMat.emissiveIntensity = 0.9 + 0.7 * Math.sin(t * 4);
        }
        if (lastReportedStorm !== 0) {
          lastReportedStorm = 0;
          setStormOverlayLevel(0);
        }

        _camPos.set(
          THREE.MathUtils.lerp(5.8, 7.6, tNorm),
          THREE.MathUtils.lerp(2.4, 4.2 + shipAlt * 0.4, tNorm),
          THREE.MathUtils.lerp(10.2, 11.4, tNorm)
        );
        _camLook.set(0, 1.5 + shipAlt * 0.85, THREE.MathUtils.lerp(3.2, 0.2, tNorm));
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);
      } else if (curStage === 'transit') {
        const localT = seqTime - BOARDING_DURATION;
        const p = THREE.MathUtils.clamp(localT / TRANSIT_DURATION, 0, 1);
        const remSec = Math.max(0, Math.ceil(TRANSIT_DURATION - localT));
        if (remSec !== lastReportedTransitRem) {
          lastReportedTransitRem = remSec;
          setTransitRemainingSec(remSec);
        }

        _skyColor.setHex(0x02040a);
        scene.background = _skyColor;
        fog.color.copy(_skyColor);
        fog.density = 0.002;
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 2.45;
        hemiLight.color.setHex(0x60a5fa);
        hemiLight.groundColor.setHex(0x0f172a);
        hemiLight.intensity = 0.72;

        earthSphere.rotation.y += dt * 0.16;
        destSphere.rotation.y += dt * 0.22;
        destSphere.scale.setScalar(0.82 + p * 0.38);

        const ease = p * p * (3 - 2 * p);
        const arcY = Math.sin(p * Math.PI) * 2.1;
        _shipPos.set(
          THREE.MathUtils.lerp(-9.0, 8.6, ease),
          THREE.MathUtils.lerp(-1.2, 1.4, ease) + arcY,
          THREE.MathUtils.lerp(-7.5, -5.8, ease)
        );
        const pNext = Math.min(1, p + 0.015);
        const easeNext = pNext * pNext * (3 - 2 * pNext);
        _shipNext.set(
          THREE.MathUtils.lerp(-9.0, 8.6, easeNext),
          THREE.MathUtils.lerp(-1.2, 1.4, easeNext) + Math.sin(pNext * Math.PI) * 2.1,
          THREE.MathUtils.lerp(-7.5, -5.8, easeNext)
        );
        _shipDir.subVectors(_shipNext, _shipPos);
        if (_shipDir.lengthSq() > 0.00001) {
          _shipDir.normalize();
          // Orthonormal basis keeps ship nose pointing along _shipDir without random roll twist
          _fwdAxis.set(0, 0, 1);
          _sideAxis.crossVectors(_shipDir, _fwdAxis);
          if (_sideAxis.lengthSq() < 0.0001) _sideAxis.set(1, 0, 0);
          _sideAxis.normalize();
          _fwdAxis.crossVectors(_sideAxis, _shipDir).normalize();
          _basisMat.makeBasis(_sideAxis, _shipDir, _fwdAxis);
          shipTransit.quaternion.setFromRotationMatrix(_basisMat);
        }
        shipTransit.position.copy(_shipPos);

        const flicker = 0.88 + Math.sin(localT * 36) * 0.14 + Math.cos(localT * 23) * 0.1;
        transitFlame.coreCone.scale.set(1, flicker * 1.15, 1);
        transitFlame.outerCone.scale.set(1.05, flicker * 1.35, 1.05);
        transitFlame.light.intensity = 5.5 * flicker;

        const sAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < sparkCount; i++) {
          const age = (localT * 2.4 + i / sparkCount) % 1;
          const spread = (i % 7) * 0.06;
          sparkPositions[i * 3] =
            _shipPos.x - _shipDir.x * (1.2 + age * 7.5) + Math.sin(i * 1.7) * spread;
          sparkPositions[i * 3 + 1] =
            _shipPos.y - _shipDir.y * (1.2 + age * 7.5) + Math.cos(i * 2.3) * spread;
          sparkPositions[i * 3 + 2] =
            _shipPos.z - _shipDir.z * (1.2 + age * 7.5) + Math.sin(i * 3.1) * spread;
        }
        sAttr.needsUpdate = true;

        const stAttr = streakGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < streakCount; i++) {
          const ox = streakOffsets[i * 3];
          const oy = streakOffsets[i * 3 + 1];
          const oz = streakOffsets[i * 3 + 2];
          const shift = ((localT * 14 + i * 0.7) % 34) - 17;
          const bx = ox - _shipDir.x * shift;
          const by = oy - _shipDir.y * shift;
          const bz = oz - _shipDir.z * shift;
          streakPositions[i * 6] = bx;
          streakPositions[i * 6 + 1] = by;
          streakPositions[i * 6 + 2] = bz;
          streakPositions[i * 6 + 3] = bx - _shipDir.x * 1.5;
          streakPositions[i * 6 + 4] = by - _shipDir.y * 1.5;
          streakPositions[i * 6 + 5] = bz - _shipDir.z * 1.5;
        }
        stAttr.needsUpdate = true;

        _camPos.set(_shipPos.x - 1.5, _shipPos.y + 2.4, _shipPos.z + 9.2);
        _camLook.set(_shipPos.x + 1.8, _shipPos.y + 0.3, _shipPos.z - 2.0);
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        targetThrustAudio = 0.036;
        if (lastReportedStorm !== 0) {
          lastReportedStorm = 0;
          setStormOverlayLevel(0);
        }
      } else if (curStage === 'landing') {
        const localT = seqTime - (BOARDING_DURATION + TRANSIT_DURATION);
        const descentDuration = 4.6;
        const p = THREE.MathUtils.clamp(localT / descentDuration, 0, 1);

        const inv = 1 - p;
        const afterTouch = Math.max(0, localT - descentDuration);
        // Gravity-scaled landing suspension settle
        const gravScale = planet.gravityMs2 / 3.71;
        const settleBounce =
          p >= 1
            ? Math.max(
                0,
                Math.exp(-afterTouch * (3.8 + gravScale * 1.5)) *
                  Math.sin(afterTouch * (12 + gravScale * 4)) *
                  0.09
              )
            : 0;
        const alt = 28 * Math.pow(inv, 2.2) + settleBounce;
        const lateralDrift = Math.sin(p * Math.PI) * 1.05 * inv;
        const tilt = inv * 0.11;

        shipLanding.position.set(lateralDrift, alt, 0);
        // Keep ship rotation order YXZ locked to LANDED_SHIP_YAW so zero 90-degree snap occurs!
        shipLanding.rotation.set(tilt * 0.35, LANDED_SHIP_YAW, -tilt * 0.35);
        setShipAirlockAndRamp(shipLanding, 0, 0);

        const fireFade = p < 1 ? 1 : Math.max(0, 1 - afterTouch / 0.95);
        const flicker = 0.85 + Math.sin(localT * 42) * 0.16 + Math.cos(localT * 29) * 0.1;
        landingFlame.group.visible = fireFade > 0.02;
        landingFlame.coreCone.scale.set(
          0.95 * fireFade + 0.1,
          1.25 * flicker * fireFade,
          0.95 * fireFade + 0.1
        );
        landingFlame.outerCone.scale.set(
          1.15 * fireFade + 0.1,
          1.45 * flicker * fireFade,
          1.15 * fireFade + 0.1
        );
        landingFlame.coreMat.opacity = 0.92 * fireFade;
        landingFlame.outerMat.opacity = 0.62 * fireFade;
        landingFlame.light.intensity = 8.2 * flicker * fireFade;

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

            const dropDist = phase * 5.2;
            let py = nozzleY - dropDist;
            let radial = (0.14 + phase * 0.88) * spread;
            let heat = 1 - phase;
            if (py < 0.14) {
              const impactDepth = Math.min(3.5, 0.14 - py);
              py = 0.1 + impactDepth * 0.26 * spread;
              radial += impactDepth * (1.25 + spread * 0.85);
              heat = Math.max(0.12, heat * 0.82);
            }

            engineFirePos[i * 3] =
              lateralDrift + Math.cos(angle) * radial + Math.sin(localT * 18 + i) * 0.05;
            engineFirePos[i * 3 + 1] = py;
            engineFirePos[i * 3 + 2] =
              Math.sin(angle) * radial + Math.cos(localT * 16 + i) * 0.05;

            engineFireColors[i * 3] = 0.82 + heat * 0.18;
            engineFireColors[i * 3 + 1] = 0.16 + heat * heat * 0.78;
            engineFireColors[i * 3 + 2] = heat > 0.65 ? (heat - 0.65) * 2.0 : 0.03;
          }
          efPosAttr.needsUpdate = true;
          efColAttr.needsUpdate = true;
        }

        const shipRefs = shipLanding.userData.spaceshipRefs;
        if (shipRefs) {
          shipRefs.beaconMat.emissiveIntensity = 0.8 + 0.7 * Math.sin(localT * 4);
          shipRefs.engineGlowMat.emissiveIntensity = 0.6 + 1.9 * fireFade;
        }

        const groundBlastStrength =
          alt < 14
            ? THREE.MathUtils.clamp((14 - alt) / 14, 0, 1) *
              (p < 1 ? 1 : Math.max(0.22, 1 - afterTouch * 0.45))
            : 0.16;
        const stormIntensity =
          0.42 +
          0.58 *
            Math.sin(Math.min(1, localT / 4.4) * Math.PI * 0.85) *
            (p < 1 ? 1 : Math.max(0.25, 1 - afterTouch * 0.42));

        const quantizedStorm = Math.round(stormIntensity * 25) / 25;
        if (quantizedStorm !== lastReportedStorm) {
          lastReportedStorm = quantizedStorm;
          setStormOverlayLevel(quantizedStorm);
        }

        _skyColor.setHex(planetSpec.skyColor);
        _fogColor.setHex(planetSpec.fogColor);
        scene.background = _skyColor;
        fog.color.copy(_fogColor);
        fog.density = planetSpec.fogDensity * (1.0 + stormIntensity * 1.15);
        keyLight.color.setHex(planetSpec.sunColor);
        keyLight.intensity = planetSpec.sunIntensity;
        hemiLight.color.setHex(planetSpec.hemiSkyColor);
        hemiLight.groundColor.setHex(planetSpec.hemiGroundColor);
        hemiLight.intensity = planetSpec.hemiIntensity;

        blastMat.opacity = 0.78 * groundBlastStrength;
        const bAttr = blastGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < blastCount; i++) {
          blastAge[i] += dt * (1.15 + groundBlastStrength * 0.85);
          if (blastAge[i] > 1) blastAge[i] -= 1;
          const age = blastAge[i];
          const swirl = age * 1.1;
          const vx = blastVel[i * 3];
          const vy = blastVel[i * 3 + 1];
          const vz = blastVel[i * 3 + 2];
          const cosS = Math.cos(swirl);
          const sinS = Math.sin(swirl);
          blastPos[i * 3] = lateralDrift + (vx * cosS - vz * sinS) * age * 1.55;
          blastPos[i * 3 + 1] = 0.18 + vy * Math.sin(age * Math.PI) * 1.85;
          blastPos[i * 3 + 2] = (vx * sinS + vz * cosS) * age * 1.55;
        }
        bAttr.needsUpdate = true;

        windMat.opacity = 0.65 * stormIntensity;
        const wAttr = windGeo.attributes.position as THREE.BufferAttribute;
        const windSpeed = 14 + stormIntensity * 16;
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

        const ringCycle1 = (localT * 1.15) % 1;
        const ringCycle2 = (localT * 1.15 + 0.5) % 1;
        dustRing1.scale.setScalar(0.8 + ringCycle1 * 4.2);
        dustRingMat1.opacity = (1 - ringCycle1) * 0.45 * groundBlastStrength;
        dustRing2.scale.setScalar(0.7 + ringCycle2 * 3.5);
        dustRingMat2.opacity = (1 - ringCycle2) * 0.32 * groundBlastStrength;

        lzRing.visible = p < 1;

        const shake = p < 1 ? 0.075 * groundBlastStrength : 0.02 * Math.max(0, 1 - afterTouch);
        const shakeX = Math.sin(localT * 47) * shake;
        const shakeY = Math.cos(localT * 53) * shake;

        const trackT = THREE.MathUtils.clamp(localT / 4.8, 0, 1);
        _camPos.set(
          THREE.MathUtils.lerp(11.8, 8.2, trackT) + shakeX,
          THREE.MathUtils.lerp(6.8, 3.6, trackT) + shakeY,
          THREE.MathUtils.lerp(13.5, 9.6, trackT)
        );
        _camLook.set(lateralDrift * 0.5, Math.max(2.1, alt * 0.55 + 1.8), 0);
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        targetThrustAudio = 0.065 * fireFade + 0.0001;
        targetWindAudio = 0.048 * stormIntensity + 0.0001;

        if (p >= 1 && afterTouch > 0.35 && !completed) {
          setTouchdownReady(true);
        }
      } else {
        // ACT 4: SLIDING DOORS OPEN -> HINGED RAMP UNFOLDS -> FULL-SCALE CREW DISEMBARKS -> FLAG PLANTED
        const localT = seqTime - (BOARDING_DURATION + TRANSIT_DURATION + LANDING_DURATION);

        if (lastReportedStorm !== 0) {
          lastReportedStorm = 0;
          setStormOverlayLevel(0);
        }
        shipLanding.position.set(0, 0, 0);
        shipLanding.rotation.set(0, LANDED_SHIP_YAW, 0);
        landingFlame.group.visible = false;
        engineFireParticles.visible = false;
        engineFireMat.opacity = 0;
        blastMat.opacity = 0;
        dustRingMat1.opacity = 0;
        dustRingMat2.opacity = 0;
        lzRing.visible = false;

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

        const doorOpen = THREE.MathUtils.clamp(localT / 0.65, 0, 1);
        const rampDeploy = THREE.MathUtils.clamp((localT - 0.15) / 0.85, 0, 1);
        setShipAirlockAndRamp(shipLanding, doorOpen, rampDeploy);

        windMat.opacity = 0.22;
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

        let exited = 0;
        const flagPlantTime = 5.6;
        const isFlagLocked = localT >= flagPlantTime;
        flagTargetRing.visible = !isFlagLocked;

        disembarkCrew.forEach((member, idx) => {
          const delay = idx === 0 ? 0.75 : 1.3 + idx * 0.52;
          const rampDur = 1.65;
          const groundDur = idx === 0 ? 1.85 : 1.5;

          const tSinceStart = localT - delay;
          if (tSinceStart < 0) {
            member.mesh.visible = false;
            return;
          }

          member.mesh.visible = true;
          // NEVER shrink or pop astronaut scale!
          member.mesh.scale.setScalar(1);
          const refs = member.mesh.userData.animRefs;

          // Commander Abubakr walks directly near selected flag site
          const destX = idx === 0 ? activePreset.localX - 0.68 : member.target.x;
          const destZ = idx === 0 ? activePreset.localZ + 0.16 : member.target.z;

          if (tSinceStart < rampDur) {
            const rp = tSinceStart / rampDur;
            const wx = THREE.MathUtils.lerp(rampTopX, rampBotX, rp);
            const wz = THREE.MathUtils.lerp(rampTopZ, rampBotZ, rp);
            const wy = THREE.MathUtils.lerp(1.94, groundHeightAt(planetId, rampBotX, rampBotZ), rp);
            member.mesh.position.set(wx, wy, wz);
            member.mesh.rotation.y = shipYaw;

            if (refs) {
              const swing = Math.sin(localT * 9.5 + idx) * 0.52;
              refs.leftLeg.rotation.x = swing;
              refs.rightLeg.rotation.x = -swing;
              refs.leftArm.rotation.x = -swing * 0.7;
              refs.rightArm.rotation.x = idx === 0 ? -0.55 : swing * 0.7;
              refs.selectionRing.visible = false;
            }
          } else {
            exited += 1;
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
                      (localT - (delay + rampDur + groundDur)) / 1.35,
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
                    const postP = THREE.MathUtils.clamp((localT - flagPlantTime) / 0.8, 0, 1);
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

        if (exited !== lastReportedDisembarked) {
          lastReportedDisembarked = exited;
          setDisembarkedCount(exited);
        }
        if (isFlagLocked !== lastReportedFlag) {
          lastReportedFlag = isFlagLocked;
          setFlagPlanted(isFlagLocked);
        }

        const camEase = THREE.MathUtils.clamp(localT / 6.5, 0, 1);
        _camPos.set(
          THREE.MathUtils.lerp(6.8, 3.2, camEase),
          THREE.MathUtils.lerp(3.2, 2.35, camEase),
          THREE.MathUtils.lerp(9.8, 9.2, camEase)
        );
        _camLook.set(
          THREE.MathUtils.lerp(0.6, activePreset.localX * 0.5, camEase),
          THREE.MathUtils.lerp(1.6, 1.35, camEase),
          THREE.MathUtils.lerp(1.5, 3.0, camEase)
        );
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        targetWindAudio = 0.016;
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

      if (seqTime >= TOTAL_DURATION + 0.65 && !completed) {
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

  const stageLabel =
    stage === 'boarding'
      ? 'Phase 01 · Crew Boarding & Liftoff'
      : stage === 'transit'
      ? `Phase 02 · Earth → ${planet.name} Interplanetary Burn`
      : stage === 'landing'
      ? touchdownReady
        ? `Touchdown Confirmed · ${planet.name} Dust Clearing`
        : `Phase 03 · Retro-Fire Descent & ${planet.name} Landing`
      : flagPlanted
      ? `Phase 04 · Pakistan Flag Planted at ${selectedFlagPreset.siteLabel}`
      : `Phase 04 · Crew Disembarking Down Ramp`;

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

      <header className="absolute top-0 inset-x-0 z-20 bg-[#0F1623]/92 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <Rocket className="w-3.5 h-3.5" />
            <span>
              {planet.operationName} · Commander {playerName || 'Cadet'}
            </span>
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-white">{stageLabel}</h1>
        </div>

        <div className="flex items-center gap-2">
          {onToggleAudio && (
            <button
              type="button"
              onClick={onToggleAudio}
              className="px-3 py-2 rounded-lg bg-[#07090E] border border-slate-700 hover:border-sky-500/60 text-slate-200 font-mono text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              {isAudioMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-400" />
              )}
              <span>{isAudioMuted ? 'Muted' : 'Voice On'}</span>
            </button>
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
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <SkipForward className="w-4 h-4" />
            Enter Outpost
          </button>
        </div>
      </header>

      {/* Flag Site Selector Panel during Transit/Landing/Disembark */}
      <div className="absolute top-20 right-4 z-20 w-[min(270px,90vw)] rounded-xl bg-[#0F1623]/94 border border-emerald-500/40 p-3 shadow-xl">
        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2">
          <MapPin className="w-3.5 h-3.5" />
          Flag Planting Location
        </div>
        <div className="space-y-1.5">
          {FLAG_SITE_PRESETS.map((preset) => {
            const active = selectedFlagId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={flagPlanted}
                onClick={() => setSelectedFlagId(preset.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-400 text-white font-semibold'
                    : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                } ${flagPlanted ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {preset.siteLabel}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] font-mono text-slate-400 mt-2">
          {flagPlanted
            ? 'Flag permanently anchored on outpost terrain.'
            : 'Selected site remains permanently visible after landing.'}
        </div>
      </div>

      {stage === 'transit' && (
        <aside className="absolute top-20 left-4 z-20 w-[min(390px,92vw)] rounded-xl bg-[#0F1623]/94 border border-sky-500/40 p-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-sky-400">
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{briefing.officerName}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                {isAudioMuted
                  ? 'Audio Muted · Reading Transcript'
                  : isVoiceSpeaking
                  ? `Speaking · ${selectedVoiceLabel}`
                  : `Briefing Active · ${selectedVoiceLabel}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isAudioMuted && onToggleAudio) onToggleAudio();
                else speakBriefing(briefing.spokenScript, false);
              }}
              className="px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sky-200 font-mono text-[11px] flex items-center gap-1 shrink-0 transition-colors"
            >
              <Volume2 className="w-3 h-3" />
              {isAudioMuted ? 'Unmute' : 'Replay'}
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs">
            <div className="flex items-start gap-2 rounded-lg bg-[#07090E]/90 border border-slate-800 px-2.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Destination ETA · Landing in {transitRemainingSec}s
                </div>
                <div className="font-mono text-amber-200 font-semibold">{briefing.etaLabel}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-[#07090E]/90 border border-slate-800 px-2.5 py-1.5">
              <CloudLightning className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-slate-400">Weather Telemetry</div>
                <div className="text-slate-200 leading-snug">{briefing.weatherLabel}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-[#07090E]/90 border border-emerald-500/30 px-2.5 py-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-emerald-400">
                  Safety Precautions
                </div>
                <div className="text-slate-200 leading-snug">{briefing.precautionsLabel}</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,95vw)] rounded-xl bg-[#0F1623]/94 border border-slate-800 px-4 py-3 flex flex-col gap-2.5">
        <div className="w-full h-1.5 rounded-full bg-[#07090E] border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-emerald-400 transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'boarding' as const, label: '01 Boarding', Icon: Users },
                { id: 'transit' as const, label: `02 → ${planet.name}`, Icon: Globe },
                { id: 'landing' as const, label: '03 Fire & Storm', Icon: Flame },
                { id: 'disembark' as const, label: '04 Exit & Flag', Icon: Flag },
              ]
            ).map(({ id, label, Icon }) => {
              const active = stage === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => jumpToStageRef.current?.(id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 text-white font-semibold'
                      : 'bg-[#07090E] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-sky-400" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {stage === 'boarding' && (
              <span className="text-sky-400">
                Boarded: {boardedCount}/{ASTRONAUTS.length} Astronauts
              </span>
            )}
            {stage === 'transit' && (
              <span className="text-amber-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                {briefing.etaLabel} · {transitRemainingSec}s
              </span>
            )}
            {stage === 'landing' && (
              <span className="text-emerald-300 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-amber-400" />
                {touchdownReady ? 'Touchdown Confirmed' : `Storm Descent · ${planet.name}`}
              </span>
            )}
            {stage === 'disembark' && (
              <span className="text-emerald-300 flex items-center gap-1.5">
                {flagPlanted ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Flag Anchored · {disembarkedCount}/{ASTRONAUTS.length} Out
                  </>
                ) : (
                  <>
                    <Flag className="w-3.5 h-3.5 text-amber-400" />
                    Crew Exiting Ramp ({disembarkedCount}/{ASTRONAUTS.length})
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
