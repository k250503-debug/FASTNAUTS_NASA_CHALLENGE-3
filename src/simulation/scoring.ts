import type { LearningBadge, MissionReportData, MissionState } from '../types';

export function evaluateMissionReport(state: MissionState): MissionReportData {
  const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const crewBase = (state.crew.safe / state.crew.total) * 100;
  const radPenalty = state.crew.radiationExposure * 0.45;
  const avgCrewHealth =
    Object.values(state.crewVitals).reduce((sum, v) => sum + v.healthPct, 0) /
    Math.max(1, Object.keys(state.crewVitals).length);
  const crewSafety = clamp100(
    crewBase * 0.65 + avgCrewHealth * 0.35 - radPenalty + (state.resources.shielding >= 50 ? 10 : 0)
  );

  const dataCollectedCount = Object.values(state.crewProgress).reduce(
    (s, p) => s + p.dataCollected,
    0
  );
  const flueClearedCount = Object.values(state.crewProgress).reduce(
    (s, p) => s + p.stormFluesCleared,
    0
  );

  const undamagedBuildings = state.buildings.filter((b) => !b.damaged).length;
  const integrityRatio = undamagedBuildings / Math.max(1, state.buildings.length);

  const decisionBonus =
    state.decisionMetrics.goodDecisions * 8 - state.decisionMetrics.riskyDecisions * 10;
  const resourceEfficiency = clamp100(
    state.resources.oxygen.current * 0.62 +
      integrityRatio * 18 +
      decisionBonus +
      Math.min(12, dataCollectedCount * 3)
  );

  const batteryPct = (state.resources.battery.current / state.resources.battery.max) * 100;
  const fuelPct = (state.fuel.current / state.fuel.max) * 100;
  const energyManagement = clamp100(
    batteryPct * 0.55 +
      fuelPct * 0.2 +
      20 +
      state.techUpgrades.solarEfficiencyBonus * 40 +
      flueClearedCount * 3
  );

  const waterFoodAvg = (state.resources.water.current + state.resources.food.current) / 2;
  const sustainability = clamp100(
    waterFoodAvg * 0.85 +
      10 +
      state.techUpgrades.waterEfficiencyBonus * 30 +
      (state.comms.fault ? -8 : 5)
  );

  const progressPct = (state.day / state.maxDays) * 100;
  const flagsPlanted = Object.values(state.flagsByWorld).filter((f) => f.planted).length;
  const missionObjectives =
    state.status === 'won'
      ? 100
      : clamp100(
          progressPct * 0.68 +
            Math.min(20, dataCollectedCount * 4) +
            Math.min(12, flagsPlanted * 4)
        );

  const totalScore = clamp100(
    0.25 * crewSafety +
      0.2 * resourceEfficiency +
      0.2 * energyManagement +
      0.2 * sustainability +
      0.15 * missionObjectives
  );

  const badges: LearningBadge[] = [];
  if (flueClearedCount >= 1) {
    badges.push({
      title: 'Storm Flue Specialist',
      desc: 'Inspected and purged planetary storm flues to keep cabin air circulating.',
    });
  }
  if (dataCollectedCount >= 3) {
    badges.push({
      title: 'Planetary Data Pioneer',
      desc: `Collected ${dataCollectedCount} planetary surface data logs for NASA.`,
    });
  }
  if (state.visitedWorlds.length >= 2) {
    badges.push({
      title: 'Multi-World Commander',
      desc: `Led crew operations across ${state.visitedWorlds.length} planets & moons.`,
    });
  }
  if (state.achievements.includes('comms_restorer')) {
    badges.push({
      title: 'Deep-Space Signal Tech',
      desc: 'Diagnosed, repaired spare parts, and restored Earth comms lock.',
    });
  }
  if (state.achievements.includes('medical_savior')) {
    badges.push({
      title: 'Flight Surgeon',
      desc: 'Treated crew medical emergencies promptly in the Medical Bay.',
    });
  }
  if (state.achievements.includes('master_mechanic')) {
    badges.push({
      title: 'Outpost Reconstructor',
      desc: 'Rebuilt and restored storm or micrometeoroid module damage cleanly.',
    });
  }
  if (state.resources.water.current >= 60) {
    badges.push({
      title: 'Water Guardian',
      desc: 'Maintained healthy water reserves through closed-loop management.',
    });
  }
  if (state.status === 'won' && totalScore >= 80) {
    badges.push({
      title: 'NASA Mission Commander',
      desc: 'Guided Abubakr, Affan, Ali, Jawwad, Om & Ammar to mission success.',
    });
  }
  if (badges.length === 0) {
    badges.push({
      title: 'Survival Strategist',
      desc: 'Tested outpost resilience across interconnected space systems.',
    });
  }

  return {
    totalScore,
    breakdown: [
      { metric: 'Crew Health & Safety', score: crewSafety, weight: '25%' },
      { metric: 'Systems & Structural Integrity', score: resourceEfficiency, weight: '20%' },
      { metric: 'Energy, Fuel & Flue Ops', score: energyManagement, weight: '20%' },
      { metric: 'Water, Food & Comms', score: sustainability, weight: '20%' },
      { metric: 'Mission Objectives', score: missionObjectives, weight: '15%' },
    ],
    radiationScore: clamp100(
      state.resources.shielding + (100 - state.crew.radiationExposure) * 0.2
    ),
    badges,
  };
}
