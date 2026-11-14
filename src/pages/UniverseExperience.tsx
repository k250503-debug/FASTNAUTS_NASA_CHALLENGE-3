import React, { useState } from 'react';
import UniverseOverlayHUD from '../components/UniverseOverlayHUD';
import UniverseScene3D, { type UniverseExperienceMode } from '../three/UniverseScene3D';
import { useTourSoundtrack } from '../utils/useTourSoundtrack';
import type { PlanetId } from '../types';

interface UniverseExperienceProps {
  initialMode?: UniverseExperienceMode;
  isAudioMuted: boolean;
  hasSavedMission: boolean;
  onToggleAudio: () => void;
  onLaunchMissionSetup: (planetId?: PlanetId) => void;
  onResumeMission: () => void;
  onOpenEquipment: () => void;
  onOpenAstronauts: () => void;
}

export default function UniverseExperience({
  initialMode = 'journey',
  isAudioMuted,
  hasSavedMission,
  onToggleAudio,
  onLaunchMissionSetup,
  onResumeMission,
  onOpenEquipment,
  onOpenAstronauts,
}: UniverseExperienceProps) {
  const [mode, setMode] = useState<UniverseExperienceMode>(initialMode);
  const [journeyBodyId, setJourneyBodyId] = useState<string | null>('sun');
  const [journeyStopIndex, setJourneyStopIndex] = useState(0);
  const [journeyTotalStops, setJourneyTotalStops] = useState(14);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(1);
  const [replaySignal, setReplaySignal] = useState(0);
  const [overviewSignal, setOverviewSignal] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);

  useTourSoundtrack({
    enabled: true,
    muted: isAudioMuted,
    volume: mode === 'interactive' ? 0.38 : 0.55,
    restartSignal: replaySignal,
  });

  const handleSkipJourney = () => {
    setMode('click_to_start');
  };

  const handleReplayJourney = () => {
    setSelectedBodyId(null);
    setJourneyBodyId('sun');
    setJourneyStopIndex(0);
    setMode('journey');
    setReplaySignal((s) => s + 1);
  };

  const handleOverview = () => {
    setSelectedBodyId(null);
    setOverviewSignal((s) => s + 1);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#010205]">
      {webglFailed ? (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#030712] via-[#070B16] to-[#020409]">
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400 mb-3">
            ASTRO MISSION · Cosmic Simulation
          </div>
          <h1 className="font-display text-4xl font-bold text-white mb-4">
            3D WebGL Context Unavailable
          </h1>
          <p className="text-sm text-slate-300 max-w-md mb-6">
            Enable hardware graphics acceleration to explore the real-time 3D Solar System, or
            proceed directly to surface mission command.
          </p>
          <button
            type="button"
            onClick={() => onLaunchMissionSetup('mars')}
            className="px-6 py-3 rounded-lg bg-cyan-400 text-slate-950 font-display font-bold text-sm"
          >
            Enter Surface Mission Command
          </button>
        </div>
      ) : (
        <UniverseScene3D
          mode={mode}
          selectedBodyId={selectedBodyId}
          timeScale={timeScale}
          replaySignal={replaySignal}
          overviewSignal={overviewSignal}
          onSelectBody={setSelectedBodyId}
          onJourneyFocusChange={(id, idx, total) => {
            setJourneyBodyId(id);
            setJourneyStopIndex(idx);
            setJourneyTotalStops(total);
          }}
          onJourneyComplete={() => setMode('click_to_start')}
          onWebGLFallback={() => setWebglFailed(true)}
        />
      )}

      <UniverseOverlayHUD
        mode={mode}
        journeyBodyId={journeyBodyId}
        journeyStopIndex={journeyStopIndex}
        journeyTotalStops={journeyTotalStops}
        selectedBodyId={selectedBodyId}
        timeScale={timeScale}
        isAudioMuted={isAudioMuted}
        hasSavedMission={hasSavedMission}
        onStartInteractive={() => setMode('interactive')}
        onSkipJourney={handleSkipJourney}
        onReplayJourney={handleReplayJourney}
        onSelectBody={setSelectedBodyId}
        onOverview={handleOverview}
        onSetTimeScale={setTimeScale}
        onToggleAudio={onToggleAudio}
        onLaunchMissionSetup={onLaunchMissionSetup}
        onResumeMission={onResumeMission}
        onOpenEquipment={onOpenEquipment}
        onOpenAstronauts={onOpenAstronauts}
      />
    </div>
  );
}
