"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from "react";
import { ballAtTime, ballTimeline, isOffensiveId, measurePath, mix, nextPasser, passPath, pointOnPath, type BallSequence, type OffensiveId, type PlayerNames, type Point } from "@/lib/play-sequence";

export type CourtPlayer = { id: string; label: string; x: number; y: number; offense: boolean };
export type ActionPreset = "pick-roll" | "five-out" | "horns";
export type DrawMode = "move" | "route" | "pass";
export type CourtType = "indoor" | "outdoor";
export type Playback = "idle" | "playing" | "paused";
export type RouteMap = Record<string, Point[]>;
export type PlayCanvasHandle = { exportPng: () => void };

type Props = {
  players: CourtPlayer[];
  preset: ActionPreset;
  playback: Playback;
  readReceiver: OffensiveId;
  ballSequence: BallSequence | null;
  playerNames: PlayerNames;
  defenseTargets: Record<string, Point>;
  mode: DrawMode;
  editing: boolean;
  courtType: CourtType;
  customRoutes: RouteMap;
  usePresetRoutes: boolean;
  onComplete: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onRoute: (id: string, route: Point[]) => void;
  onPass: (id: OffensiveId, path: Point[]) => void;
  onPassMiss: () => void;
};

type Gesture =
  | { kind: "marker"; id: string }
  | { kind: "route"; id: string; points: Point[] }
  | { kind: "pass"; from: OffensiveId; points: Point[] };

const presetRoutes: Record<ActionPreset, RouteMap> = {
  "pick-roll": { O1: [[42, 58]], O2: [[13, 18]], O3: [[87, 18]], O4: [[46, 52]], O5: [[65, 66]] },
  "five-out": { O1: [[50, 55]], O2: [[12, 16]], O3: [[88, 16]], O4: [[25, 24]], O5: [[75, 24]] },
  horns: { O1: [[37, 57], [25, 36]], O2: [[15, 17]], O3: [[85, 17]], O4: [[48, 52]], O5: [[55, 52]] },
};

