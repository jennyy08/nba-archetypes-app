"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PlayerIdentity from "@/components/PlayerIdentity";
import { ARCHETYPES, archetypeColor, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import { formatPercentile, formatPlayerStat, ROLE_FIT_EXPLANATION } from "@/lib/player-format";
import { comparePlayerHref } from "@/lib/player-search";
import { nearestNeighbors, scoreArchetypes, standardize, type PlayerRecord } from "@/lib/stats";

type DataFile = { season: string; players: PlayerRecord[] };
const playerHref = (name: string) => `/players/${encodeURIComponent(name)}`;

export default function PlayerProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [data, setData] = useState<DataFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/players.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Player data unavailable");
        return response.json() as Promise<DataFile>;
      })
      .then((file) => {
        if (!file.players.length) throw new Error("No player data");
        setData(file);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;
    const scaled = standardize(data.players.map((player) => FEATURE_ORDER.map((feature) => Number(player[feature]))));
    return { scaled, fits: scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES) };
  }, [data]);

  if (!data || !computed) {
    return <main className="scouting-page"><p className="scouting-copy" role="status">{failed ? "Player data couldn’t be loaded. Reload the page to try again." : "Loading player profile…"}</p></main>;
  }
  const playerName = decodeURIComponent(name);
  const playerIndex = data.players.findIndex((player) => player.name.toLowerCase() === playerName.toLowerCase());
  if (playerIndex < 0) {
    return (
      <main className="scouting-page">
        <h1 className="scouting-title">No matching profile</h1>
        <Link href="/" className="profile-action mt-6">Back to Explore Roles</Link>
      </main>
    );
  }

  const player = data.players[playerIndex];
  const fits = computed.fits[playerIndex];
  const primary = ARCHETYPES.find((archetype) => archetype.id === fits[0].archetypeId)!;
  const neighbors = nearestNeighbors(computed.scaled, playerIndex, 5).map(({ index }) => data.players[index]);

  return (
    <main className="scouting-page">
      <Link href="/" className="text-sm text-text-faint hover:text-amber">← Back to Explore Roles</Link>
      <section className="scouting-card mt-4" aria-labelledby="player-name">
        <PlayerIdentity player={player} role={primary.name} season={data.season} actions={
          <>
            <Link href={comparePlayerHref(player.name)} className="profile-action profile-action-primary">Compare players</Link>
            <Link href="/play-lab" className="profile-action">Open Play Lab</Link>
          </>
        } />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="profile-card">
          <h2 className="profile-heading">Role fit</h2>
          <p className="scouting-copy mt-2">{primary.description} {ROLE_FIT_EXPLANATION}</p>
          <div className="mt-4 space-y-3">
            {fits.slice(0, 5).map((fit) => {
              const role = ARCHETYPES.find((item) => item.id === fit.archetypeId)!;
              return (
                <div key={fit.archetypeId}>
                  <div className="flex justify-between gap-2 text-sm text-text-dim">
                    <span>{role.name}</span>
                    <span className="tabular text-text">{formatPercentile(fit.score)}<span className="sr-only"> percentile</span></span>
                  </div>
                  <div className="fit-track mt-1" aria-hidden="true">
                    <div className="fit-fill" style={{ width: `${fit.score}%`, background: archetypeColor(role.id) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="profile-card">
          <h2 className="profile-heading">Season summary</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
            <Stat label="Age" value={player.age} />
            <Stat label="Games" value={player.gp} />
            <Stat label="Minutes per game" value={formatPlayerStat(player.min, "min")} />
          </dl>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="profile-card">
          <h2 className="profile-heading">Stat profile</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-8 divide-y divide-court-border sm:grid-cols-3">
            {FEATURE_ORDER.map((feature) => (
              <div key={feature} className="py-3">
                <dt className="text-xs text-text-faint">{FEATURE_LABELS[feature]}</dt>
                <dd className="tabular mt-0.5 text-lg">{formatPlayerStat(player[feature], feature)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="profile-card">
          <h2 className="profile-heading">Closest matches</h2>
          <p className="scouting-copy mt-2">Players with the most similar stats across the model.</p>
          <ul className="mt-4 space-y-3">
            {neighbors.map((neighbor) => (
              <li key={neighbor.name}>
                <Link href={playerHref(neighbor.name)} className="flex justify-between gap-2 text-sm text-text-dim hover:text-amber">
                  <span>{neighbor.name}</span><span className="shrink-0 text-text-faint">{neighbor.team} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-lg">{value}</dd>
    </div>
  );
}
