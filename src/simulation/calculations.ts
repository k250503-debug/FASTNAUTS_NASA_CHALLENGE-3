import { getBuildingDef } from '../data/buildings';
import { getPlanetById } from '../data/planets';
import type { DailyRates, MissionState, PlanetId } from '../types';
import { pickContextualEvent } from './events';

export function getSolarFactor(planetId: PlanetId, day: number): { factor: number; label: string } {
  if (planetId === 'moon') {
    const cycleDay = ((day - 1) % 30) + 1;
    if (cycleDay <= 11) return { factor: 1.0, label: 'Peak Sunlight (100%)' };
    if (cycleDay <= 14) return { factor: 0.65, label: 'Lunar Dusk (65%)' };
    if (cycleDay <= 20) return { factor: 0.3, label: 'Shadowed Phase (30%)' };
    if (cycleDay <= 23) return { factor: 0.7, label: 'Lunar Dawn (70%)' };
    return { factor: 1.0, label: 'Peak Sunlight (100%)' };
  }

  if (planetId === 'mars') {
    const wave = 0.76 + 0.14 * Math.sin(day * 0.6);
    return {
      factor: Number(wave.toFixed(2)),
      label: `Martian Sun (${Math.round(wave * 100)}%)`,
    };
  }

  if (planetId === 'titan') {
    const wave = 0.54 + 0.08 * Math.cos(day * 0.5);
    return {
      factor: Number(wave.toFixed(2)),
      label: `Titan Orange Haze (${Math.round(wave * 100)}%)`,
    };
  }

  // Europa
  const wave = 0.62 + 0.1 * Math.sin(day * 0.7);
  return {
    factor: Number(wave.toFixed(2)),
    label: `Jovian Ice Light (${Math.round(wave * 100)}%)`,
  };
}

export function calculateDailyPreview(state: MissionState): DailyRates {
  const mult = state.consumptionMultiplier;
  const solarMeta = getSolarFactor(state.planetId, state.day);
  const fluePenalty = state.stormFlue.cloggedPct >= 65 ? 0.85 : 1.0;

  let powerGen = 0;
  let powerUsed = 0;
  let oxygenProd = 0;
  let waterProd = 0;
  let foodProd = 0;
  let extraWaterCons = 0;

  state.buildings.forEach((b) => {
    if (!b.online) return;
    const def = getBuildingDef(b.typeId);
    if (!def) return;
    const levelMult = 1 + (b.level - 1) * 0.3;

    if (def.powerGen) {
      powerGen +=
        def.powerGen *
        levelMult *
        solarMeta.factor *
        (1 + state.techUpgrades.solarEfficiencyBonus);
    }
    powerUsed += def.powerReq;

    oxygenProd += def.produces.oxygen * levelMult * fluePenalty;
    waterProd +=
      def.produces.water *
      levelMult *
      (b.typeId === 'water_recycler' ? 1 + state.techUpgrades.waterEfficiencyBonus : 1);
    foodProd += def.produces.food * levelMult * (1 + state.techUpgrades.cropYieldBonus);
    extraWaterCons += def.waterReq;
  });

  // 6 astronauts baseline consumption balanced cleanly with starter modules
  const oxygenCons = 10.5 * mult;
  const waterCons = 13.5 * mult + extraWaterCons;
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
  };
}

export function simulateNextDay(state: MissionState): MissionState {
  if (state.status !== 'active') return state;

  const planet = getPlanetById(state.planetId);
  const nextDayRaw = state.day + 1;
  const rates = calculateDailyPreview(state);
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

  // Radiation exposure scaled by planet's NASA radiation hazard
  let exposureDelta = 0;
  if (state.resources.shielding < 48) {
    exposureDelta = (48 - state.resources.shielding) * 0.13 * planet.radiationHazard;
  } else {
    exposureDelta = -1;
  }
  const nextExposure = clamp(state.crew.radiationExposure + exposureDelta, 100);

  let safeCrew = state.crew.total;
  if (nextOxygen < 18 || nextWater < 18 || nextFood < 12) safeCrew = Math.max(2, safeCrew - 1);
  if (nextExposure > 65) safeCrew = Math.min(safeCrew, 3);

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

  const hasComms = state.buildings.some((b) => b.typeId === 'comms' && b.online);
  const scienceEarned = hasComms ? 12 : 7;

  // Storm Flue accumulates dust/frost daily
  const clogGain = state.planetId === 'mars' || state.planetId === 'titan' ? 14 : 9;
  const nextClog = Math.min(100, state.stormFlue.cloggedPct + clogGain);
  const nextFlueStatus: MissionState['stormFlue']['status'] =
    nextClog >= 70 ? 'critical' : nextClog >= 40 ? 'warning' : 'nominal';

  const recordedDay = Math.min(nextDayRaw, state.maxDays);
  const newLogs = [...state.activityLog];

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
      detail: `Storm Flue at ${nextClog}% blockage! Switch to Abubakr and inspect the 3D Storm Flue.`,
      severity: 'warning',
    });
  } else if (nextStatus === 'won') {
    newLogs.unshift({
      id: `win-${recordedDay}`,
      day: recordedDay,
      time: '18:00',
      title: 'Expedition Duration Completed',
      detail: `All ${state.crew.total} astronauts survived ${state.maxDays} days across NASA mission objectives.`,
      severity: 'info',
    });
  } else {
    newLogs.unshift({
      id: `daily-${recordedDay}-${Date.now()}`,
      day: recordedDay,
      time: '09:00',
      title: `Day ${recordedDay} Telemetry Nominal`,
      detail: `${rates.solarCondition} · Net Power ${netPower >= 0 ? '+' : ''}${netPower} kWh`,
      severity: 'info',
    });
  }

  let triggeredEvent = state.activeEvent;
  if (nextStatus === 'active' && !triggeredEvent && recordedDay > 2) {
    const commsReduction = hasComms ? 0.05 : 0;
    const strainBonus =
      nextWater < 35 ||
      nextOxygen < 35 ||
      nextClog >= 65 ||
      nextBattery < state.resources.battery.max * 0.25
        ? 0.08
        : 0;
    const roll = Math.random();
    if (roll < state.eventChance - commsReduction + strainBonus) {
      triggeredEvent = pickContextualEvent(state.planetId, state);
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

  // Reset daily task check so astronauts can do fresh daily NASA inspections
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
    },
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
        shielding: state.resources.shielding,
      },
    ],
    activityLog: newLogs.slice(0, 25),
  };
}
