import { ASTRONAUTS } from '../data/astronauts';
import { getBuildingDef } from '../data/buildings';
import { getPlanetById } from '../data/planets';
import type {
  AstronautId,
  CommsFaultId,
  DailyRates,
  MedicalConditionId,
  MissionState,
  PlanetId,
  SparePartId,
} from '../types';
import { pickContextualEvent } from './events';

export function isLunarEclipseDay(planetId: PlanetId, day: number): boolean {
  if (planetId !== 'moon') return false;
  // Realistic scheduled solar eclipses on Day 6, 15, 24, 33, 42
  return day > 2 && (day - 6) % 9 === 0;
}

export function getEarthVisibilityPct(planetId: PlanetId, day: number): number {
  if (planetId === 'moon') {
    // Lunar libration cycles Earth near the polar horizon (between 38% and 98%)
    const wave = 68 + 30 * Math.cos(day * 0.42);
    return Math.round(Math.max(30, Math.min(99, wave)));
  }
  if (planetId === 'mars') {
    return Math.round(72 + 24 * Math.sin(day * 0.31 + 1.1));
  }
  if (planetId === 'titan') {
    return Math.round(64 + 26 * Math.cos(day * 0.25));
  }
  // Europa occultations behind Jupiter periodically block Earth line-of-sight
  return Math.round(60 + 34 * Math.sin(day * 0.55));
}

export function getSolarFactor(
  planetId: PlanetId,
  day: number,
  eclipseActive = false
): { factor: number; label: string; tempC: number } {
  if (planetId === 'moon') {
    if (eclipseActive || isLunarEclipseDay(planetId, day)) {
      return { factor: 0.14, label: 'Lunar Solar Eclipse (14%)', tempC: -168 };
    }
    const cycleDay = ((day - 1) % 30) + 1;
    if (cycleDay <= 11) return { factor: 1.0, label: 'Peak Sunlight (100%)', tempC: 108 };
    if (cycleDay <= 14) return { factor: 0.65, label: 'Lunar Dusk (65%)', tempC: -18 };
    if (cycleDay <= 20) return { factor: 0.34, label: 'Shadowed Phase (34%)', tempC: -145 };
    if (cycleDay <= 23) return { factor: 0.72, label: 'Lunar Dawn (72%)', tempC: 15 };
    return { factor: 1.0, label: 'Peak Sunlight (100%)', tempC: 112 };
  }

  if (planetId === 'mars') {
    const wave = 0.76 + 0.14 * Math.sin(day * 0.6);
    return {
      factor: Number(wave.toFixed(2)),
      label: `Martian Sun (${Math.round(wave * 100)}%)`,
      tempC: Math.round(-62 + 18 * Math.sin(day * 0.5)),
    };
  }

  if (planetId === 'titan') {
    const wave = 0.54 + 0.08 * Math.cos(day * 0.5);
    return {
      factor: Number(wave.toFixed(2)),
      label: `Titan Orange Haze (${Math.round(wave * 100)}%)`,
      tempC: Math.round(-179 + 3 * Math.cos(day * 0.4)),
    };
  }

  const wave = 0.62 + 0.1 * Math.sin(day * 0.7);
  return {
    factor: Number(wave.toFixed(2)),
    label: `Jovian Ice Light (${Math.round(wave * 100)}%)`,
    tempC: Math.round(-165 + 12 * Math.sin(day * 0.5)),
  };
}

