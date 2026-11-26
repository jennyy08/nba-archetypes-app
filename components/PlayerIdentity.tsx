import type { ReactNode } from "react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import { formatPlayerStat } from "@/lib/player-format";
import type { PlayerRecord } from "@/lib/stats";
import styles from "./player-identity.module.css";

const summaryStats = [
  { feature: "PTS", label: "Points" },
  { feature: "REB", label: "Rebounds" },
  { feature: "AST", label: "Assists" },
];

export default function PlayerIdentity({ player, role, season, heading: Name = "h1", actions }: {
  player: PlayerRecord;
  role: string;
  season: string;
  heading?: "h1" | "h2";
  actions: ReactNode;
}) {
  return (
    <div className={`${styles.identity} ${Name === "h1" ? styles.profileIdentity : ""}`}>
      <div className={styles.cover}>
        <span className={styles.teamMark} aria-hidden="true">{player.team}</span>
        <div className={styles.portrait} aria-hidden="true">
          <PlayerHeadshot player={player} fallbackClassName={styles.initials} eager />
        </div>
        <div className={styles.details}>
          <p className={styles.team}>{player.team} <span aria-hidden="true">/</span> {season.replace("-", "–")} season</p>
          <Name id="player-name" className={styles.name}>{player.name}</Name>
          <p className={styles.role}>{role}</p>
        </div>
      </div>
      <dl className={styles.stats} aria-label="Per-game averages">
        {summaryStats.map(({ feature, label }) => (
          <div key={feature}>
            <dt>{label} <span className="sr-only">per game</span></dt>
            <dd className="tabular">{formatPlayerStat(player[feature], feature)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>{actions}</div>
    </div>
  );
}
