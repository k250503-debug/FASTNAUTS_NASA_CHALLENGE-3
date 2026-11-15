import React, { useState } from 'react';
import { Compass, Film, Play, Rocket, ShieldCheck, Cpu, Users, Wrench, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import PlanetaryBackdrop3D from '../three/PlanetaryBackdrop3D';
import lunarOutpostHero from '../assets/images/lunar_outpost_hero_1794552137891.jpg';

interface LandingProps {
  onStartMission: () => void;
  onStartStoryIntro?: () => void;
  onOpenEquipment?: () => void;
  onOpenAstronauts?: () => void;
  hasSavedMission?: boolean;
  onResumeMission?: () => void;
}

export default function Landing({
  onStartMission,
  onStartStoryIntro,
  onOpenEquipment,
  onOpenAstronauts,
  hasSavedMission = false,
  onResumeMission,
}: LandingProps) {
  const [modalType, setModalType] = useState<'about' | 'howto' | 'stem' | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col text-slate-100">
      <PlanetaryBackdrop3D planetId="moon" mode="solar" />

      <Navbar
        onGoHome={() => setModalType(null)}
        onOpenModal={(type) => setModalType(type)}
        onStartMission={onStartMission}
        showLandingNav={true}
      />

      <main className="flex-1 relative z-10">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="text-xs font-mono tracking-wider uppercase text-cyan-400 mb-3">
              Astro Mission · Interplanetary Command &amp; ISRU Trainer
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-5 drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)]">
              Command humanity’s frontier.
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl mb-8">
              Experience cinematic planetary landings across the Moon, Mars, Titan, and Europa,
              inspect animated 3D solar and water-cycle hardware, customize astronauts in 360°, and
              lead closed-loop surface survival.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {onStartStoryIntro && (
                <button
                  type="button"
                  onClick={onStartStoryIntro}
                  className="px-6 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-base flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 shadow-[0_0_24px_rgba(34,211,238,0.28)]"
                >
                  <Film className="w-4 h-4" />
                  Cinematic Story Intro
                </button>
              )}
              <button
                type="button"
                onClick={onStartMission}
                className="px-6 py-3.5 rounded-lg astra-glass hover:border-cyan-400/60 text-cyan-200 font-display font-bold text-base flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                {hasSavedMission ? 'New Mission' : 'Start Mission'}
              </button>
              {hasSavedMission && onResumeMission && (
                <button
                  type="button"
                  onClick={onResumeMission}
                  className="px-6 py-3.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-base flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Rocket className="w-4 h-4" />
                  Resume Saved Mission
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              {onOpenEquipment && (
                <button
                  type="button"
                  onClick={onOpenEquipment}
                  className="px-4 py-2 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-slate-100 font-medium text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                  3D Equipment Showcase
                </button>
              )}
              {onOpenAstronauts && (
                <button
                  type="button"
                  onClick={onOpenAstronauts}
                  className="px-4 py-2 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-slate-100 font-medium text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  Astronaut Gallery &amp; Suits
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalType('howto')}
                className="px-4 py-2 rounded-lg astra-glass-subtle hover:border-emerald-400/50 text-slate-100 font-medium text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                How It Works
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative w-full h-full min-h-[300px] lg:min-h-[400px] rounded-xl overflow-hidden astra-glass p-1.5">
              <div className="relative w-full h-full rounded-lg overflow-hidden">
                {!heroImgFailed ? (
                  <img
                    src={lunarOutpostHero}
                    alt="Lunar south pole outpost with pressurized habitats, solar arrays, and mining rover at Shackleton Crater"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-950/40 text-center">
                    <Rocket className="w-12 h-12 text-cyan-400 mb-3" />
                    <div className="font-display font-semibold text-white">
                      Lunar South Pole Outpost Visualization
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-200">
                  <span>Shackleton Crater Rim · Lunar South Pole</span>
                  <span className="text-cyan-300">ISRU &amp; Closed-Loop Simulation</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three-Stage Engineering Loop */}
        <section className="border-t border-white/10 bg-slate-950/20">
          <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl astra-glass">
              <div className="text-xs font-mono text-cyan-400 mb-2">01. Build</div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Design Your Outpost
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed">
                Prioritize habitats, solar power, batteries, water recycling, and ISRU extraction
                under a strict credit budget. You cannot afford everything at once.
              </p>
            </div>

            <div className="p-6 rounded-xl astra-glass">
              <div className="text-xs font-mono text-emerald-400 mb-2">02. Manage</div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Balance Interconnected Systems
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed">
                Greenhouses grow food and generate oxygen, yet draw water and electricity. Monitor
                daily net balances and adapt to lunar shadows or Martian dust.
              </p>
            </div>

            <div className="p-6 rounded-xl astra-glass">
              <div className="text-xs font-mono text-amber-400 mb-2">03. Respond</div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Solve Space Emergencies
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed">
                Respond to solar disruptions, valve clogs, and radiation events—and inspect real
                aerospace science behind every engineering trade-off.
              </p>
            </div>
          </div>
        </section>
      </main>

      {modalType && (
        <div className="fixed inset-0 z-50 astra-glass-backdrop flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl astra-glass-modal p-6 relative">
            <button
              type="button"
              onClick={() => setModalType(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-slate-300 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {modalType === 'about' && (
              <>
                <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase mb-2">
                  <Rocket className="w-4 h-4" /> About ASTRA
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  Junior Astronaut Mission Trainer
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                  ASTRA turns students into mission commanders operating a lunar or Martian outpost.
                  Built around real In-Situ Resource Utilization (ISRU) and closed-loop life support
                  principles, it teaches how engineering systems depend on one another.
                </p>
                <p className="text-xs text-slate-300 astra-glass-subtle p-3.5 rounded-lg">
                  Educational Model Note: Simulation numbers and percentages represent simplified
                  educational relationships rather than flight-certified NASA spacecraft specifications.
                </p>
              </>
            )}

            {modalType === 'howto' && (
              <>
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase mb-2">
                  <ShieldCheck className="w-4 h-4" /> How to Play
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  Four Steps to Command Success
                </h2>
                <ol className="space-y-3 text-sm text-slate-300">
                  <li>
                    <strong className="text-white">1. Configure Profile:</strong> Choose your
                    commander callsign, difficulty, and mission duration (15, 30, or 45 days).
                  </li>
                  <li>
                    <strong className="text-white">2. Select Destination:</strong> Pick the Moon or
                    Mars, each with distinct solar cycles and environmental constraints.
                  </li>
                  <li>
                    <strong className="text-white">3. Build Your Outpost:</strong> Spend your
                    starting budget wisely across habitats, power, recycling, ISRU, and shelter.
                  </li>
                  <li>
                    <strong className="text-white">4. Advance & Adapt:</strong> Inspect daily net
                    telemetry, upgrade systems, and solve emergencies before reserves reach zero.
                  </li>
                </ol>
              </>
            )}

            {modalType === 'stem' && (
              <>
                <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase mb-2">
                  <Cpu className="w-4 h-4" /> Learn STEM & ISRU
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  What is Lunar ISRU?
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">
                  <strong>In-Situ Resource Utilization (ISRU)</strong> means harvesting local
                  planetary materials instead of hauling every drop of water and tank of oxygen
                  from Earth.
                </p>
                <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
                  <li>
                    Polar water ice at Shackleton Crater can be purified for drinking and split into
                    breathable oxygen.
                  </li>
                  <li>
                    Lunar regolith contains ~40% oxygen by mass locked in oxide minerals and can be
                    sintered into radiation shielding.
                  </li>
                  <li>
                    Closed-loop water recycling and hydroponics dramatically reduce Earth resupply
                    mass.
                  </li>
                </ul>
              </>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-semibold text-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
