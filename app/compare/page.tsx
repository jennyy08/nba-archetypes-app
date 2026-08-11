"use client";

import { useEffect, useMemo, useState } from "react";
import { ARCHETYPES, archetypeColor, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import { scoreArchetypes, standardize } from "@/lib/stats";

type Player = Record<string, number | string> & { name: string; team: string };
type DataFile = { season: string; players: Player[] };

const KEY_STATS = ["PTS", "REB", "AST", "FG3_PCT", "TS_PCT", "USG_PCT"];

export default function ComparePage() {
  const [data, setData] = useState<DataFile | null>(null);
  const [leftIndex, setLeftIndex] = useState<number | null>(null);
  const [rightIndex, setRightIndex] = useState<number | null>(null);

  useEffect(() => { fetch("/data/players.json", { cache: "no-store" }).then((response) => response.json()).then(setData); }, []);

  const computed = useMemo(() => {
    if (!data) return null;
    const fits = scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES);
    const scaled = standardize(data.players.map((player) => FEATURE_ORDER.map((feature) => Number(player[feature]))));
    return { fits, scaled };
  }, [data]);

  if (!data || !computed) return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-text-dim font-display tracking-wide">Loading player data…</div>;

  const left = leftIndex === null ? null : data.players[leftIndex];
  const right = rightIndex === null ? null : data.players[rightIndex];
  const leftFits = leftIndex === null ? [] : computed.fits[leftIndex];
  const rightFits = rightIndex === null ? [] : computed.fits[rightIndex];
  const comparison = leftIndex === null || rightIndex === null ? null : buildComparison(leftFits, rightFits, computed.scaled[leftIndex], computed.scaled[rightIndex]);

  return <main className="min-h-[calc(100vh-4rem)] court-texture px-6 py-8 md:px-8">
    <div className="max-w-[1300px] mx-auto">
      <p className="font-display text-xs tracking-[0.22em] text-amber uppercase">Side-by-side scouting</p>
      <h1 className="font-display text-4xl uppercase tracking-wide mt-2">Compare Players</h1>
      <p className="text-text-dim text-sm mt-2 max-w-2xl">Choose any two players to compare their role fits and the stats behind their profiles.</p>

      <section className="grid gap-4 mt-8 md:grid-cols-2">
        <PlayerSearch title="Player one" player={left} players={data.players} onSelect={setLeftIndex} />
        <PlayerSearch title="Player two" player={right} players={data.players} onSelect={setRightIndex} />
      </section>

      {!comparison || !left || !right ? <div className="compare-empty mt-6">Search for two players to start the comparison.</div> : <>
        <section className="grid gap-4 mt-6 md:grid-cols-2">
          <InsightCard eyebrow="Most alike" title={comparison.shared.name} text={`Both players show their strongest shared fit here: ${left.name} scores ${comparison.shared.left}, while ${right.name} scores ${comparison.shared.right}.`} color={archetypeColor(comparison.shared.id)} />
          <InsightCard eyebrow="Biggest difference" title={comparison.difference.name} text={`${comparison.difference.left > comparison.difference.right ? left.name : right.name} leads this role fit by ${comparison.difference.gap} points.`} color={archetypeColor(comparison.difference.id)} />
        </section>

        <section className="compare-panel mt-6">
          <div className="compare-names"><PlayerName player={left} /><span className="font-display text-text-faint">VS</span><PlayerName player={right} align="right" /></div>
          <h2 className="compare-heading">Role fit</h2>
          <div className="space-y-4">{comparison.roleRows.map((row) => <RoleRow key={row.id} {...row} />)}</div>
        </section>

        <section className="compare-panel mt-6">
          <h2 className="compare-heading">Key stats</h2>
          <div className="divide-y divide-court-border">{KEY_STATS.map((stat) => <StatRow key={stat} stat={stat} left={Number(left[stat])} right={Number(right[stat])} />)}</div>
          <p className="text-xs text-text-faint mt-4">Largest statistical separation in this comparison: <span className="text-text">{FEATURE_LABELS[comparison.largestStat]}</span>.</p>
        </section>
      </>}
    </div>
  </main>;
}

