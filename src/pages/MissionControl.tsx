import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpCircle,
  Bot,
  CheckCircle2,
  CloudLightning,
  Compass,
  Droplets,
  Eye,
  EyeOff,
  Fan,
  FlaskConical,
  Globe,
  LogOut,
  Pause,
  Play,
  Power,
  Radio,
  Rocket,
  Sliders,
  Target,
  User,
  Utensils,
  Video,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import MissionChart from '../components/MissionChart';
import AdvisorModal from '../components/AdvisorModal';
import AstronautView from '../components/AstronautView';
import TaskAnimationView, {
  type ActiveTaskDuty,
  type AstronautTaskKind,
} from '../components/TaskAnimationView';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import { PLANETS } from '../data/planets';
import { calculateDailyPreview } from '../simulation/calculations';
import OutpostScene3D, { type NearbyTarget } from '../three/OutpostScene3D';
import type { AstronautId, MissionState, PlanetId, SuitPartId } from '../types';
import {
  buildAstronautVoiceScript,
  detectCriticalMissionAlert,
  speakNasaText,
  stopNasaSpeech,
} from '../utils/nasaVoice';

interface MissionControlProps {
  state: MissionState;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onAdvanceDay: () => void;
  onToggleBuilding: (uid: string) => void;
  onUpgradeBuilding: (uid: string) => void;
  onResearchTech: (techId: 'water' | 'solar' | 'crop', cost: number) => void;
  onSelectAstronaut: (id: AstronautId) => void;
  onInspectStormFlue: () => void;
  onCollectDataNode: (nodeId: string) => void;
  onServiceBuilding: (uid: string) => void;
  onPerformSuitDiagnostic: (partId: SuitPartId, astronautId: AstronautId) => void;
  onTravelToWorld: (planetId: PlanetId) => void;
  onTriggerStormScene?: () => void;
  onOpenEmergency: () => void;
  onExitMission: () => void;
}

