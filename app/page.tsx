"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ScatterPlot from "@/components/ScatterPlot";
import { nearestNeighbors, pca2D, kMeans, scoreArchetypes, standardize } from "@/lib/stats";
import { ARCHETYPES, archetypeColor, clusterColor, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";

type Player = Record<string, number | string> & { name: string; team: string };
type DataFile = { season: string; features: string[]; players: Player[] };
export type AppView = "explore" | "lab";

export default function Home() {
  return <ArchetypeExperience view="explore" />;
}

export function ArchetypeExperience({ view }: { view: AppView }) {
  const [data, setData] = useState<DataFile | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set(FEATURE_ORDER));
  const [k, setK] = useState(7);

  useEffect(() => {
    fetch("/data/players.json", { cache: "no-store" }).then((r) => r.json()).then((d: DataFile) => setData(d));
  }, []);

  const activeFeatures = useMemo(() => FEATURE_ORDER.filter((feature) => selectedFeatures.has(feature)), [selectedFeatures]);

  const explorer = useMemo(() => {
    if (!data) return null;
    const matrix = data.players.map((player) => FEATURE_ORDER.map((feature) => Number(player[feature])));
    const scaled = standardize(matrix);
    const { coords, varianceExplained } = pca2D(scaled);
    const fits = scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES);
    return { scaled, coords, varianceExplained, fits };
  }, [data]);

  const lab = useMemo(() => {
    if (!data || activeFeatures.length < 2) return null;
    const scaled = standardize(data.players.map((player) => activeFeatures.map((feature) => Number(player[feature]))));
    const clusters = kMeans(scaled, k);
    const { coords, varianceExplained } = pca2D(scaled);
    const labels: Record<number, string> = {};
    for (let cluster = 0; cluster < k; cluster++) {
      const members = clusters.map((value, index) => value === cluster ? index : -1).filter((index) => index >= 0);
      const average = activeFeatures.map((_, featureIndex) => members.reduce((sum, index) => sum + scaled[index][featureIndex], 0) / (members.length || 1));
      labels[cluster] = average.map((value, index) => ({ value, feature: activeFeatures[index] }))
        .sort((a, b) => b.value - a.value).slice(0, 2).map(({ feature }) => FEATURE_LABELS[feature]).join(" + ");
    }
    return { scaled, coords, varianceExplained, clusters, labels };
  }, [data, activeFeatures, k]);

  // Both computations are available whenever player data has loaded; the
  // loading guard below protects the initial render.
  const active = (view === "explore" ? explorer : lab)!;
  const neighborIndices = useMemo(() => {
    if (!active || selectedIndex === null) return [];
    return nearestNeighbors(active.scaled, selectedIndex).map(({ index }) => index);
  }, [active, selectedIndex]);

  const searchMatches = useMemo(() => {
    if (!data || !search.trim()) return [];
    return data.players.map((player, index) => ({ player, index }))
      .filter(({ player }) => player.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6);
  }, [data, search]);

  if (!data || !explorer || !lab) {
    return <div className="min-h-screen flex items-center justify-center text-text-dim font-display text-lg tracking-wide">Loading player data…</div>;
  }

  const selectedPlayer = selectedIndex === null ? null : data.players[selectedIndex];
  const selectedFits = selectedIndex === null ? [] : explorer.fits[selectedIndex];
  const isExplore = view === "explore";
  const visibleIndexes = data.players.map((_, index) => index).filter((index) =>
    !isExplore || !selectedArchetype || explorer.fits[index][0].archetypeId === selectedArchetype
  );
  const plotPoints = visibleIndexes.map((index) => ({
    index,
    x: active.coords[index][0],
    y: active.coords[index][1],
    cluster: isExplore
      ? ARCHETYPES.findIndex((archetype) => archetype.id === explorer.fits[index][0].archetypeId)
      : lab.clusters[index],
    name: data.players[index].name,
    team: data.players[index].team,
  }));
  const archetypeCounts = ARCHETYPES.reduce<Record<string, number>>((counts, archetype) => {
    counts[archetype.id] = explorer.fits.filter((fits) => fits[0].archetypeId === archetype.id).length;
    return counts;
  }, {});

  return (
    <div className="min-h-screen court-texture">
      <header className="border-b border-court-border px-6 md:px-8 py-6">
        <div className="max-w-[1600px] mx-auto">
          <div>
            <p className="font-display text-xs tracking-[0.22em] text-amber uppercase">NBA player archetypes</p>
            <h1 className="font-display text-3xl tracking-wide text-text uppercase mt-1">{view === "explore" ? "Explore Roles" : "Profile Lab"}</h1>
            <p className="text-text-dim text-sm mt-1 max-w-3xl">
              {view === "explore" ? `${data.season} season · ${data.players.length} players.` : "Experiment with the statistical inputs behind custom player groupings."}
            </p>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_310px] gap-6 p-6 md:p-8">
        <aside className="space-y-4">
          {isExplore ? <>
            <section className="bg-court-panel border border-court-border rounded-lg p-4">
              <p className="font-display text-sm uppercase tracking-wide text-amber">Role browser</p>
              <p className="text-xs text-text-faint mt-1 mb-3">A player’s primary role is their strongest fit. Select one to filter the map.</p>
              <button onClick={() => setSelectedArchetype(null)} className={`role-filter ${!selectedArchetype ? "role-filter-active" : ""}`}>All players <span>{data.players.length}</span></button>
              {ARCHETYPES.map((archetype) => <button key={archetype.id} onClick={() => setSelectedArchetype(archetype.id)} className={`role-filter ${selectedArchetype === archetype.id ? "role-filter-active" : ""}`}>
                <span className="flex items-center gap-2"><i className="role-dot" style={{ background: archetypeColor(archetype.id) }} />{archetype.shortName}</span><span>{archetypeCounts[archetype.id]}</span>
              </button>)}
            </section>
            <section className="bg-court-panel border border-court-border rounded-lg p-4 text-xs text-text-dim leading-relaxed">
              <p className="font-display text-sm uppercase tracking-wide text-amber mb-2">How fits work</p>
              Each role has deliberately chosen stat weights. Scores are percentiles within this season’s player pool—not a claim that basketball players fit only one role.
            </section>
          </> : <LabControls k={k} setK={setK} selectedFeatures={selectedFeatures} setSelectedFeatures={setSelectedFeatures} />}
          <Search search={search} setSearch={setSearch} matches={searchMatches} onSelect={(index) => { setSelectedIndex(index); setSearch(""); }} />
        </aside>

        <section>
          {isExplore && <div className="mb-4"><p className="font-display text-xl uppercase tracking-wide">{selectedArchetype ? ARCHETYPES.find((a) => a.id === selectedArchetype)?.name : "Every player, mapped by profile"}</p><p className="text-sm text-text-dim mt-1">Color shows each player’s primary role; location shows overall statistical similarity.</p></div>}
          {!isExplore && <div className="mb-4"><p className="font-display text-xl uppercase tracking-wide">Custom clustering</p><p className="text-sm text-text-dim mt-1">This is the experimental view: changing the inputs changes the groups.</p></div>}
          <ScatterPlot points={plotPoints} selectedIndex={selectedIndex} neighborIndices={neighborIndices} onSelect={setSelectedIndex} />
          <p className="text-xs text-text-faint mt-2">2D PCA projection preserves {(active.varianceExplained * 100).toFixed(0)}% of variation across {isExplore ? FEATURE_ORDER.length : activeFeatures.length} stats. Click a player for their profile.</p>
          {!isExplore && <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">{Object.entries(lab.labels).map(([id, label]) => <span key={id} className="text-xs text-text-dim flex items-center gap-1.5"><i className="role-dot" style={{ background: clusterColor(Number(id)) }} />{label}</span>)}</div>}
        </section>

        <aside className="bg-court-panel border border-court-border rounded-lg p-4 h-fit">
          {!selectedPlayer ? <p className="text-sm text-text-faint">Search for a player or click a dot to see their role profile and closest statistical matches.</p> : <PlayerPanel player={selectedPlayer} features={isExplore ? FEATURE_ORDER : activeFeatures} fits={selectedFits} neighbors={neighborIndices} players={data.players} onSelect={setSelectedIndex} />}
        </aside>
      </main>
    </div>
  );
}

