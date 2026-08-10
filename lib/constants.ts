export const FEATURE_LABELS: Record<string, string> = {
  PTS: "Scoring",
  REB: "Rebounding",
  AST: "Passing",
  STL: "Steals",
  BLK: "Shot Blocking",
  TOV: "Turnovers",
  FG3A: "3PT Volume",
  FG3_PCT: "3PT Accuracy",
  OREB: "Off. Rebounding",
  DREB: "Def. Rebounding",
  USG_PCT: "Usage Rate",
  TS_PCT: "Efficiency",
  AST_PCT: "Playmaking",
};

export const FEATURE_ORDER = [
  "PTS", "REB", "AST", "STL", "BLK", "TOV",
  "FG3A", "FG3_PCT", "OREB", "DREB", "USG_PCT", "TS_PCT", "AST_PCT",
];

export type ArchetypeDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Higher values indicate a stronger fit. Negative weights intentionally reward lower values. */
  weights: Record<string, number>;
};

// These are deliberate basketball-role definitions, not labels guessed after
// clustering. Keeping the weights visible in source makes the model easy to
// explain, critique, and tune as better data becomes available.
export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: "primary-ball-handler",
    name: "Primary Ball Handler",
    shortName: "Ball Handler",
    description: "Creates offense through high-volume playmaking and responsibility.",
    weights: { AST_PCT: 0.35, AST: 0.25, USG_PCT: 0.2, PTS: 0.12, TOV: 0.08 },
  },
  {
    id: "shot-creating-guard",
    name: "Shot-Creating Guard",
    shortName: "Shot Creator",
    description: "Takes on a large scoring load and creates perimeter offense.",
    weights: { PTS: 0.35, USG_PCT: 0.3, FG3A: 0.15, TS_PCT: 0.12, AST: 0.08 },
  },
  {
    id: "three-and-d-wing",
    name: "3-and-D Wing",
    shortName: "3-and-D Wing",
    description: "Provides perimeter spacing with disruptive defensive activity.",
    weights: { FG3A: 0.3, FG3_PCT: 0.25, STL: 0.22, BLK: 0.13, TS_PCT: 0.1 },
  },
  {
    id: "two-way-forward",
    name: "Two-Way Forward",
    shortName: "Two-Way Forward",
    description: "Contributes across scoring, rebounding, and defensive events.",
    weights: { PTS: 0.23, REB: 0.22, STL: 0.2, BLK: 0.18, TS_PCT: 0.17 },
  },
  {
    id: "playmaking-forward",
    name: "Playmaking Forward",
    shortName: "Playmaking Fwd.",
    description: "Pairs frontcourt size and rebounding with above-average creation.",
    weights: { AST_PCT: 0.3, AST: 0.22, REB: 0.22, DREB: 0.16, PTS: 0.1 },
  },
  {
    id: "interior-finisher",
    name: "Interior Finisher",
    shortName: "Interior Finisher",
    description: "Scores efficiently around the basket and creates second chances.",
    weights: { TS_PCT: 0.3, OREB: 0.27, PTS: 0.2, REB: 0.16, FG3A: -0.07 },
  },
  {
    id: "stretch-big",
    name: "Stretch Big",
    shortName: "Stretch Big",
    description: "Brings frontcourt rebounding while extending range to the arc.",
    weights: { FG3A: 0.31, FG3_PCT: 0.24, REB: 0.2, BLK: 0.13, TS_PCT: 0.12 },
  },
  {
    id: "rim-protector",
    name: "Rim Protector",
    shortName: "Rim Protector",
    description: "Anchors the paint with blocks, defensive boards, and size-driven defense.",
    weights: { BLK: 0.43, DREB: 0.25, REB: 0.2, OREB: 0.12 },
  },
  {
    id: "rebounding-big",
    name: "Rebounding Big",
    shortName: "Rebounding Big",
    description: "Wins possessions through offensive and defensive rebounding.",
    weights: { REB: 0.35, OREB: 0.3, DREB: 0.25, BLK: 0.1 },
  },
  {
    id: "all-around-star",
    name: "All-Around Star",
    shortName: "All-Around Star",
    description: "Produces at an elite level across scoring, creation, and the glass.",
    weights: { PTS: 0.3, AST: 0.23, REB: 0.22, USG_PCT: 0.15, TS_PCT: 0.1 },
  },
];

// Qualitative palette, chosen to read distinctly on a dark warm background
// (not a default d3/tailwind palette - picked to sit well against the court-bg amber theme)
export const CLUSTER_COLORS = [
  "#F2A93B", // amber
  "#4FB8A6", // teal
  "#E4572E", // red-orange
  "#7C9FF2", // periwinkle
  "#C9A0F2", // lavender
  "#8FD14F", // green
  "#F2599C", // pink
  "#D9CB4F", // yellow-green
  "#6FD4E8", // cyan
  "#F2733B", // burnt orange
];

export function clusterColor(id: number): string {
  return CLUSTER_COLORS[id % CLUSTER_COLORS.length];
}

export function archetypeColor(id: string): string {
  const index = ARCHETYPES.findIndex((archetype) => archetype.id === id);
  return CLUSTER_COLORS[index < 0 ? 0 : index];
}
