import type { AstronautProfile, MissionState } from '../types';

export interface NasaSpeechOptions {
  muted?: boolean;
  urgent?: boolean;
  rate?: number;
  pitch?: number;
  queue?: boolean;
  radioComms?: boolean;
  onStart?: (voiceName: string) => void;
  onEnd?: () => void;
}

export interface MissionVoiceAlert {
  key: string;
  title: string;
  spokenText: string;
  severity: 'warning' | 'danger';
}

export function pickFemaleNasaVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const englishVoices = voices.filter((v) => /^en/i.test(v.lang));
  const pool = englishVoices.length > 0 ? englishVoices : voices;
  const femaleMatch = pool.find((v) =>
    /(samantha|victoria|karen|moira|tessa|fiona|kate|serena|susan|zira|aria|jenny|libby|hazel|sonia|natasha|ava|allison|google uk english female|google us english|female|woman)/i.test(
      v.name
    )
  );
  if (femaleMatch) return femaleMatch;
  return pool[0] || null;
}

export function playQuindarTone(phase: 'intro' | 'outro' = 'intro'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Authentic Apollo/Artemis Quindar PTT tone (2524 Hz intro, 2475 Hz outro) + subtle VHF squelch burst
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(phase === 'intro' ? 2524 : 2475, now);

    const toneDur = phase === 'intro' ? 0.14 : 0.11;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.052, now + 0.012);
    gain.gain.setValueAtTime(0.052, now + toneDur - 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + toneDur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + toneDur + 0.02);

    // Subtle crisp radio mic click / VHF squelch burst
    const sqLen = Math.floor(ctx.sampleRate * 0.055);
    const sqBuf = ctx.createBuffer(1, sqLen, ctx.sampleRate);
    const ch = sqBuf.getChannelData(0);
    for (let i = 0; i < sqLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / sqLen);
    }
    const sqSrc = ctx.createBufferSource();
    sqSrc.buffer = sqBuf;
    const sqFilter = ctx.createBiquadFilter();
    sqFilter.type = 'bandpass';
    sqFilter.frequency.setValueAtTime(1950, now);
    sqFilter.Q.setValueAtTime(1.4, now);
    const sqGain = ctx.createGain();
    sqGain.gain.setValueAtTime(0.028, now + 0.02);
    sqGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    sqSrc.connect(sqFilter);
    sqFilter.connect(sqGain);
    sqGain.connect(ctx.destination);
    sqSrc.start(now + 0.02);

    window.setTimeout(() => {
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    }, 320);
  } catch {
    // Ignore audio context restrictions
  }
}

export function playCapcomChime(urgent = false): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = urgent ? 'triangle' : 'sine';

    if (urgent) {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.11);
      osc.frequency.setValueAtTime(880, now + 0.22);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else {
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.setValueAtTime(1318.5, now + 0.09);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    }

    window.setTimeout(() => {
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    }, 450);
  } catch {
    // Ignore audio context restrictions
  }
}

export function stopNasaSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore speech cancel errors
    }
  }
}

export function speakNasaText(text: string, options: NasaSpeechOptions = {}): void {
  const {
    muted = false,
    urgent = false,
    rate = 0.98,
    pitch = 1.12,
    queue = false,
    radioComms = false,
    onStart,
    onEnd,
  } = options;

  if (muted) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;

  const dispatch = () => {
    try {
      if (!queue) {
        synth.cancel();
      }
      if (!radioComms) {
        playCapcomChime(urgent);
      } else if (!synth.speaking && !synth.pending) {
        playQuindarTone('intro');
      }

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const femaleVoice = pickFemaleNasaVoice(voices);
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      utterance.lang = femaleVoice?.lang || 'en-US';
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.volume = 0.96;
      utterance.onstart = () => {
        if (radioComms && queue) {
          playQuindarTone('intro');
        }
        onStart?.(femaleVoice?.name || 'NASA Flight Officer');
      };
      utterance.onend = () => {
        if (radioComms) {
          playQuindarTone('outro');
        }
        onEnd?.();
      };
      utterance.onerror = () => {
        onEnd?.();
      };
      synth.speak(utterance);
    } catch {
      onEnd?.();
    }
  };

  if (synth.getVoices().length === 0) {
    let triggered = false;
    const onVoices = () => {
      if (triggered) return;
      triggered = true;
      synth.removeEventListener?.('voiceschanged', onVoices);
      if (!muted) {
        dispatch();
      }
    };
    synth.addEventListener?.('voiceschanged', onVoices);
    window.setTimeout(onVoices, 200);
  } else {
    dispatch();
  }
}

