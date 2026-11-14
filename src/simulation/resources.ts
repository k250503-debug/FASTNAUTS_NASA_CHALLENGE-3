import { ASTRONAUTS } from '../data/astronauts';
import { DIFFICULTIES, getPlanetById } from '../data/planets';
import { getBuildingDef } from '../data/buildings';
import type {
  AstronautId,
  AstronautProgress,
  MissionConfig,
  MissionState,
  PlacedBuilding,
  PlanetaryDataNode,
  PlanetId,
} from '../types';

export function getWorldDataNodes(planetId: PlanetId): PlanetaryDataNode[] {
  const templates: Record<PlanetId, Omit<PlanetaryDataNode, 'worldId' | 'collected'>[]> = {
    moon: [
      {
        id: 'moon-ice-core',
        label: 'Shackleton Ice Core',
        x: -11.5,
        z: -9.5,
        reading: '4.8% H₂O Ice by mass · -162°C',
        scienceValue: 18,
        summary: 'Shadowed crater regolith confirms harvestable polar water ice for electrolysis.',
      },
      {
        id: 'moon-ilmenite',
        label: 'Ilmenite Oxide Vein',
        x: 12.0,
        z: -8.0,
        reading: '42.6% Bound Oxygen · FeTiO₃',
        scienceValue: 16,
        summary: 'High-titanium basalt ideal for molten regolith oxygen extraction.',
      },
      {
        id: 'moon-seismic',
        label: 'Lunar Seismic Station',
        x: -13.0,
        z: 6.5,
        reading: '0.2 mm/s Tidal Quake',
        scienceValue: 14,
        summary: 'Subsurface stability verified for permanent habitat anchoring.',
      },
      {
        id: 'moon-rad',
        label: 'Solar Wind Dosimeter',
        x: 10.5,
        z: 9.0,
        reading: '1.38 mSv/day Cosmic Flux',
        scienceValue: 15,
        summary: 'Confirms sintered regolith thickness needed for crew radiation safety.',
      },
      {
        id: 'moon-dust',
        label: 'Electrostatic Dust Mast',
        x: 0.5,
        z: -13.5,
        reading: 'Charge: +18 V/m at Terminator',
        scienceValue: 15,
        summary: 'Tracks levitated lunar dust affecting storm flue & seal filters.',
      },
    ],
    mars: [
      {
        id: 'mars-delta',
        label: 'Jezero Clay Outcrop',
        x: -12.0,
        z: -9.0,
        reading: 'Smectite Clay · Ancient Lakebed',
        scienceValue: 18,
        summary: 'Hydrated minerals preserve organic biosignature clues and bound water.',
      },
      {
        id: 'mars-subsurface',
        label: 'Subsurface Brine Radar',
        x: 11.5,
        z: -9.5,
        reading: '1.4m Depth · Perchlorate Ice',
        scienceValue: 18,
        summary: 'Subsurface water table mapped for ISRU purification.',
      },
      {
        id: 'mars-barometer',
        label: 'Dust Storm Anemometer',
        x: -13.5,
        z: 7.0,
        reading: '0.64 kPa CO₂ · 24 m/s Gusts',
        scienceValue: 15,
        summary: 'Predicts dust opacity spikes for solar arrays and storm flues.',
      },
      {
        id: 'mars-moxie',
        label: 'CO₂ Electrolysis Rig',
        x: 12.0,
        z: 8.5,
        reading: '95.3% CO₂ Intake · 10g/hr O₂',
        scienceValue: 16,
        summary: 'Converts Martian atmosphere directly into breathable oxygen.',
      },
      {
        id: 'mars-soil',
        label: 'Regolith Nutrient Assay',
        x: 0.0,
        z: -13.5,
        reading: '0.5% Perchlorate · Wash Req.',
        scienceValue: 15,
        summary: 'Determines soil washing needed before hydroponic crop integration.',
      },
    ],
    titan: [
      {
        id: 'titan-dunes',
        label: 'Tholin Dune Spectrometer',
        x: -11.5,
        z: -9.0,
        reading: 'Complex Nitriles · -179°C',
        scienceValue: 20,
        summary: 'Prebiotic organic dunes analyzed for carbon-nitrogen chemistry.',
      },
      {
        id: 'titan-methane',
        label: 'Hydrocarbon Seep Probe',
        x: 12.0,
        z: -8.5,
        reading: '78% CH₄ / 22% C₂H₆ Mix',
        scienceValue: 18,
        summary: 'Liquid methane pool sampled for cryogenic propellant studies.',
      },
      {
        id: 'titan-atmo',
        label: 'Haze Pressure Mast',
        x: -12.5,
        z: 7.5,
        reading: '146.7 kPa N₂ · Dense Aerosol',
        scienceValue: 16,
        summary: 'Calibrates storm flue exhaust backpressure against Titan’s dense air.',
      },
      {
        id: 'titan-cryo',
        label: 'Water-Ice Bedrock Core',
        x: 11.0,
        z: 9.0,
        reading: '99.1% Frozen H₂O Rock',
        scienceValue: 18,
        summary: 'Titan’s bedrock is hard water ice—primary source for outpost O₂.',
      },
      {
        id: 'titan-wind',
        label: 'Dragonfly Wind Profiler',
        x: 0.5,
        z: -13.0,
        reading: '1.2 m/s Equatorial Breeze',
        scienceValue: 15,
        summary: 'Confirms safe flight corridors for rotorcraft data surveys.',
      },
    ],
    europa: [
      {
        id: 'europa-plume',
        label: 'Cryovolcanic Plume Vent',
        x: -11.0,
        z: -10.0,
        reading: 'H₂O Vapor + NaCl Salts',
        scienceValue: 22,
        summary: 'Direct sampling of subsurface ocean material erupted through the ice crust.',
      },
      {
        id: 'europa-rad',
        label: 'Jovian Radiation Array',
        x: 12.0,
        z: -8.0,
        reading: '5.4 Sv/day Magnetosphere Peak',
        scienceValue: 18,
        summary: 'Tracks Jupiter’s intense radiation belts to schedule sheltered work windows.',
      },
      {
        id: 'europa-ice',
        label: 'Chaos Terrain Ice Drill',
        x: -13.0,
        z: 6.5,
        reading: 'Sulfuric Frost · -163°C',
        scienceValue: 18,
        summary: 'Measures oxidant levels on Europa’s fractured surface ice.',
      },
      {
        id: 'europa-radar',
        label: 'Ice-Penetrating Radar',
        x: 11.5,
        z: 8.5,
        reading: 'Ocean Pocket at 3.2 km Depth',
        scienceValue: 20,
        summary: 'Maps warm liquid brine lenses beneath Conamara Chaos.',
      },
      {
        id: 'europa-mag',
        label: 'Induced Magnetometer',
        x: 0.0,
        z: -13.5,
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
  }));
}

