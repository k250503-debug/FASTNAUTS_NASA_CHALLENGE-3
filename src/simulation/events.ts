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
    hazardSeverity: 'warning',
    choices: [
      {
        id: 'abubakr_manual_purge',
        label: 'Dispatch crew EVA to purge Storm Flue vents',
        impactSummary: '-6 kWh Battery · Clears Flue Clog · +4 Oxygen',
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
        impactSummary: '0 CR · -9 Oxygen · Risk of flue seal wear',
        shortTerm: 'Saves credits and power today.',
        longTerm: 'Lowers cabin oxygen reserves and strains habitat seals.',
        quality: 'risky',
        apply: () => ({
          oxygenDelta: -9,
          damageBuildingType: 'habitat',
          damageAmount: 14,
          damageCause: 'Backpressure seal stress from unpurged Storm Flue',
          log: 'Throttled scrubbers instead of clearing Storm Flue; oxygen dipped and habitat seals stressed.',
        }),
      },
    ],
  },
  {
    id: 'lunar_eclipse',
    planets: ['moon'],
    title: 'Lunar Solar Eclipse & Deep Freeze',
    description:
      'Earth passed directly between the Sun and Shackleton Crater Rim. Solar irradiance plunged to 14% while surface temperatures dropped toward -168°C.',
    scienceQuestion: 'Why are Lunar solar eclipses uniquely stressful for South Pole bases?',
    scienceExplanation:
      'Near the lunar South Pole, crater rims normally capture long periods of sunlight. During an eclipse, Earth’s umbra sweeps across the Moon, instantly halting photovoltaic output and causing rapid thermal contraction across exposed hardware.',
    hazardSeverity: 'warning',
    choices: [
      {
        id: 'eclipse_battery_heaters',
        label: 'Engage battery reserves & cryo-seal heaters',
        impactSummary: '-16 kWh Battery · Protects greenhouse & pipes from frost',
        shortTerm: 'Prevents thermal pipe freeze during Earth’s umbra shadow.',
        longTerm: 'Preserves full module condition after sunlight returns.',
        quality: 'best',
        apply: () => ({
          batteryDelta: -16,
          scienceDelta: 8,
          log: 'Maintained cryo-heaters on battery reserves throughout lunar eclipse.',
        }),
      },
      {
        id: 'eclipse_fuel_cell',
        label: 'Burn 10% ISRU Fuel Cell backup (-10 Fuel)',
        impactSummary: '-10 Fuel · +18 kWh Battery · Zero thermal damage',
        shortTerm: 'Propellant backup bridges the eclipse power trough.',
        longTerm: 'Tests closed-loop lunar fuel-cell contingency.',
        quality: 'best',
        apply: () => ({
          fuelDelta: -10,
          batteryDelta: 18,
          scienceDelta: 10,
          log: 'Fuel cell generator bridged lunar eclipse cleanly (+18 kWh).',
        }),
      },
      {
        id: 'eclipse_unheated',
        label: 'Cut cryo-heaters to hoard battery power',
        impactSummary: '+6 kWh Battery saved · Damages Water Recycler valve',
        shortTerm: 'Reduces battery drain during totality.',
        longTerm: 'Extreme thermal shock cracks exposed plumbing seals.',
        quality: 'risky',
        apply: () => ({
          batteryDelta: 6,
          damageBuildingType: 'water_recycler',
          damageAmount: 26,
          damageCause: 'Lunar eclipse cryogenic contraction (-168°C)',
          log: 'Unheated Water Recycler suffered cryogenic seal cracking during lunar eclipse.',
        }),
      },
    ],
  },
  {
    id: 'micrometeoroid_impact',
    planets: ['moon', 'europa'],
    title: 'Micrometeoroid & Secondary Ejecta Shower',
    description:
      'Orbital tracking flagged high-velocity hypervelocity debris crossing the landing sector. Exposed solar arrays and communication masts are at risk.',
    scienceQuestion: 'Why do airless worlds suffer unfiltered micrometeoroid impacts?',
    scienceExplanation:
      'Without a dense atmosphere to vaporize tiny sand-grain meteoroids, even millimeter-sized rocks strike the surface at 15–30 km/s, puncturing thin solar substrates and antenna feeds.',
    hazardSeverity: 'shelter',
    choices: [
      {
        id: 'shelter_shield_arrays',
        label: 'Order shelter refuge & feather solar panels edge-on',
        impactSummary: '-6 kWh Battery · Minimal array damage · Crew sheltered',
        shortTerm: 'Crew enters airlock/shelter; panels minimize cross-section.',
        longTerm: 'Minor dust kickup only; avoids heavy structural breach.',
        quality: 'best',
        apply: () => ({
          batteryDelta: -6,
          dustSpike: 12,
          radiationDelta: -2,
          log: 'Crew sheltered safely and feathered arrays through micrometeoroid stream.',
        }),
      },
      {
        id: 'emergency_patch_team',
        label: 'Shelter crew, assess impact crater & flag damaged mast',
        impactSummary: '-35 CR · Solar array damaged (-28% condition) · +10 Science',
        shortTerm: 'Inspects ejecta impact safely post-shower.',
        longTerm: 'Requires post-event Solar Array repair in Damage Control.',
        quality: 'good',
        requiresBudget: 35,
        apply: () => ({
          budgetDelta: -35,
          scienceDelta: 10,
          damageBuildingType: 'solar',
          damageAmount: 28,
          damageCause: 'Hypervelocity micrometeoroid puncture',
          log: 'Micrometeoroid shower punctured Solar Array Bus — flagged for EVA repair.',
        }),
      },
    ],
  },
  {
    id: 'comms_disruption',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Deep-Space Comms Uplink Disruption',
    description:
      'Ground telemetry lost Ka-band carrier lock. Signal strength dropped sharply due to feed-horn misalignment or RF transceiver fault.',
    scienceQuestion: 'How do astronauts restore disrupted deep-space communications?',
    scienceExplanation:
      'Off-world antennas require precise pointing toward Earth or orbital relays. Engineers inspect the antenna, diagnose whether the fault lies in electronics, cables, or feed horns, install verified spare parts, and run a signal sweep test.',
    hazardSeverity: 'warning',
    choices: [
      {
        id: 'flag_comms_repair',
        label: 'Isolate antenna & queue EVA Comms Repair workflow',
        impactSummary: 'Opens Comms Fault Diagnosis · Requires spare part repair',
        shortTerm: 'Prevents transmitter amplifier burnout.',
        longTerm: 'Open the Comms Station modal to inspect, replace parts & test signal.',
        quality: 'best',
        apply: () => ({
          commsFault: 'feed_horn_alignment',
          damageBuildingType: 'comms',
          damageAmount: 22,
          damageCause: 'Ka-band feed horn misalignment & RF attenuation',
          log: 'Comms antenna isolated — inspect fault & replace Antenna Components in Comms Station.',
        }),
      },
      {
        id: 'boost_transmitter',
        label: 'Overdrive backup S-band amplifier (-14 kWh)',
        impactSummary: '-14 kWh Battery · Transceiver fault persists',
        shortTerm: 'Maintains degraded voice link briefly.',
        longTerm: 'Burns out transceiver board requiring circuit_boards replacement.',
        quality: 'risky',
        apply: () => ({
          batteryDelta: -14,
          commsFault: 'transceiver_board',
          log: 'Overdriven amplifier burned transceiver board; Comms repair required.',
        }),
      },
    ],
  },
  {
    id: 'crew_medical_alert',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'EVA Crew Medical Alert',
    description:
      'Biomedical suit telemetry flagged an acute astronaut health alert after extended surface dust exposure and coolant loop strain.',
    scienceQuestion: 'Why does spaceflight medical triage require rapid diagnosis and treatment?',
    scienceExplanation:
      'Inside a pressurized suit, dehydration, overexertion, lunar/Martian fine particulate inhalation, or pressure strain rapidly reduce cognitive safety and crew survival if left untreated.',
    hazardSeverity: 'warning',
    choices: [
      {
        id: 'med_triage_now',
        label: 'Stand down EVA & route astronaut to Medical Bay',
        impactSummary: 'Logs Medical Alert for Crew Bay diagnosis & treatment',
        shortTerm: 'Halts physical strain cleanly.',
        longTerm: 'Visit Medical Bay to diagnose and treat with Medkits.',
        quality: 'best',
        apply: () => ({
          medicalAlertTarget: { condition: 'dehydration' },
          log: 'Astronaut routed to Medical Bay — open Medical Bay to diagnose & treat.',
        }),
      },
      {
        id: 'med_push_shift',
        label: 'Complete shift before returning to airlock',
        impactSummary: '+5 Science · Triggers acute Suit Trauma / Exhaustion alert',
        shortTerm: 'Finishes surface scan.',
        longTerm: 'Worsens crew vitals until treated at Medical Station.',
        quality: 'risky',
        apply: () => ({
          scienceDelta: 5,
          medicalAlertTarget: { condition: 'exhaustion' },
          log: 'Extended shift triggered EVA exhaustion alert — urgent Medical Bay care needed.',
        }),
      },
    ],
  },
  {
    id: 'solar_disruption',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Solar Power Disruption',
    description:
      'Solar generation dropped sharply today due to crater shadow, haze, or surface dust/frost coating photovoltaic arrays.',
    scienceQuestion: 'Why is solar energy unstable across planets and moons?',
    scienceExplanation:
      'The Moon experiences eclipses and polar shadows; Mars suffers dust storms; Titan’s dense orange haze dims sunlight by 90%; and Europa orbits 5.2× farther from the Sun than Earth.',
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
        id: 'priority_maintenance',
        label: 'Prioritize solar array cleaning & alignment (45 CR)',
        impactSummary: '-45 CR · +12 kWh Battery · +5% Solar Tech',
        shortTerm: 'Astronauts clean dust/frost off photovoltaic panels immediately.',
        longTerm: 'Permanently boosts solar capture efficiency across the mission.',
        quality: 'best',
        requiresBudget: 45,
        apply: () => ({
          budgetDelta: -45,
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
      'Closed-loop filtration purifies cabin humidity, hygiene water, and wastewater back to drinking grade—so valve fouling rapidly threatens crew hydration and greenhouse crops.',
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
        impactSummary: '0 CR now · -12 Water · Valve damaged',
        shortTerm: 'Preserves credits and battery power today.',
        longTerm: 'Damages water recycler seals requiring spare parts repair.',
        quality: 'risky',
        apply: () => ({
          waterDelta: -12,
          damageBuildingType: 'water_recycler',
          damageAmount: 24,
          damageCause: 'Cavitated filtration valve from delayed maintenance',
          log: 'Delayed water valve repair; loop leaked 12 water and damaged recycler.',
        }),
      },
    ],
  },
  {
    id: 'solar_flare',
    planets: ['moon', 'mars', 'titan', 'europa'],
    title: 'Radiation Belt / Solar Particle Surge',
    description:
      'Space weather telemetry detected high-energy charged particles sweeping across your outpost. Radiation shelter refuge activated!',
    scienceQuestion: 'Why do astronauts need radiation shielding?',
    scienceExplanation:
      'Without Earth’s strong magnetosphere and thick atmosphere, solar particle events and Jovian radiation belts deliver dangerous ionizing doses unless crews shelter behind high-mass walls.',
    hazardSeverity: 'shelter',
    choices: [
      {
        id: 'shelter_protocol',
        label: 'Hold crew inside shielded Radiation Shelter / Habitat',
        impactSummary: '-4 Food · -5 Radiation Risk · Crew safe',
        shortTerm: 'Halts outdoor tasks while keeping astronauts protected indoors.',
        longTerm: 'Prevents acute radiation sickness.',
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
        impactSummary: '0 CR · +14 Radiation Risk · Radiation illness risk',
        shortTerm: 'Keeps surface work running without pause.',
        longTerm: 'Substantially raises crew radiation exposure and triggers illness alert.',
        quality: 'risky',
        apply: () => ({
          radiationDelta: 14,
          medicalAlertTarget: { astronautId: 'om', condition: 'illness' },
          log: 'Crew remained outside during radiation surge; exposure jumped and medical alert flagged.',
        }),
      },
    ],
  },
  {
    id: 'dust_storm',
    planets: ['mars', 'titan'],
    title: 'Severe Atmospheric Dust / Methane Storm',
    description:
      'Dense storm fronts and gusts are hammering external solar arrays, rover bearings, and storm flue intakes. Astronauts instructed to take refuge!',
    scienceQuestion: 'How do planetary storms affect outpost engineering?',
    scienceExplanation:
      'On Mars, global iron-oxide dust darkens skies and abrades mechanical seals. On Titan, hydrocarbon methane squalls freeze unheated actuators and obscure visibility.',
    hazardSeverity: 'shelter',
    choices: [
      {
        id: 'seal_and_conserve',
        label: 'Seal airlocks, shelter crew & protect solar panels',
        impactSummary: '-10 kWh Battery · +4 Oxygen · Dust buildup +18%',
        shortTerm: 'Crew rides out storm inside habitat/spaceship doors.',
        longTerm: 'Minimal damage; arrays & rover will need dust cleaning afterward.',
        quality: 'best',
        apply: () => ({
          batteryDelta: -10,
          oxygenDelta: 4,
          dustSpike: 18,
          log: 'Crew took shelter safely; storm left dust coating on exterior hardware.',
        }),
      },
      {
        id: 'electrostatic_clean',
        label: 'Run storm electrostatic shields & structural braces (35 CR)',
        impactSummary: '-35 CR · +10 kWh Battery · Rover suspension stress',
        shortTerm: 'Protects main power grid while storm passes.',
        longTerm: 'Leaves minor exterior storm damage to rover or greenhouse for post-storm repair.',
        quality: 'good',
        requiresBudget: 35,
        apply: () => ({
          budgetDelta: -35,
          batteryDelta: 10,
          roverDamage: 22,
          dustSpike: 10,
          log: 'Electrostatic shields saved power bus; rover suspension requires post-storm inspection.',
        }),
      },
    ],
  },
  {
    id: 'europa_cryo_surge',
    planets: ['europa'],
    title: 'Europa Cryo-Plume Eruption & Radiation Spike',
    description:
      'Tidal flexing opened a nearby tectonic lineae fissure, venting supersonic vapor plumes while Jupiter’s magnetosphere surged.',
    scienceQuestion: 'Why must Europa drill teams enforce strict Planetary Protection?',
    scienceExplanation:
      'Europa harbors a subsurface saltwater ocean that could support life. NASA protocols require high-temperature sterilization of drills so Earth microbes never contaminate an alien biosphere.',
    hazardSeverity: 'shelter',
    choices: [
      {
        id: 'sterilize_and_shelter',
        label: 'Retract cryo-drill, sterilize probe & shelter crew',
        impactSummary: '-8 kWh Battery · +18 Science · Protects drill rig',
        shortTerm: 'Logs rare plume vapor sample safely from shelter.',
        longTerm: 'Zero contamination and minimal ice buildup.',
        quality: 'best',
        apply: () => ({
          batteryDelta: -8,
          scienceDelta: 18,
          dustSpike: 10,
          log: 'Sterilized cryo-probe and sampled plume from inside shielded shelter (+18 SCI).',
        }),
      },
      {
        id: 'force_plume_drill',
        label: 'Keep drill running through eruption',
        impactSummary: '+22 Science · Damages ISRU / Lab cryo-seals',
        shortTerm: 'Captures raw subsurface brine reading.',
        longTerm: 'Ice plume blast damages outpost ISRU hardware requiring repair.',
        quality: 'risky',
        apply: () => ({
          scienceDelta: 22,
          damageBuildingType: 'isru_plant',
          damageAmount: 30,
          damageCause: 'Supersonic cryo-plume blast on unshielded seals',
          log: 'Cryo-plume eruption damaged ISRU seals — repair in Damage Control.',
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
      'Every kilogram launched from Earth requires huge rocket propellant. Producing oxygen, water, fuel, and shielding from local regolith or ice dramatically reduces Earth dependency.',
    choices: [
      {
        id: 'apply_oxygen',
        label: 'Route yield to Oxygen, Water & Fuel tanks',
        impactSummary: '+8 Oxygen · +8 Water · +12 Fuel · +15 Science',
        shortTerm: 'Immediate boost to critical life-support and propellant reserves.',
        longTerm: 'Accelerates multi-world transit readiness.',
        quality: 'best',
        apply: () => ({
          oxygenDelta: 8,
          waterDelta: 8,
          fuelDelta: 12,
          scienceDelta: 15,
          log: 'Applied ISRU extraction breakthrough: +8 O₂, +8 H₂O, +12 Fuel, +15 SCI.',
        }),
      },
      {
        id: 'publish_grant',
        label: 'Transmit telemetry to NASA Science Directorate',
        impactSummary: '+95 CR Mission Grant · +20 Science',
        shortTerm: 'Unlocks emergency operations funding.',
        longTerm: 'Funds spare-parts resupply or module construction.',
        quality: 'good',
        apply: () => ({
          budgetDelta: 95,
          scienceDelta: 20,
          log: 'Received +95 CR NASA grant and +20 SCI for planetary data breakthrough.',
        }),
      },
    ],
  },
];

export function pickContextualEvent(planetId: PlanetId, state: MissionState): MissionEvent {
  const eligible = MISSION_EVENTS.filter((e) => e.planets.includes(planetId));

  if (planetId === 'moon' && state.lunarState.eclipseActive) {
    const eclipse = eligible.find((e) => e.id === 'lunar_eclipse');
    if (eclipse) return eclipse;
  }

  if (state.stormFlue.cloggedPct >= 55 && Math.random() < 0.5) {
    const flueEvt = eligible.find((e) => e.id === 'storm_flue_clog');
    if (flueEvt) return flueEvt;
  }

  const batteryRatio = state.resources.battery.current / state.resources.battery.max;
  if (batteryRatio < 0.3 && Math.random() < 0.45) {
    const solar = eligible.find((e) => e.id === 'solar_disruption');
    if (solar) return solar;
  }
  if (state.resources.water.current < 40 && Math.random() < 0.4) {
    const waterEvt = eligible.find((e) => e.id === 'water_pump_glitch');
    if (waterEvt) return waterEvt;
  }
  if (state.resources.shielding < 40 && Math.random() < 0.4) {
    const radEvt = eligible.find((e) => e.id === 'solar_flare');
    if (radEvt) return radEvt;
  }

  return eligible[Math.floor(Math.random() * eligible.length)];
}
