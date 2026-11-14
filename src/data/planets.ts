import type { DifficultyConfig, MissionLengthOption, PlanetConfig, PlanetId } from '../types';
import moonOrbitalImg from '../assets/images/planet_moon_card_1794552137347.jpg';
import marsOrbitalImg from '../assets/images/planet_mars_card_1794552136773.jpg';

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    subtitle: 'Easier, more resources',
    description:
      'Generous construction budget, lower daily crew consumption, and fewer emergencies. Ideal for first-time commanders.',
    budget: 1450,
    consumptionMultiplier: 0.85,
    eventChance: 0.2,
    accentTone: 'emerald',
  },
  {
    id: 'engineer',
    name: 'Engineer',
    subtitle: 'Balanced challenge',
    description:
      'Realistic engineering trade-offs between solar cycles, ISRU production, spare parts, and crew safety.',
    budget: 1150,
    consumptionMultiplier: 1.0,
    eventChance: 0.32,
    accentTone: 'sky',
  },
  {
    id: 'commander',
    name: 'Commander',
    subtitle: 'More difficult constraints',
    description:
      'Tight budget, demanding crew survival rates, and frequent planetary hazards. Every credit and spare part counts.',
    budget: 900,
    consumptionMultiplier: 1.2,
    eventChance: 0.44,
    accentTone: 'amber',
  },
];

export const MISSION_LENGTHS: MissionLengthOption[] = [
  { days: 15, label: '15 Days', note: 'Quick Demo / Sprint' },
  { days: 30, label: '30 Days', note: 'Standard Expedition' },
  { days: 45, label: '45 Days', note: 'Extended Endurance' },
];

