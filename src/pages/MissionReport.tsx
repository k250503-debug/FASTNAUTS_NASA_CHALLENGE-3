import React, { useEffect, useState } from 'react';
import {
  Award,
  Database,
  Fan,
  Globe,
  RefreshCw,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MissionChart from '../components/MissionChart';
import { ASTRONAUTS } from '../data/astronauts';
import { PLANETS } from '../data/planets';
import { evaluateMissionReport } from '../simulation/scoring';
import type { MissionState, PlanetId } from '../types';

const STORAGE_KEY = 'astra_mission_history_v1';

interface PastRunRecord {
  id: string;
  playerName: string;
  planetName: string;
  difficulty: string;
  daysCompleted: number;
  maxDays: number;
  score: number;
  won: boolean;
}

interface MissionReportProps {
  state: MissionState;
  onPlayAgain: () => void;
  onCompareOtherPlanet: (otherPlanetId: PlanetId) => void;
}

export default function MissionReport({
  state,
  onPlayAgain,
  onCompareOtherPlanet,
}: MissionReportProps) {
  const report = evaluateMissionReport(state);
  const won = state.status === 'won';
  const [pastRuns, setPastRuns] = useState<PastRunRecord[]>([]);

  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as PastRunRecord[];
      const runEntry: PastRunRecord = {
        id: `${state.planetId}-${state.day}-${report.totalScore}-${state.playerName}`,
        playerName: state.playerName,
        planetName: state.planetName,
        difficulty: state.difficulty,
        daysCompleted: state.day,
        maxDays: state.maxDays,
        score: report.totalScore,
        won,
      };
      const deduped = [runEntry, ...existing.filter((r) => r.id !== runEntry.id)].slice(0, 6);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      setPastRuns(deduped);
    } catch {
      setPastRuns([]);
    }
  }, [
    state.planetId,
    state.day,
    state.maxDays,
    state.playerName,
    state.planetName,
    state.difficulty,
    report.totalScore,
    won,
  ]);

  const currentIdx = PLANETS.findIndex((p) => p.id === state.planetId);
  const nextPlanet = PLANETS[(currentIdx + 1) % PLANETS.length];
  const otherPlanetId: PlanetId = nextPlanet.id;
  const otherPlanetLabel = nextPlanet.name;

  return (
    <div className="min-h-screen bg-[#07090E] hud-grid p-4 sm:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Outcome Banner */}
        <div
          className={`rounded-xl border p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
            won
              ? 'bg-emerald-950/25 border-emerald-500/50'
              : 'bg-rose-950/25 border-rose-500/50'
          }`}
        >
          <div className="flex items-start gap-4">
            {won ? (
              <Trophy className="w-11 h-11 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-11 h-11 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="text-xs font-mono text-slate-300">
                Mission Debrief · {state.operationName} ({state.planetName})
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
                {won ? 'Mission Success' : 'Mission Terminated'}
              </h1>
              <p className="text-sm text-slate-300 mt-1">
                {won
                  ? `Commander ${state.playerName} sustained critical outpost systems for all ${state.maxDays} days.`
                  : state.failureReason ||
                    `Outpost failed on Day ${state.day} of ${state.maxDays}.`}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 rounded-xl bg-space-950 border border-slate-700 text-center shrink-0">
            <div className="text-xs font-mono text-slate-400">Illustrative Mission Score</div>
            <div className="font-mono tabular-nums text-4xl font-bold text-sky-400">
              {report.totalScore}
              <span className="text-lg text-slate-500">/100</span>
            </div>
          </div>
        </div>

        {/* Performance Breakdown & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-xl bg-space-900 border border-slate-800 p-6">
            <div className="text-xs font-mono text-sky-400 mb-4">
              Weighted Engineering Performance
            </div>
            <div className="space-y-3.5">
              {report.breakdown.map((row) => (
                <div key={row.metric}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-200">
                      {row.metric}{' '}
                      <span className="text-xs text-slate-500">({row.weight})</span>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white">
                      {row.score}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-space-950 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${row.score}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-800 flex justify-between text-xs font-mono tabular-nums text-slate-400">
                <span>Radiation Protection Rating</span>
                <span className="text-emerald-400 font-bold">{report.radiationScore}%</span>
              </div>
              <div className="flex justify-between text-xs font-mono tabular-nums text-slate-400">
                <span>Days Completed</span>
                <span className="text-white font-bold">
                  {state.day} / {state.maxDays}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl bg-space-900 border border-slate-800 p-6 space-y-5">
            <div>
              <div className="text-xs font-mono text-sky-400 mb-2">
                Category Score Comparison
              </div>
              <div className="w-full h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.breakdown}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F1623',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#F1F5F9',
                      }}
                    />
                    <Bar dataKey="score" name="Score %" fill="#38BDF8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="text-xs font-mono text-sky-400 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Mission Resource Trajectory
              </div>
              <MissionChart history={state.history} />
            </div>
          </div>
        </div>

        {/* Highlights, Learning Outcome & Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl bg-space-900 border border-slate-800 p-5">
            <div className="text-xs font-mono text-emerald-400 mb-3">Engineering Highlights</div>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-space-950 border border-slate-800">
                <div className="text-xs text-slate-400">Best Engineering Decision</div>
                <div className="text-white font-medium mt-0.5">
                  {state.decisionMetrics.bestDecision}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-space-950 border border-slate-800">
                <div className="text-xs text-slate-400">Most Costly Mistake</div>
                <div className="text-amber-300 font-medium mt-0.5">
                  {state.decisionMetrics.costliestMistake}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-space-900 border border-slate-800 p-5">
            <div className="text-xs font-mono text-sky-400 mb-3">Learning Outcome</div>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              You discovered how{' '}
              <strong className="text-white">
                power generation, water recycling, greenhouse food crops, ISRU extraction, and
                radiation protection
              </strong>{' '}
              form one interconnected engineering loop.
            </p>
            <p className="text-xs text-slate-400">
              Try replaying on {otherPlanetLabel} to compare how different sunlight and atmospheric
              constraints change outpost design.
            </p>
          </div>

          <div className="rounded-xl bg-space-900 border border-slate-800 p-5">
            <div className="text-xs font-mono text-amber-400 mb-3 flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Earned Learning Badges
            </div>
            <div className="space-y-2.5">
              {report.badges.map((badge) => (
                <div
                  key={badge.title}
                  className="p-3 rounded-lg bg-space-950 border border-slate-800"
                >
                  <div className="text-sm font-semibold text-white">{badge.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{badge.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6-Astronaut Crew Performance & NASA Telemetry Log */}
        <div className="rounded-xl bg-space-900 border border-slate-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <div className="text-xs font-mono text-sky-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> 6-Astronaut NASA Performance Log
              </div>
              <h2 className="font-display text-xl font-bold text-white mt-0.5">
                Crew Field Work, Storm Flues &amp; Planetary Data
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-slate-300">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                {state.dataNodes.filter((n) => n.collected).length}/{state.dataNodes.length} Data Nodes
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                {state.visitedWorlds.length}/4 Worlds Visited
              </span>
              <span className="text-amber-300">
                Flags:{' '}
                {Object.values(state.flagsByWorld).filter((f) => f.planted).length}/4
              </span>
              <span className="text-sky-300">
                Achievements: {state.achievements.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {ASTRONAUTS.map((astro) => {
              const prog = state.crewProgress[astro.id];
              return (
                <div
                  key={astro.id}
                  className="p-4 rounded-lg bg-space-950 border border-slate-800 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: astro.suitColor }}
                        />
                        <span className="font-display font-bold text-white">{astro.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-sky-400">
                        {prog?.tasksCompleted || 0} tasks
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mb-2">{astro.role}</div>
                    <div className="text-[11px] text-slate-300">{prog?.lastAction}</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                    <span className="flex items-center gap-1">
                      <Fan className="w-3 h-3 text-amber-400" /> Flues: {prog?.stormFluesCleared || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3 text-sky-400" /> Data: {prog?.dataCollected || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mission Strategy Comparison History */}
        {pastRuns.length > 0 && (
          <div className="rounded-xl bg-space-900 border border-slate-800 p-5">
            <div className="text-xs font-mono text-sky-400 mb-3">
              Mission Strategy Comparison (Moon, Mars, Titan &amp; Europa Runs)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 pr-4">Commander</th>
                    <th className="py-2 pr-4">Destination</th>
                    <th className="py-2 pr-4">Difficulty</th>
                    <th className="py-2 pr-4">Days</th>
                    <th className="py-2 pr-4">Outcome</th>
                    <th className="py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRuns.map((run) => (
                    <tr key={run.id} className="border-b border-slate-800/60 text-slate-200">
                      <td className="py-2.5 pr-4 font-sans font-medium text-white">
                        {run.playerName}
                      </td>
                      <td className="py-2.5 pr-4">{run.planetName}</td>
                      <td className="py-2.5 pr-4 capitalize">{run.difficulty}</td>
                      <td className="py-2.5 pr-4">
                        {run.daysCompleted}/{run.maxDays}
                      </td>
                      <td
                        className={`py-2.5 pr-4 ${
                          run.won ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {run.won ? '● Success' : '✖ Failed'}
                      </td>
                      <td className="py-2.5 font-bold text-sky-400">{run.score}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-end gap-4 pt-2">
          <button
            type="button"
            onClick={() => onCompareOtherPlanet(otherPlanetId)}
            className="px-6 py-3.5 rounded-lg bg-space-900 hover:bg-space-800 border border-slate-700 text-slate-100 font-display font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Globe className="w-4 h-4 text-amber-400" />
            Compare Strategy on {otherPlanetLabel}
          </button>

          <button
            type="button"
            onClick={onPlayAgain}
            className="px-7 py-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
