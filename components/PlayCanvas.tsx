"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from "react";

export type Point = [number, number];
export type CourtPlayer = { id: string; label: string; x: number; y: number; offense: boolean };
export type ActionPreset = "pick-roll" | "five-out" | "horns";
export type DrawMode = "move" | "route";
export type CourtType = "indoor" | "outdoor";
export type Playback = "idle" | "playing" | "paused";
export type RouteMap = Record<string, Point[]>;
export type PlayCanvasHandle = { exportPng: () => void };

type Props = {
  players: CourtPlayer[];
  preset: ActionPreset;
  playback: Playback;
  receiver: string;
  defenseTargets: Record<string, Point>;
  mode: DrawMode;
  editing: boolean;
  courtType: CourtType;
  customRoutes: RouteMap;
  ballRoute: Point[];
  onComplete: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onRoute: (id: string, route: Point[]) => void;
  onReceiverChange: (id: string) => void;
};

type Gesture = { kind: "marker"; id: string } | { kind: "route"; id: string; points: Point[] } | { kind: "ball" };

const presetRoutes: Record<ActionPreset, RouteMap> = {
  "pick-roll": { O1: [[42, 58]], O2: [[13, 18]], O3: [[87, 18]], O4: [[46, 52]], O5: [[65, 66]] },
  "five-out": { O1: [[50, 55]], O2: [[12, 16]], O3: [[88, 16]], O4: [[25, 24]], O5: [[75, 24]] },
  horns: { O1: [[37, 57], [25, 36]], O2: [[15, 17]], O3: [[85, 17]], O4: [[48, 52]], O5: [[55, 52]] },
};

const RUN_DURATION = 2800;
const RUN_COUNT = 3;
const PASS_START = 0.48;
const PASS_END = 0.88;
const BALL_OFFSET = { x: 11, y: -11 };

function mix(start: Point, end: Point, amount: number): Point {
  return [start[0] + (end[0] - start[0]) * amount, start[1] + (end[1] - start[1]) * amount];
}

function pointOnRoute(route: Point[], progress: number): Point {
  const value = progress * (route.length - 1);
  return mix(route[Math.floor(value)], route[Math.ceil(value)], value % 1);
}

