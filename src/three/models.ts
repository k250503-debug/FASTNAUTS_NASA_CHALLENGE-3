import * as THREE from 'three';
import type { AstronautProfile, BuildingTypeId, SuitPartId } from '../types';

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.24)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSolarGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#0c2342');
  grad.addColorStop(0.5, '#133a6b');
  grad.addColorStop(1, '#091a33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Fine photovoltaic wafer grid
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Primary silver busbars
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMicroSuitTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 1;
  for (let y = 0; y < 128; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  for (let x = 0; x < 128; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

let _sharedSuitBump: THREE.CanvasTexture | null = null;
function getSuitBumpTexture(): THREE.CanvasTexture {
  if (!_sharedSuitBump) {
    _sharedSuitBump = createMicroSuitTexture();
  }
  return _sharedSuitBump;
}

function addContactShadow(
  group: THREE.Group,
  radius: number,
  shadowTex: THREE.CanvasTexture
) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.62,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.y = 0.02;
  group.add(plane);
}

/**
 * High-Detail Sculpted PBR Astronaut Group (pivot at bottom-center y=0)
 */
export function createAstronautMesh(
  profile: AstronautProfile,
  shadowTex: THREE.CanvasTexture,
  includeHitCylinder = true
): THREE.Group {
  const root = new THREE.Group();
  root.userData.astronautId = profile.id;

  addContactShadow(root, 0.76, shadowTex);

  const suitBump = getSuitBumpTexture();

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.62,
    metalness: 0.08,
    bumpMap: suitBump,
    bumpScale: 0.015,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.78,
    metalness: 0.22,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: profile.accentHex,
    roughness: 0.32,
    metalness: 0.42,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.86,
    metalness: 0.18,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xb45309,
    emissiveIntensity: 0.14,
    roughness: 0.08,
    metalness: 0.94,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    iridescence: 0.45,
    iridescenceIOR: 1.35,
  });
  const packMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.38,
    metalness: 0.45,
  });
  const chestDisplayMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: profile.accentHex,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.65,
  });

  const tagPart = (obj: THREE.Object3D, part: SuitPartId) => {
    obj.userData.suitPart = part;
    obj.userData.astronautId = profile.id;
  };

  // Active Selection Ring at feet
  const ringGeo = new THREE.RingGeometry(0.56, 0.74, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: profile.accentHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.position.y = 0.03;
  selectionRing.visible = false;
  root.add(selectionRing);

  // Articulated Sculpted Legs (hip pivot at y = 0.74)
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.74, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.24, 8, 16), suitMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    tagPart(thigh, 'boots');
    legPivot.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.098, 14, 12), jointMat);
    kneePad.position.set(0, -0.35, 0.03);
    kneePad.castShadow = true;
    tagPart(kneePad, 'boots');
    legPivot.add(kneePad);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.24, 16), suitMat);
    shin.position.y = -0.5;
    shin.castShadow = true;
    tagPart(shin, 'boots');
    legPivot.add(shin);

    // Sculpted Rounded EVA Boot + Sole
    const bootUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.14, 8, 14), bootMat);
    bootUpper.rotation.x = Math.PI / 2;
    bootUpper.position.set(0, -0.64, 0.04);
    bootUpper.castShadow = true;
    tagPart(bootUpper, 'boots');
    legPivot.add(bootUpper);

    const bootTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.102, 0.045, 16), trimMat);
    bootTrim.position.set(0, -0.59, 0);
    tagPart(bootTrim, 'boots');
    legPivot.add(bootTrim);

    root.add(legPivot);
    return legPivot;
  };

  const leftLeg = makeLeg(-0.155);
  const rightLeg = makeLeg(0.155);

  // Sculpted Pressurized Torso (smooth capsule + waist ring + shoulder yoke)
  const torsoCore = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.28, 12, 24), suitMat);
  torsoCore.scale.set(1.12, 1.0, 0.78);
  torsoCore.position.y = 1.03;
  torsoCore.castShadow = true;
  tagPart(torsoCore, 'chest_pack');
  root.add(torsoCore);

  const waistRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.042, 12, 28), jointMat);
  waistRing.rotation.x = Math.PI / 2;
  waistRing.scale.set(1.12, 0.82, 1);
  waistRing.position.y = 0.79;
  tagPart(waistTrimPlaceholder(waistRing), 'chest_pack');
  root.add(waistRing);

  const accentBelt = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.032, 12, 28), trimMat);
  accentBelt.rotation.x = Math.PI / 2;
  accentBelt.scale.set(1.14, 0.84, 1);
  accentBelt.position.y = 1.15;
  tagPart(accentBelt, 'chest_pack');
  root.add(accentBelt);

  // Chest Telemetry Display Unit
  const chestFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.07, 18), jointMat);
  chestFrame.rotation.x = Math.PI / 2;
  chestFrame.position.set(0, 1.07, 0.185);
  tagPart(chestFrame, 'chest_pack');
  root.add(chestFrame);

  const chestScreen = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.04), chestDisplayMat);
  chestScreen.position.set(0, 1.07, 0.205);
  tagPart(chestScreen, 'chest_pack');
  root.add(chestScreen);

  // Sculpted PLSS Life Support Backpack (Twin O2 Tanks + Radiator Shroud + Beacon)
  const packShell = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.26, 10, 20), packMat);
  packShell.scale.set(1.18, 1.0, 0.62);
  packShell.position.set(0, 1.09, -0.25);
  packShell.castShadow = true;
  tagPart(packShell, 'plss_backpack');
  root.add(packShell);

  for (const ox of [-0.11, 0.11]) {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.24, 8, 14), trimMat);
    tank.position.set(ox, 1.07, -0.34);
    tank.castShadow = true;
    tagPart(tank, 'plss_backpack');
    root.add(tank);
  }

  const beaconMat = new THREE.MeshStandardMaterial({
    color: profile.accentHex,
    emissive: profile.accentHex,
    emissiveIntensity: 1.05,
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 14), beaconMat);
  beacon.position.set(0.15, 1.4, -0.27);
  tagPart(beacon, 'plss_backpack');
  root.add(beacon);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.42, 10), bootMat);
  antenna.position.set(-0.15, 1.54, -0.27);
  tagPart(antenna, 'plss_backpack');
  root.add(antenna);

  // Articulated Sculpted Arms (shoulder pivot at y = 1.28)
  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.28, 0);

    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), suitMat);
    pauldron.castShadow = true;
    tagPart(pauldron, 'arms_tools');
    armPivot.add(pauldron);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 8, 14), suitMat);
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    tagPart(upperArm, 'arms_tools');
    armPivot.add(upperArm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), jointMat);
    elbow.position.y = -0.28;
    tagPart(elbow, 'arms_tools');
    armPivot.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.2, 14), suitMat);
    forearm.position.y = -0.39;
    forearm.castShadow = true;
    tagPart(forearm, 'arms_tools');
    armPivot.add(forearm);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.045, 14), jointMat);
    cuff.position.y = -0.49;
    tagPart(cuff, 'arms_tools');
    armPivot.add(cuff);

    const glove = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.055, 8, 12), trimMat);
    glove.position.y = -0.55;
    tagPart(glove, 'arms_tools');
    armPivot.add(glove);

    root.add(armPivot);
    return armPivot;
  };

  const leftArm = makeArm(-0.34);
  const rightArm = makeArm(0.34);

  // Neck-pivoted Sculpted Helmet + Domed Gold Reflective Visor + Dual LED Headlamps
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.4, 0);

  const neckCollar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.036, 12, 28), jointMat);
  neckCollar.rotation.x = Math.PI / 2;
  neckCollar.position.y = 0.02;
  tagPart(neckCollar, 'helmet');
  headPivot.add(neckCollar);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 22), suitMat);
  helmet.position.set(0, 0.16, 0);
  helmet.castShadow = true;
  tagPart(helmet, 'helmet');
  headPivot.add(helmet);

  // Curved Panoramic Gold EVA Visor Shield
  const visorShield = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.245,
      24,
      18,
      Math.PI * 0.16,
      Math.PI * 0.68,
      Math.PI * 0.28,
      Math.PI * 0.38
    ),
    visorMat
  );
  visorShield.position.set(0, 0.16, 0.032);
  tagPart(visorShield, 'helmet');
  headPivot.add(visorShield);

  // Dual Helmet Headlamp Pods
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xbae6fd,
    emissiveIntensity: 1.2,
  });
  for (const lx of [-0.24, 0.24]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.09, 10), jointMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(lx, 0.18, 0.04);
    tagPart(pod, 'helmet');
    headPivot.add(pod);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 10), lampMat);
    lens.position.set(lx, 0.18, 0.088);
    tagPart(lens, 'helmet');
    headPivot.add(lens);
  }

  root.add(headPivot);

  // Optional Invisible Raycast Hit Cylinder for base-wide outpost picking
  if (includeHitCylinder) {
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 2.0, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.y = 1.0;
    hitMesh.userData.astronautId = profile.id;
    root.add(hitMesh);
  }

  root.userData.animRefs = {
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headPivot,
    selectionRing,
    beaconMat,
    visorMat,
    chestDisplayMat,
  };

  return root;
}

