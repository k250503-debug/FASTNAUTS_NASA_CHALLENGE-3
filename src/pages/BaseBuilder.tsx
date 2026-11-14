import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  Droplets,
  Home,
  Pickaxe,
  Radio,
  Rocket,
  Shield,
  Sprout,
  Sun,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Navbar from '../components/Navbar';
import { BUILDINGS, getBuildingDef } from '../data/buildings';
import { DIFFICULTIES, PLANETS } from '../data/planets';
import type { BuildingTypeId, MissionConfig, PlacedBuilding } from '../types';

export const BUILDING_ICONS: Record<BuildingTypeId, LucideIcon> = {
  habitat: Home,
  solar: Sun,
  battery: BatteryCharging,
  water_recycler: Droplets,
  greenhouse: Sprout,
  isru_plant: Pickaxe,
  radiation_shelter: Shield,
  comms: Radio,
};

interface BaseBuilderProps {
  config: MissionConfig;
  onBack: () => void;
  onLaunchMission: (placedBuildings: PlacedBuilding[], remainingBudget: number) => void;
  onGoHome: () => void;
}

export default function BaseBuilder({
  config,
  onBack,
  onLaunchMission,
  onGoHome,
}: BaseBuilderProps) {
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[1];
  const planet = PLANETS.find((p) => p.id === config.planetId) || PLANETS[0];

  const totalBudget = difficulty.budget;
  const [grid, setGrid] = useState<(PlacedBuilding | null)[]>(Array(12).fill(null));
  const [selectedToolId, setSelectedToolId] = useState<BuildingTypeId>('habitat');

  const placedBuildings = grid.filter((b): b is PlacedBuilding => b !== null);
  const spentBudget = placedBuildings.reduce(
    (sum, b) => sum + (getBuildingDef(b.typeId)?.cost || 0),
    0
  );
  const remainingBudget = totalBudget - spentBudget;

  const hasHabitat = placedBuildings.some((b) => b.typeId === 'habitat');
  const hasSolar = placedBuildings.some((b) => b.typeId === 'solar');
  const canLaunch = hasHabitat && hasSolar;

  const selectedDef = getBuildingDef(selectedToolId);
  const countOfType = (typeId: BuildingTypeId) =>
    placedBuildings.filter((b) => b.typeId === typeId).length;

  const handleCellClick = (cellIdx: number) => {
    const existing = grid[cellIdx];
    if (existing) {
      const next = [...grid];
      next[cellIdx] = null;
      setGrid(next);
      return;
    }

    if (!selectedDef) return;
    if (remainingBudget < selectedDef.cost) return;
    if (countOfType(selectedDef.id) >= selectedDef.maxPerBase) return;

    const next = [...grid];
    next[cellIdx] = {
      uid: `${selectedDef.id}-${cellIdx}-${Date.now()}`,
      typeId: selectedDef.id,
      level: 1,
      online: true,
      cellIndex: cellIdx,
    };
    setGrid(next);
  };

  const handleAutoStarter = () => {
    const starterGrid: (PlacedBuilding | null)[] = Array(12).fill(null);
    const starterIds: BuildingTypeId[] = ['habitat', 'solar', 'water_recycler', 'battery'];
    if (totalBudget >= 1000) starterIds.push('greenhouse');
    if (totalBudget >= 1300) starterIds.push('radiation_shelter');

    let budgetLeft = totalBudget;
    const placementSlots = [5, 1, 6, 2, 9, 4];

    starterIds.forEach((id, i) => {
      const def = getBuildingDef(id);
      if (def && budgetLeft >= def.cost) {
        const slot = placementSlots[i];
        starterGrid[slot] = {
          uid: `${id}-${slot}-${Date.now() + i}`,
          typeId: id,
          level: 1,
          online: true,
          cellIndex: slot,
        };
        budgetLeft -= def.cost;
      }
    });
    setGrid(starterGrid);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] hud-grid">
      <Navbar
        showLandingNav={false}
        onGoHome={onGoHome}
        stepText="Step 4 of 4 · Outpost Architect"
      />

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Briefing
            </button>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Outpost Builder · {planet.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Select a module on the left and click any sector cell to deploy. Click a placed
              module to remove and refund credits.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAutoStarter}
              className="px-3.5 py-2 rounded-lg bg-space-900 hover:bg-space-800 border border-slate-700 text-xs font-medium text-sky-300 transition-colors whitespace-nowrap"
            >
              Load Starter Layout
            </button>
            <button
              type="button"
              onClick={() => setGrid(Array(12).fill(null))}
              className="px-3.5 py-2 rounded-lg bg-space-900 hover:bg-space-800 border border-slate-800 text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Clear Grid
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          {/* Left Sidebar: Module Inventory */}
          <aside className="lg:col-span-3 rounded-xl bg-space-900 border border-slate-800 p-4 flex flex-col gap-2">
            <div className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-1">
              Module Inventory
            </div>
            {BUILDINGS.map((b) => {
              const Icon = BUILDING_ICONS[b.id];
              const count = countOfType(b.id);
              const isSelected = selectedToolId === b.id;
              const tooExpensive = remainingBudget < b.cost;
              const maxedOut = count >= b.maxPerBase;

              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setSelectedToolId(b.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-400'
                      : 'bg-space-950 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-space-900 border border-slate-700 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {b.shortName}
                        {b.required && (
                          <span className="text-[10px] font-mono text-amber-400 ml-1.5">
                            Req
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-400">
                        Built: {count}/{b.maxPerBase}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-mono tabular-nums text-xs font-semibold shrink-0 ${
                      maxedOut
                        ? 'text-slate-500'
                        : tooExpensive
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {b.cost} CR
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Center: Planetary Surface Grid */}
          <section
            className={`lg:col-span-6 rounded-xl border p-5 flex flex-col justify-between ${
              planet.id === 'moon'
                ? 'bg-gradient-to-b from-slate-900/90 via-[#0C1322] to-slate-950 border-slate-800'
                : 'bg-gradient-to-b from-[#1E110C] via-[#190E0A] to-[#110906] border-amber-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-mono text-slate-400">{planet.location}</div>
                <div className="text-sm font-semibold text-white">
                  Base Construction Grid (4 × 3 Sectors)
                </div>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-400">
                {placedBuildings.length} / 12 Slots Used
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 my-auto">
              {grid.map((cell, idx) => {
                const def = cell ? getBuildingDef(cell.typeId) : null;
                const Icon = cell ? BUILDING_ICONS[cell.typeId] : null;
                const canAffordSelected =
                  selectedDef &&
                  remainingBudget >= selectedDef.cost &&
                  countOfType(selectedDef.id) < selectedDef.maxPerBase;

                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleCellClick(idx)}
                    title={
                      cell && def
                        ? `Click to remove ${def.name}`
                        : `Deploy ${selectedDef?.name || 'module'} here`
                    }
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center p-2 transition-colors relative group ${
                      cell
                        ? 'bg-space-900 border-sky-400/70 hover:border-rose-400'
                        : canAffordSelected
                        ? 'bg-black/30 border-dashed border-slate-600 hover:border-sky-400 hover:bg-sky-500/10'
                        : 'bg-black/20 border-dashed border-slate-800 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="absolute top-1.5 left-2 text-[10px] font-mono text-slate-500">
                      S{String(idx + 1).padStart(2, '0')}
                    </span>

                    {cell && Icon && def ? (
                      <>
                        <Icon className="w-6 h-6 text-sky-300 mb-1.5 group-hover:hidden" />
                        <Trash2 className="w-6 h-6 text-rose-400 mb-1.5 hidden group-hover:block" />
                        <span className="text-xs font-semibold text-white text-center leading-tight">
                          {def.shortName}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-emerald-400 mt-0.5">
                          {def.cost} CR
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 group-hover:text-sky-300">
                        + Deploy
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs">
              <div
                className={`flex items-center gap-1.5 ${
                  hasHabitat ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {hasHabitat ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                1+ Habitat Module
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasSolar ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {hasSolar ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                1+ Solar Array
              </div>
              <span className="text-slate-400 ml-auto">
                Unspent credits carry into Mission Operations Reserve.
              </span>
            </div>
          </section>

          {/* Right Sidebar: Selected Building Information */}
          <aside className="lg:col-span-3 rounded-xl bg-space-900 border border-slate-800 p-5 flex flex-col justify-between">
            {selectedDef && (
              <div>
                <div className="text-xs font-mono text-sky-400 mb-1">
                  {selectedDef.category}
                </div>
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  {selectedDef.name}
                </h2>

                <div className="space-y-2 mb-5 text-xs">
                  <div className="flex justify-between p-2.5 rounded-lg bg-space-950 border border-slate-800">
                    <span className="text-slate-400">Construction Cost</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-400">
                      {selectedDef.cost} CR
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-space-950 border border-slate-800">
                    <span className="text-slate-400">Power Balance</span>
                    <span
                      className={`font-mono tabular-nums font-bold ${
                        selectedDef.powerGen ? 'text-amber-400' : 'text-sky-300'
                      }`}
                    >
                      {selectedDef.powerGen
                        ? `+${selectedDef.powerGen} kWh/day`
                        : `-${selectedDef.powerReq} kWh/day`}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-space-950 border border-slate-800">
                    <span className="text-slate-400">Water Demand</span>
                    <span className="font-mono tabular-nums font-bold text-cyan-300">
                      {selectedDef.waterReq > 0
                        ? `-${selectedDef.waterReq} units/day`
                        : 'None'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-space-950 border border-slate-800">
                    <div className="text-slate-400 mb-1">Production & Protection</div>
                    <div className="font-mono text-white space-y-0.5">
                      {selectedDef.produces.oxygen > 0 && (
                        <div>+{selectedDef.produces.oxygen} Oxygen / day</div>
                      )}
                      {selectedDef.produces.water > 0 && (
                        <div>+{selectedDef.produces.water} Water / day</div>
                      )}
                      {selectedDef.produces.food > 0 && (
                        <div>+{selectedDef.produces.food} Food / day</div>
                      )}
                      {selectedDef.batteryBonus > 0 && (
                        <div>+{selectedDef.batteryBonus} kWh Battery Capacity</div>
                      )}
                      {selectedDef.shieldingBonus > 0 && (
                        <div>+{selectedDef.shieldingBonus}% Shielding</div>
                      )}
                      {selectedDef.id === 'comms' && (
                        <div>Early Alerts & +Science Output</div>
                      )}
                      {selectedDef.id === 'solar' && <div>Clean Solar Generation</div>}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-semibold text-white mb-1">Engineering Benefits</div>
                    <p className="text-slate-300 leading-relaxed">{selectedDef.benefit}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-space-950 border border-amber-500/30">
                    <div className="font-semibold text-amber-300 mb-0.5">System Trade-off</div>
                    <p className="text-slate-300 leading-relaxed">{selectedDef.tradeOff}</p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Bottom Budget Bar & Launch CTA */}
        <div className="rounded-xl bg-space-900 border border-slate-800 p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-2/3">
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-400 uppercase">Remaining Construction Budget</span>
              <span className="text-white font-bold tabular-nums">
                {remainingBudget.toLocaleString()} / {totalBudget.toLocaleString()} credits
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-space-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-300"
                style={{ width: `${Math.max(0, (remainingBudget / totalBudget) * 100)}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!canLaunch}
            onClick={() => onLaunchMission(placedBuildings, remainingBudget)}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-lg font-display font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              canLaunch
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Rocket className="w-5 h-5" />
            Launch Outpost Mission
          </button>
        </div>
      </div>
    </div>
  );
}
