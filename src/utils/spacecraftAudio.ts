export type SpacecraftAudioStage = 'boarding' | 'transit' | 'landing' | 'disembark';

export interface SpacecraftAudioFrame {
  stage: SpacecraftAudioStage;
  muted: boolean;
  /** 0..1 main rocket/descent engine thrust intensity */
  thrustLevel: number;
  /** 0..1 rocket exhaust acoustic crackle & pad deluge intensity */
  crackleLevel: number;
  /** 0..1 cryogenic LOX boiloff & chilldown steam hiss */
  loxVentLevel: number;
  /** 0..1 atmospheric hypersonic entry plasma roar */
  plasmaLevel: number;
  /** 0..1 planetary surface wind buffeting */
  windLevel: number;
  /** 0..1 deep-space spacecraft cabin & ion drive cruise drone */
  cabinHumLevel: number;
  /** 0..1 aerodynamic pressure / Max-Q rush */
  maxQLevel: number;
}

export interface SpacecraftAudioEngine {
  update: (frame: SpacecraftAudioFrame) => void;
  triggerIgnitionBurst: () => void;
  triggerStageSeparation: () => void;
  triggerRcsPuff: () => void;
  triggerAltimeterPing: (urgency01: number) => void;
  triggerTouchdownImpact: () => void;
  triggerAirlockDeploy: () => void;
  dispose: () => void;
}

function createBrownNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.045 * white) / 1.045;
    data[i] = Math.max(-1, Math.min(1, lastOut * 3.1));
  }
  return buf;
}

function createPinkNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
    b6 = white * 0.115926;
    data[i] = Math.max(-1, Math.min(1, sample));
  }
  return buf;
}

function createWhiteNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function createSoftClipCurve(): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * 2.2);
  }
  return curve;
}