function waistTrimPlaceholder<T extends THREE.Object3D>(obj: T): T {
  return obj;
}

/**
 * Multi-Part High-Detail Outpost Buildings (pivot at bottom-center y=0)
 */
export function createBuildingMesh(
  typeId: BuildingTypeId,
  level: number,
  online: boolean,
  shadowTex: THREE.CanvasTexture,
  solarTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, 1.85, shadowTex);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.36,
    metalness: 0.38,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.48,
    metalness: 0.72,
  });
  const trimGold = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.22,
    metalness: 0.88,
  });
  const statusMat = new THREE.MeshStandardMaterial({
    color: online ? 0x10b981 : 0xf59e0b,
    emissive: online ? 0x10b981 : 0xf59e0b,
    emissiveIntensity: 0.95,
  });

  // Base platform skirt + anchor bolts
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.72, 0.22, 32), darkMetal);
  base.position.y = 0.11;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.055, 10, 32), trimGold);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = 0.22;
  group.add(baseRim);

  if (typeId === 'habitat') {
    const cyl = new THREE.Mesh(new THREE.CapsuleGeometry(0.92, 1.55, 14, 32), hullMat);
    cyl.rotation.z = Math.PI / 2;
    cyl.position.y = 1.06;
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    group.add(cyl);

    // Structural pressure ribs
    for (const rx of [-0.65, 0, 0.65]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 10, 28), darkMetal);
      rib.rotation.y = Math.PI / 2;
      rib.position.set(rx, 1.06, 0);
      group.add(rib);
    }

    const airlock = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.6, 0.85, 20), darkMetal);
    airlock.rotation.z = Math.PI / 2;
    airlock.position.set(1.38, 0.82, 0);
    airlock.castShadow = true;
    group.add(airlock);

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: online ? 1.05 : 0.2,
      roughness: 0.15,
      metalness: 0.5,
    });
    for (const wx of [-0.34, 0.34]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 20), darkMetal);
      frame.position.set(wx, 1.15, 0.91);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), windowMat);
      glass.position.set(wx, 1.15, 0.925);
      group.add(frame, glass);
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.15, 12), darkMetal);
    mast.position.set(-0.75, 2.25, 0);
    group.add(mast);
  } else if (typeId === 'solar') {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 1.38, 20), darkMetal);
    pylon.position.y = 0.78;
    pylon.castShadow = true;
    group.add(pylon);

    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), trimGold);
    gimbal.position.y = 1.48;
    group.add(gimbal);

    const panelMat = new THREE.MeshPhysicalMaterial({
      map: solarTex,
      roughness: 0.16,
      metalness: 0.72,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.09, 1.56), darkMetal);
    frameMesh.position.y = 1.58;
    frameMesh.rotation.x = 0.35;
    frameMesh.castShadow = true;
    group.add(frameMesh);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.04, 1.42), panelMat);
    wing.position.set(0, 1.62, 0.02);
    wing.rotation.x = 0.35;
    wing.castShadow = true;
    group.add(wing);
  } else if (typeId === 'battery') {
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.6,
    });
    for (let i = -1; i <= 1; i += 2) {
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 1.38, 20), darkMetal);
      cell.position.set(i * 0.56, 0.88, 0);
      cell.castShadow = true;
      group.add(cell);

      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.24, 20), cellMat);
      band.position.set(i * 0.56, 1.15, 0);
      group.add(band);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullMat);
      cap.position.set(i * 0.56, 1.57, 0);
      group.add(cap);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.22), trimGold);
    bridge.position.y = 1.48;
    group.add(bridge);
  } else if (typeId === 'water_recycler') {
    const tankMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      roughness: 0.22,
      metalness: 0.55,
      clearcoat: 0.7,
    });
    const tank1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 1.15, 10, 24), tankMat);
    tank1.position.set(-0.52, 1.12, 0);
    tank1.castShadow = true;
    const tank2 = tank1.clone();
    tank2.position.set(0.52, 1.12, 0);
    group.add(tank1, tank2);

    const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.085, 12, 24, Math.PI), darkMetal);
    pipe.position.set(0, 1.88, 0);
    group.add(pipe);
  } else if (typeId === 'greenhouse') {
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(1.26, 1.3, 0.26, 28),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.82 })
    );
    soil.position.y = 0.34;
    group.add(soil);

    // Interior lush crop rows
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 });
    for (let px = -0.65; px <= 0.65; px += 0.43) {
      const row = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.85, 6, 10), plantMat);
      row.rotation.x = Math.PI / 2;
      row.position.set(px, 0.55, 0);
      group.add(row);
    }

    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.34,
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 1.0,
      depthWrite: false,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.38, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      domeMat
    );
    dome.position.y = 0.22;
    dome.renderOrder = 2;
    group.add(dome);

    // Geodesic rib arches
    for (let a = 0; a < 3; a++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.39, 0.032, 8, 32, Math.PI), darkMetal);
      arch.rotation.y = (a * Math.PI) / 3;
      arch.position.y = 0.22;
      group.add(arch);
    }
  } else if (typeId === 'isru_plant') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.08, 0.24, 24), darkMetal);
    crown.position.y = 1.92;
    group.add(crown);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.85, 12), darkMetal);
      leg.position.set(Math.cos(a) * 0.85, 1.0, Math.sin(a) * 0.85);
      leg.castShadow = true;
      group.add(leg);
    }

    const auger = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 1.65, 18),
      trimGold
    );
    auger.rotation.x = Math.PI;
    auger.position.y = 1.05;
    auger.castShadow = true;
    group.add(auger);
  } else if (typeId === 'radiation_shelter') {
    const bunkerMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.82,
      metalness: 0.3,
    });
    const bunker = new THREE.Mesh(
      new THREE.SphereGeometry(1.32, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
      bunkerMat
    );
    bunker.position.y = 0.22;
    bunker.castShadow = true;
    group.add(bunker);

    const hatchFrame = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 10, 20), trimGold);
    hatchFrame.position.set(0, 0.72, 1.15);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 20), darkMetal);
    door.rotation.x = Math.PI / 2;
    door.position.set(0, 0.72, 1.12);
    group.add(hatchFrame, door);
  } else if (typeId === 'comms') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.36, 2.25, 16), darkMetal);
    tower.position.y = 1.25;
    tower.castShadow = true;
    group.add(tower);

    const dishPts = [
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(0.45, 0.1),
      new THREE.Vector2(0.82, 0.3),
      new THREE.Vector2(1.06, 0.56),
    ];
    const dish = new THREE.Mesh(
      new THREE.LatheGeometry(dishPts, 32),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.22,
        metalness: 0.65,
        side: THREE.DoubleSide,
      })
    );
    dish.position.set(0, 2.45, 0.15);
    dish.rotation.x = Math.PI * 0.32;
    group.add(dish);

    const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.72, 12), trimGold);
    feedHorn.position.set(0, 2.68, 0.52);
    feedHorn.rotation.x = Math.PI * 0.32;
    group.add(feedHorn);
  }

  // Level Status Beacon
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 14), statusMat);
  beacon.position.set(0, 2.65 + (level - 1) * 0.15, 0);
  group.add(beacon);

  return group;
}

