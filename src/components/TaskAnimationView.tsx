import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, Fan, Wrench, X } from 'lucide-react';
import { getAstronautById } from '../data/astronauts';
import type { AstronautId } from '../types';

export type AstronautTaskKind =
  | 'service_building'
  | 'collect_data'
  | 'inspect_flue'
  | 'suit_diagnostic';

export interface ActiveTaskDuty {
  astronautId: AstronautId;
  kind: AstronautTaskKind;
  label: string;
  detail: string;
  day: number;
  durationMs: number;
  key: number;
}

interface TaskAnimationViewProps {
  duty: ActiveTaskDuty | null;
  hudHidden?: boolean;
  onDismiss?: () => void;
}

export default function TaskAnimationView({
  duty,
  hudHidden = false,
  onDismiss,
}: TaskAnimationViewProps) {
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    if (!duty) {
      setProgressPct(0);
      return;
    }

    const start = performance.now();
    setProgressPct(4);

    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duty.durationMs) * 100));
      setProgressPct(pct);
      if (pct >= 100) {
        window.clearInterval(timer);
      }
    }, 60);

    return () => {
      window.clearInterval(timer);
    };
  }, [duty]);

  if (!duty) return null;

  const astro = getAstronautById(duty.astronautId);
  const durationSec = `${(duty.durationMs / 1000).toFixed(2)}s`;
  const isComplete = progressPct >= 100;

  const TaskIcon =
    duty.kind === 'collect_data'
      ? Database
      : duty.kind === 'inspect_flue'
      ? Fan
      : Wrench;

  return (
    <aside
      key={duty.key}
      aria-live="polite"
      className={`absolute left-4 z-20 w-[min(340px,92vw)] rounded-xl astra-glass p-3.5 shadow-2xl transition-all ${
        hudHidden ? 'bottom-4' : 'bottom-[154px] sm:bottom-[142px]'
      }`}
      style={{ borderColor: astro.suitColor }}
    >
      {/* Header: Astronaut Busy Status & Simulation Day */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
            <span
              className="px-1.5 py-0.5 rounded font-bold text-slate-950"
              style={{ backgroundColor: isComplete ? '#10B981' : astro.suitColor }}
            >
              {isComplete ? 'DONE' : 'BUSY'}
            </span>
            <span className="text-slate-300">
              Day {String(duty.day).padStart(2, '0')} · Active Duty
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <TaskIcon className="w-3.5 h-3.5 shrink-0" style={{ color: astro.suitColor }} />
            <h4 className="font-display font-bold text-sm text-white truncate">
              {astro.name} · {duty.label}
            </h4>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close task monitor"
            className="text-slate-400 hover:text-white p-0.5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* CSS-Animated Hand Movement Stage + Circular Progress Ring */}
      <div className="rounded-lg astra-glass-subtle px-3 py-2.5 mb-2.5 flex items-center gap-3">
        {/* Animated Upper-Body Astronaut + Moving Left/Right Hands + Target Equipment */}
        <div className="relative w-[132px] h-[74px] shrink-0 rounded-md bg-slate-950/45 border border-cyan-300/20 overflow-hidden hud-grid">
          <svg
            viewBox="0 0 132 74"
            className="w-full h-full"
            aria-label={`${astro.name} hand movement work animation`}
          >
            {/* Floor Line */}
            <line x1="6" y1="68" x2="126" y2="68" stroke="#1E293B" strokeWidth="1.5" />

            {/* PLSS Life Support Backpack */}
            <rect x="14" y="31" width="12" height="24" rx="3" fill="#CBD5E1" />
            <circle cx="17" cy="29" r="2" fill={astro.suitColor} />
            <line x1="21" y1="21" x2="21" y2="31" stroke="#64748B" strokeWidth="1.8" />

            {/* Astronaut Torso */}
            <rect x="24" y="31" width="20" height="28" rx="5" fill="#E2E8F0" />
            <rect x="23" y="38" width="22" height="5" rx="1.5" fill={astro.suitColor} />
            <rect x="38" y="35" width="7" height="9" rx="1.5" fill="#1E293B" />
            <circle cx="41.5" cy="39.5" r="1.6" fill={astro.suitColor} className="astra-work-spark" />

            {/* Articulated Helmet & Gold Visor (Nodding toward hands) */}
            <g className="astra-visor-nod">
              <circle cx="34" cy="20" r="11" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />
              <rect x="33" y="15" width="11.5" height="8" rx="3.5" fill="#F59E0B" />
              <path
                d="M35 17.2 C37.5 16.4, 40.5 16.4, 42.5 17.2"
                stroke="#FEF3C7"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* Left Arm & EVA Gauntlet (Rear working hand) */}
            <g className="astra-hand-left">
              <path
                d="M36 37 L56 44 L69 40"
                stroke="#CBD5E1"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="70" cy="40" r="3.6" fill={astro.suitColor} />
            </g>

            {/* Right Arm & EVA Gauntlet + Held Tool (Foreground working hand) */}
            <g className="astra-hand-right">
              <path
                d="M34 40 L54 48 L68 44"
                stroke="#F8FAFC"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="69" cy="44" r="3.8" fill={astro.suitColor} />
              {/* Task-Specific Handheld Tool */}
              {duty.kind === 'collect_data' ? (
                <g>
                  <line x1="70" y1="44" x2="82" y2="39" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" />
                  <circle cx="83" cy="38.5" r="2.2" fill="#34D399" className="astra-work-spark" />
                </g>
              ) : (
                <g>
                  <line x1="70" y1="44" x2="82" y2="43" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="83" cy="43" r="2.6" fill="#F59E0B" className="astra-work-spark" />
                </g>
              )}
            </g>

            {/* Task-Specific Target Hardware on Right Side */}
            {duty.kind === 'inspect_flue' && (
              <g>
                <rect x="92" y="28" width="26" height="40" rx="3" fill="#1E293B" stroke="#475569" strokeWidth="1.4" />
                <g className="astra-flue-spin">
                  <circle cx="105" cy="43" r="8" fill="#0F172A" stroke="#F59E0B" strokeWidth="1.4" />
                  <line x1="98" y1="43" x2="112" y2="43" stroke="#FBBF24" strokeWidth="2" />
                  <line x1="105" y1="36" x2="105" y2="50" stroke="#FBBF24" strokeWidth="2" />
                </g>
                <circle cx="105" cy="24" r="2.5" fill="#10B981" className="astra-work-spark" />
              </g>
            )}

            {duty.kind === 'collect_data' && (
              <g>
                <polygon points="96,68 105,36 114,68" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.4" />
                <circle cx="105" cy="31" r="6" fill="none" stroke="#38BDF8" strokeWidth="1.8" />
                <circle cx="105" cy="31" r="2.6" fill="#34D399" className="astra-work-spark" />
                <line x1="84" y1="38" x2="101" y2="31" stroke="#34D399" strokeWidth="1.4" strokeDasharray="2 2" />
              </g>
            )}

            {(duty.kind === 'service_building' || duty.kind === 'suit_diagnostic') && (
              <g>
                <rect x="90" y="26" width="30" height="42" rx="3" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.3" />
                <rect x="95" y="32" width="20" height="12" rx="1.5" fill="#0284C7" opacity="0.65" />
                <line x1="95" y1="50" x2="115" y2="50" stroke="#10B981" strokeWidth="2" />
                <line x1="95" y1="56" x2="110" y2="56" stroke="#F59E0B" strokeWidth="2" />
                <circle cx="88" cy="42" r="3" fill="#FBBF24" className="astra-work-spark" />
              </g>
            )}
          </svg>
        </div>

        {/* Duty Summary + Radial Progress Ring */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-200 leading-snug line-clamp-2">
              {duty.detail}
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-400 flex items-center gap-1">
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300">Logged to NASA Telemetry</span>
                </>
              ) : (
                <span>Hands Executing Task...</span>
              )}
            </div>
          </div>

          <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 40 40"
              aria-hidden="true"
              className="w-11 h-11 -rotate-90"
            >
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke={isComplete ? '#10B981' : astro.suitColor}
                strokeWidth="3"
                strokeLinecap="round"
                style={
                  {
                    '--ring-circumference': '100.53',
                    '--duty-duration': durationSec,
                  } as React.CSSProperties
                }
                className="astra-progress-ring"
              />
            </svg>
            <span className="absolute text-[10px] font-mono font-bold tabular-nums text-white">
              {progressPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Smooth CSS Linear Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-slate-950/60 border border-white/10 overflow-hidden">
        <div
          className="h-full w-full astra-task-progress-bar"
          style={
            {
              backgroundColor: isComplete ? '#10B981' : astro.suitColor,
              '--duty-duration': durationSec,
            } as React.CSSProperties
          }
        />
      </div>
    </aside>
  );
}
