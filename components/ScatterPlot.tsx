"use client";

import { useMemo } from "react";
import { clusterColor } from "@/lib/constants";

export type PlotPoint = {
  index: number;
  x: number;
  y: number;
  cluster: number;
  name: string;
  team: string;
};

export default function ScatterPlot({
  points,
  selectedIndex,
  neighborIndices,
  onSelect,
}: {
  points: PlotPoint[];
  selectedIndex: number | null;
  neighborIndices: number[];
  onSelect: (index: number) => void;
}) {
  const WIDTH = 900;
  const HEIGHT = 620;
  const PAD = 40;

  const { scaleX, scaleY } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    return {
      scaleX: (v: number) => PAD + ((v - xMin) / xRange) * (WIDTH - 2 * PAD),
      // flip Y so higher values go up, matching normal chart convention
      scaleY: (v: number) => HEIGHT - PAD - ((v - yMin) / yRange) * (HEIGHT - 2 * PAD),
    };
  }, [points]);

  const neighborSet = new Set(neighborIndices);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto rounded-lg border border-court-border bg-court-panel"
      role="img"
      aria-label="Scatter plot of NBA players clustered by playstyle"
    >
      {/* faint axis lines through the origin-ish center */}
      <line x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2} stroke="var(--color-court-border)" strokeWidth={1} />
      <line x1={WIDTH / 2} y1={PAD} x2={WIDTH / 2} y2={HEIGHT - PAD} stroke="var(--color-court-border)" strokeWidth={1} />

      {points.map((p) => {
        const isSelected = p.index === selectedIndex;
        const isNeighbor = neighborSet.has(p.index);
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);

        return (
          <g key={p.index}>
            {isSelected && (
              <circle cx={cx} cy={cy} r={13} fill="none" stroke="var(--color-amber)" strokeWidth={2} opacity={0.9} />
            )}
            {isNeighbor && (
              <circle cx={cx} cy={cy} r={10} fill="none" stroke="var(--color-text)" strokeWidth={1.5} opacity={0.7} />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={isSelected ? 6 : 4.5}
              fill={clusterColor(p.cluster)}
              opacity={isSelected || isNeighbor ? 1 : 0.75}
              stroke="var(--color-court-bg)"
              strokeWidth={1}
              className="cursor-pointer transition-opacity hover:opacity-100"
              onClick={() => onSelect(p.index)}
            >
              <title>{`${p.name} (${p.team})`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
