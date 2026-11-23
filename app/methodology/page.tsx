"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ARCHETYPES, archetypeColor, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import { scoreArchetypes, type PlayerRecord } from "@/lib/stats";
import { formatPercentile } from "@/lib/player-format";
import styles from "./methodology.module.css";

type DataFile = { season: string; players: PlayerRecord[] };

export default function MethodologyPage() {
  const [showExamples, setShowExamples] = useState(false);
  const [data, setData] = useState<DataFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!showExamples) return;
    const controller = new AbortController();
    fetch("/data/players.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load role examples");
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
  }, [showExamples]);

  const examples = useMemo(() => {
    if (!data) return null;
    const scores = scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES);
    return Object.fromEntries(ARCHETYPES.map(({ id }) => [
      id,
      data.players.map((player, index) => ({
        player,
        score: scores[index].find((fit) => fit.archetypeId === id)!.score,
      })).sort((a, b) => b.score - a.score).slice(0, 3),
    ]));
  }, [data]);

  return (
    <main className={`scouting-page ${styles.page}`}>
      <header className={styles.header}>
        <h1 className="scouting-title">Methodology</h1>
        <p className="scouting-copy">How to read player roles and comparisons.</p>
      </header>

      <section className={`scouting-card ${styles.intro}`} aria-labelledby="score-heading">
        <h2 className="scouting-section-title" id="score-heading">How role fit works</h2>
        <p className="scouting-copy">
          Each role weights the stats that matter for that style of play. A Rim Protector, for example, gets more credit for blocks and defensive rebounds. A fit score of <strong>90</strong> puts a player around the 90th percentile for that role in the selected season.
        </p>
      </section>

      <details
        className="scouting-card scouting-disclosure"
        onToggle={(event) => { if (event.currentTarget.open) setShowExamples(true); }}
      >
        <summary>The {ARCHETYPES.length} roles</summary>
        <div className={styles.roles}>
          {ARCHETYPES.map(({ id, name, description, weights }) => (
            <details className={`scouting-disclosure ${styles.role}`} key={id} name="methodology-role">
              <summary>
                <i aria-hidden="true" style={{ "--role-color": archetypeColor(id) } as CSSProperties} />
                <span>{name}</span>
              </summary>
              <div className={styles.roleBody}>
                <p className="scouting-copy">{description}</p>
                <h3>Key signals</h3>
                <ul className={styles.signals}>
                  {Object.entries(weights)
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 4)
                    .map(([feature, weight]) => <li key={feature}>{weight < 0 ? "Lower " : "Higher "}{FEATURE_LABELS[feature].toLowerCase()}</li>)}
                </ul>
                <h3>{data ? `Top fits in ${data.season.replace("-", "–")}` : "Top fits"}</h3>
                {examples ? (
                  <ul className={styles.examples}>
                    {examples[id].map(({ player, score }) => (
                      <li key={player.name}>
                        <Link href={`/players/${encodeURIComponent(player.name)}`}>{player.name} <small>{player.team}</small></Link>
                        <span className="tabular">{formatPercentile(score)}<span className="sr-only"> percentile</span></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="scouting-copy" role="status">{failed ? "Player examples couldn’t be loaded." : "Loading player examples…"}</p>}
              </div>
            </details>
          ))}
        </div>
      </details>

      <details className="scouting-card scouting-disclosure">
        <summary>Data and limitations</summary>
        <div className={styles.notes}>
          <p className="scouting-copy">The app uses a saved season of NBA box-score and advanced stats. It doesn’t use player tracking, play-by-play, lineup matchups, or listed positions to assign roles.</p>
          <p className="scouting-copy"><Link href="/#custom-groups">Custom groups</Link> lets you try a different definition of similarity using the stats you choose. Primary role scores stay the same.</p>
        </div>
      </details>
    </main>
  );
}
