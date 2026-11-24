import type { CSSProperties, ReactNode } from "react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import { formatPlayerStat } from "@/lib/player-format";
import type { PlayerRecord } from "@/lib/stats";
import { teamAccent } from "@/lib/team-colors";
import styles from "./player-identity.module.css";

const summaryStats = [
  { feature: "PTS", label: "Points" },
  { feature: "REB", label: "Rebounds" },
  { feature: "AST", label: "Assists" },
];

export default function PlayerIdentity({ player, role, season, actions }: {
  player: PlayerRecord;
  role: string;
  season?: string;
  actions: ReactNode;
}) {
  const Name = season ? "h1" : "h2";

  return (
    <div
      className={`${styles.identity} ${season ? styles.profileIdentity : ""}`}
      style={{ "--team-accent": teamAccent(player.team) } as CSSProperties}
    >
      <div className={styles.portrait} aria-hidden="true">
        <PlayerHeadshot player={player} fallbackClassName={styles.initials} eager={!!season} />
      </div>
      <div className={styles.details}>
        <p className={styles.team}>
          <span>{player.team}</span>
          {season && <span>{season.replace("-", "–")} season</span>}
        </p>
        <Name id="player-name" className={styles.name}>{player.name}</Name>
        <p className={styles.role}>{role}</p>
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
