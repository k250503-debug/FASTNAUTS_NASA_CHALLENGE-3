export type ScreenId =
  | 'landing'
  | 'story'
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

export type SuitDesignId = 'artemis_eva' | 'tactical_recon' | 'cryo_heavy';
export type HelmetStyleId = 'gold_reflective' | 'tinted_obsidian' | 'clear_hud';
export type BackpackStyleId = 'plss_standard' | 'dual_thruster' | 'science_pack';

export interface AstronautCustomization {
  suitDesign: SuitDesignId;
  helmetStyle: HelmetStyleId;
  primaryColorHex: number;
  accentColorHex: number;
  backpackStyle: BackpackStyleId;
}

export type EquipmentId =
  | 'solar_array'
  | 'solar_water_cycle'
  | 'water_collector'
  | 'oxygen_generator'
  | 'exploration_rover'
  | 'comms_array'
  | 'science_spectrometer';

export type SparePartId =
  | 'cables'
  | 'filters'
  | 'batteries'
  | 'seals'
  | 'circuit_boards'
  | 'mechanical_parts'
  | 'antenna_components'
  | 'repair_tools';

export type ConstructionMaterialId = 'regolith_bricks' | 'alloys' | 'cryo_insulation';

export type MedicalConditionId = 'exhaustion' | 'dehydration' | 'illness' | 'suit_trauma';

export type CommsFaultId =
  | 'transceiver_board'
  | 'feed_horn_alignment'
  | 'coax_cable'
  | 'power_bus';

export type MiniGameKind =
  | 'circuit_patch'
  | 'antenna_align'
  | 'thermal_valve'
  | 'fuel_transfer';

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

export interface AstronautVitalState {
  healthPct: number;
  fatiguePct: number; // 0 = rested, 100 = exhausted
  hydrationPct: number; // 100 = hydrated, 0 = dehydrated
  radiationPct: number;
  medicalAlert: MedicalConditionId | null;
  diagnosed: boolean;
  sheltered: boolean;
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
  sampleAnalyzed?: boolean;
}

export type BuildingTypeId =
  | 'habitat'
  | 'solar'
  | 'battery'
  | 'water_recycler'
  | 'greenhouse'
  | 'isru_plant'
  | 'radiation_shelter'
  | 'comms'
  | 'medical_station'
  | 'workshop'
  | 'fuel_depot'
  | 'rover_garage'
  | 'research_lab'
  | 'storage_depot';

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
  gravityMs2: number;
  atmosphereKpa: number;
  tempRangeC: string;
  roamingRadius: number;
  resupplyDays: number;
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
  conditionPct: number;
  dustPct: number;
  damaged: boolean;
  damageCause: string | null;
  inspectedDamage: boolean;
  requiredParts: Partial<Record<SparePartId, number>>;
}

export interface MissionConfig {
  playerName: string;
  difficulty: DifficultyId;
  missionDays: number;
  planetId: PlanetId;
  selectedCommanderId?: AstronautId;
  crewCustomizations?: Partial<Record<AstronautId, AstronautCustomization>>;
  preselectedEquipment?: EquipmentId[];
}

export interface DecisionOutcome {
  oxygenDelta?: number;
  waterDelta?: number;
  foodDelta?: number;
  batteryDelta?: number;
  fuelDelta?: number;
  budgetDelta?: number;
  scienceDelta?: number;
  shieldingDelta?: number;
  radiationDelta?: number;
  solarBoost?: number;
  waterBoost?: number;
  damageBuildingType?: BuildingTypeId | 'random';
  damageAmount?: number;
  damageCause?: string;
  commsFault?: CommsFaultId;
  roverDamage?: number;
  medicalAlertTarget?: {
    astronautId?: AstronautId;
    condition: MedicalConditionId;
  };
  dustSpike?: number;
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
  requiresPart?: SparePartId;
  apply: (state: MissionState) => DecisionOutcome;
}

export interface MissionEvent {
  id: string;
  planets: PlanetId[];
  title: string;
  description: string;
  scienceQuestion: string;
  scienceExplanation: string;
  hazardSeverity?: 'info' | 'warning' | 'shelter';
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
  fuelProd: number;
  solarCondition: string;
  tempC: number;
}

export interface DaySnapshot {
  day: number;
  oxygen: number;
  water: number;
  food: number;
  powerPct: number;
  fuelPct: number;
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

export interface PlantedFlagState {
  planted: boolean;
  planetId: PlanetId;
  x: number;
  z: number;
  siteLabel: string;
  plantedBy: AstronautId;
  day: number;
}

export interface CommsSystemState {
  signalStrengthPct: number;
  rangeKm: number;
  latencySec: number;
  windowOpen: boolean;
  earthVisibilityPct: number;
  fault: CommsFaultId | null;
  repairStep: 'none' | 'inspected' | 'diagnosed' | 'parts_replaced' | 'tested';
}

export interface FuelSystemState {
  current: number;
  max: number;
  shipTankPct: number;
  isruSynthesisRate: number;
  transitCost: number;
  lastActionNote: string;
}

export interface RoverSystemState {
  conditionPct: number;
  chargePct: number;
  dustPct: number;
  damaged: boolean;
  manualControl: boolean;
}

export interface PendingResupplyOrder {
  id: string;
  arrivalDay: number;
  itemsSummary: string;
  parts: Partial<Record<SparePartId, number>>;
  medSupplies: number;
}

export interface LunarWorldState {
  eclipseActive: boolean;
  eclipsePhasePct: number;
  lunarDustPct: number;
  psrIceDiscovered: boolean;
  micrometeoroidCount: number;
}

export interface RoboticExplorationState {
  titanDroneChargePct: number;
  titanMethaneSampled: boolean;
  europaProbeDepthM: number;
  europaSampleSterilized: boolean;
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
  crewVitals: Record<AstronautId, AstronautVitalState>;
  stormFlue: StormFlueState;
  dataNodes: PlanetaryDataNode[];
  visitedWorlds: PlanetId[];
  flagsByWorld: Record<PlanetId, PlantedFlagState>;
  shelterRefugeActive: boolean;
  hazardWarningText: string | null;
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
    medSupplies: number;
  };
  fuel: FuelSystemState;
  spareParts: Record<SparePartId, number>;
  materials: Record<ConstructionMaterialId, number>;
  comms: CommsSystemState;
  rover: RoverSystemState;
  toolsConditionPct: number;
  pendingResupply: PendingResupplyOrder[];
  lunarState: LunarWorldState;
  roboticState: RoboticExplorationState;
  achievements: string[];
  crewCustomizations: Record<AstronautId, AstronautCustomization>;
  equipmentInventory: EquipmentId[];
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
