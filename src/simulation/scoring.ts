import type { LearningBadge, MissionReportData, MissionState } from '../types';

export function evaluateMissionReport(state: MissionState): MissionReportData {
  const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const crewBase = (state.crew.safe / state.crew.total) * 100;
  const radPenalty = state.crew.radiationExposure * 0.45;
  const crewSafety = clamp100(crewBase - radPenalty + (state.resources.shielding >= 50 ? 10 : 0));

  const dataCollectedCount = Object.values(state.crewProgress).reduce(
    (s, p) => s + p.dataCollected,
    0
  );
  const flueClearedCount = Object.values(state.crewProgress).reduce(
    (s, p) => s + p.stormFluesCleared,
    0
  );

  const decisionBonus =
    state.decisionMetrics.goodDecisions * 8 - state.decisionMetrics.riskyDecisions * 10;
  const resourceEfficiency = clamp100(
    state.resources.oxygen.current * 0.72 +
      15 +
      decisionBonus +
      Math.min(12, dataCollectedCount * 3)
  );

  const batteryPct = (state.resources.battery.current / state.resources.battery.max) * 100;
  const energyManagement = clamp100(
    batteryPct * 0.7 + 25 + state.techUpgrades.solarEfficiencyBonus * 40 + flueClearedCount * 3
  );

  const waterFoodAvg = (state.resources.water.current + state.resources.food.current) / 2;
  const sustainability = clamp100(
    waterFoodAvg * 0.9 + 10 + state.techUpgrades.waterEfficiencyBonus * 30
  );

  const progressPct = (state.day / state.maxDays) * 100;
  const missionObjectives =
    state.status === 'won'
      ? 100
      : clamp100(progressPct * 0.75 + Math.min(20, dataCollectedCount * 4));

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
      { metric: 'Crew Safety', score: crewSafety, weight: '25%' },
      { metric: 'Resource & Data', score: resourceEfficiency, weight: '20%' },
      { metric: 'Energy & Flue Ops', score: energyManagement, weight: '20%' },
      { metric: 'Water & Food', score: sustainability, weight: '20%' },
      { metric: 'Mission Objectives', score: missionObjectives, weight: '15%' },
    ],
    radiationScore: clamp100(
      state.resources.shielding + (100 - state.crew.radiationExposure) * 0.2
    ),
    badges,
  };
}