export function buildAstronautVoiceScript(
  astro: AstronautProfile,
  state: MissionState
): string {
  const powerPct = Math.round(
    (state.resources.battery.current / Math.max(1, state.resources.battery.max)) * 100
  );

  // Survival priorities tailored to live outpost telemetry
  const survivalTips: string[] = [];
  if (state.stormFlue.cloggedPct >= 50) {
    survivalTips.push(
      `Clear the storm flue right away, it is ${state.stormFlue.cloggedPct} percent blocked.`
    );
  }
  if (state.resources.oxygen.current <= 40) {
    survivalTips.push(
      `Oxygen is down to ${Math.round(state.resources.oxygen.current)} percent, service life support and keep habitats online.`
    );
  }
  if (state.resources.water.current <= 40) {
    survivalTips.push(
      `Water reserves are at ${Math.round(state.resources.water.current)} percent, inspect water recyclers and ice drills.`
    );
  }
  if (state.resources.food.current <= 40) {
    survivalTips.push(
      `Food rations are low at ${Math.round(state.resources.food.current)} percent, tend the greenhouse immediately.`
    );
  }
  if (powerPct <= 35) {
    survivalTips.push(
      `Battery power is at ${powerPct} percent, calibrate solar panels or toggle non-essential modules to standby.`
    );
  }
  if (state.crew.radiationExposure >= 45 || state.resources.shielding < 45) {
    survivalTips.push(
      'Radiation levels are rising, reinforce shelter shielding and shorten open-surface walks.'
    );
  }

  let roleTaskAndSurvival = '';
  switch (astro.id) {
    case 'abubakr':
      roleTaskAndSurvival =
        `Commander Abubakr, you are on ${state.planetName}. Your NASA task is to inspect and clear the storm flue and coordinate crew safety. To survive, watch exhaust pressure daily, keep your helmet sealed in storms, and press E near the storm flue or outpost modules.`;
      break;
    case 'affan':
      roleTaskAndSurvival =
        `Specialist Affan, welcome to ${state.planetName}. Your NASA task is polar water-ice drilling and oxygen extraction. To survive, inspect data nodes to extract water and oxygen, keep your suit pressure steady, and watch power draw on ISRU drills.`;
      break;
    case 'ali':
      roleTaskAndSurvival =
        `Engineer Ali, reporting on ${state.planetName}. Your NASA task is calibrating solar arrays and battery banks. To survive, keep battery storage charged before dark or dusty storm cycles, and press E beside power modules to restore energy.`;
      break;
    case 'jawwad':
      roleTaskAndSurvival =
        `Officer Jawwad, active on ${state.planetName}. Your NASA task is managing the greenhouse crops and closed-loop water recycling. To survive, keep water flowing to hydroponic beds and service life-support modules to feed the crew.`;
      break;
    case 'om':
      roleTaskAndSurvival =
        `Officer Om, online on ${state.planetName}. Your NASA task is radiation shielding monitoring and deep-space comms uplink. To survive, watch cosmic radiation meters, service radiation shelters, and collect planetary science telemetry.`;
      break;
    case 'ammar':
      roleTaskAndSurvival =
        `Specialist Ammar, active on ${state.planetName}. Your NASA task is sampling cryogenic haze and de-icing methane vents. To survive, keep thermal suit heaters steady, clear frost from storm flues, and safeguard battery storage.`;
      break;
  }

  const survivalFollowup =
    survivalTips.length > 0
      ? ` Priority survival check: ${survivalTips[0]}`
      : ' Outpost vitals look stable—stay near life support, complete your daily inspection, and conserve energy.';

  return `${roleTaskAndSurvival}${survivalFollowup}`;
}

export function detectCriticalMissionAlert(state: MissionState): MissionVoiceAlert | null {
  const powerPct = Math.round(
    (state.resources.battery.current / Math.max(1, state.resources.battery.max)) * 100
  );

  if (state.activeEvent) {
    return {
      key: `event-${state.day}-${state.activeEvent.id}`,
      title: `NASA Alert · ${state.activeEvent.title}`,
      spokenText: `Attention crew, urgent NASA alert on ${state.planetName}. ${state.activeEvent.title}. Open the Emergency Center now to protect crew survival.`,
      severity: 'danger',
    };
  }

  if (state.stormFlue.cloggedPct >= 65) {
    return {
      key: `flue-${state.day}-${state.stormFlue.cloggedPct >= 80 ? 'crit' : 'warn'}`,
      title: `Storm Flue Alert · ${state.stormFlue.cloggedPct}% Blocked`,
      spokenText: `Storm warning on ${state.planetName}. Dust and debris have clogged the storm flue to ${state.stormFlue.cloggedPct} percent. Send Commander Abubakr or an astronaut to clear the storm flue immediately.`,
      severity: state.stormFlue.cloggedPct >= 80 ? 'danger' : 'warning',
    };
  }

  if (state.resources.oxygen.current <= 30) {
    return {
      key: `oxy-${state.day}`,
      title: `Oxygen Shortage · ${Math.round(state.resources.oxygen.current)}%`,
      spokenText: `Oxygen shortage alert! Reserves have dropped to ${Math.round(state.resources.oxygen.current)} percent. Service habitats or greenhouses right away to survive.`,
      severity: 'danger',
    };
  }

  if (state.resources.water.current <= 30) {
    return {
      key: `water-${state.day}`,
      title: `Water Shortage · ${Math.round(state.resources.water.current)}%`,
      spokenText: `Water shortage alert! Supply is down to ${Math.round(state.resources.water.current)} percent. Send Affan or Jawwad to inspect water recycling and ice extraction.`,
      severity: 'danger',
    };
  }

  if (state.resources.food.current <= 30) {
    return {
      key: `food-${state.day}`,
      title: `Food Ration Shortage · ${Math.round(state.resources.food.current)}%`,
      spokenText: `Food shortage warning! Rations are down to ${Math.round(state.resources.food.current)} percent. Have Jawwad service the greenhouse to boost crop yield.`,
      severity: 'warning',
    };
  }

  if (powerPct <= 25) {
    return {
      key: `power-${state.day}`,
      title: `Low Battery Reserve · ${powerPct}%`,
      spokenText: `Power shortage warning! Outpost battery reserves are down to ${powerPct} percent. Send Engineer Ali to calibrate solar arrays or place extra modules on standby.`,
      severity: 'warning',
    };
  }

  if (state.crew.radiationExposure >= 65) {
    return {
      key: `rad-${state.day}`,
      title: `Radiation Alert · ${Math.round(state.crew.radiationExposure)}%`,
      spokenText: `High radiation alert on ${state.planetName}! Exposure has reached ${Math.round(state.crew.radiationExposure)} percent. Have Officer Om service the radiation shelter immediately.`,
      severity: 'danger',
    };
  }

  return null;
}
