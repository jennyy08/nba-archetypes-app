"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ARCHETYPES, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import { scoreArchetypes } from "@/lib/stats";

type Player = Record<string, number | string> & { name: string; team: string };
type DataFile = { season: string; players: Player[] };

const principles = [
  ["Intentional roles", "Archetypes are weighted statistical models for recognizable basketball roles—not labels guessed from a random cluster."],
  ["Relative fit", "Scores are percentiles within the selected season. A score of 90 means that player fits the role more strongly than most players in this data set."],
  ["Exploration, kept separate", "Profile Lab uses k-means to surface custom statistical groupings. Because its output changes with the selected inputs, it does not define a player’s stable role."],
];

export default function MethodologyPage() {
  const [data, setData] = useState<DataFile | null>(null);
  useEffect(() => { fetch("/data/players.json", { cache: "no-store" }).then((response) => response.json()).then(setData); }, []);

  const fits = useMemo(() => data ? scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES) : null, [data]);

  return <main className="min-h-[calc(100vh-4rem)] court-texture px-6 py-12 md:px-8">
    <div className="max-w-5xl mx-auto">
      <p className="font-display text-xs tracking-[0.22em] text-amber uppercase">How the project thinks</p>
      <h1 className="font-display text-4xl md:text-5xl uppercase tracking-wide mt-2">Methodology &amp; roles</h1>
      <p className="text-text-dim max-w-2xl mt-4 leading-relaxed">This project separates stable basketball-role interpretation from open-ended statistical discovery. The goal is a model that is both interactive and explainable.</p>

      <div className="grid gap-4 mt-10 md:grid-cols-3">
        {principles.map(([title, description], index) => <article key={title} className="bg-court-panel border border-court-border rounded-lg p-5">
          <span className="font-display text-amber text-xl">0{index + 1}</span>
          <h2 className="font-display uppercase tracking-wide text-xl mt-5">{title}</h2>
          <p className="text-sm text-text-dim leading-relaxed mt-2">{description}</p>
        </article>)}
      </div>

      <section className="mt-6 bg-court-panel-2 border border-court-border rounded-lg p-6 max-w-3xl">
        <h2 className="font-display uppercase tracking-wide text-xl text-amber">Current limitations</h2>
        <p className="text-sm text-text-dim leading-relaxed mt-3">The current model uses available box-score and advanced summary statistics. It does not yet include player-tracking data, play-by-play context, lineup context, matchup information, or an explicit position field. These are useful future inputs—not hidden assumptions in the current scores.</p>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6"><div><p className="font-display text-xs tracking-[0.22em] text-amber uppercase">Archetype directory</p><h2 className="font-display text-3xl uppercase tracking-wide mt-1">The ten roles</h2></div><p className="text-xs text-text-faint">{data ? `${data.season} season examples` : "Loading season examples…"}</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          {ARCHETYPES.map((archetype) => {
            const examples = !data || !fits ? [] : data.players.map((player, index) => ({ player, score: fits[index].find((fit) => fit.archetypeId === archetype.id)!.score })).sort((a, b) => b.score - a.score).slice(0, 3);
            const signals = Object.entries(archetype.weights).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a)).slice(0, 4);
            return <article key={archetype.id} className="directory-card"><div><p className="font-display text-xs uppercase tracking-[0.16em] text-amber">{archetype.shortName}</p><h3 className="font-display text-2xl uppercase tracking-wide mt-1">{archetype.name}</h3><p className="text-sm text-text-dim leading-relaxed mt-2">{archetype.description}</p></div><div className="mt-5"><p className="directory-label">Key signals</p><div className="flex flex-wrap gap-1.5 mt-2">{signals.map(([feature, weight]) => <span key={feature} className="signal-chip">{weight < 0 ? "Lower " : "Higher "}{FEATURE_LABELS[feature]}</span>)}</div></div><div className="mt-5 border-t border-court-border pt-4"><p className="directory-label">Strongest current fits</p>{examples.length > 0 ? <ol className="space-y-1.5 mt-2">{examples.map(({ player, score }, index) => <li key={player.name} className="flex justify-between text-sm"><span className="text-text-dim"><span className="text-text-faint mr-2">0{index + 1}</span>{player.name} <span className="text-text-faint">{player.team}</span></span><span className="tabular text-amber">{score}</span></li>)}</ol> : <p className="text-xs text-text-faint mt-2">Calculating examples…</p>}</div></article>;
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 mt-10"><Link href="/" className="rounded bg-amber px-4 py-2 text-sm font-medium text-court-bg">Explore roles</Link><Link href="/compare" className="rounded border border-court-border px-4 py-2 text-sm text-text-dim hover:text-text">Compare players</Link><Link href="/profile-lab" className="rounded border border-court-border px-4 py-2 text-sm text-text-dim hover:text-text">Open Profile Lab</Link></div>
    </div>
  </main>;
}
