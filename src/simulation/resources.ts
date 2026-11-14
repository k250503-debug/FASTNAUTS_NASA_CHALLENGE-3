import { ASTRONAUTS } from '../data/astronauts';
import { DIFFICULTIES, getPlanetById } from '../data/planets';
import { getBuildingDef } from '../data/buildings';
import type {
  AstronautCustomization,
  AstronautId,
  AstronautProgress,
  AstronautVitalState,
  BuildingTypeId,
  ConstructionMaterialId,
  EquipmentId,
  MissionConfig,
  MissionState,
  PlacedBuilding,
  PlanetaryDataNode,
  PlanetId,
  PlantedFlagState,
  SparePartId,
} from '../types';

export function createDefaultCrewCustomizations(
  overrides?: Partial<Record<AstronautId, AstronautCustomization>>
): Record<AstronautId, AstronautCustomization> {
  return ASTRONAUTS.reduce((acc, astro, idx) => {
    const existing = overrides?.[astro.id];
    acc[astro.id] = existing || {
      suitDesign: idx % 3 === 0 ? 'artemis_eva' : idx % 3 === 1 ? 'tactical_recon' : 'cryo_heavy',
      helmetStyle: idx === 0 ? 'gold_reflective' : idx % 2 === 0 ? 'gold_reflective' : 'tinted_obsidian',
      primaryColorHex: 0xd9e0e8,
      accentColorHex: astro.accentHex,
      backpackStyle:
        astro.id === 'om' || astro.id === 'jawwad'
          ? 'science_pack'
          : astro.id === 'abubakr'
          ? 'dual_thruster'
          : 'plss_standard',
    };
    return acc;
  }, {} as Record<AstronautId, AstronautCustomization>);
}

export const SAVE_STORAGE_KEY = 'astra_saved_mission_v2';

export function makePlacedBuilding(
  uid: string,
  typeId: BuildingTypeId,
  cellIndex: number,
  level = 1
): PlacedBuilding {
  return {
    uid,
    typeId,
    level,
    online: true,
    cellIndex,
    conditionPct: 100,
    dustPct: 0,
    damaged: false,
    damageCause: null,
    inspectedDamage: false,
    requiredParts: {},
  };
}

export function normalizePlacedBuilding(b: Partial<PlacedBuilding> & { uid: string; typeId: BuildingTypeId; cellIndex: number }): PlacedBuilding {
  return {
    uid: b.uid,
    typeId: b.typeId,
    level: b.level ?? 1,
    online: b.online ?? true,
    cellIndex: b.cellIndex,
    conditionPct: b.conditionPct ?? 100,
    dustPct: b.dustPct ?? 0,
    damaged: b.damaged ?? false,
    damageCause: b.damageCause ?? null,
    inspectedDamage: b.inspectedDamage ?? false,
    requiredParts: b.requiredParts ?? {},
  };
}

