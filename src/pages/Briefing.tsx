import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Droplets,
  Rocket,
  Shield,
  Target,
  Users,
  Utensils,
  Wind,
  Zap,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { ASTRONAUTS } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import { DIFFICULTIES, PLANETS } from '../data/planets';
import { MISSION_SYSTEMS_TUTORIAL } from '../data/missions';
import type { MissionConfig, PlacedBuilding } from '../types';

interface BriefingProps {
  config: MissionConfig;
  plannedBuildings?: PlacedBuilding[];
  remainingBudget?: number;
  onBack: () => void;
  onLaunchMission: () => void;
  onGoHome: () => void;
}

const ICON_MAP = {
  oxygen: Wind,
  water: Droplets,
  food: Utensils,
  power: Zap,
  radiation: Shield,
};

export default function Briefing({
  config,
  plannedBuildings = [],
  remainingBudget,
  onBack,
  onLaunchMission,
  onGoHome,
}: BriefingProps) {
  const planet = PLANETS.find((p) => p.id === config.planetId) || PLANETS[0];
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[1];
  const [activeTab, setActiveTab] = useState(MISSION_SYSTEMS_TUTORIAL[0].id);

  const activeSystem = MISSION_SYSTEMS_TUTORIAL.find((s) => s.id === activeTab);
  const reserve = remainingBudget ?? difficulty.budget;

  const moduleCounts = plannedBuildings.reduce<Record<string, number>>((acc, b) => {
    acc[b.typeId] = (acc[b.typeId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] hud-grid">
      <Navbar
        showLandingNav={false}
        onGoHome={onGoHome}
        stepText="Step 3 of 3 · Mission Briefing"
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Base Construction
        </button>

        {/* Operation Dossier */}
        <section className="rounded-xl bg-space-900 border border-slate-800 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1">
                {planet.missionCode}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {planet.operationName} · {planet.name}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Commander:{' '}
                <span className="text-white font-medium">
                  {config.playerName.trim() || 'Commander'}
                </span>{' '}
                · Gravity: <span className="text-sky-300 font-mono">{planet.gravityMs2} m/s²</span>{' '}
                · Atmo: <span className="text-slate-200 font-mono">{planet.atmosphereKpa} kPa</span>{' '}
                · Duration:{' '}
                <span className="text-white font-mono tabular-nums">
                  {config.missionDays} Days
                </span>
              </p>
            </div>

            <div className="px-4 py-3 rounded-lg bg-space-950 border border-slate-800 text-right shrink-0">
              <div className="text-xs font-mono text-slate-400">
                {plannedBuildings.length} Modules Ready · Remaining Reserve
              </div>
              <div className="font-mono tabular-nums text-2xl font-bold text-emerald-400">
                {reserve.toLocaleString()} <span className="text-xs text-slate-400">CR</span>
              </div>
            </div>
          </div>

          {plannedBuildings.length > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-space-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono uppercase tracking-wider text-sky-400">
                Constructed Outpost Manifest
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-slate-200">
                {Object.entries(moduleCounts).map(([typeId, count]) => {
                  const def = getBuildingDef(typeId as PlacedBuilding['typeId']);
                  return (
                    <span key={typeId}>
                      <strong className="text-emerald-400">{count}×</strong>{' '}
                      {def?.shortName || typeId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sky-400 font-display font-semibold mb-2">
                <Target className="w-4 h-4" /> Mission Objective
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Establish your constructed {planet.name} outpost, keep{' '}
                <strong className="text-white">all 6 astronauts</strong> healthy for{' '}
                <strong className="text-white">{config.missionDays} simulated days</strong>, manage
                base resources, and gather planetary data.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-amber-400 font-display font-semibold mb-2">
                <AlertCircle className="w-4 h-4" /> Mission Constraints
              </div>
              <ul className="text-sm text-slate-300 space-y-1.5">
                <li>· Reserve funds ({reserve} CR) &amp; finite spare parts</li>
                <li>· Medical alerts (dehydration, fatigue, illness) need treatment</li>
                <li>· Severe storms trigger crew shelter &amp; structural wear</li>
                <li>· Keep Starship fueled and dust cleared from arrays</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-display font-semibold mb-2">
                <CheckCircle2 className="w-4 h-4" /> Success Criteria
              </div>
              <ul className="text-sm text-slate-300 space-y-1.5">
                <li>· Keep critical life-support systems above 0%</li>
                <li>· Repair comms disruptions &amp; inspect post-storm damage</li>
                <li>· Switch between all 6 astronauts in 3D for EVA tasks</li>
                <li>· Collect surface data across {planet.name}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Crew Roster */}
        <section className="rounded-xl bg-space-900 border border-slate-800 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Crew Manifest (6 Specialists)
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                Click Any Astronaut in 3D to Take Control
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Move: WASD / Arrows · Jump: [Space] · Interact: [E] or Click
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ASTRONAUTS.map((astro) => (
              <div
                key={astro.id}
                className="p-4 rounded-lg bg-space-950 border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: astro.suitColor }}
                      />
                      <span className="font-display font-bold text-white text-base">
                        {astro.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-sky-400">
                      {astro.assignedWorldName.split('(')[0].trim()}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mb-1">{astro.role}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{astro.taskDescription}</p>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 font-mono">
                  Bonus: {astro.specialtyBonus}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pre-Flight Systems Reference */}
        <section className="rounded-xl bg-space-900 border border-slate-800 p-6 sm:p-8">
          <div className="mb-5">
            <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1">
              Pre-Flight Systems Reference
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              Understand Your Outpost Systems
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {MISSION_SYSTEMS_TUTORIAL.map((sys) => {
              const Icon = ICON_MAP[sys.id];
              const isActive = sys.id === activeTab;
              return (
                <button
                  type="button"
                  key={sys.id}
                  onClick={() => setActiveTab(sys.id)}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-sky-500/15 border-sky-400 text-white'
                      : 'bg-space-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 text-sky-400" />
                  {sys.title}
                </button>
              );
            })}
          </div>

          {activeSystem && (
            <div className="p-5 rounded-lg bg-space-950 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-xs font-mono text-slate-400 mb-1">
                  {activeSystem.unitLabel}
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-2">
                  {activeSystem.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeSystem.summary}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-space-900 border border-slate-800">
                <div className="text-xs font-mono text-sky-400 mb-1">
                  Engineering &amp; ISRU Insight
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeSystem.scienceNote}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-sm text-slate-300 font-medium flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Edit Base Modules
            </button>

            <button
              type="button"
              onClick={onLaunchMission}
              className="px-8 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Rocket className="w-5 h-5" />
              Launch Mission
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
