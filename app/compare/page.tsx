"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import StatsUpdated from "@/components/StatsUpdated";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ARCHETYPES, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import { formatPercentile, formatPlayerStat, ROLE_FIT_EXPLANATION } from "@/lib/player-format";
import { FEATURED_MATCHUP, normalizePlayerName } from "@/lib/player-search";
import { scoreArchetypes, standardize, type ArchetypeResult, type PlayerRecord } from "@/lib/stats";
import styles from "./compare.module.css";

type DataFile = { season: string; updatedAt?: string; players: PlayerRecord[] };
type RoleRow = { id: string; name: string; left: number; right: number };

const KEY_STATS = [
  { id: "PTS", label: "Points" },
  { id: "REB", label: "Rebounds" },
  { id: "AST", label: "Assists" },
  { id: "FG3_PCT", label: "3-point %" },
  { id: "TS_PCT", label: "True shooting %" },
  { id: "USG_PCT", label: "Usage %" },
];

export default function ComparePage() {
  return (
    <Suspense fallback={
      <main className="scouting-page">
        <h1 className="scouting-title">Compare Players</h1>
        <p className="scouting-copy" role="status">Loading comparison…</p>
      </main>
    }>
      <CompareFromUrl />
    </Suspense>
  );
}

function CompareFromUrl() {
  const search = useSearchParams();
  const player = search.get("player")?.trim() ?? "";
  const opponent = search.get("opponent")?.trim() ?? "";
  return <CompareExperience key={JSON.stringify([player, opponent])} linkedPlayer={player} linkedOpponent={opponent} />;
}

