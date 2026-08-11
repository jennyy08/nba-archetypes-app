"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type CourtPlayer = { id: string; label: string; x: number; y: number; offense: boolean };
export type ActionPreset = "pick-roll" | "five-out" | "horns";
export type DrawMode = "move" | "route";
export type RouteMap = Record<string, [number, number][]>;
export type PlayCanvasHandle = { exportPng: () => void };

const presetRoutes: Record<ActionPreset, RouteMap> = {
  "pick-roll": { O1: [[50, 72], [42, 58]], O2: [[18, 28], [13, 18]], O3: [[82, 28], [87, 18]], O4: [[34, 42], [46, 52]], O5: [[56, 43], [65, 66]] },
  "five-out": { O1: [[50, 70], [50, 55]], O2: [[15, 24], [12, 16]], O3: [[85, 24], [88, 16]], O4: [[31, 39], [25, 24]], O5: [[69, 39], [75, 24]] },
  horns: { O1: [[50, 72], [37, 57], [25, 36]], O2: [[16, 28], [15, 17]], O3: [[84, 28], [85, 17]], O4: [[34, 43], [48, 52]], O5: [[66, 43], [55, 52]] },
};

const pointOnRoute = (route: [number, number][], progress: number): [number, number] => {
  if (route.length < 2) return route[0] || [50, 72];
  const value = Math.min(progress * (route.length - 1), route.length - 1); const start = route[Math.floor(value)]; const end = route[Math.ceil(value)]; const fraction = value % 1;
  return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
};

