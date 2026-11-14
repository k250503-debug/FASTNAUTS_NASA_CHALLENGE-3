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

function fbm(x: number, y: number, octaves = 4, seed = 1): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function makeCanvas(w = 512, h = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy = 4,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createPlanetSurfaceTexture(
  id: string,
  anisotropy = 4
): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let py = 0; py < H; py++) {
    const v = py / H;
    const lat = (v - 0.5) * Math.PI; // -pi/2 to pi/2
    const absLat = Math.abs(v - 0.5) * 2; // 0 equator, 1 poles

    for (let px = 0; px < W; px++) {
      const u = px / W;
      const idx = (py * W + px) * 4;
      let r = 128;
      let g = 128;
      let b = 128;

      if (id === 'mercury' || id === 'luna') {
        const seed = id === 'mercury' ? 11 : 23;
        const n = fbm(u * 10, v * 5, 5, seed);
        const mare = id === 'luna' ? fbm(u * 3.8 + 1.2, v * 2.5, 3, 41) : 0.6;
        const base = id === 'mercury' ? 105 + n * 75 : mare < 0.45 ? 74 + n * 35 : 138 + n * 62;
        r = base;
        g = base * 0.98;
        b = base * 0.96;
      } else if (id === 'venus') {
        const swirl = fbm(u * 5 + Math.sin(v * 8) * 0.6, v * 7, 4, 31);
        const band = Math.sin(v * 14 + swirl * 4) * 0.5 + 0.5;
        r = 212 + band * 34;
        g = 172 + band * 40 + swirl * 16;
        b = 104 + band * 38;
      } else if (id === 'earth') {
        const cont = fbm(u * 6.5, v * 4.2, 5, 7);
        const detail = fbm(u * 18, v * 12, 3, 19);
        const iceCap = absLat > 0.84 - detail * 0.08;
        if (iceCap) {
          r = 232;
          g = 242;
          b = 250;
        } else if (cont > 0.52) {
          // Continents (emerald + arid ochre)
          const arid = smoothNoise(u * 8, v * 6, 53);
          const elev = (cont - 0.52) * 2.1;
          r = arid > 0.56 ? 168 + elev * 45 : 44 + elev * 50;
          g = arid > 0.56 ? 142 + elev * 32 : 114 + elev * 45;
          b = arid > 0.56 ? 88 + elev * 20 : 54 + elev * 25;
        } else {
          // Oceans with shelf depth
          const shelf = Math.max(0, (cont - 0.4) * 8);
          r = 14 + shelf * 20;
          g = 52 + shelf * 58;
          b = 122 + shelf * 75;
        }
      } else if (id === 'mars') {
        const n = fbm(u * 8, v * 5, 5, 61);
        const darkRegion = fbm(u * 3.5 + 0.8, v * 2.6, 3, 73);
        if (absLat > 0.89 - n * 0.04) {
          r = 235;
          g = 228;
          b = 222;
        } else {
          const factor = darkRegion < 0.44 ? 0.65 : 1.05;
          r = Math.min(255, (158 + n * 72) * factor);
          g = Math.min(255, (72 + n * 44) * factor);
          b = Math.min(255, (42 + n * 24) * factor);
        }
      } else if (id === 'jupiter') {
        const turb = fbm(u * 12, v * 10, 4, 83) * 0.07;
        const yWarp = v + turb;
        const zone = Math.sin(yWarp * 36) * 0.5 + 0.5;
        const subZone = Math.cos(yWarp * 72 + 1.2) * 0.5 + 0.5;
        // Great Red Spot near u=0.62, v=0.62
        const dx = (u - 0.62) * 2.3;
        const dy = (v - 0.62) * 5.2;
        const spotDist = Math.sqrt(dx * dx + dy * dy);
        if (spotDist < 0.22) {
          const spotRing = Math.sin(spotDist * 38) * 0.15;
          r = 205 + spotRing * 40;
          g = 86 + spotDist * 140;
          b = 58 + spotDist * 90;
        } else {
          r = 186 + zone * 48 - subZone * 22;
          g = 146 + zone * 52 - subZone * 32;
          b = 110 + zone * 48 - subZone * 30;
        }
      } else if (id === 'saturn') {
        const turb = fbm(u * 9, v * 8, 3, 97) * 0.03;
        const band = Math.sin((v + turb) * 32) * 0.5 + 0.5;
        const polarShade = 1 - Math.pow(absLat, 3) * 0.28;
        r = (206 + band * 34) * polarShade;
        g = (182 + band * 32) * polarShade;
        b = (132 + band * 26) * polarShade;
      } else if (id === 'uranus') {
        const band = Math.sin(v * 18) * 0.5 + 0.5;
        const haze = smoothNoise(u * 4, v * 6, 109) * 14;
        r = 118 + band * 26 + haze;
        g = 212 + band * 22 + haze * 0.6;
        b = 224 + band * 18;
      } else if (id === 'neptune') {
        const swirl = fbm(u * 10, v * 7, 4, 121);
        const band = Math.sin((v + swirl * 0.04) * 26) * 0.5 + 0.5;
        const cirrus = swirl > 0.72 ? (swirl - 0.72) * 320 : 0;
        r = Math.min(255, 34 + band * 24 + cirrus);
        g = Math.min(255, 76 + band * 48 + cirrus);
        b = Math.min(255, 186 + band * 52 + cirrus * 0.6);
      } else if (id === 'europa') {
        const ice = fbm(u * 7, v * 5, 4, 137);
        const crack1 = Math.abs(Math.sin(u * 26 + v * 19 + ice * 4.5));
        const crack2 = Math.abs(Math.cos(u * 18 - v * 28 + ice * 3.8));
        const isLineae = crack1 < 0.08 || crack2 < 0.07;
        r = isLineae ? 164 : 214 + ice * 34;
        g = isLineae ? 112 : 224 + ice * 26;
        b = isLineae ? 92 : 235 + ice * 18;
      } else if (id === 'titan') {
        const haze = fbm(u * 6, v * 6, 3, 149);
        r = 212 + haze * 30;
        g = 152 + haze * 28;
        b = 64 + haze * 22;
      } else if (id === 'io') {
        const sulf = fbm(u * 9, v * 7, 4, 163);
        const caldera = hash2d(Math.floor(u * 36), Math.floor(v * 18), 167);
        if (caldera > 0.94) {
          r = 45;
          g = 28;
          b = 20;
        } else {
          r = 218 + sulf * 35;
          g = 178 + sulf * 48 - Math.abs(Math.cos(lat * 4)) * 32;
          b = 56 + sulf * 42;
        }
      } else if (id === 'enceladus') {
        const ice = fbm(u * 8, v * 6, 3, 179);
        const stripe = v > 0.76 && Math.abs(Math.sin(u * 18 + ice * 2)) < 0.14;
        r = stripe ? 128 : 228 + ice * 24;
        g = stripe ? 204 : 238 + ice * 16;
        b = stripe ? 248 : 248;
      } else if (id === 'triton') {
        const frost = fbm(u * 11, v * 8, 4, 193);
        r = 186 + frost * 44;
        g = 172 + frost * 36;
        b = 188 + frost * 42;
      } else {
        const n = fbm(u * 9, v * 6, 4, 211);
        r = 115 + n * 65;
        g = 118 + n * 60;
        b = 124 + n * 58;
      }

      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, anisotropy, true);
}

