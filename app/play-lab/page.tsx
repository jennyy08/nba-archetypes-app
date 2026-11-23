"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PlayCanvas, {
  type ActionPreset,
  type CourtPlayer,
  type CourtType,
  type DrawMode,
  type Playback,
  type PlayCanvasHandle,
  type Point,
  type RouteMap,
} from "@/components/PlayCanvas";
import { normalizePlayerName } from "@/lib/player-search";

type Player = Record<string, number | string> & { name: string; team: string };
type DataFile = { season: string; players: Player[] };
type Coverage = "drop" | "switch" | "hedge" | "ice";
type PlayRead = { id: string; label: string; target: Point; receiver: string };
type SavedSetup = {
  id: string;
  name: string;
  savedAt: string;
  lineup: string[];
  court: CourtPlayer[];
  preset: ActionPreset;
  coverage: Coverage;
  read: string;
  customRoutes: RouteMap;
  ballRoute: Point[];
  receiverOverride?: string | null;
  courtType?: CourtType;
};
const PLAYBOOK_KEY = "nba-archetype-studio-playbook";

const defaults = ["Stephen Curry", "Klay Thompson", "LeBron James", "Giannis Antetokounmpo", "Nikola Jokic"];
const initialCourt: CourtPlayer[] = [{ id: "O1", label: "1", x: 50, y: 72, offense: true }, { id: "O2", label: "2", x: 18, y: 28, offense: true }, { id: "O3", label: "3", x: 82, y: 28, offense: true }, { id: "O4", label: "4", x: 34, y: 43, offense: true }, { id: "O5", label: "5", x: 66, y: 43, offense: true }, { id: "X1", label: "X1", x: 50, y: 64, offense: false }, { id: "X2", label: "X2", x: 26, y: 31, offense: false }, { id: "X3", label: "X3", x: 74, y: 31, offense: false }, { id: "X4", label: "X4", x: 39, y: 36, offense: false }, { id: "X5", label: "X5", x: 61, y: 36, offense: false }];
const presets: { id: ActionPreset; title: string; description: string }[] = [{ id: "pick-roll", title: "Pick & roll", description: "Screen, turn the corner, and roll into space." }, { id: "five-out", title: "Five-out", description: "Clear the paint and stretch the defense." }, { id: "horns", title: "Horns", description: "Two high screeners create multiple reads." }];
const coverageLayouts: Record<Coverage, Record<string, [number, number]>> = { drop: { X1: [50, 64], X2: [26, 31], X3: [74, 31], X4: [39, 36], X5: [57, 53] }, switch: { X1: [46, 55], X2: [26, 31], X3: [74, 31], X4: [51, 65], X5: [56, 57] }, hedge: { X1: [47, 67], X2: [26, 31], X3: [74, 31], X4: [38, 38], X5: [49, 58] }, ice: { X1: [43, 67], X2: [26, 31], X3: [74, 31], X4: [38, 39], X5: [56, 55] } };
const coverages: { id: Coverage; label: string; text: string }[] = [{ id: "drop", label: "Drop", text: "Big stays near the paint." }, { id: "switch", label: "Switch", text: "Defenders exchange assignments." }, { id: "hedge", label: "Hedge", text: "Big shows high to stop the ball." }, { id: "ice", label: "ICE", text: "Force the ball handler away from the middle." }];
const reads: Record<ActionPreset, PlayRead[]> = {
  "pick-roll": [
    { id: "pull-up", label: "Pull-up", target: [42, 58], receiver: "O1" },
    { id: "roller", label: "Hit the roller", target: [65, 66], receiver: "O5" },
    { id: "corner", label: "Kick to corner", target: [13, 18], receiver: "O2" },
  ],
  "five-out": [
    { id: "drive", label: "Attack the lane", target: [50, 55], receiver: "O1" },
    { id: "corner", label: "Kick to corner", target: [12, 16], receiver: "O2" },
    { id: "swing", label: "Swing the ball", target: [88, 16], receiver: "O3" },
  ],
  horns: [
    { id: "pull-up", label: "Elbow pull-up", target: [25, 36], receiver: "O1" },
    { id: "roll", label: "Hit the roller", target: [55, 52], receiver: "O5" },
    { id: "weak-side", label: "Weak-side kick", target: [85, 17], receiver: "O3" },
  ],
};

