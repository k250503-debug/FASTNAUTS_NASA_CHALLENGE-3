import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Flame,
  Fuel,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';
import type { MiniGameKind } from '../types';

interface EngineeringMiniGameModalProps {
  kind: MiniGameKind;
  title: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function EngineeringMiniGameModal({
  kind,
  title,
  onSuccess,
  onClose,
}: EngineeringMiniGameModalProps) {
  // 1. Circuit Patch state (match 4 nodes to target voltage polarity)
  const [nodes, setNodes] = useState<number[]>([0, 1, 2, 0]);
  const targetNodes = [2, 2, 1, 2];

  // 2. Antenna Align state (Azimuth & Elevation target lock)
  const [azimuth, setAzimuth] = useState(118);
  const [elevation, setElevation] = useState(24);
  const targetAz = 148;
  const targetEl = 42;
  const azErr = Math.abs(azimuth - targetAz);
  const elErr = Math.abs(elevation - targetEl);
  const snrPct = Math.max(12, Math.round(100 - azErr * 1.4 - elErr * 1.8));

  // 3. Thermal / Flue Valve Balancing (3 valves sum to 100%, each between 25 and 45)
  const [valves, setValves] = useState<[number, number, number]>([48, 22, 30]);
  const valveBalanced =
    valves[0] >= 28 &&
    valves[0] <= 40 &&
    valves[1] >= 28 &&
    valves[1] <= 40 &&
    valves[2] >= 28 &&
    valves[2] <= 40 &&
    valves[0] + valves[1] + valves[2] === 100;

  // 4. Fuel Transfer Pressure & LOX/CH4 Ratio (ratio target ~3.6:1, pressure 220-260 bar)
  const [mixRatio, setMixRatio] = useState(2.8);
  const [pumpBar, setPumpBar] = useState(170);
  const fuelReady = Math.abs(mixRatio - 3.6) <= 0.15 && pumpBar >= 220 && pumpBar <= 260;

  const isSolved =
    (kind === 'circuit_patch' && nodes.every((v, i) => v === targetNodes[i])) ||
    (kind === 'antenna_align' && snrPct >= 92) ||
    (kind === 'thermal_valve' && valveBalanced) ||
    (kind === 'fuel_transfer' && fuelReady);

  return (
    <div className="fixed inset-0 z-50 astra-glass-backdrop flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-xl astra-glass-modal border-cyan-400/45 p-6 relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calibration"
          className="absolute top-4 right-4 text-slate-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-300 mb-1">
          {kind === 'circuit_patch' && <Cpu className="w-4 h-4" />}
          {kind === 'antenna_align' && <Radio className="w-4 h-4" />}
          {kind === 'thermal_valve' && <Flame className="w-4 h-4" />}
          {kind === 'fuel_transfer' && <Fuel className="w-4 h-4" />}
          Hands-On Engineering Calibration
        </div>
        <h3 className="font-display text-xl font-bold text-white mb-4">{title}</h3>

        {kind === 'circuit_patch' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-200">
              Click each bus relay below to cycle voltage until all 4 avionics channels match the
              required NASA target polarity.
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {nodes.map((val, idx) => {
                const labels = ['0V OFF', '12V AUX', '28V BUS'];
                const matched = val === targetNodes[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setNodes((prev) => prev.map((v, i) => (i === idx ? (v + 1) % 3 : v)))
                    }
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      matched
                        ? 'astra-glass-success text-emerald-200'
                        : 'astra-glass-subtle hover:border-cyan-400 text-slate-200'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-slate-400 mb-1">CH-{idx + 1}</div>
                    <div className="font-mono font-bold text-xs">{labels[val]}</div>
                    <div className="text-[10px] font-mono text-sky-400 mt-1">
                      Need: {labels[targetNodes[idx]]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {kind === 'antenna_align' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Sweep the Ka-band parabolic dish azimuth and elevation until Deep-Space Network signal
              strength reaches <span className="text-emerald-400 font-mono">≥ 92%</span>.
            </p>

            <div className="p-3.5 rounded-lg astra-glass-subtle space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Dish Azimuth (Target ~148°)</span>
                  <span className="text-white font-bold">{azimuth}°</span>
                </div>
                <input
                  type="range"
                  min={90}
                  max={190}
                  value={azimuth}
                  onChange={(e) => setAzimuth(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Dish Elevation (Target ~42°)</span>
                  <span className="text-white font-bold">{elevation}°</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={75}
                  value={elevation}
                  onChange={(e) => setElevation(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Earth Carrier Lock SNR</span>
                <span
                  className={`font-bold ${
                    snrPct >= 92 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {snrPct}%
                </span>
              </div>
            </div>
          </div>
        )}

        {kind === 'thermal_valve' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Balance all 3 pressure manifold valves so each carries{' '}
              <span className="font-mono text-sky-300">28–40%</span> load and total flow equals{' '}
              <span className="font-mono text-emerald-300">100%</span>.
            </p>
            <div className="space-y-3 p-3.5 rounded-lg astra-glass-subtle">
              {valves.map((v, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Manifold Valve {i + 1}</span>
                    <span
                      className={
                        v >= 28 && v <= 40 ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'
                      }
                    >
                      {v}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={60}
                    value={v}
                    onChange={(e) => {
                      const next = [...valves] as [number, number, number];
                      next[i] = Number(e.target.value);
                      setValves(next);
                    }}
                    className="w-full accent-amber-400"
                  />
                </div>
              ))}
              <div className="flex justify-between text-xs font-mono pt-2 border-t border-slate-800">
                <span className="text-slate-400">Total Manifold Flow</span>
                <span
                  className={
                    valves[0] + valves[1] + valves[2] === 100
                      ? 'text-emerald-400 font-bold'
                      : 'text-rose-400 font-bold'
                  }
                >
                  {valves[0] + valves[1] + valves[2]}% / 100%
                </span>
              </div>
            </div>
          </div>
        )}

        {kind === 'fuel_transfer' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Tune Methalox oxidizer-to-fuel ratio to{' '}
              <span className="font-mono text-sky-300">3.6:1 (±0.15)</span> and pump pressure to{' '}
              <span className="font-mono text-emerald-300">220–260 bar</span> before opening the
              Starship cryogenic umbilical.
            </p>
            <div className="space-y-3 p-3.5 rounded-lg astra-glass-subtle">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">LOX : CH₄ Mixture Ratio</span>
                  <span
                    className={
                      Math.abs(mixRatio - 3.6) <= 0.15
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-300 font-bold'
                    }
                  >
                    {mixRatio.toFixed(1)} : 1
                  </span>
                </div>
                <input
                  type="range"
                  min={2.2}
                  max={4.5}
                  step={0.1}
                  value={mixRatio}
                  onChange={(e) => setMixRatio(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Cryo Transfer Pump Pressure</span>
                  <span
                    className={
                      pumpBar >= 220 && pumpBar <= 260
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-300 font-bold'
                    }
                  >
                    {pumpBar} bar
                  </span>
                </div>
                <input
                  type="range"
                  min={140}
                  max={300}
                  step={5}
                  value={pumpBar}
                  onChange={(e) => setPumpBar(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs font-mono">
            {isSolved ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Calibration Locked!
              </span>
            ) : (
              <span className="text-slate-400">Align parameters into nominal green band</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-xs text-slate-200 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isSolved}
              onClick={() => {
                if (isSolved) onSuccess();
              }}
              className={`px-4 py-2 rounded-lg font-display font-bold text-xs flex items-center gap-1.5 ${
                isSolved
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Confirm Calibration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
