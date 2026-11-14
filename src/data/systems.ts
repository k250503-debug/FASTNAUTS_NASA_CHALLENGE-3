import type {
  CommsFaultId,
  ConstructionMaterialId,
  MedicalConditionId,
  SparePartId,
} from '../types';

export interface SparePartDef {
  id: SparePartId;
  name: string;
  shortName: string;
  category: string;
  craftMaterials: Partial<Record<ConstructionMaterialId, number>>;
  resupplyCost: number;
  criticalMin: number;
  purpose: string;
}

export const SPARE_PART_DEFS: SparePartDef[] = [
  {
    id: 'cables',
    name: 'Shielded Power & Data Cables',
    shortName: 'Cables',
    category: 'Electrical',
    craftMaterials: { alloys: 1, cryo_insulation: 1 },
    resupplyCost: 18,
    criticalMin: 2,
    purpose: 'Power bus repairs, solar array jumpers, and antenna interconnects.',
  },
  {
    id: 'filters',
    name: 'HEPA & CO₂ Scrubber Filters',
    shortName: 'Filters',
    category: 'Life Support',
    craftMaterials: { cryo_insulation: 2 },
    resupplyCost: 22,
    criticalMin: 2,
    purpose: 'Restores airlock, storm flue, habitat scrubbers, and water purification loops.',
  },
  {
    id: 'batteries',
    name: 'Solid-State Lithium Cells',
    shortName: 'Batteries',
    category: 'Power Storage',
    craftMaterials: { alloys: 1, cryo_insulation: 1 },
    resupplyCost: 28,
    criticalMin: 2,
    purpose: 'Replaces degraded battery cells, EVA suit packs, and rover power modules.',
  },
  {
    id: 'seals',
    name: 'Cryo-Rated Pressure Seals',
    shortName: 'Seals',
    category: 'Structural',
    craftMaterials: { cryo_insulation: 2 },
    resupplyCost: 20,
    criticalMin: 2,
    purpose: 'Patches airlock hatches, pressurized habitats, and fuel pipe gaskets.',
  },
  {
    id: 'circuit_boards',
    name: 'Avionics Circuit Boards',
    shortName: 'Circuit Boards',
    category: 'Electronics',
    craftMaterials: { cryo_insulation: 2, alloys: 1 },
    resupplyCost: 34,
    criticalMin: 1,
    purpose: 'Repairs telemetry controllers, comms transceivers, and robotic instruments.',
  },
  {
    id: 'mechanical_parts',
    name: 'Actuators & Mechanical Bearings',
    shortName: 'Mech Parts',
    category: 'Mechanical',
    craftMaterials: { alloys: 2 },
    resupplyCost: 25,
    criticalMin: 2,
    purpose: 'Rebuilds rover suspension, storm flue turbines, drills, and solar gimbals.',
  },
  {
    id: 'antenna_components',
    name: 'Ka-Band Feed Horns & Transponders',
    shortName: 'Antenna Parts',
    category: 'Communications',
    craftMaterials: { alloys: 1, cryo_insulation: 1 },
    resupplyCost: 32,
    criticalMin: 1,
    purpose: 'Repairs deep-space comms dishes, alignment motors, and uplink amplifiers.',
  },
  {
    id: 'repair_tools',
    name: 'EVA Torque & Soldering Kit',
    shortName: 'Repair Tools',
    category: 'Tooling',
    craftMaterials: { alloys: 1, regolith_bricks: 1 },
    resupplyCost: 24,
    criticalMin: 1,
    purpose: 'Consumed during heavy structural reconstruction & robotic maintenance.',
  },
];

export const getSparePartDef = (id: SparePartId): SparePartDef =>
  SPARE_PART_DEFS.find((p) => p.id === id) || SPARE_PART_DEFS[0];

export const MATERIAL_LABELS: Record<
  ConstructionMaterialId,
  { name: string; unit: string; colorClass: string }
> = {
  regolith_bricks: {
    name: 'Sintered Regolith / Ice Blocks',
    unit: 'blocks',
    colorClass: 'text-amber-300',
  },
  alloys: {
    name: 'Titanium-Aluminum Alloys',
    unit: 'ingots',
    colorClass: 'text-sky-300',
  },
  cryo_insulation: {
    name: 'MLI Foil & Cryo Polymers',
    unit: 'rolls',
    colorClass: 'text-cyan-300',
  },
};

export interface MedicalConditionMeta {
  id: MedicalConditionId;
  title: string;
  symptoms: string;
  treatmentLabel: string;
  medCost: number;
  waterCost: number;
  effectText: string;
}

