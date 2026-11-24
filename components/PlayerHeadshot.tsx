"use client";

import Image from "next/image";
import { useState } from "react";
import type { PlayerRecord } from "@/lib/stats";

export default function PlayerHeadshot({ player, fallbackClassName, eager = false }: {
  player: PlayerRecord;
  fallbackClassName: string;
  eager?: boolean;
}) {
  const id = player.playerId;
  const [failedId, setFailedId] = useState<number | null>(null);

  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0 || id === failedId) {
    const initials = player.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
    return <span className={fallbackClassName} aria-hidden="true">{initials}</span>;
  }

  return (
    <Image
      src={`https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`}
      alt=""
      width={260}
      height={190}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailedId(id)}
    />
  );
}