const coverageNotes: Record<Coverage, string> = {
  drop: "The drop leaves space for a patient pull-up or a pass to the roller.",
  switch: "The switch crowds the first option. Look for a mismatch.",
  hedge: "The hedge pressures the ball and opens a brief outlet window.",
  ice: "ICE takes away the middle. Look for an outlet along the sideline.",
};

type ActionGrade = { label: string; score: number; suggestion: string };
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const rangeScore = (value: number, floor: number, ceiling: number) => clamp(((value - floor) / (ceiling - floor)) * 100);
const best = (players: Player[], scorer: (player: Player) => number) => Math.max(...players.map(scorer));
const averageTop = (players: Player[], count: number, scorer: (player: Player) => number) => players.map(scorer).sort((a, b) => b - a).slice(0, count).reduce((sum, score) => sum + score, 0) / count;
const shooting = (player: Player) => 0.58 * rangeScore(Number(player.FG3_PCT), 0.32, 0.44) + 0.42 * rangeScore(Number(player.FG3A), 1, 8);
const passing = (player: Player) => 0.62 * rangeScore(Number(player.AST), 1, 10) + 0.38 * rangeScore(Number(player.AST_PCT), 0.08, 0.45);
const creation = (player: Player) => 0.55 * rangeScore(Number(player.PTS), 5, 33) + 0.25 * rangeScore(Number(player.USG_PCT), 0.14, 0.35) + 0.2 * passing(player);
const rollThreat = (player: Player) => 0.45 * rangeScore(Number(player.TS_PCT), 0.5, 0.7) + 0.35 * rangeScore(Number(player.OREB), 0, 4) + 0.2 * rangeScore(Number(player.REB), 3, 14);
const actionGrades = (action: ActionPreset, players: Player[]): ActionGrade[] => {
  if (action === "pick-roll") return [{ label: "Ball handling", score: best(players, (p) => 0.72 * passing(p) + 0.28 * rangeScore(Number(p.USG_PCT), 0.14, 0.35)), suggestion: "Primary Ball Handler" }, { label: "Roll threat", score: best(players, rollThreat), suggestion: "Interior Finisher" }, { label: "Corner spacing", score: averageTop(players, 3, shooting), suggestion: "3-and-D Wing" }];
  if (action === "five-out") return [{ label: "Perimeter spacing", score: averageTop(players, 4, shooting), suggestion: "Stretch Big" }, { label: "Creation", score: best(players, creation), suggestion: "Shot-Creating Guard" }, { label: "Secondary playmaking", score: averageTop(players, 2, passing), suggestion: "Playmaking Forward" }];
  return [{ label: "Primary creation", score: best(players, creation), suggestion: "Primary Ball Handler" }, { label: "Screening / rolling", score: averageTop(players, 2, rollThreat), suggestion: "Interior Finisher" }, { label: "Weak-side shooting", score: averageTop(players, 2, shooting), suggestion: "3-and-D Wing" }];
};

