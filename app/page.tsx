"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import ScatterPlot from "@/components/ScatterPlot";
import StatsUpdated from "@/components/StatsUpdated";
import { normalizePlayerName } from "@/lib/player-search";
import { kMeans, nearestNeighbors, pca2D, scoreArchetypes, standardize, type ArchetypeResult, type PlayerRecord } from "@/lib/stats";
import { ARCHETYPES, archetypeColor, clusterColor, FEATURE_LABELS, FEATURE_ORDER } from "@/lib/constants";
import styles from "./explore.module.css";

type DataFile = { season: string; updatedAt?: string; players: PlayerRecord[] };

const DEFAULT_GROUP_COUNT = 7;
const SUMMARY_STATS = [
  { feature: "PTS", label: "Points" },
  { feature: "REB", label: "Rebounds" },
  { feature: "AST", label: "Assists" },
];

export default function ExploreRolesPage() {
  const [data, setData] = useState<DataFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [useCustomGroups, setUseCustomGroups] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState(() => new Set(FEATURE_ORDER));
  const [groupCount, setGroupCount] = useState(DEFAULT_GROUP_COUNT);
  const groupsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/players.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load player data");
        return response.json() as Promise<DataFile>;
      })
      .then((file) => {
        if (file.players.length < 2) throw new Error("Not enough player data");
        setData(file);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function revealGroups() {
      const panel = groupsRef.current;
      if (!panel || window.location.hash !== "#custom-groups") return;
      panel.open = true;
      panel.scrollIntoView({ block: "start" });
    }

    revealGroups();
    window.addEventListener("hashchange", revealGroups);
    return () => window.removeEventListener("hashchange", revealGroups);
  }, [data]);

  useEffect(() => {
    if (selectedIndex !== null) {
      summaryRef.current?.focus({ preventScroll: true });
      summaryRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const roleMap = useMemo(() => {
    if (!data) return null;
    const scaled = standardize(data.players.map((player) => FEATURE_ORDER.map((feature) => Number(player[feature]))));
    const fits = scoreArchetypes(data.players, FEATURE_ORDER, ARCHETYPES);
    const roles = fits.map(([fit]) => fit.archetypeId);
    const counts = new Map<string, number>();
    for (const id of roles) counts.set(id, (counts.get(id) ?? 0) + 1);
    return { ...pca2D(scaled), scaled, fits, roles, counts };
  }, [data]);

  const activeFeatures = useMemo(() => FEATURE_ORDER.filter((feature) => selectedFeatures.has(feature)), [selectedFeatures]);
  const customMap = useMemo(() => {
    if (!data || !useCustomGroups) return null;
    const scaled = standardize(data.players.map((player) => activeFeatures.map((feature) => Number(player[feature]))));
    const groups = kMeans(scaled, groupCount);
    const members: number[][] = Array.from({ length: groupCount }, () => []);
    groups.forEach((group, index) => members[group].push(index));
    const labels = members.map((indices) => {
      if (!indices.length) return null;
      return activeFeatures
        .map((feature, column) => ({
          feature,
          total: indices.reduce((total, index) => total + scaled[index][column], 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 2)
        .map(({ feature }) => FEATURE_LABELS[feature])
        .join(" + ");
    });
    return { ...pca2D(scaled), scaled, groups, labels };
  }, [data, useCustomGroups, activeFeatures, groupCount]);

  const map = customMap ?? roleMap;
  const neighbors = useMemo(() => {
    if (!map || selectedIndex === null) return [];
    return nearestNeighbors(map.scaled, selectedIndex).map(({ index }) => index);
  }, [map, selectedIndex]);

  const points = useMemo(() => {
    if (!data || !map || !roleMap) return [];
    return data.players.map(({ name, team }, index) => {
      const [x, y] = map.coords[index];
      const role = roleMap.roles[index];
      return {
        index, name, team, x, y,
        color: customMap ? clusterColor(customMap.groups[index]) : archetypeColor(role),
        visible: !!customMap || !selectedRole || role === selectedRole,
      };
    });
  }, [data, map, customMap, roleMap, selectedRole]);

  if (!data || !roleMap || !map) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Explore Roles</h1>
        <p className={styles.subtitle} role="status">{failed ? "Player data couldn’t be loaded. Reload the page to try again." : "Loading the player map…"}</p>
      </main>
    );
  }

  const players = data.players;
  const selectedPlayer = selectedIndex === null ? null : players[selectedIndex];
  const filter = ARCHETYPES.find((role) => role.id === selectedRole);
  const visibleCount = !customMap && filter ? roleMap.counts.get(filter.id) ?? 0 : players.length;

  function choosePlayer(index: number) {
    if (!customMap && selectedRole && roleMap?.roles[index] !== selectedRole) setSelectedRole("");
    if (selectedIndex === index) summaryRef.current?.focus();
    setSelectedIndex(index);
  }

  function chooseRole(role: string) {
    setSelectedRole(role);
    if (role && selectedIndex !== null && roleMap?.roles[selectedIndex] !== role) setSelectedIndex(null);
  }

  function toggleGroups(enabled: boolean) {
    if (!enabled && selectedRole && selectedIndex !== null && roleMap?.roles[selectedIndex] !== selectedRole) {
      setSelectedRole("");
    }
    setUseCustomGroups(enabled);
  }

  function toggleFeature(feature: string, checked: boolean) {
    setSelectedFeatures((current) => {
      const next = new Set(current);
      if (checked) next.add(feature);
      else next.delete(feature);
      return next.size >= 2 ? next : current;
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Explore Roles</h1>
          <p className={styles.subtitle}>Find NBA players by how they play.</p>
        </div>
        <div className={styles.season}>
          <p>{data.season.replace("-", "–")} season <span aria-hidden="true">·</span> {players.length} players</p>
          <StatsUpdated updatedAt={data.updatedAt} />
        </div>
      </header>

      <section className={styles.card} aria-labelledby="player-map">
        <header className={styles.mapHeader}>
          <div>
            <h2 className={styles.cardTitle} id="player-map" tabIndex={-1}>Player map</h2>
            <p className={styles.copy}>{customMap ? "Colors show groups based on your chosen stats." : "Colors show each player’s primary role."}</p>
          </div>
          <div className={styles.mapTools}>
            <PlayerSearch players={players} onSelect={choosePlayer} />
            {!customMap && (
              <details
                className={styles.roleFilter}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && event.currentTarget.open) {
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary>
                  {filter && <RoleDot color={archetypeColor(filter.id)} />}
                  <span>{filter?.shortName ?? "All roles"}</span>
                  <span className="sr-only">, filter by role</span>
                </summary>
                <fieldset className={styles.roleMenu}>
                  <legend className="sr-only">Filter by role</legend>
                  {[{ id: "", shortName: "All roles" }, ...ARCHETYPES].map(({ id, shortName }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selectedRole === id}
                      onClick={(event) => {
                        chooseRole(id);
                        const panel = event.currentTarget.closest("details");
                        if (panel) {
                          panel.open = false;
                          panel.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      {id && <RoleDot color={archetypeColor(id)} />}
                      <span>{shortName}</span>
                      <small>{id ? roleMap.counts.get(id) ?? 0 : players.length}</small>
                    </button>
                  ))}
                </fieldset>
              </details>
            )}
          </div>
        </header>

        <div className={styles.mapFrame}>
          <ScatterPlot points={points} selectedIndex={selectedIndex} neighborIndices={neighbors} onSelect={choosePlayer} />
          {visibleCount === 0 && <p className={styles.emptyPlot}>No players have this primary role.</p>}
        </div>

        <footer className={styles.mapFooter}>
          <p className={styles.copy} aria-live="polite">
            {filter && !customMap ? `${visibleCount} of ${players.length} players. ` : ""}
            Nearby dots have similar stats.
          </p>
          {selectedPlayer && <a href="#player-summary" className={styles.textLink}>{selectedPlayer.name} ↓</a>}
        </footer>
      </section>

      {selectedPlayer && selectedIndex !== null && (
        <section
          ref={summaryRef}
          id="player-summary"
          tabIndex={-1}
          className={styles.card}
          aria-labelledby="player-name"
        >
          <PlayerSummary
            key={selectedIndex}
            player={selectedPlayer}
            features={customMap ? activeFeatures : FEATURE_ORDER}
            fits={roleMap.fits[selectedIndex]}
            neighbors={neighbors}
            players={players}
            onSelect={choosePlayer}
            onClear={() => {
              setSelectedIndex(null);
              document.getElementById("player-map")?.focus();
            }}
          />
        </section>
      )}

      <details ref={groupsRef} id="custom-groups" className={`${styles.card} ${styles.disclosure}`}>
        <summary>
          <span>Custom groups</span>
          {useCustomGroups && <small>On</small>}
        </summary>
        <div className={styles.groupSettings}>
          <p className={styles.copy}>Choose which stats count as similar. For example, use Scoring and Passing to find players who create offense in similar ways.</p>
          <label className={styles.toggle}>
            <input type="checkbox" checked={useCustomGroups} onChange={(event) => toggleGroups(event.target.checked)} />
            Show custom groups on the map
          </label>
          {customMap && (
            <>
              <div className={styles.rangeField}>
                <label htmlFor="group-count">Number of groups <output htmlFor="group-count">{groupCount}</output></label>
                <input id="group-count" type="range" min={2} max={10} value={groupCount} onChange={(event) => setGroupCount(Number(event.target.value))} />
              </div>
              <fieldset className={styles.features} aria-describedby="group-feature-help">
                <legend>Stats to group by</legend>
                <p className={styles.copy} id="group-feature-help">Choose at least two stats.</p>
                <div>
                  {FEATURE_ORDER.map((feature) => (
                    <label key={feature} className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={selectedFeatures.has(feature)}
                        disabled={activeFeatures.length === 2 && selectedFeatures.has(feature)}
                        onChange={(event) => toggleFeature(feature, event.target.checked)}
                      />
                      {FEATURE_LABELS[feature]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <ul className={styles.groupLegend} aria-label="Group colors">
                {customMap.labels.map((label, id) => label && (
                  <li key={id}><RoleDot color={clusterColor(id)} /><span>{label}</span></li>
                ))}
              </ul>
              <div className={styles.groupFooter}>
                <p className={styles.copy}>The map shows {Math.round(map.varianceExplained * 100)}% of the variation in the selected stats.</p>
                <a className={styles.textLink} href="#player-map">View player map ↑</a>
              </div>
            </>
          )}
        </div>
      </details>
    </main>
  );
}

function RoleDot({ color }: { color: string }) {
  return <i className={styles.dot} aria-hidden="true" style={{ "--point-color": color } as CSSProperties} />;
}

function PlayerSearch({ players, onSelect }: { players: PlayerRecord[]; onSelect: (index: number) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const playerIndex = useMemo(() => players.map((player, index) => ({ player, index, name: normalizePlayerName(player.name) })), [players]);
  const query = normalizePlayerName(search.trim());
  const matches = query ? playerIndex.filter(({ name }) => name.includes(query)).slice(0, 6) : [];

  function choose(index: number) {
    setSearch("");
    setOpen(false);
    onSelect(index);
  }

  return (
    <form
      role="search"
      className={styles.search}
      onSubmit={(event) => {
        event.preventDefault();
        if (matches.length) choose(matches[0].index);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor="player-search">Search players</label>
      <span className={styles.searchIcon} aria-hidden="true" />
      <input
        id="player-search"
        type="search"
        autoComplete="off"
        value={search}
        placeholder="Search players…"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setSearch(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      />
      {open && query && (
        <div className={styles.searchResults}>
          {matches.length ? (
            <ul aria-label="Matching players">
              {matches.map(({ player, index }) => (
                <li key={index}>
                  <button type="button" onClick={() => choose(index)}>
                    <span>{player.name}</span><small>{player.team}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className={styles.copy} role="status">No players match your search.</p>}
        </div>
      )}
    </form>
  );
}

function PlayerSummary({ player, features, fits, neighbors, players, onSelect, onClear }: {
  player: PlayerRecord;
  features: string[];
  fits: ArchetypeResult[];
  neighbors: number[];
  players: PlayerRecord[];
  onSelect: (index: number) => void;
  onClear: () => void;
}) {
  const primary = ARCHETYPES.find((role) => role.id === fits[0].archetypeId)!;

  return (
    <>
      <div className={styles.playerHeader}>
        <div>
          <h2 id="player-name" className={styles.cardTitle}>{player.name}</h2>
          <p className={styles.playerRole}>
            <span>{player.team}</span><RoleDot color={archetypeColor(primary.id)} />{primary.name}
          </p>
        </div>
        <div className={styles.playerActions}>
          <Link className={styles.profileLink} href={`/players/${encodeURIComponent(player.name)}`}>Full profile <span aria-hidden="true">↗</span></Link>
          <button className={styles.close} type="button" onClick={onClear} aria-label="Clear selected player">×</button>
        </div>
      </div>

      <dl className={styles.quickStats} aria-label="Per-game averages">
        {SUMMARY_STATS.map(({ feature, label }) => (
          <div key={feature}>
            <dt>{label}</dt><dd className="tabular">{Number(player[feature]).toFixed(1)}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.playerDetails}>
        <details className={styles.disclosure}>
          <summary>Role fit</summary>
          <div className={styles.detailBody}>
            <p className={styles.copy}>{primary.description}</p>
            {fits.slice(0, 3).map((fit) => {
              const role = ARCHETYPES.find((item) => item.id === fit.archetypeId)!;
              return (
                <div key={role.id}>
                  <div className={styles.statRow}><span>{role.shortName}</span><span className="tabular">{fit.score}</span></div>
                  <div className="fit-track" aria-hidden="true"><div className="fit-fill" style={{ width: `${fit.score}%`, background: archetypeColor(role.id) }} /></div>
                </div>
              );
            })}
          </div>
        </details>
        <details className={styles.disclosure}>
          <summary>Player stats</summary>
          <dl className={styles.detailBody}>
            {features.map((feature) => (
              <div key={feature} className={styles.statRow}>
                <dt>{FEATURE_LABELS[feature]}</dt>
                <dd className="tabular">{typeof player[feature] === "number" ? player[feature].toFixed(feature.includes("PCT") ? 3 : 1) : player[feature]}</dd>
              </div>
            ))}
          </dl>
        </details>
        <details className={styles.disclosure}>
          <summary>Similar players</summary>
          <ul className={styles.detailBody}>
            {neighbors.map((index) => (
              <li key={index}>
                <button type="button" className={styles.neighbor} onClick={() => onSelect(index)}>
                  <span>{players[index].name}</span><small>{players[index].team} →</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </>
  );
}