function drawCourt(context: CanvasRenderingContext2D, width: number, height: number, courtType: CourtType) {
  const x = (value: number) => value * width / 100;
  const y = (value: number) => value * height / 100;
  const indoor = courtType === "indoor";
  const floor = context.createRadialGradient(x(50), y(38), 0, x(50), y(38), width * 0.7);
  floor.addColorStop(0, indoor ? "#30261e" : "#34414a");
  floor.addColorStop(1, indoor ? "#171512" : "#20272c");
  context.fillStyle = floor;
  context.fillRect(0, 0, width, height);

  context.fillStyle = indoor ? "rgba(255, 192, 125, .024)" : "rgba(202, 226, 238, .025)";
  for (let strip = 0; strip < 100; strip += 8) {
    context.fillRect(x(strip), 0, x(4), height);
  }

  context.fillStyle = indoor ? "rgba(230, 163, 90, .055)" : "rgba(198, 225, 241, .055)";
  context.fillRect(x(34), y(9), x(32), y(33));
  context.strokeStyle = indoor ? "#83705c" : "#82939f";
  context.lineWidth = 1.25;
  context.strokeRect(x(7.5), y(9), x(85), y(83));
  context.strokeRect(x(34), y(9), x(32), y(33));

  context.beginPath();
  context.moveTo(x(13), y(9));
  context.lineTo(x(13), y(30));
  context.bezierCurveTo(x(20), y(77), x(80), y(77), x(87), y(30));
  context.lineTo(x(87), y(9));
  context.stroke();

  context.beginPath();
  context.ellipse(x(50), y(42), x(9), y(13), 0, 0, Math.PI);
  context.moveTo(x(41), y(92));
  context.ellipse(x(50), y(92), x(9), y(13), 0, Math.PI, Math.PI * 2);
  context.stroke();

  context.setLineDash([4, 5]);
  context.beginPath();
  context.ellipse(x(50), y(42), x(9), y(13), 0, Math.PI, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  context.strokeStyle = indoor ? "#c69c70" : "#c1d1dc";
  context.beginPath();
  context.moveTo(x(46), y(13));
  context.lineTo(x(54), y(13));
  context.moveTo(x(52.4), y(17));
  context.ellipse(x(50), y(17), x(2.4), y(3.3), 0, 0, Math.PI * 2);
  context.stroke();
}

const PlayCanvas = forwardRef<PlayCanvasHandle, Props>(function PlayCanvas({
  players, preset, playback, receiver, defenseTargets, mode, editing, courtType, customRoutes, ballRoute,
  onComplete, onMove, onRoute, onReceiverChange,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const gesture = useRef<Gesture | null>(null);
  const ballPreview = useRef<Point | null>(null);
  const redraw = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    exportPng() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "play-lab-diagram.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    if (playback === "idle") elapsed.current = 0;

    const routes = Object.fromEntries(players.filter((player) => player.offense).map((player) => [
      player.id,
      [[player.x, player.y], ...(customRoutes[player.id]?.slice(1) ?? presetRoutes[preset][player.id] ?? [])] as Point[],
    ]));
    let frame = 0;
    let lastFrame: number | undefined;

    function draw() {
      if (!canvas || !context) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);

      const x = (value: number) => value * width / 100;
      const y = (value: number) => value * height / 100;
      const progress = elapsed.current % RUN_DURATION / RUN_DURATION;

      function drawPath(route: Point[], color: string) {
        if (!context || route.length < 2) return;
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 1.55;
        context.lineCap = "round";
        context.setLineDash([4, 5]);
        context.beginPath();
        context.moveTo(x(route[0][0]), y(route[0][1]));
        for (const [px, py] of route.slice(1)) context.lineTo(x(px), y(py));
        context.stroke();
        context.setLineDash([]);
        const [endX, endY] = route[route.length - 1];
        context.beginPath();
        context.arc(x(endX), y(endY), 2.5, 0, Math.PI * 2);
        context.fill();
      }

      drawCourt(context, width, height, courtType);
      for (const [id, route] of Object.entries(routes)) {
        drawPath(route, customRoutes[id] ? "#81d9be" : "rgba(245, 182, 100, .70)");
      }
      drawPath(ballRoute, "#f99759");

      const positions = Object.fromEntries(players.map((player): [string, Point] => {
        const start: Point = [player.x, player.y];
        if (playback === "idle") return [player.id, start];
        if (player.offense) return [player.id, pointOnRoute(routes[player.id], progress)];
        return [player.id, mix(start, defenseTargets[player.id] ?? start, Math.min(progress * 1.8, 1))];
      }));

      const radius = Math.max(10, Math.min(15.5, width * 0.024));
      for (const player of players) {
        const [px, py] = positions[player.id];
        context.beginPath();
        context.arc(x(px), y(py), radius + 1.5, 0, Math.PI * 2);
        context.fillStyle = "#171512";
        context.fill();
        context.beginPath();
        context.arc(x(px), y(py), radius, 0, Math.PI * 2);
        context.fillStyle = player.offense ? "#f2ac56" : "#95c3e5";
        context.fill();
        if (player.id === receiver && receiver !== "O1") {
          context.strokeStyle = "#fff4db";
          context.lineWidth = 1.75;
          context.stroke();
        }
        context.fillStyle = "#181511";
        context.font = `700 ${radius > 12 ? 12 : 9}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(player.label, x(px), y(py) + 0.5);
      }

      let ball = positions.O1;
      if (playback !== "idle" && positions[receiver] && receiver !== "O1" && progress > PASS_START) {
        const release = pointOnRoute(routes.O1, PASS_START);
        ball = mix(release, positions[receiver], Math.min(1, (progress - PASS_START) / (PASS_END - PASS_START)));
      }
      const bx = ballPreview.current ? x(ballPreview.current[0]) : x(ball[0]) + BALL_OFFSET.x;
      const by = ballPreview.current ? y(ballPreview.current[1]) : y(ball[1]) + BALL_OFFSET.y;
      context.beginPath();
      context.arc(bx, by, 6.5, 0, Math.PI * 2);
      context.fillStyle = "#ed8046";
      context.fill();
      context.strokeStyle = "#231811";
      context.lineWidth = 1.5;
      context.stroke();
      context.beginPath();
      context.moveTo(bx - 5.5, by);
      context.lineTo(bx + 5.5, by);
      context.moveTo(bx, by - 5.5);
      context.lineTo(bx, by + 5.5);
      context.stroke();
    }

    function animate(time: number) {
      elapsed.current += Math.min(time - (lastFrame ?? time), 100);
      lastFrame = time;
      if (elapsed.current >= RUN_DURATION * RUN_COUNT) {
        onComplete();
        return;
      }
      draw();
      frame = requestAnimationFrame(animate);
    }

    redraw.current = draw;
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    if (playback === "playing") frame = requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      redraw.current = null;
    };
  }, [players, preset, playback, receiver, defenseTargets, customRoutes, ballRoute, courtType, onComplete]);

  function position(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - rect.left) * 100 / rect.width, (event.clientY - rect.top) * 100 / rect.height];
  }

  function hitPlayer(event: PointerEvent<HTMLCanvasElement>, point: Point, offenseOnly: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    let closest: CourtPlayer | undefined;
    let minDistance = event.pointerType === "touch" ? 24 : 18;
    for (const player of players) {
      if (offenseOnly && !player.offense) continue;
      const distance = Math.hypot((player.x - point[0]) * rect.width / 100, (player.y - point[1]) * rect.height / 100);
      if (distance < minDistance) {
        closest = player;
        minDistance = distance;
      }
    }
    return closest;
  }

  function startGesture(event: PointerEvent<HTMLCanvasElement>) {
    if (!editing || playback !== "idle" || !event.isPrimary || event.button !== 0) return;
    const point = position(event);
    const handler = players.find((player) => player.id === "O1")!;
    const rect = event.currentTarget.getBoundingClientRect();
    const ballDistance = Math.hypot((point[0] - handler.x) * rect.width / 100 - BALL_OFFSET.x, (point[1] - handler.y) * rect.height / 100 - BALL_OFFSET.y);

    if (mode === "move" && ballDistance < 10) {
      gesture.current = { kind: "ball" };
    } else {
      const player = hitPlayer(event, point, mode === "route");
      if (!player) return;
      gesture.current = mode === "move"
        ? { kind: "marker", id: player.id }
        : { kind: "route", id: player.id, points: [[player.x, player.y]] };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: PointerEvent<HTMLCanvasElement>) {
    const active = gesture.current;
    if (!active || !event.isPrimary) return;
    const [x, y] = position(event);
    const point: Point = [Math.max(8, Math.min(92, x)), Math.max(9, Math.min(92, y))];
    if (active.kind === "marker") onMove(active.id, ...point);
    if (active.kind === "route") {
      active.points = [...active.points, point];
      onRoute(active.id, active.points);
    }
    if (active.kind === "ball") {
      ballPreview.current = point;
      redraw.current?.();
    }
  }

  function cancelGesture() {
    gesture.current = null;
    ballPreview.current = null;
    redraw.current?.();
  }

  function finishGesture(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary) return;
    if (gesture.current?.kind === "ball") {
      const target = hitPlayer(event, position(event), true);
      if (target) onReceiverChange(target.id);
    }
    cancelGesture();
  }

  return (
    <canvas
      ref={canvasRef}
      className="play-canvas"
      data-mode={editing && playback === "idle" ? mode : undefined}
      aria-label="Half-court diagram with five offensive and five defensive players"
      onPointerDown={startGesture}
      onPointerMove={moveGesture}
      onPointerUp={finishGesture}
      onLostPointerCapture={cancelGesture}
    />
  );
});

export default PlayCanvas;