export function createSpacecraftAudioEngine(): SpacecraftAudioEngine {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let brownBuffer: AudioBuffer | null = null;
  let pinkBuffer: AudioBuffer | null = null;
  let whiteBuffer: AudioBuffer | null = null;

  // Continuous loop nodes
  let brownSrc: AudioBufferSourceNode | null = null;
  let pinkSrc: AudioBufferSourceNode | null = null;
  let whiteSrc: AudioBufferSourceNode | null = null;

  let rumbleFilter: BiquadFilterNode | null = null;
  let rumbleGain: GainNode | null = null;

  let subOscA: OscillatorNode | null = null;
  let subOscB: OscillatorNode | null = null;
  let subGain: GainNode | null = null;

  let crackleFilter: BiquadFilterNode | null = null;
  let crackleGain: GainNode | null = null;

  let loxFilter: BiquadFilterNode | null = null;
  let loxGain: GainNode | null = null;

  let plasmaFilter: BiquadFilterNode | null = null;
  let plasmaGain: GainNode | null = null;

  let windFilter: BiquadFilterNode | null = null;
  let windGain: GainNode | null = null;

  let cabinOscA: OscillatorNode | null = null;
  let cabinOscB: OscillatorNode | null = null;
  let cabinLfo: OscillatorNode | null = null;
  let cabinFilter: BiquadFilterNode | null = null;
  let cabinGain: GainNode | null = null;

  let disposed = false;
  let lastMuted = false;

  const ensureInit = () => {
    if (disposed || ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      ctx = new AudioCtx();
      const now = ctx.currentTime;

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.9, now);
      masterGain.connect(ctx.destination);

      brownBuffer = createBrownNoiseBuffer(ctx, 3);
      pinkBuffer = createPinkNoiseBuffer(ctx, 3);
      whiteBuffer = createWhiteNoiseBuffer(ctx, 2);

      brownSrc = ctx.createBufferSource();
      brownSrc.buffer = brownBuffer;
      brownSrc.loop = true;

      pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = pinkBuffer;
      pinkSrc.loop = true;

      whiteSrc = ctx.createBufferSource();
      whiteSrc.buffer = whiteBuffer;
      whiteSrc.loop = true;

      // 1. Deep Rocket Exhaust Rumble (brown noise + warm wave-shaped sub-bass)
      rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(140, now);
      rumbleFilter.Q.setValueAtTime(0.8, now);
      rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.0001, now);
      brownSrc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(masterGain);

      const shaper = ctx.createWaveShaper();
      shaper.curve = createSoftClipCurve();
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(92, now);
      subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.0001, now);

      subOscA = ctx.createOscillator();
      subOscA.type = 'sawtooth';
      subOscA.frequency.setValueAtTime(36, now);

      subOscB = ctx.createOscillator();
      subOscB.type = 'triangle';
      subOscB.frequency.setValueAtTime(54, now);

      subOscA.connect(shaper);
      subOscB.connect(shaper);
      shaper.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(masterGain);

      // 2. Supersonic Exhaust Crackle & Aerodynamic Max-Q Pressure
      crackleFilter = ctx.createBiquadFilter();
      crackleFilter.type = 'bandpass';
      crackleFilter.frequency.setValueAtTime(980, now);
      crackleFilter.Q.setValueAtTime(0.65, now);
      crackleGain = ctx.createGain();
      crackleGain.gain.setValueAtTime(0.0001, now);
      pinkSrc.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(masterGain);

      // 3. Cryogenic LOX Steam Chilldown Venting
      loxFilter = ctx.createBiquadFilter();
      loxFilter.type = 'highpass';
      loxFilter.frequency.setValueAtTime(2100, now);
      loxGain = ctx.createGain();
      loxGain.gain.setValueAtTime(0.0001, now);
      whiteSrc.connect(loxFilter);
      loxFilter.connect(loxGain);
      loxGain.connect(masterGain);

      // 4. Atmospheric Hypersonic Plasma Entry Roar
      plasmaFilter = ctx.createBiquadFilter();
      plasmaFilter.type = 'bandpass';
      plasmaFilter.frequency.setValueAtTime(390, now);
      plasmaFilter.Q.setValueAtTime(0.95, now);
      plasmaGain = ctx.createGain();
      plasmaGain.gain.setValueAtTime(0.0001, now);
      pinkSrc.connect(plasmaFilter);
      plasmaFilter.connect(plasmaGain);
      plasmaGain.connect(masterGain);

      // 5. Planetary Surface Wind Buffeting
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(280, now);
      windFilter.Q.setValueAtTime(1.15, now);
      windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.0001, now);
      pinkSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      // 6. Deep-Space Spacecraft Cabin & Ion Cruise Resonance
      cabinFilter = ctx.createBiquadFilter();
      cabinFilter.type = 'lowpass';
      cabinFilter.frequency.setValueAtTime(155, now);
      cabinGain = ctx.createGain();
      cabinGain.gain.setValueAtTime(0.0001, now);

      cabinOscA = ctx.createOscillator();
      cabinOscA.type = 'sine';
      cabinOscA.frequency.setValueAtTime(64, now);

      cabinOscB = ctx.createOscillator();
      cabinOscB.type = 'triangle';
      cabinOscB.frequency.setValueAtTime(96, now);

      cabinLfo = ctx.createOscillator();
      cabinLfo.type = 'sine';
      cabinLfo.frequency.setValueAtTime(0.18, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(28, now);
      cabinLfo.connect(lfoGain);
      lfoGain.connect(cabinFilter.frequency);

      cabinOscA.connect(cabinFilter);
      cabinOscB.connect(cabinFilter);
      cabinFilter.connect(cabinGain);
      cabinGain.connect(masterGain);

      brownSrc.start(now);
      pinkSrc.start(now);
      whiteSrc.start(now);
      subOscA.start(now);
      subOscB.start(now);
      cabinOscA.start(now);
      cabinOscB.start(now);
      cabinLfo.start(now);

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      ctx = null;
    }
  };

  const resumeIfNeeded = () => {
    if (!ctx || disposed) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', resumeIfNeeded, { passive: true });
    window.addEventListener('keydown', resumeIfNeeded, { passive: true });
  }

  return {
    update(frame: SpacecraftAudioFrame) {
      lastMuted = frame.muted;
      if (frame.muted) {
        if (ctx && masterGain) {
          masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        }
        return;
      }

      ensureInit();
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const ct = ctx.currentTime;
      masterGain.gain.setTargetAtTime(0.92, ct, 0.08);

      const thrust = Math.max(0, Math.min(1, frame.thrustLevel));
      const crackle = Math.max(0, Math.min(1, frame.crackleLevel));
      const maxQ = Math.max(0, Math.min(1, frame.maxQLevel));
      const lox = Math.max(0, Math.min(1, frame.loxVentLevel));
      const plasma = Math.max(0, Math.min(1, frame.plasmaLevel));
      const wind = Math.max(0, Math.min(1, frame.windLevel));
      const cabin = Math.max(0, Math.min(1, frame.cabinHumLevel));

      rumbleGain?.gain.setTargetAtTime(0.0001 + thrust * 0.24, ct, 0.07);
      rumbleFilter?.frequency.setTargetAtTime(115 + thrust * 240 + maxQ * 180, ct, 0.09);

      subGain?.gain.setTargetAtTime(0.0001 + thrust * 0.095, ct, 0.08);
      subOscA?.frequency.setTargetAtTime(34 + thrust * 14, ct, 0.12);
      subOscB?.frequency.setTargetAtTime(51 + thrust * 21, ct, 0.12);

      crackleGain?.gain.setTargetAtTime(0.0001 + crackle * 0.085 + maxQ * 0.055, ct, 0.06);
      crackleFilter?.frequency.setTargetAtTime(720 + crackle * 640 + maxQ * 520, ct, 0.1);

      loxGain?.gain.setTargetAtTime(0.0001 + lox * 0.036, ct, 0.08);
      plasmaGain?.gain.setTargetAtTime(0.0001 + plasma * 0.145, ct, 0.07);
      plasmaFilter?.frequency.setTargetAtTime(320 + plasma * 540, ct, 0.09);

      windGain?.gain.setTargetAtTime(0.0001 + wind * 0.075, ct, 0.09);
      windFilter?.frequency.setTargetAtTime(220 + wind * 320, ct, 0.12);

      cabinGain?.gain.setTargetAtTime(0.0001 + cabin * 0.065, ct, 0.14);
    },

    triggerIgnitionBurst() {
      if (lastMuted) return;
      ensureInit();
      if (!ctx || !masterGain || !brownBuffer) return;
      try {
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = brownBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, now);
        filter.frequency.exponentialRampToValueAtTime(110, now + 0.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.28, now + 0.09);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
        src.connect(filter);
        filter.connect(g);
        g.connect(masterGain);
        src.start(now);
        src.stop(now + 1.2);

        const thump = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(76, now);
        thump.frequency.exponentialRampToValueAtTime(31, now + 0.65);
        thumpGain.gain.setValueAtTime(0.2, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
        thump.connect(thumpGain);
        thumpGain.connect(masterGain);
        thump.start(now);
        thump.stop(now + 0.72);
      } catch {
        // Ignore one-shot audio failure
      }
    },

    triggerStageSeparation() {
      if (lastMuted) return;
      ensureInit();
      if (!ctx || !masterGain || !whiteBuffer || !brownBuffer) return;
      try {
        const now = ctx.currentTime;
        // 1. Pneumatic clamp decoupler mechanical thud
        const thud = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(140, now);
        thud.frequency.exponentialRampToValueAtTime(38, now + 0.34);
        thudGain.gain.setValueAtTime(0.24, now);
        thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        thud.connect(thudGain);
        thudGain.connect(masterGain);
        thud.start(now);
        thud.stop(now + 0.4);

        // 2. High-pressure cold-gas pusher release hiss
        const hissSrc = ctx.createBufferSource();
        hissSrc.buffer = whiteBuffer;
        const hissFilter = ctx.createBiquadFilter();
        hissFilter.type = 'bandpass';
        hissFilter.frequency.setValueAtTime(1900, now + 0.02);
        hissFilter.Q.setValueAtTime(0.9, now + 0.02);
        const hissGain = ctx.createGain();
        hissGain.gain.setValueAtTime(0.0001, now);
        hissGain.gain.linearRampToValueAtTime(0.095, now + 0.06);
        hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
        hissSrc.connect(hissFilter);
        hissFilter.connect(hissGain);
        hissGain.connect(masterGain);
        hissSrc.start(now);
        hissSrc.stop(now + 0.9);

        // 3. Upper-stage vacuum engine ignition soft whoosh (~0.28s later)
        const ignSrc = ctx.createBufferSource();
        ignSrc.buffer = brownBuffer;
        const ignFilter = ctx.createBiquadFilter();
        ignFilter.type = 'lowpass';
        ignFilter.frequency.setValueAtTime(420, now + 0.28);
        const ignGain = ctx.createGain();
        ignGain.gain.setValueAtTime(0.0001, now + 0.28);
        ignGain.gain.linearRampToValueAtTime(0.18, now + 0.45);
        ignGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
        ignSrc.connect(ignFilter);
        ignFilter.connect(ignGain);
        ignGain.connect(masterGain);
        ignSrc.start(now + 0.28);
        ignSrc.stop(now + 1.4);
      } catch {
        // Ignore stage separation audio failure
      }
    },

    triggerRcsPuff() {
      if (lastMuted) return;
      ensureInit();
      if (!ctx || !masterGain || !whiteBuffer) return;
      try {
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = whiteBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1350, now);
        filter.Q.setValueAtTime(1.2, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.048, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        src.connect(filter);
        filter.connect(g);
        g.connect(masterGain);
        src.start(now);
        src.stop(now + 0.24);
      } catch {
        // Ignore RCS audio failure
      }
    },

    triggerAltimeterPing(urgency01: number) {
      if (lastMuted) return;
      ensureInit();
      if (!ctx || !masterGain) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1240 + urgency01 * 420, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.032, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.11);
      } catch {
        // Ignore altimeter audio failure
      }
    },

    triggerTouchdownImpact() {
      if (lastMuted) return;
      ensureInit();
      if (!ctx || !masterGain || !whiteBuffer) return;
      try {
        const now = ctx.currentTime;
        // Heavy strut compression thump
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(84, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.55);
        g.gain.setValueAtTime(0.24, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.62);

        // Valve shutoff hydraulic relief hiss
        const src = ctx.createBufferSource();
        src.buffer = whiteBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600, now + 0.08);
        filter.Q.setValueAtTime(1.1, now + 0.08);
        const hGain = ctx.createGain();
        hGain.gain.setValueAtTime(0.0001, now + 0.08);
        hGain.gain.linearRampToValueAtTime(0.052, now + 0.14);
        hGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
        src.connect(filter);
        filter.connect(hGain);
        hGain.connect(masterGain);
        src.start(now + 0.08);
        src.stop(now + 0.75);
      } catch {
        // Ignore touchdown audio failure
      }
    },

    triggerAirlockDeploy() {
      if (lastMuted) return;
      ensureInit();
      if (!ctx || !masterGain || !whiteBuffer) return;
      try {
        const now = ctx.currentTime;
        // Depressurization hiss
        const src = ctx.createBufferSource();
        src.buffer = whiteBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1850, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.048, now + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
        src.connect(filter);
        filter.connect(g);
        g.connect(masterGain);
        src.start(now);
        src.stop(now + 1.1);

        // Ramp actuator hydraulic servo hum
        const servo = ctx.createOscillator();
        const sg = ctx.createGain();
        servo.type = 'triangle';
        servo.frequency.setValueAtTime(145, now + 0.15);
        servo.frequency.linearRampToValueAtTime(118, now + 1.15);
        sg.gain.setValueAtTime(0.0001, now + 0.15);
        sg.gain.linearRampToValueAtTime(0.036, now + 0.25);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
        servo.connect(sg);
        sg.connect(masterGain);
        servo.start(now + 0.15);
        servo.stop(now + 1.28);
      } catch {
        // Ignore airlock audio failure
      }
    },

    dispose() {
      disposed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', resumeIfNeeded);
        window.removeEventListener('keydown', resumeIfNeeded);
      }
      try {
        brownSrc?.stop();
        pinkSrc?.stop();
        whiteSrc?.stop();
        subOscA?.stop();
        subOscB?.stop();
        cabinOscA?.stop();
        cabinOscB?.stop();
        cabinLfo?.stop();
        if (ctx && ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch {
        // Ignore audio cleanup errors
      }
      ctx = null;
    },
  };
}
