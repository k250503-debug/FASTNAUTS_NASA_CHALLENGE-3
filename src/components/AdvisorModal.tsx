import React, { useState } from 'react';
import { Bot, Send, X, AlertCircle, Cpu } from 'lucide-react';
import type { DailyRates, MissionState } from '../types';
import { getBuildingDef } from '../data/buildings';

interface AdvisorModalProps {
  state: MissionState;
  preview: DailyRates;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'advisor';
  text: string;
  source?: 'gemini' | 'telemetry';
}

const SUGGESTED_QUESTIONS = [
  'Why is my water decreasing?',
  'What should I upgrade next?',
  'How do I survive lunar shadow or dust storms?',
  'Explain how greenhouses affect other systems.',
];

function buildDeterministicDiagnostics(state: MissionState, preview: DailyRates, question: string): string {
  const q = question.toLowerCase();
  const waterNet = Number((preview.waterProd - preview.waterCons).toFixed(1));
  const oxyNet = Number((preview.oxygenProd - preview.oxygenCons).toFixed(1));
  const foodNet = Number((preview.foodProd - preview.foodCons).toFixed(1));
  const powerNet = preview.powerGen - preview.powerUsed;

  if (q.includes('water')) {
    return `Your outpost produces +${preview.waterProd} water/day and consumes -${preview.waterCons} water/day (net ${waterNet >= 0 ? '+' : ''}${waterNet}/day). Remember that Hydroponic Greenhouses draw extra irrigation water (-5/day per greenhouse). To stabilize water, upgrade your Water Recycler, unlock the Closed-Loop Membrane Filter in Research Tech, or toggle a second Greenhouse to Standby if food reserves are comfortable.`;
  }
  if (q.includes('power') || q.includes('solar') || q.includes('battery') || q.includes('storm') || q.includes('shadow')) {
    return `Today's solar condition is ${preview.solarCondition}, yielding +${preview.powerGen} kWh against -${preview.powerUsed} kWh demand (net ${powerNet >= 0 ? '+' : ''}${powerNet} kWh). Battery storage sits at ${state.resources.battery.current}/${state.resources.battery.max} kWh. Upgrading Solar Arrays, researching Perovskite Solar Coating (+15%), or placing non-essential modules on Standby prevents brownouts during dark phases.`;
  }
  if (q.includes('greenhouse') || q.includes('food')) {
    return `Your food balance is +${preview.foodProd} vs -${preview.foodCons}/day (net ${foodNet >= 0 ? '+' : ''}${foodNet}/day). In space engineering, greenhouses create a classic trade-off: each one grows fresh crops (+7 food) and oxygen (+4 O₂), yet demands +9 kWh power and -5 water/day.`;
  }

  const bottlenecks: string[] = [];
  if (waterNet < 0) bottlenecks.push(`Water (${waterNet}/day)`);
  if (oxyNet < 0) bottlenecks.push(`Oxygen (${oxyNet}/day)`);
  if (foodNet < 0) bottlenecks.push(`Food (${foodNet}/day)`);
  if (powerNet < 0) bottlenecks.push(`Power (${powerNet} kWh/day)`);
  if (state.resources.shielding < 45) bottlenecks.push(`Radiation Shielding (${state.resources.shielding}%)`);

  if (bottlenecks.length > 0) {
    return `Live Telemetry Diagnostic (Day ${state.day}): Watch ${bottlenecks.join(', ')}. Consider upgrading modules that close negative daily loops first, or spend Science Points (${state.sciencePoints} SCI) in Research Tech to boost efficiency without adding extra power draw.`;
  }

  return `Telemetry Nominal on Day ${state.day}: All core daily balances are positive (O₂ ${oxyNet >= 0 ? '+' : ''}${oxyNet}, H₂O ${waterNet >= 0 ? '+' : ''}${waterNet}, Power ${powerNet >= 0 ? '+' : ''}${powerNet} kWh). Keep building battery reserve or radiation shielding (${state.resources.shielding}%) ahead of future solar events.`;
}

export default function AdvisorModal({ state, preview, onClose }: AdvisorModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'advisor',
      text: `Commander ${state.playerName}, I am monitoring Day ${state.day} telemetry on ${state.planetName}. Ask why a resource is changing, what to upgrade next, or how ISRU systems interact.`,
      source: 'telemetry',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  const askQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    setApiNotice(null);

    try {
      const response = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          telemetry: {
            planetName: state.planetName,
            day: state.day,
            maxDays: state.maxDays,
            budget: state.budget,
            sciencePoints: state.sciencePoints,
            solarCondition: preview.solarCondition,
            oxygen: state.resources.oxygen.current,
            water: state.resources.water.current,
            food: state.resources.food.current,
            battery: state.resources.battery.current,
            batteryMax: state.resources.battery.max,
            shielding: state.resources.shielding,
            radiationExposure: state.crew.radiationExposure,
            rates: {
              oxygenProd: preview.oxygenProd,
              oxygenCons: preview.oxygenCons,
              waterProd: preview.waterProd,
              waterCons: preview.waterCons,
              foodProd: preview.foodProd,
              foodCons: preview.foodCons,
              powerGen: preview.powerGen,
              powerUsed: preview.powerUsed,
            },
            buildingsSummary: state.buildings.map(
              (b) =>
                `${getBuildingDef(b.typeId)?.shortName || b.typeId} Lv${b.level} (${
                  b.online ? 'Online' : 'Standby'
                })`
            ),
            activeEventTitle: state.activeEvent?.title || null,
          },
        }),
      });

      const data = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !data.answer) {
        setApiNotice(
          data.error ||
            'Live AI Advisor unavailable right now. Switched to Built-in Telemetry Diagnostics.'
        );
        const fallback = buildDeterministicDiagnostics(state, preview, trimmed);
        setMessages((prev) => [
          ...prev,
          { role: 'advisor', text: fallback, source: 'telemetry' },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'advisor', text: data.answer!, source: 'gemini' },
        ]);
      }
    } catch {
      setApiNotice('Network error contacting /api/advisor. Showing Built-in Telemetry Diagnostics.');
      const fallback = buildDeterministicDiagnostics(state, preview, trimmed);
      setMessages((prev) => [
        ...prev,
        { role: 'advisor', text: fallback, source: 'telemetry' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full rounded-xl bg-space-900 border border-slate-700 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                AI Mission Advisor
              </h2>
              <p className="text-xs text-slate-400">
                Telemetry-aware STEM guidance · Day {state.day} on {state.planetName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Mission Advisor"
            className="p-2 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {apiNotice && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{apiNotice}</span>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-sky-500/15 border border-sky-500/30 text-white ml-8'
                  : 'bg-space-950 border border-slate-800 text-slate-200 mr-8'
              }`}
            >
              {msg.role === 'advisor' && (
                <div className="text-[11px] font-mono text-sky-400 mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  {msg.source === 'gemini' ? 'ASTRA Flight Director' : 'Telemetry Diagnostics'}
                </div>
              )}
              {msg.text}
            </div>
          ))}

          {loading && (
            <div className="p-3.5 rounded-lg bg-space-950 border border-slate-800 text-xs font-mono text-slate-400 mr-8">
              Analyzing outpost telemetry...
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-space-950/60">
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => askQuestion(q)}
                className="px-3 py-1.5 rounded-lg bg-space-800 hover:bg-space-700 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askQuestion(input);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about water, power, ISRU, or upgrades..."
              className="flex-1 px-4 py-2.5 rounded-lg bg-space-950 border border-slate-700 focus:border-sky-400 focus:outline-none text-sm text-white placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
