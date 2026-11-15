import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  CloudLightning,
  Eye,
  Fan,
  Shield,
  SkipForward,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { ASTRONAUTS } from '../data/astronauts';
import { getPlanetById } from '../data/planets';
import type { MissionState, PlanetId } from '../types';
import { speakNasaText, stopNasaSpeech } from '../utils/nasaVoice';
import { LANDED_SHIP_YAW } from './MissionLaunchScene';
import {
  createAstronautMesh,
  createBuildingMesh,
  createContactShadowTexture,
  createNasaSpaceshipMesh,
  createPlantedFlagMesh,
  createSolarGridTexture,
  createStormFlueMesh,
  setShelterDoorsOpen,
  setShipAirlockAndRamp,
} from './models';
import { getBuildingWorldPos, SPACESHIP_POS, STORM_FLUE_POS } from './OutpostScene3D';
import {
  createTerrainAndSkyGroup,
  getPlanetEnvironmentSpec,
  groundHeightAt,
} from './terrain';

interface StormArrivalSceneProps {
  state: MissionState;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onComplete: () => void;
  onResolveEmergency?: () => void;
}

const STORM_SCENE_DURATION = 9.5;

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _stormSkyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _stormFogColor = new THREE.Color();

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

interface StormVisualTheme {
  title: string;
  subtitle: string;
  cloudHex: number;
  cloudDarkHex: number;
  debrisHex: number;
  lightningHex: number;
  stormSkyHex: number;
  hazeRgba: string;
  streakRgba: string;
  peakWindKmh: number;
}

function getStormTheme(planetId: PlanetId): StormVisualTheme {
  switch (planetId) {
    case 'mars':
      return {
        title: 'Regional Iron-Oxide Dust Storm',
        subtitle: 'High-velocity ochre dust wall sweeping across Jezero Crater',
        cloudHex: 0xc2592c,
        cloudDarkHex: 0x5c230e,
        debrisHex: 0xfb923c,
        lightningHex: 0xfde047,
        stormSkyHex: 0x3b180d,
        hazeRgba: 'rgba(217, 107, 56, 0.36)',
        streakRgba: 'rgba(253, 186, 116, 0.22)',
        peakWindKmh: 148,
      };
    case 'titan':
      return {
        title: 'Cryogenic Methane Wind Squall',
        subtitle: 'Dense amber hydrocarbon gusts & freezing aerosol surge',
        cloudHex: 0xca8a04,
        cloudDarkHex: 0x422006,
        debrisHex: 0xfacc15,
        lightningHex: 0xfef08a,
        stormSkyHex: 0x2c1b06,
        hazeRgba: 'rgba(234, 179, 8, 0.34)',
        streakRgba: 'rgba(254, 240, 138, 0.20)',
        peakWindKmh: 132,
      };
    case 'europa':
      return {
        title: 'Cryo-Plume Ice & Radiation Surge',
        subtitle: 'Subsurface water-vapor gale & Jovian radiation front',
        cloudHex: 0x93c5fd,
        cloudDarkHex: 0x0f2744,
        debrisHex: 0xe0f2fe,
        lightningHex: 0x38bdf8,
        stormSkyHex: 0x0b1c33,
        hazeRgba: 'rgba(125, 211, 252, 0.30)',
        streakRgba: 'rgba(224, 242, 254, 0.22)',
        peakWindKmh: 164,
      };
    default:
      return {
        title: 'Solar-Wind & Micrometeoroid Alert',
        subtitle: 'Charged electrostatic lunar dust cloud & solar particle surge',
        cloudHex: 0x94a3b8,
        cloudDarkHex: 0x1e293b,
        debrisHex: 0xe2e8f0,
        lightningHex: 0x7dd3fc,
        stormSkyHex: 0x0a101d,
        hazeRgba: 'rgba(148, 163, 184, 0.30)',
        streakRgba: 'rgba(226, 232, 240, 0.18)',
        peakWindKmh: 120,
      };
  }
}

function createCloudPuffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.45, 'rgba(241, 245, 249, 0.52)');
  grad.addColorStop(0.8, 'rgba(203, 213, 225, 0.16)');
  grad.addColorStop(1, 'rgba(148, 163, 184, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function StormArrivalScene({
  state,
  isAudioMuted,
  onToggleAudio,
  onComplete,
  onResolveEmergency,
}: StormArrivalSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const planet = getPlanetById(state.planetId);
  const theme = getStormTheme(state.planetId);

  const [progressPct, setProgressPct] = useState(0);
  const [stormIntensityUi, setStormIntensityUi] = useState(0.08);
  const [phaseText, setPhaseText] = useState('Horizon Telemetry: Hazard Front Detected');
  const [flashStrength, setFlashStrength] = useState(0);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const mutedRef = useRef(isAudioMuted);
  mutedRef.current = isAudioMuted;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (isAudioMuted) {
      stopNasaSpeech();
      return;
    }

    const activeTitle = stateRef.current.activeEvent?.title || theme.title;
    const spoken = `Attention crew on ${planet.name}! ${activeTitle} inbound. Sounding shelter refuge siren: halt EVA operations, move into nearest pressurized habitat or Starship airlock through the open doors, and assess structural damage after the front clears.`;
    speakNasaText(spoken, {
      muted: isAudioMuted,
      urgent: true,
      rate: 1.0,
      pitch: 1.14,
    });

    return () => {
      stopNasaSpeech();
    };
  }, [isAudioMuted, planet.name, theme.title]);

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
      onCompleteRef.current();
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 960, container.clientHeight || 600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();
    const spec = getPlanetEnvironmentSpec(stateRef.current.planetId);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(spec.skyColor);
    const fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      50,
      (container.clientWidth || 960) / (container.clientHeight || 600),
      0.15,
      240
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const hemiLight = new THREE.HemisphereLight(
      spec.hemiSkyColor,
      spec.hemiGroundColor,
      spec.hemiIntensity
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(spec.sunColor, spec.sunIntensity);
    sunLight.position.set(18, 24, 16);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 22;
    sunLight.shadow.camera.bottom = -22;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(theme.lightningHex, 0.85);
    rimLight.position.set(-14, 12, -24);
    scene.add(rimLight);

    const stormFlashLight = new THREE.PointLight(theme.lightningHex, 0, 75, 1.4);
    stormFlashLight.position.set(0, 9, -20);
    scene.add(stormFlashLight);

    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(maxAnisotropy);
    const cloudTex = createCloudPuffTexture();
    const disposables: Array<{ dispose: () => void }> = [shadowTex, solarTex, cloudTex];

    // 1. Terrain & Deep-Space Sky
    const terrainBundle = createTerrainAndSkyGroup(stateRef.current.planetId, maxAnisotropy);
    scene.add(terrainBundle.group);

    // 2. Outpost Buildings (including shelter door refs & damage visuals)
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);
    const refugeBuildings: Array<{ mesh: THREE.Group; insideX: number; insideZ: number; doorX: number; doorZ: number }> = [];
    stateRef.current.buildings.forEach((b) => {
      const pos = getBuildingWorldPos(b.cellIndex);
      const mesh = createBuildingMesh(b.typeId, b.level, b.online, shadowTex, solarTex, {
        damaged: b.damaged,
        dustPct: b.dustPct,
      });
      mesh.position.set(pos.x, groundHeightAt(stateRef.current.planetId, pos.x, pos.z), pos.z);
      buildingsGroup.add(mesh);
      if (b.typeId === 'radiation_shelter' || b.typeId === 'habitat') {
        refugeBuildings.push({
          mesh,
          insideX: pos.x,
          insideZ: pos.z + 1.0,
          doorX: pos.x,
          doorZ: pos.z + 2.35,
        });
      }
    });

    // 3. Storm Flue Station & Synchronized Starship
    const stormFlue = createStormFlueMesh(shadowTex);
    stormFlue.position.set(
      STORM_FLUE_POS.x,
      groundHeightAt(stateRef.current.planetId, STORM_FLUE_POS.x, STORM_FLUE_POS.z),
      STORM_FLUE_POS.z
    );
    scene.add(stormFlue);

    const spaceship = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    spaceship.position.set(
      SPACESHIP_POS.x,
      groundHeightAt(stateRef.current.planetId, SPACESHIP_POS.x, SPACESHIP_POS.z),
      SPACESHIP_POS.z
    );
    spaceship.rotation.y = LANDED_SHIP_YAW;
    setShipAirlockAndRamp(spaceship, 0, 0);
    scene.add(spaceship);

    const shipRefuge = {
      insideX: SPACESHIP_POS.x + Math.sin(LANDED_SHIP_YAW) * 1.4,
      insideZ: SPACESHIP_POS.z + Math.cos(LANDED_SHIP_YAW) * 1.4,
      doorX: SPACESHIP_POS.x + Math.sin(LANDED_SHIP_YAW) * 3.1,
      doorZ: SPACESHIP_POS.z + Math.cos(LANDED_SHIP_YAW) * 3.1,
    };

    // Permanent Expedition Flag (persists during storm!)
    const activeFlag = stateRef.current.flagsByWorld[stateRef.current.planetId];
    if (activeFlag?.planted) {
      const flagMesh = createPlantedFlagMesh(shadowTex, maxAnisotropy);
      flagMesh.position.set(
        activeFlag.x,
        groundHeightAt(stateRef.current.planetId, activeFlag.x, activeFlag.z),
        activeFlag.z
      );
      scene.add(flagMesh);
    }

    // 4. 6 Astronauts initially outside, then smoothly walking into open shelter/spaceship doors
    const crewEntries = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(profile, shadowTex, false);
      const bx = -4.2 + idx * 1.75;
      const bz = 5.4 + (idx % 2 === 0 ? 0.6 : -0.4);
      const by = groundHeightAt(stateRef.current.planetId, bx, bz);
      mesh.position.set(bx, by, bz);
      mesh.rotation.y = Math.PI;
      scene.add(mesh);

      // Assign nearest refuge (building or ship)
      let bestTarget = shipRefuge;
      let minDist = Math.hypot(bx - shipRefuge.doorX, bz - shipRefuge.doorZ);
      for (const rb of refugeBuildings) {
        const d = Math.hypot(bx - rb.doorX, bz - rb.doorZ);
        if (d < minDist) {
          minDist = d;
          bestTarget = rb;
        }
      }

      return {
        mesh,
        x: bx,
        z: bz,
        yaw: Math.PI,
        walkPhase: idx * 0.8,
        idx,
        target: bestTarget,
        sheltered: false,
      };
    });

    // 5. Advancing Storm Cloud Wall
    const stormWallGroup = new THREE.Group();
    scene.add(stormWallGroup);
    const cloudSprites: Array<{
      sprite: THREE.Sprite;
      baseX: number;
      baseY: number;
      baseZ: number;
      speed: number;
      phase: number;
    }> = [];

    for (let i = 0; i < 42; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        color: i % 3 === 0 ? theme.cloudDarkHex : theme.cloudHex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const col = (i % 14) - 6.5;
      const row = Math.floor(i / 14);
      const bx = col * 5.2 + Math.sin(i * 2.1) * 1.8;
      const by = 2.6 + row * 3.4 + ((i * 17) % 10) * 0.25;
      const bz = -row * 4.5 + Math.cos(i * 1.7) * 2.4;
      const scale = 10.5 + (i % 5) * 2.4;
      sprite.position.set(bx, by, bz);
      sprite.scale.set(scale * 1.45, scale, 1);
      stormWallGroup.add(sprite);
      cloudSprites.push({
        sprite,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 0.6 + (i % 4) * 0.22,
        phase: i * 0.85,
      });
    }

    const debrisCount = 520;
    const debrisPos = new Float32Array(debrisCount * 3);
    const debrisSpeed = new Float32Array(debrisCount);
    for (let i = 0; i < debrisCount; i++) {
      debrisPos[i * 3] = ((i * 53) % 64) - 32;
      debrisPos[i * 3 + 1] = 0.25 + ((i * 31) % 140) * 0.1;
      debrisPos[i * 3 + 2] = ((i * 71) % 72) - 48;
      debrisSpeed[i] = 14 + (i % 9) * 3.2;
    }
    const debrisGeo = new THREE.BufferGeometry();
    debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
    const debrisMat = new THREE.PointsMaterial({
      map: cloudTex,
      color: theme.debrisHex,
      size: 0.65,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const debrisPoints = new THREE.Points(debrisGeo, debrisMat);
    debrisPoints.frustumCulled = false;
    scene.add(debrisPoints);

    const gustRingMat = new THREE.MeshBasicMaterial({
      color: theme.cloudHex,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const gustRing = new THREE.Mesh(new THREE.RingGeometry(4.5, 8.5, 48), gustRingMat);
    gustRing.rotation.x = -Math.PI / 2;
    gustRing.position.set(0, 0.14, -22);
    scene.add(gustRing);

    // Wind audio
    let audioCtx: AudioContext | null = null;
    let windGain: GainNode | null = null;
    let windFilter: BiquadFilterNode | null = null;
    let noiseSrc: AudioBufferSourceNode | null = null;
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
          windFilter = audioCtx.createBiquadFilter();
          windFilter.type = 'bandpass';
          windFilter.frequency.value = 260;
          windFilter.Q.value = 1.1;
          windGain = audioCtx.createGain();
          windGain.gain.value = 0.002;
          noiseSrc.connect(windFilter);
          windFilter.connect(windGain);
          windGain.connect(audioCtx.destination);
          noiseSrc.start();
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
    let completed = false;
    let lastPct = -1;
    let lastIntensityStep = -1;
    let lastPhaseIdx = -1;
    let lastFlashStep = -1;

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

      const p = THREE.MathUtils.clamp(elapsed / STORM_SCENE_DURATION, 0, 1);
      const pct = Math.round(p * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        setProgressPct(pct);
      }

      const arrivalRamp = THREE.MathUtils.smoothstep(p, 0.04, 0.78);
      const intensityStep = Math.round(arrivalRamp * 25) / 25;
      if (intensityStep !== lastIntensityStep) {
        lastIntensityStep = intensityStep;
        setStormIntensityUi(intensityStep);
      }

      const phaseIdx = p < 0.22 ? 0 : p < 0.68 ? 1 : 2;
      if (phaseIdx !== lastPhaseIdx) {
        lastPhaseIdx = phaseIdx;
        if (phaseIdx === 0) {
          setPhaseText('Hazard Alert: Storm Front Detected · Opening Refuge Doors');
        } else if (phaseIdx === 1) {
          setPhaseText('Emergency Refuge: Astronauts Entering Habitats & Starship Airlock');
        } else {
          setPhaseText('Crew Safely Sheltered · Doors Sealed Against Impact');
        }
      }

      terrainBundle.updateSkyEffects(elapsed, dt);

      // Door opening / sealing sequence
      // 0..0.18 -> brace; 0.16..0.75 -> doors open wide while crew enters; 0.75..0.9 -> doors seal shut
      const allSheltered = crewEntries.every((c) => c.sheltered);
      const doorTarget = p > 0.1 && (!allSheltered || p < 0.76) ? 1.0 : 0.0;
      refugeBuildings.forEach((rb) => setShelterDoorsOpen(rb.mesh, doorTarget));
      setShipAirlockAndRamp(spaceship, doorTarget, doorTarget);

      // Advance storm wall
      const wallZ = THREE.MathUtils.lerp(-54, 4, Math.pow(p, 0.85));
      stormWallGroup.position.set(Math.sin(elapsed * 0.7) * 1.4, 0, wallZ);

      cloudSprites.forEach((c) => {
        c.sprite.position.x = c.baseX + Math.sin(elapsed * c.speed + c.phase) * 1.9;
        c.sprite.position.y = c.baseY + Math.cos(elapsed * c.speed * 0.8 + c.phase) * 0.55;
        (c.sprite.material as THREE.SpriteMaterial).opacity = 0.48 + arrivalRamp * 0.42;
      });

      const pulseA = Math.max(0, Math.sin(elapsed * 7.3) * Math.sin(elapsed * 19.1));
      const lightning = arrivalRamp > 0.25 && pulseA > 0.74 ? (pulseA - 0.74) * 3.8 : 0;
      stormFlashLight.position.set(Math.sin(elapsed * 2.1) * 8, 9, wallZ + 4);
      stormFlashLight.intensity = lightning * 18;
      const flashStep = Math.round(lightning * 10) / 10;
      if (flashStep !== lastFlashStep) {
        lastFlashStep = flashStep;
        setFlashStrength(flashStep);
      }

      _skyColor.setHex(spec.skyColor);
      _stormSkyColor.setHex(theme.stormSkyHex);
      _skyColor.lerp(_stormSkyColor, arrivalRamp * 0.78);
      if (lightning > 0.1) _skyColor.offsetHSL(0, 0, lightning * 0.08);
      scene.background = _skyColor;

      _fogColor.setHex(spec.fogColor);
      _stormFogColor.setHex(theme.cloudDarkHex);
      _fogColor.lerp(_stormFogColor, arrivalRamp * 0.72);
      fog.color.copy(_fogColor);
      fog.density = spec.fogDensity * (1 + arrivalRamp * 2.6);

      sunLight.intensity = spec.sunIntensity * (1 - arrivalRamp * 0.55) + lightning * 1.4;
      hemiLight.intensity = spec.hemiIntensity * (1 - arrivalRamp * 0.3);

      const dAttr = debrisGeo.attributes.position as THREE.BufferAttribute;
      const gustMult = 0.75 + arrivalRamp * 2.2;
      for (let i = 0; i < debrisCount; i++) {
        const spd = debrisSpeed[i] * gustMult;
        let dx = debrisPos[i * 3] + spd * 0.35 * dt;
        let dy = debrisPos[i * 3 + 1] + Math.sin(elapsed * 4 + i) * 1.4 * dt;
        let dz = debrisPos[i * 3 + 2] + spd * dt;
        if (dx > 32) dx -= 64;
        if (dz > 24) dz -= 72;
        if (dy < 0.2 || dy > 14.5) dy = 0.3 + ((i * 19) % 120) * 0.1;
        debrisPos[i * 3] = dx;
        debrisPos[i * 3 + 1] = dy;
        debrisPos[i * 3 + 2] = dz;
      }
      dAttr.needsUpdate = true;
      debrisMat.opacity = 0.22 + arrivalRamp * 0.65;

      gustRing.position.z = wallZ + 7;
      gustRing.scale.setScalar(1 + arrivalRamp * 1.6);
      gustRingMat.opacity = 0.14 + arrivalRamp * 0.28;

      const flueRefs = stormFlue.userData.stormFlueRefs;
      if (flueRefs) {
        flueRefs.fanGroup.rotation.y += dt * (2.5 + arrivalRamp * 8.5);
        const alarm = Math.sin(elapsed * 9) > 0 ? 0xef4444 : 0xf59e0b;
        flueRefs.beaconMat.color.setHex(alarm);
        flueRefs.beaconMat.emissive.setHex(alarm);
      }

      const shipRefs = spaceship.userData.spaceshipRefs;
      if (shipRefs) {
        shipRefs.beaconMat.emissiveIntensity = 0.8 + 0.7 * Math.sin(elapsed * 5);
      }

      // Astronauts: first brace (p < 0.18), then sprint smoothly into open doors at full scale (1.0)!
      crewEntries.forEach((c) => {
        const refs = c.mesh.userData.animRefs;
        if (p < 0.16) {
          const brace = THREE.MathUtils.smoothstep(p, 0.02, 0.16);
          c.mesh.rotation.x = -0.15 * brace;
          c.mesh.position.y = groundHeightAt(stateRef.current.planetId, c.x, c.z);
          if (refs) {
            refs.leftArm.rotation.x = -1.2 * brace;
            refs.rightArm.rotation.x = -1.05 * brace;
            refs.selectionRing.visible = false;
          }
        } else if (!c.sheltered) {
          c.mesh.rotation.x = 0;
          const distDoor = Math.hypot(c.target.doorX - c.x, c.target.doorZ - c.z);
          const tx = distDoor > 0.55 ? c.target.doorX : c.target.insideX;
          const tz = distDoor > 0.55 ? c.target.doorZ : c.target.insideZ;
          const dx = tx - c.x;
          const dz = tz - c.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.35 && distDoor <= 0.65) {
            c.sheltered = true;
            c.mesh.visible = false;
          } else if (dist > 0.05) {
            const step = Math.min(dist, 5.4 * dt);
            c.x += (dx / dist) * step;
            c.z += (dz / dist) * step;
            c.yaw = Math.atan2(dx, dz);
            c.walkPhase += dt * 11;
            const swing = Math.sin(c.walkPhase) * 0.6;
            if (refs) {
              refs.leftLeg.rotation.x = swing;
              refs.rightLeg.rotation.x = -swing;
              refs.leftArm.rotation.x = -swing * 0.8;
              refs.rightArm.rotation.x = swing * 0.8;
              refs.selectionRing.visible = false;
            }
          }
          c.mesh.position.set(c.x, groundHeightAt(stateRef.current.planetId, c.x, c.z), c.z);
          c.mesh.rotation.y = c.yaw;
          c.mesh.scale.setScalar(1);
        }
      });

      const buffet = arrivalRamp * 0.08;
      const shakeX = Math.sin(elapsed * 31) * buffet;
      const shakeY = Math.cos(elapsed * 37) * buffet;
      _camPos.set(
        THREE.MathUtils.lerp(-5.2, 6.2, p) + shakeX,
        THREE.MathUtils.lerp(3.4, 5.2, p) + shakeY,
        THREE.MathUtils.lerp(13.8, 12.2, p)
      );
      _camLook.set(
        THREE.MathUtils.lerp(0, 1.8, p),
        THREE.MathUtils.lerp(2.6, 2.0, p),
        THREE.MathUtils.lerp(-14, 1.5, p)
      );
      camera.position.copy(_camPos);
      camera.lookAt(_camLook);

      if (audioCtx && windGain && windFilter) {
        const ct = audioCtx.currentTime;
        if (mutedRef.current) {
          windGain.gain.setTargetAtTime(0.0001, ct, 0.05);
        } else {
          windGain.gain.setTargetAtTime(0.015 + arrivalRamp * 0.075, ct, 0.1);
          windFilter.frequency.setTargetAtTime(220 + arrivalRamp * 460, ct, 0.12);
        }
      }

      renderer.render(scene, camera);

      if (elapsed >= STORM_SCENE_DURATION + 0.4 && !completed) {
        completed = true;
        stopNasaSpeech();
        onCompleteRef.current();
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
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
        } catch {
          // ignore
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
  }, [state.planetId]);

  const windKmh = Math.round(18 + stormIntensityUi * theme.peakWindKmh);
  const visibilityPct = Math.max(18, Math.round(100 - stormIntensityUi * 82));

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#05070C] text-slate-100 select-none">
      <div ref={mountRef} className="w-full h-full" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        style={{ opacity: Math.min(0.92, 0.18 + stormIntensityUi * 0.74) }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 45%, transparent 40%, ${theme.hazeRgba} 100%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage: `repeating-linear-gradient(106deg, transparent 0px, transparent 22px, ${theme.streakRgba} 24px, transparent 28px)`,
          }}
        />
        {flashStrength > 0.05 && (
          <div
            className="absolute inset-0 bg-amber-100"
            style={{ opacity: Math.min(0.18, flashStrength * 0.18) }}
          />
        )}
      </div>

      <header className="absolute top-0 inset-x-0 z-20 astra-glass-warn border-b border-amber-400/40 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <CloudLightning className="w-3.5 h-3.5" />
            <span>
              Day {String(state.day).padStart(2, '0')} · {planet.name} Emergency Refuge
            </span>
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-white">{theme.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAudio}
            className="px-3 py-2 rounded-lg astra-glass-subtle hover:border-amber-400 text-slate-200 font-mono text-xs flex items-center gap-1.5 transition-colors"
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
            <span>{isAudioMuted ? 'Muted' : 'Storm Audio'}</span>
          </button>

          {state.activeEvent && onResolveEmergency && (
            <button
              type="button"
              onClick={() => {
                stopNasaSpeech();
                onResolveEmergency();
              }}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4" />
              Resolve Emergency
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              stopNasaSpeech();
              onComplete();
            }}
            className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Enter Outpost
          </button>
        </div>
      </header>

      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(900px,95vw)] rounded-xl astra-glass px-4 py-3 flex flex-col gap-2.5">
        <div className="w-full h-1.5 rounded-full bg-slate-950/55 border border-white/15 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500 transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-amber-200 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {phaseText}
          </span>

          <div className="flex flex-wrap items-center gap-3 text-slate-200 tabular-nums">
            <span className="flex items-center gap-1 text-amber-300">
              <Wind className="w-3.5 h-3.5" /> {windKmh} km/h
            </span>
            <span className="flex items-center gap-1 text-cyan-300">
              <Eye className="w-3.5 h-3.5" /> Vis {visibilityPct}%
            </span>
            <span className="flex items-center gap-1 text-rose-300">
              <Fan className="w-3.5 h-3.5" /> Flue {state.stormFlue.cloggedPct}%
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
