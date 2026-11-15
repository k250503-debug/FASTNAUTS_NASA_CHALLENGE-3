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
  ListChecks,
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
  Sparkles,
  User,
  Users,
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
import AstronautGalleryModal from '../components/AstronautGalleryModal';
import AstronautView from '../components/AstronautView';
import EngineeringMiniGameModal from '../components/EngineeringMiniGameModal';
import EquipmentShowcaseModal from '../components/EquipmentShowcaseModal';
import MissionChart from '../components/MissionChart';
import OperationsModals, { type OpsModalKind } from '../components/OperationsModals';
import TacticalMinimap from '../components/TacticalMinimap';
import TaskAnimationView, {
  type ActiveTaskDuty,
  type AstronautTaskKind,
} from '../components/TaskAnimationView';
import { ASTRONAUTS, getAstronautById } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import { getPlanetById } from '../data/planets';
import { SPARE_PART_DEFS } from '../data/systems';
import { calculateDailyPreview } from '../simulation/calculations';
import { getDailyCompletionStatus } from '../simulation/dayCompletion';
import OutpostScene3D, {
  type NearbyTarget,
  type OutpostCameraMode,
} from '../three/OutpostScene3D';
import { ROAMING_RADIUS } from '../three/terrain';
import type {
  AstronautCustomization,
  AstronautId,
  BuildingTypeId,
  ConstructionMaterialId,
  EquipmentId,
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
  onAddEquipmentToInventory?: (id: EquipmentId) => void;
  onUpdateAstronautCustomization?: (id: AstronautId, custom: AstronautCustomization) => void;
  onOpenEmergency: () => void;
  onExitMission: () => void;
}

