import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Car,
  CheckCircle2,
  Droplets,
  Factory,
  FlaskConical,
  Fuel,
  HeartPulse,
  Home,
  Minus,
  Package,
  Plus,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  Sprout,
  Sun,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Navbar from '../components/Navbar';
import { BUILDINGS, getBuildingDef } from '../data/buildings';
import { DIFFICULTIES, PLANETS } from '../data/planets';
import { makePlacedBuilding } from '../simulation/resources';
import OutpostBuilderScene3D, {
  BUILDER_PAD_CELL_SLOTS,
  renderAllModuleThumbnails,
} from '../three/OutpostBuilderScene3D';
import type { BuildingTypeId, MissionConfig, PlacedBuilding } from '../types';

export const BUILDING_ICONS: Record<BuildingTypeId, LucideIcon> = {
  habitat: Home,
  solar: Sun,
  battery: BatteryCharging,
  water_recycler: Droplets,
  greenhouse: Sprout,
  isru_plant: Factory,
  radiation_shelter: Shield,
  comms: Radio,
  medical_station: HeartPulse,
  workshop: Wrench,
  fuel_depot: Fuel,
  rover_garage: Car,
  research_lab: FlaskConical,
  storage_depot: Package,
};

type BuilderCategoryFilter = 'all' | 'core' | 'protection' | 'operations';

const CATEGORY_TABS: Array<{ id: BuilderCategoryFilter; label: string }> = [
  { id: 'all', label: 'All Modules (14)' },
  { id: 'core', label: 'Core Life Support' },
  { id: 'protection', label: 'Shelter, Power & Medical' },
  { id: 'operations', label: 'ISRU, Science & Ops' },
];

const MODULE_ACCENTS: Record<
  BuildingTypeId,
  { border: string; text: string; bg: string; group: Exclude<BuilderCategoryFilter, 'all'> }
> = {
  habitat: {
    border: 'border-sky-500/45',
    text: 'text-sky-300',
    bg: 'bg-sky-500/15',
    group: 'core',
  },
  solar: {
    border: 'border-amber-500/45',
    text: 'text-amber-300',
    bg: 'bg-amber-500/15',
    group: 'core',
  },
  water_recycler: {
    border: 'border-cyan-500/45',
    text: 'text-cyan-300',
    bg: 'bg-cyan-500/15',
    group: 'core',
  },
  greenhouse: {
    border: 'border-emerald-500/45',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    group: 'core',
  },
  radiation_shelter: {
    border: 'border-rose-500/50',
    text: 'text-rose-300',
    bg: 'bg-rose-500/15',
    group: 'protection',
  },
  battery: {
    border: 'border-amber-500/45',
    text: 'text-amber-300',
    bg: 'bg-amber-500/15',
    group: 'protection',
  },
  comms: {
    border: 'border-sky-500/45',
    text: 'text-sky-300',
    bg: 'bg-sky-500/15',
    group: 'protection',
  },
  medical_station: {
    border: 'border-rose-500/45',
    text: 'text-rose-300',
    bg: 'bg-rose-500/15',
    group: 'protection',
  },
  isru_plant: {
    border: 'border-teal-500/45',
    text: 'text-teal-300',
    bg: 'bg-teal-500/15',
    group: 'operations',
  },
  workshop: {
    border: 'border-amber-500/45',
    text: 'text-amber-300',
    bg: 'bg-amber-500/15',
    group: 'operations',
  },
  fuel_depot: {
    border: 'border-emerald-500/45',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    group: 'operations',
  },
  rover_garage: {
    border: 'border-indigo-500/45',
    text: 'text-indigo-300',
    bg: 'bg-indigo-500/15',
    group: 'operations',
  },
  research_lab: {
    border: 'border-cyan-500/45',
    text: 'text-cyan-300',
    bg: 'bg-cyan-500/15',
    group: 'operations',
  },
  storage_depot: {
    border: 'border-slate-500/50',
    text: 'text-slate-200',
    bg: 'bg-slate-500/15',
    group: 'operations',
  },
};