const RUN_COUNT = 3;
const BALL_OFFSET = { x: 11, y: -11 };

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
  players, preset, playback, readReceiver, ballSequence, playerNames, defenseTargets, mode, editing, courtType, customRoutes, usePresetRoutes,
  onComplete, onMove, onRoute, onPass, onPassMiss,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const gesture = useRef<Gesture | null>(null);
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

    const timeline = ballTimeline(ballSequence, readReceiver);
    const drawingPass = editing && mode === "pass";
    const passer = nextPasser(ballSequence);
    const starts = Object.fromEntries(players.map(({ id, x, y }): [string, Point] => [id, [x, y]]));
    const routes = Object.fromEntries(players.filter((player) => player.offense).map(({ id }) => [
      id,
      measurePath([starts[id], ...(customRoutes[id]?.slice(1) ?? (usePresetRoutes ? presetRoutes[preset][id] : []))]),
    ]));
    const playerAt = (id: OffensiveId, time: number) => pointOnPath(routes[id], time / timeline.duration);
    const passPaths = timeline.passes.map(({ path, from, to, release, catchAt }) =>
      measurePath(playback === "idle"
        ? passPath(path, starts[from], starts[to])
        : passPath(path, playerAt(from, release), playerAt(to, catchAt))),
    );
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
      const time = elapsed.current % timeline.duration;
      const progress = time / timeline.duration;

      function drawPath(route: Point[], color: string, dash: number[]) {
        if (!context || route.length < 2) return;
        context.strokeStyle = color;
        context.lineWidth = 1.55;
        context.lineCap = "round";
        context.setLineDash(dash);
        context.beginPath();
        context.moveTo(x(route[0][0]), y(route[0][1]));
        for (const [px, py] of route.slice(1)) context.lineTo(x(px), y(py));
        context.stroke();
        context.setLineDash([]);
        const [endX, endY] = route[route.length - 1];
        context.beginPath();
        context.arc(x(endX), y(endY), 2.5, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      }

      drawCourt(context, width, height, courtType);
      for (const [id, route] of Object.entries(routes)) {
        drawPath(route.points, customRoutes[id] ? "#81d9be" : "rgba(245, 182, 100, .70)", [4, 5]);
      }
      passPaths.forEach((path, index) => {
        drawPath(path.points, "#f99759", [7, 4]);
        const [px, py] = pointOnPath(path, 0.5);
        context.beginPath();
        context.arc(x(px), y(py), 8, 0, Math.PI * 2);
        context.fillStyle = "#4c2a17";
        context.fill();
        context.fillStyle = "#ffbc8e";
        context.font = "700 10px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(index + 1), x(px), y(py) + 0.5);
      });

      const activeGesture = gesture.current;
      if (activeGesture?.kind === "route") drawPath(activeGesture.points, "#81d9be", [4, 5]);
      if (activeGesture?.kind === "pass") drawPath(activeGesture.points, "#ffc39d", [7, 4]);

      const positions = Object.fromEntries(players.map((player): [string, Point] => {
        const start = starts[player.id];
        if (playback === "idle") return [player.id, start];
        if (isOffensiveId(player.id)) return [player.id, playerAt(player.id, time)];
        return [player.id, mix(start, defenseTargets[player.id] ?? start, Math.min(progress * 1.8, 1))];
      }));
      const startingHolder = drawingPass ? passer : timeline.start;
      const ball = playback === "idle"
        ? { position: starts[startingHolder], holder: startingHolder, markerOffset: 1 }
        : ballAtTime(timeline, passPaths, time, playerAt);

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
        if (player.id === ball.holder) {
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

      for (const player of players) {
        if (!isOffensiveId(player.id)) continue;
        const name = playerNames[player.id]?.trim();
        if (!name) continue;
        const [px, py] = positions[player.id];
        const fontSize = width < 450 ? 10 : 12;
        const maxWidth = Math.min(115, width / 4);
        context.font = `600 ${fontSize}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        const labelWidth = Math.min(context.measureText(name).width, maxWidth);
        const cx = Math.max(labelWidth / 2 + 4, Math.min(width - labelWidth / 2 - 4, x(px)));
        const cy = py > 88 ? y(py) - radius - 10 : y(py) + radius + 10;
        context.fillStyle = "#171512";
        context.fillRect(cx - labelWidth / 2 - 3, cy - fontSize / 2 - 2, labelWidth + 6, fontSize + 4);
        context.fillStyle = "#f5eee4";
        context.fillText(name, cx, cy, maxWidth);
      }

      const draftPoint = activeGesture?.kind === "pass" ? activeGesture.points.at(-1) : undefined;
      const [ballX, ballY] = draftPoint ?? ball.position;
      const offset = draftPoint ? 0 : ball.markerOffset;
      const bx = x(ballX) + BALL_OFFSET.x * offset;
      const by = y(ballY) + BALL_OFFSET.y * offset;
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
      if (elapsed.current >= timeline.duration * RUN_COUNT) {
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
  }, [players, preset, playback, readReceiver, ballSequence, playerNames, defenseTargets, customRoutes, usePresetRoutes, courtType, mode, editing, onComplete]);

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

  function courtPoint([x, y]: Point): Point {
    return [Math.max(8, Math.min(92, x)), Math.max(9, Math.min(92, y))];
  }

  function startGesture(event: PointerEvent<HTMLCanvasElement>) {
    if (!editing || playback !== "idle" || !event.isPrimary || event.button !== 0) return;
    const point = position(event);

    if (mode === "pass") {
      const from = nextPasser(ballSequence);
      const passer = players.find((player) => player.id === from);
      if (!passer) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ballDistance = Math.hypot(
        (point[0] - passer.x) * rect.width / 100 - BALL_OFFSET.x,
        (point[1] - passer.y) * rect.height / 100 - BALL_OFFSET.y,
      );
      if (hitPlayer(event, point, true)?.id !== from && ballDistance > 14) return;
      gesture.current = { kind: "pass", from, points: [[passer.x, passer.y]] };
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
    const point = courtPoint(position(event));
    if (active.kind === "marker") {
      onMove(active.id, ...point);
    } else {
      const [x, y] = active.points[active.points.length - 1];
      if (Math.hypot(point[0] - x, point[1] - y) < 0.35) return;
      active.points.push(point);
      redraw.current?.();
    }
  }

  function cancelGesture() {
    gesture.current = null;
    redraw.current?.();
  }

  function finishGesture(event: PointerEvent<HTMLCanvasElement>) {
    const active = gesture.current;
    if (!active || !event.isPrimary) return;
    const end = position(event);
    if (active.kind === "pass") {
      const target = hitPlayer(event, end, true);
      if (target && isOffensiveId(target.id) && target.id !== active.from) {
        onPass(target.id, [...active.points, [target.x, target.y]]);
      } else if (active.points.length > 1) {
        onPassMiss();
      }
    }
    if (active.kind === "route" && active.points.length > 1) {
      onRoute(active.id, [...active.points, courtPoint(end)]);
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
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
    />
  );
});

export default PlayCanvas;
