import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Fan,
  Fuel,
  HeartPulse,
  Package,
  PlusCircle,
  Radio,
  Recycle,
  Sliders,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { ASTRONAUTS } from '../data/astronauts';
import { BUILDINGS, getBuildingDef } from '../data/buildings';
import { getPlanetById, PLANETS } from '../data/planets';
import {
  ACHIEVEMENT_CATALOG,
  COMMS_FAULTS,
  getSparePartDef,
  MATERIAL_LABELS,
  MEDICAL_CONDITIONS,
  SPARE_PART_DEFS,
} from '../data/systems';
import { projectWhatIfScenario } from '../simulation/calculations';
import type {
  AstronautId,
  BuildingTypeId,
  ConstructionMaterialId,
  MiniGameKind,
  MissionState,
  SparePartId,
} from '../types';

export type OpsModalKind =
  | 'fuel'
  | 'medical'
  | 'comms'
  | 'parts'
  | 'damage'
  | 'flue'
  | 'whatif'
  | 'achievements'
  | 'build_module'
  | null;

interface OperationsModalsProps {
  openModal: OpsModalKind;
  state: MissionState;
  onClose: () => void;
  // Fuel explicit actions
  onSynthesizeFuel: () => void;
  onRefuelStarship: () => void;
  // Medical actions
  onDiagnoseCrew: (id: AstronautId) => void;
  onTreatCrew: (id: AstronautId) => void;
  // Comms actions
  onCommsStep: (step: 'inspect' | 'diagnose' | 'replace' | 'test') => void;
  // Spare parts & workshop
  onCraftPart: (partId: SparePartId) => void;
  onRecycleScrap: (material: ConstructionMaterialId) => void;
  onOrderResupply: (bundle: 'spare_bundle' | 'med_bundle' | 'antenna_kit') => void;
  // Damage & Reconstruction
  onInspectBuildingDamage: (uid: string) => void;
  onRepairBuilding: (uid: string) => void;
  onCleanDust: (uid?: string) => void;
  onRepairRover: () => void;
  onRechargeRover: () => void;
  // Flue explicit purge (isolated from HUD pill)
  onPurgeFlue: () => void;
  // Build during mission
  onConstructBuilding: (typeId: BuildingTypeId, cellIndex: number) => void;
  // Mini-game launcher
  onOpenMiniGame: (kind: MiniGameKind, title: string, onWin: () => void) => void;
}

