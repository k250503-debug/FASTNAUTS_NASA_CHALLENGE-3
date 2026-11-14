import React from 'react';
import { ASTRONAUTS } from '../data/astronauts';
import { getBuildingWorldPos, SPACESHIP_POS, STORM_FLUE_POS } from '../three/OutpostScene3D';
import { getWorldZoneFeatures, ROAMING_RADIUS } from '../three/terrain';
import type { AstronautId, MissionState } from '../types';

interface TacticalMinimapProps {
  state: MissionState;
  positions: {
    astronauts: Array<{ id: AstronautId; x: number; z: number }>;
    rover: { x: number; z: number; yaw: number };
  };
  onSelectAstronaut: (id: AstronautId) => void;
}

const SIZE = 152;
const CENTER = SIZE / 2;
const SCALE = (SIZE * 0.44) / ROAMING_RADIUS;

function toMapCoord(x: number, z: number): { cx: number; cy: number } {
  return {
    cx: CENTER + x * SCALE,
    cy: CENTER + z * SCALE,
  };
}

export default function TacticalMinimap({
  state,
  positions,
  onSelectAstronaut,
}: TacticalMinimapProps) {
  const zones = getWorldZoneFeatures(state.planetId);
  const flag = state.flagsByWorld[state.planetId];
  const shipPt = toMapCoord(SPACESHIP_POS.x, SPACESHIP_POS.z);
  const fluePt = toMapCoord(STORM_FLUE_POS.x, STORM_FLUE_POS.z);
  const roverPt = toMapCoord(positions.rover.x, positions.rover.z);

  return (
    <div className="rounded-xl bg-[#0F1623]/94 border border-slate-800 p-2.5 w-[176px] select-none">
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1.5">
        <span className="text-sky-400 uppercase tracking-wider">Tactical Map</span>
        <span>R={ROAMING_RADIUS}m</span>
      </div>

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="rounded-lg bg-[#060A12] border border-slate-800 block"
      >
        {/* Roaming Boundary Ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={ROAMING_RADIUS * SCALE}
          fill="none"
          stroke={state.shelterRefugeActive ? '#f59e0b' : '#0284c7'}
          strokeWidth={1.3}
          strokeDasharray="3 2"
        />

        {/* World Terrain Zones (PSR, Methane Lake, Cryo Plumes) */}
        {zones.map((zf, idx) => {
          const p = toMapCoord(zf.x, zf.z);
          const color =
            zf.kind === 'methane_lake'
              ? 'rgba(217, 119, 6, 0.35)'
              : zf.kind === 'psr_crater'
              ? 'rgba(30, 58, 138, 0.45)'
              : 'rgba(56, 189, 248, 0.35)';
          return (
            <circle
              key={idx}
              cx={p.cx}
              cy={p.cy}
              r={Math.max(3, zf.radius * SCALE)}
              fill={color}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth={0.6}
            />
          );
        })}

        {/* Outpost Buildings */}
        {state.buildings.map((b) => {
          const wp = getBuildingWorldPos(b.cellIndex);
          const p = toMapCoord(wp.x, wp.z);
          return (
            <rect
              key={b.uid}
              x={p.cx - 3}
              y={p.cy - 3}
              width={6}
              height={6}
              rx={1}
              fill={b.damaged ? '#ef4444' : b.online ? '#38bdf8' : '#64748b'}
            />
          );
        })}

        {/* Storm Flue */}
        <circle
          cx={fluePt.cx}
          cy={fluePt.cy}
          r={3.2}
          fill={state.stormFlue.cloggedPct >= 65 ? '#ef4444' : '#f59e0b'}
        />

        {/* NASA Starship */}
        <polygon
          points={`${shipPt.cx},${shipPt.cy - 5} ${shipPt.cx + 4},${shipPt.cy + 4} ${
            shipPt.cx - 4
          },${shipPt.cy + 4}`}
          fill="#10b981"
        />

        {/* Planted Expedition Flag */}
        {flag?.planted && (
          <circle
            cx={toMapCoord(flag.x, flag.z).cx}
            cy={toMapCoord(flag.x, flag.z).cy}
            r={3}
            fill="#22c55e"
            stroke="#ffffff"
            strokeWidth={0.9}
          />
        )}

        {/* Data Nodes */}
        {state.dataNodes.map((n) => {
          const p = toMapCoord(n.x, n.z);
          return (
            <rect
              key={n.id}
              x={p.cx - 2}
              y={p.cy - 2}
              width={4}
              height={4}
              fill={n.collected ? '#10b981' : '#eab308'}
              transform={`rotate(45 ${p.cx} ${p.cy})`}
            />
          );
        })}

        {/* Rover Marker */}
        <rect
          x={roverPt.cx - 2.6}
          y={roverPt.cy - 2.6}
          width={5.2}
          height={5.2}
          fill="#f8fafc"
          stroke="#0ea5e9"
          strokeWidth={1}
        />

        {/* 6 Astronaut Dots */}
        {ASTRONAUTS.map((astro) => {
          const pos = positions.astronauts.find((p) => p.id === astro.id);
          if (!pos) return null;
          const p = toMapCoord(pos.x, pos.z);
          const isActive = state.activeAstronautId === astro.id;
          return (
            <g
              key={astro.id}
              onClick={() => onSelectAstronaut(astro.id)}
              className="cursor-pointer"
            >
              {isActive && (
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={5.5}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={p.cx}
                cy={p.cy}
                r={isActive ? 3.2 : 2.3}
                fill={astro.suitColor}
                stroke="#07090E"
                strokeWidth={0.8}
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] font-mono text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-sky-400 inline-block" /> Bldg
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-400 inline-block" /> Ship/Flag
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white border border-sky-400 inline-block" /> Rover
        </span>
      </div>
    </div>
  );
}
