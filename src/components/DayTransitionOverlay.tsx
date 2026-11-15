import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface DayTransitionRequest {
  id: number;
  completedDay: number;
  nextDay: number;
  maxDays: number;
  planetName: string;
  isFinalDay: boolean;
}

interface DayTransitionOverlayProps {
  transition: DayTransitionRequest | null;
  isMuted: boolean;
  onActivateNextDay: () => void;
  onComplete: () => void;
}

type TransitionPhase =
  | 'fade_to_black'
  | 'completed_msg'
  | 'next_day_msg'
  | 'fade_to_gameplay';

function playCompletionChime(muted: boolean) {
  if (muted) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.11, now + 0.14);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);
    master.connect(ctx.destination);

    // Warm futuristic triad (D4 - A4 - E5 - F#5)
    const notes = [293.66, 440.0, 659.25, 739.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx < 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(
        idx === 0 ? 0.42 : 0.24,
        now + idx * 0.12 + 0.12
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + idx * 0.12);
      osc.stop(now + 2.3);
    });

    window.setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
    }, 2600);
  } catch {
    // Ignore audio errors when autoplay/context blocked
  }
}

function playNextDayCue(muted: boolean) {
  if (muted) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.09, now + 0.1);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);
    master.connect(ctx.destination);

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(220, now);
    oscA.frequency.exponentialRampToValueAtTime(440, now + 0.7);
    const gainA = ctx.createGain();
    gainA.gain.setValueAtTime(0.35, now);
    gainA.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    oscA.connect(gainA);
    gainA.connect(master);
    oscA.start(now);
    oscA.stop(now + 1.75);

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(587.33, now + 0.18);
    const gainB = ctx.createGain();
    gainB.gain.setValueAtTime(0.0001, now + 0.18);
    gainB.gain.exponentialRampToValueAtTime(0.24, now + 0.34);
    gainB.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);
    oscB.connect(gainB);
    gainB.connect(master);
    oscB.start(now + 0.18);
    oscB.stop(now + 1.8);

    window.setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
    }, 2100);
  } catch {
    // Ignore audio errors
  }
}

