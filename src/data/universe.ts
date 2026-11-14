import type { PlanetId } from '../types';

export type CelestialCategory =
  | 'star'
  | 'planet'
  | 'moon'
  | 'small_body'
  | 'satellite'
  | 'deep_space';

export interface CelestialBodyData {
  id: string;
  name: string;
  subtitle: string;
  category: CelestialCategory;
  shortDesc: string;
  playableWorldId?: PlanetId;

  // 3D scene placement & physics
  orbitRadius: number; // scene units from Sun (or parent body for moons/satellites)
  orbitSpeed: number; // rad/s at 1x speed
  orbitInclinationDeg: number;
  initialAngle: number;
  radius: number; // visual radius in scene units
  axialTiltDeg: number;
  spinSpeed: number;
  parentId?: string;
  focusDistance: number;
  accentColor: string;

  // Planet telemetry
  planetType?: string;
  avgDistanceSun?: string;
  diameter?: string;
  gravity?: string;
  orbitalPeriod?: string;
  rotationPeriod?: string;
  temperature?: string;
  atmosphere?: string;
  knownMoons?: string;
  scientificFacts?: string[];
  explorationHistory?: string;

  // Moon telemetry
  parentPlanet?: string;
  surfaceCharacteristics?: string;
  importantDiscoveries?: string;
  scientificInterest?: string;

  // Artificial satellite / station telemetry
  organization?: string;
  missionPurpose?: string;
  launchDate?: string;
  orbitType?: string;
  missionStatus?: string;
  scientificContribution?: string;

  // Star / Nebula / Galaxy telemetry
  classification?: string;
  distanceFromEarth?: string;
  scaleSize?: string;
  characteristics?: string;
}

