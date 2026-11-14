import { ASTRONAUTS } from '../data/astronauts';
import type { EventChoice, MissionState, SparePartId } from '../types';

export function applyEngineeringDecision(state: MissionState, choice: EventChoice): MissionState {
  if (!state.activeEvent || !choice) return state;
  if (choice.requiresBudget && state.budget < choice.requiresBudget) return state;

  const outcome = choice.apply(state);
  const clamp = (val: number, max = 100) => Math.max(0, Math.min(max, Number(val.toFixed(1))));

  const nextOxygen = clamp(state.resources.oxygen.current + (outcome.oxygenDelta || 0));
  const nextWater = clamp(state.resources.water.current + (outcome.waterDelta || 0));
  const nextFood = clamp(state.resources.food.current + (outcome.foodDelta || 0));
  const nextBattery = Math.max(
    0,
    Math.min(
      state.resources.battery.max,
      Math.round(state.resources.battery.current + (outcome.batteryDelta || 0))
    )
  );
  const nextShielding = Math.min(95, state.resources.shielding + (outcome.shieldingDelta || 0));
  const nextExposure = clamp(state.crew.radiationExposure + (outcome.radiationDelta || 0), 100);
  const nextFuelCurrent = Math.max(
    0,
    Math.min(state.fuel.max, Math.round(state.fuel.current + (outcome.fuelDelta || 0)))
  );

  // Persistent building damage & dust updates
  let updatedBuildings = state.buildings.map((b) => ({
    ...b,
    dustPct: Math.min(100, (b.dustPct || 0) + (outcome.dustSpike || 0)),
  }));

  if (outcome.damageBuildingType) {
    const targetIdx =
      outcome.damageBuildingType === 'random'
        ? updatedBuildings.findIndex((b) => !b.damaged)
        : updatedBuildings.findIndex((b) => b.typeId === outcome.damageBuildingType);
    const idx = targetIdx >= 0 ? targetIdx : 0;
    if (updatedBuildings[idx]) {
      const target = updatedBuildings[idx];
      const dmg = outcome.damageAmount || 25;
      const requiredParts: Partial<Record<SparePartId, number>> = {};
      if (target.typeId === 'solar') {
        requiredParts.cables = 1;
        requiredParts.circuit_boards = 1;
      } else if (target.typeId === 'comms') {
        requiredParts.antenna_components = 1;
        requiredParts.cables = 1;
      } else if (target.typeId === 'water_recycler' || target.typeId === 'isru_plant') {
        requiredParts.filters = 1;
        requiredParts.seals = 1;
      } else {
        requiredParts.seals = 1;
        requiredParts.mechanical_parts = 1;
      }
      updatedBuildings[idx] = {
        ...target,
        conditionPct: Math.max(20, Math.round(target.conditionPct - dmg)),
        damaged: true,
        damageCause: outcome.damageCause || state.activeEvent.title,
        inspectedDamage: false,
        requiredParts,
      };
    }
  }

  // Persistent comms fault
  let nextComms = { ...state.comms };
  if (outcome.commsFault) {
    nextComms = {
      ...nextComms,
      fault: outcome.commsFault,
      repairStep: 'none',
      signalStrengthPct: Math.max(15, nextComms.signalStrengthPct - 42),
    };
  }

  // Persistent rover damage
  let nextRover = {
    ...state.rover,
    dustPct: Math.min(100, state.rover.dustPct + (outcome.dustSpike || 0)),
  };
  if (outcome.roverDamage) {
    nextRover = {
      ...nextRover,
      conditionPct: Math.max(25, nextRover.conditionPct - outcome.roverDamage),
      damaged: true,
    };
  }

  // Persistent medical alert
  const nextCrewVitals = { ...state.crewVitals };
  if (outcome.medicalAlertTarget) {
    const targetId =
      outcome.medicalAlertTarget.astronautId ||
      state.activeAstronautId ||
      ASTRONAUTS[0].id;
    nextCrewVitals[targetId] = {
      ...nextCrewVitals[targetId],
      medicalAlert: outcome.medicalAlertTarget.condition,
      diagnosed: false,
      healthPct: Math.max(45, nextCrewVitals[targetId].healthPct - 14),
      sheltered: false,
    };
  } else {
    // Clearing shelter alert restores sheltered flag
    (Object.keys(nextCrewVitals) as Array<keyof typeof nextCrewVitals>).forEach((k) => {
      nextCrewVitals[k] = { ...nextCrewVitals[k], sheltered: false };
    });
  }

  const isGood = choice.quality === 'good' || choice.quality === 'best';
  const metrics = { ...state.decisionMetrics };

  if (isGood) {
    metrics.goodDecisions += 1;
    if (choice.quality === 'best') {
      metrics.bestDecision = `Day ${state.day}: ${choice.label} (${state.activeEvent.title})`;
    }
  } else {
    metrics.riskyDecisions += 1;
    metrics.costliestMistake = `Day ${state.day}: ${choice.label} (${state.activeEvent.title})`;
  }

  return {
    ...state,
    budget: state.budget + (outcome.budgetDelta || 0),
    sciencePoints: state.sciencePoints + (outcome.scienceDelta || 0),
    buildings: updatedBuildings,
    comms: nextComms,
    rover: nextRover,
    crewVitals: nextCrewVitals,
    shelterRefugeActive: false,
    hazardWarningText: null,
    crew: {
      ...state.crew,
      radiationExposure: nextExposure,
    },
    fuel: {
      ...state.fuel,
      current: nextFuelCurrent,
    },
    lunarState: {
      ...state.lunarState,
      lunarDustPct:
        state.planetId === 'moon'
          ? Math.min(100, state.lunarState.lunarDustPct + (outcome.dustSpike || 0))
          : 0,
      micrometeoroidCount:
        state.activeEvent.id === 'micrometeoroid_impact'
          ? state.lunarState.micrometeoroidCount + 1
          : state.lunarState.micrometeoroidCount,
    },
    resources: {
      ...state.resources,
      oxygen: { ...state.resources.oxygen, current: nextOxygen },
      water: { ...state.resources.water, current: nextWater },
      food: { ...state.resources.food, current: nextFood },
      battery: { ...state.resources.battery, current: nextBattery },
      shielding: nextShielding,
    },
    techUpgrades: {
      ...state.techUpgrades,
      solarEfficiencyBonus: state.techUpgrades.solarEfficiencyBonus + (outcome.solarBoost || 0),
      waterEfficiencyBonus: state.techUpgrades.waterEfficiencyBonus + (outcome.waterBoost || 0),
    },
    decisionMetrics: metrics,
    eventHistory: [
      {
        day: state.day,
        eventTitle: state.activeEvent.title,
        choiceLabel: choice.label,
        quality: choice.quality,
      },
      ...state.eventHistory,
    ],
    activityLog: [
      {
        id: `dec-${state.day}-${Date.now()}`,
        day: state.day,
        time: '17:10',
        title: `Resolved: ${state.activeEvent.title}`,
        detail: outcome.log,
        severity: isGood ? 'info' : 'warning',
      },
      ...state.activityLog,
    ],
    activeEvent: null,
  };
}
