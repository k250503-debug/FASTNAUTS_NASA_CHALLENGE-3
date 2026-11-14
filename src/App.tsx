import React, { useEffect, useRef, useState } from 'react';
import Landing from './pages/Landing';
import PlayerSetup from './pages/PlayerSetup';
import PlanetSelection from './pages/PlanetSelection';
import Briefing from './pages/Briefing';
import BaseBuilder from './pages/BaseBuilder';
import MissionControl from './pages/MissionControl';
import EmergencyCenter from './pages/EmergencyCenter';
import MissionReport from './pages/MissionReport';
import { createInitialMissionState, getWorldDataNodes } from './simulation/resources';
import { simulateNextDay } from './simulation/calculations';
import { applyEngineeringDecision } from './simulation/decisions';
import { getAstronautById } from './data/astronauts';
import { getBuildingDef } from './data/buildings';
import { getPlanetById } from './data/planets';
import MissionLaunchScene from './three/MissionLaunchScene';
import StormArrivalScene from './three/StormArrivalScene';
import type {
  AstronautId,
  EventChoice,
  MissionConfig,
  MissionState,
  PlacedBuilding,
  PlanetId,
  ScreenId,
  SuitPartId,
} from './types';

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('landing');
  const [missionConfig, setMissionConfig] = useState<MissionConfig>({
    playerName: '',
    difficulty: 'engineer',
    missionDays: 30,
    planetId: 'moon',
  });
  const [simState, setSimState] = useState<MissionState | null>(null);
  const [launchStartStage, setLaunchStartStage] = useState<'boarding' | 'transit'>('boarding');
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const audioRef = useRef<{
    ctx: AudioContext;
    masterGain: GainNode;
    stopNodes: () => void;
  } | null>(null);

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
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
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

      // Primary deep cabin hull hum (55 Hz A1)
      const oscPrimary = ctx.createOscillator();
      oscPrimary.type = 'sine';
      oscPrimary.frequency.setValueAtTime(55, ctx.currentTime);
      const primaryGain = ctx.createGain();
      primaryGain.gain.setValueAtTime(0.7, ctx.currentTime);

      // Subtle harmonic fifth undertone (82.41 Hz E2)
      const oscSub = ctx.createOscillator();
      oscSub.type = 'triangle';
      oscSub.frequency.setValueAtTime(82.41, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.22, ctx.currentTime);

      // Slow LFO modulating filter cutoff for gentle life-support air circulation feel
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
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
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
            // Ignore cleanup errors if already stopped
          }
        },
      };
    };

    if (screen === 'mission' && !isAudioMuted) {
      startAmbientHum();
    } else {
      stopAmbientHum();
    }

    return () => {
      stopAmbientHum();
    };
  }, [screen, isAudioMuted]);

  const handleGoHome = () => setScreen('landing');

  const handleLaunchMission = (
    placedBuildings: PlacedBuilding[],
    remainingBudget: number
  ) => {
    const initial = createInitialMissionState(
      missionConfig,
      placedBuildings,
      remainingBudget
    );
    setSimState(initial);
    setLaunchStartStage('boarding');
    setScreen('launch');
  };

  const handleAdvanceDay = () => {
    setSimState((prev) => {
      if (!prev) return prev;
      const next = simulateNextDay(prev);
      if (next.status !== 'active') {
        setScreen('report');
      } else {
        const evtId = next.activeEvent?.id;
        const isIncomingStormEvent =
          next.activeEvent &&
          next.activeEvent.id !== prev.activeEvent?.id &&
          (evtId === 'dust_storm' ||
            evtId === 'storm_flue_clog' ||
            evtId === 'cryo_plume' ||
            evtId === 'radiation_surge');
        const flueCrossedStorm =
          prev.stormFlue.cloggedPct < 65 && next.stormFlue.cloggedPct >= 65;

        if (isIncomingStormEvent || flueCrossedStorm) {
          setScreen('storm');
        }
      }
      return next;
    });
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
        target.typeId === 'radiation_shelter'
          ? 12
          : target.typeId === 'habitat'
          ? 6
          : 0;
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
      return {
        ...prev,
        activeAstronautId: id,
      };
    });
  };

  const handlePerformSuitDiagnostic = (
    partId: SuitPartId,
    astronautId?: AstronautId
  ) => {
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
        if (awardFullBonus) {
          radDelta = -3;
          sciDelta = 3;
          detail = `Gold visor optics & radiation dosimeter calibrated on ${prev.planetName} (-3% Radiation, +3 SCI).`;
        } else {
          detail = `Helmet HUD & solar glare seal re-verified on ${prev.planetName} (+1 SCI).`;
        }
      } else if (partId === 'chest_pack') {
        title = `${astro.name}: Suit Life-Support Biometrics`;
        if (awardFullBonus) {
          oxyDelta = 3;
          waterDelta = 2;
          sciDelta = 2;
          detail = `Closed-loop suit telemetry synced with habitat reserves (+3% O₂, +2% H₂O, +2 SCI).`;
        } else {
          detail = `Chest Display & Crew Biometrics nominal (+1 SCI).`;
        }
      } else if (partId === 'plss_backpack') {
        title = `${astro.name}: PLSS Scrubber & NASA Uplink`;
        if (awardFullBonus) {
          oxyDelta = 2;
          sciDelta = 4;
          detail = `CO₂ scrubber purged & PLSS antenna transmitted ${prev.planetName} telemetry (+2% O₂, +4 SCI).`;
        } else {
          detail = `PLSS oxygen reserve & telemetry carrier confirmed nominal (+1 SCI).`;
        }
      } else if (partId === 'arms_tools') {
        title = `${astro.name}: EVA Gauntlet & Tool Calibration`;
        if (awardFullBonus) {
          sciDelta = 3;
          detail = `Articulated EVA gloves & ${astro.taskTitle} field actuators calibrated (+3 SCI).`;
        } else {
          detail = `EVA wrist actuators & grip torque test completed (+1 SCI).`;
        }
      } else {
        title = `${astro.name}: Traction Boot & Dust Seal Test`;
        if (awardFullBonus) {
          flueClogDelta = -10;
          sciDelta = 2;
          detail = `Electrostatic regolith dust cleared from boots & nearby intakes (-10% Flue Clog, +2 SCI).`;
        } else {
          detail = `Magnetic boot seals & low-G stance verified (+1 SCI).`;
        }
      }

      const nextFlueClog = Math.max(0, prev.stormFlue.cloggedPct + flueClogDelta);
      const nextFlueStatus =
        nextFlueClog >= 70 ? 'critical' : nextFlueClog >= 40 ? 'warning' : 'nominal';

      return {
        ...prev,
        activeAstronautId: targetId,
        sciencePoints: prev.sciencePoints + sciDelta,
        stormFlue: {
          ...prev.stormFlue,
          cloggedPct: nextFlueClog,
          status: nextFlueStatus,
        },
        crew: {
          ...prev.crew,
          radiationExposure: Math.max(0, prev.crew.radiationExposure + radDelta),
        },
        resources: {
          ...prev.resources,
          oxygen: {
            ...prev.resources.oxygen,
            current: Math.min(100, prev.resources.oxygen.current + oxyDelta),
          },
          water: {
            ...prev.resources.water,
            current: Math.min(100, prev.resources.water.current + waterDelta),
          },
        },
        crewProgress: {
          ...prev.crewProgress,
          [astro.id]: {
            ...prevProg,
            tasksCompleted: awardFullBonus
              ? prevProg.tasksCompleted + 1
              : prevProg.tasksCompleted,
            currentTaskDone: true,
            lastAction: title,
          },
        },
        activityLog: [
          {
            id: `suit-${partId}-${Date.now()}`,
            day: prev.day,
            time: '12:20',
            title,
            detail,
            severity: 'info',
          },
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
            current: Math.min(
              prev.resources.battery.max,
              prev.resources.battery.current + batteryGain
            ),
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
              : `Exhaust vents & pressure verified on ${prev.planetName} (+3 SCI).`,
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
      const sciGain = node.scienceValue;
      const waterGain = astro.id === 'affan' ? 8 : 0;
      const oxyGain = astro.id === 'affan' ? 5 : 0;
      const prevProg = prev.crewProgress[astro.id];

      return {
        ...prev,
        sciencePoints: prev.sciencePoints + sciGain,
        resources: {
          ...prev.resources,
          water: {
            ...prev.resources.water,
            current: Math.min(100, prev.resources.water.current + waterGain),
          },
          oxygen: {
            ...prev.resources.oxygen,
            current: Math.min(100, prev.resources.oxygen.current + oxyGain),
          },
        },
        dataNodes: prev.dataNodes.map((n) =>
          n.id === nodeId ? { ...n, collected: true } : n
        ),
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
            detail: `${node.reading} · Transmitted to NASA (+${sciGain} SCI${
              astro.id === 'affan' ? ', +8 H₂O, +5 O₂' : ''
            }).`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
    });
  };

  const handleServiceBuilding = (uid: string) => {
    setSimState((prev) => {
      if (!prev) return prev;
      const b = prev.buildings.find((item) => item.uid === uid);
      if (!b) return prev;
      const astro = getAstronautById(prev.activeAstronautId);
      const prevProg = prev.crewProgress[astro.id];
      if (prevProg.currentTaskDone) return prev;

      const def = getBuildingDef(b.typeId);
      let oxyDelta = 0;
      let waterDelta = 0;
      let foodDelta = 0;
      let batDelta = 0;
      let sciDelta = 4;
      let radDelta = 0;
      let flueClog = prev.stormFlue.cloggedPct;

      if (astro.id === 'abubakr') {
        flueClog = Math.max(0, flueClog - 25);
        sciDelta = 6;
      } else if (astro.id === 'affan') {
        waterDelta = 8;
        oxyDelta = 5;
      } else if (astro.id === 'ali') {
        batDelta = 14;
      } else if (astro.id === 'jawwad') {
        foodDelta = 7;
        waterDelta = 5;
      } else if (astro.id === 'om') {
        radDelta = -6;
        sciDelta = 8;
      } else if (astro.id === 'ammar') {
        batDelta = 6;
        flueClog = Math.max(0, flueClog - 20);
        sciDelta = 6;
      }

      const flueStatus =
        flueClog >= 70 ? 'critical' : flueClog >= 40 ? 'warning' : 'nominal';

      return {
        ...prev,
        sciencePoints: prev.sciencePoints + sciDelta,
        stormFlue: {
          ...prev.stormFlue,
          cloggedPct: flueClog,
          status: flueStatus,
        },
        crew: {
          ...prev.crew,
          radiationExposure: Math.max(0, prev.crew.radiationExposure + radDelta),
        },
        resources: {
          ...prev.resources,
          oxygen: {
            ...prev.resources.oxygen,
            current: Math.min(100, prev.resources.oxygen.current + oxyDelta),
          },
          water: {
            ...prev.resources.water,
            current: Math.min(100, prev.resources.water.current + waterDelta),
          },
          food: {
            ...prev.resources.food,
            current: Math.min(100, prev.resources.food.current + foodDelta),
          },
          battery: {
            ...prev.resources.battery,
            current: Math.min(
              prev.resources.battery.max,
              prev.resources.battery.current + batDelta
            ),
          },
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

  const handleTravelToWorld = (planetId: PlanetId) => {
    setSimState((prev) => {
      if (!prev || prev.planetId === planetId) return prev;
      const planet = getPlanetById(planetId);
      const nextVisited = prev.visitedWorlds.includes(planetId)
        ? prev.visitedWorlds
        : [...prev.visitedWorlds, planetId];

      return {
        ...prev,
        planetId: planet.id,
        planetName: planet.name,
        operationName: planet.operationName,
        visitedWorlds: nextVisited,
        dataNodes: getWorldDataNodes(planet.id),
        stormFlue: {
          ...prev.stormFlue,
          pressureKpa: planet.id === 'titan' ? 145 : planet.id === 'mars' ? 0.65 : 101.3,
          exhaustTempC: planet.id === 'titan' || planet.id === 'europa' ? -42 : 24,
          inspectedToday: false,
        },
        activityLog: [
          {
            id: `nav-${Date.now()}`,
            day: prev.day,
            time: '16:00',
            title: `NASA Transit: Landed on ${planet.name}`,
            detail: `${planet.operationName} active at ${planet.location}. New planetary data nodes ready for survey.`,
            severity: 'info',
          },
          ...prev.activityLog,
        ],
      };
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
    setSimState(null);
    setScreen('setup');
  };

  const handleCompareOtherPlanet = (otherPlanetId: PlanetId) => {
    setMissionConfig((prev) => ({ ...prev, planetId: otherPlanetId }));
    setSimState(null);
    setScreen('briefing');
  };

  if (screen === 'landing') {
    return <Landing onStartMission={() => setScreen('setup')} />;
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
        onBack={() => setScreen('setup')}
        onGoHome={handleGoHome}
        onSelectPlanet={(planetId) => {
          setMissionConfig((prev) => ({ ...prev, planetId }));
          setScreen('briefing');
        }}
      />
    );
  }

  if (screen === 'briefing') {
    return (
      <Briefing
        config={missionConfig}
        onBack={() => setScreen('planet')}
        onGoHome={handleGoHome}
        onLaunchBuilder={() => setScreen('builder')}
      />
    );
  }

  if (screen === 'builder') {
    return (
      <BaseBuilder
        config={missionConfig}
        onBack={() => setScreen('briefing')}
        onGoHome={handleGoHome}
        onLaunchMission={handleLaunchMission}
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
        onComplete={() => setScreen('mission')}
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
        onAdvanceDay={handleAdvanceDay}
        onToggleBuilding={handleToggleBuilding}
        onUpgradeBuilding={handleUpgradeBuilding}
        onResearchTech={handleResearchTech}
        onSelectAstronaut={handleSelectAstronaut}
        onInspectStormFlue={handleInspectStormFlue}
        onCollectDataNode={handleCollectDataNode}
        onServiceBuilding={handleServiceBuilding}
        onPerformSuitDiagnostic={handlePerformSuitDiagnostic}
        onTravelToWorld={handleTravelToWorld}
        onTriggerStormScene={() => setScreen('storm')}
        onOpenEmergency={() => setScreen('emergency')}
        onExitMission={() => setScreen('landing')}
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

  return <Landing onStartMission={() => setScreen('setup')} />;
}
