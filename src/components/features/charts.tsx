"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export function ChartTooltip() {
  return (
    <RTooltip
      cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
      contentStyle={{
        background: "var(--popover)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        fontSize: 12,
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
      }}
      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
      itemStyle={{ padding: 0 }}
    />
  );
}

export function TrendAreaChart({
  data,
  height = 220,
}: {
  data: { date: string; completed: number; created: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradOpen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(d) => d.slice(5)} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip />
        <Area type="monotone" dataKey="completed" name="Completed" stroke="var(--chart-3)" strokeWidth={2} fill="url(#gradDone)" />
        <Area type="monotone" dataKey="created" name="Created" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gradOpen)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function DonutChart({
  data,
  height = 200,
  centerLabel,
}: {
  data: { key: string; label: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
            {data.map((d, i) => (
              <Cell key={d.key} fill={d.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold">{centerLabel}</span>
        </div>
      ) : null}
      {total === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          No data yet
        </p>
      ) : null}
    </div>
  );
}

export function BarDistributionChart({
  data,
  color,
  height = 220,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={0} angle={-12} height={42} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip />
        <Bar dataKey="value" name="Tasks" fill={color ?? "var(--chart-1)"} radius={[4, 4, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function chartCard(className?: string) {
  return cn("rounded-lg border bg-card p-5", className);
}
