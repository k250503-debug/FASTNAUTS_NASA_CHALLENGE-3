import type { SystemTutorialItem } from '../types';

export const MISSION_SYSTEMS_TUTORIAL: SystemTutorialItem[] = [
  {
    id: 'oxygen',
    title: 'Oxygen (O₂)',
    summary:
      'Astronauts breathe oxygen continuously. Produced by Habitat scrubbers, Hydroponic Greenhouses, or Lunar Regolith Oxygen Extraction (ISRU).',
    scienceNote:
      'In real Lunar ISRU, oxygen makes up ~40–45% of lunar soil (regolith) by mass, chemically bound inside oxide minerals like ilmenite and silicates.',
    unitLabel: 'Closed-Loop Air',
  },
  {
    id: 'water',
    title: 'Water (H₂O)',
    summary:
      'Required for crew hydration, hygiene, and crop irrigation. Without closed-loop water recycling or ice mining, reserves drain rapidly.',
    scienceNote:
      'On the International Space Station, the Water Recovery System recycles ~98% of wastewater. At Shackleton Crater, permanently shadowed ice offers a local ISRU source.',
    unitLabel: 'Recovery & Ice Mining',
  },
  {
    id: 'food',
    title: 'Food & Greenhouses',
    summary:
      'Crew consumes daily rations. Hydroponic greenhouses grow fresh food and generate oxygen—but consume extra water and electricity.',
    scienceNote:
      'Core engineering trade-off: A greenhouse solves food shortages, yet increases water and power demand across the entire outpost.',
    unitLabel: 'Bio-Regeneration',
  },
  {
    id: 'power',
    title: 'Power & Batteries',
    summary:
      'Solar arrays generate electricity during sunlit phases. Battery storage keeps critical life-support systems alive when sunlight drops.',
    scienceNote:
      'Mars receives less sunlight than Earth and experiences dust storms, while the Moon undergoes shadowed periods—making battery storage essential.',
    unitLabel: 'Energy Balance (kWh)',
  },
  {
    id: 'radiation',
    title: 'Radiation Shielding',
    summary:
      'Passive protection against solar particle events and cosmic rays. Shielding is not consumed daily; it reduces how much radiation reaches the crew.',
    scienceNote:
      'Earth’s magnetic field and dense atmosphere block harmful space radiation. On the Moon and Mars, sintered regolith and shelters provide vital mass shielding.',
    unitLabel: 'Passive Armor (%)',
  },
];