const PlayCanvas = forwardRef<PlayCanvasHandle, { players: CourtPlayer[]; preset: ActionPreset; playing: boolean; readTarget: [number, number]; defenseTargets: Record<string, [number, number]>; resetKey: number; onComplete: () => void; mode?: DrawMode; drawingPlayer?: string; customRoutes?: RouteMap; ballRoute?: [number, number][]; onRoutesChange?: (routes: RouteMap) => void; onBallRouteChange?: (route: [number, number][]) => void; onMove: (id: string, x: number, y: number) => void }>(({ players, preset, playing, readTarget, defenseTargets, resetKey, onComplete, mode, customRoutes, ballRoute, onRoutesChange, onBallRouteChange, onMove }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const dragRef = useRef<string | null>(null); const ballDragRef = useRef(false); const drawingRef = useRef<{ id: string; points: [number, number][] } | null>(null); const progressRef = useRef(0); const frameRef = useRef<number | null>(null); const runsRef = useRef(0);
  const [localMode, setLocalMode] = useState<DrawMode>("move"); const [localRoutes, setLocalRoutes] = useState<RouteMap>({}); const [localBallRoute, setLocalBallRoute] = useState<[number, number][]>([]); const [ballPosition, setBallPosition] = useState<[number, number]>([50, 72]);
  const activeMode = mode ?? localMode; const activeRoutes = customRoutes ?? localRoutes; const activeBallRoute = ballRoute ?? localBallRoute;
  const updateRoutes = (routes: RouteMap) => { setLocalRoutes(routes); onRoutesChange?.(routes); };
  useImperativeHandle(ref, () => ({ exportPng: () => { const canvas = canvasRef.current; if (!canvas) return; const link = document.createElement("a"); link.download = "play-lab-diagram.png"; link.href = canvas.toDataURL("image/png"); link.click(); } }));
  useEffect(() => { const exportImage = () => { const canvas = canvasRef.current; if (!canvas) return; const link = document.createElement("a"); link.download = "play-lab-diagram.png"; link.href = canvas.toDataURL("image/png"); link.click(); }; window.addEventListener("playlab-export-image", exportImage); return () => window.removeEventListener("playlab-export-image", exportImage); }, []);
  useEffect(() => { progressRef.current = 0; runsRef.current = 0; }, [resetKey]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext("2d"); if (!context) return;
    let drawX = (value: number) => value; let drawY = (value: number) => value;
    const drawPath = (route: [number, number][], color: string, width = 2) => { if (route.length < 2) return; context.strokeStyle = color; context.lineWidth = width; context.setLineDash([5, 5]); context.beginPath(); route.forEach(([rx, ry], index) => index ? context.lineTo(drawX(rx), drawY(ry)) : context.moveTo(drawX(rx), drawY(ry))); context.stroke(); context.setLineDash([]); };
    const draw = () => {
      const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; context.scale(ratio, ratio); const w = rect.width, h = rect.height; const x = (v: number) => v / 100 * w; const y = (v: number) => v / 100 * h; drawX = x; drawY = y;
      context.fillStyle = "#17110c"; context.fillRect(0, 0, w, h); context.strokeStyle = "#5e4429"; context.lineWidth = 2; context.strokeRect(x(7), y(6), x(86), y(90)); context.beginPath(); context.arc(x(50), y(6), x(18), 0, Math.PI); context.stroke(); context.beginPath(); context.arc(x(50), y(6), x(6), 0, Math.PI); context.stroke(); context.beginPath(); context.arc(x(50), y(19), x(6), 0, Math.PI * 2); context.stroke(); context.beginPath(); context.moveTo(x(33), y(6)); context.lineTo(x(33), y(24)); context.lineTo(x(67), y(24)); context.lineTo(x(67), y(6)); context.stroke(); context.strokeStyle = "#9e7139"; context.setLineDash([5, 5]); context.beginPath(); context.arc(x(50), y(6), x(39), 0, Math.PI); context.stroke(); context.setLineDash([]);
      const progress = progressRef.current; let handler: [number, number] = [50, 72];
      players.filter((p) => p.offense).forEach((p) => drawPath(activeRoutes[p.id] || presetRoutes[preset][p.id], activeRoutes[p.id] ? "rgba(110,211,175,.8)" : "rgba(242,169,59,.42)")); if (activeBallRoute.length) drawPath(activeBallRoute, "rgba(240,140,70,.9)", 2.5);
      players.forEach((player) => { let [px, py] = [player.x, player.y]; const route = activeRoutes[player.id] || presetRoutes[preset][player.id]; if (playing && player.offense && route) [px, py] = pointOnRoute(route, progress); if (playing && !player.offense && defenseTargets[player.id]) { const target = defenseTargets[player.id]; const amount = Math.min(progress * 1.8, 1); px += (target[0] - px) * amount; py += (target[1] - py) * amount; } if (player.id === "O1") handler = [px, py]; context.beginPath(); context.fillStyle = player.offense ? "#f2a93b" : "#68a9d6"; context.arc(x(px), y(py), 15, 0, Math.PI * 2); context.fill(); context.strokeStyle = player.offense ? "#fff0d5" : "#d7edff"; context.lineWidth = 1; context.stroke(); context.fillStyle = "#17110c"; context.font = "600 11px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(player.label, x(px), y(py)); });
      const [bx, by] = playing ? handler : ballPosition; context.beginPath(); context.fillStyle = "#8d5a2b"; context.arc(x(bx), y(by), 7, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#f5d7aa"; context.stroke();
      if (playing) { const next = progress + 0.006; if (next >= 1) { runsRef.current += 1; if (runsRef.current >= 3) { progressRef.current = 1; onComplete(); return; } progressRef.current = 0; } else progressRef.current = next; frameRef.current = requestAnimationFrame(draw); }
    }; draw(); return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [players, preset, playing, readTarget, defenseTargets, resetKey, onComplete, activeRoutes, activeBallRoute, ballPosition]);
  const point = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => { const rect = event.currentTarget.getBoundingClientRect(); return [Math.max(8, Math.min(92, (event.clientX - rect.left) / rect.width * 100)), Math.max(8, Math.min(92, (event.clientY - rect.top) / rect.height * 100))]; };
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => { const p = point(event); event.currentTarget.setPointerCapture(event.pointerId); if (activeMode === "move") { if (Math.hypot(ballPosition[0] - p[0], ballPosition[1] - p[1]) < 5) ballDragRef.current = true; else { const hit = players.find((player) => Math.hypot(player.x - p[0], player.y - p[1]) < 6); if (hit) dragRef.current = hit.id; } } else { const hit = players.find((player) => player.offense && Math.hypot(player.x - p[0], player.y - p[1]) < 7); if (hit) drawingRef.current = { id: hit.id, points: [p] }; } };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => { const p = point(event); if (dragRef.current) onMove(dragRef.current, p[0], p[1]); if (ballDragRef.current) setBallPosition(p); if (drawingRef.current) { const next = [...drawingRef.current.points, p]; drawingRef.current = { ...drawingRef.current, points: next }; updateRoutes({ ...activeRoutes, [drawingRef.current.id]: next }); } };
  const onPointerUp = () => { dragRef.current = null; ballDragRef.current = false; drawingRef.current = null; };
  return <div><div className="play-draw-tools"><button onClick={() => setLocalMode("move")} className={activeMode === "move" ? "draw-active" : ""}>Move markers</button><button onClick={() => setLocalMode("route")} className={activeMode === "route" ? "draw-active" : ""}>Draw player routes</button><button onClick={() => { setLocalRoutes({}); setLocalBallRoute([]); onRoutesChange?.({}); onBallRouteChange?.([]); }} className="draw-clear">Clear drawings</button></div><canvas ref={canvasRef} className={`play-canvas play-canvas-${activeMode}`} aria-label="Interactive half-court basketball play diagram" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} /></div>;
});

PlayCanvas.displayName = "PlayCanvas";
export default PlayCanvas;