export function createEarthCloudsTexture(anisotropy = 4): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let py = 0; py < H; py++) {
    const v = py / H;
    for (let px = 0; px < W; px++) {
      const u = px / W;
      const n = fbm(u * 9 + Math.sin(v * 6) * 0.4, v * 6, 5, 307);
      const alpha = Math.max(0, Math.min(255, (n - 0.46) * 620));
      const idx = (py * W + px) * 4;
      data[idx] = 246;
      data[idx + 1] = 250;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, anisotropy, true);
}

export function createPlanetaryRingTexture(
  variant: 'saturn' | 'uranus',
  anisotropy = 4
): THREE.CanvasTexture {
  const W = 512;
  const H = 32;
  const [canvas, ctx] = makeCanvas(W, H);

  for (let x = 0; x < W; x++) {
    const t = x / (W - 1); // 0 inner radius -> 1 outer radius
    let r = 220;
    let g = 200;
    let b = 165;
    let a = 0;

    if (variant === 'saturn') {
      const ripple = Math.sin(t * 140) * 0.1 + Math.cos(t * 62) * 0.08;
      if (t > 0.08 && t < 0.24) {
        // C Ring (faint)
        a = 0.24 + ripple * 0.5;
        r = 170;
        g = 158;
        b = 136;
      } else if (t >= 0.24 && t < 0.58) {
        // B Ring (bright dense)
        a = 0.88 + ripple * 0.4;
        r = 228 + ripple * 35;
        g = 206 + ripple * 30;
        b = 164 + ripple * 24;
      } else if (t >= 0.58 && t < 0.65) {
        // Cassini Division (dark gap)
        a = 0.06;
      } else if (t >= 0.65 && t < 0.92) {
        // A Ring
        a = 0.68 + ripple * 0.4;
        r = 210 + ripple * 24;
        g = 194 + ripple * 22;
        b = 162 + ripple * 18;
      } else if (t > 0.95 && t < 0.975) {
        // F Ring
        a = 0.42;
      }
    } else {
      // Uranus subtle narrow icy-charcoal ring
      const band1 = t > 0.3 && t < 0.35;
      const band2 = t > 0.56 && t < 0.61;
      const band3 = t > 0.82 && t < 0.88;
      r = 165;
      g = 224;
      b = 240;
      a = band1 || band2 || band3 ? 0.38 : 0.06;
    }

    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.max(
      0,
      Math.min(1, a)
    )})`;
    ctx.fillRect(x, 0, 1, H);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createRadialGlowTexture(
  innerRgba: string,
  midRgba: string,
  outerRgba = 'rgba(0,0,0,0)'
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, innerRgba);
  grad.addColorStop(0.35, midRgba);
  grad.addColorStop(1, outerRgba);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSpiralGalaxyTexture(anisotropy = 4): THREE.CanvasTexture {
  const S = 512;
  const [canvas, ctx] = makeCanvas(S, S);
  const cx = S / 2;
  const cy = S / 2;

  // Core glow
  const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, S * 0.48);
  core.addColorStop(0, 'rgba(255, 245, 224, 0.95)');
  core.addColorStop(0.14, 'rgba(186, 214, 255, 0.55)');
  core.addColorStop(0.42, 'rgba(99, 102, 241, 0.16)');
  core.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  // Spiral arms
  for (let arm = 0; arm < 2; arm++) {
    const armOffset = arm * Math.PI;
    for (let i = 0; i < 1600; i++) {
      const t = i / 1600;
      const angle = armOffset + t * Math.PI * 3.1 + (hash2d(i, arm, 13) - 0.5) * (0.45 + t * 0.5);
      const r = 10 + t * (S * 0.43) + (hash2d(arm, i, 29) - 0.5) * 24;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r * 0.68;
      const alpha = (1 - t) * 0.28;
      ctx.fillStyle =
        i % 5 === 0
          ? `rgba(244, 114, 182, ${alpha * 0.9})`
          : i % 2 === 0
          ? `rgba(125, 211, 252, ${alpha})`
          : `rgba(226, 232, 240, ${alpha})`;
      const size = 1 + hash2d(i, i, 7) * 3.2;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createNebulaTexture(
  primaryHex: string,
  secondaryHex: string,
  anisotropy = 4
): THREE.CanvasTexture {
  const S = 512;
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);

  for (let i = 0; i < 38; i++) {
    const x = S * (0.22 + hash2d(i, 1, 71) * 0.56);
    const y = S * (0.22 + hash2d(i, 2, 71) * 0.56);
    const rad = S * (0.12 + hash2d(i, 3, 71) * 0.24);
    const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
    const col = i % 2 === 0 ? primaryHex : secondaryHex;
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}
