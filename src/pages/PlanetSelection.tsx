import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Compass,
  Shield,
  Sun,
  Users,
  Wind,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { ASTRONAUTS } from '../data/astronauts';
import { PLANETS } from '../data/planets';
import type { PlanetId } from '../types';

interface PlanetSelectionProps {
  onSelectPlanet: (planetId: PlanetId) => void;
  onBack: () => void;
  onGoHome: () => void;
}

const PLANET_SPHERE_STYLES: Record<PlanetId, { orb: string; ring?: string; glow: string }> = {
  moon: {
    orb: 'bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700',
    glow: 'shadow-[0_0_50px_rgba(148,163,184,0.28)]',
  },
  mars: {
    orb: 'bg-gradient-to-br from-orange-400 via-amber-700 to-red-950',
    glow: 'shadow-[0_0_50px_rgba(245,158,11,0.3)]',
  },
  titan: {
    orb: 'bg-gradient-to-br from-amber-300 via-amber-600 to-stone-900',
    ring: 'border-amber-200/40',
    glow: 'shadow-[0_0_55px_rgba(245,158,11,0.35)]',
  },
  europa: {
    orb: 'bg-gradient-to-br from-cyan-100 via-sky-300 to-slate-700',
    glow: 'shadow-[0_0_50px_rgba(56,189,248,0.35)]',
  },
};

export default function PlanetSelection({
  onSelectPlanet,
  onBack,
  onGoHome,
}: PlanetSelectionProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] hud-grid">
      <Navbar
        showLandingNav={false}
        onGoHome={onGoHome}
        stepText="Step 2 of 4 · NASA Destination Selection"
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Commander Setup
        </button>

        <div className="mb-8">
          <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1">
            NASA Planetary &amp; Lunar Targets
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Choose Your Initial Landing World
          </h1>
          <p className="text-slate-400 mt-1">
            All 6 astronauts deploy together and can redeploy between The Moon, Mars, Titan, and
            Europa during the 3D mission to fulfill NASA data &amp; storm-flue requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {PLANETS.map((planet) => {
            const isCyanOrSky = planet.accent === 'sky' || planet.accent === 'cyan';
            const hasValidImage = Boolean(planet.imageUrl) && !failedImages[planet.id];
            const sphereStyle = PLANET_SPHERE_STYLES[planet.id];
            const assignedCrew = ASTRONAUTS.filter((a) => a.assignedWorldId === planet.id);

            return (
              <div
                key={planet.id}
                className="rounded-xl bg-space-900 border border-slate-800 hover:border-slate-600 transition-colors overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Orbital Planet Header Visual */}
                  <div className="relative h-52 bg-[#04070D] border-b border-slate-800 overflow-hidden">
                    {hasValidImage ? (
                      <img
                        src={planet.imageUrl}
                        alt={`Orbital surface view of ${planet.name} at ${planet.location}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [planet.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center relative bg-gradient-to-b from-[#070B14] to-[#0B1220]">
                        <div
                          className={`w-28 h-28 rounded-full ${sphereStyle.orb} ${sphereStyle.glow} relative`}
                        >
                          {sphereStyle.ring && (
                            <div
                              className={`absolute -inset-x-9 top-1/2 -translate-y-1/2 h-9 rounded-full border-4 ${sphereStyle.ring} rotate-[-16deg] pointer-events-none`}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-space-900 via-space-900/25 to-transparent" />

                    <div className="absolute top-3 right-4 px-2.5 py-1 rounded bg-[#07090E]/90 border border-slate-700 text-[11px] font-mono text-slate-200">
                      {planet.bodyType} · Solar {Math.round(planet.solarEfficiency * 100)}%
                    </div>

                    <div className="absolute bottom-4 left-6 right-6">
                      <div
                        className={`text-xs font-mono mb-1 ${
                          isCyanOrSky ? 'text-sky-400' : 'text-amber-400'
                        }`}
                      >
                        {planet.difficultyLabel}
                      </div>
                      <h2 className="font-display text-3xl font-bold text-white">
                        {planet.name}
                      </h2>
                      <p className="text-xs font-mono text-slate-300 mt-0.5">
                        {planet.operationName} · {planet.location}
                      </p>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                      {planet.summary}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[11px] font-mono">
                      <div className="p-2 rounded bg-space-950 border border-slate-800">
                        <span className="text-slate-400 block">Gravity</span>
                        <strong className="text-sky-300">{planet.gravityMs2} m/s²</strong>
                      </div>
                      <div className="p-2 rounded bg-space-950 border border-slate-800">
                        <span className="text-slate-400 block">Atmo</span>
                        <strong className="text-white">{planet.atmosphereKpa} kPa</strong>
                      </div>
                      <div className="p-2 rounded bg-space-950 border border-slate-800">
                        <span className="text-slate-400 block">Temp</span>
                        <strong className="text-amber-300">{planet.tempRangeC}</strong>
                      </div>
                      <div className="p-2 rounded bg-space-950 border border-slate-800">
                        <span className="text-slate-400 block">Resupply</span>
                        <strong className="text-emerald-300">{planet.resupplyDays}d transit</strong>
                      </div>
                    </div>

                    <div className="mb-4 p-3 rounded-lg bg-space-950 border border-slate-800 flex items-start gap-2.5">
                      <Compass className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-mono uppercase text-sky-400 block mb-0.5">
                          NASA Requirement
                        </span>
                        <span className="text-slate-200">{planet.nasaGoal}</span>
                      </div>
                    </div>

                    {assignedCrew.length > 0 && (
                      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-400 font-mono flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-emerald-400" /> Lead Crew:
                        </span>
                        {assignedCrew.map((a) => (
                          <span
                            key={a.id}
                            className="px-2 py-0.5 rounded bg-space-950 border border-slate-700 text-slate-200 font-medium"
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1.5"
                              style={{ backgroundColor: a.suitColor }}
                            />
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mb-5">
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                        {isCyanOrSky ? (
                          <Sun className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <Wind className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        Environmental Conditions
                      </div>
                      <ul className="space-y-2">
                        {planet.conditions.map((cond, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-slate-300 flex items-start gap-2.5"
                          >
                            <span
                              className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                                isCyanOrSky ? 'bg-sky-400' : 'bg-amber-400'
                              }`}
                            />
                            <span>{cond}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-lg bg-space-950 border border-slate-800">
                      <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Special Engineering Challenges
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {planet.challenges.map((ch, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Shield className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                            <span>{ch}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  <button
                    type="button"
                    onClick={() => onSelectPlanet(planet.id)}
                    className={`w-full py-3.5 rounded-lg font-display font-bold flex items-center justify-center gap-2 transition-colors ${
                      isCyanOrSky
                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    Deploy to {planet.name}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
