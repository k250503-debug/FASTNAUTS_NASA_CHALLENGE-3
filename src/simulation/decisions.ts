import type { EventChoice, MissionState } from '../types';

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
    crew: {
      ...state.crew,
      radiationExposure: nextExposure,
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
