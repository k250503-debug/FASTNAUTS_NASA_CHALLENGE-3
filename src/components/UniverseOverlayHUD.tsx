import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  SkipForward,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { UNIVERSE_BODIES, getCelestialBodyById } from '../data/universe';
import type { CelestialBodyData } from '../data/universe';
import type { UniverseExperienceMode } from '../three/UniverseScene3D';
import type { PlanetId } from '../types';
import { playSpaceSfx } from '../utils/spaceAudio';

interface UniverseOverlayHUDProps {
  mode: UniverseExperienceMode;
  journeyBodyId: string | null;
  journeyStopIndex: number;
  journeyTotalStops: number;
  selectedBodyId: string | null;
  timeScale: number;
  isAudioMuted: boolean;
  hasSavedMission: boolean;
  onStartInteractive: () => void;
  onSkipJourney: () => void;
  onReplayJourney: () => void;
  onSelectBody: (id: string | null) => void;
  onOverview: () => void;
  onSetTimeScale: (scale: number) => void;
  onToggleAudio: () => void;
  onLaunchMissionSetup: (planetId?: PlanetId) => void;
  onResumeMission?: () => void;
  onOpenEquipment: () => void;
  onOpenAstronauts: () => void;
}

function TelemetryRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-1.5 border-b border-white/10 last:border-b-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/85">
        {label}
      </div>
      <div className="text-xs text-slate-100 leading-snug mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function renderFullDossier(body: CelestialBodyData) {
  if (body.category === 'planet') {
    return (
      <>
        <div className="grid grid-cols-2 gap-x-4">
          <TelemetryRow label="Planet Type" value={body.planetType} />
          <TelemetryRow label="Known Moons" value={body.knownMoons} />
          <TelemetryRow label="Avg Distance" value={body.avgDistanceSun} />
          <TelemetryRow label="Diameter" value={body.diameter} />
          <TelemetryRow label="Surface Gravity" value={body.gravity} />
          <TelemetryRow label="Orbital Period" value={body.orbitalPeriod} />
          <TelemetryRow label="Rotation Period" value={body.rotationPeriod} />
          <TelemetryRow label="Temperature" value={body.temperature} />
        </div>
        <TelemetryRow label="Atmosphere" value={body.atmosphere} />
        {body.scientificFacts && body.scientificFacts.length > 0 && (
          <div className="py-1.5 border-b border-white/10">
            <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/85">
              Scientific Facts
            </div>
            <ul className="mt-1 space-y-1 text-xs text-slate-200 leading-relaxed">
              {body.scientificFacts.map((fact, idx) => (
                <li key={idx}>· {fact}</li>
              ))}
            </ul>
          </div>
        )}
        <TelemetryRow label="Exploration History" value={body.explorationHistory} />
      </>
    );
  }

  if (body.category === 'moon') {
    return (
      <>
        <div className="grid grid-cols-2 gap-x-4">
          <TelemetryRow label="Parent Planet" value={body.parentPlanet} />
          <TelemetryRow label="Diameter" value={body.diameter} />
          <TelemetryRow label="Gravity" value={body.gravity} />
          <TelemetryRow label="Orbital Period" value={body.orbitalPeriod} />
        </div>
        <TelemetryRow label="Surface Characteristics" value={body.surfaceCharacteristics} />
        <TelemetryRow label="Important Discoveries" value={body.importantDiscoveries} />
        <TelemetryRow label="Scientific Interest" value={body.scientificInterest} />
      </>
    );
  }

  if (body.category === 'satellite') {
    return (
      <>
        <div className="grid grid-cols-2 gap-x-4">
          <TelemetryRow label="Organization" value={body.organization} />
          <TelemetryRow label="Launch Date" value={body.launchDate} />
          <TelemetryRow label="Orbit Type" value={body.orbitType} />
          <TelemetryRow label="Mission Status" value={body.missionStatus} />
        </div>
        <TelemetryRow label="Mission Purpose" value={body.missionPurpose} />
        <TelemetryRow label="Scientific Contribution" value={body.scientificContribution} />
      </>
    );
  }

  // Star, small body, or deep-space object
  return (
    <>
      <div className="grid grid-cols-2 gap-x-4">
        <TelemetryRow label="Classification" value={body.classification} />
        <TelemetryRow label="Distance" value={body.distanceFromEarth} />
        <TelemetryRow label="Scale / Size" value={body.scaleSize} />
        {body.gravity && <TelemetryRow label="Gravity" value={body.gravity} />}
        {body.temperature && <TelemetryRow label="Temperature" value={body.temperature} />}
        {body.rotationPeriod && <TelemetryRow label="Rotation" value={body.rotationPeriod} />}
      </div>
      {body.atmosphere && <TelemetryRow label="Composition" value={body.atmosphere} />}
      <TelemetryRow label="Important Discoveries" value={body.importantDiscoveries} />
      <TelemetryRow label="Scientific Characteristics" value={body.characteristics} />
      {body.explorationHistory && (
        <TelemetryRow label="Exploration" value={body.explorationHistory} />
      )}
    </>
  );
}

