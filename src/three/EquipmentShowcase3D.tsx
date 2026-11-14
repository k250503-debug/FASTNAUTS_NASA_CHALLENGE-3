import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createAAARenderPipeline } from './postfx';
import { createContactShadowTexture, createSolarGridTexture } from './models';
import type { EquipmentId } from '../types';

export type EquipmentCameraAngle = 'iso' | 'front' | 'top' | 'detail';

interface EquipmentShowcase3DProps {
  equipmentId: EquipmentId;
  cameraAngle?: EquipmentCameraAngle;
  replayTrigger?: number;
}

const ANGLE_PRESETS: Record<EquipmentCameraAngle, { pos: [number, number, number]; target: [number, number, number] }> = {
  iso: { pos: [3.9, 2.7, 4.3], target: [0, 1.15, 0] },
  front: { pos: [0, 1.75, 5.1], target: [0, 1.15, 0] },
  top: { pos: [0.1, 5.4, 1.3], target: [0, 1.0, 0] },
  detail: { pos: [2.1, 1.65, 2.45], target: [0, 1.25, 0] },
};

const _desiredCamPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();

function buildEquipmentRig(
  id: EquipmentId,
  shadowTex: THREE.CanvasTexture,
  solarTex: THREE.CanvasTexture,
  isSoftwareGl: boolean
): {
  group: THREE.Group;
  update: (elapsed: number, deployTime: number, dt: number) => void;
} {
  const root = new THREE.Group();

  // Contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(4.2, 4.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowPlane = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  shadowPlane.position.y = 0.01;
  root.add(shadowPlane);

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.34,
    metalness: 0.72,
  });
  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.56,
    metalness: 0.48,
  });
  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.6,
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.3,
  });
  const emeraldGlowMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.3,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.06,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.86,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 1,
    ior: 1.5,
    thickness: 0.6,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const solarMat = new THREE.MeshPhysicalMaterial({
    map: solarTex,
    roughness: 0.18,
    metalness: 0.45,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });

  if (id === 'solar_array') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.82, 0.28, 24), darkFrameMat);
    base.position.y = 0.14;
    base.castShadow = true;
    root.add(base);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 1.55, 16), titaniumMat);
    mast.position.y = 0.95;
    mast.castShadow = true;
    root.add(mast);

    const gimbalPivot = new THREE.Group();
    gimbalPivot.position.set(0, 1.72, 0);
    root.add(gimbalPivot);

    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), goldFoilMat);
    gimbalPivot.add(hub);

    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(-0.2, 0, 0);
    const leftOuterPivot = new THREE.Group();
    leftOuterPivot.position.set(-1.05, 0, 0);

    const panelGeo = new THREE.BoxGeometry(1.0, 0.05, 1.35);
    const leftInner = new THREE.Mesh(panelGeo, solarMat);
    leftInner.position.set(-0.52, 0, 0);
    leftInner.castShadow = true;
    leftWingPivot.add(leftInner);
    const leftOuter = new THREE.Mesh(panelGeo, solarMat);
    leftOuter.position.set(-0.52, 0, 0);
    leftOuter.castShadow = true;
    leftOuterPivot.add(leftOuter);
    leftWingPivot.add(leftOuterPivot);
    gimbalPivot.add(leftWingPivot);

    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.2, 0, 0);
    const rightOuterPivot = new THREE.Group();
    rightOuterPivot.position.set(1.05, 0, 0);
    const rightInner = new THREE.Mesh(panelGeo, solarMat);
    rightInner.position.set(0.52, 0, 0);
    rightInner.castShadow = true;
    rightWingPivot.add(rightInner);
    const rightOuter = new THREE.Mesh(panelGeo, solarMat);
    rightOuter.position.set(0.52, 0, 0);
    rightOuter.castShadow = true;
    rightOuterPivot.add(rightOuter);
    rightWingPivot.add(rightOuterPivot);
    gimbalPivot.add(rightWingPivot);

    // Energy Bus Pulse Rings descending mast into converter
    const energyBeads: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 20), cyanGlowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.55 - i * 0.35;
      root.add(ring);
      energyBeads.push(ring);
    }

    // Animated sunlight indicator orb
    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    root.add(sunOrb);

    return {
      group: root,
      update: (elapsed, deployTime) => {
        const unfold = Math.min(1, deployTime / 2.2);
        const foldAngle = (1 - unfold) * (Math.PI * 0.46);
        leftWingPivot.rotation.z = foldAngle;
        leftOuterPivot.rotation.z = foldAngle * 1.1;
        rightWingPivot.rotation.z = -foldAngle;
        rightOuterPivot.rotation.z = -foldAngle * 1.1;

        const sunSweep = Math.sin(elapsed * 0.75) * 0.55;
        sunOrb.position.set(Math.sin(sunSweep) * 2.5, 3.1, Math.cos(sunSweep) * 1.4);
        gimbalPivot.rotation.y = sunSweep * 0.65;
        gimbalPivot.rotation.x = -0.32 + Math.cos(elapsed * 0.75) * 0.14;

        energyBeads.forEach((b, idx) => {
          const p = ((elapsed * 1.15 + idx * 0.25) % 1);
          b.position.y = 1.62 - p * 1.32;
          b.scale.setScalar(0.85 + Math.sin(p * Math.PI) * 0.35);
        });
      },
    };
  }

  if (id === 'solar_water_cycle') {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 2.0), darkFrameMat);
    plinth.position.y = 0.11;
    plinth.castShadow = true;
    root.add(plinth);

    // Stage 1: Solar Collector Dish + Vapor Dome (Left)
    const collectorDish = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
      goldFoilMat
    );
    collectorDish.rotation.x = Math.PI * 0.78;
    collectorDish.position.set(-1.12, 0.9, 0);
    root.add(collectorDish);

    const vaporDome = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.65, 20), glassMat);
    vaporDome.position.set(-1.12, 1.32, 0);
    vaporDome.renderOrder = 2;
    root.add(vaporDome);

    // Stage 2: Filtration & UV Purifier Column (Center)
    const filterCol = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.45, 20), titaniumMat);
    filterCol.position.set(0, 0.95, 0);
    filterCol.castShadow = true;
    root.add(filterCol);

    const uvCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.62, 16), cyanGlowMat);
    uvCore.position.set(0, 1.12, 0.18);
    root.add(uvCore);

    // Stage 3: Pressurized Glass Reservoir (Right)
    const tankShell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 24), glassMat);
    tankShell.position.set(1.12, 0.95, 0);
    tankShell.renderOrder = 2;
    root.add(tankShell);

    const waterFillMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    const waterFill = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 22), waterFillMat);
    waterFill.position.set(1.12, 0.82, 0);
    root.add(waterFill);

    // Connecting Piping Curve + Animated Water Flow Droplets
    const flowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.12, 1.55, 0),
      new THREE.Vector3(-0.58, 1.95, 0),
      new THREE.Vector3(0, 1.72, 0),
      new THREE.Vector3(0.58, 1.85, 0),
      new THREE.Vector3(1.12, 1.45, 0),
    ]);
    const topPipe = new THREE.Mesh(new THREE.TubeGeometry(flowCurve, 32, 0.045, 10, false), titaniumMat);
    root.add(topPipe);

    const returnCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.12, 0.36, 0.25),
      new THREE.Vector3(0, 0.32, 0.42),
      new THREE.Vector3(-1.12, 0.42, 0.25),
    ]);
    const returnPipe = new THREE.Mesh(new THREE.TubeGeometry(returnCurve, 24, 0.04, 10, false), darkFrameMat);
    root.add(returnPipe);

    const droplets: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), cyanGlowMat);
      root.add(drop);
      droplets.push(drop);
    }

    const returnDrops: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), emeraldGlowMat);
      root.add(drop);
      returnDrops.push(drop);
    }

    const pumpRotor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), goldFoilMat);
    pumpRotor.position.set(0, 0.34, 0.46);
    root.add(pumpRotor);

    return {
      group: root,
      update: (elapsed) => {
        droplets.forEach((d, idx) => {
          const p = (elapsed * 0.42 + idx / droplets.length) % 1;
          flowCurve.getPointAt(p, d.position);
        });
        returnDrops.forEach((d, idx) => {
          const p = (elapsed * 0.55 + idx / returnDrops.length) % 1;
          returnCurve.getPointAt(p, d.position);
        });
        const fillWave = 0.58 + 0.35 * (0.5 + 0.5 * Math.sin(elapsed * 1.4));
        waterFill.scale.y = fillWave;
        waterFill.position.y = 0.36 + 0.45 * fillWave;
        uvCore.material.emissiveIntensity = 1.1 + Math.sin(elapsed * 4.5) * 0.55;
        pumpRotor.rotation.z = elapsed * 4.2;
      },
    };
  }

  if (id === 'water_collector') {
    const tripod = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.85, 10), darkFrameMat);
      leg.position.set(Math.cos(ang) * 0.72, 0.85, Math.sin(ang) * 0.72);
      leg.rotation.z = Math.cos(ang) * 0.35;
      leg.rotation.x = -Math.sin(ang) * 0.35;
      tripod.add(leg);
    }
    root.add(tripod);

    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 0.85, 22), goldFoilMat);
    bell.position.y = 1.65;
    bell.castShadow = true;
    root.add(bell);

    const augerGroup = new THREE.Group();
    augerGroup.position.y = 1.1;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 1.6, 14), titaniumMat);
    augerGroup.add(shaft);
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 18), titaniumMat);
      blade.rotation.x = Math.PI * 0.42;
      blade.position.y = -0.6 + i * 0.25;
      augerGroup.add(blade);
    }
    root.add(augerGroup);

    const heatCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.045, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.4 })
    );
    heatCollar.rotation.x = Math.PI / 2;
    heatCollar.position.y = 0.28;
    root.add(heatCollar);

    return {
      group: root,
      update: (elapsed) => {
        augerGroup.rotation.y = elapsed * 5.2;
        augerGroup.position.y = 1.05 + Math.sin(elapsed * 1.4) * 0.22;
        heatCollar.material.emissiveIntensity = 1.0 + Math.sin(elapsed * 3.5) * 0.6;
      },
    };
  }

  if (id === 'oxygen_generator') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 1.5), darkFrameMat);
    base.position.y = 0.12;
    root.add(base);

    for (const sx of [-0.62, 0.62]) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.8, 12, 20), titaniumMat);
      tank.position.set(sx, 0.98, 0);
      tank.castShadow = true;
      root.add(tank);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.032, 10, 24), emeraldGlowMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(sx, 1.15, 0);
      root.add(band);
    }

    const coreHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.15, 20), darkFrameMat);
    coreHousing.position.set(0, 0.92, 0);
    root.add(coreHousing);

    const turbine = new THREE.Group();
    turbine.position.set(0, 1.68, 0);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.14), goldFoilMat);
      blade.rotation.y = (i * Math.PI) / 4;
      turbine.add(blade);
    }
    root.add(turbine);

    const o2Ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 24), cyanGlowMat);
    o2Ring.rotation.x = Math.PI / 2;
    o2Ring.position.set(0, 0.95, 0);
    root.add(o2Ring);

    return {
      group: root,
      update: (elapsed) => {
        turbine.rotation.y = elapsed * 4.5;
        o2Ring.position.y = 0.55 + ((elapsed * 0.65) % 1) * 0.95;
        o2Ring.scale.setScalar(0.85 + Math.sin(elapsed * 3) * 0.15);
      },
    };
  }

  if (id === 'exploration_rover') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 1.18), goldFoilMat);
    chassis.position.y = 0.68;
    chassis.castShadow = true;
    root.add(chassis);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.08), solarMat);
    deck.position.y = 0.92;
    root.add(deck);

    const wheels: THREE.Group[] = [];
    for (const wz of [-0.66, 0.66]) {
      for (const wx of [-0.72, 0, 0.72]) {
        const wGroup = new THREE.Group();
        wGroup.position.set(wx, 0.28, wz);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 18), darkFrameMat);
        tire.rotation.x = Math.PI / 2;
        wGroup.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 12), titaniumMat);
        hub.rotation.x = Math.PI / 2;
        wGroup.add(hub);
        root.add(wGroup);
        wheels.push(wGroup);
      }
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.85, 12), titaniumMat);
    mast.position.set(0.55, 1.32, 0);
    root.add(mast);

    const mastHead = new THREE.Group();
    mastHead.position.set(0.55, 1.76, 0);
    const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.36), titaniumMat);
    mastHead.add(camBox);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14), cyanGlowMat);
    eye.rotation.z = Math.PI / 2;
    eye.position.set(0.16, 0, 0);
    mastHead.add(eye);
    root.add(mastHead);

    const armPivot = new THREE.Group();
    armPivot.position.set(-0.78, 0.72, 0);
    const armSeg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.09, 0.09), titaniumMat);
    armSeg.position.set(-0.35, 0.12, 0);
    armPivot.add(armSeg);
    root.add(armPivot);

    return {
      group: root,
      update: (elapsed) => {
        wheels.forEach((w) => {
          w.rotation.z = -elapsed * 2.8;
        });
        mastHead.rotation.y = Math.sin(elapsed * 1.1) * 0.9;
        armPivot.rotation.z = Math.sin(elapsed * 1.6) * 0.38;
        chassis.position.y = 0.68 + Math.sin(elapsed * 4.2) * 0.025;
      },
    };
  }

  if (id === 'comms_array') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.35, 22), darkFrameMat);
    base.position.y = 0.175;
    root.add(base);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.1, 16), titaniumMat);
    pedestal.position.y = 0.88;
    root.add(pedestal);

    const dishPivot = new THREE.Group();
    dishPivot.position.set(0, 1.48, 0);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.42),
      titaniumMat
    );
    dish.rotation.x = Math.PI * 0.68;
    dishPivot.add(dish);

    const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.55, 14), goldFoilMat);
    feedHorn.position.set(0, 0.45, 0.52);
    feedHorn.rotation.x = Math.PI * 0.32;
    dishPivot.add(feedHorn);

    const pulseRings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 10, 28), cyanGlowMat);
      r.position.set(0, 0.65, 0.85);
      r.rotation.x = Math.PI * 0.18;
      dishPivot.add(r);
      pulseRings.push(r);
    }

    root.add(dishPivot);

    return {
      group: root,
      update: (elapsed) => {
        dishPivot.rotation.y = Math.sin(elapsed * 0.8) * 0.65;
        dishPivot.rotation.x = Math.cos(elapsed * 0.6) * 0.15;
        pulseRings.forEach((ring, idx) => {
          const p = (elapsed * 0.9 + idx / pulseRings.length) % 1;
          ring.position.z = 0.72 + p * 1.4;
          ring.position.y = 0.55 + p * 0.75;
          ring.scale.setScalar(0.6 + p * 1.5);
        });
      },
    };
  }

  // science_spectrometer
  const labDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.24, 24), darkFrameMat);
  labDeck.position.y = 0.12;
  root.add(labDeck);

  const carousel = new THREE.Group();
  carousel.position.y = 0.35;
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 24), titaniumMat);
  carousel.add(platter);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 14), goldFoilMat);
    cup.position.set(Math.cos(a) * 0.48, 0.14, Math.sin(a) * 0.48);
    carousel.add(cup);
  }
  root.add(carousel);

  const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 0.24), titaniumMat);
  gantry.position.set(-0.78, 1.0, 0);
  root.add(gantry);

  const opticsHead = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.44), darkFrameMat);
  opticsHead.position.set(-0.22, 1.62, 0);
  root.add(opticsHead);

  const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 12), emeraldGlowMat);
  laserBeam.position.set(0.48, 0.98, 0);
  root.add(laserBeam);

  return {
    group: root,
    update: (elapsed) => {
      carousel.rotation.y = elapsed * 0.85;
      const pulse = 0.65 + 0.55 * Math.sin(elapsed * 8.0);
      laserBeam.scale.set(pulse, 1, pulse);
    },
  };
}

