"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ARCHETYPES, archetypeColor, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import { nearestNeighbors, scoreArchetypes, standardize } from "@/lib/stats";

type Player = Record<string, number | string> & { name: string; team: string };
type DataFile = { season: string; players: Player[] };
const playerHref = (name: string) => `/players/${encodeURIComponent(name)}`;

export default function PlayerProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [data, setData] = useState<DataFile | null>(null);
  useEffect(() => { fetch("/data/players.json", { cache: "no-store" }).then((response) => response.json()).then(setData); }, []);
  const computed = useMemo(() => {
    if (!data) return null;
    const scaled = standardize(data.players.map((player) => FEATURE_ORDER.map((feature) => Number(player[feature]))));
    return { scaled, fits: scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES) };
  }, [data]);
  if (!data || !computed) return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-text-dim font-display">Loading player profile…</div>;
  const playerName = decodeURIComponent(name);
  const playerIndex = data.players.findIndex((player) => player.name.toLowerCase() === playerName.toLowerCase());
  if (playerIndex < 0) return <main className="min-h-[calc(100vh-4rem)] court-texture px-6 py-16"><div className="max-w-xl mx-auto"><p className="font-display text-xs text-amber uppercase tracking-[0.2em]">Player not found</p><h1 className="font-display text-4xl uppercase mt-2">No matching profile</h1><Link href="/" className="inline-block mt-6 rounded bg-amber px-4 py-2 text-sm font-medium text-court-bg">Back to Explore Roles</Link></div></main>;
  const player = data.players[playerIndex];
  const fits = computed.fits[playerIndex];
  const primary = ARCHETYPES.find((archetype) => archetype.id === fits[0].archetypeId)!;
  const neighbors = nearestNeighbors(computed.scaled, playerIndex, 5).map(({ index, distance }) => ({ player: data.players[index], distance }));

  return <main className="min-h-[calc(100vh-4rem)] court-texture px-6 py-10 md:px-8"><div className="max-w-5xl mx-auto"><Link href="/" className="text-xs text-text-faint hover:text-amber">← Back to Explore Roles</Link><section className="profile-hero mt-5"><div><p className="font-display text-xs uppercase tracking-[0.2em] text-amber">{data.season} player profile</p><h1 className="font-display text-4xl md:text-5xl uppercase tracking-wide mt-2">{player.name}</h1><p className="text-text-dim mt-2">{player.team} · Primary role: <span className="text-text">{primary.name}</span></p><p className="text-sm text-text-dim max-w-xl leading-relaxed mt-4">{primary.description}</p></div><div className="flex flex-wrap gap-2 h-fit"><Link href="/compare" className="profile-action">Compare players</Link><Link href="/play-lab" className="profile-action">Open Play Lab</Link></div></section><div className="grid gap-6 mt-8 lg:grid-cols-[1fr_330px]"><section className="profile-card"><h2 className="profile-heading">Role fit</h2><p className="text-xs text-text-faint mt-1">Within-season percentile fit for the top five role profiles.</p><div className="space-y-4 mt-5">{fits.slice(0, 5).map((fit) => { const archetype = ARCHETYPES.find((item) => item.id === fit.archetypeId)!; return <div key={fit.archetypeId}><div className="flex justify-between text-sm text-text-dim"><span>{archetype.name}</span><span className="tabular text-text">{fit.score}</span></div><div className="fit-track mt-1"><div className="fit-fill" style={{ width: `${fit.score}%`, background: archetypeColor(fit.archetypeId) }} /></div></div>; })}</div></section><section className="profile-card"><h2 className="profile-heading">Season line</h2><dl className="grid grid-cols-2 gap-y-3 mt-5 text-sm"><Stat label="Age" value={player.age} /><Stat label="Games" value={player.gp} /><Stat label="Minutes" value={player.min} /><Stat label="Points" value={player.PTS} /><Stat label="Rebounds" value={player.REB} /><Stat label="Assists" value={player.AST} /></dl></section></div><div className="grid gap-6 mt-6 lg:grid-cols-[1fr_330px]"><section className="profile-card"><h2 className="profile-heading">Stat profile</h2><div className="grid grid-cols-2 gap-x-8 divide-y divide-court-border mt-4 sm:grid-cols-3">{FEATURE_ORDER.map((feature) => <div key={feature} className="py-3"><p className="text-xs text-text-faint">{FEATURE_LABELS[feature]}</p><p className="tabular text-lg mt-0.5">{Number(player[feature]).toFixed(feature.includes("PCT") ? 3 : 1)}</p></div>)}</div></section><section className="profile-card"><h2 className="profile-heading">Closest matches</h2><p className="text-xs text-text-faint mt-1">Nearest players across all selected model stats.</p><ul className="space-y-3 mt-5">{neighbors.map(({ player: neighbor }) => <li key={neighbor.name}><Link href={playerHref(neighbor.name)} className="flex justify-between text-sm text-text-dim hover:text-amber"><span>{neighbor.name}</span><span className="text-text-faint">{neighbor.team} →</span></Link></li>)}</ul></section></div></div></main>;
}

function Stat({ label, value }: { label: string; value: number | string }) { return <div><dt className="text-xs text-text-faint">{label}</dt><dd className="tabular text-text mt-0.5">{typeof value === "number" ? value.toFixed(1) : value}</dd></div>; }