export function getWorldDataNodes(planetId: PlanetId): PlanetaryDataNode[] {
  const templates: Record<PlanetId, Omit<PlanetaryDataNode, 'worldId' | 'collected'>[]> = {
    moon: [
      {
        id: 'moon-psr-ice',
        label: 'Shackleton PSR Ice Core',
        x: -14.8,
        z: -13.2,
        reading: '5.4% H₂O Ice inside PSR · -226°C',
        scienceValue: 22,
        summary: 'Permanently Shadowed Region core confirms harvestable polar water ice for fuel & life support.',
      },
      {
        id: 'moon-ilmenite',
        label: 'Ilmenite Oxide Vein',
        x: 14.2,
        z: -10.5,
        reading: '42.6% Bound Oxygen · FeTiO₃',
        scienceValue: 16,
        summary: 'High-titanium basalt ideal for molten regolith oxygen extraction.',
      },
      {
        id: 'moon-seismic',
        label: 'Lunar Seismic Station',
        x: -15.5,
        z: 7.5,
        reading: '0.2 mm/s Tidal Quake',
        scienceValue: 14,
        summary: 'Subsurface stability verified for permanent habitat anchoring.',
      },
      {
        id: 'moon-rad',
        label: 'Solar Wind Dosimeter',
        x: 11.2,
        z: 14.5,
        reading: '1.38 mSv/day Cosmic Flux',
        scienceValue: 15,
        summary: 'Confirms sintered regolith thickness needed for crew radiation safety.',
      },
      {
        id: 'moon-dust',
        label: 'Electrostatic Dust Mast',
        x: 0.5,
        z: -15.8,
        reading: 'Charge: +18 V/m at Terminator',
        scienceValue: 16,
        summary: 'Tracks levitated lunar dust affecting solar arrays, suits & storm flue seals.',
      },
    ],
    mars: [
      {
        id: 'mars-delta',
        label: 'Jezero Clay Outcrop',
        x: -14.5,
        z: -11.5,
        reading: 'Smectite Clay · Ancient Lakebed',
        scienceValue: 18,
        summary: 'Hydrated minerals preserve organic biosignature clues and bound water.',
      },
      {
        id: 'mars-subsurface',
        label: 'Subsurface Brine Radar',
        x: 14.0,
        z: -11.0,
        reading: '1.4m Depth · Perchlorate Ice',
        scienceValue: 18,
        summary: 'Subsurface water table mapped for ISRU purification.',
      },
      {
        id: 'mars-barometer',
        label: 'Dust Storm Anemometer',
        x: -16.0,
        z: 8.0,
        reading: '0.65 kPa CO₂ · 24 m/s Gusts',
        scienceValue: 15,
        summary: 'Predicts dust opacity spikes for solar arrays and storm flues.',
      },
      {
        id: 'mars-moxie',
        label: 'CO₂ Electrolysis Rig',
        x: 11.8,
        z: 14.2,
        reading: '95.3% CO₂ Intake · 10g/hr O₂',
        scienceValue: 16,
        summary: 'Converts Martian atmosphere directly into breathable oxygen.',
      },
      {
        id: 'mars-soil',
        label: 'Regolith Nutrient Assay',
        x: 0.0,
        z: -16.0,
        reading: '0.5% Perchlorate · Wash Req.',
        scienceValue: 15,
        summary: 'Determines soil washing needed before hydroponic crop integration.',
      },
    ],
    titan: [
      {
        id: 'titan-dunes',
        label: 'Tholin Dune Spectrometer',
        x: -14.0,
        z: -11.0,
        reading: 'Complex Nitriles · -179°C',
        scienceValue: 20,
        summary: 'Prebiotic organic dunes analyzed for carbon-nitrogen chemistry.',
      },
      {
        id: 'titan-methane',
        label: 'Methane Lake Shoreline Probe',
        x: -10.2,
        z: 11.4,
        reading: '78% CH₄ / 22% C₂H₆ Shore Mix',
        scienceValue: 22,
        summary: 'Liquid hydrocarbon shore sampled for propellant and prebiotic astrobiology.',
      },
      {
        id: 'titan-atmo',
        label: 'Haze Pressure Mast',
        x: 14.5,
        z: -10.0,
        reading: '146.7 kPa N₂ · Dense Aerosol',
        scienceValue: 16,
        summary: 'Calibrates storm flue exhaust backpressure against Titan’s dense air.',
      },
      {
        id: 'titan-cryo',
        label: 'Water-Ice Bedrock Core',
        x: 12.2,
        z: 13.8,
        reading: '99.1% Frozen H₂O Rock',
        scienceValue: 18,
        summary: 'Titan’s bedrock is hard water ice—primary source for outpost O₂.',
      },
      {
        id: 'titan-wind',
        label: 'Dragonfly Wind Profiler',
        x: 0.8,
        z: -15.5,
        reading: '1.2 m/s Equatorial Breeze',
        scienceValue: 17,
        summary: 'Confirms safe flight corridors for Dragonfly rotorcraft aerial surveys.',
      },
    ],
    europa: [
      {
        id: 'europa-plume',
        label: 'Cryovolcanic Plume Vent',
        x: -13.5,
        z: -12.5,
        reading: 'H₂O Vapor + NaCl Salts',
        scienceValue: 22,
        summary: 'Direct sampling of subsurface ocean material erupted through the ice crust.',
      },
      {
        id: 'europa-rad',
        label: 'Jovian Radiation Array',
        x: 14.2,
        z: -10.5,
        reading: '5.4 Sv/day Magnetosphere Peak',
        scienceValue: 18,
        summary: 'Tracks Jupiter’s intense radiation belts to schedule sheltered work windows.',
      },
      {
        id: 'europa-ice',
        label: 'Chaos Terrain Ice Drill',
        x: -15.5,
        z: 7.5,
        reading: 'Sulfuric Frost · -163°C',
        scienceValue: 18,
        summary: 'Measures oxidant levels along glowing tectonic lineae ridges.',
      },
      {
        id: 'europa-radar',
        label: 'Ice-Penetrating Radar',
        x: 11.8,
        z: 14.2,
        reading: 'Ocean Pocket at 3.2 km Depth',
        scienceValue: 20,
        summary: 'Maps warm liquid brine lenses beneath Conamara Chaos.',
      },
      {
        id: 'europa-mag',
        label: 'Induced Magnetometer',
        x: 0.0,
        z: -16.0,
        reading: 'Conductive Ocean Signature',
        scienceValue: 16,
        summary: 'Confirms global salty ocean salinity under the icy shell.',
      },
    ],
  };

  return templates[planetId].map((t) => ({
    ...t,
    worldId: planetId,
    collected: false,
    sampleAnalyzed: false,
  }));
}

