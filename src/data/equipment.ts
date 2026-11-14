import type { BuildingTypeId, EquipmentId } from '../types';

export interface EquipmentSpecItem {
  label: string;
  value: string;
}

export interface EquipmentCatalogItem {
  id: EquipmentId;
  name: string;
  category: string;
  buildingTypeId: BuildingTypeId;
  shortDesc: string;
  description: string;
  purpose: string;
  functionalitySteps: string[];
  animationLabel: string;
  inventoryEffectDesc: string;
  creditValue: number;
  specs: EquipmentSpecItem[];
}

export const EQUIPMENT_CATALOG: EquipmentCatalogItem[] = [
  {
    id: 'solar_array',
    name: 'Solar Panel System',
    category: 'Energy Generation',
    buildingTypeId: 'solar',
    shortDesc: 'Dual-axis tracking photovoltaic wings with anti-dust silicone cells.',
    description:
      'High-efficiency triple-junction gallium arsenide solar wings mounted on a motorized azimuth-elevation mast that continuously tracks the local solar vector.',
    purpose:
      'Converts incoming solar irradiance into regulated DC bus power for habitats, life-support electrolysis, and battery storage banks.',
    functionalitySteps: [
      'Mast gimbal unfolds stowed multi-hinge wing panels into operational span.',
      'Optical sun sensors sweep elevation angle to maximize photon incidence.',
      'Power conditioning bus routes harvested energy directly into outpost storage.',
    ],
    animationLabel: 'Deployment, Solar Gimbal Tracking & Energy Bus Pulse',
    inventoryEffectDesc: '+12 kWh immediate battery boost & +4% permanent solar tracking gain',
    creditValue: 40,
    specs: [
      { label: 'Peak Output', value: '18.4 kW' },
      { label: 'Cell Efficiency', value: '32.6 %' },
      { label: 'Gimbal Tracking', value: '2-Axis Sun Lock' },
      { label: 'Dust Mitigation', value: 'Electrostatic Shield' },
    ],
  },
  {
    id: 'solar_water_cycle',
    name: 'Solar Water Cycle System',
    category: 'Closed-Loop Hydrology',
    buildingTypeId: 'water_recycler',
    shortDesc: 'Solar-thermal still, vapor condenser, UV sterilizer & closed-loop storage.',
    description:
      'Integrated solar-heated distillation and closed-loop water recovery manifold combining a parabolic thermal collector, cooling condenser coil, filtration column, and pressurized storage reservoir.',
    purpose:
      'Recovers up to 98% of crew cabin condensate, greywater, and melted ice into potable drinking water and oxygen feedstock.',
    functionalitySteps: [
      'Stage 1 (Collection): Parabolic solar concentrator vaporizes raw feed water & brine.',
      'Stage 2 (Purification): Vapor condenses through multi-bed activated carbon & UV tube.',
      'Stage 3 (Storage & Recycle): Purified H₂O fills glass reservoir and recirculates to crew.',
    ],
    animationLabel: 'Collection Vapor -> Filter Purification -> Reservoir Flow',
    inventoryEffectDesc: '+10% Water reserve & +5% closed-loop recycling efficiency',
    creditValue: 45,
    specs: [
      { label: 'Recovery Rate', value: '98.2 %' },
      { label: 'Cycle Flow', value: '42 L / hr' },
      { label: 'UV Sterilization', value: '254 nm Quartz' },
      { label: 'Loop Pressure', value: '108 kPa' },
    ],
  },
  {
    id: 'water_collector',
    name: 'Water Collection Equipment',
    category: 'ISRU Extraction',
    buildingTypeId: 'isru_plant',
    shortDesc: 'Heated rotary ice auger & sublimation cryo-trap manifold.',
    description:
      'Autonomous deep-core rotary auger encased in a sealed thermal bell that sublimates permafrost or lunar crater water-ice directly into a chilled vapor trap.',
    purpose:
      'Harvests locked subsurface ice on the Moon, Mars, Titan, and Europa so crews do not rely on heavy Earth water shipments.',
    functionalitySteps: [
      'Carbide helical auger penetrates frozen regolith or water-ice strata.',
      'Induction collar heats excavated ice inside the sealed vapor bell.',
      'Sublimated steam rises into chilled cryo-condenser coils for collection.',
    ],
    animationLabel: 'Rotary Auger Drill, Sublimation Heat & Cryo-Vapor Rise',
    inventoryEffectDesc: '+12% Water & +10% Propellant H₂O feedstock reserves',
    creditValue: 45,
    specs: [
      { label: 'Drill Torque', value: '240 N·m' },
      { label: 'Max Bore Depth', value: '2.8 m' },
      { label: 'Yield (5% Ice)', value: '18 kg / hr' },
      { label: 'Thermal Seal', value: '-230°C Rated' },
    ],
  },
  {
    id: 'oxygen_generator',
    name: 'Oxygen Generation System',
    category: 'Atmospheric Life Support',
    buildingTypeId: 'greenhouse',
    shortDesc: 'Solid-oxide CO₂ electrolyzer & water-splitting O₂ manifold.',
    description:
      'Dual-mode Sabatier/MOXIE ceramic electrolysis stack capable of splitting purified H₂O or Martian CO₂ into breathable medical-grade oxygen.',
    purpose:
      'Maintains safe cabin partial pressure (~21 kPa O₂) and supplies backup EVA tank refills during prolonged storms or dust events.',
    functionalitySteps: [
      'Intake turbine compresses ambient gas or purified electrolysis feed.',
      '800°C ceramic stack separates O₂ ions across zirconia membranes.',
      'Pressurized titanium spheres store breathable O₂ for habitat distribution.',
    ],
    animationLabel: 'Intake Turbine Spin, Core Ion Separation & O₂ Buffer Pulse',
    inventoryEffectDesc: '+12% Oxygen reserve & +1 HEPA Filter spare part',
    creditValue: 45,
    specs: [
      { label: 'O₂ Production', value: '1.8 kg / hr' },
      { label: 'Purity Grade', value: '99.94 %' },
      { label: 'Stack Temp', value: '800 °C' },
      { label: 'Buffer Pressure', value: '20.7 MPa' },
    ],
  },
  {
    id: 'exploration_rover',
    name: 'Space Exploration Equipment',
    category: 'Surface Mobility',
    buildingTypeId: 'rover_garage',
    shortDesc: '6-wheel rocker-bogie pressurized scout rover with robotic arm.',
    description:
      'Articulated six-wheel surface reconnaissance vehicle with independent hub motors, panoramic stereo mast camera, and a 3-DOF geological sample arm.',
    purpose:
      'Extends crew exploration radius safely across hazardous craters, methane shorelines, and jagged ice ridges while transporting samples.',
    functionalitySteps: [
      'Rocker-bogie titanium suspension levels chassis across rocky slopes.',
      'Stereo optical mast sweeps 360° terrain lidar and hazard vectors.',
      'Articulated coring arm acquires basalt, ice, or organic regolith samples.',
    ],
    animationLabel: '6-Wheel Drive Spin, Mast Lidar Sweep & Coring Arm Actuation',
    inventoryEffectDesc: 'Restores Rover Charge to 100% & +1 Mechanical Part',
    creditValue: 50,
    specs: [
      { label: 'Drivetrain', value: '6x6 Hub Electric' },
      { label: 'Top Speed', value: '14 km/h' },
      { label: 'Slope Limit', value: '32 deg' },
      { label: 'Payload', value: '280 kg' },
    ],
  },
  {
    id: 'comms_array',
    name: 'Communication Equipment',
    category: 'Deep-Space Telemetry',
    buildingTypeId: 'comms',
    shortDesc: 'High-gain Ka-band parabolic dish with motorized feed horn.',
    description:
      'Deep Space Network compatible Ka-band and optical laser transponder dish mounted on an actuated azimuth/elevation pedestal for Earth & orbital relay links.',
    purpose:
      'Maintains telemetry, storm warning alerts, medical consultations, and high-bandwidth scientific data uplinks back to Mission Control.',
    functionalitySteps: [
      'Gimbal servos lock parabolic reflector onto Earth/relay ephemeris.',
      'Traveling-wave tube amplifier energizes central Ka-band feed horn.',
      'Focused RF wavefront pulses clear carrier telemetry across deep space.',
    ],
    animationLabel: '2-Axis Gimbal Scan & Coherent Ka-Band Signal Pulses',
    inventoryEffectDesc: '+18% Comms Signal Strength & +1 Antenna Spare Component',
    creditValue: 40,
    specs: [
      { label: 'Band', value: '32 GHz Ka-Band' },
      { label: 'Downlink', value: '120 Mbps' },
      { label: 'Dish Aperture', value: '2.4 m Mesh' },
      { label: 'Pointing Acc.', value: '0.02 deg' },
    ],
  },
  {
    id: 'science_spectrometer',
    name: 'Scientific Research Equipment',
    category: 'Planetary Astrobiology',
    buildingTypeId: 'research_lab',
    shortDesc: 'Laser Raman spectrometer, sample carousel & cryogenic analyzer.',
    description:
      'Precision planetary geology and biosignature suite combining a pulsed Raman/LIBS laser head, six-cup rotating sample carousel, and cryogenic mass spectrometer.',
    purpose:
      'Identifies hydrated minerals, organic tholins, water-ice purity, and subsurface brine signatures from collected field samples.',
    functionalitySteps: [
      'Motorized sample carousel indexes collected cores beneath optics.',
      '532 nm Raman laser excites mineral lattice without destroying biosignatures.',
      'Spectrometer telemetry converts return peaks into Science Points.',
    ],
    animationLabel: 'Carousel Indexing & Pulsed Laser Spectroscopy Scan',
    inventoryEffectDesc: '+18 Science Points & +1 Avionics Circuit Board',
    creditValue: 45,
    specs: [
      { label: 'Laser Source', value: '532 nm Pulsed' },
      { label: 'Resolution', value: '0.15 nm' },
      { label: 'Carousel Slots', value: '6 Sealed Cups' },
      { label: 'Operating Temp', value: '-185°C to +45°C' },
    ],
  },
];

export const getEquipmentById = (id: EquipmentId): EquipmentCatalogItem =>
  EQUIPMENT_CATALOG.find((e) => e.id === id) || EQUIPMENT_CATALOG[0];