export const MEDICAL_CONDITIONS: Record<MedicalConditionId, MedicalConditionMeta> = {
  exhaustion: {
    id: 'exhaustion',
    title: 'EVA Fatigue & Exhaustion',
    symptoms: 'High heart rate, slowed EVA reaction time, heavy oxygen draw.',
    treatmentLabel: 'Assign Rest Cycle & Electrolytes (-1 Medkit, -2 H₂O)',
    medCost: 1,
    waterCost: 2,
    effectText: 'Restores 45% stamina & +18% crew health.',
  },
  dehydration: {
    id: 'dehydration',
    title: 'Thermal Suit Dehydration',
    symptoms: 'Low suit cooling loop fluid, dizziness during surface tasks.',
    treatmentLabel: 'IV Hydration & Electrolyte Flush (-1 Medkit, -4 H₂O)',
    medCost: 1,
    waterCost: 4,
    effectText: 'Restores hydration to 92% & stabilizes vitals.',
  },
  illness: {
    id: 'illness',
    title: 'Dust / Radiation Sickness',
    symptoms: 'Elevated particulate bronchial irritation or cosmic dose nausea.',
    treatmentLabel: 'Broad-Spectrum Bio & Anti-Rad Meds (-2 Medkits)',
    medCost: 2,
    waterCost: 1,
    effectText: 'Clears illness & reduces crew radiation load by 6%.',
  },
  suit_trauma: {
    id: 'suit_trauma',
    title: 'Airlock Pressure / Suit Sprain',
    symptoms: 'Rapid depressurization strain or low-G landing joint impact.',
    treatmentLabel: 'Pressurized Splint & Hyperbaric Triage (-2 Medkits)',
    medCost: 2,
    waterCost: 0,
    effectText: 'Heals +28% crew health & clears trauma alert.',
  },
};

export interface CommsFaultMeta {
  id: CommsFaultId;
  title: string;
  symptom: string;
  requiredPart: SparePartId;
  requiredQty: number;
  repairNote: string;
}

export const COMMS_FAULTS: Record<CommsFaultId, CommsFaultMeta> = {
  transceiver_board: {
    id: 'transceiver_board',
    title: 'Ka-Band Transceiver Board Fault',
    symptom: 'Carrier signal drops intermittently; telemetry packets corrupted.',
    requiredPart: 'circuit_boards',
    requiredQty: 1,
    repairNote: 'Swap fried avionics transceiver board inside the Comms pedestal.',
  },
  feed_horn_alignment: {
    id: 'feed_horn_alignment',
    title: 'Parabolic Feed Horn Misalignment',
    symptom: 'Dish gimbal knocked off Earth/relay vector by gust or debris.',
    requiredPart: 'antenna_components',
    requiredQty: 1,
    repairNote: 'Install replacement feed horn & run realign signal sweep.',
  },
  coax_cable: {
    id: 'coax_cable',
    title: 'Severed Coaxial RF Conduit',
    symptom: 'Zero uplink power reaching mast amplifier.',
    requiredPart: 'cables',
    requiredQty: 2,
    repairNote: 'Splice dual shielded RF power & data cables to mast.',
  },
  power_bus: {
    id: 'power_bus',
    title: 'Antenna Power Bus Relay Burnout',
    symptom: 'Amplifier brownout during cold terminator transition.',
    requiredPart: 'batteries',
    requiredQty: 1,
    repairNote: 'Replace degraded buffer cell & test Earth carrier lock.',
  },
};

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
}

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  { id: 'first_flag', title: 'Sovereign Touchdown', desc: 'Planted a permanent expedition flag on an off-world landing zone.' },
  { id: 'eclipse_survivor', title: 'Shadow & Eclipse Engineer', desc: 'Maintained positive battery reserves through a lunar solar eclipse.' },
  { id: 'psr_explorer', title: 'PSR Ice Pioneer', desc: 'Discovered water ice inside a Lunar Permanently Shadowed Region.' },
  { id: 'medical_savior', title: 'Flight Surgeon', desc: 'Diagnosed and treated an astronaut medical emergency successfully.' },
  { id: 'comms_restorer', title: 'Deep-Space Signal Tech', desc: 'Diagnosed, replaced parts, and restored a disrupted Comms Array.' },
  { id: 'master_mechanic', title: 'Outpost Reconstructor', desc: 'Repaired storm or impact damage on an outpost building cleanly.' },
  { id: 'fabricator', title: 'Zero-Resupply Machinist', desc: 'Manufactured replacement spare parts inside the Engineering Workshop.' },
  { id: 'fuel_chemist', title: 'ISRU Propellant Architect', desc: 'Synthesized rocket fuel locally and refueled the NASA Starship.' },
  { id: 'titan_aviator', title: 'Dragonfly Flight Lead', desc: 'Conducted liquid-methane survey operations on Saturn’s moon Titan.' },
  { id: 'europa_sterilizer', title: 'Planetary Protection Officer', desc: 'Executed sterile subsurface cryo-drilling beneath Europa’s ice shell.' },
  { id: 'multi_world', title: 'Interplanetary Voyager', desc: 'Operated crews across Moon, Mars, Titan, and Europa.' },
];