export default function EquipmentShowcase3D({
  equipmentId,
  cameraAngle = 'iso',
  replayTrigger = 0,
}: EquipmentShowcase3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const equipmentIdRef = useRef<EquipmentId>(equipmentId);
  equipmentIdRef.current = equipmentId;

  const angleRef = useRef<EquipmentCameraAngle>(cameraAngle);
  const userInteractedRef = useRef(false);
  const syncModelRef = useRef<((id: EquipmentId) => void) | null>(null);
  const replayDeployRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    angleRef.current = cameraAngle;
    userInteractedRef.current = false;
  }, [cameraAngle]);

  useEffect(() => {
    syncModelRef.current?.(equipmentId);
    userInteractedRef.current = false;
  }, [equipmentId]);

  useEffect(() => {
    if (replayTrigger > 0) {
      replayDeployRef.current?.();
    }
  }, [replayTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 640) / (container.clientHeight || 480),
      0.15,
      80
    );
    camera.position.set(3.9, 2.7, 4.3);

    const pipeline = createAAARenderPipeline(container, scene, camera, {
      bloomStrength: 0.28,
      bloomRadius: 0.42,
      bloomThreshold: 0.85,
      exposure: 1.15,
    });
    const { renderer, isSoftwareGl } = pipeline;

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xe0f2fe, 2.8, 4.5, 2.8);
      softbox.position.set(3.5, 4.2, 3.5);
      softbox.lookAt(0, 1.1, 0);
      scene.add(softbox);
    }

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const hemi = new THREE.HemisphereLight(0x94a3b8, 0x0f172a, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    keyLight.position.set(5, 7, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    // Calibration Turntable Grid Ring
    const floorRing = new THREE.Mesh(
      new THREE.RingGeometry(1.85, 1.92, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      })
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.005;
    scene.add(floorRing);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.4;
    controls.maxDistance = 9.5;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 1.15, 0);
    controls.addEventListener('start', () => {
      userInteractedRef.current = true;
    });

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const shadowTex = createContactShadowTexture();
    const solarTex = createSolarGridTexture(maxAnisotropy);

    const holder = new THREE.Group();
    scene.add(holder);

    let activeRig: ReturnType<typeof buildEquipmentRig> | null = null;
    let deployTime = 0;

    const mountModel = (id: EquipmentId) => {
      if (activeRig) {
        holder.remove(activeRig.group);
        activeRig.group.traverse((obj) => {
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
      }
      activeRig = buildEquipmentRig(id, shadowTex, solarTex, isSoftwareGl);
      holder.add(activeRig.group);
      deployTime = 0;
    };

    syncModelRef.current = mountModel;
    replayDeployRef.current = () => {
      deployTime = 0;
    };
    mountModel(equipmentIdRef.current);

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
      deployTime += dt;

      activeRig?.update(elapsed, deployTime, dt);

      if (!userInteractedRef.current) {
        const preset = ANGLE_PRESETS[angleRef.current];
        _desiredCamPos.set(...preset.pos);
        _desiredTarget.set(...preset.target);
        const alpha = 1 - Math.exp(-5.0 * dt);
        camera.position.lerp(_desiredCamPos, alpha);
        controls.target.lerp(_desiredTarget, alpha);
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
      pipeline.resize(container.clientWidth || 640, container.clientHeight || 480, camera);
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
      solarTex.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      pipeline.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}