export default function PlayLabPage() {
  const [data, setData] = useState<DataFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lineup, setLineup] = useState(defaults);
  const [court, setCourt] = useState(initialCourt);
  const [preset, setPreset] = useState<ActionPreset>("pick-roll");
  const [coverage, setCoverage] = useState<Coverage>("drop");
  const [read, setRead] = useState("pull-up");
  const [playback, setPlayback] = useState<Playback>("idle");
  const [mode, setMode] = useState<DrawMode>("move");
  const [editing, setEditing] = useState(false);
  const [courtType, setCourtType] = useState<CourtType>("indoor");
  const [setupName, setSetupName] = useState("");
  const [customRoutes, setCustomRoutes] = useState<RouteMap>({});
  const [ballRoute, setBallRoute] = useState<Point[]>([]);
  const [receiverOverride, setReceiverOverride] = useState<string | null>(null);
  const [savedSetups, setSavedSetups] = useState<SavedSetup[]>([]);
  const [playbookMessage, setPlaybookMessage] = useState("");
  const canvasRef = useRef<PlayCanvasHandle>(null);
  const guideRef = useRef<HTMLDialogElement>(null);
  const finishPlayback = useCallback(() => setPlayback("idle"), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/players.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Player data unavailable");
        return response.json() as Promise<DataFile>;
      })
      .then((file) => {
        if (!file.players.length) throw new Error("Player data is empty");
        const rosterNames = new Map(file.players.map(({ name }) => [normalizePlayerName(name), name]));
        setLineup(defaults.map((name, index) =>
          rosterNames.get(normalizePlayerName(name)) ?? file.players[index % file.players.length].name,
        ));
        try {
          const stored = JSON.parse(localStorage.getItem(PLAYBOOK_KEY) || "[]");
          if (Array.isArray(stored)) setSavedSetups(stored);
        } catch {
          // The court remains available when browser storage is unavailable.
        }
        setData(file);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  if (!data) {
    return (
      <main className="play-lab">
        <h1 className="play-title">Play Lab</h1>
        <p className="play-subtitle" role="status">{loadError ? "Player data couldn’t be loaded. Reload the page to try again." : "Loading the court…"}</p>
      </main>
    );
  }

  const roster = data.players;
  const selectedPlayers = lineup.map((name) => roster.find((player) => player.name === name)!);
  const grades = actionGrades(preset, selectedPlayers).map((grade) => ({ ...grade, score: Math.round(grade.score) }));
  const weakest = [...grades].sort((a, b) => a.score - b.score)[0];
  const action = presets.find((item) => item.id === preset)!;
  const coverageOption = coverages.find((item) => item.id === coverage)!;
  const selectedRead = reads[preset].find((item) => item.id === read) ?? reads[preset][0];
  const receiver = receiverOverride ?? selectedRead.receiver;
  const defenseTargets = {
    ...coverageLayouts[coverage],
    X1: coverage === "switch" ? selectedRead.target : [selectedRead.target[0] + (coverage === "ice" ? -8 : 0), selectedRead.target[1] + 6] as Point,
  };

  function resetPositions(nextCoverage: Coverage) {
    setPlayback("idle");
    setCourt(initialCourt.map((player) => {
      if (player.offense) return player;
      const [x, y] = coverageLayouts[nextCoverage][player.id];
      return { ...player, x, y };
    }));
  }

  function chooseCoverage(next: Coverage) {
    setPlayback("idle");
    setCoverage(next);
    setCourt((players) => players.map((player) => {
      if (player.offense) return player;
      const [x, y] = coverageLayouts[next][player.id];
      return { ...player, x, y };
    }));
  }

  function persist(next: SavedSetup[], message: string) {
    try {
      localStorage.setItem(PLAYBOOK_KEY, JSON.stringify(next));
      setSavedSetups(next);
      setPlaybookMessage(message);
      return true;
    } catch {
      setPlaybookMessage("Couldn’t update the playbook. Browser storage may be unavailable.");
      return false;
    }
  }

  function currentSetup(): SavedSetup {
    return {
      id: crypto.randomUUID(),
      name: setupName.trim() || `${action.title} vs. ${coverageOption.label}`,
      savedAt: new Date().toISOString(),
      lineup, court, preset, coverage, read, customRoutes, ballRoute, receiverOverride, courtType,
    };
  }

  function loadSetup(setup: SavedSetup) {
    setPlayback("idle");
    setLineup(setup.lineup.map((name, index) => roster.some((player) => player.name === name) ? name : lineup[index]));
    setCourt(setup.court);
    setPreset(setup.preset);
    setCoverage(setup.coverage);
    setRead(setup.read);
    setCustomRoutes(setup.customRoutes ?? {});
    setBallRoute(setup.ballRoute ?? []);
    setReceiverOverride(setup.receiverOverride ?? null);
    setCourtType(setup.courtType ?? "indoor");
    setPlaybookMessage(`Loaded ${setup.name}.`);
  }

  function exportSetup(setup: SavedSetup) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(setup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    const filename = setup.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.download = `${filename || "play-lab-setup"}.json`;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="play-lab">
      <header className="play-page-header">
        <div>
          <h1 className="play-title">Play Lab</h1>
          <p className="play-subtitle">Build a lineup and see how it runs against different coverages.</p>
        </div>
        <button className="play-secondary" onClick={() => guideRef.current?.showModal()}>
          <span className="play-help-icon" aria-hidden="true">?</span> <span>Help</span>
        </button>
      </header>

      <div className="play-workspace">
        <section className="play-card play-board" aria-labelledby="court-heading">
          <header className="play-board-header">
            <div>
              <h2 id="court-heading" className="play-card-title">Half court</h2>
              <div className="play-legend" aria-label="Court legend">
                <span><i className="play-marker play-marker-offense" /> Offense</span>
                <span><i className="play-marker play-marker-defense" /> Defense</span>
              </div>
            </div>
            <button className="play-primary play-run" onClick={() => setPlayback(playback === "playing" ? "paused" : "playing")}>
              <span aria-hidden="true" className={playback === "playing" ? "play-pause-icon" : "play-run-icon"} />
              {playback === "playing" ? "Pause play" : playback === "paused" ? "Resume play" : "Run play"}
            </button>
          </header>

          <PlayCanvas
            ref={canvasRef}
            players={court}
            preset={preset}
            playback={playback}
            receiver={receiver}
            defenseTargets={defenseTargets}
            mode={mode}
            editing={editing}
            courtType={courtType}
            customRoutes={customRoutes}
            ballRoute={ballRoute}
            onComplete={finishPlayback}
            onRoute={(id, route) => setCustomRoutes((routes) => ({ ...routes, [id]: route }))}
            onReceiverChange={setReceiverOverride}
            onMove={(id, x, y) => setCourt((items) => items.map((item) => item.id === id ? { ...item, x, y } : item))}
          />

          <details className="play-disclosure play-court-tools" onToggle={(event) => setEditing(event.currentTarget.open)}>
            <summary>
              <span>Drawing tools</span>
              {Object.keys(customRoutes).length > 0 && <small>{Object.keys(customRoutes).length} drawn</small>}
            </summary>
            <div className="play-tools-body">
              <div role="group" aria-label="Drawing mode" className="play-options play-options-two">
                <button className="play-option" aria-pressed={mode === "move"} onClick={() => { setPlayback("idle"); setMode("move"); }}>Move markers</button>
                <button className="play-option" aria-pressed={mode === "route"} onClick={() => { setPlayback("idle"); setMode("route"); }}>Draw routes</button>
              </div>
              <p className="play-copy">{mode === "route" ? "Drag from an offensive marker to draw its route." : "Drag a marker to move it, or drag the ball to choose a receiver."}</p>
              <div className="play-tool-fields">
                <label>Court surface
                  <select value={courtType} onChange={(event) => setCourtType(event.target.value as CourtType)}>
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                  </select>
                </label>
                <label>Ball target
                  <select value={receiverOverride ?? ""} onChange={(event) => { setPlayback("idle"); setReceiverOverride(event.target.value || null); }}>
                    <option value="">Use selected read</option>
                    {lineup.map((name, index) => <option key={index} value={`O${index + 1}`}>{index + 1} · {name}</option>)}
                  </select>
                </label>
              </div>
              <div className="play-button-row">
                <button className="play-secondary" onClick={() => resetPositions(coverage)}>Reset positions</button>
                <button className="play-secondary" disabled={!Object.keys(customRoutes).length && !ballRoute.length} onClick={() => { setPlayback("idle"); setCustomRoutes({}); setBallRoute([]); }}>Clear drawings</button>
              </div>
            </div>
          </details>
        </section>

        <section className="play-card play-setup" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="play-card-title">Play setup</h2>
          <fieldset className="play-control">
            <legend>Action</legend>
            <div className="play-options play-options-three">
              {presets.map((item) => (
                <button key={item.id} className="play-option" aria-pressed={preset === item.id} onClick={() => {
                  setPlayback("idle");
                  setPreset(item.id);
                  setRead(reads[item.id][0].id);
                  setReceiverOverride(null);
                }}>{item.title}</button>
              ))}
            </div>
            <p className="play-copy">{action.description}</p>
          </fieldset>
          <fieldset className="play-control">
            <legend>Coverage</legend>
            <div className="play-options play-options-four">
              {coverages.map((item) => (
                <button key={item.id} className="play-option" aria-pressed={coverage === item.id} onClick={() => chooseCoverage(item.id)}>{item.label}</button>
              ))}
            </div>
            <p className="play-copy">{coverageOption.text}</p>
          </fieldset>
          <fieldset className="play-control">
            <legend>Read</legend>
            <div className="play-reads">
              {reads[preset].map((item) => (
                <button key={item.id} className="play-read" aria-pressed={selectedRead.id === item.id} onClick={() => {
                  setPlayback("idle");
                  setRead(item.id);
                  setReceiverOverride(null);
                }}>
                  <span className="play-read-indicator" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="play-scouting-note">
            {receiverOverride ? `Ball target set to ${lineup[Number(receiverOverride.slice(1)) - 1]}.` : coverageNotes[coverage]}
          </p>
        </section>
      </div>

      <div className="play-support">
        <details className="play-card play-disclosure">
          <summary><span>Your lineup</span><small>{lineup.length} players</small></summary>
          <ol className="play-lineup">
            {lineup.map((name, index) => (
              <li key={index}>
                <label>
                  <span className="play-spot" aria-hidden="true">{index + 1}</span>
                  <span className="sr-only">Lineup spot {index + 1}</span>
                  <select value={name} onChange={(event) => setLineup((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}>
                    {roster.map((player) => <option key={player.name} value={player.name}>{player.name} · {player.team}</option>)}
                  </select>
                </label>
              </li>
            ))}
          </ol>
        </details>
        <details className="play-card play-disclosure">
          <summary><span>Lineup fit</span><small>{action.title}</small></summary>
          <div className="play-fit">
            {grades.map((area) => (
              <div key={area.label}>
                <div className="play-fit-label"><span>{area.label}</span><span className="tabular">{area.score}<span className="sr-only"> out of 100</span></span></div>
                <div className="fit-track" aria-hidden="true"><div className="fit-fill bg-amber" style={{ width: `${area.score}%` }} /></div>
              </div>
            ))}
            <p className="play-copy">For more {weakest.label.toLowerCase()}, try a <strong>{weakest.suggestion}</strong>.</p>
            <p className="play-copy">Scores use per-game stat thresholds.</p>
          </div>
        </details>
      </div>

      <details className="play-card play-disclosure play-playbook">
        <summary><span>Playbook</span><small>{savedSetups.length} saved</small></summary>
        <div className="play-playbook-body">
          <form className="play-save-form" onSubmit={(event) => {
            event.preventDefault();
            const setup = currentSetup();
            if (persist([setup, ...savedSetups], `Saved ${setup.name}.`)) setSetupName("");
          }}>
            <label>Setup name
              <input value={setupName} onChange={(event) => setSetupName(event.target.value)} placeholder={`${action.title} vs. ${coverageOption.label}`} />
            </label>
            <button className="play-primary" type="submit">Save setup</button>
          </form>
          <div className="play-button-row">
            <button className="play-secondary" onClick={() => exportSetup(currentSetup())}>Export JSON</button>
            <button className="play-secondary" onClick={() => canvasRef.current?.exportPng()}>Download court image</button>
          </div>
          <p role="status" className="play-copy">{playbookMessage}</p>
          {savedSetups.length > 0 && (
            <ul className="play-saved-list">
              {savedSetups.map((setup) => (
                <li key={setup.id}>
                  <span>{setup.name}</span>
                  <div className="play-button-row">
                    <button className="play-secondary" aria-label={`Load ${setup.name}`} onClick={() => loadSetup(setup)}>Load</button>
                    <button className="play-secondary" aria-label={`Export ${setup.name} as JSON`} onClick={() => exportSetup(setup)}>Export</button>
                    <button className="play-secondary" aria-label={`Delete ${setup.name}`} onClick={() => persist(savedSetups.filter((item) => item.id !== setup.id), `Deleted ${setup.name}.`)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <dialog className="play-guide" ref={guideRef} aria-labelledby="play-guide-title">
        <h2 id="play-guide-title" className="play-card-title">Using Play Lab</h2>
        <ol>
          <li>Pick an action, coverage, and read. Run play animates the sequence three times.</li>
          <li>Open Drawing tools to move markers, draw routes, or choose a different pass target.</li>
          <li>Change the five players under Your lineup. Save your setup in the Playbook to run it again later.</li>
        </ol>
        <form method="dialog"><button className="play-primary">Done</button></form>
      </dialog>
    </main>
  );
}
