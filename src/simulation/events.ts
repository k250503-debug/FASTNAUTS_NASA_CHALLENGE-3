import type { MissionEvent, MissionState, PlanetId } from '../types';

export const MISSION_EVENTS: MissionEvent[] = [
  {
    id: 'storm_flue_clog',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Storm Flue Exhaust Obstruction',
    description:
      'Fine particulate dust and condensate frost have choked the primary outpost Storm Flue, spiking backpressure on habitat air scrubbers.',
    scienceQuestion: 'Why does an off-world outpost rely on a Storm Flue?',
    scienceExplanation:
      'Habitats, ISRU kilns, and electrolysis rigs vent waste heat, excess CO₂, and trace gases through filtered storm flues. Dust, ice, or dense hydrocarbon haze can clog the flue, forcing life-support fans to draw extra power.',
    choices: [
      {
        id: 'abubakr_manual_purge',
        label: 'Dispatch crew EVA to purge Storm Flue vents',
        impactSummary: '-6 kWh Battery · Clears Flue Clog to 0%',
        shortTerm: 'Restores full atmospheric exhaust flow immediately.',
        longTerm: 'Keeps habitat air scrubbers running at peak efficiency.',
        quality: 'best',
        apply: () => ({
          batteryDelta: -6,
          oxygenDelta: 4,
          log: 'EVA crew purged the Storm Flue exhaust manifold; pressure nominal.',
        }),
      },
      {
        id: 'thermal_blowback',
        label: 'Fire automated thermal blowback heater (35 CR)',
        impactSummary: '-35 CR · +5 Oxygen · +5 Science',
        shortTerm: 'Melts ice/condensate and clears vents without EVA risk.',
        longTerm: 'Preserves crew energy while logging thermal telemetry.',
        quality: 'best',
        requiresBudget: 35,
        apply: () => ({
          budgetDelta: -35,
          oxygenDelta: 5,
          scienceDelta: 5,
          log: 'Automated thermal blowback cleared Storm Flue frost and dust.',
        }),
      },
      {
        id: 'throttle_venting',
        label: 'Throttle air scrubbers to reduce flue pressure',
        impactSummary: '0 CR · -9 Oxygen',
        shortTerm: 'Saves credits and power today.',
        longTerm: 'Lowers cabin oxygen reserves.',
        quality: 'risky',
        apply: () => ({
          oxygenDelta: -9,
          log: 'Throttled scrubbers instead of clearing Storm Flue; oxygen dipped.',
        }),
      },
    ],
  },
  {
    id: 'solar_disruption',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Solar Power Disruption',
    description:
      'Solar panel generation dropped sharply today due to crater shadow, atmospheric haze, or surface frost. Your greenhouse and water recycler need steady electricity.',
    scienceQuestion: 'Why is solar energy unstable across planets and moons?',
    scienceExplanation:
      'The Moon has 14-day nights and crater shadows; Mars suffers dust storms; Titan’s thick orange haze blocks over 90% of sunlight; and Europa orbits 5.2× farther from the Sun than Earth.',
    choices: [
      {
        id: 'battery_reserve',
        label: 'Switch to battery reserves',
        impactSummary: '-18 kWh Battery · Keeps all systems at 100%',
        shortTerm: 'Greenhouse and water recycling run uninterrupted.',
        longTerm: 'Leaves less stored energy if low sunlight continues tomorrow.',
        quality: 'good',
        apply: () => ({
          batteryDelta: -18,
          log: 'Switched to battery reserves to maintain life-support continuity.',
        }),
      },
      {
        id: 'shed_load',
        label: 'Reduce non-essential power usage',
        impactSummary: '+10 kWh Battery saved · -4 Food output',
        shortTerm: 'Protects oxygen and water pumps by dimming grow lights.',
        longTerm: 'Small dip in daily food replenishment.',
        quality: 'good',
        apply: () => ({
          batteryDelta: 10,
          foodDelta: -4,
          log: 'Throttled greenhouse lighting to safeguard oxygen and water loops.',
        }),
      },
      {
        id: 'priority_maintenance',
        label: 'Prioritize solar array maintenance (50 CR)',
        impactSummary: '-50 CR · +12 kWh Battery · +5% Solar Tech',
        shortTerm: 'Astronauts clean and realign photovoltaic panels immediately.',
        longTerm: 'Permanently boosts solar capture efficiency across the mission.',
        quality: 'best',
        requiresBudget: 50,
        apply: () => ({
          budgetDelta: -50,
          batteryDelta: 12,
          solarBoost: 0.05,
          log: 'Crew cleaned and realigned solar arrays (+5% permanent solar output).',
        }),
      },
    ],
  },
  {
    id: 'water_pump_glitch',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Water Recycling Valve Malfunction',
    description:
      'Mineral scale and cryogenic condensate clogged a filtration valve in the Water Recycling loop, cutting daily recovery.',
    scienceQuestion: 'Why does water recycling require high-precision engineering?',
    scienceExplanation:
      'Launching 1 liter of water from Earth costs thousands of dollars. Closed-loop filtration must purify cabin humidity, hygiene water, and urine back to drinking grade—so valve fouling rapidly threatens crew and crops.',
    choices: [
      {
        id: 'flush_bypass',
        label: 'Run automated high-pressure backflush',
        impactSummary: '-8 kWh Battery · -5 Water · Restores loop',
        shortTerm: 'Clears the blockage without spending mission credits.',
        longTerm: 'Consumes a modest amount of stored water and power.',
        quality: 'good',
        apply: () => ({
          batteryDelta: -8,
          waterDelta: -5,
          log: 'Executed high-pressure backflush to clear the water filtration valve.',
        }),
      },
      {
        id: 'replace_cartridge',
        label: 'Install spare ceramic filter cartridge (45 CR)',
        impactSummary: '-45 CR · +6 Water recovered · +5% Water Tech',
        shortTerm: 'Immediate gain in purified water reserves.',
        longTerm: 'Improves recycling efficiency for the rest of the expedition.',
        quality: 'best',
        requiresBudget: 45,
        apply: () => ({
          budgetDelta: -45,
          waterDelta: 6,
          waterBoost: 0.05,
          log: 'Installed spare ceramic filtration cartridge (+5% water recovery efficiency).',
        }),
      },
      {
        id: 'delay_repair',
        label: 'Delay repair until next cycle',
        impactSummary: '0 CR now · -12 Water lost',
        shortTerm: 'Preserves credits and battery power today.',
        longTerm: 'Significant water loss stresses crew rations and greenhouse irrigation.',
        quality: 'risky',
        apply: () => ({
          waterDelta: -12,
          log: 'Delayed water valve repair; loop leakage drained 12 water units.',
        }),
      },
    ],
  },
  {
    id: 'solar_flare',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Radiation Belt / Solar Particle Surge',
    description:
      'Space weather telemetry detected a surge in high-energy charged particles sweeping across your outpost.',
    scienceQuestion: 'Why do astronauts need radiation shielding?',
    scienceExplanation:
      'Earth’s magnetic field and thick atmosphere deflect harmful solar particles and cosmic rays. Without them on the Moon, Mars, or inside Jupiter’s radiation belts around Europa, mass shielding and shelters are vital.',
    choices: [
      {
        id: 'shelter_protocol',
        label: 'Order crew into sheltered habitat quarters',
        impactSummary: '-4 Food · -5 Radiation Risk',
        shortTerm: 'Halts outdoor tasks while keeping astronauts protected indoors.',
        longTerm: 'Prevents acute radiation exposure.',
        quality: 'best',
        apply: () => ({
          foodDelta: -4,
          radiationDelta: -5,
          log: 'Crew sheltered indoors during radiation surge with zero injuries.',
        }),
      },
      {
        id: 'regolith_reinforce',
        label: 'Deploy rover to sinter surface shielding (40 CR)',
        impactSummary: '-40 CR · -6 kWh Battery · +8% Shielding',
        shortTerm: 'Uses local planetary material (ISRU) as radiation armor.',
        longTerm: 'Permanently increases base radiation shielding by 8%.',
        quality: 'best',
        requiresBudget: 40,
        apply: () => ({
          budgetDelta: -40,
          batteryDelta: -6,
          shieldingDelta: 8,
          radiationDelta: -4,
          log: 'ISRU rover reinforced habitat roof shielding (+8% shielding).',
        }),
      },
      {
        id: 'continue_normal',
        label: 'Continue normal EVA operations',
        impactSummary: '0 CR · +14 Radiation Risk',
        shortTerm: 'Keeps surface work running without pause.',
        longTerm: 'Substantially raises cumulative crew radiation exposure.',
        quality: 'risky',
        apply: () => ({
          radiationDelta: 14,
          log: 'Crew remained on surface shift during radiation surge; exposure increased.',
        }),
      },
    ],
  },
  {
    id: 'dust_storm',
    planets: ['mars', 'titan'],
    title: 'Atmospheric Storm Front',
    description:
      'Dense atmospheric particulates and gusts are hammering external solar arrays and testing storm flue filtration seals.',
    scienceQuestion: 'How do planetary storms affect outpost engineering?',
    scienceExplanation:
      'On Mars, fine iron-oxide dust darkens the sky for days and clogs filters. On Titan, dense nitrogen winds carry hydrocarbon aerosols that coat instruments and challenge thermal management.',
    choices: [
      {
        id: 'seal_and_conserve',
        label: 'Activate storm power-saving protocol',
        impactSummary: '-10 kWh Battery · +4 Oxygen saved',
        shortTerm: 'Seals airlocks and stabilizes cabin pressure.',
        longTerm: 'Minimal long-term penalty during storm clearance.',
        quality: 'good',
        apply: () => ({
          batteryDelta: -10,
          oxygenDelta: 4,
          log: 'Sealed airlocks and activated atmospheric storm power conservation.',
        }),
      },
      {
        id: 'electrostatic_clean',
        label: 'Trigger electrostatic dust-clearing pulse (35 CR)',
        impactSummary: '-35 CR · +14 kWh Battery restored',
        shortTerm: 'Repels charged particles from solar cells and flue intakes.',
        longTerm: 'Keeps photovoltaic efficiency high.',
        quality: 'best',
        requiresBudget: 35,
        apply: () => ({
          budgetDelta: -35,
          batteryDelta: 14,
          log: 'Electrostatic shields cleared storm particulates from solar arrays.',
        }),
      },
    ],
  },
  {
    id: 'isru_breakthrough',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'ISRU & Planetary Data Breakthrough',
    description:
      'Your astronauts discovered an optimized thermal extraction profile from local planetary core samples.',
    scienceQuestion: 'Why is ISRU essential for permanent Moon, Mars & outer-moon bases?',
    scienceExplanation:
      'Every kilogram launched from Earth requires huge rocket propellant. Producing oxygen, water, and shielding directly from local regolith or ice dramatically reduces mission mass and enables deep-space exploration.',
    choices: [
      {
        id: 'apply_oxygen',
        label: 'Route yield to Oxygen & Water tanks',
        impactSummary: '+8 Oxygen · +8 Water · +15 Science',
        shortTerm: 'Immediate boost to critical life-support reserves.',
        longTerm: 'Accelerates future lab technology unlocks.',
        quality: 'best',
        apply: () => ({
          oxygenDelta: 8,
          waterDelta: 8,
          scienceDelta: 15,
          log: 'Applied ISRU extraction breakthrough: +8 Oxygen, +8 Water, +15 SCI.',
        }),
      },
      {
        id: 'publish_grant',
        label: 'Transmit telemetry to NASA Science Directorate',
        impactSummary: '+90 CR Mission Grant · +20 Science',
        shortTerm: 'Unlocks emergency operations funding.',
        longTerm: 'Funds future module upgrades or crisis repairs.',
        quality: 'good',
        apply: () => ({
          budgetDelta: 90,
          scienceDelta: 20,
          log: 'Received +90 CR NASA grant and +20 SCI for planetary data breakthrough.',
        }),
      },
    ],
  },
];

export function pickContextualEvent(planetId: PlanetId, state: MissionState): MissionEvent {
  const eligible = MISSION_EVENTS.filter((e) => e.planets.includes(planetId));

  if (state.stormFlue.cloggedPct >= 55 && Math.random() < 0.55) {
    const flueEvt = eligible.find((e) => e.id === 'storm_flue_clog');
    if (flueEvt) return flueEvt;
  }

  const batteryRatio = state.resources.battery.current / state.resources.battery.max;
  if (batteryRatio < 0.3 && Math.random() < 0.5) {
    const solar = eligible.find((e) => e.id === 'solar_disruption');
    if (solar) return solar;
  }
  if (state.resources.water.current < 40 && Math.random() < 0.45) {
    const waterEvt = eligible.find((e) => e.id === 'water_pump_glitch');
    if (waterEvt) return waterEvt;
  }
  if (state.resources.shielding < 40 && Math.random() < 0.45) {
    const radEvt = eligible.find((e) => e.id === 'solar_flare');
    if (radEvt) return radEvt;
  }

  return eligible[Math.floor(Math.random() * eligible.length)];
}
