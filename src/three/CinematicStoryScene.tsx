import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowRight, Play, RotateCcw, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { PLANETS, getPlanetById } from '../data/planets';
import { createAAARenderPipeline } from './postfx';
import {
  createBuildingMesh,
  createContactShadowTexture,
  createNasaSpaceshipMesh,
  createSolarGridTexture,
  setShipAirlockAndRamp,
} from './models';
import { createTerrainAndSkyGroup, getPlanetEnvironmentSpec, groundHeightAt } from './terrain';
import { playSpaceSfx } from '../utils/spaceAudio';
import { speakNasaText, stopNasaSpeech } from '../utils/nasaVoice';
import { useTourSoundtrack } from '../utils/useTourSoundtrack';
import type { PlanetId } from '../types';

interface CinematicStorySceneProps {
  initialPlanetId?: PlanetId;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onContinueToSetup: (planetId: PlanetId) => void;
  onOpenEquipment?: () => void;
  onOpenAstronauts?: () => void;
}

const TOTAL_STORY_DURATION = 22.0;

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export default function CinematicStoryScene({
  initialPlanetId = 'mars',
  isAudioMuted,
  onToggleAudio,
  onContinueToSetup,
  onOpenEquipment,
  onOpenAstronauts,
}: CinematicStorySceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [planetId, setPlanetId] = useState<PlanetId>(initialPlanetId);
  const [actIndex, setActIndex] = useState<1 | 2 | 3>(1);
  const [progress01, setProgress01] = useState(0);
  const [storyFinished, setStoryFinished] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [storyReplaySignal, setStoryReplaySignal] = useState(0);

  useTourSoundtrack({
    enabled: true,
    muted: isAudioMuted,
    volume: 0.52,
    restartSignal: storyReplaySignal,
  });

  const planetIdRef = useRef<PlanetId>(planetId);
  planetIdRef.current = planetId;
  const mutedRef = useRef<boolean>(isAudioMuted);
  mutedRef.current = isAudioMuted;

  const restartRef = useRef<(() => void) | null>(null);
  const syncPlanetRef = useRef<((pid: PlanetId) => void) | null>(null);

  useEffect(() => {
    syncPlanetRef.current?.(planetId);
  }, [planetId]);

  useEffect(() => {
    if (isAudioMuted) stopNasaSpeech();
  }, [isAudioMuted]);

  useEffect(() => {
    return () => {
      stopNasaSpeech();
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let pipeline: ReturnType<typeof createAAARenderPipeline> | null = null;
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        48,
        (container.clientWidth || 1280) / (container.clientHeight || 720),
        0.25,
        280
      );

      pipeline = createAAARenderPipeline(container, scene, camera, {
        bloomStrength: 0.34,
        bloomRadius: 0.48,
        bloomThreshold: 0.82,
        exposure: 1.14,
      });

      const { renderer, isSoftwareGl } = pipeline;
      const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;

      const shadowTex = createContactShadowTexture();
      const solarTex = createSolarGridTexture(maxAnisotropy);

      const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x334155, 0.95);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.3);
      sunLight.position.set(24, 22, -16);
      sunLight.castShadow = !isSoftwareGl;
      sunLight.shadow.mapSize.width = isSoftwareGl ? 1024 : 2048;
      sunLight.shadow.mapSize.height = isSoftwareGl ? 1024 : 2048;
      sunLight.shadow.camera.left = -28;
      sunLight.shadow.camera.right = 28;
      sunLight.shadow.camera.top = 28;
      sunLight.shadow.camera.bottom = -28;
      sunLight.shadow.bias = -0.0004;
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.05);
      rimLight.position.set(-18, 11, 20);
      scene.add(rimLight);

      // Terrain & Sky wrapper
      const envGroup = new THREE.Group();
      scene.add(envGroup);
      let terrainBundle: ReturnType<typeof createTerrainAndSkyGroup> | null = null;

      // Distant mountain horizon silhouettes
      const mountainGroup = new THREE.Group();
      const mountainMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.96,
        metalness: 0.04,
        flatShading: true,
      });
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 62 + (i % 3) * 14;
        const radius = 14 + (i % 4) * 5;
        const height = 10 + (i % 5) * 4.5;
        const ridge = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6), mountainMat);
        ridge.position.set(Math.cos(angle) * dist, height * 0.42 - 1.5, Math.sin(angle) * dist);
        ridge.rotation.y = i * 0.7;
        mountainGroup.add(ridge);
      }
      scene.add(mountainGroup);

      // Outpost Landing Zone, Solar Arrays & Base Silhouette
      const baseGroup = new THREE.Group();
      const padPos = { x: 4.5, z: -2.0 };
      const padRing = new THREE.Mesh(
        new THREE.RingGeometry(3.1, 3.65, 48),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.55,
          roughness: 0.4,
          side: THREE.DoubleSide,
        })
      );
      padRing.rotation.x = -Math.PI / 2;
      padRing.position.set(padPos.x, 0.05, padPos.z);
      baseGroup.add(padRing);

      // Pad corner beacons
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x38bdf8,
            emissiveIntensity: 2.2,
          })
        );
        beacon.position.set(padPos.x + Math.cos(a) * 3.85, 0.16, padPos.z + Math.sin(a) * 3.85);
        baseGroup.add(beacon);
      }

      const habMesh = createBuildingMesh('habitat', 2, true, shadowTex, solarTex);
      habMesh.position.set(-5.8, 0, -4.5);
      baseGroup.add(habMesh);

      const solar1 = createBuildingMesh('solar', 2, true, shadowTex, solarTex);
      solar1.position.set(-10.5, 0, 1.5);
      baseGroup.add(solar1);

      const solar2 = createBuildingMesh('solar', 2, true, shadowTex, solarTex);
      solar2.position.set(-8.2, 0, 5.2);
      baseGroup.add(solar2);

      const comms = createBuildingMesh('comms', 2, true, shadowTex, solarTex);
      comms.position.set(-2.5, 0, -9.2);
      baseGroup.add(comms);

      scene.add(baseGroup);

      // Approach Starship
      const shipGroup = createNasaSpaceshipMesh(shadowTex, maxAnisotropy);
      setShipAirlockAndRamp(shipGroup, 0, 0);
      scene.add(shipGroup);

      // Thruster Exhaust Plumes
      const plumeGroup = new THREE.Group();
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.85,
      });
      const plumeCoreMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.9,
      });
      for (const ox of [-0.55, 0, 0.55]) {
        const outer = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.8, 14), plumeMat);
        outer.rotation.x = Math.PI;
        outer.position.set(ox, -1.35, 0);
        plumeGroup.add(outer);
        const core = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.8, 12), plumeCoreMat);
        core.rotation.x = Math.PI;
        core.position.set(ox, -0.95, 0);
        plumeGroup.add(core);
      }
      shipGroup.add(plumeGroup);

      // Touchdown Dust Cloud Ring & Atmospheric Dust Particles
      const dustCount = 160;
      const dustPositions = new Float32Array(dustCount * 3);
      const dustAngles = new Float32Array(dustCount);
      const dustSpeeds = new Float32Array(dustCount);
      for (let i = 0; i < dustCount; i++) {
        dustAngles[i] = (i / dustCount) * Math.PI * 2 + (i % 5) * 0.14;
        dustSpeeds[i] = 1.6 + (i % 7) * 0.45;
        dustPositions[i * 3] = padPos.x;
        dustPositions[i * 3 + 1] = -20;
        dustPositions[i * 3 + 2] = padPos.z;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dustMat = new THREE.PointsMaterial({
        color: 0xe2e8f0,
        size: 0.55,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const dustPoints = new THREE.Points(dustGeo, dustMat);
      dustPoints.frustumCulled = false;
      scene.add(dustPoints);

      const syncPlanetEnv = (pid: PlanetId) => {
        if (terrainBundle) {
          terrainBundle.dispose();
          terrainBundle = null;
        }
        while (envGroup.children.length > 0) envGroup.remove(envGroup.children[0]);

        const spec = getPlanetEnvironmentSpec(pid);
        scene.background = new THREE.Color(spec.skyColor);
        scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity * 0.72);
        hemiLight.color.setHex(spec.hemiSkyColor);
        hemiLight.groundColor.setHex(spec.hemiGroundColor);
        hemiLight.intensity = spec.hemiIntensity;
        sunLight.color.setHex(spec.sunColor);
        sunLight.intensity = spec.sunIntensity * 1.15;
        mountainMat.color.set(spec.terrainAccentHex);
        dustMat.color.set(spec.terrainBaseHex);

        terrainBundle = createTerrainAndSkyGroup(pid, maxAnisotropy);
        envGroup.add(terrainBundle.group);

        // Seat ground installations accurately on terrain height
        const py = groundHeightAt(pid, padPos.x, padPos.z);
        padRing.position.y = py + 0.04;
        habMesh.position.y = groundHeightAt(pid, -5.8, -4.5);
        solar1.position.y = groundHeightAt(pid, -10.5, 1.5);
        solar2.position.y = groundHeightAt(pid, -8.2, 5.2);
        comms.position.y = groundHeightAt(pid, -2.5, -9.2);
      };

      syncPlanetRef.current = syncPlanetEnv;
      syncPlanetEnv(planetIdRef.current);

      let elapsed = 0;
      let disposed = false;
      let rafId = 0;
      let timerId = 0;
      let lastTime = performance.now();
      let playedSwell = false;
      let playedThruster = false;
      let playedTouchdown = false;
      let voicedAct1 = false;
      let voicedAct2 = false;
      let voicedAct3 = false;

      _camPos.set(-22, 6.5, 24);
      _camLook.set(0, 2.5, 0);

      const resetStory = () => {
        elapsed = 0;
        playedSwell = false;
        playedThruster = false;
        playedTouchdown = false;
        voicedAct1 = false;
        voicedAct2 = false;
        voicedAct3 = false;
        stopNasaSpeech();
        setStoryFinished(false);
        setActIndex(1);
        setProgress01(0);
      };
      restartRef.current = resetStory;

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        elapsed = Math.min(TOTAL_STORY_DURATION + 8, elapsed + dt);
        const t = Math.min(elapsed, TOTAL_STORY_DURATION);
        const norm = t / TOTAL_STORY_DURATION;
        setProgress01(norm);

        const activePlanet = getPlanetById(planetIdRef.current);

        if (t < 6.5) {
          setActIndex(1);
          if (!playedSwell && t > 0.25) {
            playedSwell = true;
            playSpaceSfx('cinematic_swell', mutedRef.current);
          }
          if (!voicedAct1 && t > 0.65) {
            voicedAct1 = true;
            speakNasaText(
              `Orbital horizon over ${activePlanet.name}. Initiating powered approach vector.`,
              { muted: mutedRef.current, radioComms: true, queue: false, rate: 1.0, pitch: 1.1 }
            );
          }
        } else if (t < 15.0) {
          setActIndex(2);
          if (!playedThruster) {
            playedThruster = true;
            playSpaceSfx('thruster', mutedRef.current);
          }
          if (!voicedAct2 && t > 6.8) {
            voicedAct2 = true;
            speakNasaText(
              'Retro-propulsion engines burning. Descending toward crater-rim landing pad.',
              { muted: mutedRef.current, radioComms: true, queue: true, rate: 1.0, pitch: 1.1 }
            );
          }
        } else {
          setActIndex(3);
          if (!playedTouchdown && t > 15.1) {
            playedTouchdown = true;
            playSpaceSfx('touchdown', mutedRef.current);
          }
          if (!voicedAct3 && t > 15.4) {
            voicedAct3 = true;
            speakNasaText(
              `Touchdown confirmed on ${activePlanet.name}. Airlock open, outpost surface operations ready.`,
              { muted: mutedRef.current, radioComms: true, queue: true, rate: 1.0, pitch: 1.1 }
            );
          }
        }

        if (elapsed >= TOTAL_STORY_DURATION && !storyFinished) {
          setStoryFinished(true);
        }

        const padY = groundHeightAt(planetIdRef.current, padPos.x, padPos.z);

        // Spacecraft Descent Kinematics
        if (t < 5.8) {
          shipGroup.position.set(padPos.x - 42, padY + 46, padPos.z - 52);
          shipGroup.rotation.set(0.32, -0.52, -0.18);
          plumeGroup.visible = true;
          plumeGroup.scale.setScalar(1.2);
          setShipAirlockAndRamp(shipGroup, 0, 0);
        } else if (t < 15.2) {
          const descent01 = smoothstep(5.8, 15.2, t);
          const arcX = padPos.x - 42 * Math.pow(1 - descent01, 1.45);
          const arcZ = padPos.z - 52 * Math.pow(1 - descent01, 1.45);
          const arcY = padY + 46 * Math.pow(1 - descent01, 1.85);
          shipGroup.position.set(arcX, arcY, arcZ);
          // Pitch upright cleanly during retro-burn flare
          const tilt = (1 - smoothstep(10.5, 14.9, t)) * 0.34;
          shipGroup.rotation.set(tilt, -0.52, -tilt * 0.45);
          const plumePulse = 0.85 + Math.sin(elapsed * 26) * 0.22;
          plumeGroup.visible = true;
          plumeGroup.scale.set(1, plumePulse * (1.25 - descent01 * 0.35), 1);
          setShipAirlockAndRamp(shipGroup, 0, 0);
        } else {
          shipGroup.position.set(padPos.x, padY, padPos.z);
          shipGroup.rotation.set(0, -0.52, 0);
          const shutoff = 1 - smoothstep(15.2, 16.0, t);
          plumeGroup.visible = shutoff > 0.02;
          plumeGroup.scale.setScalar(Math.max(0.01, shutoff));
          const ramp01 = smoothstep(16.6, 19.8, t);
          setShipAirlockAndRamp(shipGroup, ramp01, ramp01);
        }

        // Touchdown Dust Ring Expansion
        if (t >= 13.4 && t <= 20.5) {
          const dustPhase = Math.max(0, t - 13.4) / 7.1;
          dustMat.opacity = Math.sin(Math.min(1, dustPhase) * Math.PI) * 0.58;
          const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < dustCount; i++) {
            const rad = 1.4 + dustPhase * 9.5 * dustSpeeds[i] * 0.5;
            const ang = dustAngles[i] + dustPhase * 0.55;
            const px = padPos.x + Math.cos(ang) * rad;
            const pz = padPos.z + Math.sin(ang) * rad;
            const py =
              groundHeightAt(planetIdRef.current, px, pz) +
              0.25 +
              Math.sin(dustPhase * Math.PI) * (0.6 + (i % 4) * 0.35);
            posAttr.setXYZ(i, px, py, pz);
          }
          posAttr.needsUpdate = true;
        } else {
          dustMat.opacity = 0;
        }

        // Camera Choreography across 3 Acts
        if (t < 6.5) {
          const p = smoothstep(0, 6.5, t);
          _targetPos.set(-24 + p * 10, 8.2 - p * 2.2, 24 - p * 8);
          _targetLook.set(-3 + p * 4, 2.2 + p * 1.4, -2);
        } else if (t < 15.2) {
          const p = smoothstep(6.5, 15.2, t);
          _targetPos.set(-14 + p * 24, 6.0 + Math.sin(p * Math.PI) * 5.2, 16 + p * 4);
          _targetLook.set(
            THREE.MathUtils.lerp(shipGroup.position.x, padPos.x, 0.45),
            Math.max(padY + 2.4, shipGroup.position.y + 2.5),
            THREE.MathUtils.lerp(shipGroup.position.z, padPos.z, 0.45)
          );
        } else {
          const p = smoothstep(15.2, TOTAL_STORY_DURATION, t);
          const orbitAng = p * 0.55 + Math.max(0, elapsed - TOTAL_STORY_DURATION) * 0.08;
          _targetPos.set(
            padPos.x + Math.cos(0.75 + orbitAng) * 18.5,
            padY + 5.8 + Math.sin(orbitAng * 0.5) * 1.2,
            padPos.z + Math.sin(0.75 + orbitAng) * 18.5
          );
          _targetLook.set(0.5, padY + 2.4, -2.5);
        }

        const dampAlpha = 1 - Math.exp(-3.4 * dt);
        _camPos.lerp(_targetPos, dampAlpha);
        _camLook.lerp(_targetLook, dampAlpha);
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);

        terrainBundle?.updateSkyEffects(dt, elapsed);
        pipeline?.renderFrame();

        if (isSoftwareGl) {
          timerId = window.setTimeout(tick, 80);
        } else {
          rafId = requestAnimationFrame(tick);
        }
      };

      const handleResize = () => {
        if (!pipeline) return;
        pipeline.resize(container.clientWidth || 1280, container.clientHeight || 720, camera);
      };
      const ro = new ResizeObserver(handleResize);
      ro.observe(container);

      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        window.clearTimeout(timerId);
        ro.disconnect();
        terrainBundle?.dispose();
        dustGeo.dispose();
        dustMat.dispose();
        mountainMat.dispose();
        shadowTex.dispose();
        solarTex.dispose();
        envRT.dispose();
        roomEnv.dispose();
        pmremGenerator.dispose();
        pipeline?.dispose();
      };
    } catch {
      setWebglFailed(true);
      pipeline?.dispose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPlanet = getPlanetById(planetId);
  const actMeta =
    actIndex === 1
      ? {
          kicker: 'Act I · Orbital Horizon',
          heading: 'Beyond Earth’s Frontier',
          caption: `Reconnaissance over ${currentPlanet.name} (${currentPlanet.location}). Gravity ${currentPlanet.gravityMs2} m/s².`,
        }
      : actIndex === 2
      ? {
          kicker: 'Act II · Retro-Propulsion Descent',
          heading: 'Powered Approach Vector',
          caption: 'Starship guidance thrusters firing for precision crater-rim touchdown.',
        }
      : {
          kicker: 'Act III · Outpost Activated',
          heading: 'Surface Operations Ready',
          caption: 'Solar grids online, pressure locks sealed, crew and rovers cleared for EVA.',
        };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090E] text-slate-100 select-none">
      {!webglFailed ? (
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0B1220] to-[#07090E] flex items-center justify-center">
          <div className="text-center px-6">
            <h1 className="font-display text-5xl font-bold text-white tracking-wider mb-3">
              ASTRO MISSION
            </h1>
            <p className="text-slate-300 max-w-md mx-auto">{actMeta.caption}</p>
          </div>
        </div>
      )}

      {/* Cinematic Letterbox Bars */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-10 bg-gradient-to-b from-black/65 to-transparent z-10" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/65 to-transparent z-10" />

      {/* Top Controls Strip */}
      <div className="absolute top-12 inset-x-6 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 astra-glass rounded-lg p-1">
          {PLANETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                playSpaceSfx('ui_click', isAudioMuted);
                setPlanetId(p.id);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                planetId === p.id
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="px-3 py-1.5 rounded-lg astra-glass-subtle hover:border-cyan-400 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            {isAudioMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
            )}
            <span>{isAudioMuted ? 'Muted' : 'Audio'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              restartRef.current?.();
              setStoryReplaySignal((s) => s + 1);
            }}
            className="px-3 py-1.5 rounded-lg astra-glass-subtle hover:border-cyan-400 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
            <span>Replay</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopNasaSpeech();
              playSpaceSfx('ui_select', isAudioMuted);
              onContinueToSetup(planetId);
            }}
            className="px-4 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Skip to Mission Setup</span>
          </button>
        </div>
      </div>

      {/* Dramatic Title Reveal (Act I Peak) */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-28 flex flex-col items-center text-center px-6 z-20 transition-all duration-700 ${
          progress01 < 0.34 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-300 mb-2">
          Interplanetary Surface Operations
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-[0.14em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
          ASTRO MISSION
        </h1>
      </div>

      {/* Bottom Cinematic Story Overlay & Transitions */}
      <div className="absolute bottom-14 inset-x-6 z-20 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-xl astra-glass rounded-xl px-5 py-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 mb-1">
            {actMeta.kicker}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-1">
            {actMeta.heading}
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mb-3">{actMeta.caption}</p>
          <div className="w-full h-1 bg-slate-950/60 border border-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 transition-[width] duration-150"
              style={{ width: `${Math.round(progress01 * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenEquipment && (
            <button
              type="button"
              onClick={() => {
                playSpaceSfx('ui_click', isAudioMuted);
                onOpenEquipment();
              }}
              className="px-4 py-3 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs font-semibold text-cyan-300 whitespace-nowrap shrink-0 transition-colors"
            >
              Inspect 3D Equipment
            </button>
          )}
          {onOpenAstronauts && (
            <button
              type="button"
              onClick={() => {
                playSpaceSfx('ui_click', isAudioMuted);
                onOpenAstronauts();
              }}
              className="px-4 py-3 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs font-semibold text-cyan-200 whitespace-nowrap shrink-0 transition-colors"
            >
              Astronaut Gallery
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopNasaSpeech();
              playSpaceSfx('ui_select', isAudioMuted);
              onContinueToSetup(planetId);
            }}
            className="px-6 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg transition-colors"
          >
            {storyFinished ? <Play className="w-4 h-4 fill-current" /> : <ArrowRight className="w-4 h-4" />}
            <span>{storyFinished ? 'Begin Command Setup' : 'Launch Commander Setup'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
