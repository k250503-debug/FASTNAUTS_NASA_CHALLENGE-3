import * as THREE from 'three';

function hash2d(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed = 1): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy, seed);
  const b = hash2d(ix + 1, iy, seed);
  const c = hash2d(ix, iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 5, seed = 1): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 19);
    freq *= 2.04;
    amp *= 0.5;
  }
  return val;
}

/**
 * High-resolution procedural Earth textures (Day Albedo, Night City Lights, Ocean Roughness)
 */
export function createDetailedEarthTextures(maxAnisotropy: number): {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  dispose: () => void;
} {
  const W = 1024;
  const H = 512;

  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = W;
  dayCanvas.height = H;
  const dayCtx = dayCanvas.getContext('2d')!;
  const dayImg = dayCtx.createImageData(W, H);

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = W;
  nightCanvas.height = H;
  const nightCtx = nightCanvas.getContext('2d')!;
  const nightImg = nightCtx.createImageData(W, H);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = W;
  roughCanvas.height = H;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(W, H);

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = W;
  cloudCanvas.height = H;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  const cloudImg = cloudCtx.createImageData(W, H);

  for (let py = 0; py < H; py++) {
    const v = py / H;
    const absLat = Math.abs(v - 0.5) * 2;
    for (let px = 0; px < W; px++) {
      const u = px / W;
      const idx = (py * W + px) * 4;

      // Wrap longitude smoothly via periodic sin/cos mapping for seamless globe wrap
      const lon = u * Math.PI * 2;
      const sx = Math.cos(lon) * 1.9 + 3.2;
      const sz = Math.sin(lon) * 1.9 + 3.2;
      const sy = v * 4.4;

      const cont = fbm(sx + sy * 0.18, sz + sy * 0.92, 5, 11);
      const ridge = fbm(sx * 2.4, sz * 2.4 + sy * 1.8, 4, 29);
      const micro = smoothNoise(u * 38, v * 20, 47);

      const iceLine = 0.84 - ridge * 0.09;
      let r = 12;
      let g = 46;
      let b = 112;
      let rough = 58; // oceans glossy for realistic sun glint
      let cityGlow = 0;

      if (absLat > iceLine) {
        // Polar ice sheets & Greenland/Antarctica
        const shade = 0.9 + micro * 0.1;
        r = 232 * shade;
        g = 242 * shade;
        b = 252 * shade;
        rough = 195;
      } else if (cont > 0.505) {
        const elev = Math.min(1, (cont - 0.505) * 3.1);
        const moisture = fbm(sx * 1.7 + 4.1, sy * 2.1, 3, 63);
        const coast = Math.max(0, 1 - elev * 4.2);

        if (elev > 0.72 && ridge > 0.56) {
          // Snow-capped mountain spines
          r = 212 + micro * 28;
          g = 218 + micro * 26;
          b = 224 + micro * 26;
          rough = 220;
        } else if (moisture < 0.43 && absLat < 0.55) {
          // Sahara / Arabian / Australian arid belts
          r = 172 + elev * 40 + micro * 16;
          g = 138 + elev * 30 + micro * 12;
          b = 86 + elev * 20;
          rough = 232;
        } else {
          // Temperate & tropical forests / plains
          r = 36 + elev * 52 + micro * 12;
          g = 96 + elev * 42 + moisture * 28;
          b = 44 + elev * 24;
          rough = 210;
        }

        // Coastal city clusters (clustered near moderate latitudes and coastlines)
        if (absLat < 0.72 && coast > 0.12) {
          const urbanCluster = smoothNoise(u * 62, v * 34, 91);
          const urbanPin = hash2d(Math.floor(u * 260), Math.floor(v * 130), 107);
          if (urbanCluster > 0.62 && urbanPin > 0.68) {
            cityGlow = Math.min(255, (urbanCluster - 0.62) * 520 + (urbanPin - 0.68) * 380);
          }
        }
      } else {
        // Deep abyssal oceans -> turquoise continental shelves
        const shelf = Math.max(0, (cont - 0.43) / 0.075);
        r = 8 + shelf * 24;
        g = 34 + shelf * 78;
        b = 96 + shelf * 92;
        rough = 48 + shelf * 26;
      }

      dayImg.data[idx] = Math.min(255, Math.max(0, r));
      dayImg.data[idx + 1] = Math.min(255, Math.max(0, g));
      dayImg.data[idx + 2] = Math.min(255, Math.max(0, b));
      dayImg.data[idx + 3] = 255;

      nightImg.data[idx] = Math.min(255, cityGlow * 1.0);
      nightImg.data[idx + 1] = Math.min(255, cityGlow * 0.76);
      nightImg.data[idx + 2] = Math.min(255, cityGlow * 0.36);
      nightImg.data[idx + 3] = 255;

      roughImg.data[idx] = rough;
      roughImg.data[idx + 1] = rough;
      roughImg.data[idx + 2] = rough;
      roughImg.data[idx + 3] = 255;

      // Swirling cyclones & synoptic cloud bands
      const swirl = Math.sin(v * 11 + cont * 4.5) * 0.35;
      const cNoise = fbm(sx * 2.1 + swirl, sz * 2.1 + sy * 1.4, 5, 131);
      const wispy = smoothNoise(u * 26 + swirl * 3, v * 15, 149);
      const cAlpha = Math.max(0, Math.min(255, (cNoise * 0.75 + wispy * 0.25 - 0.45) * 640));
      cloudImg.data[idx] = 248;
      cloudImg.data[idx + 1] = 251;
      cloudImg.data[idx + 2] = 255;
      cloudImg.data[idx + 3] = cAlpha;
    }
  }

  dayCtx.putImageData(dayImg, 0, 0);
  nightCtx.putImageData(nightImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  cloudCtx.putImageData(cloudImg, 0, 0);

  const prepTex = (c: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const dayMap = prepTex(dayCanvas, true);
  const nightMap = prepTex(nightCanvas, true);
  const roughnessMap = prepTex(roughCanvas, false);
  const cloudMap = prepTex(cloudCanvas, true);

  return {
    dayMap,
    nightMap,
    roughnessMap,
    cloudMap,
    dispose: () => {
      dayMap.dispose();
      nightMap.dispose();
      roughnessMap.dispose();
      cloudMap.dispose();
    },
  };
}

/**
 * Realistic Earth Globe with Day/Night Terminator City Lights, Ocean Specular & Rayleigh Scattering Rim
 */
export function createRealisticEarthRig(
  radius: number,
  sunDirWorld: THREE.Vector3,
  maxAnisotropy: number
): {
  group: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudMesh: THREE.Mesh;
  setSunDirection: (dir: THREE.Vector3) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const textures = createDetailedEarthTextures(maxAnisotropy);
  const disposables: Array<{ dispose: () => void }> = [textures];

  const earthGeo = new THREE.SphereGeometry(radius, 64, 48);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: textures.dayMap },
      uNightMap: { value: textures.nightMap },
      uRoughMap: { value: textures.roughnessMap },
      uSunDir: { value: sunDirWorld.clone().normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPosWorld = wp.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform sampler2D uRoughMap;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;

      void main() {
        vec3 N = normalize(vNormalWorld);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vPosWorld);

        float ndotl = dot(N, L);
        float dayMask = smoothstep(-0.14, 0.22, ndotl);
        float twilight = smoothstep(-0.22, 0.04, ndotl) * (1.0 - smoothstep(0.02, 0.24, ndotl));

        vec3 dayCol = texture2D(uDayMap, vUv).rgb;
        vec3 nightCol = texture2D(uNightMap, vUv).rgb;
        float rough = texture2D(uRoughMap, vUv).r;

        // Sunlit ocean specular reflection
        vec3 H = normalize(L + V);
        float specPow = mix(96.0, 12.0, rough);
        float specAmt = mix(0.62, 0.04, rough);
        float spec = pow(max(0.0, dot(N, H)), specPow) * specAmt * smoothstep(0.0, 0.25, ndotl);

        // Rayleigh atmospheric limb scatter on sunlit side
        float fres = pow(1.0 - max(0.0, dot(N, V)), 3.4);
        vec3 rayleigh = mix(vec3(0.18, 0.56, 1.0), vec3(1.0, 0.45, 0.16), twilight * 0.85);

        vec3 litDay = dayCol * (max(0.05, ndotl) * 1.18 + 0.04) + vec3(1.0, 0.96, 0.88) * spec;
        vec3 darkSide = dayCol * 0.03 + nightCol * 1.45;
        vec3 finalCol = mix(darkSide, litDay, dayMask);
        finalCol += rayleigh * fres * (0.12 + 0.65 * smoothstep(-0.25, 0.45, ndotl));

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
    fog: false,
  });

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.rotation.z = 0.41;
  group.add(earthMesh);

  // Volumetric-feel cloud deck slightly above surface
  const cloudGeo = new THREE.SphereGeometry(radius * 1.012, 64, 48);
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      uCloudMap: { value: textures.cloudMap },
      uSunDir: { value: sunDirWorld.clone().normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      void main() {
        vUv = uv;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudMap;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      void main() {
        vec4 c = texture2D(uCloudMap, vUv);
        float ndotl = dot(normalize(vNormalWorld), normalize(uSunDir));
        float lit = smoothstep(-0.18, 0.28, ndotl);
        vec3 col = mix(vec3(0.07, 0.11, 0.2), vec3(0.98, 0.99, 1.0), lit);
        gl_FragColor = vec4(col, c.a * mix(0.28, 0.86, lit));
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.rotation.z = 0.41;
  group.add(cloudMesh);

  // Outer Rayleigh atmospheric glow shell
  const atmoGeo = new THREE.SphereGeometry(radius * 1.062, 56, 40);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDirWorld.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPosWorld = wp.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vec3 N = normalize(vNormalWorld);
        vec3 V = normalize(cameraPosition - vPosWorld);
        float d = max(0.0, dot(-N, V));
        float limb = smoothstep(0.0, 0.34, d) * pow(1.0 - d, 2.4) * 2.2;
        float sunSide = smoothstep(-0.35, 0.5, dot(N, normalize(uSunDir)));
        vec3 col = mix(vec3(0.14, 0.48, 0.98), vec3(0.45, 0.84, 1.0), sunSide);
        gl_FragColor = vec4(col, limb * (0.16 + 0.88 * sunSide));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  group.add(atmoMesh);

  disposables.push(earthGeo, earthMat, cloudGeo, cloudMat, atmoGeo, atmoMat);

  return {
    group,
    earthMesh,
    cloudMesh,
    setSunDirection: (dir: THREE.Vector3) => {
      earthMat.uniforms.uSunDir.value.copy(dir).normalize();
      cloudMat.uniforms.uSunDir.value.copy(dir).normalize();
      atmoMat.uniforms.uSunDir.value.copy(dir).normalize();
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/**
 * Custom GLSL Altitude Sky Dome:
 * Smoothly blends coastal twilight / planetary atmosphere colors as spacecraft climbs out of Earth or enters another planet
 */
export function createAltitudeSkyDome(radius = 240): {
  mesh: THREE.Mesh;
  setColors: (
    zenith: THREE.Color,
    horizon: THREE.Color,
    sunGlow: THREE.Color,
    sunDir: THREE.Vector3,
    atmosphereStrength: number
  ) => void;
  dispose: () => void;
} {
  const geo = new THREE.SphereGeometry(radius, 40, 28);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(0x061329) },
      uHorizon: { value: new THREE.Color(0x1e4d82) },
      uSunGlow: { value: new THREE.Color(0xfdba74) },
      uSunDir: { value: new THREE.Vector3(0.55, 0.35, -0.75).normalize() },
      uAtmoStrength: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunGlow;
      uniform vec3 uSunDir;
      uniform float uAtmoStrength;
      varying vec3 vWorldDir;
      void main() {
        vec3 d = normalize(vWorldDir);
        float elev = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonBand = pow(1.0 - abs(d.y), 3.4);
        vec3 baseSky = mix(uHorizon, uZenith, smoothstep(0.46, 0.88, elev));
        baseSky = mix(baseSky, uHorizon, horizonBand * 0.65);

        float sunDot = max(0.0, dot(d, normalize(uSunDir)));
        float sunHalo = pow(sunDot, 12.0) * 0.52 + pow(sunDot, 64.0) * 0.45;
        vec3 col = (baseSky + uSunGlow * sunHalo) * uAtmoStrength + vec3(0.006, 0.01, 0.022) * (1.0 - uAtmoStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    setColors: (zenith, horizon, sunGlow, sunDir, atmosphereStrength) => {
      mat.uniforms.uZenith.value.copy(zenith);
      mat.uniforms.uHorizon.value.copy(horizon);
      mat.uniforms.uSunGlow.value.copy(sunGlow);
      mat.uniforms.uSunDir.value.copy(sunDir).normalize();
      mat.uniforms.uAtmoStrength.value = atmosphereStrength;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * Hypersonic Atmospheric Entry Bow-Shock Plasma Shield Shader (for Mars / Titan entry)
 */
export function createEntryPlasmaShield(
  primaryHex: number,
  secondaryHex: number
): {
  group: THREE.Group;
  update: (time: number, intensity: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();

  const makePlasmaMat = (
    cInner: number,
    cOuter: number,
    speed: number,
    opacityScale: number
  ) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uColorInner: { value: new THREE.Color(cInner) },
        uColorOuter: { value: new THREE.Color(cOuter) },
        uSpeed: { value: speed },
        uOpacityScale: { value: opacityScale },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vPosLocal;
        void main() {
          vUv = uv;
          vPosLocal = position;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        uniform float uSpeed;
        uniform float uOpacityScale;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vPosLocal;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          if (uIntensity <= 0.005) discard;
          float flow = vnoise(vec2(vUv.x * 16.0, vUv.y * 8.0 - uTime * uSpeed));
          float streak = vnoise(vec2(vUv.x * 32.0 + 3.1, vUv.y * 14.0 - uTime * uSpeed * 1.65));
          float turb = flow * 0.6 + streak * 0.4;

          // Brightest near the blunt windward bow edge (lower vUv.y on inverted cone)
          float edgeFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.32, 1.0, vUv.y));
          float rim = pow(1.0 - abs(vNormalView.z), 1.35) * 0.65 + 0.35;

          vec3 col = mix(uColorOuter, uColorInner, smoothstep(0.28, 0.85, turb) * (1.0 - vUv.y * 0.55));
          float alpha = edgeFade * (0.48 + turb * 0.72) * rim * uIntensity * uOpacityScale;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });

  // Primary ionized bow-shock envelope wrapping windward belly/nose
  const outerGeo = new THREE.ConeGeometry(2.55, 6.8, 36, 12, true);
  outerGeo.rotateX(Math.PI);
  const outerMat = makePlasmaMat(0xfffbeb, primaryHex, 7.2, 0.92);
  const outerCone = new THREE.Mesh(outerGeo, outerMat);
  outerCone.position.set(0, 2.2, 0.25);
  group.add(outerCone);

  // Inner intense white-hot shock core hugging the heatshield
  const innerGeo = new THREE.ConeGeometry(1.75, 4.4, 32, 8, true);
  innerGeo.rotateX(Math.PI);
  const innerMat = makePlasmaMat(0xffffff, secondaryHex, 10.5, 1.0);
  const innerCone = new THREE.Mesh(innerGeo, innerMat);
  innerCone.position.set(0, 1.65, 0.32);
  group.add(innerCone);

  const shockLight = new THREE.PointLight(primaryHex, 0, 28, 1.4);
  shockLight.position.set(0, 2.4, 1.3);
  group.add(shockLight);

  return {
    group,
    update: (time, intensity) => {
      group.visible = intensity > 0.01;
      outerMat.uniforms.uTime.value = time;
      outerMat.uniforms.uIntensity.value = intensity;
      innerMat.uniforms.uTime.value = time;
      innerMat.uniforms.uIntensity.value = intensity;
      shockLight.intensity = intensity * (7.5 + Math.sin(time * 32) * 1.4);
    },
    dispose: () => {
      outerGeo.dispose();
      outerMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
    },
  };
}

/**
 * High-Detail Coastal Earth Launch Complex (Concrete Pad, Flame Trench, Coastal Terrain, Ocean, Strongback)
 */
export function createCoastalEarthLaunchSite(maxAnisotropy: number): {
  group: THREE.Group;
  umbilicalArm: THREE.Mesh;
  upperClampArm: THREE.Mesh;
  oceanMat: THREE.MeshPhysicalMaterial;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Coastal peninsula terrain texture
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 512;
  groundCanvas.height = 512;
  const gCtx = groundCanvas.getContext('2d')!;
  const gImg = gCtx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const u = x / 512;
      const v = y / 512;
      const n = fbm(u * 14, v * 14, 4, 211);
      const dx = u - 0.5;
      const dy = v - 0.5;
      const dist = Math.hypot(dx, dy);
      const padConcrete = Math.max(0, 1 - dist * 5.2);
      const coastal = Math.max(0, (u - 0.58) * 2.4);
      const r =
        padConcrete > 0.35
          ? 64 + n * 35
          : coastal > 0.2
          ? 144 + n * 38
          : 44 + n * 34;
      const g =
        padConcrete > 0.35
          ? 70 + n * 35
          : coastal > 0.2
          ? 128 + n * 34
          : 76 + n * 42;
      const b =
        padConcrete > 0.35
          ? 78 + n * 35
          : coastal > 0.2
          ? 92 + n * 24
          : 46 + n * 24;
      const idx = (y * 512 + x) * 4;
      gImg.data[idx] = r;
      gImg.data[idx + 1] = g;
      gImg.data[idx + 2] = b;
      gImg.data[idx + 3] = 255;
    }
  }
  gCtx.putImageData(gImg, 0, 0);
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = maxAnisotropy;
  disposables.push(groundTex);

  const coastTerrainGeo = new THREE.PlaneGeometry(180, 180, 48, 48);
  coastTerrainGeo.rotateX(-Math.PI / 2);
  const ctPos = coastTerrainGeo.attributes.position;
  for (let i = 0; i < ctPos.count; i++) {
    const vx = ctPos.getX(i);
    const vz = ctPos.getZ(i);
    const d = Math.hypot(vx, vz);
    // Keep launch complex flat within r < 24, dip east toward ocean coastline beyond x > 28
    const slopeEast = vx > 22 ? -Math.min(2.6, (vx - 22) * 0.085) : 0;
    const dunes = d > 26 && vx <= 22 ? Math.sin(vx * 0.09) * Math.cos(vz * 0.09) * 1.4 : 0;
    ctPos.setY(i, -0.35 + slopeEast + dunes);
  }
  coastTerrainGeo.computeVertexNormals();
  const coastTerrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.88,
    metalness: 0.04,
  });
  const coastTerrain = new THREE.Mesh(coastTerrainGeo, coastTerrainMat);
  coastTerrain.receiveShadow = true;
  group.add(coastTerrain);
  disposables.push(coastTerrainGeo, coastTerrainMat);

  // Surrounding Atlantic Ocean plane
  const oceanGeo = new THREE.PlaneGeometry(340, 340);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshPhysicalMaterial({
    color: 0x072642,
    emissive: 0x041326,
    emissiveIntensity: 0.3,
    roughness: 0.14,
    metalness: 0.38,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(55, -0.88, 0);
  group.add(ocean);
  disposables.push(oceanGeo, oceanMat);

  // Concrete Launch Mount + Flame Trench Apron
  const padTexCanvas = document.createElement('canvas');
  padTexCanvas.width = 512;
  padTexCanvas.height = 512;
  const pCtx = padTexCanvas.getContext('2d')!;
  pCtx.fillStyle = '#2b3440';
  pCtx.fillRect(0, 0, 512, 512);
  pCtx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  pCtx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    pCtx.beginPath();
    pCtx.moveTo(i, 0);
    pCtx.lineTo(i, 512);
    pCtx.stroke();
    pCtx.beginPath();
    pCtx.moveTo(0, i);
    pCtx.lineTo(512, i);
    pCtx.stroke();
  }
  pCtx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
  pCtx.lineWidth = 7;
  pCtx.beginPath();
  pCtx.arc(256, 256, 178, 0, Math.PI * 2);
  pCtx.stroke();
  pCtx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  pCtx.lineWidth = 4;
  pCtx.beginPath();
  pCtx.arc(256, 256, 128, 0, Math.PI * 2);
  pCtx.stroke();

  const padTex = new THREE.CanvasTexture(padTexCanvas);
  padTex.colorSpace = THREE.SRGBColorSpace;
  padTex.anisotropy = maxAnisotropy;
  disposables.push(padTex);

  const padDeckGeo = new THREE.CylinderGeometry(16.5, 17.6, 0.65, 48);
  const padDeckMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.74,
    metalness: 0.22,
  });
  const padDeck = new THREE.Mesh(padDeckGeo, padDeckMat);
  padDeck.position.y = -0.3;
  padDeck.receiveShadow = true;
  group.add(padDeck);
  disposables.push(padDeckGeo, padDeckMat);

  // Flame trench steel blast ring under the engines
  const mountRingGeo = new THREE.CylinderGeometry(3.1, 3.6, 0.55, 24, 1, true);
  const mountMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.75,
    side: THREE.DoubleSide,
  });
  const mountRing = new THREE.Mesh(mountRingGeo, mountMat);
  mountRing.position.y = 0.25;
  group.add(mountRing);
  disposables.push(mountRingGeo, mountMat);

  // Crew boarding walkway + amber LED guide strips
  const walkwayGeo = new THREE.BoxGeometry(2.3, 0.18, 9.2);
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.52,
    metalness: 0.65,
  });
  const walkway = new THREE.Mesh(walkwayGeo, walkwayMat);
  walkway.position.set(0, 0.09, 6.4);
  walkway.receiveShadow = true;
  group.add(walkway);

  const railGlowGeo = new THREE.BoxGeometry(0.06, 0.06, 8.6);
  const railGlowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  for (const sx of [-1.05, 1.05]) {
    const strip = new THREE.Mesh(railGlowGeo, railGlowMat);
    strip.position.set(sx, 0.22, 6.4);
    group.add(strip);
  }
  disposables.push(walkwayGeo, walkwayMat, railGlowGeo, railGlowMat);

  // Lattice Integration / Launch Tower + Twin Retracting Arms
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.45,
    metalness: 0.78,
  });
  const towerMastGeo = new THREE.BoxGeometry(1.5, 13.8, 1.5);
  const towerMast = new THREE.Mesh(towerMastGeo, towerMat);
  towerMast.position.set(-4.6, 6.8, -3.0);
  towerMast.castShadow = true;
  group.add(towerMast);

  const capGeo = new THREE.BoxGeometry(2.1, 0.55, 2.1);
  const capMesh = new THREE.Mesh(capGeo, towerMat);
  capMesh.position.set(-4.6, 13.9, -3.0);
  group.add(capMesh);

  const armGeo = new THREE.BoxGeometry(3.8, 0.36, 0.48);
  const umbilicalArm = new THREE.Mesh(armGeo, towerMat);
  umbilicalArm.position.set(-2.5, 4.1, -1.6);
  umbilicalArm.rotation.y = -0.45;
  group.add(umbilicalArm);

  const clampGeo = new THREE.BoxGeometry(3.4, 0.42, 0.65);
  const upperClampArm = new THREE.Mesh(clampGeo, towerMat);
  upperClampArm.position.set(-2.7, 7.6, -1.7);
  upperClampArm.rotation.y = -0.45;
  group.add(upperClampArm);

  // Four Pad Perimeter Floodlight Masts
  const floodMastGeo = new THREE.CylinderGeometry(0.12, 0.18, 6.2, 8);
  const floodHeadGeo = new THREE.BoxGeometry(0.65, 0.35, 0.25);
  const floodLampMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
  const floodCoords: Array<[number, number]> = [
    [13.5, 10.5],
    [-13.5, 10.5],
    [13.5, -10.5],
    [-13.5, -10.5],
  ];
  floodCoords.forEach(([fx, fz]) => {
    const m = new THREE.Mesh(floodMastGeo, towerMat);
    m.position.set(fx, 3.0, fz);
    const h = new THREE.Mesh(floodHeadGeo, floodLampMat);
    h.position.set(fx, 6.1, fz);
    h.lookAt(0, 2, 0);
    group.add(m, h);
  });

  // Distant Earth high-altitude cloud deck wisps (fly past ship during atmospheric ascent)
  const cloudPuffGeo = new THREE.CircleGeometry(6.5, 16);
  cloudPuffGeo.rotateX(Math.PI / 2);
  const cloudPuffMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const rad = 18 + (i % 4) * 9;
    const puff = new THREE.Mesh(cloudPuffGeo, cloudPuffMat);
    puff.position.set(Math.cos(ang) * rad, 24 + (i % 5) * 6.5, Math.sin(ang) * rad);
    puff.scale.set(1.2 + (i % 3) * 0.55, 1, 0.9 + (i % 2) * 0.45);
    group.add(puff);
  }

  disposables.push(
    towerMat,
    towerMastGeo,
    capGeo,
    armGeo,
    clampGeo,
    floodMastGeo,
    floodHeadGeo,
    floodLampMat,
    cloudPuffGeo,
    cloudPuffMat
  );

  return {
    group,
    umbilicalArm,
    upperClampArm,
    oceanMat,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
