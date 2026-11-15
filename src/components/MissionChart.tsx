import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { DaySnapshot } from '../types';

interface MissionChartProps {
  history: DaySnapshot[];
}

export default function MissionChart({ history }: MissionChartProps) {
  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
          <XAxis
            dataKey="day"
            stroke="#94A3B8"
            fontSize={11}
            tickFormatter={(d) => `D${d}`}
          />
          <YAxis stroke="#94A3B8" fontSize={11} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10, 19, 36, 0.78)',
              backdropFilter: 'blur(12px)',
              borderColor: 'rgba(125, 211, 252, 0.3)',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#F1F5F9',
            }}
          />
          <Line
            type="monotone"
            dataKey="oxygen"
            name="Oxygen %"
            stroke="#38BDF8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="water"
            name="Water %"
            stroke="#22D3EE"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="food"
            name="Food %"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="powerPct"
            name="Battery %"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