export const UNIVERSE_BODIES: CelestialBodyData[] = [
  // ================= STAR =================
  {
    id: 'sun',
    name: 'The Sun',
    subtitle: 'Yellow Dwarf Main-Sequence Star',
    category: 'star',
    shortDesc:
      'The gravitational and radiative heart of our Solar System, converting 600 million tons of hydrogen into helium every second.',
    orbitRadius: 0,
    orbitSpeed: 0,
    orbitInclinationDeg: 0,
    initialAngle: 0,
    radius: 7.4,
    axialTiltDeg: 7.25,
    spinSpeed: 0.08,
    focusDistance: 21,
    accentColor: '#F59E0B',
    classification: 'G2V Main-Sequence Star',
    distanceFromEarth: '149.6 million km (1.00 AU)',
    scaleSize: '1,392,700 km diameter (109× Earth)',
    gravity: '274.0 m/s² (27.9g)',
    rotationPeriod: '25.05 days (equator)',
    temperature: '5,778 K surface · 15.7 million K core',
    atmosphere: '73.46% Hydrogen · 24.85% Helium · Solar Corona',
    importantDiscoveries:
      'Helioseismology, coronal mass ejections, and supersonic solar wind acceleration mapped up to 6.1 million km from the photosphere.',
    characteristics:
      'Contains 99.86% of all mass in the Solar System; magnetic flux loops drive prominences, sunspots, and space weather across every planetary orbit.',
    explorationHistory: 'SOHO, Solar Dynamics Observatory (SDO), Parker Solar Probe, Solar Orbiter.',
  },

  // ================= 8 PLANETS =================
  {
    id: 'mercury',
    name: 'Mercury',
    subtitle: 'Innermost Terrestrial World',
    category: 'planet',
    planetType: 'Terrestrial Planet',
    shortDesc:
      'A dense, heavily cratered metallic-core world locked in a 3:2 spin-orbit resonance beside the scorching solar corona.',
    orbitRadius: 15,
    orbitSpeed: 0.19,
    orbitInclinationDeg: 3.4,
    initialAngle: 0.7,
    radius: 1.05,
    axialTiltDeg: 0.03,
    spinSpeed: 0.14,
    focusDistance: 4.5,
    accentColor: '#94A3B8',
    avgDistanceSun: '57.9 million km (0.39 AU)',
    diameter: '4,879 km',
    gravity: '3.70 m/s²',
    orbitalPeriod: '87.97 Earth days',
    rotationPeriod: '58.65 Earth days',
    temperature: '-180°C (night) to +430°C (day)',
    atmosphere: 'Ultra-thin exosphere (O₂, Na, H₂, He, K)',
    knownMoons: '0',
    scientificFacts: [
      'Iron core spans roughly 85% of the planet’s radius, making it extraordinarily dense.',
      'Permanently shadowed polar craters harbor stable water-ice deposits despite blazing equatorial days.',
    ],
    explorationHistory: 'Mariner 10 (1974), MESSENGER orbiter (2011–2015), ESA/JAXA BepiColombo.',
  },
  {
    id: 'venus',
    name: 'Venus',
    subtitle: 'Super-Greenhouse Terrestrial World',
    category: 'planet',
    planetType: 'Terrestrial Planet',
    shortDesc:
      'Shrouded in golden-ivory sulfuric acid cloud decks and a crushing carbon-dioxide atmosphere hotter than lead’s melting point.',
    orbitRadius: 23,
    orbitSpeed: 0.135,
    orbitInclinationDeg: 1.9,
    initialAngle: 2.15,
    radius: 1.72,
    axialTiltDeg: 177.4,
    spinSpeed: -0.06,
    focusDistance: 6.4,
    accentColor: '#FBBF24',
    avgDistanceSun: '108.2 million km (0.72 AU)',
    diameter: '12,104 km',
    gravity: '8.87 m/s²',
    orbitalPeriod: '224.7 Earth days',
    rotationPeriod: '243.02 days (Retrograde)',
    temperature: '+464°C mean surface',
    atmosphere: '96.5% CO₂ · 3.5% N₂ · H₂SO₄ cloud layers (92 bar)',
    knownMoons: '0',
    scientificFacts: [
      'Rotates backwards (retrograde) so slowly that a Venusian sidereal day is longer than its year.',
      'Upper cloud decks at 50–55 km altitude maintain Earth-like pressure (1 bar) and ~20–40°C temperatures.',
    ],
    explorationHistory: 'Venera 7–14 landers, NASA Magellan radar mapper, Akatsuki, upcoming DAVINCI & VERITAS.',
  },
  {
    id: 'earth',
    name: 'Earth',
    subtitle: 'Oceanic Biosphere World',
    category: 'planet',
    planetType: 'Terrestrial Planet',
    shortDesc:
      'A dynamic nitrogen-oxygen world protected by a dipolar magnetosphere, liquid water oceans, and a stabilizing large moon.',
    orbitRadius: 33,
    orbitSpeed: 0.095,
    orbitInclinationDeg: 0,
    initialAngle: -0.65,
    radius: 1.85,
    axialTiltDeg: 23.44,
    spinSpeed: 0.55,
    focusDistance: 6.8,
    accentColor: '#38BDF8',
    avgDistanceSun: '149.6 million km (1.00 AU)',
    diameter: '12,742 km',
    gravity: '9.81 m/s²',
    orbitalPeriod: '365.25 days',
    rotationPeriod: '23h 56m 4s',
    temperature: '-89°C to +56°C (+15°C mean)',
    atmosphere: '78% N₂ · 21% O₂ · 0.93% Ar · Variable H₂O',
    knownMoons: '1 (The Moon)',
    scientificFacts: [
      'Only known world with active plate tectonics, liquid surface oceans covering 71% of its crust, and life.',
      'Its magnetic field deflects charged solar wind particles, preserving surface water and atmosphere.',
    ],
    explorationHistory: 'Earth-observing fleets (Landsat, Terra, Aqua, GRACE-FO) and orbital stations.',
  },
  {
    id: 'mars',
    name: 'Mars',
    subtitle: 'Iron-Oxide Desert Frontier',
    category: 'planet',
    planetType: 'Terrestrial Planet',
    playableWorldId: 'mars',
    shortDesc:
      'Ancient river deltas, canyon systems dwarfing Earth’s, and subsurface water-ice reserves beneath thin CO₂ skies.',
    orbitRadius: 45,
    orbitSpeed: 0.072,
    orbitInclinationDeg: 1.85,
    initialAngle: 0.92,
    radius: 1.38,
    axialTiltDeg: 25.19,
    spinSpeed: 0.5,
    focusDistance: 5.5,
    accentColor: '#F97316',
    avgDistanceSun: '227.9 million km (1.52 AU)',
    diameter: '6,779 km',
    gravity: '3.71 m/s²',
    orbitalPeriod: '687 Earth days',
    rotationPeriod: '24h 37m 22s',
    temperature: '-125°C to +20°C (-63°C mean)',
    atmosphere: '95.3% CO₂ · 2.6% N₂ · 1.9% Ar (0.65 kPa)',
    knownMoons: '2 (Phobos, Deimos)',
    scientificFacts: [
      'Olympus Mons rises 21.9 km above the Martian datum — nearly three times Mount Everest’s elevation.',
      'Jezero Crater preserves an ancient lakebed delta rich in hydrated smectite clays and carbonates.',
    ],
    explorationHistory: 'Viking 1 & 2, Pathfinder, Spirit, Opportunity, Curiosity, Perseverance, Ingenuity, MRO.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    subtitle: 'King of the Gas Giants',
    category: 'planet',
    planetType: 'Gas Giant',
    shortDesc:
      'A colossal banded hydrogen-helium giant crowned by the Great Red Spot anticyclone and four planet-sized Galilean moons.',
    orbitRadius: 68,
    orbitSpeed: 0.042,
    orbitInclinationDeg: 1.3,
    initialAngle: -2.25,
    radius: 4.3,
    axialTiltDeg: 3.13,
    spinSpeed: 1.05,
    focusDistance: 14.2,
    accentColor: '#FB923C',
    avgDistanceSun: '778.5 million km (5.20 AU)',
    diameter: '139,820 km',
    gravity: '24.79 m/s² (1-bar cloud tops)',
    orbitalPeriod: '11.86 Earth years',
    rotationPeriod: '9h 55m 30s',
    temperature: '-110°C (1-bar cloud layer)',
    atmosphere: '89.8% H₂ · 10.2% He · Ammonia & Ammonium hydrosulfide clouds',
    knownMoons: '95 confirmed moons',
    scientificFacts: [
      'Fastest planetary spin in the Solar System flattens its poles and drives alternating jet streams.',
      'More than twice as massive as all other Solar System planets combined, sculpting asteroid resonances.',
    ],
    explorationHistory: 'Pioneer 10/11, Voyager 1/2, Galileo orbiter, Juno polar mission, Europa Clipper.',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    subtitle: 'Ringed Gas Giant System',
    category: 'planet',
    planetType: 'Gas Giant',
    shortDesc:
      'Adorned by an expansive icy ring plane spanning 282,000 km across, encircled by hydrocarbon-rich Titan and geyser world Enceladus.',
    orbitRadius: 96,
    orbitSpeed: 0.029,
    orbitInclinationDeg: 2.48,
    initialAngle: 0.45,
    radius: 3.65,
    axialTiltDeg: 26.73,
    spinSpeed: 0.92,
    focusDistance: 15.5,
    accentColor: '#FDE047',
    avgDistanceSun: '1.43 billion km (9.58 AU)',
    diameter: '116,460 km',
    gravity: '10.44 m/s² (1-bar cloud tops)',
    orbitalPeriod: '29.45 Earth years',
    rotationPeriod: '10h 33m 38s',
    temperature: '-140°C (1-bar cloud layer)',
    atmosphere: '96.3% H₂ · 3.25% He · Trace CH₄ & NH₃',
    knownMoons: '146 confirmed moons',
    scientificFacts: [
      'Mean bulk density (0.687 g/cm³) is lower than liquid water.',
      'A persistent 30,000-km-wide hexagonal jet stream circles Saturn’s north pole.',
    ],
    explorationHistory: 'Pioneer 11, Voyager 1 & 2, Cassini-Huygens orbiter & Titan probe (2004–2017).',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    subtitle: 'Sideways Ice Giant',
    category: 'planet',
    planetType: 'Ice Giant',
    shortDesc:
      'An aquamarine mantle of water, ammonia, and methane ices rolling along its orbit with an extreme 97.8-degree axial tilt.',
    orbitRadius: 122,
    orbitSpeed: 0.019,
    orbitInclinationDeg: 0.77,
    initialAngle: 2.8,
    radius: 2.45,
    axialTiltDeg: 97.77,
    spinSpeed: -0.68,
    focusDistance: 9.2,
    accentColor: '#22D3EE',
    avgDistanceSun: '2.87 billion km (19.20 AU)',
    diameter: '50,724 km',
    gravity: '8.69 m/s²',
    orbitalPeriod: '84.01 Earth years',
    rotationPeriod: '17h 14m (Retrograde)',
    temperature: '-195°C (1-bar) · -224°C minimum',
    atmosphere: '82.5% H₂ · 15.2% He · 2.3% CH₄ (absorbs red light)',
    knownMoons: '28 known moons',
    scientificFacts: [
      'Extreme axial tilt subjects each pole to 42 continuous Earth years of sunlight followed by 42 years of darkness.',
      'Surrounded by 13 narrow, dark vertical rings and five major icy-rocky moons.',
    ],
    explorationHistory: 'Voyager 2 flyby (January 1986) — the only spacecraft to visit the Uranian system.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    subtitle: 'Supersonic Cobalt Ice Giant',
    category: 'planet',
    planetType: 'Ice Giant',
    shortDesc:
      'The outermost major planet, lashed by supersonic 2,100 km/h methane winds and orbited by retrograde captured moon Triton.',
    orbitRadius: 146,
    orbitSpeed: 0.014,
    orbitInclinationDeg: 1.77,
    initialAngle: -1.35,
    radius: 2.35,
    axialTiltDeg: 28.32,
    spinSpeed: 0.74,
    focusDistance: 8.8,
    accentColor: '#3B82F6',
    avgDistanceSun: '4.50 billion km (30.05 AU)',
    diameter: '49,244 km',
    gravity: '11.15 m/s²',
    orbitalPeriod: '164.8 Earth years',
    rotationPeriod: '16h 6m 36s',
    temperature: '-201°C (1-bar cloud tops)',
    atmosphere: '80% H₂ · 19% He · 1.5% CH₄ · High-altitude methane cirrus',
    knownMoons: '16 known moons',
    scientificFacts: [
      'First planet discovered through mathematical prediction of orbital perturbations before optical sighting (1846).',
      'Radiates 2.6× more thermal energy than it receives from the distant Sun, fueling violent storms.',
    ],
    explorationHistory: 'Voyager 2 flyby (August 1989) & Hubble / JWST atmospheric monitoring.',
  },

  // ================= MOONS =================
  {
    id: 'luna',
    name: 'The Moon',
    subtitle: 'Earth’s Natural Satellite · Artemis Target',
    category: 'moon',
    parentId: 'earth',
    parentPlanet: 'Earth',
    playableWorldId: 'moon',
    shortDesc:
      'Basalt-filled lunar maria and sunlit South Pole crater rims holding permanently shadowed water-ice traps.',
    orbitRadius: 4.3,
    orbitSpeed: 0.62,
    orbitInclinationDeg: 5.1,
    initialAngle: 0.4,
    radius: 0.52,
    axialTiltDeg: 6.68,
    spinSpeed: 0.35,
    focusDistance: 3.1,
    accentColor: '#CBD5E1',
    diameter: '3,474 km',
    gravity: '1.62 m/s²',
    orbitalPeriod: '27.32 Earth days',
    surfaceCharacteristics: 'Anorthosite highlands, flood-basalt maria, fine electrostatic regolith dust, PSR ice craters.',
    importantDiscoveries:
      'LCROSS & Chandrayaan-1 confirmed water-ice molecules inside Shackleton and Cabeus polar craters.',
    scientificInterest:
      'Gateway for deep-space ISRU propellant production, radio astronomy on the far side, and early Solar System bombardment records.',
  },
  {
    id: 'io',
    name: 'Io',
    subtitle: 'Volcanic Galilean Moon',
    category: 'moon',
    parentId: 'jupiter',
    parentPlanet: 'Jupiter',
    shortDesc:
      'The most volcanically active body in the Solar System, kneaded by tidal resonances with Jupiter, Europa, and Ganymede.',
    orbitRadius: 7.4,
    orbitSpeed: 0.86,
    orbitInclinationDeg: 0.4,
    initialAngle: 1.2,
    radius: 0.48,
    axialTiltDeg: 0,
    spinSpeed: 0.4,
    focusDistance: 3.0,
    accentColor: '#FACC15',
    diameter: '3,643 km',
    gravity: '1.80 m/s²',
    orbitalPeriod: '1.77 Earth days',
    surfaceCharacteristics: 'Over 400 active silicate & sulfur volcanoes, lava lakes, and sulfur-dioxide frost plains.',
    importantDiscoveries:
      'Voyager 1 and Juno captured towering 300-km volcanic plumes feeding Jupiter’s plasma torus.',
    scientificInterest:
      'Benchmarks tidal heating physics driving rocky exoplanet and icy moon interiors.',
  },
  {
    id: 'europa',
    name: 'Europa',
    subtitle: 'Subsurface Ocean Moon · Cryo Frontier',
    category: 'moon',
    parentId: 'jupiter',
    parentPlanet: 'Jupiter',
    playableWorldId: 'europa',
    shortDesc:
      'A cracked water-ice shell concealing a global salty ocean twice the volume of Earth’s seas.',
    orbitRadius: 9.8,
    orbitSpeed: 0.55,
    orbitInclinationDeg: 0.5,
    initialAngle: 2.9,
    radius: 0.46,
    axialTiltDeg: 0.1,
    spinSpeed: 0.3,
    focusDistance: 3.0,
    accentColor: '#38BDF8',
    diameter: '3,121 km',
    gravity: '1.31 m/s²',
    orbitalPeriod: '3.55 Earth days',
    surfaceCharacteristics: 'Young fractured water-ice crust, reddish hydrated salt lineae ridges, Conamara Chaos blocks.',
    importantDiscoveries:
      'Galileo magnetometer data detected an induced magnetic field confirming a conductive subsurface ocean.',
    scientificInterest:
      'Prime astrobiology target where hydrothermal seafloor vents could sustain chemosynthetic life.',
  },
  {
    id: 'titan',
    name: 'Titan',
    subtitle: 'Atmospheric Moon · Liquid Methane Seas',
    category: 'moon',
    parentId: 'saturn',
    parentPlanet: 'Saturn',
    playableWorldId: 'titan',
    shortDesc:
      'The only moon with a dense nitrogen-methane atmosphere, organic tholin dunes, and liquid hydrocarbon lakes.',
    orbitRadius: 9.4,
    orbitSpeed: 0.46,
    orbitInclinationDeg: 0.35,
    initialAngle: -0.9,
    radius: 0.62,
    axialTiltDeg: 0.3,
    spinSpeed: 0.25,
    focusDistance: 3.4,
    accentColor: '#F59E0B',
    diameter: '5,149 km (larger than Mercury)',
    gravity: '1.35 m/s²',
    orbitalPeriod: '15.95 Earth days',
    surfaceCharacteristics: 'Dense 145 kPa N₂-CH₄ golden haze, cryogenic water-ice bedrock, hydrocarbon seas (Kraken Mare).',
    importantDiscoveries:
      'Huygens lander touched down on wet methane-damp ice pebbles and confirmed active hydrological methane rain.',
    scientificInterest:
      'Prebiotic organic chemistry laboratory and destination of NASA’s Dragonfly rotorcraft lander.',
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    subtitle: 'Cryovolcanic Saturnian Moon',
    category: 'moon',
    parentId: 'saturn',
    parentPlanet: 'Saturn',
    shortDesc:
      'A brilliant white ice moon venting towering water-vapor plumes and organic salts from south polar fractures.',
    orbitRadius: 7.2,
    orbitSpeed: 0.72,
    orbitInclinationDeg: 0.1,
    initialAngle: 2.1,
    radius: 0.34,
    axialTiltDeg: 0,
    spinSpeed: 0.38,
    focusDistance: 2.6,
    accentColor: '#E0F2FE',
    diameter: '504 km',
    gravity: '0.11 m/s²',
    orbitalPeriod: '1.37 Earth days',
    surfaceCharacteristics: 'Highest albedo in Solar System (~99%), smooth south polar "tiger stripe" cryovolcanic vents.',
    importantDiscoveries:
      'Cassini flew directly through plumes and detected molecular hydrogen (H₂), silica nanoparticles, and phosphates.',
    scientificInterest:
      'Directly sampleable subsurface habitable ocean without deep mechanical drilling.',
  },
  {
    id: 'triton',
    name: 'Triton',
    subtitle: 'Retrograde Kuiper-Origin Moon',
    category: 'moon',
    parentId: 'neptune',
    parentPlanet: 'Neptune',
    shortDesc:
      'A captured Kuiper Belt object orbiting Neptune backwards with active nitrogen geysers at -235°C.',
    orbitRadius: 5.5,
    orbitSpeed: -0.5,
    orbitInclinationDeg: 22.0,
    initialAngle: 0.8,
    radius: 0.44,
    axialTiltDeg: 0,
    spinSpeed: 0.28,
    focusDistance: 2.9,
    accentColor: '#93C5FD',
    diameter: '2,707 km',
    gravity: '0.78 m/s²',
    orbitalPeriod: '5.88 days (Retrograde)',
    surfaceCharacteristics: 'Pinkish nitrogen frost plains, dimpled cantaloupe terrain, dark cryogenic geyser streaks.',
    importantDiscoveries:
      'Voyager 2 observed 8-km-tall nitrogen gas geysers driven by faint polar solar heating.',
    scientificInterest:
      'Window into early Kuiper Belt dwarf planets and possible subsurface ammonia-water ocean.',
  },

  // ================= SMALL BODIES =================
  {
    id: 'asteroid_belt',
    name: 'Main Asteroid Belt & Ceres',
    subtitle: 'Primordial Planetary Remnants',
    category: 'small_body',
    shortDesc:
      'Millions of rocky and metallic planetesimals orbiting between Mars and Jupiter, anchored by ice-rich dwarf planet Ceres.',
    orbitRadius: 56,
    orbitSpeed: 0.055,
    orbitInclinationDeg: 4.5,
    initialAngle: 1.65,
    radius: 0.72,
    axialTiltDeg: 4,
    spinSpeed: 0.35,
    focusDistance: 6.2,
    accentColor: '#94A3B8',
    classification: 'C-type & S-type Minor Planets (2.2–3.2 AU)',
    distanceFromEarth: '329–478 million km from Sun',
    scaleSize: 'Ceres 939 km · Vesta 525 km · >1 million asteroids >1 km',
    characteristics:
      'Jupiter’s gravitational resonances prevented these protoplanetary fragments from coalescing into a terrestrial planet.',
    importantDiscoveries:
      'NASA’s Dawn mission revealed bright sodium-carbonate evaporite domes in Ceres’ Occator Crater from subsurface brine.',
  },
  {
    id: 'comet_halley',
    name: 'Comet 1P/Halley',
    subtitle: 'Periodic Volatile Comet',
    category: 'small_body',
    shortDesc:
      'An icy conglomerate nucleus releasing glowing cyan ion and golden dust tails pushed radially away from the Sun.',
    orbitRadius: 78,
    orbitSpeed: 0.068,
    orbitInclinationDeg: 14.0,
    initialAngle: -0.35,
    radius: 0.65,
    axialTiltDeg: 0,
    spinSpeed: 0.5,
    focusDistance: 8.5,
    accentColor: '#67E8F9',
    classification: 'Short-Period Halley-Type Comet',
    distanceFromEarth: '0.59 AU perihelion to 35.1 AU aphelion',
    scaleSize: '15 × 8 km nucleus · >100,000 km glowing coma & tails',
    characteristics:
      'Solar radiation sublimates frozen water, CO, and organics into a glowing coma and dual ion/dust tails pointing away from the Sun.',
    importantDiscoveries:
      'ESA’s Giotto spacecraft imaged its dark potato-shaped nucleus in 1986, confirming active gas jets.',
  },

  // ================= ARTIFICIAL SATELLITES & STATIONS =================
  {
    id: 'iss',
    name: 'International Space Station',
    subtitle: 'Modular Low-Earth Orbital Laboratory',
    category: 'satellite',
    parentId: 'earth',
    shortDesc:
      'Humanity’s continuously crewed microgravity outpost orbiting Earth every 92 minutes with expansive photovoltaic wings.',
    orbitRadius: 3.1,
    orbitSpeed: 1.35,
    orbitInclinationDeg: 51.6,
    initialAngle: 2.3,
    radius: 0.42,
    axialTiltDeg: 0,
    spinSpeed: 0.1,
    focusDistance: 2.6,
    accentColor: '#38BDF8',
    organization: 'NASA · ESA · JAXA · CSA · Roscosmos',
    missionPurpose: 'Long-duration human physiology, closed-loop life support, and Earth/astrophysics research in LEO.',
    launchDate: 'November 20, 1998 (First module Zarya)',
    orbitType: 'Low Earth Orbit (408 km altitude, 51.6° incl.)',
    missionStatus: 'Operational · Continuously Inhabited since Nov 2000',
    scientificContribution:
      'Proved closed-loop water recycling (>98%), protein crystal growth, and human adaptation protocols for Artemis Moon & Mars flights.',
  },
  {
    id: 'jwst',
    name: 'James Webb Space Telescope',
    subtitle: 'Deep-Infrared Observatory at Sun-Earth L2',
    category: 'satellite',
    parentId: 'earth',
    shortDesc:
      'A 6.5-meter gold-coated segmented beryllium mirror shielded behind a 5-layer Kapton sunshield peering back to cosmic dawn.',
    orbitRadius: 5.8,
    orbitSpeed: 0.34,
    orbitInclinationDeg: -8.0,
    initialAngle: -1.8,
    radius: 0.48,
    axialTiltDeg: 0,
    spinSpeed: 0.08,
    focusDistance: 2.9,
    accentColor: '#FACC15',
    organization: 'NASA · ESA · CSA',
    missionPurpose: 'Infrared spectroscopy of the earliest galaxies, star-forming nebulae, and exoplanet atmospheres.',
    launchDate: 'December 25, 2021',
    orbitType: 'Sun-Earth Lagrange Point L2 Halo Orbit (1.5M km)',
    missionStatus: 'Operational · Exceeding 20-year fuel horizon',
    scientificContribution:
      'Detected atmospheric CO₂, CH₄, and H₂O spectra on distant exoplanets and imaged galaxies formed <300 Myr after the Big Bang.',
  },
  {
    id: 'voyager1',
    name: 'Voyager 1 Interstellar Probe',
    subtitle: 'Farthest Human-Made Spacecraft',
    category: 'satellite',
    shortDesc:
      'Launched in 1977 on the Grand Tour of Jupiter and Saturn, now cruising through interstellar plasma beyond the heliopause.',
    orbitRadius: 162,
    orbitSpeed: 0.006,
    orbitInclinationDeg: 18.0,
    initialAngle: 0.25,
    radius: 0.55,
    axialTiltDeg: 0,
    spinSpeed: 0.05,
    focusDistance: 3.4,
    accentColor: '#A855F7',
    organization: 'NASA / Jet Propulsion Laboratory (JPL)',
    missionPurpose: 'Outer giant planet reconnaissance and direct sampling of the interstellar medium.',
    launchDate: 'September 5, 1977',
    orbitType: 'Hyperbolic Interstellar Escape Trajectory (>165 AU)',
    missionStatus: 'Operational · Returning cosmic ray & plasma telemetry',
    scientificContribution:
      'Discovered active volcanoes on Io, complex rings at Saturn, captured the Pale Blue Dot, and crossed the heliopause in 2012.',
  },

  // ================= DEEP SPACE (NEBULAE & GALAXIES) =================
  {
    id: 'orion_nebula',
    name: 'Orion Nebula (M42)',
    subtitle: 'Diffuse Emission Stellar Nursery',
    category: 'deep_space',
    shortDesc:
      'Glowing clouds of ionized hydrogen, oxygen, and cosmic dust sculpting newborn protoplanetary disks 1,344 light-years away.',
    orbitRadius: 235,
    orbitSpeed: 0,
    orbitInclinationDeg: 0,
    initialAngle: 0.85,
    radius: 18,
    axialTiltDeg: 18,
    spinSpeed: 0.015,
    focusDistance: 36,
    accentColor: '#EC4899',
    classification: 'Diffuse H II Emission & Reflection Nebula',
    distanceFromEarth: '1,344 ± 20 light-years',
    scaleSize: '~24 light-years across',
    importantDiscoveries:
      'Hubble and JWST directly resolved "proplyds" — nascent solar systems crystallizing around young Trapezium stars.',
    characteristics:
      'Ultraviolet radiation from massive O-type stars ionizes surrounding hydrogen and sculpting dust pillars.',
  },
  {
    id: 'andromeda',
    name: 'Andromeda Galaxy (M31)',
    subtitle: 'Nearest Major Spiral Galaxy',
    category: 'deep_space',
    shortDesc:
      'A vast barred spiral island universe of one trillion stars bound on a 4.5-billion-year gravitational merger with the Milky Way.',
    orbitRadius: 260,
    orbitSpeed: 0,
    orbitInclinationDeg: 0,
    initialAngle: -2.1,
    radius: 22,
    axialTiltDeg: 28,
    spinSpeed: 0.01,
    focusDistance: 44,
    accentColor: '#818CF8',
    classification: 'SA(s)b Barred Spiral Galaxy',
    distanceFromEarth: '2.537 million light-years',
    scaleSize: '152,000 light-years diameter · ~1 trillion stars',
    importantDiscoveries:
      'Edwin Hubble’s 1923 Cepheid variable measurements proved Andromeda lies far beyond the Milky Way, revealing the scale of the cosmos.',
    characteristics:
      'Features dual central nuclei, dusty star-forming spiral arms, and at least 14 dwarf satellite galaxies.',
  },
];

export const JOURNEY_SEQUENCE_IDS: string[] = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'mars',
  'asteroid_belt',
  'jupiter',
  'europa',
  'saturn',
  'titan',
  'uranus',
  'neptune',
  'iss',
  'andromeda',
];

export const getCelestialBodyById = (id: string): CelestialBodyData =>
  UNIVERSE_BODIES.find((b) => b.id === id) || UNIVERSE_BODIES[0];
