import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Droplets,
  Shield,
  Target,
  Users,
  Utensils,
  Wind,
  Zap,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { ASTRONAUTS } from '../data/astronauts';
import { DIFFICULTIES, PLANETS } from '../data/planets';
import { MISSION_SYSTEMS_TUTORIAL } from '../data/missions';
import type { MissionConfig } from '../types';

interface BriefingProps {
  config: MissionConfig;
  onBack: () => void;
  onLaunchBuilder: () => void;
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
  onBack,
  onLaunchBuilder,
  onGoHome,
}: BriefingProps) {
  const planet = PLANETS.find((p) => p.id === config.planetId) || PLANETS[0];
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[1];
  const [activeTab, setActiveTab] = useState(MISSION_SYSTEMS_TUTORIAL[0].id);

  const activeSystem = MISSION_SYSTEMS_TUTORIAL.find((s) => s.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] hud-grid">
      <Navbar
        showLandingNav={false}
        onGoHome={onGoHome}
        stepText="Step 3 of 4 · Mission Briefing"
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Change Planet
        </button>

        {/* Operation Dossier */}
        <section className="rounded-xl bg-space-900 border border-slate-800 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1">
                {planet.missionCode}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {planet.operationName}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Commander: <span className="text-white font-medium">{config.playerName}</span> ·
                Gravity: <span className="text-sky-300 font-mono">{planet.gravityMs2} m/s²</span> ·
                Atmo: <span className="text-slate-200 font-mono">{planet.atmosphereKpa} kPa</span> ·
                Duration:{' '}
                <span className="text-white font-mono tabular-nums">
                  {config.missionDays} Days
                </span>
              </p>
            </div>

            <div className="px-4 py-3 rounded-lg bg-space-950 border border-slate-800 text-right">
              <div className="text-xs font-mono text-slate-400">Construction Budget</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-emerald-400">
                {difficulty.budget.toLocaleString()}{' '}
                <span className="text-xs text-slate-400">CR</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sky-400 font-display font-semibold mb-2">
                <Target className="w-4 h-4" /> Mission Objective
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Establish a functioning {planet.name.toLowerCase()} outpost, keep{' '}
                <strong className="text-white">all 6 astronauts</strong> healthy for{' '}
                <strong className="text-white">{config.missionDays} simulated days</strong>, maintain
                comms &amp; fuel, plant your expedition flag, and gather planetary data.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-amber-400 font-display font-semibold mb-2">
                <AlertCircle className="w-4 h-4" /> Mission Constraints
              </div>
              <ul className="text-sm text-slate-300 space-y-1.5">
                <li>· Strict budget ({difficulty.budget} credits) &amp; finite spare parts</li>
                <li>· Medical alerts (dehydration, fatigue, illness) need treatment</li>
                <li>· Severe storms trigger crew refuge &amp; persistent structural damage</li>
                <li>· Keep Starship fueled before flying to unvisited worlds</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-display font-semibold mb-2">
                <CheckCircle2 className="w-4 h-4" /> Success Criteria
              </div>
              <ul className="text-sm text-slate-300 space-y-1.5">
                <li>· Keep critical life-support systems above 0%</li>
                <li>· Repair comms disruptions &amp; inspect post-storm damage</li>
                <li>· Switch between all 6 astronauts in 3D to finish NASA tasks</li>
                <li>· Collect surface data across deployed worlds</li>
              </ul>
            </div>
          </div>
        </section>

        {/* NASA 6-Astronaut Crew Roster */}
        <section className="rounded-xl bg-space-900 border border-slate-800 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> NASA Crew Manifest (6 Specialists)
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
                  <div className="text-[11px] font-mono text-amber-300/90 mb-1.5">
                    {astro.nasaRequirement}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{astro.taskDescription}</p>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 font-mono">
                  Bonus: {astro.specialtyBonus}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pre-Flight Systems Tutorial */}
        <section className="rounded-xl bg-space-900 border border-slate-800 p-6 sm:p-8">
          <div className="mb-5">
            <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1">
              Pre-Flight Systems Tutorial
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
                  NASA STEM & ISRU Insight
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeSystem.scienceNote}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onLaunchBuilder}
              className="px-8 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              Proceed to Outpost Builder
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