function formatQuickYield(typeId: BuildingTypeId, solarEff: number): string {
  const def = getBuildingDef(typeId);
  if (!def) return '';
  const parts: string[] = [];
  if (def.powerGen) parts.push(`+${Math.round(def.powerGen * solarEff)} kWh`);
  if (def.batteryBonus > 0) parts.push(`+${def.batteryBonus} kWh cap`);
  if (def.produces.oxygen > 0) parts.push(`+${def.produces.oxygen} O₂`);
  if (def.produces.water > 0) parts.push(`+${def.produces.water} H₂O`);
  if (def.produces.food > 0) parts.push(`+${def.produces.food} Food`);
  if (def.shieldingBonus > 0) parts.push(`+${def.shieldingBonus}% Rad Shield`);
  if (def.powerReq > 0) parts.push(`-${def.powerReq} kWh`);
  if (def.waterReq > 0) parts.push(`-${def.waterReq} H₂O`);
  return parts.join(' · ');
}

interface BaseBuilderProps {
  config: MissionConfig;
  initialBuildings?: PlacedBuilding[];
  onBack: () => void;
  onContinueToBriefing: (placedBuildings: PlacedBuilding[], remainingBudget: number) => void;
  onGoHome: () => void;
}

export default function BaseBuilder({
  config,
  initialBuildings,
  onBack,
  onContinueToBriefing,
  onGoHome,
}: BaseBuilderProps) {
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[1];
  const planet = PLANETS.find((p) => p.id === config.planetId) || PLANETS[0];
  const totalBudget = difficulty.budget;

  const [placedBuildings, setPlacedBuildings] = useState<PlacedBuilding[]>(() => {
    if (initialBuildings && initialBuildings.length > 0) return initialBuildings;
    return [
      makePlacedBuilding(`habitat-5-${Date.now()}`, 'habitat', 5),
      makePlacedBuilding(`solar-6-${Date.now() + 1}`, 'solar', 6),
    ];
  });
  const [categoryFilter, setCategoryFilter] = useState<BuilderCategoryFilter>('all');
  const [focusedTypeId, setFocusedTypeId] = useState<BuildingTypeId>('habitat');
  const [thumbs, setThumbs] = useState<Partial<Record<BuildingTypeId, string>>>({});

  useEffect(() => {
    setThumbs(renderAllModuleThumbnails());
  }, []);

  const spentBudget = useMemo(
    () => placedBuildings.reduce((sum, b) => sum + (getBuildingDef(b.typeId)?.cost || 0), 0),
    [placedBuildings]
  );
  const remainingBudget = totalBudget - spentBudget;

  const countOfType = (typeId: BuildingTypeId) =>
    placedBuildings.filter((b) => b.typeId === typeId).length;

  const hasHabitat = countOfType('habitat') >= 1;
  const hasSolar = countOfType('solar') >= 1;
  const canProceed = hasHabitat && hasSolar && remainingBudget >= 0;

  const handleAddModule = (typeId: BuildingTypeId) => {
    const def = getBuildingDef(typeId);
    if (!def) return;
    if (remainingBudget < def.cost) return;
    if (countOfType(typeId) >= def.maxPerBase) return;

    const usedSlots = new Set(placedBuildings.map((b) => b.cellIndex));
    const freeSlot = BUILDER_PAD_CELL_SLOTS.find((s) => !usedSlots.has(s));
    if (freeSlot === undefined) return;

    setFocusedTypeId(typeId);
    setPlacedBuildings((prev) => [
      ...prev,
      makePlacedBuilding(`${typeId}-${freeSlot}-${Date.now()}`, typeId, freeSlot),
    ]);
  };

  const handleRemoveModule = (typeId: BuildingTypeId) => {
    setPlacedBuildings((prev) => {
      const idx = [...prev].reverse().findIndex((b) => b.typeId === typeId);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.filter((_, i) => i !== realIdx);
    });
  };

  const handleLoadBalancedStarter = () => {
    const priorityOrder: BuildingTypeId[] = [
      'habitat',
      'solar',
      'radiation_shelter',
      'water_recycler',
      'greenhouse',
      'battery',
      'comms',
      'solar',
    ];
    const starter: PlacedBuilding[] = [];
    let budgetLeft = totalBudget;

    priorityOrder.forEach((id, i) => {
      const def = getBuildingDef(id);
      const alreadyCount = starter.filter((b) => b.typeId === id).length;
      const slot = BUILDER_PAD_CELL_SLOTS[starter.length];
      if (
        def &&
        slot !== undefined &&
        alreadyCount < def.maxPerBase &&
        budgetLeft >= def.cost
      ) {
        starter.push(makePlacedBuilding(`${id}-${slot}-${Date.now() + i}`, id, slot));
        budgetLeft -= def.cost;
      }
    });
    setPlacedBuildings(starter);
  };

  const filteredModules = useMemo(() => {
    // Place Radiation Shelter right after the 4 core modules in "All" view for quick discovery
    const ordered = [
      ...BUILDINGS.filter((b) =>
        ['habitat', 'solar', 'water_recycler', 'greenhouse', 'radiation_shelter', 'battery'].includes(
          b.id
        )
      ),
      ...BUILDINGS.filter(
        (b) =>
          !['habitat', 'solar', 'water_recycler', 'greenhouse', 'radiation_shelter', 'battery'].includes(
            b.id
          )
      ),
    ];
    if (categoryFilter === 'all') return ordered;
    return ordered.filter((b) => MODULE_ACCENTS[b.id].group === categoryFilter);
  }, [categoryFilter]);

  const deployedGroups = useMemo(() => {
    return BUILDINGS.map((def) => ({
      def,
      count: placedBuildings.filter((b) => b.typeId === def.id).length,
    })).filter((entry) => entry.count > 0);
  }, [placedBuildings]);

  // Projected outpost daily balance for selected planet
  const balance = useMemo(() => {
    let powerGen = 0;
    let powerUse = 0;
    let o2 = 0;
    let h2o = 0;
    let food = 0;
    let h2oUse = 0;
    let shielding = 15;
    let batteryMax = 100;

    placedBuildings.forEach((b) => {
      const def = getBuildingDef(b.typeId);
      if (!def) return;
      if (def.powerGen) powerGen += Math.round(def.powerGen * planet.solarEfficiency);
      powerUse += def.powerReq;
      o2 += def.produces.oxygen;
      h2o += def.produces.water;
      food += def.produces.food;
      h2oUse += def.waterReq;
      shielding += def.shieldingBonus;
      batteryMax += def.batteryBonus;
    });

    const netPower = powerGen - powerUse;
    const netO2 = Number((o2 - 10.5 * difficulty.consumptionMultiplier).toFixed(1));
    const netH2O = Number(
      (h2o - (13.5 * difficulty.consumptionMultiplier + h2oUse)).toFixed(1)
    );
    const netFood = Number((food - 8.5 * difficulty.consumptionMultiplier).toFixed(1));
    return {
      powerGen,
      powerUse,
      netPower,
      netO2,
      netH2O,
      netFood,
      shielding: Math.min(95, shielding),
      batteryMax,
    };
  }, [placedBuildings, planet.solarEfficiency, difficulty.consumptionMultiplier]);

  return (
    <div className="min-h-screen flex flex-col bg-[#06080D] text-slate-100">
      <Navbar
        showLandingNav={false}
        onGoHome={onGoHome}
        stepText={`Step 2 of 3 · Base Construction · ${planet.name}`}
      />

      {/* Top Planet & Budget Header */}
      <div className="border-b border-slate-800/90 bg-[#0A0F1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white w-fit transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change Planet
            </button>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                {planet.name} Outpost Construction
              </h1>
              <span className="text-xs font-mono text-sky-400 tabular-nums">
                {planet.location} · Gravity {planet.gravityMs2} m/s² · Solar{' '}
                {Math.round(planet.solarEfficiency * 100)}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[230px] rounded-xl bg-[#070A12] border border-slate-800 px-4 py-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>REMAINING BUDGET</span>
                <span className="tabular-nums text-white font-bold">
                  {remainingBudget.toLocaleString()} / {totalBudget.toLocaleString()} CR
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    remainingBudget < 160 ? 'bg-amber-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.max(0, (remainingBudget / totalBudget) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Live 3D Outpost + Full 14-Module Catalog + Right Budget Summary */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Center (8 cols): Live 3D Construction Stage + Module Selector */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Interactive 3D Planetary Construction Viewport */}
          <section className="relative h-[300px] sm:h-[340px] rounded-2xl overflow-hidden border border-slate-800 bg-[#04070D]">
            <OutpostBuilderScene3D
              planetId={planet.id}
              buildings={placedBuildings}
              focusedTypeId={focusedTypeId}
            />
            <div className="pointer-events-none absolute top-3 left-4 right-4 flex items-center justify-between gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-[#070B14]/90 border border-slate-700/80 text-xs font-mono text-slate-200">
                Live 3D Base · <strong className="text-sky-300">{planet.name}</strong> (
                {placedBuildings.length}/{BUILDER_PAD_CELL_SLOTS.length} Pads Occupied)
              </div>
              <div className="hidden sm:block text-[11px] font-mono text-slate-300 bg-[#070B14]/80 px-2.5 py-1 rounded-md border border-slate-800">
                Drag to Orbit · Scroll to Zoom
              </div>
            </div>
          </section>

          {/* Category Filter Strip */}
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_TABS.map((tab) => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                      : 'bg-[#0C121E] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* All Outpost Modules Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredModules.map((def) => {
              const accent = MODULE_ACCENTS[def.id];
              const Icon = BUILDING_ICONS[def.id];
              const count = countOfType(def.id);
              const canAdd =
                remainingBudget >= def.cost &&
                count < def.maxPerBase &&
                placedBuildings.length < BUILDER_PAD_CELL_SLOTS.length;
              const canRemove = count > 0;
              const thumbUrl = thumbs[def.id];
              const quickYield = formatQuickYield(def.id, planet.solarEfficiency);

              return (
                <div
                  key={def.id}
                  onMouseEnter={() => setFocusedTypeId(def.id)}
                  className={`rounded-2xl bg-[#0C121E] border transition-colors p-4 flex flex-col justify-between gap-3 ${
                    count > 0 ? accent.border : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* 3D Model Preview Frame */}
                    <div className="relative h-28 rounded-xl bg-gradient-to-b from-[#070B14] to-[#0E1626] border border-slate-800/90 overflow-hidden mb-3 flex items-center justify-center">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={`${def.name} 3D model`}
                          className="h-full w-full object-contain scale-105"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-2xl ${accent.bg} flex items-center justify-center`}
                        >
                          <Icon className={`w-6 h-6 ${accent.text}`} />
                        </div>
                      )}

                      <div className="absolute top-2 left-2.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-white bg-[#070B14]/90 border border-slate-700 px-2 py-0.5 rounded">
                          {def.cost} CR
                        </span>
                        {def.required && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 bg-amber-950/85 border border-amber-500/40 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>

                      <div className="absolute top-2 right-2.5 text-[11px] font-mono tabular-nums text-slate-200 bg-[#070B14]/90 border border-slate-700 px-2 py-0.5 rounded">
                        Built: {count}/{def.maxPerBase}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          {def.category}
                        </div>
                        <h2 className="font-display text-base font-bold text-white">{def.name}</h2>
                      </div>
                      <Icon className={`w-4 h-4 shrink-0 mt-1 ${accent.text}`} />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-2.5">{def.benefit}</p>

                    <div className="space-y-1.5 text-[11px] font-mono">
                      {quickYield && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-[#070A12] border border-slate-800 text-emerald-300">
                          {quickYield}
                        </div>
                      )}
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#070A12] border border-slate-800 text-amber-300/90">
                        Trade-off: {def.tradeOff}
                      </div>
                    </div>
                  </div>

                  {/* Add / Remove Controls */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={() => handleAddModule(def.id)}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        canAdd
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {count >= def.maxPerBase
                        ? 'Max Built'
                        : count > 0
                        ? `Add Another (${def.cost} CR)`
                        : `Add to Base (${def.cost} CR)`}
                    </button>

                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => handleRemoveModule(def.id)}
                        aria-label={`Remove ${def.name}`}
                        className="py-2.5 px-3 rounded-xl bg-[#070A12] hover:bg-rose-950/50 border border-slate-700 hover:border-rose-500/50 text-xs font-mono text-slate-300 hover:text-rose-300 flex items-center gap-1 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        {/* Right Side (4 cols): Compact Mission Budget Summary & Continue CTA */}
        <aside className="lg:col-span-4 rounded-2xl bg-[#0C121E] border border-slate-800 p-5 flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400">
                Mission Budget Summary
              </div>
              <h2 className="font-display text-xl font-bold text-white">Base Allocation Plan</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLoadBalancedStarter}
                title="Load recommended outpost with shelter & life support"
                className="px-2.5 py-1.5 rounded-lg bg-[#070A12] hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-sky-300 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3" /> Preset
              </button>
              <button
                type="button"
                onClick={() => setPlacedBuildings([])}
                title="Clear all modules"
                className="p-1.5 rounded-lg bg-[#070A12] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 text-slate-300">
              <span>Total Construction Budget</span>
              <span className="text-white font-bold tabular-nums">
                {totalBudget.toLocaleString()} CR
              </span>
            </div>

            <div className="rounded-xl bg-[#070A12] border border-slate-800 p-3 space-y-2 max-h-52 overflow-y-auto">
              {deployedGroups.length === 0 ? (
                <div className="text-slate-500 text-center py-2">
                  No modules placed yet. Add structures on the left.
                </div>
              ) : (
                deployedGroups.map(({ def, count }) => (
                  <div key={def.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 truncate">
                      {def.shortName} ×{count}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums font-semibold text-sky-300">
                        {count * def.cost} CR
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveModule(def.id)}
                        aria-label={`Remove one ${def.shortName}`}
                        className="p-0.5 rounded border border-slate-700 hover:border-rose-400 text-slate-400 hover:text-rose-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-1 text-sm">
              <span className="text-slate-300 font-semibold">Remaining Reserve</span>
              <span
                className={`font-bold tabular-nums text-lg ${
                  remainingBudget > 0 ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {remainingBudget.toLocaleString()} CR
              </span>
            </div>
          </div>

          {/* Engineering Net Balance Preview */}
          <div className="rounded-xl bg-[#070A12] border border-slate-800 p-3.5 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Projected Daily System Balance
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
              <div className="p-2 rounded-lg bg-[#0C121E] border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Net Power</span>
                <strong className={balance.netPower >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {balance.netPower >= 0 ? `+${balance.netPower}` : balance.netPower} kWh
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#0C121E] border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Rad Shield</span>
                <strong
                  className={
                    balance.shielding >= 60 ? 'text-emerald-400' : 'text-amber-300'
                  }
                >
                  {balance.shielding}%
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#0C121E] border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Net Oxygen</span>
                <strong className={balance.netO2 >= -4 ? 'text-sky-300' : 'text-amber-400'}>
                  {balance.netO2 >= 0 ? `+${balance.netO2}` : balance.netO2}/d
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#0C121E] border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Net Water</span>
                <strong className={balance.netH2O >= -4 ? 'text-cyan-300' : 'text-amber-400'}>
                  {balance.netH2O >= 0 ? `+${balance.netH2O}` : balance.netH2O}/d
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#0C121E] border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Net Food</span>
                <strong className={balance.netFood >= -2 ? 'text-emerald-300' : 'text-amber-400'}>
                  {balance.netFood >= 0 ? `+${balance.netFood}` : balance.netFood}/d
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#0C121E] border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Battery Cap</span>
                <strong className="text-amber-300">{balance.batteryMax} kWh</strong>
              </div>
            </div>
          </div>

          {/* Launch Prerequisites */}
          <div className="space-y-1.5 text-xs">
            <div
              className={`flex items-center gap-2 ${
                hasHabitat ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {hasHabitat ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>At least 1 Habitat Module</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                hasSolar ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {hasSolar ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>At least 1 Solar Power Array</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!canProceed}
            onClick={() => onContinueToBriefing(placedBuildings, remainingBudget)}
            className={`w-full py-3.5 px-5 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
              canProceed
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Continue to Mission Briefing
            <ArrowRight className="w-4 h-4" />
          </button>
        </aside>
      </main>
    </div>
  );
}