function Search({ search, setSearch, matches, onSelect }: { search: string; setSearch: (value: string) => void; matches: { player: Player; index: number }[]; onSelect: (index: number) => void }) {
  return <section className="bg-court-panel border border-court-border rounded-lg p-4"><label className="font-display text-sm uppercase tracking-wide text-amber block mb-2">Find a player</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name…" className="w-full bg-court-panel-2 border border-court-border rounded px-3 py-1.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-amber" />{matches.length > 0 && <ul className="mt-2 space-y-1">{matches.map(({ player, index }) => <li key={index}><button onClick={() => onSelect(index)} className="text-sm text-text-dim hover:text-amber text-left w-full">{player.name} <span className="text-text-faint">({player.team})</span></button></li>)}</ul>}</section>;
}

function LabControls({ k, setK, selectedFeatures, setSelectedFeatures }: { k: number; setK: (value: number) => void; selectedFeatures: Set<string>; setSelectedFeatures: (value: Set<string>) => void }) {
  const toggleFeature = (feature: string, checked: boolean) => {
    const next = new Set(selectedFeatures);
    if (checked) next.add(feature);
    else next.delete(feature);
    if (next.size >= 2) setSelectedFeatures(next);
  };
  return <><section className="bg-court-panel border border-court-border rounded-lg p-4"><label className="font-display text-sm uppercase tracking-wide text-amber block mb-2">Clusters (k = {k})</label><input type="range" min={2} max={10} value={k} onChange={(event) => setK(Number(event.target.value))} className="w-full accent-amber" /><p className="text-xs text-text-faint mt-1">More clusters creates finer, less stable groups.</p></section><section className="bg-court-panel border border-court-border rounded-lg p-4"><label className="font-display text-sm uppercase tracking-wide text-amber block mb-2">Stats to cluster on</label><div className="space-y-1.5 max-h-64 overflow-y-auto">{FEATURE_ORDER.map((feature) => <label key={feature} className="flex items-center gap-2 text-sm text-text-dim cursor-pointer"><input type="checkbox" checked={selectedFeatures.has(feature)} onChange={(event) => toggleFeature(feature, event.target.checked)} className="accent-amber" />{FEATURE_LABELS[feature]}</label>)}</div></section></>;
}

