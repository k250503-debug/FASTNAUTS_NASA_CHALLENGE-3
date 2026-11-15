import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import UniverseExperience from './pages/UniverseExperience';
import PlayerSetup from './pages/PlayerSetup';
import PlanetSelection from './pages/PlanetSelection';
import Briefing from './pages/Briefing';
import BaseBuilder from './pages/BaseBuilder';
import MissionControl from './pages/MissionControl';
import EmergencyCenter from './pages/EmergencyCenter';
import MissionReport from './pages/MissionReport';
import DayTransitionOverlay, {
  type DayTransitionRequest,
} from './components/DayTransitionOverlay';
import EquipmentShowcaseModal from './components/EquipmentShowcaseModal';
import AstronautGalleryModal from './components/AstronautGalleryModal';
import type { UniverseExperienceMode } from './three/UniverseScene3D';
import {
  clearSavedMission,
  createDefaultCrewCustomizations,
  createInitialMissionState,
  getWorldDataNodes,
  grantAchievement,
  hasSavedMission,
  loadSavedMission,
  makePlacedBuilding,
  saveMissionProgress,
} from './simulation/resources';
import { simulateNextDay } from './simulation/calculations';
import {
  getDailyCompletionStatus,
  shouldTriggerStormScreen,
} from './simulation/dayCompletion';
import { applyEngineeringDecision } from './simulation/decisions';
import { getAstronautById } from './data/astronauts';
import { getBuildingDef } from './data/buildings';
import { getEquipmentById } from './data/equipment';
import { getPlanetById } from './data/planets';
import {
  COMMS_FAULTS,
  getSparePartDef,
  MEDICAL_CONDITIONS,
} from './data/systems';
import CinematicStoryScene from './three/CinematicStoryScene';
import MissionLaunchScene, { type FlagLandingChoice } from './three/MissionLaunchScene';
import StormArrivalScene from './three/StormArrivalScene';
import type {
  AstronautCustomization,
  AstronautId,
  BuildingTypeId,
  ConstructionMaterialId,
  EquipmentId,
  EventChoice,
  MissionConfig,
  MissionState,
  PlacedBuilding,
  PlanetId,
  ScreenId,
  SparePartId,
  SuitPartId,
} from './types';

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('landing');
  const [universeMode, setUniverseMode] = useState<UniverseExperienceMode>('journey');
  const [missionConfig, setMissionConfig] = useState<MissionConfig>(() => ({
    playerName: '',
    difficulty: 'engineer',
    missionDays: 30,
    planetId: 'mars',
    selectedCommanderId: 'abubakr',
    crewCustomizations: createDefaultCrewCustomizations(),
    preselectedEquipment: ['solar_array', 'solar_water_cycle'],
  }));
  const [preMissionModal, setPreMissionModal] = useState<'equipment' | 'astronauts' | null>(null);
  const [draftBuildings, setDraftBuildings] = useState<PlacedBuilding[]>([]);
  const [draftRemainingBudget, setDraftRemainingBudget] = useState<number>(1150);
  const [simState, setSimState] = useState<MissionState | null>(null);
  const [launchStartStage, setLaunchStartStage] = useState<'boarding' | 'transit'>('boarding');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(() => hasSavedMission());
  const [dayTransition, setDayTransition] = useState<DayTransitionRequest | null>(null);

  const simStateRef = useRef<MissionState | null>(null);
  simStateRef.current = simState;
  const triggeredDayRef = useRef<number | null>(null);
  const transitionSeqRef = useRef(0);

  const audioRef = useRef<{
    ctx: AudioContext;
    masterGain: GainNode;
    stopNodes: () => void;
  } | null>(null);

  useEffect(() => {
    if (simState && simState.status === 'active') {
      saveMissionProgress(simState);
      setSavedAvailable(true);
    } else if (simState && simState.status !== 'active') {
      clearSavedMission();
      setSavedAvailable(false);
    }
  }, [simState]);

  useEffect(() => {
    const stopAmbientHum = () => {
      const current = audioRef.current;
      if (!current) return;
      audioRef.current = null;
      const { ctx, masterGain, stopNodes } = current;
      const now = ctx.currentTime;
      try {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      } catch {
        // Ignore ramp errors if context already closed
      }
      window.setTimeout(() => {
        stopNodes();
        if (ctx.state !== 'closed') ctx.close().catch(() => {});
      }, 400);
    };

    const startAmbientHum = () => {
      if (audioRef.current) return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(135, ctx.currentTime);
      lowpass.Q.setValueAtTime(0.7, ctx.currentTime);

      const oscPrimary = ctx.createOscillator();
      oscPrimary.type = 'sine';
      oscPrimary.frequency.setValueAtTime(55, ctx.currentTime);
      const primaryGain = ctx.createGain();
      primaryGain.gain.setValueAtTime(0.7, ctx.currentTime);

      const oscSub = ctx.createOscillator();
      oscSub.type = 'triangle';
      oscSub.frequency.setValueAtTime(82.41, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.22, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.11, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(22, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(lowpass.frequency);

      oscPrimary.connect(primaryGain);
      primaryGain.connect(lowpass);
      oscSub.connect(subGain);
      subGain.connect(lowpass);

      lowpass.connect(masterGain);
      masterGain.connect(ctx.destination);

      oscPrimary.start();
      oscSub.start();
      lfo.start();

      masterGain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.9);

      const resumeIfSuspended = () => {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      };

      if (ctx.state === 'suspended') {
        resumeIfSuspended();
        window.addEventListener('pointerdown', resumeIfSuspended, { once: true });
        window.addEventListener('keydown', resumeIfSuspended, { once: true });
      }

      audioRef.current = {
        ctx,
        masterGain,
        stopNodes: () => {
          window.removeEventListener('pointerdown', resumeIfSuspended);
          window.removeEventListener('keydown', resumeIfSuspended);
          try {
            oscPrimary.stop();
            oscSub.stop();
            lfo.stop();
            oscPrimary.disconnect();
            oscSub.disconnect();
            lfo.disconnect();
            lowpass.disconnect();
            masterGain.disconnect();
          } catch {
            // Ignore cleanup errors
          }
        },
      };
    };

    if (screen === 'mission' && !isAudioMuted) startAmbientHum();
    else stopAmbientHum();

    return () => {
      stopAmbientHum();
    };
  }, [screen, isAudioMuted]);

  useEffect(() => {
    if (screen !== 'mission' || !simState || simState.status !== 'active') return;
    if (dayTransition !== null) return;

    const dailyStatus = getDailyCompletionStatus(simState);
    if (!dailyStatus.allCompleted) return;
    if (triggeredDayRef.current === simState.day) return;

    const targetDay = simState.day;
    const maxDays = simState.maxDays;
    const planetName = simState.planetName;

    const settleTimer = window.setTimeout(() => {
      const latest = simStateRef.current;
      if (!latest || latest.status !== 'active' || latest.day !== targetDay) return;
      if (!getDailyCompletionStatus(latest).allCompleted) return;
      if (triggeredDayRef.current === targetDay) return;

      triggeredDayRef.current = targetDay;
      transitionSeqRef.current += 1;
      setDayTransition({
        id: transitionSeqRef.current,
        completedDay: targetDay,
        nextDay: Math.min(targetDay + 1, maxDays),
        maxDays,
        planetName,
        isFinalDay: targetDay >= maxDays,
      });
    }, 900);

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [screen, simState, dayTransition]);

  const handleGoHome = () => {
    setUniverseMode('interactive');
    setScreen('landing');
  };

  const handleResumeMission = () => {
    const loaded = loadSavedMission();
    if (!loaded) return;
    triggeredDayRef.current = null;
    setDayTransition(null);
    setSimState(loaded);
    setScreen('mission');
  };

  const handleLaunchMission = (
    placedBuildings: PlacedBuilding[],
    remainingBudget: number
  ) => {
    const initial = createInitialMissionState(
      missionConfig,
      placedBuildings,
      remainingBudget
    );
    triggeredDayRef.current = null;
    setDayTransition(null);
    setSimState(initial);
    setLaunchStartStage('boarding');
    setScreen('launch');
  };

  const handleLaunchComplete = (flagChoice: FlagLandingChoice) => {
    setSimState((prev) => {
      if (!prev) return prev;
      let next: MissionState = {
        ...prev,
        flagsByWorld: {
          ...prev.flagsByWorld,
          [prev.planetId]: {
            planted: true,
            planetId: prev.planetId,
            x: flagChoice.outpostX,
            z: flagChoice.outpostZ,
            siteLabel: flagChoice.siteLabel,
            plantedBy: 'abubakr',
            day: prev.day,
          },
        },
        activityLog: [
          {
            id: `flag-${prev.planetId}-${Date.now()}`,
            day: prev.day,
            time: '09:15',
            title: `Expedition Flag Planted on ${prev.planetName}`,
            detail: `Permanent banner anchored at ${flagChoice.siteLabel}.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      next = grantAchievement(next, 'first_flag');
      return next;
    });
    setScreen('mission');
  };

  const handleActivateNextDayFromTransition = () => {
    const current = simStateRef.current;
    if (!current || current.status !== 'active') return;

    // Save completed day progress before generating next day state
    saveMissionProgress(current);

    const next = simulateNextDay(current);
    setSimState(next);

    if (next.status !== 'active') {
      clearSavedMission();
      setSavedAvailable(false);
      setScreen('report');
    } else {
      saveMissionProgress(next);
      setSavedAvailable(true);
      if (shouldTriggerStormScreen(current, next)) {
        setScreen('storm');
      } else {
        setScreen('mission');
      }
    }
  };

  const handleDayTransitionComplete = () => {
    setDayTransition(null);
  };

  const handleToggleBuilding = (uid: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        buildings: prev.buildings.map((b) =>
          b.uid === uid ? { ...b, online: !b.online } : b
        ),
      };
    });
  };

  const handleUpgradeBuilding = (uid: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const target = prev.buildings.find((b) => b.uid === uid);
      if (!target || target.level >= 3) return prev;

      const def = getBuildingDef(target.typeId);
      const cost = def?.upgradeCost || 120;
      if (prev.budget < cost) return prev;

      const shieldGain =
        target.typeId === 'radiation_shelter' ? 12 : target.typeId === 'habitat' ? 6 : 0;
      const batteryGain = target.typeId === 'battery' ? 35 : 0;

      return {
        ...prev,
        budget: prev.budget - cost,
        resources: {
          ...prev.resources,
          shielding: Math.min(95, prev.resources.shielding + shieldGain),
          battery: {
            ...prev.resources.battery,
            max: prev.resources.battery.max + batteryGain,
          },
        },
        buildings: prev.buildings.map((b) =>
          b.uid === uid ? { ...b, level: b.level + 1 } : b
        ),
        activityLog: [
          {
            id: `upg-${Date.now()}`,
            day: prev.day,
            time: '11:30',
            title: `Upgraded ${def?.shortName || target.typeId} to Level ${target.level + 1}`,
            detail: `Invested ${cost} CR for enhanced outpost capacity.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleConstructBuilding = (typeId: BuildingTypeId, cellIndex: number) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const def = getBuildingDef(typeId);
      if (!def || prev.budget < def.cost) return prev;
      const count = prev.buildings.filter((b) => b.typeId === typeId).length;
      if (count >= def.maxPerBase) return prev;
      if (prev.buildings.some((b) => b.cellIndex === cellIndex)) return prev;

      const newBld = makePlacedBuilding(`${typeId}-${cellIndex}-${Date.now()}`, typeId, cellIndex);
      return {
        ...prev,
        budget: prev.budget - def.cost,
        buildings: [...prev.buildings, newBld],
        resources: {
          ...prev.resources,
          shielding: Math.min(95, prev.resources.shielding + def.shieldingBonus),
          battery: {
            ...prev.resources.battery,
            max: prev.resources.battery.max + def.batteryBonus,
          },
          medSupplies: prev.resources.medSupplies + (typeId === 'storage_depot' ? 4 : 0),
        },
        activityLog: [
          {
            id: `build-${Date.now()}`,
            day: prev.day,
            time: '12:00',
            title: `Constructed ${def.name}`,
            detail: `Deployed module onto sector S${String(cellIndex + 1).padStart(2, '0')} for ${def.cost} CR.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleResearchTech = (techId: 'water' | 'solar' | 'crop', cost: number) => {
    setSimState((prev) => {
      if (!prev || prev.sciencePoints < cost) return prev;
      const upgrades = { ...prev.techUpgrades };
      if (techId === 'water') upgrades.waterEfficiencyBonus += 0.15;
      if (techId === 'solar') upgrades.solarEfficiencyBonus += 0.15;
      if (techId === 'crop') upgrades.cropYieldBonus += 0.15;

      return {
        ...prev,
        sciencePoints: prev.sciencePoints - cost,
        techUpgrades: upgrades,
        activityLog: [
          {
            id: `sci-${Date.now()}`,
            day: prev.day,
            time: '13:15',
            title: `Research Completed: ${techId.toUpperCase()} +15%`,
            detail: 'Outpost engineering efficiency permanently improved.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleSelectAstronaut = (id: AstronautId) => {
    setSimState((prev) => {
      if (!prev || prev.activeAstronautId === id) return prev;
      return { ...prev, activeAstronautId: id };
    });
  };

  const handlePerformSuitDiagnostic = (partId: SuitPartId, astronautId?: AstronautId) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const targetId = astronautId || prev.activeAstronautId;
      const astro = getAstronautById(targetId);
      const prevProg = prev.crewProgress[astro.id];
      const awardFullBonus = !prevProg.currentTaskDone;

      let title = '';
      let detail = '';
      let sciDelta = awardFullBonus ? 3 : 1;
      let oxyDelta = 0;
      let waterDelta = 0;
      let radDelta = 0;
      let flueClogDelta = 0;

      if (partId === 'helmet') {
        title = `${astro.name}: Visor & Radiation HUD Scan`;
        radDelta = awardFullBonus ? -3 : 0;
        detail = awardFullBonus
          ? `Gold visor optics & dosimeter calibrated on ${prev.planetName} (-3% Radiation, +3 SCI).`
          : `Helmet HUD & glare seal re-verified (+1 SCI).`;
      } else if (partId === 'chest_pack') {
        title = `${astro.name}: Suit Life-Support Biometrics`;
        if (awardFullBonus) {
          oxyDelta = 3;
          waterDelta = 2;
          sciDelta = 2;
        }
        detail = awardFullBonus
          ? `Closed-loop suit telemetry synced (+3% O₂, +2% H₂O, +2 SCI).`
          : `Chest biometrics nominal (+1 SCI).`;
      } else if (partId === 'plss_backpack') {
        title = `${astro.name}: PLSS Scrubber & Uplink`;
        if (awardFullBonus) {
          oxyDelta = 2;
          sciDelta = 4;
        }
        detail = awardFullBonus
          ? `CO₂ scrubber purged & PLSS carrier tested (+2% O₂, +4 SCI).`
          : `PLSS reserve nominal (+1 SCI).`;
      } else if (partId === 'arms_tools') {
        title = `${astro.name}: EVA Gauntlet & Tool Calibration`;
        detail = awardFullBonus
          ? `EVA gloves & ${astro.taskTitle} actuators calibrated (+3 SCI).`
          : `Grip torque test completed (+1 SCI).`;
      } else {
        title = `${astro.name}: Traction Boot & Dust Seal Test`;
        if (awardFullBonus) {
          flueClogDelta = -10;
          sciDelta = 2;
        }
        detail = awardFullBonus
          ? `Electrostatic dust cleared from boots & intakes (-10% Flue Clog, +2 SCI).`
          : `Magnetic boot seals verified (+1 SCI).`;
      }

      const nextFlueClog = Math.max(0, prev.stormFlue.cloggedPct + flueClogDelta);
      return {
        ...prev,
        activeAstronautId: targetId,
        sciencePoints: prev.sciencePoints + sciDelta,
        stormFlue: {
          ...prev.stormFlue,
          cloggedPct: nextFlueClog,
          status: nextFlueClog >= 70 ? 'critical' : nextFlueClog >= 40 ? 'warning' : 'nominal',
        },
        crew: {
          ...prev.crew,
          radiationExposure: Math.max(0, prev.crew.radiationExposure + radDelta),
        },
        resources: {
          ...prev.resources,
          oxygen: { ...prev.resources.oxygen, current: Math.min(100, prev.resources.oxygen.current + oxyDelta) },
          water: { ...prev.resources.water, current: Math.min(100, prev.resources.water.current + waterDelta) },
        },
        crewProgress: {
          ...prev.crewProgress,
          [astro.id]: {
            ...prevProg,
            tasksCompleted: awardFullBonus ? prevProg.tasksCompleted + 1 : prevProg.tasksCompleted,
            currentTaskDone: true,
            lastAction: title,
          },
        },
        activityLog: [
          { id: `suit-${partId}-${Date.now()}`, day: prev.day, time: '12:20', title, detail, severity: 'info' },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleInspectStormFlue = () => {
    setSimState((prev) => {
      if (!prev) return prev;
      const astro = getAstronautById(prev.activeAstronautId);
      const isLead = astro.id === 'abubakr';
      const batteryGain = isLead ? 6 : 0;
      const sciGain = isLead ? 6 : 3;
      const prevProg = prev.crewProgress[astro.id];

      return {
        ...prev,
        sciencePoints: prev.sciencePoints + sciGain,
        resources: {
          ...prev.resources,
          battery: {
            ...prev.resources.battery,
            current: Math.min(prev.resources.battery.max, prev.resources.battery.current + batteryGain),
          },
        },
        stormFlue: {
          ...prev.stormFlue,
          cloggedPct: 0,
          inspectedToday: true,
          status: 'nominal',
        },
        crewProgress: {
          ...prev.crewProgress,
          [astro.id]: {
            ...prevProg,
            tasksCompleted: prevProg.tasksCompleted + 1,
            stormFluesCleared: prevProg.stormFluesCleared + 1,
            currentTaskDone: true,
            lastAction: `Cleared Storm Flue on ${prev.planetName} (Day ${prev.day})`,
          },
        },
        activityLog: [
          {
            id: `flue-${Date.now()}`,
            day: prev.day,
            time: '10:45',
            title: `${astro.name} Cleared Storm Flue (0% Clog)`,
            detail: isLead
              ? `Commander Abubakr restored airflow (+6 kWh Battery, +6 SCI).`
              : `Exhaust vents & pressure verified (+3 SCI).`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleCollectDataNode = (nodeId: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const node = prev.dataNodes.find((n) => n.id === nodeId);
      if (!node || node.collected) return prev;

      const astro = getAstronautById(prev.activeAstronautId);
      const hasLab = prev.buildings.some((b) => b.typeId === 'research_lab' && b.online && !b.damaged);
      const sciGain = hasLab ? node.scienceValue * 2 : node.scienceValue;
      const waterGain = astro.id === 'affan' ? 8 : 0;
      const oxyGain = astro.id === 'affan' ? 5 : 0;
      const prevProg = prev.crewProgress[astro.id];

      let next: MissionState = {
        ...prev,
        sciencePoints: prev.sciencePoints + sciGain,
        resources: {
          ...prev.resources,
          water: { ...prev.resources.water, current: Math.min(100, prev.resources.water.current + waterGain) },
          oxygen: { ...prev.resources.oxygen, current: Math.min(100, prev.resources.oxygen.current + oxyGain) },
        },
        dataNodes: prev.dataNodes.map((n) => (n.id === nodeId ? { ...n, collected: true } : n)),
        lunarState:
          nodeId === 'moon-psr-ice'
            ? { ...prev.lunarState, psrIceDiscovered: true }
            : prev.lunarState,
        roboticState:
          nodeId === 'titan-methane'
            ? { ...prev.roboticState, titanMethaneSampled: true }
            : nodeId === 'europa-plume'
            ? { ...prev.roboticState, europaSampleSterilized: true, europaProbeDepthM: 12 }
            : prev.roboticState,
        crewProgress: {
          ...prev.crewProgress,
          [astro.id]: {
            ...prevProg,
            tasksCompleted: prevProg.tasksCompleted + 1,
            dataCollected: prevProg.dataCollected + 1,
            currentTaskDone: true,
            lastAction: `Logged ${node.label} on ${prev.planetName} (+${sciGain} SCI)`,
          },
        },
        activityLog: [
          {
            id: `data-${Date.now()}`,
            day: prev.day,
            time: '14:20',
            title: `${astro.name} Collected ${node.label}`,
            detail: `${node.reading} · (+${sciGain} SCI${hasLab ? ' Lab x2' : ''}).`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      if (nodeId === 'moon-psr-ice') next = grantAchievement(next, 'psr_explorer');
      if (nodeId === 'titan-methane') next = grantAchievement(next, 'titan_aviator');
      if (nodeId === 'europa-plume') next = grantAchievement(next, 'europa_sterilizer');
      return next;
    });
  };

  const handleServiceBuilding = (uid: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const b = prev.buildings.find((item) => item.uid === uid);
      if (!b || b.damaged) return prev;
      const astro = getAstronautById(prev.activeAstronautId);
      const prevProg = prev.crewProgress[astro.id];
      if (prevProg.currentTaskDone) return prev;

      const def = getBuildingDef(b.typeId);
      let oxyDelta = 0, waterDelta = 0, foodDelta = 0, batDelta = 0, sciDelta = 4, radDelta = 0;
      let flueClog = prev.stormFlue.cloggedPct;

      if (astro.id === 'abubakr') { flueClog = Math.max(0, flueClog - 25); sciDelta = 6; }
      else if (astro.id === 'affan') { waterDelta = 8; oxyDelta = 5; }
      else if (astro.id === 'ali') { batDelta = 14; }
      else if (astro.id === 'jawwad') { foodDelta = 7; waterDelta = 5; }
      else if (astro.id === 'om') { radDelta = -6; sciDelta = 8; }
      else if (astro.id === 'ammar') { batDelta = 6; flueClog = Math.max(0, flueClog - 20); sciDelta = 6; }

      return {
        ...prev,
        sciencePoints: prev.sciencePoints + sciDelta,
        stormFlue: {
          ...prev.stormFlue,
          cloggedPct: flueClog,
          status: flueClog >= 70 ? 'critical' : flueClog >= 40 ? 'warning' : 'nominal',
        },
        crew: { ...prev.crew, radiationExposure: Math.max(0, prev.crew.radiationExposure + radDelta) },
        resources: {
          ...prev.resources,
          oxygen: { ...prev.resources.oxygen, current: Math.min(100, prev.resources.oxygen.current + oxyDelta) },
          water: { ...prev.resources.water, current: Math.min(100, prev.resources.water.current + waterDelta) },
          food: { ...prev.resources.food, current: Math.min(100, prev.resources.food.current + foodDelta) },
          battery: { ...prev.resources.battery, current: Math.min(prev.resources.battery.max, prev.resources.battery.current + batDelta) },
        },
        crewProgress: {
          ...prev.crewProgress,
          [astro.id]: {
            ...prevProg,
            tasksCompleted: prevProg.tasksCompleted + 1,
            currentTaskDone: true,
            lastAction: `Serviced ${def?.shortName || b.typeId} (${astro.taskTitle})`,
          },
        },
        activityLog: [
          {
            id: `srv-${Date.now()}`,
            day: prev.day,
            time: '15:10',
            title: `${astro.name} Serviced ${def?.shortName || b.typeId}`,
            detail: `${astro.specialtyBonus}.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  // FUEL OPERATIONS (Isolated — only run when player clicks explicit actions inside Fuel modal)
  const handleSynthesizeFuel = () => {
    setSimState((prev) => {
      if (!prev || prev.resources.water.current < 8) return prev;
      return {
        ...prev,
        resources: {
          ...prev.resources,
          water: { ...prev.resources.water, current: Number((prev.resources.water.current - 6).toFixed(1)) },
        },
        fuel: {
          ...prev.fuel,
          current: Math.min(prev.fuel.max, prev.fuel.current + 18),
          lastActionNote: `Synthesized +18 t Methalox via Sabatier electrolysis on Day ${prev.day}.`,
        },
        activityLog: [
          {
            id: `fuel-syn-${Date.now()}`,
            day: prev.day,
            time: '11:10',
            title: 'ISRU Propellant Synthesized (+18 t)',
            detail: 'Converted local water & CO₂ feedstock into cryogenic rocket fuel.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleRefuelStarship = () => {
    setSimState((prev) => {
      if (!prev || prev.fuel.current < 15 || prev.fuel.shipTankPct >= 100) return prev;
      let next: MissionState = {
        ...prev,
        fuel: {
          ...prev.fuel,
          current: Math.max(0, prev.fuel.current - 15),
          shipTankPct: Math.min(100, prev.fuel.shipTankPct + 25),
          lastActionNote: `Pumped +25% Methalox into NASA Starship main tanks on Day ${prev.day}.`,
        },
        activityLog: [
          {
            id: `fuel-ship-${Date.now()}`,
            day: prev.day,
            time: '11:40',
            title: 'NASA Starship Refueled (+25% Tank)',
            detail: 'Cryogenic umbilical verified; orbital transit reserves increased.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      next = grantAchievement(next, 'fuel_chemist');
      return next;
    });
  };

  // MEDICAL OPERATIONS
  const handleDiagnoseCrew = (id: AstronautId) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const v = prev.crewVitals[id];
      if (!v || !v.medicalAlert) return prev;
      const astro = getAstronautById(id);
      const meta = MEDICAL_CONDITIONS[v.medicalAlert];
      return {
        ...prev,
        crewVitals: {
          ...prev.crewVitals,
          [id]: { ...v, diagnosed: true },
        },
        activityLog: [
          {
            id: `med-diag-${Date.now()}`,
            day: prev.day,
            time: '09:40',
            title: `Medical Scan: ${astro.name} — ${meta.title}`,
            detail: `Symptoms confirmed. Ready for targeted treatment.`,
            severity: 'warning',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleTreatCrew = (id: AstronautId) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const v = prev.crewVitals[id];
      if (!v || !v.medicalAlert) return prev;
      const meta = MEDICAL_CONDITIONS[v.medicalAlert];
      if (prev.resources.medSupplies < meta.medCost || prev.resources.water.current < meta.waterCost) {
        return prev;
      }
      const astro = getAstronautById(id);
      let next: MissionState = {
        ...prev,
        resources: {
          ...prev.resources,
          medSupplies: prev.resources.medSupplies - meta.medCost,
          water: {
            ...prev.resources.water,
            current: Number((prev.resources.water.current - meta.waterCost).toFixed(1)),
          },
        },
        crew: {
          ...prev.crew,
          safe: Math.min(prev.crew.total, prev.crew.safe + 1),
          radiationExposure:
            v.medicalAlert === 'illness'
              ? Math.max(0, prev.crew.radiationExposure - 6)
              : prev.crew.radiationExposure,
        },
        crewVitals: {
          ...prev.crewVitals,
          [id]: {
            ...v,
            healthPct: Math.min(100, v.healthPct + 28),
            fatiguePct: v.medicalAlert === 'exhaustion' ? 20 : v.fatiguePct,
            hydrationPct: v.medicalAlert === 'dehydration' ? 94 : v.hydrationPct,
            medicalAlert: null,
            diagnosed: false,
          },
        },
        activityLog: [
          {
            id: `med-treat-${Date.now()}`,
            day: prev.day,
            time: '10:15',
            title: `Treated ${astro.name} (${meta.title})`,
            detail: meta.effectText,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      next = grantAchievement(next, 'medical_savior');
      return next;
    });
  };

  // COMMS REPAIR WORKFLOW
  const handleCommsStep = (step: 'inspect' | 'diagnose' | 'replace' | 'test') => {
    setSimState((prev) => {
      if (!prev) return prev;
      if (!prev.comms.fault && step === 'test') {
        return {
          ...prev,
          sciencePoints: prev.sciencePoints + 4,
          comms: { ...prev.comms, signalStrengthPct: Math.min(100, prev.comms.signalStrengthPct + 8) },
        };
      }
      const faultId = prev.comms.fault;
      if (!faultId) return prev;
      const meta = COMMS_FAULTS[faultId];

      if (step === 'inspect') {
        return { ...prev, comms: { ...prev.comms, repairStep: 'inspected' } };
      }
      if (step === 'diagnose') {
        return { ...prev, comms: { ...prev.comms, repairStep: 'diagnosed' } };
      }
      if (step === 'replace') {
        const curQty = prev.spareParts[meta.requiredPart] || 0;
        if (curQty < meta.requiredQty) return prev;
        return {
          ...prev,
          spareParts: {
            ...prev.spareParts,
            [meta.requiredPart]: curQty - meta.requiredQty,
          },
          comms: { ...prev.comms, repairStep: 'parts_replaced' },
        };
      }
      // Step 4: test & restore
      let next: MissionState = {
        ...prev,
        sciencePoints: prev.sciencePoints + 6,
        comms: {
          ...prev.comms,
          fault: null,
          repairStep: 'none',
          signalStrengthPct: 96,
        },
        activityLog: [
          {
            id: `comms-fix-${Date.now()}`,
            day: prev.day,
            time: '15:30',
            title: `Comms Link Restored (${meta.title})`,
            detail: 'Replaced faulty antenna hardware & locked Earth carrier signal at 96%.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      next = grantAchievement(next, 'comms_restorer');
      return next;
    });
  };

  // SPARE PARTS, CRAFTING, RECYCLING, RESUPPLY
  const handleCraftPart = (partId: SparePartId) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const def = getSparePartDef(partId);
      const nextMats = { ...prev.materials };
      for (const [m, need] of Object.entries(def.craftMaterials)) {
        const key = m as ConstructionMaterialId;
        if ((nextMats[key] || 0) < (need || 0)) return prev;
        nextMats[key] = (nextMats[key] || 0) - (need || 0);
      }
      let next: MissionState = {
        ...prev,
        materials: nextMats,
        spareParts: {
          ...prev.spareParts,
          [partId]: (prev.spareParts[partId] || 0) + 2,
        },
        activityLog: [
          {
            id: `craft-${Date.now()}`,
            day: prev.day,
            time: '13:45',
            title: `Manufactured 2× ${def.shortName}`,
            detail: `Workshop fabricated spare parts from raw outpost materials.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      next = grantAchievement(next, 'fabricator');
      return next;
    });
  };

  const handleRecycleScrap = (material: ConstructionMaterialId) => {
    setSimState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        materials: {
          ...prev.materials,
          [material]: (prev.materials[material] || 0) + 2,
        },
        activityLog: [
          {
            id: `rec-${Date.now()}`,
            day: prev.day,
            time: '14:05',
            title: `Recycled EVA Scrap (+2 ${material.replace('_', ' ')})`,
            detail: 'Salvaged usable structural material from weathered casing.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleOrderResupply = (bundle: 'spare_bundle' | 'med_bundle' | 'antenna_kit') => {
    setSimState((prev) => {
      if (!prev) return prev;
      const p = getPlanetById(prev.planetId);
      const arrivalDay = prev.day + p.resupplyDays;
      const cfg =
        bundle === 'spare_bundle'
          ? {
              cost: 90,
              summary: 'Engineering Kit (+3 Cables/Seals/Filters/Mech)',
              parts: { cables: 3, seals: 3, filters: 3, mechanical_parts: 3 } as Partial<Record<SparePartId, number>>,
              meds: 0,
            }
          : bundle === 'med_bundle'
          ? {
              cost: 85,
              summary: 'Medical & Battery Pod (+5 Medkits, +3 Batteries)',
              parts: { batteries: 3 } as Partial<Record<SparePartId, number>>,
              meds: 5,
            }
          : {
              cost: 95,
              summary: 'Avionics & Antenna Kit (+2 Antenna/Boards/Tools)',
              parts: { antenna_components: 2, circuit_boards: 2, repair_tools: 2 } as Partial<Record<SparePartId, number>>,
              meds: 0,
            };

      if (prev.budget < cfg.cost) return prev;
      return {
        ...prev,
        budget: prev.budget - cfg.cost,
        pendingResupply: [
          ...prev.pendingResupply,
          {
            id: `ord-${Date.now()}`,
            arrivalDay,
            itemsSummary: cfg.summary,
            parts: cfg.parts,
            medSupplies: cfg.meds,
          },
        ],
        activityLog: [
          {
            id: `ord-log-${Date.now()}`,
            day: prev.day,
            time: '14:50',
            title: `Earth Resupply Ordered (Arrives Day ${arrivalDay})`,
            detail: `${cfg.summary} launched via cargo lander (-${cfg.cost} CR).`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  // DAMAGE & RECONSTRUCTION OPERATIONS
  const handleInspectBuildingDamage = (uid: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        buildings: prev.buildings.map((b) =>
          b.uid === uid ? { ...b, inspectedDamage: true } : b
        ),
      };
    });
  };

  const handleRepairBuilding = (uid: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const b = prev.buildings.find((item) => item.uid === uid);
      if (!b) return prev;
      const nextParts = { ...prev.spareParts };
      for (const [pid, qty] of Object.entries(b.requiredParts)) {
        const key = pid as SparePartId;
        if ((nextParts[key] || 0) < (qty || 0)) return prev;
        nextParts[key] = (nextParts[key] || 0) - (qty || 0);
      }
      const def = getBuildingDef(b.typeId);
      let next: MissionState = {
        ...prev,
        spareParts: nextParts,
        toolsConditionPct: Math.max(40, prev.toolsConditionPct - 4),
        buildings: prev.buildings.map((item) =>
          item.uid === uid
            ? {
                ...item,
                damaged: false,
                conditionPct: 100,
                damageCause: null,
                inspectedDamage: false,
                requiredParts: {},
              }
            : item
        ),
        activityLog: [
          {
            id: `rep-${Date.now()}`,
            day: prev.day,
            time: '16:10',
            title: `Reconstructed ${def?.shortName || b.typeId} (100% Integrity)`,
            detail: 'Installed replacement parts & recalibrated module systems.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      next = grantAchievement(next, 'master_mechanic');
      return next;
    });
  };

  const handleCleanDust = (uid?: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lunarState: { ...prev.lunarState, lunarDustPct: 0 },
        rover: { ...prev.rover, dustPct: 0 },
        buildings: prev.buildings.map((b) =>
          !uid || b.uid === uid ? { ...b, dustPct: 0 } : b
        ),
        activityLog: [
          {
            id: `dust-${Date.now()}`,
            day: prev.day,
            time: '16:30',
            title: 'Outpost Solar & Regolith Dust Cleaned',
            detail: 'Brushed electrostatic dust off photovoltaic arrays, visors & seals.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleRepairRover = () => {
    setSimState((prev) => {
      if (!prev || (prev.spareParts.mechanical_parts || 0) < 1) return prev;
      return {
        ...prev,
        spareParts: {
          ...prev.spareParts,
          mechanical_parts: prev.spareParts.mechanical_parts - 1,
        },
        rover: { ...prev.rover, damaged: false, conditionPct: 100, dustPct: 0 },
        activityLog: [
          {
            id: `rov-rep-${Date.now()}`,
            day: prev.day,
            time: '16:45',
            title: 'Autonomous Rover Repaired (100%)',
            detail: 'Replaced suspension actuator & restored navigation autonomy.',
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleRechargeRover = () => {
    setSimState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rover: { ...prev.rover, chargePct: 100 },
      };
    });
  };

  const handleToggleRoverDrive = () => {
    setSimState((prev) => {
      if (!prev || prev.rover.damaged) return prev;
      return {
        ...prev,
        rover: { ...prev.rover, manualControl: !prev.rover.manualControl },
      };
    });
  };

  const handleToggleShelterRefuge = () => {
    setSimState((prev) => {
      if (!prev) return prev;
      const nextActive = !prev.shelterRefugeActive;
      return {
        ...prev,
        shelterRefugeActive: nextActive,
        hazardWarningText: nextActive
          ? 'Manual Shelter Drill: Crew moving indoors through airlock doors.'
          : null,
      };
    });
  };

  const handleTravelToWorld = (planetId: PlanetId) => {
    setSimState((prev) => {
      if (!prev || prev.planetId === planetId) return prev;
      const planet = getPlanetById(planetId);
      const alreadyVisited = prev.visitedWorlds.includes(planetId);
      const transitCost = alreadyVisited ? 0 : prev.fuel.transitCost;
      if (prev.fuel.shipTankPct < transitCost) return prev;

      const nextVisited = alreadyVisited ? prev.visitedWorlds : [...prev.visitedWorlds, planetId];

      let next: MissionState = {
        ...prev,
        planetId: planet.id,
        planetName: planet.name,
        operationName: planet.operationName,
        visitedWorlds: nextVisited,
        dataNodes: getWorldDataNodes(planet.id),
        shelterRefugeActive: false,
        fuel: {
          ...prev.fuel,
          shipTankPct: Math.max(0, prev.fuel.shipTankPct - transitCost),
          lastActionNote: `Transit to ${planet.name} consumed ${transitCost}% tank.`,
        },
        comms: {
          ...prev.comms,
          rangeKm:
            planet.id === 'moon'
              ? 384400
              : planet.id === 'mars'
              ? 225000000
              : planet.id === 'europa'
              ? 628000000
              : 1275000000,
          latencySec:
            planet.id === 'moon' ? 1.3 : planet.id === 'mars' ? 185 : planet.id === 'europa' ? 2100 : 4250,
        },
        stormFlue: {
          ...prev.stormFlue,
          pressureKpa: planet.atmosphereKpa,
          exhaustTempC: planet.id === 'titan' || planet.id === 'europa' ? -42 : 24,
          inspectedToday: false,
        },
        activityLog: [
          {
            id: `nav-${Date.now()}`,
            day: prev.day,
            time: '16:00',
            title: `NASA Transit: Landed on ${planet.name} (g=${planet.gravityMs2} m/s²)`,
            detail: `${planet.operationName} active at ${planet.location}.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
      if (nextVisited.length >= 4) next = grantAchievement(next, 'multi_world');
      return next;
    });
    setLaunchStartStage('transit');
    setScreen('launch');
  };

  const handleSelectDecision = (choice: EventChoice) => {
    setSimState((prev) => {
      if (!prev) return prev;
      return applyEngineeringDecision(prev, choice);
    });
    setScreen('mission');
  };

  const handlePlayAgain = () => {
    clearSavedMission();
    setSavedAvailable(false);
    triggeredDayRef.current = null;
    setDayTransition(null);
    setDraftBuildings([]);
    setSimState(null);
    setScreen('planet');
  };

  const handleCompareOtherPlanet = (otherPlanetId: PlanetId) => {
    setMissionConfig((prev) => ({ ...prev, planetId: otherPlanetId }));
    setDraftBuildings([]);
    setSimState(null);
    setScreen('builder');
  };

  const handleAddEquipmentToInventory = (id: EquipmentId) => {
    const item = getEquipmentById(id);
    setSimState((prev) => {
      if (!prev) return prev;
      const alreadyOwned = prev.equipmentInventory.includes(id);
      const nextInventory = alreadyOwned
        ? prev.equipmentInventory
        : [...prev.equipmentInventory, id];

      const nextResources = {
        ...prev.resources,
        oxygen: { ...prev.resources.oxygen },
        water: { ...prev.resources.water },
        battery: { ...prev.resources.battery },
      };
      const nextTech = { ...prev.techUpgrades };
      const nextSpareParts = { ...prev.spareParts };
      const nextFuel = { ...prev.fuel };
      const nextRover = { ...prev.rover };
      const nextComms = { ...prev.comms };
      let nextScience = prev.sciencePoints;

      if (id === 'solar_array') {
        nextResources.battery.current = Math.min(
          nextResources.battery.max,
          nextResources.battery.current + (alreadyOwned ? 4 : 12)
        );
        if (!alreadyOwned) nextTech.solarEfficiencyBonus += 0.04;
      } else if (id === 'solar_water_cycle') {
        nextResources.water.current = Math.min(
          100,
          nextResources.water.current + (alreadyOwned ? 4 : 10)
        );
        if (!alreadyOwned) nextTech.waterEfficiencyBonus += 0.05;
      } else if (id === 'water_collector') {
        nextResources.water.current = Math.min(
          100,
          nextResources.water.current + (alreadyOwned ? 4 : 12)
        );
        nextFuel.current = Math.min(nextFuel.max, nextFuel.current + (alreadyOwned ? 3 : 10));
      } else if (id === 'oxygen_generator') {
        nextResources.oxygen.current = Math.min(
          100,
          nextResources.oxygen.current + (alreadyOwned ? 4 : 12)
        );
        if (!alreadyOwned) nextSpareParts.filters += 1;
      } else if (id === 'exploration_rover') {
        nextRover.chargePct = 100;
        if (!alreadyOwned) nextSpareParts.mechanical_parts += 1;
      } else if (id === 'comms_array') {
        nextComms.signalStrengthPct = Math.min(
          100,
          nextComms.signalStrengthPct + (alreadyOwned ? 6 : 18)
        );
        if (!alreadyOwned) nextSpareParts.antenna_components += 1;
      } else if (id === 'science_spectrometer') {
        nextScience += alreadyOwned ? 5 : 18;
        if (!alreadyOwned) nextSpareParts.circuit_boards += 1;
      }

      return {
        ...prev,
        sciencePoints: nextScience,
        equipmentInventory: nextInventory,
        resources: nextResources,
        techUpgrades: nextTech,
        spareParts: nextSpareParts,
        fuel: nextFuel,
        rover: nextRover,
        comms: nextComms,
        activityLog: [
          {
            id: `eq-${id}-${Date.now()}`,
            day: prev.day,
            time: '13:35',
            title: alreadyOwned
              ? `Calibrated ${item.name}`
              : `Deployed ${item.name} to Field Inventory`,
            detail: item.inventoryEffectDesc,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleUpdateAstronautCustomization = (
    id: AstronautId,
    custom: AstronautCustomization
  ) => {
    setSimState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        crewCustomizations: {
          ...prev.crewCustomizations,
          [id]: custom,
        },
      };
    });
  };

  const handleTogglePreselectedEquipment = (id: EquipmentId) => {
    setMissionConfig((prev) => {
      const current = prev.preselectedEquipment || ['solar_array', 'solar_water_cycle'];
      if (current.includes(id)) return prev;
      return {
        ...prev,
        preselectedEquipment: [...current, id],
      };
    });
  };

  const handleUpdatePreMissionCustomization = (
    id: AstronautId,
    custom: AstronautCustomization
  ) => {
    setMissionConfig((prev) => ({
      ...prev,
      crewCustomizations: {
        ...createDefaultCrewCustomizations(prev.crewCustomizations),
        [id]: custom,
      },
    }));
  };

  const renderScreen = () => {
    if (screen === 'story') {
      return (
        <CinematicStoryScene
          initialPlanetId={missionConfig.planetId}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => setIsAudioMuted((m) => !m)}
          onContinueToSetup={(chosenPlanet) => {
            setMissionConfig((prev) => ({ ...prev, planetId: chosenPlanet }));
            setDraftBuildings([]);
            setScreen('builder');
          }}
          onOpenEquipment={() => setPreMissionModal('equipment')}
          onOpenAstronauts={() => setPreMissionModal('astronauts')}
        />
      );
    }

    if (screen === 'setup') {
      return (
        <PlayerSetup
          initialConfig={missionConfig}
          onBack={() => setScreen('landing')}
          onGoHome={handleGoHome}
          onContinue={(playerData) => {
            setMissionConfig((prev) => ({ ...prev, ...playerData }));
            setScreen('planet');
          }}
        />
      );
    }

    if (screen === 'planet') {
      return (
        <PlanetSelection
          config={missionConfig}
          onUpdateConfig={(partial) =>
            setMissionConfig((prev) => ({ ...prev, ...partial }))
          }
          onBack={handleGoHome}
          onGoHome={handleGoHome}
          onSelectPlanet={(planetId) => {
            setMissionConfig((prev) => ({ ...prev, planetId }));
            setDraftBuildings([]);
            setScreen('builder');
          }}
        />
      );
    }

    if (screen === 'builder') {
      return (
        <BaseBuilder
          config={missionConfig}
          initialBuildings={draftBuildings}
          onBack={() => setScreen('planet')}
          onGoHome={handleGoHome}
          onContinueToBriefing={(placedBuildings, remainingBudget) => {
            setDraftBuildings(placedBuildings);
            setDraftRemainingBudget(remainingBudget);
            setScreen('briefing');
          }}
        />
      );
    }

    if (screen === 'briefing') {
      return (
        <Briefing
          config={missionConfig}
          plannedBuildings={draftBuildings}
          remainingBudget={draftRemainingBudget}
          onBack={() => setScreen('builder')}
          onGoHome={handleGoHome}
          onLaunchMission={() => handleLaunchMission(draftBuildings, draftRemainingBudget)}
        />
      );
    }

    if (screen === 'launch' && simState) {
      return (
        <MissionLaunchScene
          planetId={simState.planetId}
          playerName={simState.playerName}
          startStage={launchStartStage}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => setIsAudioMuted((m) => !m)}
          onComplete={handleLaunchComplete}
        />
      );
    }

    if (screen === 'storm' && simState) {
      return (
        <StormArrivalScene
          state={simState}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => setIsAudioMuted((m) => !m)}
          onComplete={() => setScreen('mission')}
          onResolveEmergency={() => setScreen('emergency')}
        />
      );
    }

    if (screen === 'mission' && simState) {
      return (
        <MissionControl
          state={simState}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => setIsAudioMuted((m) => !m)}
          onToggleBuilding={handleToggleBuilding}
          onUpgradeBuilding={handleUpgradeBuilding}
          onConstructBuilding={handleConstructBuilding}
          onResearchTech={handleResearchTech}
          onSelectAstronaut={handleSelectAstronaut}
          onInspectStormFlue={handleInspectStormFlue}
          onCollectDataNode={handleCollectDataNode}
          onServiceBuilding={handleServiceBuilding}
          onPerformSuitDiagnostic={handlePerformSuitDiagnostic}
          onTravelToWorld={handleTravelToWorld}
          onSynthesizeFuel={handleSynthesizeFuel}
          onRefuelStarship={handleRefuelStarship}
          onDiagnoseCrew={handleDiagnoseCrew}
          onTreatCrew={handleTreatCrew}
          onCommsStep={handleCommsStep}
          onCraftPart={handleCraftPart}
          onRecycleScrap={handleRecycleScrap}
          onOrderResupply={handleOrderResupply}
          onInspectBuildingDamage={handleInspectBuildingDamage}
          onRepairBuilding={handleRepairBuilding}
          onCleanDust={handleCleanDust}
          onRepairRover={handleRepairRover}
          onRechargeRover={handleRechargeRover}
          onToggleRoverDrive={handleToggleRoverDrive}
          onToggleShelterRefuge={handleToggleShelterRefuge}
          onTriggerStormScene={() => setScreen('storm')}
          onAddEquipmentToInventory={handleAddEquipmentToInventory}
          onUpdateAstronautCustomization={handleUpdateAstronautCustomization}
          onOpenEmergency={() => setScreen('emergency')}
          onExitMission={handleGoHome}
        />
      );
    }

    if (screen === 'emergency' && simState) {
      return (
        <EmergencyCenter
          state={simState}
          onSelectDecision={handleSelectDecision}
          onBackToDashboard={() => setScreen('mission')}
        />
      );
    }

    if (screen === 'report' && simState) {
      return (
        <MissionReport
          state={simState}
          onPlayAgain={handlePlayAgain}
          onCompareOtherPlanet={handleCompareOtherPlanet}
        />
      );
    }

    return (
      <UniverseExperience
        initialMode={universeMode}
        isAudioMuted={isAudioMuted}
        hasSavedMission={savedAvailable}
        onToggleAudio={() => setIsAudioMuted((m) => !m)}
        onLaunchMissionSetup={(planetId) => {
          setUniverseMode('interactive');
          setDraftBuildings([]);
          if (planetId) {
            setMissionConfig((prev) => ({ ...prev, planetId }));
            setScreen('builder');
          } else {
            setScreen('planet');
          }
        }}
        onResumeMission={handleResumeMission}
        onOpenEquipment={() => setPreMissionModal('equipment')}
        onOpenAstronauts={() => setPreMissionModal('astronauts')}
      />
    );
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {preMissionModal === 'equipment' && (
        <EquipmentShowcaseModal
          inventory={missionConfig.preselectedEquipment || ['solar_array', 'solar_water_cycle']}
          onAddEquipment={handleTogglePreselectedEquipment}
          onClose={() => setPreMissionModal(null)}
          isMuted={isAudioMuted}
          actionButtonLabel="Stage Equipment for Launch"
        />
      )}

      {preMissionModal === 'astronauts' && (
        <AstronautGalleryModal
          activeAstronautId={missionConfig.selectedCommanderId || 'abubakr'}
          customizations={createDefaultCrewCustomizations(missionConfig.crewCustomizations)}
          onUpdateCustomization={handleUpdatePreMissionCustomization}
          onSelectAstronaut={(id) =>
            setMissionConfig((prev) => ({ ...prev, selectedCommanderId: id }))
          }
          onClose={() => setPreMissionModal(null)}
          isMuted={isAudioMuted}
        />
      )}

      <DayTransitionOverlay
        transition={dayTransition}
        isMuted={isAudioMuted}
        onActivateNextDay={handleActivateNextDayFromTransition}
        onComplete={handleDayTransitionComplete}
      />
    </>
  );
}
