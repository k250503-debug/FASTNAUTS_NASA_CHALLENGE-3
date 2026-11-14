import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ResourceCardProps {
  title: string;
  valueText: string;
  unitText?: string;
  percent: number;
  statusText: string;
  statusTone: 'emerald' | 'sky' | 'amber' | 'rose';
  deltaText?: string;
  icon: LucideIcon;
  onClick: () => void;
}

const TONE_MAP = {
  emerald: {
    status: 'text-emerald-400',
    glyph: '●',
    bar: 'bg-emerald-400',
    icon: 'text-emerald-400',
  },
  sky: {
    status: 'text-sky-400',
    glyph: '●',
    bar: 'bg-sky-400',
    icon: 'text-sky-400',
  },
  amber: {
    status: 'text-amber-400',
    glyph: '▲',
    bar: 'bg-amber-400',
    icon: 'text-amber-400',
  },
  rose: {
    status: 'text-rose-400',
    glyph: '✖',
    bar: 'bg-rose-500',
    icon: 'text-rose-400',
  },
};

export default function ResourceCard({
  title,
  valueText,
  unitText,
  percent,
  statusText,
  statusTone,
  deltaText,
  icon: Icon,
  onClick,
}: ResourceCardProps) {
  const tone = TONE_MAP[statusTone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-4 rounded-xl bg-space-900 border border-slate-800 hover:border-sky-500/60 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 truncate">
          {title}
        </span>
        <Icon className={`w-4 h-4 shrink-0 ${tone.icon}`} />
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-baseline">
          <span className="font-mono tabular-nums text-2xl font-semibold text-white">
            {valueText}
          </span>
          {unitText && (
            <span className="font-mono text-xs text-slate-400 ml-1">{unitText}</span>
          )}
        </div>
        <span className={`font-mono text-xs whitespace-nowrap ${tone.status}`}>
          {tone.glyph} {statusText}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-space-950 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${tone.bar}`}
          style={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
        />
      </div>

      {deltaText && (
        <div className="font-mono tabular-nums text-[11px] text-slate-400 truncate">
          {deltaText}
        </div>
      )}
    </button>
  );
}
