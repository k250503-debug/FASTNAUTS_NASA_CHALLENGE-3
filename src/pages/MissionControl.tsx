import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUp,
  ArrowUpCircle,
  Award,
  Bot,
  Car,
  CheckCircle2,
  CloudLightning,
  Compass,
  Droplets,
  Eye,
  EyeOff,
  Fan,
  FlaskConical,
  Fuel,
  Globe,
  HeartPulse,
  LogOut,
  Package,
  Pause,
  Play,
  PlusCircle,
  Power,
  Radio,
  Rocket,
  Shield,
  Sliders,
  Target,
  User,
  Utensils,
  Video,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import AdvisorModal from '../components/AdvisorModal';
import AstronautView from '../components/AstronautView';
import EngineeringMiniGameModal from '../components/EngineeringMiniGameModal';
import MissionChart from '../components/MissionChart';
import OperationsModals, { type OpsModalKind } from '../components/OperationsModals';
import TacticalMinimap from '../components/TacticalMinimap';
import TaskAnimationView, {
  type ActiveTaskDuty,
  type AstronautTaskKind,
} from '../components/TaskAnimationView';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import { getPlanetById, PLANETS } from '../data/planets';
import { SPARE_PART_DEFS } from '../data/systems';
import { calculateDailyPreview } from '../simulation/calculations';
import OutpostScene3D, {
  type NearbyTarget,
  type OutpostCameraMode,
} from '../three/OutpostScene3D';
import { ROAMING_RADIUS } from '../three/terrain';
import type {
  AstronautId,
  BuildingTypeId,
  ConstructionMaterialId,
  MiniGameKind,
  MissionState,
  PlanetId,
  SparePartId,
  SuitPartId,
} from '../types';
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
  onConstructBuilding: (typeId: BuildingTypeId, cellIndex: number) => void;
  onResearchTech: (techId: 'water' | 'solar' | 'crop', cost: number) => void;
  onSelectAstronaut: (id: AstronautId) => void;
  onInspectStormFlue: () => void;
  onCollectDataNode: (nodeId: string) => void;
  onServiceBuilding: (uid: string) => void;
  onPerformSuitDiagnostic: (partId: SuitPartId, astronautId: AstronautId) => void;
  onTravelToWorld: (planetId: PlanetId) => void;
  onSynthesizeFuel: () => void;
  onRefuelStarship: () => void;
  onDiagnoseCrew: (id: AstronautId) => void;
  onTreatCrew: (id: AstronautId) => void;
  onCommsStep: (step: 'inspect' | 'diagnose' | 'replace' | 'test') => void;
  onCraftPart: (partId: SparePartId) => void;
  onRecycleScrap: (material: ConstructionMaterialId) => void;
  onOrderResupply: (bundle: 'spare_bundle' | 'med_bundle' | 'antenna_kit') => void;
  onInspectBuildingDamage: (uid: string) => void;
  onRepairBuilding: (uid: string) => void;
  onCleanDust: (uid?: string) => void;
  onRepairRover: () => void;
  onRechargeRover: () => void;
  onToggleRoverDrive: () => void;
  onToggleShelterRefuge: () => void;
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
  onConstructBuilding,
  onResearchTech,
  onSelectAstronaut,
  onInspectStormFlue,
  onCollectDataNode,
  onServiceBuilding,
  onPerformSuitDiagnostic,
  onTravelToWorld,
  onSynthesizeFuel,
  onRefuelStarship,
  onDiagnoseCrew,
  onTreatCrew,
  onCommsStep,
  onCraftPart,
  onRecycleScrap,
  onOrderResupply,
  onInspectBuildingDamage,
  onRepairBuilding,
  onCleanDust,
  onRepairRover,
  onRechargeRover,
  onToggleRoverDrive,
  onToggleShelterRefuge,
  onTriggerStormScene,
  onOpenEmergency,
  onExitMission,
}: MissionControlProps) {
  const [paused, setPaused] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [sceneMode, setSceneMode] = useState<'outpost' | 'astronaut'>('outpost');
  const [cameraMode, setCameraMode] = useState<OutpostCameraMode>('follow');
  const [nearbyTarget, setNearbyTarget] = useState<NearbyTarget | null>(null);
  const [nearBoundary, setNearBoundary] = useState(false);
  const [mapPositions, setMapPositions] = useState<{
    astronauts: Array<{ id: AstronautId; x: number; z: number }>;
    rover: { x: number; z: number; yaw: number };
  }>({ astronauts: [], rover: { x: 10.5, z: 9.8, yaw: 0 } });

  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [selectedBuildingUid, setSelectedBuildingUid] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    'research' | 'objectives' | 'resources' | 'telemetry' | null
  >(null);
  const [opsModal, setOpsModal] = useState<OpsModalKind>(null);
  const [pendingTransitWorld, setPendingTransitWorld] = useState<PlanetId | null>(null);
  const [miniGameState, setMiniGameState] = useState<{
    kind: MiniGameKind;
    title: string;
    onWin: () => void;
  } | null>(null);

  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [busyDuty, setBusyDuty] = useState<ActiveTaskDuty | null>(null);
  const [capcomBanner, setCapcomBanner] = useState<{
    title: string;
    text: string;
    severity: 'info' | 'warning' | 'danger';
  } | null>(null);

  const interactRef = useRef<(() => void) | null>(null);
  const jumpRef = useRef<(() => void) | null>(null);
  const busyTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const spokenAlertKeysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef(state);
  stateRef.current = state;
  const dutySeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (busyTimerRef.current !== null) window.clearTimeout(busyTimerRef.current);
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
      stopNasaSpeech();
    };
  }, []);

  useEffect(() => {
    if (isAudioMuted) stopNasaSpeech();
  }, [isAudioMuted]);

  const showCapcomBanner = (
    title: string,
    text: string,
    severity: 'info' | 'warning' | 'danger',
    durationMs = 9500
  ) => {
    if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
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
    showCapcomBanner(`Flight Officer Elena Vance · ${astro.name}`, script, 'info', 11000);
    speakNasaText(script, {
      muted: isAudioMuted,
      rate: 0.98,
      pitch: 1.12,
    });
  };

  useEffect(() => {
    announceAstronautBriefing(state.activeAstronautId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeAstronautId, state.planetId]);

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
    durationMs = 2400
  ) => {
    if (busyTimerRef.current !== null) window.clearTimeout(busyTimerRef.current);
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

  const planet = getPlanetById(state.planetId);
  const preview = calculateDailyPreview(state);
  const powerPct = Math.round(
    (state.resources.battery.current / state.resources.battery.max) * 100
  );
  const collectedCount = state.dataNodes.filter((n) => n.collected).length;
  const activeAstronaut = getAstronautById(state.activeAstronautId);
  const activeProgress = state.crewProgress[state.activeAstronautId];
  const isActiveBusy = busyDuty?.astronautId === state.activeAstronautId;

  const medicalAlertsCount = Object.values(state.crewVitals).filter(
    (v) => v.medicalAlert !== null
  ).length;
  const lowPartsCount = SPARE_PART_DEFS.filter(
    (p) => (state.spareParts[p.id] || 0) < p.criticalMin
  ).length;
  const damagedCount =
    state.buildings.filter((b) => b.damaged || b.conditionPct < 88).length +
    (state.rover.damaged ? 1 : 0);

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
    if (targetBld?.damaged) {
      setSelectedBuildingUid(uid);
      setOpsModal('damage');
      return;
    }
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
      'Purge Storm Flue',
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

  const cycleCameraMode = () => {
    setCameraMode((prev) =>
      prev === 'follow' ? 'overview' : prev === 'overview' ? 'first_person' : 'follow'
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#05070C] text-slate-100">
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
          onBoundaryWarning={setNearBoundary}
          onPositionUpdate={setMapPositions}
          onSelectAstronaut={onSelectAstronaut}
          onSelectBuilding={handleSelectAndInspectBuilding}
          onServiceBuilding={handleServiceAndSelectBuilding}
          onInteractStormFlue={() => setOpsModal('flue')}
          onInteractSpaceship={() => setOpsModal('fuel')}
          onCollectDataNode={handleCollectNodeWithDuty}
          onFieldWork={handleFieldWorkDuty}
          interactRef={interactRef}
          jumpRef={jumpRef}
        />
      )}

      <TaskAnimationView
        duty={busyDuty}
        hudHidden={hudHidden}
        onDismiss={() => setBusyDuty(null)}
      />

      {/* First-person visor frame overlay (non-blurring) */}
      {sceneMode === 'outpost' && cameraMode === 'first_person' && (
        <div className="pointer-events-none fixed inset-0 z-10">
          <div className="absolute inset-5 border border-sky-400/20 rounded-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
            <span className="w-3 h-[1px] bg-sky-300/80" />
            <span className="absolute h-3 w-[1px] bg-sky-300/80" />
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="absolute top-0 inset-x-0 z-20 bg-[#0F1623]/94 border-b border-slate-800 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Rocket className="w-4 h-4 text-sky-400" />
            <span className="font-display font-bold text-white tracking-wider text-sm">
              ASTRA 3D
            </span>
          </div>

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

          <label className="flex items-center gap-1.5 bg-[#07090E] border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-sky-300">
            <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              aria-label="Select planetary outpost"
              value={state.planetId}
              onChange={(e) => {
                const dest = e.target.value as PlanetId;
                if (dest !== state.planetId) setPendingTransitWorld(dest);
              }}
              className="bg-transparent text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {PLANETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0F1623] text-slate-100">
                  {p.name} ({p.gravityMs2} m/s²)
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Core Vitals Pills (Clicking opens diagnostics only — never completes tasks) */}
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
            onClick={() => setOpsModal('fuel')}
            title="Open Propellant & Starship Fuel Console"
            className={`px-2 py-1 rounded bg-[#07090E] border flex items-center gap-1 ${toneClass(
              state.fuel.shipTankPct,
              45,
              25
            )}`}
          >
            <Fuel className="w-3 h-3" /> Fuel {state.fuel.shipTankPct}%
          </button>
          <button
            type="button"
            onClick={() => setOpsModal('flue')}
            title="Inspect Storm Flue Telemetry"
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

        {/* Day & Audio / Pause / Exit */}
        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums shrink-0">
          <span className="px-2.5 py-1 rounded bg-[#07090E] border border-slate-700 text-white">
            Day {String(state.day).padStart(2, '0')}/{state.maxDays}
          </span>
          {state.lunarState.eclipseActive && (
            <span className="px-2 py-1 rounded bg-amber-950 border border-amber-400 text-amber-200 text-[10px]">
              ECLIPSE
            </span>
          )}
          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
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
            aria-label="Exit Mission"
            className="p-1.5 rounded bg-[#07090E] border border-slate-700 hover:border-rose-400 text-slate-300 hover:text-rose-400"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Alerts / Boundary / Refuge / Capcom Strip */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 w-[min(92vw,700px)] pointer-events-none">
        {nearBoundary && (
          <div className="px-3 py-1 rounded-lg bg-amber-950/95 border border-amber-400 text-xs font-mono text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Outpost Roaming Perimeter (R={ROAMING_RADIUS}m) Reached — Clamped Safely
          </div>
        )}

        {state.shelterRefugeActive && (
          <div className="pointer-events-auto w-full rounded-xl bg-amber-950/95 border border-amber-500 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-amber-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <strong>Emergency Shelter Refuge Active:</strong> Crew protected inside Habitat &amp;
              Starship airlocks.
            </span>
            <button
              type="button"
              onClick={onToggleShelterRefuge}
              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold shrink-0"
            >
              Exit Shelter
            </button>
          </div>
        )}

        {state.activeEvent ? (
          <div className="pointer-events-auto w-full rounded-xl bg-rose-950/95 border border-rose-500 px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-xl">
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
              className={`pointer-events-auto w-full rounded-xl border px-3.5 py-2 flex items-center justify-between gap-3 shadow-xl ${
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
                aria-label="Dismiss voice banner"
                className="p-1 text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        )}
      </div>

      {/* Top-Right Tactical Minimap (hidden when building inspector open) */}
      {!hudHidden && sceneMode === 'outpost' && !selectedBuilding && (
        <div className="hidden md:block absolute top-16 right-4 z-10">
          <TacticalMinimap
            state={state}
            positions={mapPositions}
            onSelectAstronaut={onSelectAstronaut}
          />
        </div>
      )}

      {/* Selected Building Inspector */}
      {selectedBuilding && selectedBuildingDef && (
        <div className="absolute top-16 right-4 z-20 w-80 rounded-xl bg-[#0F1623]/95 border border-slate-700 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-[10px] font-mono uppercase text-sky-400">
                3D Module Selected · {Math.round(selectedBuilding.conditionPct)}% Integrity
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

          {selectedBuilding.damaged && (
            <div className="mb-2.5 p-2 rounded bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200">
              Damaged: {selectedBuilding.damageCause} — Inspect &amp; repair in Repairs panel.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {selectedBuilding.damaged ? (
              <button
                type="button"
                onClick={() => setOpsModal('damage')}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" /> Inspect &amp; Repair Module
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleServiceAndSelectBuilding(selectedBuilding.uid)}
                className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                Run {activeAstronaut.name}&apos;s Shift
              </button>
            )}

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

      {/* Proximity [E] Prompt */}
      {sceneMode === 'outpost' && nearbyTarget && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all ${
            hudHidden ? 'bottom-14' : 'bottom-48 sm:bottom-44'
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

      {/* HUD Toggle */}
      <div
        className={`absolute right-4 z-20 transition-all ${
          hudHidden ? 'bottom-3' : 'bottom-[178px] sm:bottom-[154px]'
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

      {/* Bottom Operations & Crew Dock */}
      {!hudHidden && (
        <footer className="absolute bottom-0 inset-x-0 z-20 bg-[#0F1623]/94 border-t border-slate-800 px-3 sm:px-5 py-2.5 flex flex-col gap-2">
          {/* Row 1: 6 Astronauts + Camera + Jump + Rover Drive */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {ASTRONAUTS.map((astro) => {
                const isSelected = state.activeAstronautId === astro.id;
                const prog = state.crewProgress[astro.id];
                const vitals = state.crewVitals[astro.id];
                const isBusy = busyDuty?.astronautId === astro.id;
                return (
                  <button
                    key={astro.id}
                    type="button"
                    onClick={() => onSelectAstronaut(astro.id)}
                    className={`px-2 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      vitals?.medicalAlert
                        ? 'bg-rose-950/50 border-rose-500 text-rose-100'
                        : isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white font-semibold'
                        : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: astro.suitColor }}
                    />
                    <span>{astro.name}</span>
                    {vitals?.medicalAlert && (
                      <span className="text-[10px] text-rose-400 font-bold">✚</span>
                    )}
                    {isBusy ? (
                      <span className="px-1 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[9px] font-bold">
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

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <div className="px-2.5 py-1 rounded-lg bg-[#07090E] border border-slate-800 flex items-center gap-2">
                <span className="font-semibold text-white">{activeAstronaut.name}</span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {activeProgress?.tasksCompleted || 0} tasks
                </span>
                <span className="text-[11px] font-mono text-sky-300">
                  g={planet.gravityMs2} m/s²
                </span>
              </div>

              {sceneMode === 'outpost' && (
                <>
                  <button
                    type="button"
                    onClick={() => jumpRef.current?.()}
                    className="px-2.5 py-1 rounded bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-300 flex items-center gap-1 whitespace-nowrap"
                    title="Jump using planetary gravity [Space]"
                  >
                    <ArrowUp className="w-3 h-3" />
                    Jump [Space]
                  </button>
                  <button
                    type="button"
                    onClick={onToggleRoverDrive}
                    disabled={state.rover.damaged}
                    className={`px-2.5 py-1 rounded border text-[11px] font-mono flex items-center gap-1 whitespace-nowrap ${
                      state.rover.manualControl
                        ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                        : 'bg-[#07090E] border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Car className="w-3 h-3" />
                    {state.rover.damaged
                      ? 'Rover Damaged'
                      : state.rover.manualControl
                      ? 'Exit Rover'
                      : 'Drive Rover'}
                  </button>
                  <button
                    type="button"
                    onClick={cycleCameraMode}
                    className="px-2.5 py-1 rounded bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-sky-300 flex items-center gap-1 whitespace-nowrap"
                  >
                    <Video className="w-3.5 h-3.5" />
                    {cameraMode === 'follow'
                      ? 'Follow Cam'
                      : cameraMode === 'overview'
                      ? 'Overview Cam'
                      : '1st Person'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Mission Systems Bar + Advance Day */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpsModal('fuel')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-emerald-500/40 text-xs font-medium text-emerald-300 flex items-center gap-1.5"
              >
                <Fuel className="w-3.5 h-3.5" />
                Fuel ({state.fuel.shipTankPct}%)
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('medical')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                  medicalAlertsCount > 0
                    ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-semibold'
                    : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                Medical {medicalAlertsCount > 0 ? `(${medicalAlertsCount})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('comms')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                  state.comms.fault
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold'
                    : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                Comms {state.comms.fault ? 'FAULT' : `${state.comms.signalStrengthPct}%`}
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('parts')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                  lowPartsCount > 0
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                    : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                Parts {lowPartsCount > 0 ? `(${lowPartsCount} Low)` : ''}
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('damage')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                  damagedCount > 0
                    ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-semibold'
                    : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Repairs {damagedCount > 0 ? `(${damagedCount})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('build_module')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                Build ({state.budget} CR)
              </button>

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
                onClick={() => setActiveModal('research')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <FlaskConical className="w-3.5 h-3.5 text-emerald-400" /> Lab ({state.sciencePoints})
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('whatif')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" /> What-If
              </button>

              <button
                type="button"
                onClick={() => setOpsModal('achievements')}
                className="px-2.5 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" /> Honors
              </button>

              <button
                type="button"
                onClick={onToggleShelterRefuge}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                  state.shelterRefugeActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-[#07090E] hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {state.shelterRefugeActive ? 'Sheltered' : 'Refuge Drill'}
              </button>

              {onTriggerStormScene && (
                <button
                  type="button"
                  onClick={() => {
                    stopNasaSpeech();
                    onTriggerStormScene();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-xs font-medium text-amber-200 flex items-center gap-1.5"
                >
                  <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
                  Storm Sim
                </button>
              )}

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

      {/* Resource Diagnostics Modal */}
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
                  <span className="font-mono font-bold text-white">
                    {state.resources.oxygen.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Production / Consumed</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.oxygenProd} / -{preview.oxygenCons}
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
                  <span className="font-mono font-bold text-white">
                    {state.resources.water.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Production / Demand</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.waterProd} / -{preview.waterCons}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Projected Duration</span>
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
                  <span className="font-mono font-bold text-white">
                    {state.resources.food.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Greenhouse Yield / Demand</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.foodProd} / -{preview.foodCons}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Projected Duration</span>
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
                  <span className="font-mono font-bold text-white">
                    {state.resources.battery.current} / {state.resources.battery.max} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Solar Gen / Base Load</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.powerGen} / -{preview.powerUsed} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-space-950">
                  <span className="text-slate-400">Solar Condition</span>
                  <span className="font-mono text-sky-300">{preview.solarCondition}</span>
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

      {/* Telemetry / Research Modal */}
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
                    Mission Trends, Data Nodes &amp; Event Log
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
          </div>
        </div>
      )}

      {/* Specialized Engineering Operations & Transit Confirmation Modals */}
      <OperationsModals
        openModal={opsModal}
        state={state}
        pendingTransitWorld={pendingTransitWorld}
        onClose={() => setOpsModal(null)}
        onCancelTransit={() => setPendingTransitWorld(null)}
        onConfirmTransit={(dest) => {
          setPendingTransitWorld(null);
          onTravelToWorld(dest);
        }}
        onSynthesizeFuel={onSynthesizeFuel}
        onRefuelStarship={onRefuelStarship}
        onDiagnoseCrew={onDiagnoseCrew}
        onTreatCrew={onTreatCrew}
        onCommsStep={onCommsStep}
        onCraftPart={onCraftPart}
        onRecycleScrap={onRecycleScrap}
        onOrderResupply={onOrderResupply}
        onInspectBuildingDamage={onInspectBuildingDamage}
        onRepairBuilding={onRepairBuilding}
        onCleanDust={onCleanDust}
        onRepairRover={onRepairRover}
        onRechargeRover={onRechargeRover}
        onPurgeFlue={handleInspectFlueWithDuty}
        onConstructBuilding={onConstructBuilding}
        onOpenMiniGame={(kind, title, onWin) =>
          setMiniGameState({ kind, title, onWin })
        }
      />

      {miniGameState && (
        <EngineeringMiniGameModal
          kind={miniGameState.kind}
          title={miniGameState.title}
          onClose={() => setMiniGameState(null)}
          onSuccess={() => {
            const winFn = miniGameState.onWin;
            setMiniGameState(null);
            winFn();
          }}
        />
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