export default function OperationsModals({
  openModal,
  state,
  onClose,
  onSynthesizeFuel,
  onRefuelStarship,
  onDiagnoseCrew,
  onTreatCrew,
  onCommsStep,
  onCraftPart,
  onRecycleScrap,
  onOrderResupply,
  onInspectBuildingDamage,
  onRepairBuilding,
  onCleanDust,
  onRepairRover,
  onRechargeRover,
  onPurgeFlue,
  onConstructBuilding,
  onOpenMiniGame,
}: OperationsModalsProps) {
  const [simSolar, setSimSolar] = useState(0);
  const [simGreenhouse, setSimGreenhouse] = useState(0);
  const [simRecycler, setSimRecycler] = useState(0);
  const [simBattery, setSimBattery] = useState(0);
  const [simDays, setSimDays] = useState<7 | 14>(7);
  const [selectedBuildType, setSelectedBuildType] = useState<BuildingTypeId>('medical_station');
  const [confirmRefuel, setConfirmRefuel] = useState(false);

  const planet = getPlanetById(state.planetId);
  const hasWorkshop = state.buildings.some(
    (b) => b.typeId === 'workshop' && b.online && !b.damaged
  );
  const hasMedBay = state.buildings.some(
    (b) => b.typeId === 'medical_station' && b.online && !b.damaged
  );
  const hasCommsArray = state.buildings.some((b) => b.typeId === 'comms');
  const occupiedCells = new Set(state.buildings.map((b) => b.cellIndex));
  const freeCells = Array.from({ length: 16 }, (_, i) => i).filter(
    (i) => !occupiedCells.has(i)
  );

  if (!openModal) return null;

  const whatIf = projectWhatIfScenario(
    state,
    {
      extraSolar: simSolar,
      extraGreenhouse: simGreenhouse,
      extraRecycler: simRecycler,
      extraBattery: simBattery,
    },
    simDays
  );

  const damagedBuildings = state.buildings.filter((b) => b.damaged || b.conditionPct < 88);
  const dustyBuildings = state.buildings.filter((b) => (b.dustPct || 0) >= 18);

  return (
    <div className="fixed inset-0 z-50 astra-glass-backdrop flex items-center justify-center p-4">
      <div className="max-w-3xl w-full rounded-xl astra-glass-modal p-6 relative max-h-[88vh] overflow-y-auto shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="absolute top-4 right-4 text-slate-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. FUEL MANAGEMENT MODAL (Isolated - strictly opens Fuel UI, confirms actions) */}
        {openModal === 'fuel' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-emerald-400 uppercase flex items-center gap-1.5 mb-1">
                <Fuel className="w-4 h-4" /> Propellant &amp; Starship Refueling Console
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Outpost Fuel Reserves &amp; ISRU Transfer
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Opening this panel performs no automatic tasks. Choose an explicit propellant
                operation below.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">Base Propellant Reserve</div>
                <div className="text-xl font-bold text-white">
                  {state.fuel.current} / {state.fuel.max} t
                </div>
              </div>
              <div className="p-3.5 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">Starship Main Tank</div>
                <div className="text-xl font-bold text-emerald-400">{state.fuel.shipTankPct}%</div>
              </div>
              <div className="p-3.5 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">ISRU Synthesis Rate</div>
                <div className="text-xl font-bold text-cyan-300">
                  +{state.lastRates.fuelProd} t/day
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg astra-glass-subtle text-xs text-slate-200">
              <strong className="text-cyan-300">Last Propellant Log:</strong>{' '}
              {state.fuel.lastActionNote}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={state.resources.water.current < 8}
                onClick={onSynthesizeFuel}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  state.resources.water.current >= 8
                    ? 'astra-glass-subtle border-cyan-400/50 hover:border-cyan-300'
                    : 'astra-glass-subtle opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="font-display font-bold text-sm text-white mb-1">
                  Run Sabatier ISRU Synthesis (+18 t Fuel)
                </div>
                <div className="text-xs text-slate-300">
                  Electrolyzes -6 Water &amp; converts atmospheric/oxide feedstock into Methalox.
                </div>
              </button>

              {!confirmRefuel ? (
                <button
                  type="button"
                  disabled={state.fuel.current < 15 || state.fuel.shipTankPct >= 100}
                  onClick={() => setConfirmRefuel(true)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    state.fuel.current >= 15 && state.fuel.shipTankPct < 100
                      ? 'astra-glass-subtle border-emerald-400/50 hover:border-emerald-300'
                      : 'astra-glass-subtle opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="font-display font-bold text-sm text-white mb-1">
                    Transfer Fuel to NASA Starship (+25% Tank)
                  </div>
                  <div className="text-xs text-slate-300">
                    Pumps -15 t from base reserve to Starship tanks (requires confirmation).
                  </div>
                </button>
              ) : (
                <div className="p-4 rounded-lg astra-glass-success flex flex-col justify-between gap-2">
                  <div className="text-xs text-emerald-100 font-semibold">
                    Confirm Propellant Transfer (-15 t Reserve → +25% Starship Tank)?
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRefuel(false);
                        onOpenMiniGame(
                          'fuel_transfer',
                          'Starship Cryogenic Propellant Transfer',
                          onRefuelStarship
                        );
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                    >
                      Calibrate &amp; Pump
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRefuel(false)}
                      className="px-3 py-1.5 rounded astra-glass-subtle text-xs text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. MEDICAL EMERGENCY & CREW HEALTH MODAL */}
        {openModal === 'medical' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-rose-400 uppercase flex items-center gap-1.5 mb-1">
                  <HeartPulse className="w-4 h-4" /> Crew Medical Station &amp; Biometrics
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Astronaut Health, Diagnosis &amp; Treatment
                </h3>
              </div>
              <div className="px-3 py-1.5 rounded-lg astra-glass-subtle text-xs font-mono">
                Medkits: <strong className="text-emerald-400">{state.resources.medSupplies}</strong>{' '}
                · Med Bay:{' '}
                <strong className={hasMedBay ? 'text-emerald-400' : 'text-amber-400'}>
                  {hasMedBay ? 'Online' : 'Not Built'}
                </strong>
              </div>
            </div>

            {!hasMedBay && (
              <div className="p-3 rounded-lg astra-glass-warn text-xs text-amber-100">
                Tip: Build a <strong>Medical Bay</strong> module for automated passive fatigue
                recovery and faster medical treatments.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ASTRONAUTS.map((astro) => {
                const v = state.crewVitals[astro.id];
                const cond = v.medicalAlert ? MEDICAL_CONDITIONS[v.medicalAlert] : null;
                return (
                  <div
                    key={astro.id}
                    className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                      cond
                        ? 'astra-glass-alert'
                        : 'astra-glass-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: astro.suitColor }}
                        />
                        <span className="font-display font-bold text-sm text-white">
                          {astro.name}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          v.healthPct >= 75
                            ? 'text-emerald-400'
                            : v.healthPct >= 50
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        Health {v.healthPct}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] text-slate-200">
                      <div className="p-1.5 rounded bg-slate-950/45 border border-white/10">
                        Hydration: <strong className="text-cyan-300">{v.hydrationPct}%</strong>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/45 border border-white/10">
                        Fatigue: <strong className="text-amber-300">{v.fatiguePct}%</strong>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/45 border border-white/10">
                        Rad: <strong className="text-rose-300">{v.radiationPct}%</strong>
                      </div>
                    </div>

                    {cond ? (
                      <div className="pt-1 border-t border-rose-500/30 space-y-2">
                        <div className="text-rose-300 font-semibold">
                          Alert: {v.diagnosed ? cond.title : 'Unidentified Medical Symptom'}
                        </div>
                        <div className="text-slate-300">
                          {v.diagnosed
                            ? cond.symptoms
                            : 'Run diagnostic bio-scan to identify condition before treatment.'}
                        </div>
                        {!v.diagnosed ? (
                          <button
                            type="button"
                            onClick={() => onDiagnoseCrew(astro.id)}
                            className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                          >
                            1. Diagnose Vitals
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              state.resources.medSupplies < cond.medCost ||
                              state.resources.water.current < cond.waterCost
                            }
                            onClick={() => onTreatCrew(astro.id)}
                            className={`w-full py-1.5 rounded font-bold ${
                              state.resources.medSupplies >= cond.medCost &&
                              state.resources.water.current >= cond.waterCost
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            2. {cond.treatmentLabel}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-emerald-400">
                        ● Cleared for EVA &amp; Engineering Operations
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. COMMUNICATIONS STATION MODAL */}
        {openModal === 'comms' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-sky-400 uppercase flex items-center gap-1.5 mb-1">
                <Radio className="w-4 h-4" /> Deep-Space Communications Station
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Earth Uplink, Telemetry Window &amp; Antenna Repair
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Signal Strength</div>
                <div
                  className={`text-lg font-bold ${
                    state.comms.signalStrengthPct >= 65
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {state.comms.signalStrengthPct}%
                </div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Comms Window</div>
                <div
                  className={`text-lg font-bold ${
                    state.comms.windowOpen ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {state.comms.windowOpen ? 'OPEN' : 'OCCULTED'}
                </div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Earth Visibility</div>
                <div className="text-lg font-bold text-cyan-300">
                  {state.comms.earthVisibilityPct}%
                </div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Range / Latency</div>
                <div className="text-sm font-bold text-white">
                  {state.comms.rangeKm.toLocaleString()} km
                </div>
                <div className="text-[10px] text-slate-300">{state.comms.latencySec}s one-way</div>
              </div>
            </div>

            {state.comms.fault ? (
              <div className="p-4 rounded-xl astra-glass-alert space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold text-base text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Comms Disruption Active
                  </div>
                  <span className="text-xs font-mono text-amber-300 uppercase">
                    Step: {state.comms.repairStep}
                  </span>
                </div>

                {(() => {
                  const fault = COMMS_FAULTS[state.comms.fault];
                  const partDef = getSparePartDef(fault.requiredPart);
                  const partStock = state.spareParts[fault.requiredPart] || 0;
                  const hasPart = partStock >= fault.requiredQty;

                  return (
                    <>
                      <p className="text-xs text-slate-200">
                        {state.comms.repairStep === 'none'
                          ? 'Signal degraded. Dispatch an engineer to inspect the external antenna mast.'
                          : `Fault Diagnosed: ${fault.title} — ${fault.symptom} (${fault.repairNote})`}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <button
                          type="button"
                          disabled={state.comms.repairStep !== 'none'}
                          onClick={() => onCommsStep('inspect')}
                          className={`py-2 px-2.5 rounded-lg font-semibold ${
                            state.comms.repairStep === 'none'
                              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                              : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          1. Inspect Dish
                        </button>
                        <button
                          type="button"
                          disabled={state.comms.repairStep !== 'inspected'}
                          onClick={() => onCommsStep('diagnose')}
                          className={`py-2 px-2.5 rounded-lg font-semibold ${
                            state.comms.repairStep === 'inspected'
                              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                              : state.comms.repairStep === 'none'
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          2. Identify Fault
                        </button>
                        <button
                          type="button"
                          disabled={state.comms.repairStep !== 'diagnosed' || !hasPart}
                          onClick={() => onCommsStep('replace')}
                          className={`py-2 px-2.5 rounded-lg font-semibold ${
                            state.comms.repairStep === 'diagnosed' && hasPart
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : state.comms.repairStep === 'parts_replaced'
                              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          3. Use {fault.requiredQty}× {partDef.shortName} ({partStock})
                        </button>
                        <button
                          type="button"
                          disabled={state.comms.repairStep !== 'parts_replaced'}
                          onClick={() =>
                            onOpenMiniGame(
                              'antenna_align',
                              'Align Parabolic Dish & Verify Carrier',
                              () => onCommsStep('test')
                            )
                          }
                          className={`py-2 px-2.5 rounded-lg font-semibold ${
                            state.comms.repairStep === 'parts_replaced'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          4. Test &amp; Restore
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-4 rounded-lg astra-glass-success text-xs text-emerald-100 flex items-center justify-between gap-3">
                <span>
                  ● Deep-Space Comms Array operational.{' '}
                  {hasCommsArray
                    ? 'Active dish improves early hazard detection & +Science output.'
                    : 'Optional: Deploy a Comms Array module to boost signal gain & Earth alerts.'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenMiniGame('antenna_align', 'Fine-Tune Earth Carrier Lock (+4 SCI)', () =>
                      onCommsStep('test')
                    )
                  }
                  className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 font-bold shrink-0"
                >
                  Calibrate (+4 SCI)
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. SPARE PARTS, MATERIALS & WORKSHOP MODAL */}
        {openModal === 'parts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-amber-400 uppercase flex items-center gap-1.5 mb-1">
                  <Package className="w-4 h-4" /> Spare Parts, Materials &amp; Manufacturing
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Outpost Logistics Inventory
                </h3>
              </div>
              <div className="text-xs font-mono text-slate-200">
                Workshop:{' '}
                <strong className={hasWorkshop ? 'text-emerald-400' : 'text-amber-400'}>
                  {hasWorkshop ? 'Online' : 'Build to Craft'}
                </strong>{' '}
                · Budget: <strong className="text-emerald-400">{state.budget} CR</strong>
              </div>
            </div>

            {/* Raw Construction Materials */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              {(Object.keys(MATERIAL_LABELS) as ConstructionMaterialId[]).map((matId) => {
                const meta = MATERIAL_LABELS[matId];
                return (
                  <div
                    key={matId}
                    className="p-3 rounded-lg astra-glass-subtle flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-slate-300 text-[11px]">{meta.name}</div>
                      <div className={`font-mono font-bold text-base ${meta.colorClass}`}>
                        {state.materials[matId]} {meta.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRecycleScrap(matId)}
                      title="Recycle EVA scrap into raw materials (+2)"
                      className="p-1.5 rounded astra-glass-subtle hover:border-cyan-400 text-cyan-300"
                    >
                      <Recycle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 8 Spare Parts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {SPARE_PART_DEFS.map((part) => {
                const qty = state.spareParts[part.id] || 0;
                const low = qty < part.criticalMin;
                const canCraft =
                  hasWorkshop &&
                  Object.entries(part.craftMaterials).every(
                    ([m, need]) => (state.materials[m as ConstructionMaterialId] || 0) >= (need || 0)
                  );
                const matRecipe = Object.entries(part.craftMaterials)
                  .map(([m, n]) => `${n}× ${m.replace('_', ' ')}`)
                  .join(' + ');

                return (
                  <div
                    key={part.id}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                      low
                        ? 'astra-glass-warn'
                        : 'astra-glass-subtle'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{part.name}</span>
                        {low && (
                          <span className="text-[10px] font-mono text-amber-300 font-bold">
                            LOW STOCK
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5 truncate">{part.purpose}</div>
                      <div className="text-[10px] font-mono text-cyan-300 mt-0.5">
                        Craft: {matRecipe}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-mono font-bold text-sm text-white">Qty: {qty}</span>
                      <button
                        type="button"
                        disabled={!canCraft}
                        onClick={() => onCraftPart(part.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          canCraft
                            ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                            : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Fabricate +2
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cargo Resupply Requests */}
            <div className="p-3.5 rounded-lg astra-glass-subtle space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-300 uppercase flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Request Earth Resupply Cargo (Arrives in{' '}
                  {planet.resupplyDays} days)
                </span>
                <span className="text-slate-300">
                  In Transit: {state.pendingResupply.length} pod(s)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  disabled={state.budget < 90}
                  onClick={() => onOrderResupply('spare_bundle')}
                  className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400 disabled:opacity-45 text-left"
                >
                  <div className="font-bold text-white">Engineering Kit · 90 CR</div>
                  <div className="text-[11px] text-slate-300">+3 Cables, Seals, Filters, Mech</div>
                </button>
                <button
                  type="button"
                  disabled={state.budget < 85}
                  onClick={() => onOrderResupply('med_bundle')}
                  className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400 disabled:opacity-45 text-left"
                >
                  <div className="font-bold text-white">Medical &amp; Battery Pod · 85 CR</div>
                  <div className="text-[11px] text-slate-300">+5 Medkits, +3 Batteries</div>
                </button>
                <button
                  type="button"
                  disabled={state.budget < 95}
                  onClick={() => onOrderResupply('antenna_kit')}
                  className="p-2.5 rounded-lg astra-glass-subtle hover:border-cyan-400 disabled:opacity-45 text-left"
                >
                  <div className="font-bold text-white">Avionics &amp; Antenna · 95 CR</div>
                  <div className="text-[11px] text-slate-300">+2 Antenna, +2 Boards, +2 Tools</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. DAMAGE ASSESSMENT & RECONSTRUCTION MODAL */}
        {openModal === 'damage' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-amber-400 uppercase flex items-center gap-1.5 mb-1">
                  <Wrench className="w-4 h-4" /> Post-Event Damage &amp; Dust Maintenance
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Structural Inspection &amp; Reconstruction
                </h3>
              </div>
              <button
                type="button"
                disabled={dustyBuildings.length === 0 && state.lunarState.lunarDustPct < 10}
                onClick={() => onCleanDust()}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs"
              >
                Clean Regolith Dust Across Outpost
              </button>
            </div>

            {/* Rover & Field Tools Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg astra-glass-subtle flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">Autonomous Surface Rover</div>
                  <div className="font-mono text-[11px] text-slate-300">
                    Integrity: {state.rover.conditionPct}% · Battery: {state.rover.chargePct}% · Dust:{' '}
                    {state.rover.dustPct}%
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {state.rover.chargePct < 90 && (
                    <button
                      type="button"
                      onClick={onRechargeRover}
                      className="px-2.5 py-1 rounded bg-cyan-400 text-slate-950 font-bold"
                    >
                      Charge
                    </button>
                  )}
                  {(state.rover.damaged || state.rover.conditionPct < 90) && (
                    <button
                      type="button"
                      disabled={(state.spareParts.mechanical_parts || 0) < 1}
                      onClick={onRepairRover}
                      className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold disabled:opacity-45"
                    >
                      Repair (1 Mech)
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg astra-glass-subtle flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">EVA Toolkit &amp; Instrumentation</div>
                  <div className="font-mono text-[11px] text-slate-300">
                    Condition: {state.toolsConditionPct}% · Tool Stock:{' '}
                    {state.spareParts.repair_tools || 0}
                  </div>
                </div>
                <span className="font-mono text-emerald-400 font-bold">
                  {state.toolsConditionPct >= 75 ? 'Nominal' : 'Worn'}
                </span>
              </div>
            </div>

            {damagedBuildings.length === 0 ? (
              <div className="p-4 rounded-lg astra-glass-success text-xs text-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                All outpost modules have high structural integrity. Any dust accumulation above 18%
                can be brushed off to preserve solar output.
              </div>
            ) : (
              <div className="space-y-2.5">
                {damagedBuildings.map((b) => {
                  const def = getBuildingDef(b.typeId);
                  const partEntries = Object.entries(b.requiredParts) as Array<[SparePartId, number]>;
                  const hasAllParts = partEntries.every(
                    ([pid, req]) => (state.spareParts[pid] || 0) >= req
                  );

                  return (
                    <div
                      key={b.uid}
                      className="p-4 rounded-lg astra-glass-alert flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-display font-bold text-sm text-white">
                          {def?.name} (Sector S{String(b.cellIndex + 1).padStart(2, '0')})
                        </div>
                        <div className="font-mono text-rose-300 mt-0.5">
                          Condition: {Math.round(b.conditionPct)}% ·{' '}
                          {b.damageCause || 'Structural wear'}
                        </div>
                        {b.inspectedDamage && partEntries.length > 0 && (
                          <div className="text-amber-300 font-mono mt-1">
                            Required:{' '}
                            {partEntries
                              .map(
                                ([pid, qty]) =>
                                  `${qty}× ${getSparePartDef(pid).shortName} (${state.spareParts[pid] || 0} in stock)`
                              )
                              .join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!b.inspectedDamage ? (
                          <button
                            type="button"
                            onClick={() => onInspectBuildingDamage(b.uid)}
                            className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold"
                          >
                            1. Inspect Damage
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!hasAllParts}
                            onClick={() =>
                              onOpenMiniGame(
                                'circuit_patch',
                                `Reconstruct ${def?.shortName || 'Module'}`,
                                () => onRepairBuilding(b.uid)
                              )
                            }
                            className={`px-3 py-1.5 rounded font-bold ${
                              hasAllParts
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            2. Repair &amp; Calibrate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. STORM FLUE DIAGNOSTICS MODAL (Isolated from top HUD pill) */}
        {openModal === 'flue' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-amber-400 uppercase flex items-center gap-1.5 mb-1">
                <Fan className="w-4 h-4" /> Storm Flue Exhaust Diagnostics
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Intake Filtration &amp; Pressure Telemetry
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Dust / Ice Clog</div>
                <div className="text-xl font-bold text-amber-300">
                  {state.stormFlue.cloggedPct}%
                </div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Pressure</div>
                <div className="text-xl font-bold text-white">
                  {state.stormFlue.pressureKpa} kPa
                </div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Exhaust Temp</div>
                <div className="text-xl font-bold text-cyan-300">
                  {state.stormFlue.exhaustTempC} °C
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg astra-glass-subtle text-xs text-slate-200 hover:border-cyan-400/50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenMiniGame('thermal_valve', 'Balance Storm Flue Exhaust Valves', onPurgeFlue)
                }
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5"
              >
                <Fan className="w-3.5 h-3.5" /> Purge Storm Flue (0% Clog)
              </button>
            </div>
          </div>
        )}

        {/* 7. WHAT-IF ENGINEERING SIMULATOR MODAL */}
        {openModal === 'whatif' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-cyan-300 uppercase flex items-center gap-1.5 mb-1">
                <Sliders className="w-4 h-4" /> STEM Engineering What-If Predictor
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Compare Outpost Expansion Forecasts
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">+Solar Arrays: {simSolar}</div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  value={simSolar}
                  onChange={(e) => setSimSolar(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">+Greenhouses: {simGreenhouse}</div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  value={simGreenhouse}
                  onChange={(e) => setSimGreenhouse(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">+Recyclers: {simRecycler}</div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  value={simRecycler}
                  onChange={(e) => setSimRecycler(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300 mb-1">+Batteries: {simBattery}</div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  value={simBattery}
                  onChange={(e) => setSimBattery(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-300">Horizon:</span>
              {([7, 14] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSimDays(d)}
                  className={`px-3 py-1 rounded ${
                    simDays === d
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'astra-glass-subtle text-slate-200'
                  }`}
                >
                  {d} Days
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">End O₂</div>
                <div className="text-lg font-bold text-white">{whatIf.endOxygen}%</div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">End H₂O</div>
                <div className="text-lg font-bold text-cyan-300">{whatIf.endWater}%</div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">End Food</div>
                <div className="text-lg font-bold text-emerald-300">{whatIf.endFood}%</div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">End Power</div>
                <div className="text-lg font-bold text-amber-300">{whatIf.endPowerPct}%</div>
              </div>
              <div className="p-3 rounded-lg astra-glass-subtle">
                <div className="text-slate-300">Brownouts</div>
                <div className="text-lg font-bold text-rose-300">{whatIf.brownoutDays}d</div>
              </div>
            </div>

            {whatIf.criticalWarning && (
              <div className="p-3 rounded-lg astra-glass-warn text-xs text-amber-100">
                <strong>Projection Alert:</strong> {whatIf.criticalWarning}
              </div>
            )}
          </div>
        )}

        {/* 8. ACHIEVEMENTS & WORLD PHYSICS GUIDE */}
        {openModal === 'achievements' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-amber-400 uppercase flex items-center gap-1.5 mb-1">
                <Award className="w-4 h-4" /> Exploration Achievements &amp; Planetary Reference
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Earned Honors ({state.achievements.length}/{ACHIEVEMENT_CATALOG.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {ACHIEVEMENT_CATALOG.map((ach) => {
                const earned = state.achievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`p-3 rounded-lg border ${
                      earned
                        ? 'astra-glass-success'
                        : 'astra-glass-subtle opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>{ach.title}</span>
                      {earned && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="text-slate-300 mt-0.5">{ach.desc}</div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/15">
              <div className="text-xs font-mono text-cyan-300 uppercase mb-2">
                Planetary Physics Reference
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                {PLANETS.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-lg astra-glass-subtle">
                    <div className="font-bold text-white">{p.name}</div>
                    <div className="text-cyan-300">g = {p.gravityMs2} m/s²</div>
                    <div className="text-slate-300">{p.atmosphereKpa} kPa</div>
                    <div className="text-amber-300">{p.tempRangeC}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 9. MID-MISSION MODULE CONSTRUCTION */}
        {openModal === 'build_module' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-emerald-400 uppercase flex items-center gap-1.5 mb-1">
                  <PlusCircle className="w-4 h-4" /> Mid-Mission Base Expansion
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Construct New Outpost Module
                </h3>
              </div>
              <div className="text-xs font-mono text-emerald-400 font-bold">
                Budget: {state.budget} CR
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {BUILDINGS.map((b) => {
                const count = state.buildings.filter((pb) => pb.typeId === b.id).length;
                const maxed = count >= b.maxPerBase;
                const affordable = state.budget >= b.cost;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBuildType(b.id)}
                    className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 ${
                      selectedBuildType === b.id
                        ? 'bg-cyan-500/20 border-cyan-400'
                        : 'astra-glass-subtle hover:border-cyan-400/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{b.name}</div>
                      <div className="text-[11px] text-slate-300 truncate">
                        {count}/{b.maxPerBase} built · {b.category}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        maxed ? 'text-slate-500' : affordable ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {maxed ? 'MAX' : `${b.cost} CR`}
                    </span>
                  </button>
                );
              })}
            </div>

            {(() => {
              const def = getBuildingDef(selectedBuildType);
              const count = state.buildings.filter((b) => b.typeId === selectedBuildType).length;
              const canBuild =
                def &&
                count < def.maxPerBase &&
                state.budget >= def.cost &&
                freeCells.length > 0;
              return (
                <div className="p-3.5 rounded-lg astra-glass-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="max-w-md text-slate-200">{def?.benefit}</div>
                  <button
                    type="button"
                    disabled={!canBuild}
                    onClick={() => {
                      if (canBuild && freeCells.length > 0) {
                        onConstructBuilding(selectedBuildType, freeCells[0]);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-display font-bold ${
                      canBuild
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {freeCells.length === 0
                      ? 'No Open Sectors'
                      : `Deploy (${def?.cost || 0} CR)`}
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