export default function MissionControl({
  state,
  isAudioMuted,
  onToggleAudio,
  onAdvanceDay,
  onToggleBuilding,
  onUpgradeBuilding,
  onResearchTech,
  onSelectAstronaut,
  onInspectStormFlue,
  onCollectDataNode,
  onServiceBuilding,
  onPerformSuitDiagnostic,
  onTravelToWorld,
  onTriggerStormScene,
  onOpenEmergency,
  onExitMission,
}: MissionControlProps) {
  const [paused, setPaused] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [sceneMode, setSceneMode] = useState<'outpost' | 'astronaut'>('outpost');
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>('follow');
  const [nearbyTarget, setNearbyTarget] = useState<NearbyTarget | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [selectedBuildingUid, setSelectedBuildingUid] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    'research' | 'objectives' | 'resources' | 'telemetry' | null
  >(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [busyDuty, setBusyDuty] = useState<ActiveTaskDuty | null>(null);
  const [capcomBanner, setCapcomBanner] = useState<{
    title: string;
    text: string;
    severity: 'info' | 'warning' | 'danger';
  } | null>(null);
  const interactRef = useRef<(() => void) | null>(null);
  const busyTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const spokenAlertKeysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef(state);
  stateRef.current = state;
  const dutySeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (busyTimerRef.current !== null) {
        window.clearTimeout(busyTimerRef.current);
      }
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
      stopNasaSpeech();
    };
  }, []);

  useEffect(() => {
    if (isAudioMuted) {
      stopNasaSpeech();
    }
  }, [isAudioMuted]);

  const showCapcomBanner = (
    title: string,
    text: string,
    severity: 'info' | 'warning' | 'danger',
    durationMs = 9500
  ) => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    setCapcomBanner({ title, text, severity });
    bannerTimerRef.current = window.setTimeout(() => {
      setCapcomBanner(null);
      bannerTimerRef.current = null;
    }, durationMs);
  };

  const announceAstronautBriefing = (astroId: AstronautId) => {
    const currentState = stateRef.current;
    const astro = getAstronautById(astroId);
    const script = buildAstronautVoiceScript(astro, currentState);
    showCapcomBanner(
      `Flight Officer Elena Vance · ${astro.name}`,
      script,
      'info',
      11000
    );
    speakNasaText(script, {
      muted: isAudioMuted,
      rate: 0.98,
      pitch: 1.12,
    });
  };

  // Speak per-character NASA task & survival guidance when switching astronauts or worlds
  useEffect(() => {
    announceAstronautBriefing(state.activeAstronautId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeAstronautId, state.planetId]);

  // Automatic urgent female NASA Capcom voice alert on storms, flue blockages, or shortages
  useEffect(() => {
    const alert = detectCriticalMissionAlert(state);
    if (!alert) return;
    if (spokenAlertKeysRef.current.has(alert.key)) return;
    spokenAlertKeysRef.current.add(alert.key);

    showCapcomBanner(alert.title, alert.spokenText, alert.severity, 12000);
    speakNasaText(alert.spokenText, {
      muted: isAudioMuted,
      urgent: true,
      rate: 1.0,
      pitch: 1.15,
    });
  }, [
    state.day,
    state.planetId,
    state.stormFlue.cloggedPct,
    state.resources.oxygen.current,
    state.resources.water.current,
    state.resources.food.current,
    state.resources.battery.current,
    state.resources.battery.max,
    state.crew.radiationExposure,
    state.activeEvent,
    isAudioMuted,
  ]);

  useEffect(() => {
    if (busyTimerRef.current !== null) {
      window.clearTimeout(busyTimerRef.current);
      busyTimerRef.current = null;
    }
    setBusyDuty(null);
  }, [state.day]);

  const triggerBusyDuty = (
    kind: AstronautTaskKind,
    label: string,
    detail: string,
    astronautId: AstronautId = state.activeAstronautId,
    durationMs = 2800
  ) => {
    if (busyTimerRef.current !== null) {
      window.clearTimeout(busyTimerRef.current);
    }
    dutySeqRef.current += 1;
    setBusyDuty({
      astronautId,
      kind,
      label,
      detail,
      day: state.day,
      durationMs,
      key: dutySeqRef.current,
    });
    busyTimerRef.current = window.setTimeout(() => {
      setBusyDuty(null);
      busyTimerRef.current = null;
    }, durationMs);
  };

  const preview = calculateDailyPreview(state);
  const powerPct = Math.round(
    (state.resources.battery.current / state.resources.battery.max) * 100
  );
  const collectedCount = state.dataNodes.filter((n) => n.collected).length;
  const activeAstronaut = getAstronautById(state.activeAstronautId);
  const activeProgress = state.crewProgress[state.activeAstronautId];
  const isActiveBusy = busyDuty?.astronautId === state.activeAstronautId;

  const selectedBuilding = state.buildings.find((b) => b.uid === selectedBuildingUid);
  const selectedBuildingDef = selectedBuilding ? getBuildingDef(selectedBuilding.typeId) : null;

  const toneClass = (val: number, warn = 45, crit = 25) => {
    if (val <= crit) return 'border-rose-500/70 text-rose-300';
    if (val <= warn) return 'border-amber-500/70 text-amber-300';
    return 'border-slate-700 text-emerald-300';
  };

  const expectedDaysLeft = (current: number, prod: number, cons: number) => {
    const net = prod - cons;
    if (net >= 0) return 'Self-sustaining';
    return `~${Math.max(1, Math.floor(current / Math.abs(net)))} days remaining`;
  };

  const handleSelectAndInspectBuilding = (uid: string) => {
    setSelectedBuildingUid(uid);
  };

  const handleServiceAndSelectBuilding = (uid: string) => {
    const targetBld = state.buildings.find((b) => b.uid === uid);
    const bldDef = targetBld ? getBuildingDef(targetBld.typeId) : null;
    onServiceBuilding(uid);
    setSelectedBuildingUid(uid);
    triggerBusyDuty(
      'service_building',
      'Service Building',
      `Servicing ${bldDef?.shortName || 'Outpost Module'} conduits & calibration`
    );
  };

  const handleCollectNodeWithDuty = (nodeId: string) => {
    const node = state.dataNodes.find((n) => n.id === nodeId);
    onCollectDataNode(nodeId);
    triggerBusyDuty(
      'collect_data',
      'Collect Data Node',
      `Scanning & logging ${node?.label || 'Planetary Sample'} (+${node?.scienceValue || 15} SCI)`
    );
  };

  const handleInspectFlueWithDuty = () => {
    onInspectStormFlue();
    triggerBusyDuty(
      'inspect_flue',
      'Inspect Storm Flue',
      `Purging dust blockage (${state.stormFlue.cloggedPct}% → 0%) & balancing flue pressure`
    );
  };

  const handleSuitDiagWithDuty = (partId: SuitPartId, astronautId: AstronautId) => {
    onPerformSuitDiagnostic(partId, astronautId);
    triggerBusyDuty(
      'suit_diagnostic',
      'EVA Hand Work',
      `Calibrating ${partId.replace('_', ' ')} actuators & suit telemetry`,
      astronautId
    );
  };

  const handleFieldWorkDuty = () => {
    triggerBusyDuty(
      'suit_diagnostic',
      'EVA Field Check',
      `Running ${activeAstronaut.taskTitle} hand telemetry sweep`
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#05070C] text-slate-100">
      {/* Full-Viewport Interactive 3D Canvas (Outpost 3D or Astronaut 3D View) */}
      {sceneMode === 'astronaut' ? (
        <AstronautView
          state={state}
          hudHidden={hudHidden}
          onSelectAstronaut={onSelectAstronaut}
          onInspectStormFlue={handleInspectFlueWithDuty}
          onCollectDataNode={handleCollectNodeWithDuty}
          onPerformSuitDiagnostic={handleSuitDiagWithDuty}
        />
      ) : (
        <OutpostScene3D
          state={state}
          cameraMode={cameraMode}
          onProximityChange={setNearbyTarget}
          onSelectAstronaut={onSelectAstronaut}
          onSelectBuilding={handleSelectAndInspectBuilding}
          onServiceBuilding={handleServiceAndSelectBuilding}
          onInteractStormFlue={handleInspectFlueWithDuty}
          onCollectDataNode={handleCollectNodeWithDuty}
          onFieldWork={handleFieldWorkDuty}
          interactRef={interactRef}
        />
      )}

      {/* CSS Hand-Movement & Simulation-Day Busy Task Animation View */}
      <TaskAnimationView
        duty={busyDuty}
        hudHidden={hudHidden}
        onDismiss={() => setBusyDuty(null)}
      />

      {/* Top Compact Telemetry & World Deployment Header (Solid translucent, zero backdrop-blur) */}
      <header className="absolute top-0 inset-x-0 z-20 bg-[#0F1623]/94 border-b border-slate-800 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <Rocket className="w-4 h-4 text-sky-400" />
            <span className="font-display font-bold text-white tracking-wider text-sm">
              ASTRA 3D
            </span>
          </div>

          {/* 3D Scene Mode Segmented Control */}
          <div className="flex items-center gap-1 bg-[#07090E] border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSceneMode('outpost')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                sceneMode === 'outpost'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Outpost
            </button>
            <button
              type="button"
              onClick={() => setSceneMode('astronaut')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                sceneMode === 'astronaut'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3 h-3" />
              Astronaut
            </button>
          </div>

          {/* Clean Compact World Switcher Dropdown */}
          <label className="flex items-center gap-1.5 bg-[#07090E] border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-sky-300">
            <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              aria-label="Select NASA planetary outpost"
              value={state.planetId}
              onChange={(e) => onTravelToWorld(e.target.value as PlanetId)}
              className="bg-transparent text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {PLANETS.map((planet) => (
                <option key={planet.id} value={planet.id} className="bg-[#0F1623] text-slate-100">
                  {planet.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Streamlined 5 Core Vitals Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums">
          <button
            type="button"
            onClick={() => setSelectedResource('oxygen')}
            className={`px-2 py-1 rounded bg-[#07090E] border flex items-center gap-1 ${toneClass(
              state.resources.oxygen.current
            )}`}
          >
            <Wind className="w-3 h-3" /> O₂ {Math.round(state.resources.oxygen.current)}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('water')}
            className={`px-2 py-1 rounded bg-[#07090E] border flex items-center gap-1 ${toneClass(
              state.resources.water.current
            )}`}
          >
            <Droplets className="w-3 h-3" /> H₂O {Math.round(state.resources.water.current)}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('food')}
            className={`px-2 py-1 rounded bg-[#07090E] border flex items-center gap-1 ${toneClass(
              state.resources.food.current
            )}`}
          >
            <Utensils className="w-3 h-3" /> Food {Math.round(state.resources.food.current)}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('power')}
            className={`px-2 py-1 rounded bg-[#07090E] border flex items-center gap-1 ${toneClass(
              powerPct,
              35,
              15
            )}`}
          >
            <Zap className="w-3 h-3" /> {powerPct}%
          </button>
          <button
            type="button"
            onClick={handleInspectFlueWithDuty}
            title="Storm Flue Clog Status — Click to inspect & clear"
            className={`px-2 py-1 rounded bg-[#07090E] border flex items-center gap-1 ${
              state.stormFlue.status === 'critical'
                ? 'border-rose-500 text-rose-300'
                : state.stormFlue.status === 'warning'
                ? 'border-amber-500 text-amber-300'
                : 'border-slate-700 text-emerald-300'
            }`}
          >
            <Fan className="w-3 h-3" /> Flue {state.stormFlue.cloggedPct}%
          </button>
        </div>

        {/* Day & Essential Controls */}
        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums shrink-0">
          <span className="px-2.5 py-1 rounded bg-[#07090E] border border-slate-700 text-white">
            Day {String(state.day).padStart(2, '0')}/{state.maxDays}
          </span>
          <button
            type="button"
            onClick={onToggleAudio}
            title={isAudioMuted ? 'Unmute NASA Voice & Audio' : 'Mute NASA Voice & Audio'}
            aria-label={isAudioMuted ? 'Unmute NASA Voice & Audio' : 'Mute NASA Voice & Audio'}
            className="p-1.5 rounded bg-[#07090E] border border-slate-700 hover:border-sky-400 text-slate-300"
          >
            {isAudioMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume Simulation' : 'Pause Simulation'}
            aria-label={paused ? 'Resume Simulation' : 'Pause Simulation'}
            className="p-1.5 rounded bg-[#07090E] border border-slate-700 hover:border-sky-400 text-slate-300"
          >
            {paused ? (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onExitMission}
            title="Exit Mission"
            aria-label="Exit Mission"
            className="p-1.5 rounded bg-[#07090E] border border-slate-700 hover:border-rose-400 text-slate-300 hover:text-rose-400"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Slim Non-Blocking Emergency or Female NASA Capcom Voice Strip */}
      {state.activeEvent ? (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,680px)] rounded-xl bg-rose-950/95 border border-rose-500 px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase text-rose-300">
                Emergency Alert · Day {state.day}
              </div>
              <div className="font-display font-bold text-sm text-white truncate">
                {state.activeEvent.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenEmergency}
            className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-display font-bold text-xs whitespace-nowrap shrink-0"
          >
            Resolve
          </button>
        </div>
      ) : (
        capcomBanner && (
          <div
            className={`absolute top-14 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,680px)] rounded-xl border px-3.5 py-2 flex items-center justify-between gap-3 shadow-xl ${
              capcomBanner.severity === 'danger'
                ? 'bg-rose-950/95 border-rose-500 text-rose-100'
                : capcomBanner.severity === 'warning'
                ? 'bg-amber-950/95 border-amber-500 text-amber-100'
                : 'bg-[#0F1623]/94 border-sky-500/50 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Radio
                className={`w-4 h-4 shrink-0 ${
                  capcomBanner.severity === 'danger'
                    ? 'text-rose-400'
                    : capcomBanner.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              />
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-wider opacity-85 truncate">
                  {capcomBanner.title}
                </div>
                <div className="text-xs leading-snug line-clamp-2">{capcomBanner.text}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCapcomBanner(null)}
              aria-label="Dismiss NASA voice banner"
              className="p-1 text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      )}

      {/* Selected Building Floating Inspector (only shown when a 3D module is clicked) */}
      {selectedBuilding && selectedBuildingDef && (
        <div className="absolute top-16 right-4 z-20 w-80 rounded-xl bg-[#0F1623]/95 border border-slate-700 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-[10px] font-mono uppercase text-sky-400">
                3D Module Selected
              </div>
              <h3 className="font-display font-bold text-white text-base">
                {selectedBuildingDef.name} (Lv {selectedBuilding.level})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBuildingUid(null)}
              aria-label="Close module inspector"
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-300 mb-3">{selectedBuildingDef.benefit}</p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleServiceAndSelectBuilding(selectedBuilding.uid)}
              className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              Run {activeAstronaut.name}&apos;s NASA Maintenance
            </button>

            <div className="flex items-center gap-2">
              {selectedBuilding.typeId !== 'habitat' && (
                <button
                  type="button"
                  onClick={() => onToggleBuilding(selectedBuilding.uid)}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Power className="w-3.5 h-3.5 text-amber-400" />
                  {selectedBuilding.online ? 'Standby' : 'Online'}
                </button>
              )}
              <button
                type="button"
                disabled={
                  state.budget < selectedBuildingDef.upgradeCost || selectedBuilding.level >= 3
                }
                onClick={() => onUpgradeBuilding(selectedBuilding.uid)}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  state.budget >= selectedBuildingDef.upgradeCost && selectedBuilding.level < 3
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                {selectedBuilding.level >= 3
                  ? 'Max Lv'
                  : `Upgrade (${selectedBuildingDef.upgradeCost})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby [E] Proximity Interaction Pill (Outpost 3D Mode) */}
      {sceneMode === 'outpost' && nearbyTarget && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all ${
            hudHidden ? 'bottom-14' : 'bottom-44 sm:bottom-40'
          }`}
        >
          <button
            type="button"
            onClick={() => interactRef.current?.()}
            className="px-4 py-2 rounded-lg bg-[#0F1623]/95 hover:bg-slate-800 border border-sky-400 text-left shadow-xl flex items-center gap-3"
          >
            <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 font-mono font-bold text-xs">
              E
            </span>
            <div>
              <div className="text-xs font-bold text-white">{nearbyTarget.actionLabel}</div>
              <div className="text-[11px] font-mono text-slate-300">
                {nearbyTarget.label} · {nearbyTarget.sublabel}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* HUD Collapse / Expand Button */}
      <div
        className={`absolute right-4 z-20 transition-all ${
          hudHidden ? 'bottom-3' : 'bottom-[154px] sm:bottom-[142px]'
        }`}
      >
        <button
          type="button"
          onClick={() => setHudHidden((h) => !h)}
          className="px-3 py-1.5 rounded-lg bg-[#0F1623]/95 border border-slate-700 hover:border-sky-400 text-xs font-mono text-slate-200 flex items-center gap-1.5"
        >
          {hudHidden ? <Eye className="w-3.5 h-3.5 text-sky-400" /> : <EyeOff className="w-3.5 h-3.5" />}
          {hudHidden ? 'Show HUD' : 'Hide HUD'}
        </button>
      </div>

      {/* Collapsible Bottom Mission & 6-Astronaut Control Dock */}
      {!hudHidden && (
        <footer className="absolute bottom-0 inset-x-0 z-20 bg-[#0F1623]/94 border-t border-slate-800 px-3 sm:px-5 py-2.5 flex flex-col gap-2">
          {/* Row 1: 6-Astronaut Switcher + Active Astronaut NASA Work Card */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {ASTRONAUTS.map((astro) => {
                const isSelected = state.activeAstronautId === astro.id;
                const prog = state.crewProgress[astro.id];
                const isBusy = busyDuty?.astronautId === astro.id;
                return (
                  <button
                    key={astro.id}
                    type="button"
                    onClick={() => onSelectAstronaut(astro.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white font-semibold'
                        : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="relative w-5 h-5 flex items-center justify-center shrink-0">
                      {isBusy && (
                        <svg
                          key={busyDuty.key}
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="absolute inset-0 w-5 h-5 -rotate-90 pointer-events-none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="rgba(148, 163, 184, 0.2)"
                            strokeWidth="2"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke={astro.suitColor}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            style={{ '--ring-circumference': '62.83' } as React.CSSProperties}
                            className="astra-progress-ring"
                          />
                        </svg>
                      )}
                      <span
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border border-slate-700 ${
                          isBusy ? 'astra-portrait-float' : ''
                        }`}
                        style={{ backgroundColor: `${astro.suitColor}26` }}
                      >
                        <User
                          className="w-2.5 h-2.5"
                          style={{ color: astro.suitColor }}
                        />
                      </span>
                    </span>
                    <span>{astro.name}</span>
                    {isBusy ? (
                      <span className="px-1 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[9px] font-bold shrink-0">
                        BUSY
                      </span>
                    ) : (
                      prog?.currentTaskDone && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      )
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Active Astronaut Portrait + Duty Progress Ring */}
              <div className="px-2.5 py-1 rounded-lg bg-[#07090E] border border-slate-800 flex items-center gap-2.5 max-w-xl">
                <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                  {isActiveBusy && busyDuty && (
                    <svg
                      key={busyDuty.key}
                      viewBox="0 0 38 38"
                      aria-hidden="true"
                      className="absolute inset-0 w-9 h-9 -rotate-90 pointer-events-none"
                    >
                      <circle
                        cx="19"
                        cy="19"
                        r="17"
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.22)"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="19"
                        cy="19"
                        r="17"
                        fill="none"
                        stroke={activeAstronaut.suitColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        style={{ '--ring-circumference': '106.81' } as React.CSSProperties}
                        className="astra-progress-ring"
                      />
                    </svg>
                  )}
                  <div
                    className={`w-7 h-7 rounded-full border flex items-center justify-center overflow-hidden ${
                      isActiveBusy ? 'astra-portrait-float' : ''
                    }`}
                    style={{
                      borderColor: isActiveBusy ? activeAstronaut.suitColor : '#334155',
                      backgroundColor: '#0F1623',
                    }}
                    title={`${activeAstronaut.name} · ${activeAstronaut.role}`}
                  >
                    <svg
                      viewBox="0 0 32 32"
                      className="w-6 h-6"
                      aria-label={`${activeAstronaut.name} portrait`}
                    >
                      {/* Helmet shell */}
                      <circle cx="16" cy="14" r="9" fill="#E2E8F0" />
                      {/* Gold reflective EVA visor */}
                      <rect x="10.5" y="10.5" width="11" height="6.5" rx="3" fill="#F59E0B" />
                      <path
                        d="M12 12.2 C14 11.4, 17 11.4, 19.5 12.2"
                        stroke="#FEF3C7"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        fill="none"
                      />
                      {/* Suit collar & shoulders in astronaut accent color */}
                      <path
                        d="M6.5 29 C7.5 23.5, 11 21.5, 16 21.5 C21 21.5, 24.5 23.5, 25.5 29 Z"
                        fill={activeAstronaut.suitColor}
                      />
                      <rect x="12" y="21" width="8" height="2.2" rx="1" fill="#0F1623" />
                    </svg>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white shrink-0">
                      {activeAstronaut.name}
                    </span>
                    {isActiveBusy && busyDuty ? (
                      <span
                        className="text-[11px] font-mono font-semibold truncate"
                        style={{ color: activeAstronaut.suitColor }}
                      >
                        · Day {busyDuty.day} Busy ({busyDuty.label})
                      </span>
                    ) : (
                      <span className="text-slate-300 truncate">
                        · {activeAstronaut.taskTitle}
                      </span>
                    )}
                  </div>
                  {activeProgress && (
                    <div className="text-[11px] font-mono text-emerald-400 tabular-nums">
                      {activeProgress.tasksCompleted} tasks done · {activeAstronaut.role}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => announceAstronautBriefing(activeAstronaut.id)}
                title={`Replay NASA Task & Survival Briefing for ${activeAstronaut.name}`}
                className="px-2.5 py-1 rounded bg-[#07090E] hover:bg-slate-800 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Radio className="w-3 h-3" />
                Brief
              </button>

              {sceneMode === 'outpost' && (
                <button
                  type="button"
                  onClick={() => setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))}
                  className="px-2.5 py-1 rounded bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-sky-300 flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Video className="w-3.5 h-3.5" />
                  {cameraMode === 'follow' ? 'Follow Cam' : 'Overview Cam'}
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Clean Mission Actions + Advance Day */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleInspectFlueWithDuty}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-amber-500/40 text-xs font-medium text-amber-200 flex items-center gap-1.5"
              >
                <Fan className="w-3.5 h-3.5 text-amber-400" />
                Storm Flue ({state.stormFlue.cloggedPct}%)
              </button>
              {onTriggerStormScene && (
                <button
                  type="button"
                  onClick={() => {
                    stopNasaSpeech();
                    onTriggerStormScene();
                  }}
                  title="Preview Incoming Storm Animation Scene"
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-xs font-medium text-amber-200 flex items-center gap-1.5"
                >
                  <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
                  Storm Scene
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveModal('telemetry')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-sky-400" /> Telemetry ({collectedCount}/
                {state.dataNodes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('resources')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" /> Resources
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('research')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <FlaskConical className="w-3.5 h-3.5 text-emerald-400" /> Research (
                {state.sciencePoints})
              </button>
              <button
                type="button"
                onClick={onOpenEmergency}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                  state.activeEvent
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Emergency
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('objectives')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5 text-sky-400" /> Objectives
              </button>
              <button
                type="button"
                onClick={() => setAdvisorOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-xs font-medium text-sky-300 flex items-center gap-1.5"
              >
                <Bot className="w-3.5 h-3.5" /> Advisor
              </button>
            </div>

            <button
              type="button"
              disabled={paused || Boolean(state.activeEvent)}
              onClick={onAdvanceDay}
              className={`px-5 py-2 rounded-lg font-display font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                paused || state.activeEvent
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {state.activeEvent ? 'Resolve Emergency First' : 'Advance Day'}
            </button>
          </div>
        </footer>
      )}

      {/* Clickable Resource Detail Modal (Solid dark backdrop, no backdrop-blur) */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl bg-space-900 border border-slate-700 p-6 relative">
            <button
              type="button"
              onClick={() => setSelectedResource(null)}
              aria-label="Close diagnostics"
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-xs font-mono text-sky-400 mb-1">System Diagnostics</div>
            <h3 className="font-display text-2xl font-bold text-white capitalize mb-4">
              {selectedResource} Management
            </h3>

            {selectedResource === 'oxygen' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Current Reserve</span>
                  <span className="font-mono tabular-nums font-bold text-white">
                    {state.resources.oxygen.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Daily Production</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    +{preview.oxygenProd}/day
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Crew Consumption</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{preview.oxygenCons}/day
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Projected Duration</span>
                  <span className="font-mono text-sky-400">
                    {expectedDaysLeft(
                      state.resources.oxygen.current,
                      preview.oxygenProd,
                      preview.oxygenCons
                    )}
                  </span>
                </div>
              </div>
            )}

            {selectedResource === 'water' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Current Water Reserve</span>
                  <span className="font-mono tabular-nums font-bold text-white">
                    {state.resources.water.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Recycling &amp; ISRU Gain</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    +{preview.waterProd}/day
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Crew + Greenhouse Demand</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{preview.waterCons}/day
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Expected Supply Duration</span>
                  <span className="font-mono text-sky-400">
                    {expectedDaysLeft(
                      state.resources.water.current,
                      preview.waterProd,
                      preview.waterCons
                    )}
                  </span>
                </div>
              </div>
            )}

            {selectedResource === 'food' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Food Rations</span>
                  <span className="font-mono tabular-nums font-bold text-white">
                    {state.resources.food.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Greenhouse Yield</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    +{preview.foodProd}/day
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Crew Consumption</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{preview.foodCons}/day
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Expected Supply Duration</span>
                  <span className="font-mono text-sky-400">
                    {expectedDaysLeft(
                      state.resources.food.current,
                      preview.foodProd,
                      preview.foodCons
                    )}
                  </span>
                </div>
              </div>
            )}

            {selectedResource === 'power' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Battery Storage</span>
                  <span className="font-mono tabular-nums font-bold text-white">
                    {state.resources.battery.current} / {state.resources.battery.max} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Solar Generation Today</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    +{preview.powerGen} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Total Outpost Load</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{preview.powerUsed} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Solar Condition</span>
                  <span className="font-mono text-sky-300">{preview.solarCondition}</span>
                </div>
              </div>
            )}

            {selectedResource === 'shielding' && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Radiation Mitigation</span>
                  <span className="font-mono tabular-nums font-bold text-white">
                    {state.resources.shielding}%
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Cumulative Crew Exposure</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {state.crew.radiationExposure}%
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Switch to Om or upgrade your Habitat / Radiation Shelter to keep cosmic &amp;
                  Jovian exposure low.
                </p>
              </div>
            )}

            {selectedResource === 'crew' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Crew Safe</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-400">
                    {state.crew.safe} / {state.crew.total} Astronauts
                  </span>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {ASTRONAUTS.map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-lg bg-space-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{a.name}</span>
                        <span className="text-slate-400 block">{a.role}</span>
                      </div>
                      <span className="font-mono text-sky-400">
                        {state.crewProgress[a.id]?.tasksCompleted || 0} tasks
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedResource(null)}
                className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry / Research / Resources / Objectives Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full rounded-xl bg-space-900 border border-slate-700 p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {activeModal === 'telemetry' && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-mono text-sky-400 mb-1">
                    {state.planetName} · Telemetry &amp; Planetary Data
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Mission Trends, Storm Flue &amp; Surface Samples
                  </h3>
                </div>

                <div className="p-4 rounded-lg bg-space-950 border border-slate-800">
                  <MissionChart history={state.history} />
                </div>

                <div>
                  <div className="text-xs font-mono uppercase text-sky-400 mb-2">
                    {state.planetName} Planetary Data Nodes ({collectedCount}/{state.dataNodes.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {state.dataNodes.map((node) => (
                      <div
                        key={node.id}
                        className={`p-3 rounded-lg border text-xs ${
                          node.collected
                            ? 'bg-emerald-950/30 border-emerald-500/40'
                            : 'bg-space-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-white mb-1">
                          <span>{node.label}</span>
                          <span className="font-mono text-sky-400">+{node.scienceValue} SCI</span>
                        </div>
                        <div className="font-mono text-[11px] text-amber-300 mb-1">
                          {node.reading}
                        </div>
                        <p className="text-slate-400">{node.summary}</p>
                        {!node.collected && (
                          <button
                            type="button"
                            onClick={() => handleCollectNodeWithDuty(node.id)}
                            className="mt-2 px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold"
                          >
                            Collect Sample Now
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-mono uppercase text-sky-400 mb-2">
                    Mission Activity Log
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {state.activityLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-lg border border-slate-800 bg-space-950 text-xs"
                      >
                        <div className="font-mono text-[11px] text-slate-400">
                          Day {String(entry.day).padStart(2, '0')} · {entry.time}
                        </div>
                        <div className="font-semibold text-white">{entry.title}</div>
                        <div className="text-slate-300">{entry.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'research' && (
              <>
                <div className="text-xs font-mono text-emerald-400 mb-1">
                  Technology Research Lab · {state.sciencePoints} SCI Available
                </div>
                <h3 className="font-display text-2xl font-bold text-white mb-4">
                  Unlock Engineering Upgrades
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      id: 'water' as const,
                      title: 'Closed-Loop Membrane Filter (+15% Water)',
                      cost: 30,
                      desc: 'Improves water recycling recovery using multi-stage catalytic oxidation.',
                    },
                    {
                      id: 'solar' as const,
                      title: 'Perovskite Solar Coating (+15% Power)',
                      cost: 30,
                      desc: 'Increases photovoltaic capture even under low-angle polar sunlight.',
                    },
                    {
                      id: 'crop' as const,
                      title: 'LED Spectrum Hydroponics (+15% Food)',
                      cost: 30,
                      desc: 'Optimizes plant photosynthesis without extra water consumption.',
                    },
                  ].map((tech) => (
                    <div
                      key={tech.id}
                      className="p-3.5 rounded-lg bg-space-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">{tech.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{tech.desc}</div>
                      </div>
                      <button
                        type="button"
                        disabled={state.sciencePoints < tech.cost}
                        onClick={() => onResearchTech(tech.id, tech.cost)}
                        className={`px-3 py-2 rounded-lg font-mono tabular-nums text-xs font-bold shrink-0 ${
                          state.sciencePoints >= tech.cost
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {tech.cost} SCI
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeModal === 'resources' && (
              <>
                <div className="text-xs font-mono text-sky-400 mb-1">Daily Net Balance</div>
                <h3 className="font-display text-2xl font-bold text-white mb-4">
                  Outpost Resource Flow
                </h3>
                <div className="space-y-2.5 text-sm font-mono tabular-nums">
                  <div className="flex justify-between p-3 rounded-lg bg-space-950">
                    <span>Oxygen Net/Day</span>
                    <span
                      className={
                        preview.oxygenProd - preview.oxygenCons >= 0
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {(preview.oxygenProd - preview.oxygenCons).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-space-950">
                    <span>Water Net/Day</span>
                    <span
                      className={
                        preview.waterProd - preview.waterCons >= 0
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {(preview.waterProd - preview.waterCons).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-space-950">
                    <span>Food Net/Day</span>
                    <span
                      className={
                        preview.foodProd - preview.foodCons >= 0
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {(preview.foodProd - preview.foodCons).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-space-950">
                    <span>Power Net/Day</span>
                    <span
                      className={
                        preview.powerGen - preview.powerUsed >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {preview.powerGen - preview.powerUsed} kWh
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Tip: Click any 3D module on the landing pad to toggle Standby or run an
                  astronaut&apos;s NASA maintenance task.
                </p>
              </>
            )}

            {activeModal === 'objectives' && (
              <>
                <div className="text-xs font-mono text-sky-400 mb-1">NASA Mission Checklist</div>
                <h3 className="font-display text-2xl font-bold text-white mb-4">
                  {state.operationName} Objectives
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  <li>
                    · Survive until Day {state.maxDays} (Currently Day {state.day})
                  </li>
                  <li>
                    · Keep all {state.crew.total} astronauts safe (Currently {state.crew.safe}/
                    {state.crew.total})
                  </li>
                  <li>· Keep Storm Flue clogs below 65% (Currently {state.stormFlue.cloggedPct}%)</li>
                  <li>
                    · Collect Planetary Data Nodes on {state.planetName} ({collectedCount}/
                    {state.dataNodes.length})
                  </li>
                  <li>
                    · Deploy across NASA worlds ({state.visitedWorlds.length}/4 worlds visited)
                  </li>
                  <li>
                    · Keep Radiation Exposure below 100% ({state.crew.radiationExposure}%)
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {advisorOpen && (
        <AdvisorModal
          state={state}
          preview={preview}
          onClose={() => setAdvisorOpen(false)}
        />
      )}
    </div>
  );
}
