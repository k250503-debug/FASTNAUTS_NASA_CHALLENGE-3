import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  CloudLightning,
  Eye,
  Fan,
  SkipForward,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { ASTRONAUTS } from '../data/astronauts';
import { getPlanetById } from '../data/planets';
import type { MissionState, PlanetId } from '../types';
import { speakNasaText, stopNasaSpeech } from '../utils/nasaVoice';
import {
  createAstronautMesh,
  createBuildingMesh,
  createContactShadowTexture,
  createNasaSpaceshipMesh,
  createSolarGridTexture,
  createStormFlueMesh,
} from './models';
import { getBuildingWorldPos } from './OutpostScene3D';
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

const STORM_SCENE_DURATION = 9.0;

// Pre-allocated math helpers outside render loop
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
        subtitle: 'Subsurface water-vapor gale & freezing micro-ice crystals',
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
        title: 'Electrostatic Regolith Storm Front',
        subtitle: 'Charged lunar dust cloud & solar-wind plasma gust approaching',
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
  const [phaseText, setPhaseText] = useState('Horizon Telemetry: Storm Wall Detected');
  const [flashStrength, setFlashStrength] = useState(0);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const mutedRef = useRef(isAudioMuted);
  mutedRef.current = isAudioMuted;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Trigger NASA Flight Officer Elena Vance incoming storm voice alert
  useEffect(() => {
    if (isAudioMuted) {
      stopNasaSpeech();
      return;
    }

    const activeTitle = stateRef.current.activeEvent?.title || theme.title;
    const spoken = `Attention crew on ${planet.name}! ${activeTitle} inbound from the northern ridge. High-velocity particulates and gale gusts are approaching the outpost. Brace all astronauts, keep visors sealed, and inspect the storm flue as soon as the front hits.`;
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

    // Dynamic storm lightning / electrostatic discharge flash inside approaching wall
    const stormFlashLight = new THREE.PointLight(theme.lightningHex, 0, 75, 1.4);
    stormFlashLight.position.set(0, 9, -20);
    scene.add(stormFlashLight);

    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(maxAnisotropy);
    const cloudTex = createCloudPuffTexture();
    const disposables: Array<{ dispose: () => void }> = [shadowTex, solarTex, cloudTex];

    // 1. Planetary Terrain & Sky
    const terrainBundle = createTerrainAndSkyGroup(stateRef.current.planetId, maxAnisotropy);
    scene.add(terrainBundle.group);

    // 2. Outpost Buildings
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);
    stateRef.current.buildings.forEach((b) => {
      const pos = getBuildingWorldPos(b.cellIndex);
      const mesh = createBuildingMesh(b.typeId, b.level, b.online, shadowTex, solarTex);
      mesh.position.set(
        pos.x,
        groundHeightAt(stateRef.current.planetId, pos.x, pos.z),
        pos.z
      );
      buildingsGroup.add(mesh);
    });

    // 3. Storm Flue Station & NASA Starship
    const stormFlue = createStormFlueMesh(shadowTex);
    stormFlue.position.set(0, groundHeightAt(stateRef.current.planetId, 0, -5.8), -5.8);
    scene.add(stormFlue);

    const spaceship = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
    spaceship.position.set(
      11.8,
      groundHeightAt(stateRef.current.planetId, 11.8, -4.8),
      -4.8
    );
    spaceship.rotation.y = -Math.PI * 0.58;
    scene.add(spaceship);

    // 4. 6 Astronauts facing toward the incoming storm horizon, bracing against wind
    const crewEntries = ASTRONAUTS.map((profile, idx) => {
      const mesh = createAstronautMesh(profile, shadowTex, false);
      const bx = -4.2 + idx * 1.68;
      const bz = 4.6 + (idx % 2 === 0 ? 0.5 : -0.4);
      const by = groundHeightAt(stateRef.current.planetId, bx, bz);
      mesh.position.set(bx, by, bz);
      mesh.rotation.y = Math.PI + (idx - 2.5) * 0.08;
      scene.add(mesh);
      return { mesh, baseX: bx, baseY: by, baseZ: bz, idx };
    });

    // 5. Massive Advancing Volumetric-Style Storm Wall (42 Layered Billowing Cloud Puffs)
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

    const cloudCount = 42;
    for (let i = 0; i < cloudCount; i++) {
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

    // 6. 520 High-Speed Wind-Blown Storm Debris & Particulate Streaks
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

    // 7. Rolling Ground Dust Front Ring
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

    // 8. Procedural Howling Planetary Storm Wind Audio
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
          for (let i = 0; i < bufLen; i++) {
            ch[i] = Math.random() * 2 - 1;
          }
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
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
        }
      } catch {
        audioCtx = null;
      }
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

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

      // Storm front progression curve: builds from 0.1 to 1.0 as wall sweeps from z=-54 to z=+4
      const arrivalRamp = THREE.MathUtils.smoothstep(p, 0.04, 0.78);
      const intensityStep = Math.round(arrivalRamp * 25) / 25;
      if (intensityStep !== lastIntensityStep) {
        lastIntensityStep = intensityStep;
        setStormIntensityUi(intensityStep);
      }

      const phaseIdx = p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
      if (phaseIdx !== lastPhaseIdx) {
        lastPhaseIdx = phaseIdx;
        if (phaseIdx === 0) {
          setPhaseText('Horizon Telemetry: Massive Storm Wall Advancing');
        } else if (phaseIdx === 1) {
          setPhaseText('Perimeter Alert: Gale Winds Hitting Outpost & Storm Flue');
        } else {
          setPhaseText('Storm Impact: Crew Braced · Clear Storm Flue & Seal Airlocks');
        }
      }

      // Move entire cloud wall forward toward outpost & swirl individual puffs
      const wallZ = THREE.MathUtils.lerp(-54, 4, Math.pow(p, 0.85));
      stormWallGroup.position.set(Math.sin(elapsed * 0.7) * 1.4, 0, wallZ);

      cloudSprites.forEach((c) => {
        c.sprite.position.x = c.baseX + Math.sin(elapsed * c.speed + c.phase) * 1.9;
        c.sprite.position.y = c.baseY + Math.cos(elapsed * c.speed * 0.8 + c.phase) * 0.55;
        (c.sprite.material as THREE.SpriteMaterial).opacity = 0.48 + arrivalRamp * 0.42;
      });

      // Electrostatic lightning pulses as storm arrives
      const pulseA = Math.max(0, Math.sin(elapsed * 7.3) * Math.sin(elapsed * 19.1));
      const lightning = arrivalRamp > 0.25 && pulseA > 0.74 ? (pulseA - 0.74) * 3.8 : 0;
      stormFlashLight.position.set(Math.sin(elapsed * 2.1) * 8, 9, wallZ + 4);
      stormFlashLight.intensity = lightning * 18;
      const flashStep = Math.round(lightning * 10) / 10;
      if (flashStep !== lastFlashStep) {
        lastFlashStep = flashStep;
        setFlashStrength(flashStep);
      }

      // Darken sky and thicken planetary storm fog
      _skyColor.setHex(spec.skyColor);
      _stormSkyColor.setHex(theme.stormSkyHex);
      _skyColor.lerp(_stormSkyColor, arrivalRamp * 0.78);
      if (lightning > 0.1) {
        _skyColor.offsetHSL(0, 0, lightning * 0.08);
      }
      scene.background = _skyColor;

      _fogColor.setHex(spec.fogColor);
      _stormFogColor.setHex(theme.cloudDarkHex);
      _fogColor.lerp(_stormFogColor, arrivalRamp * 0.72);
      fog.color.copy(_fogColor);
      fog.density = spec.fogDensity * (1 + arrivalRamp * 2.6);

      sunLight.intensity = spec.sunIntensity * (1 - arrivalRamp * 0.55) + lightning * 1.4;
      hemiLight.intensity = spec.hemiIntensity * (1 - arrivalRamp * 0.3);

      // Animate 520 Wind Debris Particles rushing from -Z toward +Z (and +X crosswind)
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

      // Ground gust ring sweeping into the outpost
      gustRing.position.z = wallZ + 7;
      gustRing.scale.setScalar(1 + arrivalRamp * 1.6);
      gustRingMat.opacity = 0.14 + arrivalRamp * 0.28;

      // Storm flue turbine spins faster & beacon flashes amber/red
      const flueRefs = stormFlue.userData.stormFlueRefs;
      if (flueRefs) {
        flueRefs.fanGroup.rotation.y += dt * (2.5 + arrivalRamp * 8.5);
        const alarm = Math.sin(elapsed * 9) > 0 ? 0xef4444 : 0xf59e0b;
        flueRefs.beaconMat.color.setHex(alarm);
        flueRefs.beaconMat.emissive.setHex(alarm);
      }

      // Spaceship beacon pulse
      const shipRefs = spaceship.userData.spaceshipRefs;
      if (shipRefs) {
        shipRefs.beaconMat.emissiveIntensity = 0.8 + 0.7 * Math.sin(elapsed * 5);
      }

      // Astronauts visibly brace into the incoming storm wind
      crewEntries.forEach((c) => {
        const brace = THREE.MathUtils.smoothstep(arrivalRamp, 0.1, 0.85);
        const sway = Math.sin(elapsed * 5.2 + c.idx * 1.3) * 0.04 * brace;
        c.mesh.rotation.x = -0.18 * brace + sway;
        c.mesh.position.y = c.baseY;
        const refs = c.mesh.userData.animRefs;
        if (refs) {
          // Raise arms to shield helmet visor from blowing dust/debris
          refs.leftArm.rotation.x = THREE.MathUtils.lerp(0, -1.35, brace);
          refs.leftArm.rotation.z = THREE.MathUtils.lerp(0, -0.35, brace);
          refs.rightArm.rotation.x = THREE.MathUtils.lerp(0, -1.15, brace);
          refs.rightArm.rotation.z = THREE.MathUtils.lerp(0, 0.32, brace);
          if (refs.visorMat) {
            refs.visorMat.emissiveIntensity = 0.2 + brace * 0.55;
          }
          refs.selectionRing.visible = false;
        }
      });

      // Cinematic tracking camera: sweeps from behind astronauts looking at advancing wall, with wind buffet
      const buffet = arrivalRamp * 0.095;
      const shakeX = Math.sin(elapsed * 31) * buffet;
      const shakeY = Math.cos(elapsed * 37) * buffet;
      _camPos.set(
        THREE.MathUtils.lerp(-5.5, 4.2, p) + shakeX,
        THREE.MathUtils.lerp(3.2, 4.8, p) + shakeY,
        THREE.MathUtils.lerp(13.5, 11.2, p)
      );
      _camLook.set(
        THREE.MathUtils.lerp(0, -0.8, p),
        THREE.MathUtils.lerp(3.2, 2.2, p),
        THREE.MathUtils.lerp(-18, -4, p)
      );
      camera.position.copy(_camPos);
      camera.lookAt(_camLook);

      if (audioCtx && windGain && windFilter) {
        const ct = audioCtx.currentTime;
        if (mutedRef.current) {
          windGain.gain.setTargetAtTime(0.0001, ct, 0.05);
        } else {
          const targetVol = 0.015 + arrivalRamp * 0.075;
          windGain.gain.setTargetAtTime(targetVol, ct, 0.1);
          windFilter.frequency.setTargetAtTime(220 + arrivalRamp * 460, ct, 0.12);
        }
      }

      renderer.render(scene, camera);

      if (elapsed >= STORM_SCENE_DURATION + 0.45 && !completed) {
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
          if (audioCtx.state !== 'closed') {
            audioCtx.close().catch(() => {});
          }
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
  }, [state.planetId]);

  const windKmh = Math.round(18 + stormIntensityUi * theme.peakWindKmh);
  const visibilityPct = Math.max(18, Math.round(100 - stormIntensityUi * 82));

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#05070C] text-slate-100 select-none">
      <div ref={mountRef} className="w-full h-full" />

      {/* Subtle Atmospheric Storm Overlay & Lightning Flash (Zero Backdrop-Blur) */}
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

      {/* Top Storm Warning Header */}
      <header className="absolute top-0 inset-x-0 z-20 bg-[#0F1623]/94 border-b border-amber-500/40 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <CloudLightning className="w-3.5 h-3.5" />
            <span>
              Day {String(state.day).padStart(2, '0')} · {planet.name} Storm Warning
            </span>
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-white">{theme.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAudio}
            className="px-3 py-2 rounded-lg bg-[#07090E] border border-slate-700 hover:border-amber-400 text-slate-200 font-mono text-xs flex items-center gap-1.5"
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
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <SkipForward className="w-4 h-4" />
            Enter Outpost
          </button>
        </div>
      </header>

      {/* Bottom Storm Telemetry Dock */}
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(900px,95vw)] rounded-xl bg-[#0F1623]/94 border border-slate-800 px-4 py-3 flex flex-col gap-2.5">
        <div className="w-full h-1.5 rounded-full bg-[#07090E] border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500 transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-amber-200 flex items-center gap-1.5">
            <CloudLightning className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {phaseText}
          </span>

          <div className="flex flex-wrap items-center gap-3 text-slate-300 tabular-nums">
            <span className="flex items-center gap-1 text-amber-300">
              <Wind className="w-3.5 h-3.5" /> {windKmh} km/h
            </span>
            <span className="flex items-center gap-1 text-sky-300">
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
