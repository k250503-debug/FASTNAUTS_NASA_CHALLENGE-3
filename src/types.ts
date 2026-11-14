export type ScreenId =
  | 'landing'
  | 'setup'
  | 'planet'
  | 'briefing'
  | 'builder'
  | 'launch'
  | 'storm'
  | 'mission'
  | 'emergency'
  | 'report';

export type DifficultyId = 'explorer' | 'engineer' | 'commander';
export type PlanetId = 'moon' | 'mars' | 'titan' | 'europa';

export type AstronautId = 'abubakr' | 'affan' | 'ali' | 'jawwad' | 'om' | 'ammar';

export type SuitPartId = 'helmet' | 'chest_pack' | 'plss_backpack' | 'arms_tools' | 'boots';

export interface AstronautProfile {
  id: AstronautId;
  name: string;
  role: string;
  assignedWorldId: PlanetId;
  assignedWorldName: string;
  nasaRequirement: string;
  taskTitle: string;
  taskDescription: string;
  specialtyBonus: string;
  suitColor: string;
  accentHex: number;
  startX: number;
  startZ: number;
}

export interface AstronautProgress {
  tasksCompleted: number;
  dataCollected: number;
  stormFluesCleared: number;
  currentTaskDone: boolean;
  lastAction: string;
}

export interface StormFlueState {
  cloggedPct: number;
  pressureKpa: number;
  exhaustTempC: number;
  inspectedToday: boolean;
  status: 'nominal' | 'warning' | 'critical';
}

export interface PlanetaryDataNode {
  id: string;
  label: string;
  worldId: PlanetId;
  x: number;
  z: number;
  collected: boolean;
  reading: string;
  scienceValue: number;
  summary: string;
}

export type BuildingTypeId =
  | 'habitat'
  | 'solar'
  | 'battery'
  | 'water_recycler'
  | 'greenhouse'
  | 'isru_plant'
  | 'radiation_shelter'
  | 'comms';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  subtitle: string;
  description: string;
  budget: number;
  consumptionMultiplier: number;
  eventChance: number;
  accentTone: 'emerald' | 'sky' | 'amber';
}

export interface MissionLengthOption {
  days: number;
  label: string;
  note: string;
}

export interface PlanetConfig {
  id: PlanetId;
  name: string;
  bodyType: 'Moon' | 'Planet';
  missionCode: string;
  operationName: string;
  location: string;
  difficultyLabel: string;
  summary: string;
  nasaGoal: string;
  conditions: string[];
  challenges: string[];
  imageUrl?: string;
  accent: 'sky' | 'amber' | 'cyan' | 'emerald';
  solarEfficiency: number;
  radiationHazard: number;
}

export interface SystemTutorialItem {
  id: 'oxygen' | 'water' | 'food' | 'power' | 'radiation';
  title: string;
  summary: string;
  scienceNote: string;
  unitLabel: string;
}

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  shortName: string;
  category: string;
  cost: number;
  powerReq: number;
  powerGen?: number;
  waterReq: number;
  produces: {
    oxygen: number;
    water: number;
    food: number;
  };
  shieldingBonus: number;
  batteryBonus: number;
  maxPerBase: number;
  required: boolean;
  benefit: string;
  tradeOff: string;
  upgradeCost: number;
}

export interface PlacedBuilding {
  uid: string;
  typeId: BuildingTypeId;
  level: number;
  online: boolean;
  cellIndex: number;
}

export interface MissionConfig {
  playerName: string;
  difficulty: DifficultyId;
  missionDays: number;
  planetId: PlanetId;
}

export interface DecisionOutcome {
  oxygenDelta?: number;
  waterDelta?: number;
  foodDelta?: number;
  batteryDelta?: number;
  budgetDelta?: number;
  scienceDelta?: number;
  shieldingDelta?: number;
  radiationDelta?: number;
  solarBoost?: number;
  waterBoost?: number;
  log: string;
}

export interface EventChoice {
  id: string;
  label: string;
  impactSummary: string;
  shortTerm: string;
  longTerm: string;
  quality: 'best' | 'good' | 'risky';
  requiresBudget?: number;
  apply: (state: MissionState) => DecisionOutcome;
}

export interface MissionEvent {
  id: string;
  planets: PlanetId[];
  title: string;
  description: string;
  scienceQuestion: string;
  scienceExplanation: string;
  choices: EventChoice[];
}

export interface DailyRates {
  oxygenProd: number;
  oxygenCons: number;
  waterProd: number;
  waterCons: number;
  foodProd: number;
  foodCons: number;
  powerGen: number;
  powerUsed: number;
  solarCondition: string;
}

export interface DaySnapshot {
  day: number;
  oxygen: number;
  water: number;
  food: number;
  powerPct: number;
  shielding: number;
}

export interface ActivityLogEntry {
  id: string;
  day: number;
  time: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface EventHistoryEntry {
  day: number;
  eventTitle: string;
  choiceLabel: string;
  quality: 'best' | 'good' | 'risky';
}

export interface MissionState {
  day: number;
  maxDays: number;
  planetId: PlanetId;
  planetName: string;
  operationName: string;
  playerName: string;
  difficulty: DifficultyId;
  consumptionMultiplier: number;
  eventChance: number;
  budget: number;
  sciencePoints: number;
  status: 'active' | 'won' | 'failed';
  failureReason: string | null;
  activeAstronautId: AstronautId;
  crewProgress: Record<AstronautId, AstronautProgress>;
  stormFlue: StormFlueState;
  dataNodes: PlanetaryDataNode[];
  visitedWorlds: PlanetId[];
  crew: {
    total: number;
    safe: number;
    radiationExposure: number;
  };
  resources: {
    oxygen: { current: number; max: number };
    water: { current: number; max: number };
    food: { current: number; max: number };
    battery: { current: number; max: number };
    shielding: number;
  };
  techUpgrades: {
    waterEfficiencyBonus: number;
    solarEfficiencyBonus: number;
    cropYieldBonus: number;
  };
  buildings: PlacedBuilding[];
  activeEvent: MissionEvent | null;
  eventHistory: EventHistoryEntry[];
  decisionMetrics: {
    goodDecisions: number;
    riskyDecisions: number;
    bestDecision: string;
    costliestMistake: string;
  };
  lastRates: DailyRates;
  history: DaySnapshot[];
  activityLog: ActivityLogEntry[];
}

export interface ScoreBreakdownItem {
  metric: string;
  score: number;
  weight: string;
}

export interface LearningBadge {
  title: string;
  desc: string;
}

export interface MissionReportData {
  totalScore: number;
  breakdown: ScoreBreakdownItem[];
  radiationScore: number;
  badges: LearningBadge[];
}
