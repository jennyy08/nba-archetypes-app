export type Point = [number, number];

export const OFFENSE_IDS = ["O1", "O2", "O3", "O4", "O5"] as const;
export type OffensiveId = typeof OFFENSE_IDS[number];
export type PlayerNames = Partial<Record<OffensiveId, string>>;

type Pass = { to: OffensiveId; path?: Point[] };
export type BallSequence = { start: OffensiveId; passes: Pass[] };
type TimedPass = Pass & { from: OffensiveId; release: number; catchAt: number };
type Timeline = { start: OffensiveId; duration: number; passes: TimedPass[] };
type MeasuredPath = { points: Point[]; distances: number[]; length: number };

const DEFAULT_DURATION = 2800;

export function isOffensiveId(value: unknown): value is OffensiveId {
  return OFFENSE_IDS.some((id) => id === value);
}

export function markerName(id: OffensiveId, names: PlayerNames) {
  const name = names[id]?.trim();
  return name ? `${id.slice(1)} · ${name}` : `Player ${id.slice(1)}`;
}

export function nextPasser(sequence: BallSequence | null) {
  return sequence?.passes.at(-1)?.to ?? sequence?.start ?? "O1";
}

export function normalizeSequence(start: OffensiveId, passes: Pass[]): BallSequence {
  let holder = start;
  return {
    start,
    passes: passes.filter(({ to }) => {
      if (to === holder) return false;
      holder = to;
      return true;
    }),
  };
}

export function savedBallSequence({ ballSequence, receiverOverride, ballRoute }: {
  ballSequence?: BallSequence | null;
  receiverOverride?: string | null;
  ballRoute?: Point[];
}, read: OffensiveId): BallSequence | null {
  if (ballSequence !== undefined) return ballSequence;

  const override = isOffensiveId(receiverOverride) ? receiverOverride : null;
  const path = ballRoute && ballRoute.length > 2 ? ballRoute : undefined;
  if (!override && !path) return null;

  const to = override ?? read;
  return { start: "O1", passes: to === "O1" ? [] : [{ to, path }] };
}

export function ballTimeline(sequence: BallSequence | null, read: OffensiveId): Timeline {
  const start = sequence?.start ?? "O1";
  const passes = sequence?.passes ?? (read === start ? [] : [{ to: read }]);
  const duration = passes.length <= 1 ? DEFAULT_DURATION : Math.max(DEFAULT_DURATION, 1100 + passes.length * 850);

  return {
    start,
    duration,
    passes: passes.map((pass, index) => ({
      ...pass,
      from: passes[index - 1]?.to ?? start,
      release: passes.length === 1 ? DEFAULT_DURATION * 0.48 : 650 + index * 850,
      catchAt: passes.length === 1 ? DEFAULT_DURATION * 0.88 : 1150 + index * 850,
    })),
  };
}

export function mix(start: Point, end: Point, amount: number): Point {
  return [start[0] + (end[0] - start[0]) * amount, start[1] + (end[1] - start[1]) * amount];
}

export function measurePath(points: Point[]): MeasuredPath {
  const distances = [0];
  for (let index = 1; index < points.length; index++) {
    const [x, y] = points[index];
    const [previousX, previousY] = points[index - 1];
    distances.push(distances[index - 1] + Math.hypot(x - previousX, y - previousY));
  }
  return { points, distances, length: distances[distances.length - 1] };
}

export function pointOnPath({ points, distances, length }: MeasuredPath, progress: number): Point {
  if (progress <= 0 || !length) return points[0];
  if (progress >= 1) return points[points.length - 1];

  const distance = progress * length;
  const right = distances.findIndex((value) => value >= distance);
  const left = right - 1;
  return mix(points[left], points[right], (distance - distances[left]) / (distances[right] - distances[left]));
}

export function passPath(path: Point[] | undefined, from: Point, to: Point): Point[] {
  if (!path || path.length < 3) return [from, to];

  // Keep the shape of the drawing while attaching its ends to players who can move.
  const last = path.length - 1;
  const interior = path.slice(1, last).map(([x, y], index): Point => {
    const progress = (index + 1) / last;
    const [originalX, originalY] = mix(path[0], path[last], progress);
    const [newX, newY] = mix(from, to, progress);
    return [x + newX - originalX, y + newY - originalY];
  });
  return [from, ...interior, to];
}

export function ballAtTime(
  timeline: Timeline,
  paths: MeasuredPath[],
  time: number,
  playerAt: (id: OffensiveId, time: number) => Point,
): { position: Point; holder: OffensiveId | null; markerOffset: number } {
  let holder = timeline.start;
  for (const [index, pass] of timeline.passes.entries()) {
    if (time < pass.release) break;
    if (time < pass.catchAt) {
      const progress = (time - pass.release) / (pass.catchAt - pass.release);
      return {
        position: pointOnPath(paths[index], progress),
        holder: null,
        markerOffset: Math.max(0, 1 - Math.min(progress, 1 - progress) * 8),
      };
    }
    holder = pass.to;
  }
  return { position: playerAt(holder, time), holder, markerOffset: 1 };
}