/**
 * High-Detail Interactive Storm Flue Vent Station
 */
export function createStormFlueMesh(shadowTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, 1.65, shadowTex);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.42,
    metalness: 0.76,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.34,
    metalness: 0.38,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.56, 0.34, 28), steelMat);
  plinth.position.y = 0.17;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.02, 1.32, 28), steelMat);
  manifold.position.y = 0.96;
  manifold.castShadow = true;
  group.add(manifold);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.1, 12, 32), hazardMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.56;
  group.add(collar);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 2.1, 28), steelMat);
  stack.position.y = 2.56;
  stack.castShadow = true;
  group.add(stack);

  // Flared cowl lip at top
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.065, 10, 28), hazardMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 3.6;
  group.add(lip);

  // Rotating exhaust turbine inside top of flue
  const fanGroup = new THREE.Group();
  fanGroup.position.y = 3.55;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.16), hazardMat);
    blade.rotation.y = (i * Math.PI) / 4;
    fanGroup.add(blade);
  }
  group.add(fanGroup);

  // Pressure gauge housing on front
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.15, 24), hazardMat);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0, 1.15, 0.96);
  group.add(gauge);

  // Status beacon
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.05,
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), beaconMat);
  beacon.position.set(0.86, 1.9, 0.65);
  group.add(beacon);

  group.userData.stormFlueRefs = { fanGroup, beaconMat };
  return group;
}

