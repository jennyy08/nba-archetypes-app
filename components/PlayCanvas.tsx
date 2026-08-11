"use client";

import { useEffect, useRef } from "react";

export type CourtPlayer = { id: string; label: string; x: number; y: number; offense: boolean };
export type ActionPreset = "pick-roll" | "five-out" | "horns";

const routes: Record<ActionPreset, Record<string, [number, number][]>> = {
  "pick-roll": { O1: [[50, 72], [42, 58]], O2: [[18, 28], [13, 18]], O3: [[82, 28], [87, 18]], O4: [[34, 42], [46, 52]], O5: [[56, 43], [65, 66]] },
  "five-out": { O1: [[50, 70], [50, 55]], O2: [[15, 24], [12, 16]], O3: [[85, 24], [88, 16]], O4: [[31, 39], [25, 24]], O5: [[69, 39], [75, 24]] },
  horns: { O1: [[50, 72], [37, 57], [25, 36]], O2: [[16, 28], [15, 17]], O3: [[84, 28], [85, 17]], O4: [[34, 43], [48, 52]], O5: [[66, 43], [55, 52]] },
};

export default function PlayCanvas({ players, preset, playing, onMove }: { players: CourtPlayer[]; preset: ActionPreset; playing: boolean; onMove: (id: string, x: number, y: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) { progressRef.current = 0; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
      context.scale(ratio, ratio);
      const w = rect.width, h = rect.height;
      context.fillStyle = "#17110c"; context.fillRect(0, 0, w, h);
      const x = (value: number) => (value / 100) * w;
      const y = (value: number) => (value / 100) * h;
      context.strokeStyle = "#5e4429"; context.lineWidth = 2;
      context.strokeRect(x(7), y(6), x(86), y(90));
      context.beginPath(); context.arc(x(50), y(6), x(18), 0, Math.PI); context.stroke();
      context.beginPath(); context.arc(x(50), y(6), x(6), 0, Math.PI); context.stroke();
      context.beginPath(); context.arc(x(50), y(19), x(6), 0, Math.PI * 2); context.stroke();
      context.beginPath(); context.moveTo(x(33), y(6)); context.lineTo(x(33), y(24)); context.lineTo(x(67), y(24)); context.lineTo(x(67), y(6)); context.stroke();
      context.strokeStyle = "#9e7139"; context.setLineDash([5, 5]); context.beginPath(); context.arc(x(50), y(6), x(39), 0, Math.PI); context.stroke(); context.setLineDash([]);

      const progress = progressRef.current;
      players.filter((player) => player.offense).forEach((player) => {
        const route = routes[preset][player.id];
        if (!route) return;
        context.strokeStyle = "rgba(242,169,59,.42)"; context.lineWidth = 2; context.setLineDash([4, 5]); context.beginPath();
        route.forEach(([rx, ry], index) => index ? context.lineTo(x(rx), y(ry)) : context.moveTo(x(rx), y(ry))); context.stroke(); context.setLineDash([]);
      });

      players.forEach((player) => {
        let px = player.x, py = player.y;
        const route = routes[preset][player.id];
        if (playing && player.offense && route) {
          const total = route.length - 1; const value = Math.min(progress * total, total); const start = route[Math.floor(value)]; const end = route[Math.min(Math.ceil(value), total)]; const fraction = value % 1;
          px = start[0] + (end[0] - start[0]) * fraction; py = start[1] + (end[1] - start[1]) * fraction;
        }
        context.beginPath(); context.fillStyle = player.offense ? "#f2a93b" : "#68a9d6"; context.arc(x(px), y(py), 15, 0, Math.PI * 2); context.fill();
        context.strokeStyle = player.offense ? "#fff0d5" : "#d7edff"; context.lineWidth = 1; context.stroke(); context.fillStyle = "#17110c"; context.font = "600 11px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(player.label, x(px), y(py));
      });
      if (playing) { progressRef.current = (progress + 0.006) % 1; frameRef.current = requestAnimationFrame(draw); }
    };
    draw();
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [players, preset, playing]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }; };
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => { const p = point(event); const hit = players.find((player) => Math.hypot(player.x - p.x, player.y - p.y) < 6); if (hit) { dragRef.current = hit.id; event.currentTarget.setPointerCapture(event.pointerId); } };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!dragRef.current) return; const p = point(event); onMove(dragRef.current, Math.max(9, Math.min(91, p.x)), Math.max(8, Math.min(91, p.y))); };
  const onPointerUp = () => { dragRef.current = null; };
  return <canvas ref={canvasRef} className="play-canvas" aria-label="Interactive half-court basketball play diagram" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />;
}
