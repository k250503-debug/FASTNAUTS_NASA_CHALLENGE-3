import { useEffect, useRef } from 'react';

export const TOUR_SOUNDTRACK_PATH =
  '/assets/aistudio/quentingaming-interstellar-582594_0476c16e.mp3';

interface UseTourSoundtrackOptions {
  enabled: boolean;
  muted: boolean;
  volume?: number;
  restartSignal?: number;
}

export function useTourSoundtrack({
  enabled,
  muted,
  volume = 0.5,
  restartSignal = 0,
}: UseTourSoundtrackOptions): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const mutedRef = useRef(muted);
  const targetVolRef = useRef(volume);

  enabledRef.current = enabled;
  mutedRef.current = muted;
  targetVolRef.current = Math.max(0, Math.min(1, volume));

  const clearFade = () => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const fadeTo = (audio: HTMLAudioElement, target: number, onDone?: () => void) => {
    clearFade();
    const clampedTarget = Math.max(0, Math.min(1, target));
    const startVol = audio.volume;
    const diff = clampedTarget - startVol;
    if (Math.abs(diff) < 0.015) {
      audio.volume = clampedTarget;
      onDone?.();
      return;
    }
    const steps = 16;
    let step = 0;
    fadeTimerRef.current = window.setInterval(() => {
      step += 1;
      const t = step / steps;
      audio.volume = Math.max(0, Math.min(1, startVol + diff * t));
      if (step >= steps) {
        clearFade();
        audio.volume = clampedTarget;
        onDone?.();
      }
    }, 30);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;

    const audio = new Audio(TOUR_SOUNDTRACK_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audioRef.current = audio;

    let unlocked = false;

    const removeUnlockListeners = () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };

    const attemptPlay = () => {
      if (!enabledRef.current || mutedRef.current) return;
      audio.muted = false;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            unlocked = true;
            removeUnlockListeners();
            fadeTo(audio, targetVolRef.current);
          })
          .catch(() => {
            // Browser blocked autoplay before first gesture; unlock listeners remain active.
          });
      } else {
        unlocked = true;
        fadeTo(audio, targetVolRef.current);
      }
    };

    function handleUnlock() {
      if (unlocked) {
        removeUnlockListeners();
        return;
      }
      attemptPlay();
    }

    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    window.addEventListener('touchstart', handleUnlock, { passive: true });

    attemptPlay();

    return () => {
      clearFade();
      removeUnlockListeners();
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Ignore cleanup errors
      }
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!enabled || muted) {
      audio.muted = muted;
      fadeTo(audio, 0, () => {
        if (!enabledRef.current || mutedRef.current) {
          audio.pause();
        }
      });
      return;
    }

    audio.muted = false;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          fadeTo(audio, targetVolRef.current);
        })
        .catch(() => {
          // Will start automatically on next user gesture via unlock listeners
        });
    } else {
      fadeTo(audio, targetVolRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, muted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || restartSignal <= 0) return;
    try {
      audio.currentTime = 0;
    } catch {
      // Ignore seek errors before metadata loads
    }
    if (enabledRef.current && !mutedRef.current) {
      audio.muted = false;
      audio
        .play()
        .then(() => fadeTo(audio, targetVolRef.current))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartSignal]);
}
