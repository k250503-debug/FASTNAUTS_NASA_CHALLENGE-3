export type SpaceSfxKind =
  | 'ui_click'
  | 'ui_select'
  | 'deploy'
  | 'water_cycle'
  | 'thruster'
  | 'touchdown'
  | 'cinematic_swell';

let sharedCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function playSpaceSfx(kind: SpaceSfxKind, muted = false): void {
  if (muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  try {
    if (kind === 'ui_click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.045);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);
      return;
    }

    if (kind === 'ui_select') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.09);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (kind === 'deploy') {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.45);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
      return;
    }

    if (kind === 'water_cycle') {
      [587.33, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.035, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.27);
      });
      return;
    }

    if (kind === 'thruster') {
      const bufferSize = Math.floor(ctx.sampleRate * 2.4);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.06 * w) / 1.06;
        data[i] = Math.max(-1, Math.min(1, lastOut * 2.8));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 2.3);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

      const subOsc = ctx.createOscillator();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(42, now);
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(95, now);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.075, now + 0.25);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 2.42);
      subOsc.start(now);
      subOsc.stop(now + 2.4);
      return;
    }

    if (kind === 'touchdown') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(88, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.52);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);

      // Hydraulic strut & valve relief hiss
      const hLen = Math.floor(ctx.sampleRate * 0.7);
      const hBuf = ctx.createBuffer(1, hLen, ctx.sampleRate);
      const ch = hBuf.getChannelData(0);
      for (let i = 0; i < hLen; i++) ch[i] = Math.random() * 2 - 1;
      const hSrc = ctx.createBufferSource();
      hSrc.buffer = hBuf;
      const hFilter = ctx.createBiquadFilter();
      hFilter.type = 'bandpass';
      hFilter.frequency.setValueAtTime(1550, now + 0.08);
      hFilter.Q.setValueAtTime(1.1, now + 0.08);
      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(0.0001, now + 0.08);
      hGain.gain.linearRampToValueAtTime(0.048, now + 0.14);
      hGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      hSrc.connect(hFilter);
      hFilter.connect(hGain);
      hGain.connect(ctx.destination);
      hSrc.start(now + 0.08);
      hSrc.stop(now + 0.74);
      return;
    }

    if (kind === 'cinematic_swell') {
      [65.41, 98.0, 130.81, 196.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.032, now + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.45);
      });
    }
  } catch {
    // Ignore Web Audio failures cleanly
  }
}
