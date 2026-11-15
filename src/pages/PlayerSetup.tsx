import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Gauge, User } from 'lucide-react';
import Navbar from '../components/Navbar';
import PlanetaryBackdrop3D from '../three/PlanetaryBackdrop3D';
import { DIFFICULTIES, MISSION_LENGTHS } from '../data/planets';
import type { DifficultyId, MissionConfig } from '../types';

interface PlayerSetupProps {
  initialConfig: MissionConfig;
  onBack: () => void;
  onGoHome: () => void;
  onContinue: (data: {
    playerName: string;
    difficulty: DifficultyId;
    missionDays: number;
  }) => void;
}

export default function PlayerSetup({
  initialConfig,
  onBack,
  onGoHome,
  onContinue,
}: PlayerSetupProps) {
  const [playerName, setPlayerName] = useState(initialConfig.playerName);
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialConfig.difficulty);
  const [missionDays, setMissionDays] = useState<number>(initialConfig.missionDays);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed) {
      setError('Enter your commander name to initialize the mission profile.');
      return;
    }
    onContinue({ playerName: trimmed, difficulty, missionDays });
  };

  return (
    <div className="relative min-h-screen flex flex-col text-slate-100">
      <PlanetaryBackdrop3D planetId={initialConfig.planetId} mode="solar" />

      <Navbar
        showLandingNav={false}
        onGoHome={onGoHome}
        stepText="Step 1 of 4 · Commander Profile"
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 relative z-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Welcome
        </button>

        <div className="rounded-2xl astra-glass p-6 sm:p-8">
          <div className="mb-8">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-1">
              Personnel Registration
            </div>
            <h1 className="font-display text-3xl font-bold text-white">
              Commander Setup
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Set your commander callsign, operational constraints, and target mission length.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label
                htmlFor="commander-name"
                className="flex items-center gap-2 text-sm font-medium text-slate-100 mb-2"
              >
                <User className="w-4 h-4 text-cyan-400" />
                Commander Name
              </label>
              <input
                id="commander-name"
                type="text"
                maxLength={28}
                placeholder="e.g., Commander Alex"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-lg astra-glass-subtle focus:border-cyan-400 focus:outline-none text-white placeholder-slate-400 font-medium"
              />
              {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100 mb-3">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Difficulty Level
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DIFFICULTIES.map((mode) => {
                  const selected = difficulty === mode.id;
                  const toneText =
                    mode.accentTone === 'emerald'
                      ? 'text-emerald-400'
                      : mode.accentTone === 'sky'
                      ? 'text-cyan-400'
                      : 'text-amber-400';

                  return (
                    <button
                      type="button"
                      key={mode.id}
                      onClick={() => setDifficulty(mode.id)}
                      className={`text-left p-4 rounded-xl border transition-all relative ${
                        selected
                          ? 'bg-cyan-500/18 border-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.16)]'
                          : 'astra-glass-subtle hover:border-cyan-300/45'
                      }`}
                    >
                      {selected && (
                        <CheckCircle2 className="w-5 h-5 text-cyan-300 absolute top-4 right-4" />
                      )}
                      <div className={`text-xs font-mono mb-1.5 ${toneText}`}>
                        {mode.budget} Credits
                      </div>
                      <div className="font-display font-bold text-lg text-white">
                        {mode.name}
                      </div>
                      <div className="text-xs text-cyan-200 font-medium mb-2">
                        {mode.subtitle}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {mode.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100 mb-3">
                <Clock className="w-4 h-4 text-cyan-400" />
                Preferred Mission Length
              </div>
              <div className="grid grid-cols-3 gap-3">
                {MISSION_LENGTHS.map((len) => {
                  const selected = missionDays === len.days;
                  return (
                    <button
                      type="button"
                      key={len.days}
                      onClick={() => setMissionDays(len.days)}
                      className={`p-3.5 rounded-xl border text-center transition-all ${
                        selected
                          ? 'bg-cyan-500/18 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.14)]'
                          : 'astra-glass-subtle text-slate-200 hover:border-cyan-300/45'
                      }`}
                    >
                      <div className="font-mono tabular-nums font-bold text-lg">
                        {len.label}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">{len.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-7 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-[0_0_24px_rgba(34,211,238,0.28)]"
              >
                Select Destination
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
