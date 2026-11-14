import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Droplets,
  FlaskConical,
  Orbit,
  Plus,
  Radio,
  RotateCcw,
  Sun,
  Truck,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { EQUIPMENT_CATALOG, getEquipmentById } from '../data/equipment';
import EquipmentShowcase3D, { type EquipmentCameraAngle } from '../three/EquipmentShowcase3D';
import { playSpaceSfx } from '../utils/spaceAudio';
import type { EquipmentId } from '../types';

const EQUIP_ICONS: Record<EquipmentId, React.ComponentType<{ className?: string }>> = {
  solar_array: Sun,
  solar_water_cycle: Droplets,
  water_collector: Orbit,
  oxygen_generator: Cpu,
  exploration_rover: Truck,
  comms_array: Radio,
  science_spectrometer: FlaskConical,
};

interface EquipmentSideDockProps {
  inventory: EquipmentId[];
  onInspectEquipment: (id: EquipmentId) => void;
  isMuted?: boolean;
}

export function EquipmentSideDock({
  inventory,
  onInspectEquipment,
  isMuted = false,
}: EquipmentSideDockProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside className="hidden md:flex items-start z-20 absolute left-3 top-20 pointer-events-auto">
      <motion.div
        animate={{ width: collapsed ? 46 : 246 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl bg-[#0B111C]/95 border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
      >
        <button
          type="button"
          onClick={() => {
            playSpaceSfx('ui_click', isMuted);
            setCollapsed((c) => !c);
          }}
          title={collapsed ? 'Expand Equipment Showcase Side Rail' : 'Collapse Equipment Rail'}
          className="w-full px-3 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-cyan-300 hover:bg-slate-800/70 transition-colors"
        >
          {!collapsed && <span className="truncate font-semibold">3D Equipment</span>}
          {collapsed ? (
            <ChevronRight className="w-4 h-4 mx-auto shrink-0" />
          ) : (
            <ChevronLeft className="w-4 h-4 shrink-0" />
          )}
        </button>

        <div className="p-1.5 flex flex-col gap-1">
          {EQUIPMENT_CATALOG.map((item) => {
            const Icon = EQUIP_ICONS[item.id];
            const owned = inventory.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                title={`${item.name} — Inspect 3D Model`}
                onClick={() => {
                  playSpaceSfx(
                    item.id === 'solar_water_cycle' ? 'water_cycle' : 'deploy',
                    isMuted
                  );
                  onInspectEquipment(item.id);
                }}
                className="w-full px-2 py-2 rounded-lg bg-[#07090E]/90 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-400/60 text-left flex items-center gap-2.5 transition-colors group"
              >
                <Icon className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-slate-100 truncate">
                      {item.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {owned ? 'In Inventory' : item.category}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </aside>
  );
}

interface EquipmentShowcaseModalProps {
  initialEquipmentId?: EquipmentId;
  inventory: EquipmentId[];
  onAddEquipment: (id: EquipmentId) => void;
  onClose: () => void;
  isMuted?: boolean;
  actionButtonLabel?: string;
}

export default function EquipmentShowcaseModal({
  initialEquipmentId = 'solar_array',
  inventory,
  onAddEquipment,
  onClose,
  isMuted = false,
  actionButtonLabel,
}: EquipmentShowcaseModalProps) {
  const [selectedId, setSelectedId] = useState<EquipmentId>(initialEquipmentId);
  const [angle, setAngle] = useState<EquipmentCameraAngle>('iso');
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [justAdded, setJustAdded] = useState<EquipmentId | null>(null);

  const selected = getEquipmentById(selectedId);
  const inInventory = inventory.includes(selectedId);

  const handleSelectEquipment = (id: EquipmentId) => {
    setSelectedId(id);
    setJustAdded(null);
    playSpaceSfx(id === 'solar_water_cycle' ? 'water_cycle' : 'deploy', isMuted);
  };

  const handleAdd = () => {
    playSpaceSfx('ui_select', isMuted);
    onAddEquipment(selectedId);
    setJustAdded(selectedId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl h-[min(90vh,760px)] rounded-2xl bg-[#090D16] border border-slate-700 overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4 bg-[#07090E]">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
              Interactive 3D Systems &amp; Hardware Inspection
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Astro Mission Equipment Catalog
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close equipment showcase"
            className="p-2 rounded-lg bg-[#0F1623] border border-slate-700 hover:border-sky-400 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main 3-Column Studio Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Equipment Category List */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-800 p-3 overflow-y-auto bg-[#07090E]/70 flex lg:flex-col gap-1.5">
            {EQUIPMENT_CATALOG.map((item) => {
              const Icon = EQUIP_ICONS[item.id];
              const active = selectedId === item.id;
              const owned = inventory.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectEquipment(item.id)}
                  className={`min-w-[200px] lg:min-w-0 w-full p-2.5 rounded-xl border text-left transition-colors flex items-start gap-2.5 shrink-0 ${
                    active
                      ? 'bg-sky-500/15 border-sky-400 text-white'
                      : 'bg-[#0F1623]/80 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      active ? 'text-cyan-300' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{item.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between gap-2 mt-0.5">
                      <span className="truncate">{item.category}</span>
                      {owned && <span className="text-emerald-400 shrink-0">Ready</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Center Interactive 3D Viewport */}
          <div className="lg:col-span-5 relative min-h-[280px] bg-[#07090E] border-b lg:border-b-0 lg:border-r border-slate-800">
            <EquipmentShowcase3D
              equipmentId={selectedId}
              cameraAngle={angle}
              replayTrigger={replayTrigger}
            />

            {/* Viewport Camera Angle Controls */}
            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-1 bg-[#07090E]/90 border border-slate-800 rounded-lg p-1">
                {(
                  [
                    { id: 'iso', label: '3/4 Orbit' },
                    { id: 'front', label: 'Front' },
                    { id: 'top', label: 'Top' },
                    { id: 'detail', label: 'Close-Up' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      playSpaceSfx('ui_click', isMuted);
                      setAngle(preset.id);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      angle === preset.id
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  playSpaceSfx(
                    selectedId === 'solar_water_cycle' ? 'water_cycle' : 'deploy',
                    isMuted
                  );
                  setReplayTrigger((v) => v + 1);
                }}
                className="pointer-events-auto px-2.5 py-1 rounded-lg bg-[#07090E]/90 border border-slate-700 hover:border-cyan-400 text-[10px] font-mono text-cyan-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Replay Demo
              </button>
            </div>

            <div className="pointer-events-none absolute bottom-3 inset-x-3 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-[#07090E]/85 border border-slate-800 rounded-lg px-3 py-1.5">
              <span>Drag: Rotate 360° · Scroll/Pinch: Zoom</span>
              <span className="text-cyan-300 truncate ml-2">{selected.animationLabel}</span>
            </div>
          </div>

          {/* Right Inspection Details & Add-to-Inventory */}
          <div className="lg:col-span-4 p-4 sm:p-5 overflow-y-auto flex flex-col justify-between gap-4 bg-[#0B111C]">
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-mono text-cyan-400 mb-1">{selected.category}</div>
                <h3 className="font-display text-2xl font-bold text-white leading-tight">
                  {selected.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2">
                  {selected.description}
                </p>
              </div>

              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Operational Purpose
                </div>
                <p className="text-xs text-slate-200 leading-relaxed bg-[#07090E] border border-slate-800 rounded-lg p-3">
                  {selected.purpose}
                </p>
              </div>

              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  System Cycle &amp; Functionality
                </div>
                <ol className="space-y-1.5 text-xs text-slate-300">
                  {selected.functionalitySteps.map((step, idx) => (
                    <li
                      key={step}
                      className="flex items-start gap-2 bg-[#07090E]/80 border border-slate-800/80 rounded-lg px-2.5 py-2"
                    >
                      <span className="font-mono text-cyan-400 font-bold shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selected.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="bg-[#07090E] border border-slate-800 rounded-lg px-2.5 py-2"
                  >
                    <div className="text-[10px] font-mono text-slate-400">{spec.label}</div>
                    <div className="text-xs font-mono font-bold text-white tabular-nums">
                      {spec.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-[11px] text-emerald-300 font-mono">
                Field Impact: {selected.inventoryEffectDesc}
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className={`w-full py-3 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                  inInventory || justAdded === selectedId
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              >
                {inInventory || justAdded === selectedId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {actionButtonLabel || 'Deploy / Apply Field Kit'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {actionButtonLabel || 'Select & Add to Inventory'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
