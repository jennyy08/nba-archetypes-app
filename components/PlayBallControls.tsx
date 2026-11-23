"use client";

import { useState } from "react";
import { isOffensiveId, markerName, nextPasser, OFFENSE_IDS, type BallSequence, type OffensiveId, type PlayerNames } from "@/lib/play-sequence";

type Props = {
  sequence: BallSequence | null;
  names: PlayerNames;
  drawing: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
  onStart: (id: OffensiveId) => void;
  onAdd: (id: OffensiveId) => void;
  onRemove: (index: number) => void;
  onStraighten: (index: number) => void;
  onDrawToggle: () => void;
  onReset: () => void;
};

export default function PlayBallControls({
  sequence, names, drawing, message, onOpenChange, onStart, onAdd, onRemove, onStraighten, onDrawToggle, onReset,
}: Props) {
  const [receiver, setReceiver] = useState<OffensiveId | "">("");
  const start = sequence?.start ?? "O1";
  const passer = nextPasser(sequence);
  const nextReceiver = receiver === passer ? "" : receiver;
  const passes = sequence?.passes ?? [];

  return (
    <details className="play-disclosure play-court-tools play-ball-tools" onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary>
        <span>Ball movement</span>
        <small>{sequence ? `${passes.length} ${passes.length === 1 ? "pass" : "passes"}` : "Preset read"}</small>
      </summary>
      <div className="play-tools-body">
        <label className="play-field">Starts with
          <select value={start} onChange={(event) => {
            if (isOffensiveId(event.target.value)) onStart(event.target.value);
          }}>
            {OFFENSE_IDS.map((id) => <option key={id} value={id}>{markerName(id, names)}</option>)}
          </select>
        </label>

        <div className="play-button-row">
          <button type="button" className="play-option play-draw-pass" aria-pressed={drawing} onClick={onDrawToggle}>Draw passes on court</button>
          {sequence && <button type="button" className="play-secondary" onClick={onReset}>Use preset read</button>}
        </div>
        {drawing && <p className="play-copy">Drag from {markerName(passer, names)} to the next receiver. Draw a curve to shape the pass.</p>}

        {passes.length > 0 && (
          <ol className="play-pass-list" aria-label="Pass sequence">
            {passes.map(({ to, path }, index) => {
              const from = passes[index - 1]?.to ?? start;
              return (
                <li key={index}>
                  <span><strong>{index + 1}.</strong> {markerName(from, names)} → {markerName(to, names)}</span>
                  <div className="play-pass-actions">
                    {path && <button type="button" className="play-secondary" aria-label={`Straighten pass ${index + 1}`} onClick={() => onStraighten(index)}>Straighten</button>}
                    <button type="button" className="play-secondary" aria-label={`Remove pass ${index + 1}`} onClick={() => onRemove(index)}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <form className="play-add-pass" onSubmit={(event) => {
          event.preventDefault();
          if (!nextReceiver) return;
          onAdd(nextReceiver);
          setReceiver("");
        }}>
          <label className="play-field">Next receiver
            <select value={nextReceiver} onChange={(event) => {
              const value = event.target.value;
              setReceiver(isOffensiveId(value) ? value : "");
            }}>
              <option value="">Choose a player</option>
              {OFFENSE_IDS.filter((id) => id !== passer).map((id) => <option key={id} value={id}>{markerName(id, names)}</option>)}
            </select>
          </label>
          <button className="play-secondary" type="submit" disabled={!nextReceiver}>Add pass</button>
        </form>
        {message && <p role="status" className="play-copy">{message}</p>}
      </div>
    </details>
  );
}