/**
 * Detailed Planetary Data Collection Node
 */
export function createDataNodeMesh(
  collected: boolean,
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, 1.05, shadowTex);

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.78,
    metalness: 0.15,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.78,
  });

  // Sculpted crystalline mineral rock (Icosahedron subdivision 2)
  const rockGeo = new THREE.IcosahedronGeometry(0.5, 2);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const n = 1 + 0.18 * Math.sin(vx * 5 + vy * 3) * Math.cos(vz * 4);
    rPos.setXYZ(i, vx * n, vy * n * 0.85, vz * n);
  }
  rockGeo.computeVertexNormals();
  const sampleRock = new THREE.Mesh(rockGeo, rockMat);
  sampleRock.position.set(-0.24, 0.35, 0);
  sampleRock.castShadow = true;
  group.add(sampleRock);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 1.48, 16), metalMat);
  mast.position.set(0.25, 0.74, 0);
  mast.castShadow = true;
  group.add(mast);

  const ringMat = new THREE.MeshStandardMaterial({
    color: collected ? 0x10b981 : 0x38bdf8,
    emissive: collected ? 0x10b981 : 0x0ea5e9,
    emissiveIntensity: collected ? 0.55 : 1.15,
    roughness: 0.18,
    metalness: 0.55,
  });
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 14, 32), ringMat);
  scanRing.position.set(0.25, 1.56, 0);
  group.add(scanRing);

  group.userData.nodeRefs = { scanRing, ringMat };
  return group;
}

