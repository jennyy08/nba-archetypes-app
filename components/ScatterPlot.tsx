"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type PlotPoint = {
  index: number;
  x: number;
  y: number;
  color: string;
  visible: boolean;
  name: string;
  team: string;
};

const GRID_COLUMNS = 8;
const GRID_ROWS = 6;

export default function ScatterPlot({ points, selectedIndex, neighborIndices, onSelect }: {
  points: PlotPoint[];
  selectedIndex: number | null;
  neighborIndices: number[];
  onSelect: (index: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 900, height: 460 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const padding = width < 480 ? 19 : 32;

  useEffect(() => {
    const target = container.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setSize({ width, height });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const visiblePoints = useMemo(() => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const xMin = Math.min(...xs);
    const yMin = Math.min(...ys);
    const xRange = Math.max(...xs) - xMin;
    const yRange = Math.max(...ys) - yMin;

    return points.filter((point) => point.visible).map((point) => ({
      ...point,
      cx: padding + (xRange ? (point.x - xMin) / xRange : 0.5) * (width - 2 * padding),
      cy: height - padding - (yRange ? (point.y - yMin) / yRange : 0.5) * (height - 2 * padding),
    }));
  }, [points, width, height, padding]);

  const selected = visiblePoints.find((point) => point.index === selectedIndex);
  const hovered = visiblePoints.find((point) => point.index === hoveredIndex);
  const highlightedNeighbors = new Set(neighborIndices);

  function closestPoint(event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }, radius: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * width / rect.width;
    const y = (event.clientY - rect.top) * height / rect.height;
    let closest: number | null = null;
    let smallestDistance = radius ** 2;
    for (const point of visiblePoints) {
      const distance = (x - point.cx) ** 2 + (y - point.cy) ** 2;
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closest = point.index;
      }
    }
    return closest;
  }

  return (
    <div ref={container} data-scatter-plot>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Player map. Nearby points represent players with similar stats. Use player search to select a player by name."
        onClick={(event) => {
          const index = closestPoint(event, 13);
          if (index !== null) onSelect(index);
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch") setHoveredIndex(closestPoint(event, 9));
        }}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <g data-plot-grid aria-hidden="true">
          {Array.from({ length: GRID_COLUMNS + 1 }, (_, index) => {
            const x = padding + index * (width - 2 * padding) / GRID_COLUMNS;
            return <line key={`x${index}`} x1={x} x2={x} y1={padding} y2={height - padding} />;
          })}
          {Array.from({ length: GRID_ROWS + 1 }, (_, index) => {
            const y = padding + index * (height - 2 * padding) / GRID_ROWS;
            return <line key={`y${index}`} x1={padding} x2={width - padding} y1={y} y2={y} />;
          })}
        </g>

        {visiblePoints.map((point) => (
          <circle
            key={point.index}
            cx={point.cx}
            cy={point.cy}
            r={width < 480 ? 3 : 3.6}
            data-plot-point
            style={{ "--point-color": point.color } as CSSProperties}
          />
        ))}

        {visiblePoints.filter((point) => highlightedNeighbors.has(point.index)).map((point) => (
          <circle key={point.index} cx={point.cx} cy={point.cy} r={6} data-plot-neighbor />
        ))}

        {selected && (
          <g aria-hidden="true">
            <circle cx={selected.cx} cy={selected.cy} r={8.5} data-plot-selected />
            <circle cx={selected.cx} cy={selected.cy} r={4.3} data-plot-point style={{ "--point-color": selected.color } as CSSProperties} />
          </g>
        )}

        {hovered && <circle cx={hovered.cx} cy={hovered.cy} r={6.5} data-plot-neighbor />}
      </svg>
      {hovered && (
        <div
          data-plot-tooltip
          aria-hidden="true"
          style={{
            left: Math.min(Math.max(hovered.cx, 108), width - 108),
            top: hovered.cy,
            transform: hovered.cy < 64 ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <span>{hovered.name}</span><small>{hovered.team}</small>
        </div>
      )}
    </div>
  );
}