export function createInitialMissionState(
  config: MissionConfig,
  placedBuildings: PlacedBuilding[],
  remainingBudget: number
): MissionState {
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[1];
  const planet = getPlanetById(config.planetId);

  const batteryBonus = placedBuildings.reduce(
    (sum, b) => sum + (getBuildingDef(b.typeId)?.batteryBonus || 0),
    0
  );
  const maxBattery = 60 + batteryBonus;

  const initialShielding = Math.min(
    95,
    placedBuildings.reduce((sum, b) => sum + (getBuildingDef(b.typeId)?.shieldingBonus || 0), 0)
  );

  const initialBattery = Math.round(maxBattery * 0.9);
  const initialPowerPct = Math.round((initialBattery / maxBattery) * 100);

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
    sciencePoints: 40,
    status: 'active',
    failureReason: null,

    activeAstronautId: 'abubakr',
    crewProgress,
    stormFlue: {
      cloggedPct: 18,
      pressureKpa: planet.id === 'titan' ? 145 : planet.id === 'mars' ? 0.65 : 101.3,
      exhaustTempC: planet.id === 'titan' || planet.id === 'europa' ? -42 : 24,
      inspectedToday: false,
      status: 'nominal',
    },
    dataNodes: getWorldDataNodes(planet.id),
    visitedWorlds: [planet.id],

    crew: {
      total: ASTRONAUTS.length,
      safe: ASTRONAUTS.length,
      radiationExposure: 0,
    },

    resources: {
      oxygen: { current: 85, max: 100 },
      water: { current: 80, max: 100 },
      food: { current: 85, max: 100 },
      battery: { current: initialBattery, max: maxBattery },
      shielding: initialShielding,
    },

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
      solarCondition:
        planet.id === 'moon'
          ? 'Peak Sunlight (100%)'
          : planet.id === 'mars'
          ? 'Martian Sun (80%)'
          : planet.id === 'titan'
          ? 'Haze Filtered (55%)'
          : 'Jovian Reflectance (62%)',
    },

    history: [
      {
        day: 1,
        oxygen: 85,
        water: 80,
        food: 85,
        powerPct: initialPowerPct,
        shielding: initialShielding,
      },
    ],

    activityLog: [
      {
        id: 'init-1',
        day: 1,
        time: '08:00',
        title: `${planet.operationName} Initialized`,
        detail: `Commander ${config.playerName} deployed Abubakr, Affan, Ali, Jawwad & Om to ${planet.name}.`,
        severity: 'info',
      },
    ],
  };
}
