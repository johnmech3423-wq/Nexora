"use client";

import * as React from "react";
import type { BurndownPoint } from "@/types";

/** Lightweight burndown chart: remaining vs ideal lines. */
export function SpriteBurnChart({ points, total }: { points: BurndownPoint[]; total: number }) {
  const W = 640;
  const H = 180;
  const PAD = { l: 36, r: 12, t: 12, b: 26 };

  const maxY = Math.max(total, ...points.map((p) => p.remaining), 1);
  const x = (i: number) => PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const remainingPath = path(points.map((p) => p.remaining));
  const idealPath = path(points.map((p) => p.ideal));

  // Ticks
  const yTicks = 4;
  const xLabelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div aria-label={`Burndown chart: ${total} total points, ${points[points.length - 1]?.remaining ?? 0} remaining`} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* grid */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = Math.round((maxY / yTicks) * i);
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
                {v}
              </text>
            </g>
          );
        })}
        {points.map((p, i) =>
          i % xLabelEvery === 0 ? (
            <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">
              {p.date.slice(5)}
            </text>
          ) : null
        )}
        {/* ideal */}
        <path d={idealPath} fill="none" stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth="1.5" />
        {/* remaining area + line */}
        <path
          d={`${remainingPath} L${x(points.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`}
          fill="url(#burnFill)"
        />
        <path d={remainingPath} fill="none" stroke="var(--chart-3)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].remaining)} r="3.5" fill="var(--chart-3)" />
      </svg>
      <div className="mt-1 flex items-center justify-center gap-5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-5 rounded bg-[var(--chart-3)]" /> Remaining
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-5 rounded border-t border-dashed border-muted-foreground" /> Ideal
        </span>
      </div>
    </div>
  );
}