export function calculateDailyPreview(state: MissionState): DailyRates {
  const mult = state.consumptionMultiplier;
  const solarMeta = getSolarFactor(state.planetId, state.day, state.lunarState.eclipseActive);
  const fluePenalty = state.stormFlue.cloggedPct >= 65 ? 0.85 : 1.0;

  let powerGen = 0;
  let powerUsed = 0;
  let oxygenProd = 0;
  let waterProd = 0;
  let foodProd = 0;
  let extraWaterCons = 0;
  let fuelProd = state.fuel.isruSynthesisRate;

  state.buildings.forEach((b) => {
    if (!b.online) return;
    const def = getBuildingDef(b.typeId);
    if (!def) return;
    const levelMult = 1 + (b.level - 1) * 0.3;
    const conditionMult = b.damaged
      ? Math.max(0.25, b.conditionPct / 100)
      : Math.max(0.65, b.conditionPct / 100);
    const dustPenalty = 1 - Math.min(0.45, (b.dustPct || 0) * 0.0045);

    if (def.powerGen) {
      powerGen +=
        def.powerGen *
        levelMult *
        conditionMult *
        dustPenalty *
        solarMeta.factor *
        (1 + state.techUpgrades.solarEfficiencyBonus);
    }
    powerUsed += def.powerReq;

    oxygenProd += def.produces.oxygen * levelMult * conditionMult * fluePenalty;
    waterProd +=
      def.produces.water *
      levelMult *
      conditionMult *
      (b.typeId === 'water_recycler' ? 1 + state.techUpgrades.waterEfficiencyBonus : 1);
    foodProd += def.produces.food * levelMult * conditionMult * (1 + state.techUpgrades.cropYieldBonus);
    extraWaterCons += def.waterReq;

    if (b.typeId === 'fuel_depot') {
      fuelProd += 4 * levelMult * conditionMult;
    }
  });

  // Unattended medical alerts slightly increase O2/water consumption and cut work efficiency
  const medicalStrain = Object.values(state.crewVitals).filter((v) => v.medicalAlert !== null).length;

  const oxygenCons = 10.5 * mult + medicalStrain * 0.5;
  const waterCons = 13.5 * mult + extraWaterCons + medicalStrain * 0.6;
  const foodCons = 8.5 * mult;

  return {
    solarCondition: solarMeta.label,
    powerGen: Math.round(powerGen),
    powerUsed: Math.round(powerUsed),
    oxygenProd: Number(oxygenProd.toFixed(1)),
    oxygenCons: Number(oxygenCons.toFixed(1)),
    waterProd: Number(waterProd.toFixed(1)),
    waterCons: Number(waterCons.toFixed(1)),
    foodProd: Number(foodProd.toFixed(1)),
    foodCons: Number(foodCons.toFixed(1)),
    fuelProd: Math.round(fuelProd),
    tempC: solarMeta.tempC,
  };
}