export default function DayTransitionOverlay({
  transition,
  isMuted,
  onActivateNextDay,
  onComplete,
}: DayTransitionOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<TransitionPhase>('fade_to_black');
  const [backdropVisible, setBackdropVisible] = useState(false);

  const callbacksRef = useRef({ onActivateNextDay, onComplete });
  callbacksRef.current = { onActivateNextDay, onComplete };
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    if (!transition) return;

    const fadeBlackMs = prefersReducedMotion ? 250 : 850;
    const completedHoldMs = prefersReducedMotion ? 1600 : 2750;
    const nextDayHoldMs = transition.isFinalDay
      ? 0
      : prefersReducedMotion
      ? 1400
      : 2450;
    const fadeOutMs = prefersReducedMotion ? 250 : 850;

    setPhase('fade_to_black');
    setBackdropVisible(false);

    const timers: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const t = window.setTimeout(fn, ms);
      timers.push(t);
    };

    // Start fading gameplay to pure black on next animation frame
    const raf = window.requestAnimationFrame(() => {
      setBackdropVisible(true);
    });

    // Show DAY X COMPLETED SUCCESSFULLY
    schedule(() => {
      setPhase('completed_msg');
      playCompletionChime(isMutedRef.current);
    }, fadeBlackMs);

    if (transition.isFinalDay) {
      // Final mission day: activate report behind black veil, then reveal
      schedule(() => {
        callbacksRef.current.onActivateNextDay();
        setPhase('fade_to_gameplay');
        setBackdropVisible(false);
      }, fadeBlackMs + completedHoldMs);

      schedule(() => {
        callbacksRef.current.onComplete();
      }, fadeBlackMs + completedHoldMs + fadeOutMs);
    } else {
      // Transition to DAY X+1 STARTS NOW & activate next day behind black screen
      schedule(() => {
        callbacksRef.current.onActivateNextDay();
        setPhase('next_day_msg');
        playNextDayCue(isMutedRef.current);
      }, fadeBlackMs + completedHoldMs);

      // Smoothly fade black curtain out to reveal Day X+1 gameplay
      schedule(() => {
        setPhase('fade_to_gameplay');
        setBackdropVisible(false);
      }, fadeBlackMs + completedHoldMs + nextDayHoldMs);

      schedule(() => {
        callbacksRef.current.onComplete();
      }, fadeBlackMs + completedHoldMs + nextDayHoldMs + fadeOutMs);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [transition, prefersReducedMotion]);

  if (!transition) return null;

  const fadeSeconds = prefersReducedMotion ? 0.2 : 0.8;

  return (
    <motion.div
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: backdropVisible ? 1 : 0 }}
      transition={{ duration: fadeSeconds, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[120] bg-black flex items-center justify-center px-6 select-none overflow-hidden"
    >
      {/* Subtle futuristic ambient glow along the horizon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            phase === 'next_day_msg'
              ? 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.12) 0%, rgba(14, 165, 233, 0.06) 28%, rgba(0, 0, 0, 1) 66%)'
              : 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.13) 0%, rgba(14, 165, 233, 0.05) 30%, rgba(0, 0, 0, 1) 68%)',
        }}
      />

      <div className="relative z-10 max-w-4xl w-full text-center">
        <AnimatePresence mode="wait">
          {phase === 'completed_msg' && (
            <motion.div
              key={`completed-${transition.completedDay}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 1.02 }}
              transition={{ duration: prefersReducedMotion ? 0.2 : 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-5"
            >
              <div className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.42em] text-sky-400/85">
                {transition.planetName} · Sol Log {String(transition.completedDay).padStart(2, '0')} / {transition.maxDays}
              </div>

              <h1
                className="font-display font-bold uppercase tracking-[0.14em] text-3xl sm:text-5xl md:text-6xl text-white leading-tight"
                style={{
                  textShadow:
                    '0 0 28px rgba(56, 189, 248, 0.55), 0 0 64px rgba(14, 165, 233, 0.28)',
                }}
              >
                DAY {transition.completedDay} COMPLETED SUCCESSFULLY
              </h1>

              <motion.div
                aria-hidden="true"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="h-[1px] w-48 sm:w-72 bg-gradient-to-r from-transparent via-sky-400/80 to-transparent"
              />

              <p className="text-xs sm:text-sm font-mono tracking-[0.2em] uppercase text-slate-400">
                {transition.isFinalDay
                  ? 'Final expedition logs secured · Preparing mission report'
                  : 'All daily tasks & planetary data secured'}
              </p>
            </motion.div>
          )}

          {phase === 'next_day_msg' && (
            <motion.div
              key={`next-${transition.nextDay}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
              transition={{ duration: prefersReducedMotion ? 0.2 : 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-5"
            >
              <div className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.42em] text-emerald-400/85">
                {transition.planetName} · Cycle {String(transition.nextDay).padStart(2, '0')} / {transition.maxDays}
              </div>

              <h1
                className="font-display font-bold uppercase tracking-[0.16em] text-3xl sm:text-5xl md:text-6xl text-white leading-tight"
                style={{
                  textShadow:
                    '0 0 28px rgba(52, 211, 153, 0.52), 0 0 68px rgba(56, 189, 248, 0.3)',
                }}
              >
                DAY {transition.nextDay} STARTS NOW
              </h1>

              <motion.div
                aria-hidden="true"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.75, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="h-[1px] w-52 sm:w-80 bg-gradient-to-r from-transparent via-emerald-400/85 to-transparent"
              />

              <p className="text-xs sm:text-sm font-mono tracking-[0.22em] uppercase text-slate-400">
                Initializing crew shifts &amp; environmental telemetry
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
