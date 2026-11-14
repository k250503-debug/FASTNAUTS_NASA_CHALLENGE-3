import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Shield,
} from 'lucide-react';
import { MISSION_EVENTS } from '../simulation/events';
import type { EventChoice, MissionState } from '../types';

interface EmergencyCenterProps {
  state: MissionState;
  onSelectDecision: (choice: EventChoice) => void;
  onBackToDashboard: () => void;
}

export default function EmergencyCenter({
  state,
  onSelectDecision,
  onBackToDashboard,
}: EmergencyCenterProps) {
  const [showScience, setShowScience] = useState(false);
  const [previewEventId, setPreviewEventId] = useState(MISSION_EVENTS[0].id);

  const active = state.activeEvent;

  if (!active) {
    const previewEvent =
      MISSION_EVENTS.find((e) => e.id === previewEventId) || MISSION_EVENTS[0];

    return (
      <div className="min-h-screen bg-[#07090E] hud-grid p-6">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Mission Control
          </button>

          <div className="rounded-xl bg-space-900 border border-emerald-500/40 p-6 mb-6 flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-mono text-emerald-400">● Systems Nominal</div>
              <h1 className="font-display text-2xl font-bold text-white">
                No Active Emergencies on Day {state.day}
              </h1>
              <p className="text-sm text-slate-300">
                Inspect planetary hazard field guides below or review your past engineering
                decisions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl bg-space-900 border border-slate-800 p-5">
              <div className="text-xs font-mono text-sky-400 mb-3">
                Space Science Hazard Field Guide
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {MISSION_EVENTS.map((ev) => (
                  <button
                    type="button"
                    key={ev.id}
                    onClick={() => setPreviewEventId(ev.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      previewEvent.id === ev.id
                        ? 'bg-sky-500/15 border-sky-400 text-white'
                        : 'bg-space-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
              <div className="p-4 rounded-lg bg-space-950 border border-slate-800">
                <div className="font-semibold text-amber-300 text-sm mb-1">
                  {previewEvent.scienceQuestion}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {previewEvent.scienceExplanation}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-space-900 border border-slate-800 p-5">
              <div className="text-xs font-mono text-sky-400 mb-3">
                Commander Decision History
              </div>
              {state.eventHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No emergency events resolved yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {state.eventHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-space-950 border border-slate-800 text-xs"
                    >
                      <div className="font-mono text-slate-400">
                        Day {item.day} · {item.eventTitle}
                      </div>
                      <div className="text-white font-semibold mt-0.5">{item.choiceLabel}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090E] hud-grid p-4 sm:p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full rounded-xl bg-space-900 border border-rose-500/50 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-rose-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              Emergency Event · Day {state.day}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {active.title}
            </h1>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-space-950 border border-slate-800 text-right">
            <div className="text-xs font-mono text-slate-400">Available Credits</div>
            <div className="font-mono tabular-nums text-lg font-bold text-emerald-400">
              {state.budget} CR
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-space-950 border border-slate-800 mb-6">
          <div className="text-xs font-mono text-amber-400 mb-1">Mission Situation</div>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            {active.description}
          </p>
        </div>

        {/* Educational Toggle: WHY DOES THIS MATTER? */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowScience((prev) => !prev)}
            className="px-4 py-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sky-300 text-sm font-display font-semibold flex items-center gap-2 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            WHY DOES THIS MATTER?
          </button>

          {showScience && (
            <div className="mt-3 p-4 rounded-lg bg-space-950 border border-sky-500/40">
              <div className="flex items-center gap-2 text-xs font-mono text-sky-300 mb-1">
                <Lightbulb className="w-4 h-4" /> {active.scienceQuestion}
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {active.scienceExplanation}
              </p>
            </div>
          )}
        </div>

        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
          Choose Your Engineering Response
        </div>

        <div className="space-y-3">
          {active.choices.map((choice) => {
            const affordable = !choice.requiresBudget || state.budget >= choice.requiresBudget;
            return (
              <button
                type="button"
                key={choice.id}
                disabled={!affordable}
                onClick={() => onSelectDecision(choice)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  affordable
                    ? 'bg-space-950 border-slate-700 hover:border-sky-400 hover:bg-space-800'
                    : 'bg-space-950/50 border-slate-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <span className="font-display font-bold text-base text-white">
                    {choice.label}
                  </span>
                  <span className="text-xs font-mono text-sky-300 whitespace-nowrap">
                    {choice.impactSummary}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="text-emerald-300">
                    <strong>Short-term benefit:</strong> {choice.shortTerm}
                  </div>
                  <div className="text-amber-300">
                    <strong>Long-term trade-off:</strong> {choice.longTerm}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            Your engineering decision updates outpost reserves immediately.
          </span>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-slate-300 hover:text-white underline"
          >
            Inspect Dashboard First
          </button>
        </div>
      </div>
    </div>
  );
}
