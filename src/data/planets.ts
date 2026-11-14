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
    budget: 1300,
    consumptionMultiplier: 0.85,
    eventChance: 0.2,
    accentTone: 'emerald',
  },
  {
    id: 'engineer',
    name: 'Engineer',
    subtitle: 'Balanced challenge',
    description:
      'Realistic engineering trade-offs between solar cycles, ISRU production, and crew safety.',
    budget: 1000,
    consumptionMultiplier: 1.0,
    eventChance: 0.32,
    accentTone: 'sky',
  },
  {
    id: 'commander',
    name: 'Commander',
    subtitle: 'More difficult constraints',
    description:
      'Tight budget, demanding crew survival rates, and frequent planetary hazards. Every credit counts.',
    budget: 800,
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
    difficultyLabel: 'Standard · Artemis Priority',
    summary:
      'Establish a lunar ISRU outpost at the South Pole. Affan and Ali lead polar water-ice drilling and solar-peak power storage.',
    nasaGoal: 'Verify lunar regolith oxygen extraction and survive shadowed crater cycles.',
    conditions: [
      'Extreme temperature swings (-170°C to +120°C)',
      'Vacuum environment — zero breathable atmosphere',
      'Solar power depends on crater-rim illumination',
      'High cosmic radiation — mass shielding required',
    ],
    challenges: [
      'Lunar shadowed phases drop solar generation to 30%',
      'Fine electrostatic regolith clogs airlocks and storm flues',
    ],
    imageUrl: moonOrbitalImg,
    accent: 'sky',
    solarEfficiency: 1.0,
    radiationHazard: 1.15,
  },
  {
    id: 'mars',
    name: 'Mars',
    bodyType: 'Planet',
    missionCode: 'Mission 002 · Jezero Crater Expedition',
    operationName: 'Operation Red Horizon',
    location: 'Jezero Crater Basin',
    difficultyLabel: 'Advanced · Dust Storm World',
    summary:
      'Operate humanity’s Martian surface base. Abubakr and Jawwad maintain storm-flue air filtration, greenhouses, and closed-loop water.',
    nasaGoal: 'Maintain storm-flue pressure and sustain hydroponic crops through dust storms.',
    conditions: [
      'Regional iron-oxide dust storms darken skies',
      'Thin CO₂ atmosphere (~0.6 kPa surface pressure)',
      'Cold desert climate averaging -63°C',
      'Subsurface water-ice extraction required',
    ],
    challenges: [
      'Dust buildup clogs storm flues and dims solar panels',
      'Earth resupply takes months — ISRU autonomy is critical',
    ],
    imageUrl: marsOrbitalImg,
    accent: 'amber',
    solarEfficiency: 0.78,
    radiationHazard: 1.0,
  },
  {
    id: 'titan',
    name: 'Titan',
    bodyType: 'Moon',
    missionCode: 'Mission 003 · Saturnian Moon Dragonfly',
    operationName: 'Operation Golden Haze',
    location: 'Shangri-La Dune Field',
    difficultyLabel: 'Specialist · Cryogenic Moon',
    summary:
      'Explore Saturn’s largest moon beneath thick nitrogen-methane skies. Ammar leads cryogenic telemetry and hydrocarbon dune sampling while monitoring frozen storm flues.',
    nasaGoal: 'Collect organic tholin & hydrocarbon data while managing dense atmospheric flues.',
    conditions: [
      'Dense nitrogen atmosphere (145 kPa, 1.45× Earth)',
      'Cryogenic surface temperature (-179°C)',
      'Very low solar irradiance (orange hydrocarbon haze)',
      'Liquid methane lakes and organic sand dunes',
    ],
    challenges: [
      'Thick haze sharply cuts solar output — battery management vital',
      'Cryogenic methane condensates freeze storm flue vents',
    ],
    accent: 'amber',
    solarEfficiency: 0.55,
    radiationHazard: 0.75,
  },
  {
    id: 'europa',
    name: 'Europa',
    bodyType: 'Moon',
    missionCode: 'Mission 004 · Jovian Ice World',
    operationName: 'Operation Ice Horizon',
    location: 'Conamara Chaos Ice Crust',
    difficultyLabel: 'Expert · Extreme Radiation',
    summary:
      'Land on Jupiter’s ice-covered ocean moon. Om leads radiation belt shielding while the crew samples cryovolcanic water plumes.',
    nasaGoal: 'Protect crew from Jovian radiation and sample subsurface ocean plume vents.',
    conditions: [
      'Fractured water-ice crust over a global ocean',
      'Intense Jovian magnetosphere radiation belts',
      'Cryogenic -160°C vacuum surface',
      'Active water-vapor plume vents for ISRU sampling',
    ],
    challenges: [
      'High radiation demands strong shelters and frequent monitoring',
      'Cryo-plume frost rapidly coats storm flues and solar arrays',
    ],
    accent: 'cyan',
    solarEfficiency: 0.62,
    radiationHazard: 1.45,
  },
];

export const getPlanetById = (id: PlanetId): PlanetConfig =>
  PLANETS.find((p) => p.id === id) || PLANETS[0];