export default function MissionControl({
  state,
  isAudioMuted,
  onToggleAudio,
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
  onAddEquipmentToInventory,
  onUpdateAstronautCustomization,
  onOpenEmergency,
  onExitMission,
}: MissionControlProps) {
  const [paused, setPaused] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [sceneMode, setSceneMode] = useState<'outpost' | 'astronaut'>('outpost');
  const [inspectEquipmentId, setInspectEquipmentId] = useState<EquipmentId | null>(null);
  const [astronautGalleryOpen, setAstronautGalleryOpen] = useState(false);
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
  const [opsMenuOpen, setOpsMenuOpen] = useState(false);
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
    setActiveModal(null);
    setOpsModal(null);
    setOpsMenuOpen(false);
    setSelectedResource(null);
    setSelectedBuildingUid(null);
    setMiniGameState(null);
    setAdvisorOpen(false);
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
  const dailyCompletion = getDailyCompletionStatus(state);
  const powerPct = Math.round(
    (state.resources.battery.current / state.resources.battery.max) * 100
  );
  const collectedCount = dailyCompletion.dataCollectedCount;
  const activeAstronaut = getAstronautById(state.activeAstronautId);

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

      {/* Top Header: 6 Core Status Indicators + Mission Controls */}
      <header className="absolute top-0 inset-x-0 z-20 astra-glass-dock border-b px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Rocket className="w-4 h-4 text-cyan-400" />
            <span className="font-display font-bold text-white tracking-wider text-sm">
              ASTRA
            </span>
          </div>

          <div className="flex items-center gap-1 astra-glass-subtle rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSceneMode('outpost')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                sceneMode === 'outpost'
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Outpost
            </button>
            <button
              type="button"
              onClick={() => setSceneMode('astronaut')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                sceneMode === 'astronaut'
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-3 h-3" />
              Crew Suit
            </button>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 whitespace-nowrap">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {planet.name} · {planet.gravityMs2} m/s²
          </span>
        </div>

        {/* 6 Essential Status Indicators */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums">
          <button
            type="button"
            onClick={() => setSelectedResource('oxygen')}
            className={`px-2 py-1 rounded astra-glass-pill border flex items-center gap-1 hover:border-cyan-400/60 transition-colors ${toneClass(
              state.resources.oxygen.current
            )}`}
          >
            <Wind className="w-3 h-3" /> O₂ {Math.round(state.resources.oxygen.current)}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('water')}
            className={`px-2 py-1 rounded astra-glass-pill border flex items-center gap-1 hover:border-cyan-400/60 transition-colors ${toneClass(
              state.resources.water.current
            )}`}
          >
            <Droplets className="w-3 h-3" /> H₂O {Math.round(state.resources.water.current)}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('food')}
            className={`px-2 py-1 rounded astra-glass-pill border flex items-center gap-1 hover:border-cyan-400/60 transition-colors ${toneClass(
              state.resources.food.current
            )}`}
          >
            <Utensils className="w-3 h-3" /> Food {Math.round(state.resources.food.current)}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('power')}
            className={`px-2 py-1 rounded astra-glass-pill border flex items-center gap-1 hover:border-cyan-400/60 transition-colors ${toneClass(
              powerPct,
              35,
              15
            )}`}
          >
            <Zap className="w-3 h-3" /> {powerPct}%
          </button>
          <button
            type="button"
            onClick={() => setSelectedResource('radiation')}
            title="Inspect Radiation Safety & Shielding"
            className={`px-2 py-1 rounded astra-glass-pill border flex items-center gap-1 hover:border-cyan-400/60 transition-colors ${
              state.crew.radiationExposure >= 65
                ? 'border-rose-500/70 text-rose-300'
                : state.crew.radiationExposure >= 40
                ? 'border-amber-500/70 text-amber-300'
                : 'border-cyan-300/25 text-cyan-200'
            }`}
          >
            <Shield className="w-3 h-3" /> Shield {Math.round(state.resources.shielding)}%
          </button>
          <button
            type="button"
            onClick={() => setOpsModal('medical')}
            title="Open Crew Health & Biometrics"
            className={`px-2 py-1 rounded astra-glass-pill border flex items-center gap-1 hover:border-cyan-400/60 transition-colors ${
              medicalAlertsCount > 0 || state.crew.safe < state.crew.total
                ? 'border-rose-500/70 text-rose-300'
                : 'border-emerald-400/35 text-emerald-300'
            }`}
          >
            <Users className="w-3 h-3" /> Crew {state.crew.safe}/{state.crew.total}
          </button>
        </div>

        {/* Day & Audio / Pause / Exit */}
        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums shrink-0">
          <span className="px-2.5 py-1 rounded astra-glass-pill border border-cyan-300/25 text-white">
            Day {String(state.day).padStart(2, '0')}/{state.maxDays}
          </span>
          {state.lunarState.eclipseActive && (
            <span className="px-2 py-1 rounded astra-glass-warn text-amber-200 text-[10px]">
              ECLIPSE
            </span>
          )}
          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-1.5 rounded astra-glass-pill border border-white/15 hover:border-cyan-400 text-slate-200"
          >
            {isAudioMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume Simulation' : 'Pause Simulation'}
            className="p-1.5 rounded astra-glass-pill border border-white/15 hover:border-cyan-400 text-slate-200"
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
            className="p-1.5 rounded astra-glass-pill border border-white/15 hover:border-rose-400 text-slate-200 hover:text-rose-400"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Alerts / Boundary / Refuge / Capcom Strip */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 w-[min(92vw,700px)] pointer-events-none">
        {nearBoundary && (
          <div className="px-3 py-1 rounded-lg astra-glass-warn text-xs font-mono text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Outpost Roaming Perimeter (R={ROAMING_RADIUS}m) Reached — Clamped Safely
          </div>
        )}

        {state.shelterRefugeActive && (
          <div className="pointer-events-auto w-full rounded-xl astra-glass-warn px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
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
          <div className="pointer-events-auto w-full rounded-xl astra-glass-alert px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-xl">
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
              className={`pointer-events-auto w-full rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 shadow-xl ${
                capcomBanner.severity === 'danger'
                  ? 'astra-glass-alert text-rose-100'
                  : capcomBanner.severity === 'warning'
                  ? 'astra-glass-warn text-amber-100'
                  : 'astra-glass text-slate-100'
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

      {/* Contextual Single-Building Inspector */}
      {selectedBuilding && selectedBuildingDef && (
        <div className="absolute top-16 right-4 z-20 w-80 rounded-xl astra-glass p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-[10px] font-mono uppercase text-cyan-300 tabular-nums">
                Level {selectedBuilding.level} · {Math.round(selectedBuilding.conditionPct)}%
                Integrity
                {(selectedBuilding.dustPct || 0) >= 8
                  ? ` · ${Math.round(selectedBuilding.dustPct || 0)}% Dust`
                  : ''}
              </div>
              <h3 className="font-display font-bold text-white text-base">
                {selectedBuildingDef.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBuildingUid(null)}
              aria-label="Close module inspector"
              className="text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed mb-3">
            {selectedBuildingDef.benefit}
          </p>

          {/* Module-Specific Output & Trade-off Readout */}
          <div className="mb-3 p-2.5 rounded-lg astra-glass-subtle space-y-1 text-[11px] font-mono tabular-nums">
            <div className="flex justify-between text-emerald-300">
              <span className="text-slate-400">Output</span>
              <span>
                {[
                  selectedBuildingDef.powerGen
                    ? `+${selectedBuildingDef.powerGen} kWh`
                    : null,
                  selectedBuildingDef.produces.oxygen > 0
                    ? `+${selectedBuildingDef.produces.oxygen} O₂`
                    : null,
                  selectedBuildingDef.produces.water > 0
                    ? `+${selectedBuildingDef.produces.water} H₂O`
                    : null,
                  selectedBuildingDef.produces.food > 0
                    ? `+${selectedBuildingDef.produces.food} Food`
                    : null,
                  selectedBuildingDef.shieldingBonus > 0
                    ? `+${selectedBuildingDef.shieldingBonus}% Shield`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Support Infrastructure'}
              </span>
            </div>
            {(selectedBuildingDef.powerReq > 0 || selectedBuildingDef.waterReq > 0) && (
              <div className="flex justify-between text-amber-300">
                <span className="text-slate-400">Demand</span>
                <span>
                  {[
                    selectedBuildingDef.powerReq > 0
                      ? `-${selectedBuildingDef.powerReq} kWh`
                      : null,
                    selectedBuildingDef.waterReq > 0
                      ? `-${selectedBuildingDef.waterReq} H₂O`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            )}
          </div>

          {selectedBuilding.damaged && (
            <div className="mb-2.5 p-2 rounded bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200">
              Damaged: {selectedBuilding.damageCause} — Repair to restore full output.
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

            {(selectedBuilding.dustPct || 0) >= 12 && (
              <button
                type="button"
                onClick={() => onCleanDust(selectedBuilding.uid)}
                className="w-full py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Clean Surface Dust (
                {Math.round(selectedBuilding.dustPct || 0)}%)
              </button>
            )}

            <div className="flex items-center gap-2">
              {selectedBuilding.typeId !== 'habitat' && (
                <button
                  type="button"
                  onClick={() => onToggleBuilding(selectedBuilding.uid)}
                  className="flex-1 py-2 px-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs font-medium flex items-center justify-center gap-1.5"
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
            hudHidden ? 'bottom-14' : 'bottom-20'
          }`}
        >
          <button
            type="button"
            onClick={() => interactRef.current?.()}
            className="px-4 py-2 rounded-lg astra-glass border-cyan-400/70 hover:border-cyan-300 text-left shadow-xl flex items-center gap-3"
          >
            <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono font-bold text-xs">
              E
            </span>
            <div>
              <div className="text-xs font-bold text-white">{nearbyTarget.actionLabel}</div>
              <div className="text-[11px] font-mono text-slate-200">
                {nearbyTarget.label} · {nearbyTarget.sublabel}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Operations Drawer Menu (opens above bottom dock on click) */}
      {!hudHidden && opsMenuOpen && (
        <div className="fixed bottom-16 right-4 z-30 w-[min(420px,92vw)] rounded-xl astra-glass-modal p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/15">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-300">
              Outpost Systems &amp; Tools
            </span>
            <button
              type="button"
              onClick={() => setOpsMenuOpen(false)}
              className="text-slate-300 hover:text-white"
              aria-label="Close operations menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('fuel');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-emerald-300"
            >
              <Fuel className="w-3.5 h-3.5 shrink-0" />
              <span>Fuel ({state.fuel.shipTankPct}%)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('medical');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-rose-300"
            >
              <HeartPulse className="w-3.5 h-3.5 shrink-0" />
              <span>Medical {medicalAlertsCount > 0 ? `(${medicalAlertsCount})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('comms');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-sky-300"
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span>Comms {state.comms.fault ? 'FAULT' : `${state.comms.signalStrengthPct}%`}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('damage');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-amber-300"
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>Repairs {damagedCount > 0 ? `(${damagedCount})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('parts');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-amber-200"
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>Parts {lowPartsCount > 0 ? `(${lowPartsCount})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('flue');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-slate-200"
            >
              <Fan className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Flue ({state.stormFlue.cloggedPct}%)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('build_module');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-emerald-300"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Expand ({state.budget})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setActiveModal('telemetry');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-sky-300"
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Data ({collectedCount}/{state.dataNodes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setActiveModal('research');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-emerald-300"
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>Lab ({state.sciencePoints})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('whatif');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-slate-200"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>What-If</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                onToggleShelterRefuge();
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-slate-200"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{state.shelterRefugeActive ? 'Exit Shelter' : 'Shelter Drill'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setInspectEquipmentId('solar_array');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-cyan-300"
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>3D Equipment</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setAstronautGalleryOpen(true);
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-sky-300"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Suit Studio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpsMenuOpen(false);
                setOpsModal('achievements');
              }}
              className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-amber-300"
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Honors</span>
            </button>
            {onTriggerStormScene && (
              <button
                type="button"
                onClick={() => {
                  setOpsMenuOpen(false);
                  stopNasaSpeech();
                  onTriggerStormScene();
                }}
                className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-left flex items-center gap-2 text-amber-300"
              >
                <CloudLightning className="w-3.5 h-3.5 shrink-0" />
                <span>Storm View</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* HUD Toggle */}
      <div
        className={`absolute right-4 z-20 transition-all ${
          hudHidden ? 'bottom-3' : 'bottom-16'
        }`}
      >
        <button
          type="button"
          onClick={() => setHudHidden((h) => !h)}
          className="px-2.5 py-1 rounded-lg astra-glass-pill border border-cyan-300/25 hover:border-cyan-400 text-[11px] font-mono text-slate-200 flex items-center gap-1.5"
        >
          {hudHidden ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
          {hudHidden ? 'Show HUD' : 'Hide HUD'}
        </button>
      </div>

      {/* Single-Row Bottom Dock */}
      {!hudHidden && (
        <footer className="absolute bottom-0 inset-x-0 z-20 astra-glass-dock border-t px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
          {/* Crew Switcher */}
          <div className="flex flex-wrap items-center gap-1">
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
                  className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    vitals?.medicalAlert
                      ? 'astra-glass-alert text-rose-100'
                      : isSelected
                      ? 'bg-cyan-500/25 border-cyan-400 text-white font-semibold'
                      : 'astra-glass-subtle text-slate-200 hover:border-cyan-400/50'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: astro.suitColor }}
                  />
                  <span>{astro.name}</span>
                  {isBusy ? (
                    <span className="text-[10px] font-mono text-amber-300">...</span>
                  ) : (
                    prog?.currentTaskDone && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    )
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Controls: Camera, Movement, Operations Drawer, Objectives, Advisor */}
          <div className="flex flex-wrap items-center gap-1.5">
            {sceneMode === 'outpost' && (
              <>
                <button
                  type="button"
                  onClick={() => jumpRef.current?.()}
                  className="px-2.5 py-1.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs font-mono text-cyan-300 flex items-center gap-1 whitespace-nowrap"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  Jump
                </button>
                <button
                  type="button"
                  onClick={onToggleRoverDrive}
                  disabled={state.rover.damaged}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 whitespace-nowrap ${
                    state.rover.manualControl
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                      : 'astra-glass-subtle hover:border-cyan-400/50 text-slate-200 hover:text-white'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  {state.rover.manualControl ? 'Exit Rover' : 'Rover'}
                </button>
                <button
                  type="button"
                  onClick={cycleCameraMode}
                  className="px-2.5 py-1.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs font-mono text-sky-300 flex items-center gap-1 whitespace-nowrap"
                >
                  <Video className="w-3.5 h-3.5" />
                  {cameraMode === 'follow'
                    ? 'Follow'
                    : cameraMode === 'overview'
                    ? 'Overview'
                    : '1st Person'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpsMenuOpen((o) => !o)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                medicalAlertsCount > 0 || damagedCount > 0 || state.comms.fault
                  ? 'astra-glass-warn text-amber-200'
                  : 'astra-glass-subtle hover:border-cyan-400/50 text-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              Operations
              {medicalAlertsCount + damagedCount + (state.comms.fault ? 1 : 0) > 0 && (
                <span className="font-mono text-[11px] text-amber-300">
                  ({medicalAlertsCount + damagedCount + (state.comms.fault ? 1 : 0)})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('objectives')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono tabular-nums flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                dailyCompletion.allCompleted
                  ? 'astra-glass-success text-emerald-200'
                  : 'astra-glass-subtle hover:border-cyan-400/50 text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Goals {dailyCompletion.completedObjectivesCount}/{dailyCompletion.totalObjectivesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAdvisorOpen(true)}
              className="px-2.5 py-1.5 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs font-medium text-cyan-300 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5" /> Advisor
            </button>

            {state.activeEvent && (
              <button
                type="button"
                disabled={paused}
                onClick={onOpenEmergency}
                className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Resolve Emergency
              </button>
            )}
          </div>
        </footer>
      )}

      {/* Resource Diagnostics Modal */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 astra-glass-backdrop flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl astra-glass-modal p-6 relative">
            <button
              type="button"
              onClick={() => setSelectedResource(null)}
              aria-label="Close diagnostics"
              className="absolute top-4 right-4 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-xs font-mono text-cyan-300 mb-1">System Diagnostics</div>
            <h3 className="font-display text-2xl font-bold text-white capitalize mb-4">
              {selectedResource} Management
            </h3>

            {selectedResource === 'oxygen' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Current Reserve</span>
                  <span className="font-mono font-bold text-white">
                    {state.resources.oxygen.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Production / Consumed</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.oxygenProd} / -{preview.oxygenCons}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Projected Duration</span>
                  <span className="font-mono text-cyan-300">
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
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Current Water Reserve</span>
                  <span className="font-mono font-bold text-white">
                    {state.resources.water.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Production / Demand</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.waterProd} / -{preview.waterCons}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Projected Duration</span>
                  <span className="font-mono text-cyan-300">
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
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Food Rations</span>
                  <span className="font-mono font-bold text-white">
                    {state.resources.food.current} / 100
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Greenhouse Yield / Demand</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.foodProd} / -{preview.foodCons}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Projected Duration</span>
                  <span className="font-mono text-cyan-300">
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
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Battery Storage</span>
                  <span className="font-mono font-bold text-white">
                    {state.resources.battery.current} / {state.resources.battery.max} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Solar Gen / Base Load</span>
                  <span className="font-mono text-emerald-400">
                    +{preview.powerGen} / -{preview.powerUsed} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Solar Condition</span>
                  <span className="font-mono text-cyan-300">{preview.solarCondition}</span>
                </div>
              </div>
            )}

            {selectedResource === 'radiation' && (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Outpost Radiation Shielding</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {Math.round(state.resources.shielding)}%
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Crew Cumulative Exposure</span>
                  <span className="font-mono font-bold text-amber-300">
                    {Math.round(state.crew.radiationExposure)}%
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg astra-glass-subtle">
                  <span className="text-slate-300">Environmental Hazard Factor</span>
                  <span className="font-mono text-slate-200">{planet.radiationHazard}×</span>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedResource(null)}
                className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry / Research Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 astra-glass-backdrop flex items-center justify-center p-4">
          <div className="max-w-2xl w-full rounded-xl astra-glass-modal p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {activeModal === 'telemetry' && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-mono text-cyan-300 mb-1">
                    {state.planetName} · Telemetry &amp; Planetary Data
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Mission Trends, Data Nodes &amp; Event Log
                  </h3>
                </div>

                <div className="p-4 rounded-lg astra-glass-subtle">
                  <MissionChart history={state.history} />
                </div>

                <div>
                  <div className="text-xs font-mono uppercase text-cyan-300 mb-2">
                    {state.planetName} Planetary Data Nodes ({collectedCount}/{state.dataNodes.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {state.dataNodes.map((node) => (
                      <div
                        key={node.id}
                        className={`p-3 rounded-lg border text-xs ${
                          node.collected
                            ? 'astra-glass-success'
                            : 'astra-glass-subtle'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-white mb-1">
                          <span>{node.label}</span>
                          <span className="font-mono text-cyan-300">+{node.scienceValue} SCI</span>
                        </div>
                        <div className="font-mono text-[11px] text-amber-300 mb-1">
                          {node.reading}
                        </div>
                        <p className="text-slate-300">{node.summary}</p>
                        {!node.collected && (
                          <button
                            type="button"
                            onClick={() => handleCollectNodeWithDuty(node.id)}
                            className="mt-2 px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold"
                          >
                            Collect Sample Now
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-mono uppercase text-cyan-300 mb-2">
                    Mission Activity Log
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {state.activityLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-lg astra-glass-subtle text-xs"
                      >
                        <div className="font-mono text-[11px] text-slate-400">
                          Day {String(entry.day).padStart(2, '0')} · {entry.time}
                        </div>
                        <div className="font-semibold text-white">{entry.title}</div>
                        <div className="text-slate-200">{entry.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'objectives' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-cyan-300 mb-1">
                    Day {String(state.day).padStart(2, '0')} / {state.maxDays} · Automatic Progression Protocol
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Daily Mission Objectives
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Complete all crew shifts, clear the Storm Flue, and log all {state.planetName} data nodes to complete Day {state.day}. The next day starts automatically once every objective is met.
                  </p>
                </div>

                {/* 1. Crew Daily Shifts */}
                <div className="p-3.5 rounded-lg astra-glass-subtle space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-100 font-semibold">
                      1. Crew Daily Shifts ({dailyCompletion.crewDoneCount}/{dailyCompletion.crewTotal})
                    </span>
                    <span
                      className={
                        dailyCompletion.allCrewTasksDone ? 'text-emerald-400' : 'text-amber-300'
                      }
                    >
                      {dailyCompletion.allCrewTasksDone ? 'COMPLETED' : 'IN PROGRESS'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Click any pending crew member below, then service a building, collect data, purge the flue, or run a Crew Suit diagnostic.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ASTRONAUTS.map((astro) => {
                      const done = Boolean(state.crewProgress[astro.id]?.currentTaskDone);
                      return (
                        <button
                          key={astro.id}
                          type="button"
                          onClick={() => {
                            onSelectAstronaut(astro.id);
                            setActiveModal(null);
                          }}
                          className={`px-2.5 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                            done
                              ? 'astra-glass-success text-emerald-200'
                              : 'astra-glass-subtle hover:border-cyan-400 text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{astro.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {astro.taskTitle}
                            </div>
                          </div>
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <span className="text-[10px] font-mono text-amber-300 shrink-0">
                              Select
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Storm Flue Daily Inspection */}
                <div className="p-3.5 rounded-lg astra-glass-subtle flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono font-semibold text-slate-100">
                      2. Storm Flue Exhaust Inspection
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Inspect &amp; purge exhaust vents on {state.planetName} (current blockage: {state.stormFlue.cloggedPct}%).
                    </div>
                  </div>
                  {dailyCompletion.flueInspected ? (
                    <span className="text-xs font-mono text-emerald-400 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Cleared
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        setOpsModal('flue');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shrink-0"
                    >
                      Open Flue
                    </button>
                  )}
                </div>

                {/* 3. Planetary Data Nodes */}
                <div className="p-3.5 rounded-lg astra-glass-subtle flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono font-semibold text-slate-100">
                      3. {state.planetName} Data Collection ({dailyCompletion.dataCollectedCount}/{dailyCompletion.dataTotal})
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Scan &amp; collect all planetary science nodes in the field or Telemetry Lab.
                    </div>
                  </div>
                  {dailyCompletion.allDataCollected ? (
                    <span className="text-xs font-mono text-emerald-400 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Collected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveModal('telemetry')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs shrink-0"
                    >
                      View Nodes
                    </button>
                  )}
                </div>

                {/* 4. Emergency Clearance */}
                {!dailyCompletion.emergencyClear && (
                  <div className="p-3.5 rounded-lg astra-glass-alert flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono font-semibold text-rose-200">
                        4. Resolve Active Emergency
                      </div>
                      <div className="text-[11px] text-rose-300 mt-0.5">
                        {state.activeEvent?.title} must be resolved before Day {state.day} concludes.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        onOpenEmergency();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold text-xs shrink-0"
                    >
                      Resolve
                    </button>
                  </div>
                )}
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
                      className="p-3.5 rounded-lg astra-glass-subtle flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">{tech.title}</div>
                        <div className="text-xs text-slate-300 mt-0.5">{tech.desc}</div>
                      </div>
                      <button
                        type="button"
                        disabled={state.sciencePoints < tech.cost}
                        onClick={() => onResearchTech(tech.id, tech.cost)}
                        className={`px-3 py-2 rounded-lg font-mono tabular-nums text-xs font-bold shrink-0 ${
                          state.sciencePoints >= tech.cost
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
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

      {/* Specialized Engineering Operations Modals */}
      <OperationsModals
        openModal={opsModal}
        state={state}
        onClose={() => setOpsModal(null)}
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

      {inspectEquipmentId && (
        <EquipmentShowcaseModal
          initialEquipmentId={inspectEquipmentId}
          inventory={state.equipmentInventory}
          isMuted={isAudioMuted}
          onAddEquipment={(id) => onAddEquipmentToInventory?.(id)}
          onClose={() => setInspectEquipmentId(null)}
        />
      )}

      {astronautGalleryOpen && (
        <AstronautGalleryModal
          activeAstronautId={state.activeAstronautId}
          customizations={state.crewCustomizations}
          isMuted={isAudioMuted}
          onUpdateCustomization={(id, next) => onUpdateAstronautCustomization?.(id, next)}
          onSelectAstronaut={(id) => onSelectAstronaut(id)}
          onClose={() => setAstronautGalleryOpen(false)}
        />
      )}
    </div>
  );
}
