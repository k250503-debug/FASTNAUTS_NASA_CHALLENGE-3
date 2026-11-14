import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getAstronautById } from '../data/astronauts';
import {
  applyAstronautCustomization,
  createAstronautMesh,
  createContactShadowTexture,
} from './models';
import { createAAARenderPipeline } from './postfx';
import type { AstronautCustomization, AstronautId } from '../types';

export type AstronautStudioFocus = 'full' | 'helmet' | 'backpack';

interface AstronautPreview3DProps {
  astronautId: AstronautId;
  customization: AstronautCustomization;
  focus?: AstronautStudioFocus;
}

const STUDIO_VIEWS: Record<
  AstronautStudioFocus,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  full: { pos: [0.45, 1.35, 3.25], target: [0, 1.0, 0] },
  helmet: { pos: [0.35, 1.65, 1.55], target: [0, 1.52, 0] },
  backpack: { pos: [-1.45, 1.38, -2.1], target: [0, 1.12, -0.15] },
};

const _camPos = new THREE.Vector3();
const _target = new THREE.Vector3();

export default function AstronautPreview3D({
  astronautId,
  customization,
  focus = 'full',
}: AstronautPreview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const astroIdRef = useRef(astronautId);
  const customRef = useRef(customization);
  const focusRef = useRef<AstronautStudioFocus>(focus);
  const userInteractedRef = useRef(false);

  astroIdRef.current = astronautId;
  customRef.current = customization;

  const syncActorRef = useRef<((id: AstronautId, custom: AstronautCustomization) => void) | null>(
    null
  );

  useEffect(() => {
    focusRef.current = focus;
    userInteractedRef.current = false;
  }, [focus]);

  useEffect(() => {
    syncActorRef.current?.(astronautId, customization);
  }, [astronautId, customization]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 500) / (container.clientHeight || 520),
      0.15,
      60
    );
    camera.position.set(0.45, 1.35, 3.25);

    const pipeline = createAAARenderPipeline(container, scene, camera, {
      bloomStrength: 0.06,
      bloomRadius: 0.3,
      bloomThreshold: 1.2,
      exposure: 0.92,
    });
    const { renderer, isSoftwareGl } = pipeline;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.3;

    const hemi = new THREE.HemisphereLight(0x94a3b8, 0x0f172a, 0.48);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.4);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.32);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Turntable Platform
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.25, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.65 })
    );
    pedestal.position.y = -0.07;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.06, 1.12, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 6.2;
    controls.target.set(0, 1.0, 0);
    controls.addEventListener('start', () => {
      userInteractedRef.current = true;
    });

    const shadowTex = createContactShadowTexture();
    const holder = new THREE.Group();
    scene.add(holder);

    let currentMesh: THREE.Group | null = null;
    let currentActorId: AstronautId | null = null;

    const syncActor = (id: AstronautId, custom: AstronautCustomization) => {
      if (currentActorId !== id || !currentMesh) {
        if (currentMesh) {
          holder.remove(currentMesh);
          currentMesh.traverse((obj) => {
            const m = obj as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            if (m.material) {
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              mats.forEach((mat) => {
                const std = mat as THREE.MeshStandardMaterial;
                if (std.map && std.map !== shadowTex) std.map.dispose();
                mat.dispose();
              });
            }
          });
        }
        currentActorId = id;
        const profile = getAstronautById(id);
        currentMesh = createAstronautMesh(profile, shadowTex, false, custom);
        holder.add(currentMesh);
      } else {
        applyAstronautCustomization(currentMesh, custom);
      }
      (ring.material as THREE.MeshBasicMaterial).color.setHex(custom.accentColorHex);
    };

    syncActorRef.current = syncActor;
    syncActor(astroIdRef.current, customRef.current);

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let elapsed = 0;
    let lastTime = performance.now();

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      if (currentMesh) {
        // Subtle idle breathing & telemetry check pose
        const refs = currentMesh.userData.animRefs as
          | {
              leftArm?: THREE.Group;
              rightArm?: THREE.Group;
              headPivot?: THREE.Group;
            }
          | undefined;
        if (refs?.headPivot) {
          refs.headPivot.rotation.y = Math.sin(elapsed * 0.85) * 0.14;
        }
        if (refs?.leftArm) {
          refs.leftArm.rotation.x = Math.sin(elapsed * 1.1) * 0.05;
        }
        if (refs?.rightArm) {
          refs.rightArm.rotation.x = -0.15 + Math.cos(elapsed * 1.1) * 0.05;
        }
      }

      if (!userInteractedRef.current) {
        const preset = STUDIO_VIEWS[focusRef.current];
        _camPos.set(...preset.pos);
        _target.set(...preset.target);
        const alpha = 1 - Math.exp(-5.0 * dt);
        camera.position.lerp(_camPos, alpha);
        controls.target.lerp(_target, alpha);
      }

      controls.update();
      pipeline.renderFrame();

      if (isSoftwareGl) {
        timerId = window.setTimeout(tick, 80);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const handleResize = () => {
      pipeline.resize(container.clientWidth || 500, container.clientHeight || 520, camera);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      ro.disconnect();
      controls.dispose();
      shadowTex.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      pipeline.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}