export function createDefaultFlagsByWorld(defaultWorld: PlanetId): Record<PlanetId, PlantedFlagState> {
  const mk = (planetId: PlanetId, planted: boolean): PlantedFlagState => ({
    planted,
    planetId,
    x: 8.6,
    z: 8.2,
    siteLabel: 'Outpost Perimeter Overlook',
    plantedBy: 'abubakr',
    day: 1,
  });
  return {
    moon: mk('moon', defaultWorld === 'moon'),
    mars: mk('mars', defaultWorld === 'mars'),
    titan: mk('titan', defaultWorld === 'titan'),
    europa: mk('europa', defaultWorld === 'europa'),
  };
}

export function createInitialMissionState(
  config: MissionConfig,
  rawBuildings: PlacedBuilding[],
  remainingBudget: number
): MissionState {
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[1];
  const planet = getPlanetById(config.planetId);
  const placedBuildings = rawBuildings.map((b) => normalizePlacedBuilding(b));

  const batteryBonus = placedBuildings.reduce(
    (sum, b) => sum + (getBuildingDef(b.typeId)?.batteryBonus || 0),
    0
  );
  const maxBattery = 70 + batteryBonus;

  const initialShielding = Math.min(
    95,
    placedBuildings.reduce((sum, b) => sum + (getBuildingDef(b.typeId)?.shieldingBonus || 0), 0)
  );

  const initialBattery = Math.round(maxBattery * 0.92);
  const initialPowerPct = Math.round((initialBattery / maxBattery) * 100);

  const storageCount = placedBuildings.filter((b) => b.typeId === 'storage_depot').length;
  const sparePartBase =
    difficulty.id === 'explorer' ? 5 : difficulty.id === 'engineer' ? 4 : 3;
  const depotBonus = storageCount * 3;

  const spareParts: Record<SparePartId, number> = {
    cables: sparePartBase + depotBonus,
    filters: sparePartBase + depotBonus,
    batteries: Math.max(2, sparePartBase - 1 + depotBonus),
    seals: sparePartBase + depotBonus,
    circuit_boards: Math.max(2, sparePartBase - 1 + Math.floor(depotBonus * 0.7)),
    mechanical_parts: sparePartBase + depotBonus,
    antenna_components: Math.max(2, sparePartBase - 1 + Math.floor(depotBonus * 0.6)),
    repair_tools: Math.max(2, sparePartBase - 1 + depotBonus),
  };

  const materials: Record<ConstructionMaterialId, number> = {
    regolith_bricks: 10 + depotBonus * 2,
    alloys: 8 + depotBonus,
    cryo_insulation: 8 + depotBonus,
  };

  const crewProgress = ASTRONAUTS.reduce((acc, astro) => {
    acc[astro.id] = {
      tasksCompleted: 0,
      dataCollected: 0,
      stormFluesCleared: 0,
      currentTaskDone: false,
      lastAction: `Deployed to ${planet.name} outpost · Standing by for NASA checklist`,
    };
    return acc;
  }, {} as Record<AstronautId, AstronautProgress>);

  const crewVitals = ASTRONAUTS.reduce((acc, astro) => {
    acc[astro.id] = {
      healthPct: 98,
      fatiguePct: 10,
      hydrationPct: 94,
      radiationPct: 2,
      medicalAlert: null,
      diagnosed: false,
      sheltered: false,
    };
    return acc;
  }, {} as Record<AstronautId, AstronautVitalState>);

  const hasComms = placedBuildings.some((b) => b.typeId === 'comms');

  return {
    day: 1,
    maxDays: config.missionDays,
    planetId: planet.id,
    planetName: planet.name,
    operationName: planet.operationName,
    playerName: config.playerName,
    difficulty: difficulty.id,
    consumptionMultiplier: difficulty.consumptionMultiplier,
    eventChance: difficulty.eventChance,

    budget: remainingBudget,
    sciencePoints: 45,
    status: 'active',
    failureReason: null,

    activeAstronautId: config.selectedCommanderId || 'abubakr',
    crewProgress,
    crewVitals,
    stormFlue: {
      cloggedPct: 16,
      pressureKpa: planet.id === 'titan' ? 145 : planet.id === 'mars' ? 0.65 : 101.3,
      exhaustTempC: planet.id === 'titan' || planet.id === 'europa' ? -42 : 24,
      inspectedToday: false,
      status: 'nominal',
    },
    dataNodes: getWorldDataNodes(planet.id),
    visitedWorlds: [planet.id],
    flagsByWorld: createDefaultFlagsByWorld(planet.id),
    shelterRefugeActive: false,
    hazardWarningText: null,

    crew: {
      total: ASTRONAUTS.length,
      safe: ASTRONAUTS.length,
      radiationExposure: 0,
    },

    resources: {
      oxygen: { current: 86, max: 100 },
      water: { current: 82, max: 100 },
      food: { current: 85, max: 100 },
      battery: { current: initialBattery, max: maxBattery },
      shielding: initialShielding,
      medSupplies: (difficulty.id === 'explorer' ? 10 : difficulty.id === 'engineer' ? 8 : 6) + storageCount * 5,
    },

    fuel: {
      current: 78,
      max: 100,
      shipTankPct: 86,
      isruSynthesisRate: placedBuildings.some((b) => b.typeId === 'fuel_depot') ? 10 : 4,
      transitCost: 14,
      lastActionNote: 'Propellant tanks nominal · Refuel requires explicit confirmation.',
    },

    spareParts,
    materials,

    comms: {
      signalStrengthPct: hasComms ? 94 : 68,
      rangeKm:
        planet.id === 'moon'
          ? 384400
          : planet.id === 'mars'
          ? 225000000
          : planet.id === 'europa'
          ? 628300000
          : 1275000000,
      latencySec:
        planet.id === 'moon' ? 1.3 : planet.id === 'mars' ? 420 : planet.id === 'europa' ? 2100 : 4250,
      windowOpen: true,
      earthVisibilityPct: planet.id === 'moon' ? 92 : 85,
      fault: null,
      repairStep: 'none',
    },

    rover: {
      conditionPct: 98,
      chargePct: 92,
      dustPct: 4,
      damaged: false,
      manualControl: false,
    },

    toolsConditionPct: 98,
    pendingResupply: [],

    lunarState: {
      eclipseActive: false,
      eclipsePhasePct: 0,
      lunarDustPct: planet.id === 'moon' ? 12 : 0,
      psrIceDiscovered: false,
      micrometeoroidCount: 0,
    },

    roboticState: {
      titanDroneChargePct: 95,
      titanMethaneSampled: false,
      europaProbeDepthM: 0,
      europaSampleSterilized: false,
    },

    achievements: [],
    crewCustomizations: createDefaultCrewCustomizations(config.crewCustomizations),
    equipmentInventory: config.preselectedEquipment ? [...config.preselectedEquipment] : ['solar_array', 'solar_water_cycle'],

    techUpgrades: {
      waterEfficiencyBonus: 0,
      solarEfficiencyBonus: 0,
      cropYieldBonus: 0,
    },

    buildings: placedBuildings,
    activeEvent: null,
    eventHistory: [],
    decisionMetrics: {
      goodDecisions: 0,
      riskyDecisions: 0,
      bestDecision: `Balanced initial ${ASTRONAUTS.length}-astronaut outpost deployment.`,
      costliestMistake: 'None recorded.',
    },

    lastRates: {
      oxygenProd: 0,
      oxygenCons: 0,
      waterProd: 0,
      waterCons: 0,
      foodProd: 0,
      foodCons: 0,
      powerGen: 0,
      powerUsed: 0,
      fuelProd: 4,
      solarCondition:
        planet.id === 'moon'
          ? 'Peak Sunlight (100%)'
          : planet.id === 'mars'
          ? 'Martian Sun (80%)'
          : planet.id === 'titan'
          ? 'Haze Filtered (55%)'
          : 'Jovian Reflectance (62%)',
      tempC: planet.id === 'moon' ? -22 : planet.id === 'mars' ? -63 : planet.id === 'titan' ? -179 : -162,
    },

    history: [
      {
        day: 1,
        oxygen: 86,
        water: 82,
        food: 85,
        powerPct: initialPowerPct,
        fuelPct: 78,
        shielding: initialShielding,
      },
    ],

    activityLog: [
      {
        id: 'init-1',
        day: 1,
        time: '08:00',
        title: `${planet.operationName} Initialized`,
        detail: `Commander ${config.playerName} deployed 6 astronauts to ${planet.name} (${planet.gravityMs2} m/s²).`,
        severity: 'info',
      },
    ],
  };
}

export function grantAchievement(state: MissionState, id: string): MissionState {
  if (state.achievements.includes(id)) return state;
  return {
    ...state,
    achievements: [...state.achievements, id],
  };
}

export function saveMissionProgress(state: MissionState): void {
  try {
    if (typeof window === 'undefined') return;
    // Strip non-serializable Choice.apply functions if an activeEvent exists by preserving activeEvent.id
    const serializable = {
      ...state,
      activeEvent: null,
      savedEventId: state.activeEvent?.id || null,
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore storage quota or SSR errors silently
  }
}

export function loadSavedMission(): MissionState | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MissionState;
    if (!parsed || !parsed.planetId || !parsed.buildings) return null;
    parsed.buildings = parsed.buildings.map((b) => normalizePlacedBuilding(b));
    if (!parsed.crewCustomizations) {
      parsed.crewCustomizations = createDefaultCrewCustomizations();
    }
    if (!parsed.equipmentInventory) {
      parsed.equipmentInventory = ['solar_array', 'solar_water_cycle'];
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasSavedMission(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem(SAVE_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function clearSavedMission(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