export default function UniverseOverlayHUD({
  mode,
  journeyBodyId,
  journeyStopIndex,
  journeyTotalStops,
  selectedBodyId,
  timeScale,
  isAudioMuted,
  hasSavedMission,
  onStartInteractive,
  onSkipJourney,
  onReplayJourney,
  onSelectBody,
  onOverview,
  onSetTimeScale,
  onToggleAudio,
  onLaunchMissionSetup,
  onResumeMission,
  onOpenEquipment,
  onOpenAstronauts,
}: UniverseOverlayHUDProps) {
  const [finderOpen, setFinderOpen] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);

  const journeyBody = journeyBodyId ? getCelestialBodyById(journeyBodyId) : null;
  const selectedBody = selectedBodyId ? getCelestialBodyById(selectedBodyId) : null;

  // ========== PHASE 2 & 3: JOURNEY CINEMATIC FLOATING TYPOGRAPHY ==========
  if (mode === 'journey') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 sm:p-10">
        {/* Top subtle header */}
        <div className="flex items-start justify-between gap-6">
          <AnimatePresence mode="wait">
            {journeyBody ? (
              <motion.div
                key={journeyBody.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md"
              >
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-400 mb-1.5">
                  {journeyBody.subtitle}
                </div>
                <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white drop-shadow">
                  {journeyBody.name}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mt-2.5 max-w-sm">
                  {journeyBody.shortDesc}
                </p>

                <div className="mt-4 pt-3 border-t border-cyan-400/25 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {journeyBody.avgDistanceSun && (
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-cyan-300/75">
                        Distance
                      </span>
                      <span className="font-mono text-slate-100 tabular-nums">
                        {journeyBody.avgDistanceSun}
                      </span>
                    </div>
                  )}
                  {journeyBody.diameter && (
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-cyan-300/75">
                        Diameter
                      </span>
                      <span className="font-mono text-slate-100 tabular-nums">
                        {journeyBody.diameter}
                      </span>
                    </div>
                  )}
                  {journeyBody.gravity && (
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-cyan-300/75">
                        Gravity
                      </span>
                      <span className="font-mono text-slate-100 tabular-nums">
                        {journeyBody.gravity}
                      </span>
                    </div>
                  )}
                  {(journeyBody.orbitalPeriod ||
                    journeyBody.classification ||
                    journeyBody.orbitType) && (
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-cyan-300/75">
                        {journeyBody.orbitalPeriod
                          ? 'Orbital Period'
                          : journeyBody.classification
                          ? 'Classification'
                          : 'Orbit'}
                      </span>
                      <span className="font-mono text-slate-100 tabular-nums">
                        {journeyBody.orbitalPeriod ||
                          journeyBody.classification ||
                          journeyBody.orbitType}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="overview-sweep"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-md"
              >
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-400 mb-1">
                  Heliospheric Overview
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                  The Solar System
                </h2>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              onToggleAudio();
            }}
            aria-label={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
            className="pointer-events-auto p-2.5 rounded-lg bg-[#050811]/85 border border-slate-800 hover:border-cyan-400 text-slate-200 transition-colors"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Bottom subtle tour progress + Skip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="text-cyan-300">ASTRO MISSION</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Chapter {Math.min(journeyStopIndex + 1, journeyTotalStops)} / {journeyTotalStops}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              onSkipJourney();
            }}
            className="pointer-events-auto px-4 py-2 rounded-lg bg-[#050811]/90 border border-slate-700 hover:border-cyan-400 text-xs font-mono text-slate-100 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
            Skip to Solar System
          </button>
        </div>
      </div>
    );
  }

  // ========== PHASE 4: MINIMAL CLICK TO START ==========
  if (mode === 'click_to_start') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Click to start exploring the Astro Mission universe"
        onClick={() => {
          playSpaceSfx('ui_select', isAudioMuted);
          onStartInteractive();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            playSpaceSfx('ui_select', isAudioMuted);
            onStartInteractive();
          }
        }}
        className="fixed inset-0 z-20 cursor-pointer flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-black/20 via-transparent to-black/45"
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-[0.22em] text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.85)]">
            ASTRO MISSION
          </h1>
          <div className="mt-4 text-sm sm:text-base font-mono tracking-[0.38em] text-cyan-300/95">
            EXPLORE THE UNIVERSE
          </div>

          <motion.div
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="mt-14 text-xs sm:text-sm font-mono tracking-[0.35em] text-white border-b border-cyan-400/50 pb-1.5"
          >
            CLICK TO START
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ========== PHASE 5: INTERACTIVE UNIVERSE HUD (NON-INTRUSIVE & COLLAPSIBLE) ==========
  const planetGroup = UNIVERSE_BODIES.filter(
    (b) => b.category === 'star' || b.category === 'planet'
  );
  const moonGroup = UNIVERSE_BODIES.filter((b) => b.category === 'moon');
  const craftAndSmall = UNIVERSE_BODIES.filter(
    (b) => b.category === 'satellite' || b.category === 'small_body'
  );
  const deepGroup = UNIVERSE_BODIES.filter((b) => b.category === 'deep_space');

  return (
    <div className="fixed inset-0 z-20 pointer-events-none">
      {/* Subtle Top-Left Brand + Interaction Hint */}
      {!hudHidden && (
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-4">
          <div className="pointer-events-auto flex items-center gap-3 px-3.5 py-2 rounded-lg bg-[#050811]/88 border border-slate-800">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-display text-sm font-bold tracking-[0.14em] text-white whitespace-nowrap">
              ASTRO MISSION
            </span>
            <span className="hidden sm:inline text-xs font-mono text-slate-400">
              · Drag to orbit · Scroll to zoom · Click any world or star
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {hasSavedMission && onResumeMission && (
              <button
                type="button"
                onClick={() => {
                  playSpaceSfx('ui_select', isAudioMuted);
                  onResumeMission();
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Rocket className="w-3.5 h-3.5" />
                Resume Outpost
              </button>
            )}
            <button
              type="button"
              onClick={() => setHudHidden(true)}
              title="Cinema Mode (Hide HUD)"
              className="p-2 rounded-lg bg-[#050811]/88 border border-slate-800 hover:border-cyan-400 text-slate-300 hover:text-white transition-colors"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Restore HUD button when in Cinema Mode */}
      {hudHidden && (
        <button
          type="button"
          onClick={() => setHudHidden(false)}
          className="pointer-events-auto absolute top-4 right-4 px-3 py-2 rounded-lg bg-[#050811]/85 border border-slate-700 hover:border-cyan-400 text-xs font-mono text-slate-200 flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          Show HUD
        </button>
      )}

      {/* Floating Selected Body Telemetry Readout (Phase 3 Interactive) */}
      <AnimatePresence>
        {!hudHidden && selectedBody && (
          <motion.aside
            key={selectedBody.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto absolute left-4 top-16 w-[min(365px,calc(100vw-2rem))] max-h-[calc(100vh-175px)] flex flex-col rounded-xl bg-[#050811]/90 border border-cyan-500/25 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400 truncate">
                  {selectedBody.subtitle}
                </div>
                <h2 className="font-display text-xl font-bold text-white truncate mt-0.5">
                  {selectedBody.name}
                </h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setInfoCollapsed((c) => !c)}
                  aria-label={infoCollapsed ? 'Expand details' : 'Collapse details'}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300"
                >
                  {infoCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSpaceSfx('ui_click', isAudioMuted);
                    onOverview();
                  }}
                  aria-label="Return to Solar Overview"
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!infoCollapsed && (
              <div className="px-4 py-3 overflow-y-auto space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedBody.shortDesc}
                </p>
                {renderFullDossier(selectedBody)}
              </div>
            )}

            {/* Launch Outpost button directly on playable worlds (Moon, Mars, Titan, Europa) */}
            {selectedBody.playableWorldId && (
              <div className="p-3 border-t border-white/10 bg-[#070B14]">
                <button
                  type="button"
                  onClick={() => {
                    playSpaceSfx('ui_select', isAudioMuted);
                    onLaunchMissionSetup(selectedBody.playableWorldId);
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Rocket className="w-4 h-4" />
                  Land &amp; Command Outpost on {selectedBody.name}
                </button>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Expandable Universe Index Drawer (opens above bottom dock) */}
      <AnimatePresence>
        {!hudHidden && finderOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto fixed bottom-20 left-1/2 -translate-x-1/2 w-[min(920px,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto rounded-xl bg-[#050811]/95 border border-slate-700 p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                Celestial Navigator — Click Any Destination
              </div>
              <button
                type="button"
                onClick={() => setFinderOpen(false)}
                className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
              >
                Close <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Sun &amp; 8 Planets
                </div>
                <div className="space-y-1">
                  {planetGroup.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        playSpaceSfx('ui_click', isAudioMuted);
                        onSelectBody(b.id);
                        setFinderOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-md text-left flex items-center justify-between transition-colors ${
                        selectedBodyId === b.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {b.playableWorldId && (
                        <span className="text-[10px] font-mono text-cyan-400">OUTPOST</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Moons
                </div>
                <div className="space-y-1">
                  {moonGroup.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        playSpaceSfx('ui_click', isAudioMuted);
                        onSelectBody(b.id);
                        setFinderOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-md text-left flex items-center justify-between transition-colors ${
                        selectedBodyId === b.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {b.playableWorldId && (
                        <span className="text-[10px] font-mono text-cyan-400">OUTPOST</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Spacecraft &amp; Small Bodies
                </div>
                <div className="space-y-1">
                  {craftAndSmall.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        playSpaceSfx('ui_click', isAudioMuted);
                        onSelectBody(b.id);
                        setFinderOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-md text-left truncate transition-colors ${
                        selectedBodyId === b.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Nebulae &amp; Galaxies
                </div>
                <div className="space-y-1">
                  {deepGroup.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        playSpaceSfx('ui_click', isAudioMuted);
                        onSelectBody(b.id);
                        setFinderOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-md text-left truncate transition-colors ${
                        selectedBodyId === b.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      {!hudHidden && (
        <div className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 max-w-[96vw] overflow-x-auto rounded-xl bg-[#050811]/92 border border-slate-800 px-2.5 py-2 flex items-center gap-1.5 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              setFinderOpen((o) => !o);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              finderOpen
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Explore Universe
          </button>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              onOverview();
              setFinderOpen(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            Solar View
          </button>

          {/* Orbit Time Speed */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 shrink-0">
            {[
              { label: 'Pause', val: 0 },
              { label: '1×', val: 1 },
              { label: '5×', val: 5 },
              { label: '25×', val: 25 },
            ].map((spd) => (
              <button
                key={spd.val}
                type="button"
                onClick={() => onSetTimeScale(spd.val)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors whitespace-nowrap ${
                  timeScale === spd.val
                    ? 'bg-cyan-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd.val === 0 ? <Pause className="w-3 h-3 inline" /> : spd.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              setFinderOpen(false);
              onReplayJourney();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            Replay Tour
          </button>

          <div className="h-5 w-px bg-slate-800 mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              onOpenEquipment();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            3D Equipment
          </button>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_click', isAudioMuted);
              onOpenAstronauts();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            Crew &amp; Suits
          </button>

          <button
            type="button"
            onClick={() => {
              playSpaceSfx('ui_select', isAudioMuted);
              onLaunchMissionSetup(selectedBody?.playableWorldId);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Surface Mission
          </button>

          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0"
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