function PlayerPanel({ player, features, fits, neighbors, players, onSelect }: { player: Player; features: string[]; fits: { archetypeId: string; score: number }[]; neighbors: number[]; players: Player[]; onSelect: (index: number) => void }) {
  const primary = ARCHETYPES.find((archetype) => archetype.id === fits[0]?.archetypeId);
  return <div><h2 className="font-display text-xl text-text uppercase tracking-wide"><Link href={`/players/${encodeURIComponent(player.name)}`} className="hover:text-amber">{player.name}</Link></h2><p className="text-sm text-text-dim">{player.team} · {primary?.name}</p>{primary && <p className="text-xs text-text-faint mt-1 leading-relaxed">{primary.description}</p>}
    <p className="font-display text-sm uppercase tracking-wide text-amber mt-5 mb-2">Role fit</p><div className="space-y-2">{fits.slice(0, 3).map((fit) => { const archetype = ARCHETYPES.find((item) => item.id === fit.archetypeId)!; return <div key={fit.archetypeId}><div className="flex justify-between text-xs text-text-dim"><span>{archetype.shortName}</span><span className="tabular">{fit.score}</span></div><div className="fit-track"><div className="fit-fill" style={{ width: `${fit.score}%`, background: archetypeColor(fit.archetypeId) }} /></div></div>; })}</div>
    <table className="w-full text-sm my-5"><tbody>{features.map((feature) => <tr key={feature} className="border-t border-court-border"><td className="py-1 text-text-faint">{FEATURE_LABELS[feature]}</td><td className="py-1 text-right tabular text-text">{typeof player[feature] === "number" ? (player[feature] as number).toFixed(feature.includes("PCT") ? 3 : 1) : player[feature]}</td></tr>)}</tbody></table>
    <p className="font-display text-sm uppercase tracking-wide text-amber mb-2">Closest matches</p><ul className="space-y-1.5">{neighbors.map((index) => <li key={index}><button onClick={() => onSelect(index)} className="text-sm text-text-dim hover:text-amber text-left w-full flex justify-between"><span>{players[index].name}</span><span className="text-text-faint">{players[index].team}</span></button></li>)}</ul></div>;
}