export function simulateNextDay(state: MissionState): MissionState {
  if (state.status !== 'active') return state;

  const planet = getPlanetById(state.planetId);
  const nextDayRaw = state.day + 1;
  const eclipseTomorrow = isLunarEclipseDay(state.planetId, nextDayRaw);
  const rates = calculateDailyPreview({
    ...state,
    day: nextDayRaw,
    lunarState: { ...state.lunarState, eclipseActive: eclipseTomorrow },
  });
  const netPower = rates.powerGen - rates.powerUsed;

  let nextBattery = state.resources.battery.current + netPower;
  let brownout = false;
  if (nextBattery <= 0) {
    nextBattery = 0;
    brownout = true;
  } else if (nextBattery > state.resources.battery.max) {
    nextBattery = state.resources.battery.max;
  }

  const prodEfficiency = brownout ? 0.45 : 1.0;
  const clamp = (val: number, max = 100) => Math.max(0, Math.min(max, Number(val.toFixed(1))));

  const nextOxygen = clamp(
    state.resources.oxygen.current + rates.oxygenProd * prodEfficiency - rates.oxygenCons
  );
  const nextWater = clamp(
    state.resources.water.current + rates.waterProd * prodEfficiency - rates.waterCons
  );
  const nextFood = clamp(
    state.resources.food.current + rates.foodProd * prodEfficiency - rates.foodCons
  );

  // Dust / cryo-frost accumulation across buildings & lunar dust
  const dustGain =
    state.planetId === 'moon' ? 6 : state.planetId === 'mars' ? 8 : state.planetId === 'titan' ? 5 : 4;
  const updatedBuildings = state.buildings.map((b) => ({
    ...b,
    dustPct: Math.min(100, (b.dustPct || 0) + (b.typeId === 'solar' || b.typeId === 'comms' ? dustGain : Math.round(dustGain * 0.5))),
    conditionPct: b.damaged ? b.conditionPct : Math.max(60, b.conditionPct - (state.shelterRefugeActive ? 1 : 0.4)),
  }));

  // Radiation exposure scaled by planet hazard and shelter state
  let exposureDelta = 0;
  const refugeFactor = state.shelterRefugeActive ? 0.25 : 1.0;
  if (state.resources.shielding < 48) {
    exposureDelta = (48 - state.resources.shielding) * 0.13 * planet.radiationHazard * refugeFactor;
  } else {
    exposureDelta = state.shelterRefugeActive ? -2.2 : -1.0;
  }
  const nextExposure = clamp(state.crew.radiationExposure + exposureDelta, 100);

  // Update individual astronaut medical vitals
  const hasMedBay = state.buildings.some((b) => b.typeId === 'medical_station' && b.online && !b.damaged);
  const nextCrewVitals = { ...state.crewVitals };
  let activeMedicalAlertsCount = 0;

  (Object.keys(nextCrewVitals) as AstronautId[]).forEach((id) => {
    const prev = nextCrewVitals[id];
    let health = prev.healthPct;
    let fatigue = Math.min(100, prev.fatiguePct + (hasMedBay ? 4 : 7));
    let hydration = Math.max(0, prev.hydrationPct - (nextWater < 30 ? 11 : 4));
    let radiation = Math.min(100, Math.max(0, prev.radiationPct + exposureDelta * 0.65));
    let alert: MedicalConditionId | null = prev.medicalAlert;

    if (hasMedBay && !alert) {
      fatigue = Math.max(0, fatigue - 4);
      health = Math.min(100, health + 2);
    }

    if (alert) {
      // Untreated medical emergency degrades astronaut health each day
      health = Math.max(20, health - 7);
    } else {
      if (hydration < 52) alert = 'dehydration';
      else if (fatigue > 78) alert = 'exhaustion';
      else if (radiation > 48) alert = 'illness';
      else if (Math.random() < (state.difficulty === 'commander' ? 0.06 : 0.03) && nextDayRaw > 2) {
        const pool: MedicalConditionId[] = ['exhaustion', 'dehydration', 'illness', 'suit_trauma'];
        alert = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (alert) activeMedicalAlertsCount += 1;

    nextCrewVitals[id] = {
      healthPct: Math.round(health),
      fatiguePct: Math.round(fatigue),
      hydrationPct: Math.round(hydration),
      radiationPct: Number(radiation.toFixed(1)),
      medicalAlert: alert,
      diagnosed: alert === prev.medicalAlert ? prev.diagnosed : false,
      sheltered: state.shelterRefugeActive,
    };
  });

  // Safe crew count reflects oxygen/water/food/exposure + neglected medical alerts
  let safeCrew = state.crew.total;
  if (nextOxygen < 18 || nextWater < 18 || nextFood < 12) safeCrew = Math.max(2, safeCrew - 1);
  if (nextExposure > 65) safeCrew = Math.min(safeCrew, 3);
  if (activeMedicalAlertsCount >= 2) {
    safeCrew = Math.max(1, safeCrew - Math.floor(activeMedicalAlertsCount / 2));
  }

  let nextStatus: MissionState['status'] = 'active';
  let failureReason: string | null = null;

  if (nextOxygen <= 0) {
    nextStatus = 'failed';
    failureReason = 'Oxygen reserves depleted to critical zero.';
  } else if (nextWater <= 0) {
    nextStatus = 'failed';
    failureReason = 'Water supply exhausted across outpost systems.';
  } else if (nextFood <= 0) {
    nextStatus = 'failed';
    failureReason = 'Crew food rations reached zero.';
  } else if (nextExposure >= 100) {
    nextStatus = 'failed';
    failureReason = 'Cumulative crew radiation exposure exceeded NASA safety limits.';
  } else if (nextDayRaw > state.maxDays) {
    nextStatus = 'won';
  }

  // Fuel ISRU synthesis (only if battery didn't brownout)
  const nextFuelCurrent = Math.min(
    state.fuel.max,
    Math.round(state.fuel.current + (brownout ? 1 : rates.fuelProd * 0.5))
  );

  // Resupply orders arrival check
  const arrivedOrders = state.pendingResupply.filter((o) => o.arrivalDay <= nextDayRaw);
  const remainingOrders = state.pendingResupply.filter((o) => o.arrivalDay > nextDayRaw);
  const nextSpareParts = { ...state.spareParts };
  let nextMedSupplies = state.resources.medSupplies;

  arrivedOrders.forEach((order) => {
    (Object.keys(order.parts) as SparePartId[]).forEach((partKey) => {
      nextSpareParts[partKey] = (nextSpareParts[partKey] || 0) + (order.parts[partKey] || 0);
    });
    nextMedSupplies += order.medSupplies;
  });

  // Comms window & signal simulation
  const commsBuilding = updatedBuildings.find((b) => b.typeId === 'comms' && b.online);
  const earthVis = getEarthVisibilityPct(state.planetId, nextDayRaw);
  const commsWindowOpen = earthVis >= 42 && !eclipseTomorrow;
  let nextFault: CommsFaultId | null = state.comms.fault;
  if (!nextFault && commsBuilding && commsBuilding.damaged) {
    nextFault = 'feed_horn_alignment';
  }
  const signalPenalty = nextFault ? 48 : !commsBuilding ? 24 : !commsWindowOpen ? 30 : 0;
  const nextSignal = Math.max(
    10,
    Math.min(100, Math.round(earthVis - signalPenalty + (commsBuilding?.level || 1) * 4))
  );

  const hasWorkingComms = Boolean(commsBuilding && !commsBuilding.damaged && !nextFault);
  const scienceEarned = hasWorkingComms ? 12 : 7;

  // Storm Flue accumulates dust/frost daily
  const clogGain = state.planetId === 'mars' || state.planetId === 'titan' ? 14 : 9;
  const nextClog = Math.min(100, state.stormFlue.cloggedPct + clogGain);
  const nextFlueStatus: MissionState['stormFlue']['status'] =
    nextClog >= 70 ? 'critical' : nextClog >= 40 ? 'warning' : 'nominal';

  // Rover condition & charge
  const hasGarage = updatedBuildings.some((b) => b.typeId === 'rover_garage' && b.online);
  const nextRover = {
    ...state.rover,
    chargePct: hasGarage
      ? Math.min(100, state.rover.chargePct + 18)
      : Math.max(25, state.rover.chargePct - 8),
    dustPct: Math.min(100, state.rover.dustPct + (hasGarage ? 2 : 7)),
  };

  // Achievements (eclipse survivor check if survived previous eclipse day with >0 battery)
  let nextAchievements = [...state.achievements];
  if (
    state.lunarState.eclipseActive &&
    nextBattery > 0 &&
    !nextAchievements.includes('eclipse_survivor')
  ) {
    nextAchievements.push('eclipse_survivor');
  }

  const recordedDay = Math.min(nextDayRaw, state.maxDays);
  const newLogs = [...state.activityLog];

  arrivedOrders.forEach((order) => {
    newLogs.unshift({
      id: `resupply-${order.id}`,
      day: recordedDay,
      time: '07:15',
      title: 'Resupply Pod Landed',
      detail: `Received ${order.itemsSummary} from Earth cargo lander.`,
      severity: 'info',
    });
  });

  if (eclipseTomorrow) {
    newLogs.unshift({
      id: `eclipse-${recordedDay}`,
      day: recordedDay,
      time: '10:30',
      title: 'Lunar Solar Eclipse Active',
      detail: 'Earth shadow dimmed sunlight to 14%. Rely on Battery Banks & shelter crew if radiation climbs.',
      severity: 'warning',
    });
  }

  if (brownout) {
    newLogs.unshift({
      id: `brownout-${recordedDay}-${Date.now()}`,
      day: recordedDay,
      time: '14:20',
      title: 'Power Brownout Warning',
      detail: 'Battery reserves depleted; life-support production throttled to 45%.',
      severity: 'warning',
    });
  } else if (nextFlueStatus === 'critical') {
    newLogs.unshift({
      id: `flue-${recordedDay}-${Date.now()}`,
      day: recordedDay,
      time: '12:15',
      title: 'Storm Flue Clog Alert',
      detail: `Storm Flue at ${nextClog}% blockage! Dispatch Abubakr to clear exhaust vents.`,
      severity: 'warning',
    });
  } else if (nextStatus === 'won') {
    newLogs.unshift({
      id: `win-${recordedDay}`,
      day: recordedDay,
      time: '18:00',
      title: 'Expedition Duration Completed',
      detail: `All ${state.crew.total} astronauts completed ${state.maxDays} days of off-world science.`,
      severity: 'info',
    });
  } else if (!eclipseTomorrow) {
    newLogs.unshift({
      id: `daily-${recordedDay}-${Date.now()}`,
      day: recordedDay,
      time: '09:00',
      title: `Day ${recordedDay} Telemetry Nominal`,
      detail: `${rates.solarCondition} · Net Power ${netPower >= 0 ? '+' : ''}${netPower} kWh · ${rates.tempC}°C`,
      severity: 'info',
    });
  }

  let triggeredEvent = state.activeEvent;
  let nextRefuge = false;
  let nextHazardText: string | null = null;

  if (nextStatus === 'active' && !triggeredEvent && recordedDay > 2) {
    const commsReduction = hasWorkingComms ? 0.05 : 0;
    const strainBonus =
      nextWater < 35 ||
      nextOxygen < 35 ||
      nextClog >= 65 ||
      nextBattery < state.resources.battery.max * 0.25
        ? 0.08
        : 0;
    const roll = Math.random();
    if (roll < state.eventChance - commsReduction + strainBonus || eclipseTomorrow) {
      triggeredEvent = pickContextualEvent(state.planetId, {
        ...state,
        day: recordedDay,
        lunarState: { ...state.lunarState, eclipseActive: eclipseTomorrow },
      });
      if (triggeredEvent.hazardSeverity === 'shelter') {
        nextRefuge = true;
        nextHazardText = `REFUGE ALERT: ${triggeredEvent.title} — Crew seeking airlock shelter`;
      }
      newLogs.unshift({
        id: `evt-${recordedDay}-${Date.now()}`,
        day: recordedDay,
        time: '16:45',
        title: `Alert: ${triggeredEvent.title}`,
        detail: 'Commander engineering decision required in Emergency Center.',
        severity: 'danger',
      });
    }
  }

  const powerPct = Math.round((nextBattery / state.resources.battery.max) * 100);

  const updatedCrewProgress = { ...state.crewProgress };
  (Object.keys(updatedCrewProgress) as Array<keyof typeof updatedCrewProgress>).forEach((k) => {
    updatedCrewProgress[k] = {
      ...updatedCrewProgress[k],
      currentTaskDone: false,
    };
  });

  return {
    ...state,
    day: recordedDay,
    status: nextStatus,
    failureReason,
    sciencePoints: state.sciencePoints + scienceEarned,
    crewProgress: updatedCrewProgress,
    crewVitals: nextCrewVitals,
    buildings: updatedBuildings,
    shelterRefugeActive: nextRefuge,
    hazardWarningText: nextHazardText,
    stormFlue: {
      ...state.stormFlue,
      cloggedPct: nextClog,
      inspectedToday: false,
      status: nextFlueStatus,
      pressureKpa: Number(
        (
          (state.planetId === 'titan' ? 145 : state.planetId === 'mars' ? 0.65 : 101.3) +
          nextClog * 0.18
        ).toFixed(2)
      ),
    },
    crew: {
      ...state.crew,
      safe: safeCrew,
      radiationExposure: nextExposure,
    },
    resources: {
      ...state.resources,
      oxygen: { ...state.resources.oxygen, current: nextOxygen },
      water: { ...state.resources.water, current: nextWater },
      food: { ...state.resources.food, current: nextFood },
      battery: { ...state.resources.battery, current: Math.round(nextBattery) },
      medSupplies: nextMedSupplies,
    },
    fuel: {
      ...state.fuel,
      current: nextFuelCurrent,
    },
    spareParts: nextSpareParts,
    pendingResupply: remainingOrders,
    comms: {
      ...state.comms,
      earthVisibilityPct: earthVis,
      windowOpen: commsWindowOpen,
      fault: nextFault,
      signalStrengthPct: nextSignal,
    },
    rover: nextRover,
    lunarState: {
      ...state.lunarState,
      eclipseActive: eclipseTomorrow,
      eclipsePhasePct: eclipseTomorrow ? 86 : 0,
      lunarDustPct:
        state.planetId === 'moon' ? Math.min(100, state.lunarState.lunarDustPct + 5) : 0,
    },
    achievements: nextAchievements,
    lastRates: rates,
    activeEvent: triggeredEvent,
    history: [
      ...state.history,
      {
        day: recordedDay,
        oxygen: Math.round(nextOxygen),
        water: Math.round(nextWater),
        food: Math.round(nextFood),
        powerPct,
        fuelPct: Math.round((nextFuelCurrent / state.fuel.max) * 100),
        shielding: state.resources.shielding,
      },
    ],
    activityLog: newLogs.slice(0, 30),
  };
}

export interface WhatIfProjection {
  daysSimulated: number;
  endOxygen: number;
  endWater: number;
  endFood: number;
  endPowerPct: number;
  endFuelPct: number;
  brownoutDays: number;
  criticalWarning: string | null;
}

export function projectWhatIfScenario(
  state: MissionState,
  overrides: {
    extraSolar?: number;
    extraGreenhouse?: number;
    extraRecycler?: number;
    extraBattery?: number;
    waterEfficiencyBoost?: number;
  },
  days = 7
): WhatIfProjection {
  const rates = calculateDailyPreview(state);
  const netO2 =
    rates.oxygenProd +
    (overrides.extraGreenhouse || 0) * 4 -
    rates.oxygenCons;
  const netWater =
    rates.waterProd * (1 + (overrides.waterEfficiencyBoost || 0)) +
    (overrides.extraRecycler || 0) * 11 -
    (overrides.extraGreenhouse || 0) * 5 -
    rates.waterCons;
  const netFood =
    rates.foodProd +
    (overrides.extraGreenhouse || 0) * 8 -
    rates.foodCons;
  const netPower =
    rates.powerGen +
    (overrides.extraSolar || 0) * 32 -
    rates.powerUsed -
    (overrides.extraGreenhouse || 0) * 8 -
    (overrides.extraRecycler || 0) * 7;

  const maxBat = state.resources.battery.max + (overrides.extraBattery || 0) * 70;
  let o2 = state.resources.oxygen.current;
  let h2o = state.resources.water.current;
  let food = state.resources.food.current;
  let bat = state.resources.battery.current;
  let fuel = state.fuel.current;
  let brownoutDays = 0;

  for (let d = 0; d < days; d++) {
    bat += netPower;
    let eff = 1;
    if (bat <= 0) {
      bat = 0;
      brownoutDays += 1;
      eff = 0.45;
    } else if (bat > maxBat) {
      bat = maxBat;
    }
    o2 = Math.max(0, Math.min(100, o2 + netO2 * eff));
    h2o = Math.max(0, Math.min(100, h2o + netWater * eff));
    food = Math.max(0, Math.min(100, food + netFood * eff));
    fuel = Math.min(state.fuel.max, fuel + rates.fuelProd * 0.5);
  }

  let criticalWarning: string | null = null;
  if (o2 < 20) criticalWarning = 'Oxygen projected to drop into critical reserve.';
  else if (h2o < 20) criticalWarning = 'Water balance becomes negative — consider Water Recycler.';
  else if (brownoutDays > 0) criticalWarning = `Projected ${brownoutDays} brownout day(s) — add Solar or Battery.`;

  return {
    daysSimulated: days,
    endOxygen: Math.round(o2),
    endWater: Math.round(h2o),
    endFood: Math.round(food),
    endPowerPct: Math.round((bat / maxBat) * 100),
    endFuelPct: Math.round((fuel / state.fuel.max) * 100),
    brownoutDays,
    criticalWarning,
  };
}