export const PLANETS: PlanetConfig[] = [
  {
    id: 'moon',
    name: 'The Moon',
    bodyType: 'Moon',
    missionCode: 'Mission 001 · Artemis Lunar South Pole',
    operationName: 'Operation Moonrise',
    location: 'Shackleton Crater Rim',
    difficultyLabel: 'Standard · 1.62 m/s² Gravity',
    summary:
      'Establish a lunar ISRU outpost at the South Pole. Explore Permanently Shadowed Regions (PSRs) for water ice, manage Earth comms windows, survive solar eclipses, and clear fine electrostatic lunar dust.',
    nasaGoal: 'Extract PSR crater water ice, weather lunar solar eclipses, and mitigate micrometeoroid & dust damage.',
    conditions: [
      'Surface gravity: 1.62 m/s² (0.165g — high parabolic EVA leaps)',
      'Hard vacuum · -170°C to +120°C thermal swings (-230°C inside PSRs)',
      'Earth horizon line-of-sight governs deep-space communications',
      'Periodic solar eclipses dim sunlight and drop solar power sharply',
    ],
    challenges: [
      'Fine electrostatic lunar dust coats solar arrays, airlocks, suits, and storm flues',
      'Micrometeoroid impacts and solar flares require shelter refuge & post-event repairs',
    ],
    imageUrl: moonOrbitalImg,
    accent: 'sky',
    solarEfficiency: 1.0,
    radiationHazard: 1.15,
    gravityMs2: 1.62,
    atmosphereKpa: 0,
    tempRangeC: '-170°C to +120°C',
    roamingRadius: 24,
    resupplyDays: 1,
  },
  {
    id: 'mars',
    name: 'Mars',
    bodyType: 'Planet',
    missionCode: 'Mission 002 · Jezero Crater Expedition',
    operationName: 'Operation Red Horizon',
    location: 'Jezero Crater Basin',
    difficultyLabel: 'Advanced · 3.71 m/s² Gravity',
    summary:
      'Operate humanity’s Martian surface base among layered canyon mesas. Sustain hydroponic crops, extract subsurface brine ice, and shelter crew through massive iron-oxide dust storms.',
    nasaGoal: 'Withstand global dust storms, keep air scrubbers/flues clear, and run closed-loop ISRU.',
    conditions: [
      'Surface gravity: 3.71 m/s² (0.378g — crisp, faster ballistics & jumps)',
      'Thin CO₂ atmosphere (~0.65 kPa) · Average -63°C desert chill',
      'Iron-oxide dust storms trigger refuge alerts & solar degradation',
      'Subsurface water-ice veins & perchlorate regolith assays',
    ],
    challenges: [
      'Multi-day dust buildup damages arrays, rovers & storm flues',
      'Earth resupply takes days — workshop spare-parts fabrication is critical',
    ],
    imageUrl: marsOrbitalImg,
    accent: 'amber',
    solarEfficiency: 0.78,
    radiationHazard: 1.0,
    gravityMs2: 3.71,
    atmosphereKpa: 0.65,
    tempRangeC: '-125°C to +20°C',
    roamingRadius: 24,
    resupplyDays: 3,
  },
  {
    id: 'titan',
    name: 'Titan',
    bodyType: 'Moon',
    missionCode: 'Mission 003 · Saturnian Moon Dragonfly',
    operationName: 'Operation Golden Haze',
    location: 'Shangri-La Dune Field & Methane Shore',
    difficultyLabel: 'Specialist · 1.35 m/s² Gravity',
    summary:
      'Operate beneath Titan’s dense golden nitrogen-methane skies beside liquid hydrocarbon seas. Pilot Dragonfly aerial drone surveys while combating cryogenic freezing and methane rain squalls.',
    nasaGoal: 'Survey liquid methane shoreline via drone & rover while preventing cryogenic equipment freezes.',
    conditions: [
      'Surface gravity: 1.35 m/s² (0.138g — buoyant, aerodynamic air-damped leaps)',
      'Dense 145 kPa N₂-CH₄ atmosphere · Cryogenic -179°C',
      'Liquid methane/ethane seas and hydrocarbon tholin dunes',
      'Methane rain squalls & heavy golden haze reduce solar irradiance',
    ],
    challenges: [
      'Low sunlight requires battery banks, RTG/fuel cells, and heat management',
      'Sensor contamination, frozen valves & cryogenic seals require spare parts',
    ],
    accent: 'amber',
    solarEfficiency: 0.55,
    radiationHazard: 0.75,
    gravityMs2: 1.35,
    atmosphereKpa: 145,
    tempRangeC: '-183°C to -176°C',
    roamingRadius: 24,
    resupplyDays: 5,
  },
  {
    id: 'europa',
    name: 'Europa',
    bodyType: 'Moon',
    missionCode: 'Mission 004 · Jovian Ice World',
    operationName: 'Operation Ice Horizon',
    location: 'Conamara Chaos Fractured Crust',
    difficultyLabel: 'Expert · 1.31 m/s² Gravity',
    summary:
      'Land on Jupiter’s fractured icy ocean moon with towering banded Jupiter overhead. Drill subsurface brine pockets with robotic cryo-probes while sheltering crew from intense Jovian radiation surges.',
    nasaGoal: 'Conduct sterile subsurface ocean drilling & survive Jovian magnetosphere radiation belts.',
    conditions: [
      'Surface gravity: 1.31 m/s² (0.134g — highest jump arcs in solar system)',
      'Fractured water-ice chaos terrain with glowing tectonic lineae cracks',
      'Cryogenic -160°C vacuum surface with active cryo-vapor plumes',
      'Towering Jupiter radiation belts & sample sterilization protocols',
    ],
    challenges: [
      'Intense radiation spikes force rapid shelter refuge & battery-thermal heating',
      'Cryo-drill jams and icy frost require workshop parts & post-surge repairs',
    ],
    accent: 'cyan',
    solarEfficiency: 0.62,
    radiationHazard: 1.45,
    gravityMs2: 1.31,
    atmosphereKpa: 0.001,
    tempRangeC: '-220°C to -160°C',
    roamingRadius: 24,
    resupplyDays: 5,
  },
];

export const getPlanetById = (id: PlanetId): PlanetConfig =>
  PLANETS.find((p) => p.id === id) || PLANETS[0];
