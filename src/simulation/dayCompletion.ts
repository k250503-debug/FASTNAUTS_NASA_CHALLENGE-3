import { ASTRONAUTS } from '../data/astronauts';
import type { MissionState } from '../types';

export interface DailyCompletionStatus {
  crewDoneCount: number;
  crewTotal: number;
  allCrewTasksDone: boolean;
  flueInspected: boolean;
  dataCollectedCount: number;
  dataTotal: number;
  allDataCollected: boolean;
  emergencyClear: boolean;
  completedObjectivesCount: number;
  totalObjectivesCount: number;
  allCompleted: boolean;
}

/**
 * Evaluates whether all required daily objectives, crew shifts, storm-flue inspection,
 * planetary data collection, and active emergencies are completed for the current day.
 */
export function getDailyCompletionStatus(state: MissionState): DailyCompletionStatus {
  const crewTotal = ASTRONAUTS.length;
  const crewDoneCount = ASTRONAUTS.filter(
    (astro) => Boolean(state.crewProgress[astro.id]?.currentTaskDone)
  ).length;
  const allCrewTasksDone = crewDoneCount >= crewTotal;

  const flueInspected = Boolean(state.stormFlue.inspectedToday);

  const dataTotal = state.dataNodes.length;
  const dataCollectedCount = state.dataNodes.filter((node) => node.collected).length;
  const allDataCollected = dataTotal === 0 || dataCollectedCount >= dataTotal;

  const emergencyClear = state.activeEvent === null;

  const totalObjectivesCount = crewTotal + 1 + dataTotal + (emergencyClear ? 0 : 1);
  const completedObjectivesCount =
    crewDoneCount + (flueInspected ? 1 : 0) + dataCollectedCount;

  const allCompleted =
    state.status === 'active' &&
    allCrewTasksDone &&
    flueInspected &&
    allDataCollected &&
    emergencyClear;

  return {
    crewDoneCount,
    crewTotal,
    allCrewTasksDone,
    flueInspected,
    dataCollectedCount,
    dataTotal,
    allDataCollected,
    emergencyClear,
    completedObjectivesCount,
    totalObjectivesCount,
    allCompleted,
  };
}

export function shouldTriggerStormScreen(prev: MissionState, next: MissionState): boolean {
  if (next.status !== 'active') return false;
  const evtId = next.activeEvent?.id;
  const isIncomingStormEvent =
    Boolean(next.activeEvent) &&
    next.activeEvent?.id !== prev.activeEvent?.id &&
    (next.activeEvent?.hazardSeverity === 'shelter' ||
      evtId === 'dust_storm' ||
      evtId === 'storm_flue_clog' ||
      evtId === 'cryo_plume' ||
      evtId === 'radiation_surge' ||
      evtId === 'europa_cryo_surge');
  const flueCrossedStorm =
    prev.stormFlue.cloggedPct < 65 && next.stormFlue.cloggedPct >= 65;

  return isIncomingStormEvent || flueCrossedStorm;
}