function PlayerSearch({ title, player, players, onSelect }: { title: string; player: Player | null; players: Player[]; onSelect: (index: number) => void }) {
  const [query, setQuery] = useState("");
  const matches = query.trim() ? players.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => candidate.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];
  return <section className="compare-search"><label className="font-display text-xs text-amber uppercase tracking-wide">{title}</label><div className="flex items-center justify-between gap-3 mt-2"><span className="font-display text-xl uppercase truncate">{player ? player.name : "Choose a player"}</span>{player && <span className="text-xs text-text-faint shrink-0">{player.team}</span>}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name…" className="compare-input mt-3" />{matches.length > 0 && <ul className="mt-2 space-y-1">{matches.map(({ candidate, index }) => <li key={index}><button onClick={() => { onSelect(index); setQuery(""); }} className="text-sm text-text-dim hover:text-amber w-full text-left">{candidate.name} <span className="text-text-faint">({candidate.team})</span></button></li>)}</ul>}</section>;
}

function buildComparison(leftFits: { archetypeId: string; score: number }[], rightFits: { archetypeId: string; score: number }[], leftScaled: number[], rightScaled: number[]) {
  const rows = ARCHETYPES.map((archetype) => ({ id: archetype.id, name: archetype.name, left: leftFits.find((fit) => fit.archetypeId === archetype.id)!.score, right: rightFits.find((fit) => fit.archetypeId === archetype.id)!.score }));
  const shared = rows.reduce((best, row) => Math.min(row.left, row.right) > Math.min(best.left, best.right) ? row : best);
  const difference = rows.reduce((best, row) => Math.abs(row.left - row.right) > Math.abs(best.left - best.right) ? row : best);
  const largestStat = FEATURE_ORDER.reduce((best, feature, index) => Math.abs(leftScaled[index] - rightScaled[index]) > Math.abs(leftScaled[FEATURE_ORDER.indexOf(best)] - rightScaled[FEATURE_ORDER.indexOf(best)]) ? feature : best, FEATURE_ORDER[0]);
  return { shared, difference: { ...difference, gap: Math.abs(difference.left - difference.right) }, largestStat, roleRows: rows.sort((a, b) => Math.max(b.left, b.right) - Math.max(a.left, a.right)).slice(0, 6) };
}

function InsightCard({ eyebrow, title, text, color }: { eyebrow: string; title: string; text: string; color: string }) { return <article className="compare-panel"><p className="font-display text-xs uppercase tracking-wide" style={{ color }}>{eyebrow}</p><h2 className="font-display text-2xl uppercase tracking-wide mt-1">{title}</h2><p className="text-sm text-text-dim leading-relaxed mt-2">{text}</p></article>; }
function PlayerName({ player, align = "left" }: { player: Player; align?: "left" | "right" }) { return <div className={align === "right" ? "text-right" : ""}><p className="font-display text-lg uppercase tracking-wide">{player.name}</p><p className="text-xs text-text-faint">{player.team}</p></div>; }
function RoleRow({ id, name, left, right }: { id: string; name: string; left: number; right: number }) { const color = archetypeColor(id); return <div><div className="flex justify-between text-xs text-text-dim mb-1"><span className="tabular">{left}</span><span>{name}</span><span className="tabular">{right}</span></div><div className="grid grid-cols-[1fr_1px_1fr] gap-1 items-center"><div className="compare-bar-left"><div style={{ width: `${left}%`, background: color }} /></div><div className="h-5 bg-court-border" /><div className="compare-bar-right"><div style={{ width: `${right}%`, background: color }} /></div></div></div>; }
function StatRow({ stat, left, right }: { stat: string; left: number; right: number }) { const decimals = stat.includes("PCT") ? 3 : 1; return <div className="grid grid-cols-3 py-2 text-sm"><span className="tabular text-text">{left.toFixed(decimals)}</span><span className="text-center text-text-faint">{FEATURE_LABELS[stat]}</span><span className="tabular text-text text-right">{right.toFixed(decimals)}</span></div>; }