function CompareExperience({ linkedPlayer, linkedOpponent }: { linkedPlayer: string; linkedOpponent: string }) {
  const [data, setData] = useState<DataFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [leftOverride, setLeftIndex] = useState<number | null>();
  const [rightOverride, setRightIndex] = useState<number | null>();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/players.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load players");
        return response.json() as Promise<DataFile>;
      })
      .then((file) => {
        if (!file.players.length) throw new Error("No players found");
        setData(file);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      fits: scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES),
      scaled: standardize(data.players.map((player) => FEATURE_ORDER.map((feature) => Number(player[feature])))),
    };
  }, [data]);

  const players = data?.players ?? [];
  const leftFromLink = findLinkedPlayer(players, linkedPlayer);
  const rightFromLink = findLinkedPlayer(players, linkedOpponent);
  const leftIndex = leftOverride === undefined ? leftFromLink : leftOverride;
  const rightIndex = rightOverride === undefined ? rightFromLink : rightOverride;
  const unavailablePlayer = (linkedPlayer && leftOverride === undefined && leftFromLink === null)
    || (linkedOpponent && rightOverride === undefined && rightFromLink === null);
  const left = leftIndex === null ? null : players[leftIndex];
  const right = rightIndex === null ? null : players[rightIndex];
  const comparison = !stats || leftIndex === null || rightIndex === null ? null : buildComparison(
    stats.fits[leftIndex], stats.fits[rightIndex], stats.scaled[leftIndex], stats.scaled[rightIndex],
  );
  const curry = players.findIndex((player) => player.name === FEATURED_MATCHUP.first);
  const james = players.findIndex((player) => player.name === FEATURED_MATCHUP.second);

  return (
    <main className="scouting-page">
      <header className={styles.header}>
        <div>
          <h1 className="scouting-title">Compare Players</h1>
          <p className="scouting-copy">See how two players score, create, and fit different roles.</p>
        </div>
        {data && (
          <div className={styles.season}>
            <p>{data.season.replace("-", "–")} season</p>
            <StatsUpdated updatedAt={data.updatedAt} />
          </div>
        )}
      </header>

      <section className={`scouting-card ${styles.matchup}`} aria-label="Choose players to compare">
        <div className={styles.matchupGrid}>
          <PlayerPicker side="left" player={left} players={data?.players} onSelect={setLeftIndex} />
          <span className={styles.versus} aria-hidden="true">VS</span>
          <PlayerPicker side="right" player={right} players={data?.players} onSelect={setRightIndex} />
        </div>
        {!comparison && (
          <div className={styles.matchupFooter}>
            <p className="scouting-copy" role="status">
              {failed
                ? "Player data couldn’t be loaded. Reload the page to try again."
                : !data
                  ? "Loading players…"
                  : unavailablePlayer
                    ? "That player is unavailable in this season’s data. Choose another player to start."
                    : left || right ? "Choose one more player to start comparing." : "Pick any two players or start with a classic matchup."}
            </p>
            {!left && !right && curry >= 0 && james >= 0 && (
              <button type="button" className={styles.example} onClick={() => { setLeftIndex(curry); setRightIndex(james); }}>
                Try {FEATURED_MATCHUP.label} <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        )}
      </section>

      {left && right && comparison && (
        <div className={styles.results}>
          <div className={styles.insights}>
            <article className={`scouting-card ${styles.insight}`}>
              <p className={styles.insightLabel}>Strongest shared role</p>
              <h2 className="scouting-section-title">{comparison.shared.name}</h2>
              <p className="scouting-copy">{left.name} ranks {formatPercentile(comparison.shared.left)} and {right.name} ranks {formatPercentile(comparison.shared.right)} for this role.</p>
            </article>
            <article className={`scouting-card ${styles.insight}`}>
              <p className={styles.insightLabel}>Biggest role gap</p>
              <h2 className="scouting-section-title">{comparison.gap ? comparison.difference.name : "Matching role scores"}</h2>
              <p className="scouting-copy">
                {comparison.gap
                  ? `${comparison.difference.left > comparison.difference.right ? left.name : right.name} leads by ${comparison.gap} percentile ${comparison.gap === 1 ? "point" : "points"}.`
                  : "Each role has the same score for both selections."}
              </p>
            </article>
          </div>

          <section className={`scouting-card ${styles.stats}`} aria-labelledby="compare-stats">
            <h2 className="scouting-section-title" id="compare-stats">Key stats</h2>
            <table className={styles.comparisonTable}>
              <thead>
                <tr><th scope="col">{left.name}</th><th scope="col">Stat</th><th scope="col">{right.name}</th></tr>
              </thead>
              <tbody>
                {KEY_STATS.map(({ id, label }) => (
                  <tr key={id}>
                    <td className="tabular">{formatPlayerStat(left[id], id)}</td>
                    <th scope="row">{label}</th>
                    <td className="tabular">{formatPlayerStat(right[id], id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {comparison.largestStat && (
              <p className="scouting-copy">Their biggest gap relative to the league is in <strong>{FEATURE_LABELS[comparison.largestStat].toLowerCase()}</strong>.</p>
            )}
          </section>

          <details className="scouting-card scouting-disclosure">
            <summary>Role fit <small>Top six roles</small></summary>
            <div className={styles.roleBody}>
              <p className="scouting-copy">{ROLE_FIT_EXPLANATION}</p>
              <p className="scouting-copy">{left.name} on the left, {right.name} on the right.</p>
              {comparison.roleRows.map((role) => <RoleFitRow key={role.id} role={role} />)}
            </div>
          </details>
        </div>
      )}
    </main>
  );
}

function findLinkedPlayer(players: PlayerRecord[], name: string) {
  if (!name) return null;
  const normalized = normalizePlayerName(name);
  const index = players.findIndex((player) => normalizePlayerName(player.name) === normalized);
  return index >= 0 ? index : null;
}

function PlayerPicker({ side, player, players, onSelect }: {
  side: "left" | "right";
  player: PlayerRecord | null;
  players: PlayerRecord[] | undefined;
  onSelect: (index: number | null) => void;
}) {
  const label = side === "left" ? "Player one" : "Player two";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const names = useMemo(() => (players ?? []).map((candidate, index) => ({
    candidate, index, normalized: normalizePlayerName(candidate.name),
  })), [players]);
  const search = normalizePlayerName(query.trim());
  const matches = search ? names.filter(({ normalized }) => normalized.includes(search)).slice(0, 6) : [];

  function select(index: number) {
    onSelect(index);
    setQuery("");
    setOpen(false);
    input.current?.focus();
  }

  return (
    <div className={`${styles.picker} ${side === "right" ? styles.right : ""}`}>
      <div className={styles.playerLabel}>
        <label htmlFor={`compare-${side}`}>{label}</label>
        {player && (
          <button
            type="button"
            className={styles.clear}
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => { onSelect(null); setQuery(""); setOpen(false); input.current?.focus(); }}
          >×</button>
        )}
      </div>

      <div className={styles.playerDisplay}>
        <div className={styles.portrait} aria-hidden="true">
          {player ? (
            <>
              <span className={styles.coverMark}>{player.team}</span>
              <PlayerHeadshot key={player.name} player={player} fallbackClassName={styles.initials} eager />
            </>
          ) : <span className={styles.coverMark}>{side === "left" ? "01" : "02"}</span>}
        </div>
        <div className={styles.playerInfo}>
          {player ? (
            <h2><Link href={`/players/${encodeURIComponent(player.name)}`}>{player.name}</Link></h2>
          ) : <p className={styles.choose}>Choose a player</p>}
          {player && <p className={styles.team}>{player.team}</p>}
        </div>
      </div>

      <form
        role="search"
        aria-label={`Find ${label.toLowerCase()}`}
        className={styles.search}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onSubmit={(event) => { event.preventDefault(); if (matches.length) select(matches[0].index); }}
      >
        <input
          id={`compare-${side}`}
          ref={input}
          type="search"
          placeholder={player ? "Change player" : "Search players"}
          autoComplete="off"
          disabled={!players}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        />
        {open && search && (
          <div className={styles.suggestions}>
            {matches.length > 0 ? (
              <ul aria-label={`${label} matches`}>
                {matches.map(({ candidate, index }) => (
                  <li key={index}>
                    <button type="button" onClick={() => select(index)}>
                      <span>{candidate.name}</span><small>{candidate.team}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="scouting-copy" role="status">No players found.</p>}
          </div>
        )}
      </form>
    </div>
  );
}

function buildComparison(leftFits: ArchetypeResult[], rightFits: ArchetypeResult[], leftScaled: number[], rightScaled: number[]) {
  const rows = ARCHETYPES.map(({ id, name }) => ({
    id,
    name,
    left: leftFits.find((fit) => fit.archetypeId === id)!.score,
    right: rightFits.find((fit) => fit.archetypeId === id)!.score,
  }));
  const shared = rows.reduce((best, row) => Math.min(row.left, row.right) > Math.min(best.left, best.right) ? row : best);
  const difference = rows.reduce((best, row) => Math.abs(row.left - row.right) > Math.abs(best.left - best.right) ? row : best);
  let largestStat: string | null = null;
  let largestGap = 0;
  for (const [index, feature] of FEATURE_ORDER.entries()) {
    const gap = Math.abs(leftScaled[index] - rightScaled[index]);
    if (gap > largestGap) {
      largestGap = gap;
      largestStat = feature;
    }
  }
  return {
    shared,
    difference,
    gap: Math.abs(difference.left - difference.right),
    largestStat,
    roleRows: rows.sort((a, b) => Math.max(b.left, b.right) - Math.max(a.left, a.right)).slice(0, 6),
  };
}

function RoleFitRow({ role: { name, left, right } }: { role: RoleRow }) {
  return (
    <div className={styles.roleRow}>
      <div>
        <span className="tabular">{formatPercentile(left)}<span className="sr-only"> percentile</span></span>
        <span>{name}</span>
        <span className="tabular">{formatPercentile(right)}<span className="sr-only"> percentile</span></span>
      </div>
      <div className={styles.fitBars} aria-hidden="true">
        <span><i style={{ width: `${left}%` }} /></span>
        <span><i style={{ width: `${right}%` }} /></span>
      </div>
    </div>
  );
}