/**
 * 6-Wheel NASA ISRU Rover with Suspension Struts
 */
export function createRoverMesh(shadowTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, 1.2, shadowTex);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.34,
    metalness: 0.45,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
  });

  const chassis = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 8, 16), bodyMat);
  chassis.rotation.x = Math.PI / 2;
  chassis.scale.set(1.25, 1.0, 0.55);
  chassis.position.y = 0.54;
  chassis.castShadow = true;
  group.add(chassis);

  const goldFoil = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 0.84), goldMat);
  goldFoil.position.set(0, 0.78, -0.18);
  group.add(goldFoil);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.68, 12), bodyMat);
  mast.position.set(0, 1.04, 0.55);
  group.add(mast);

  const camHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 6, 12), goldMat);
  camHead.rotation.z = Math.PI / 2;
  camHead.position.set(0, 1.4, 0.58);
  group.add(camHead);

  for (const sx of [-0.64, 0.64]) {
    for (const sz of [-0.58, 0, 0.58]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 22), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.24, sz);
      wheel.castShadow = true;
      group.add(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 14), goldMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx, 0.24, sz);
      group.add(hub);
    }
  }

  return group;
}

/**
 * Procedural High-Resolution Pakistan Flag CanvasTexture (sRGB)
 */
export function createPakistanFlagTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const w = 512;
  const h = 340;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w * 0.25, h);

  ctx.fillStyle = '#01411C';
  ctx.fillRect(w * 0.25, 0, w * 0.75, h);

  const cx = w * 0.625;
  const cy = h * 0.5;
  const outerR = h * 0.295;
  const innerR = h * 0.24;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  const offsetAngle = -Math.PI * 0.22;
  const offsetDist = h * 0.088;
  ctx.beginPath();
  ctx.arc(
    cx + Math.cos(offsetAngle) * offsetDist,
    cy + Math.sin(offsetAngle) * offsetDist,
    innerR,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = '#01411C';
  ctx.fill();
  ctx.restore();

  const starCx = cx + Math.cos(offsetAngle) * (h * 0.125);
  const starCy = cy + Math.sin(offsetAngle) * (h * 0.125);
  const starOuter = h * 0.095;
  const starInner = h * 0.038;
  ctx.save();
  ctx.translate(starCx, starCy);
  ctx.rotate(offsetAngle + Math.PI / 10);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? starOuter : starInner;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Standalone Planted Pakistan Flag Assembly (for Commander Flag-Planting Animation)
 */
export function createPlantedFlagMesh(
  shadowTex: THREE.CanvasTexture,
  maxAnisotropy = 4
): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, 0.7, shadowTex);

  const flagTex = createPakistanFlagTexture(maxAnisotropy);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.85,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.2,
    metalness: 0.9,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.5,
    metalness: 0.72,
  });

  const basePad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.14, 18), baseMat);
  basePad.position.y = 0.07;
  group.add(basePad);

  const flagpole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 2.75, 14), poleMat);
  flagpole.position.y = 1.42;
  flagpole.castShadow = true;
  group.add(flagpole);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), goldMat);
  finial.position.y = 2.82;
  group.add(finial);

  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.32, 10), poleMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0.66, 2.68, 0);

  const flagGeo = new THREE.PlaneGeometry(1.32, 0.86, 18, 8);
  const posAttr = flagGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const normalizedX = (vx + 0.66) / 1.32;
    posAttr.setZ(i, Math.sin(normalizedX * Math.PI * 2.5) * 0.06 * normalizedX);
  }
  flagGeo.computeVertexNormals();

  const clothFlagMat = new THREE.MeshStandardMaterial({
    map: flagTex,
    roughness: 0.58,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const mastFlag = new THREE.Mesh(flagGeo, clothFlagMat);
  mastFlag.position.set(0.66, -0.44, 0);
  mastFlag.castShadow = true;

  const flagPivot = new THREE.Group();
  flagPivot.position.set(0.03, 2.68, 0);
  flagPivot.add(crossbar);
  flagPivot.add(mastFlag);
  group.add(flagPivot);

  group.userData.plantedFlagRefs = { flagPivot, basePad };
  return group;
}

/**
 * Procedural NASA Hull Markings Texture (sRGB)
 */
export function createNasaHullTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 1024; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  ctx.fillStyle = '#0B3D91';
  ctx.fillRect(0, 22, 1024, 20);
  ctx.fillStyle = '#FC3D21';
  ctx.fillRect(0, 214, 1024, 14);

  const drawInsignia = (cx: number) => {
    ctx.fillStyle = '#0B3D91';
    ctx.beginPath();
    ctx.arc(cx - 88, 128, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FC3D21';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 126, 148);
    ctx.lineTo(cx - 82, 92);
    ctx.lineTo(cx - 50, 144);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx - 88, 128, 48, 16, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NASA', cx - 88, 129);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ASTRA', cx - 28, 114);
    ctx.fillStyle = '#01411C';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PAKISTAN · EXPEDITION', cx - 28, 152);
  };

  drawInsignia(256);
  drawInsignia(768);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * High-Detail Cinematic NASA Spaceship Lander with Pakistan Flag (pivot at bottom-center y=0)
 */
export function createNasaSpaceshipMesh(
  shadowTex: THREE.CanvasTexture,
  maxAnisotropy = 4
): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, 3.3, shadowTex);

  const flagTex = createPakistanFlagTexture(maxAnisotropy);
  const hullMarkingsTex = createNasaHullTexture(maxAnisotropy);

  const whiteHullMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.25,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  });
  const hullBannerMat = new THREE.MeshStandardMaterial({
    map: hullMarkingsTex,
    roughness: 0.3,
    metalness: 0.3,
  });
  const darkTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.42,
    metalness: 0.78,
  });
  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.2,
    metalness: 0.9,
  });
  const nasaBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0b3d91,
    roughness: 0.32,
    metalness: 0.35,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.1,
    metalness: 0.85,
    clearcoat: 1.0,
  });
  const engineGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.15,
    roughness: 0.28,
  });

  // 1. Central Parabolic Engine Bell (LatheGeometry, 36 segs)
  const bellPts = [
    new THREE.Vector2(0.22, 1.05),
    new THREE.Vector2(0.35, 0.82),
    new THREE.Vector2(0.55, 0.52),
    new THREE.Vector2(0.68, 0.25),
  ];
  const engineBell = new THREE.Mesh(
    new THREE.LatheGeometry(bellPts, 36),
    darkTitaniumMat
  );
  engineBell.castShadow = true;
  group.add(engineBell);

  const coreGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.42, 0.14, 24),
    engineGlowMat
  );
  coreGlow.position.y = 0.55;
  group.add(coreGlow);

  // 2. 4 Grounded Landing Legs + Wide Circular Footpads (flush at y=0)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.12, 22),
      darkTitaniumMat
    );
    pad.position.set(cos * 2.25, 0.06, sin * 2.25);
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);

    const mainStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.85, 14),
      darkTitaniumMat
    );
    mainStrut.position.set(cos * 1.72, 0.78, sin * 1.72);
    mainStrut.lookAt(cos * 1.1, 1.55, sin * 1.1);
    mainStrut.rotateX(Math.PI / 2);
    mainStrut.castShadow = true;
    group.add(mainStrut);

    const damper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.25, 12),
      goldFoilMat
    );
    damper.position.set(cos * 1.65, 1.05, sin * 1.65);
    damper.lookAt(cos * 2.25, 0.12, sin * 2.25);
    damper.rotateX(Math.PI / 2);
    group.add(damper);
  }

  // 3. Gold Kapton MLI Descent Stage (16 segments + structural rim)
  const descentStage = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.66, 1.12, 16),
    goldFoilMat
  );
  descentStage.position.y = 1.48;
  descentStage.castShadow = true;
  descentStage.receiveShadow = true;
  group.add(descentStage);

  const collarRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.52, 0.11, 14, 36),
    darkTitaniumMat
  );
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.y = 2.05;
  group.add(collarRing);

  // 4. Primary White Crew / Ascent Fuselage with NASA Markings (36 segments)
  const crewCabin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.42, 1.65, 36),
    hullBannerMat
  );
  crewCabin.position.y = 2.88;
  crewCabin.castShadow = true;
  crewCabin.receiveShadow = true;
  group.add(crewCabin);

  // 5. Tapered Nose Cone & Docking Adapter Cap (36 segments)
  const noseCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.28, 1.25, 36),
    whiteHullMat
  );
  noseCone.position.y = 4.32;
  noseCone.castShadow = true;
  group.add(noseCone);

  const dockingCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.24, 28),
    nasaBlueMat
  );
  dockingCap.position.y = 5.05;
  group.add(dockingCap);

  // 6. Forward Cockpit Visor Window + Boarding Airlock Hatch
  const cockpitFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.42, 0.24),
    darkTitaniumMat
  );
  cockpitFrame.position.set(0, 3.82, 1.05);
  cockpitFrame.rotation.x = -0.35;
  group.add(cockpitFrame);

  const cockpitGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.28, 0.08),
    visorMat
  );
  cockpitGlass.position.set(0, 3.84, 1.15);
  cockpitGlass.rotation.x = -0.35;
  group.add(cockpitGlass);

  const airlockDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 1.05, 0.14),
    darkTitaniumMat
  );
  airlockDoor.position.set(0, 2.58, 1.32);
  group.add(airlockDoor);

  // 7. 3 Beveled Aero-Fins in NASA Blue
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.68, 0);
  finShape.lineTo(0.18, 1.32);
  finShape.lineTo(0, 1.32);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  finGeo.translate(-0.15, -0.66, -0.04);

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const fin = new THREE.Mesh(finGeo, nasaBlueMat);
    fin.position.set(Math.sin(angle) * 1.4, 2.52, Math.cos(angle) * 1.4);
    fin.rotation.y = angle - Math.PI / 2;
    fin.castShadow = true;
    group.add(fin);
  }

  // 8. Hull-Mounted Pakistan Flag Panels
  const flagHullMat = new THREE.MeshStandardMaterial({
    map: flagTex,
    roughness: 0.42,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const flagFrameMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.35,
    metalness: 0.75,
  });

  for (const side of [-1, 1]) {
    const plaqueGroup = new THREE.Group();
    plaqueGroup.position.set(side * 1.36, 3.05, 0.15);
    plaqueGroup.rotation.y = (side * Math.PI) / 2;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.72, 0.06), flagFrameMat);
    plaqueGroup.add(frame);

    const flagPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.64), flagHullMat);
    flagPlate.position.z = 0.036;
    plaqueGroup.add(flagPlate);

    group.add(plaqueGroup);
  }

  // 9. Top Navigation Beacon
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.2,
  });
  const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), beaconMat);
  topBeacon.position.set(0, 5.24, 0);
  group.add(topBeacon);

  group.userData.spaceshipRefs = {
    beaconMat,
    engineGlowMat,
  };

  return group;
}
