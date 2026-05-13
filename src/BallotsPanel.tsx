import { useCallback, useEffect, useState } from "react";
import type { BallotEntry } from "./stvTypes";
import { groupClass } from "./groupStyles";

type BallotsPanelProps = {
  papers: BallotEntry[][];
};

function BallotPaperVisual({ entries }: { entries: BallotEntry[] }) {
  return (
    <div className="ballot-paper" role="list" aria-label="Kolejność preferencji">
      {entries.map((b, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === entries.length - 1;
        return (
          <div key={`${b.name}-${idx}`} className="ballot-step" role="listitem">
            <div className="ballot-step-track" aria-hidden>
              <span
                className={`ballot-step-dot ${isFirst ? "ballot-step-dot-first" : ""}`}
              />
              {!isLast && <span className="ballot-step-line" />}
            </div>
            <div className="ballot-step-body">
              <div className="ballot-step-meta">
                <span className="ballot-step-rank">{idx + 1}</span>
                {isFirst && (
                  <span className="ballot-step-label">najwyższa preferencja</span>
                )}
              </div>
              <div className="ballot-step-card">
                <span className="ballot-step-name">{b.name}</span>
                <span className={`group-pill ${groupClass(b.group)}`}>{b.group}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BallotsPanel({ papers }: BallotsPanelProps) {
  const [index, setIndex] = useState(0);
  const n = papers.length;

  useEffect(() => {
    setIndex((i) => {
      if (n === 0) return 0;
      return Math.min(Math.max(0, i), n - 1);
    });
  }, [n]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        if (n === 0) return 0;
        return Math.min(Math.max(0, i + delta), n - 1);
      });
    },
    [n],
  );

  const onKeyNav = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      }
    },
    [go],
  );

  if (n === 0) {
    return (
      <section className="section ballots-tab" aria-labelledby="ballots-heading">
        <h2 id="ballots-heading">Karty do głosowania</h2>
        <p className="lead">
          W tym raporcie nie ma sekcji „Karty do głosowania” albo jest pusta —
          nie ma czego wyświetlić.
        </p>
      </section>
    );
  }

  const current = papers[index] ?? [];
  const canPrev = index > 0;
  const canNext = index < n - 1;

  return (
    <section className="section ballots-tab" aria-labelledby="ballots-heading">
      <h2 id="ballots-heading">Karty do głosowania</h2>
      <p className="lead ballots-tab-lead">
        Każda linia z eksportu to jedna odczytana karta — preferencje od
        najwyższej do najniższej. Kliknij w kartę poniżej, potem użyj strzałek{" "}
        <kbd className="kbd-hint">←</kbd> <kbd className="kbd-hint">→</kbd>.
      </p>

      <div className="ballot-nav" role="group" aria-label="Wybór karty">
        <button
          type="button"
          className="btn btn-ghost ballot-nav-btn"
          disabled={!canPrev}
          onClick={() => go(-1)}
          aria-label="Poprzednia karta"
        >
          ← Poprzednia
        </button>
        <div className="ballot-nav-center">
          <label htmlFor="ballot-select" className="ballot-nav-label">
            Karta
          </label>
          <select
            id="ballot-select"
            className="ballot-nav-select"
            value={index}
            onChange={(e) =>
              setIndex(Number.parseInt(e.target.value, 10))
            }
          >
            {papers.map((_, i) => (
              <option key={i} value={i}>
                {i + 1} z {n}
                {papers[i]!.length ? ` (${papers[i]!.length} poz.)` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-ghost ballot-nav-btn"
          disabled={!canNext}
          onClick={() => go(1)}
          aria-label="Następna karta"
        >
          Następna →
        </button>
      </div>

      <p className="ballot-nav-summary" aria-live="polite">
        Karta <strong>{index + 1}</strong> z <strong>{n}</strong>
        {current.length > 0 ? (
          <>
            {" "}
            — <strong>{current.length}</strong> pozycji preferencji
          </>
        ) : null}
      </p>

      <div
        className="ballot-keyboard-scope"
        tabIndex={0}
        onKeyDown={onKeyNav}
        aria-label="Podgląd karty — strzałki zmieniają kartę"
      >
        <BallotPaperVisual entries={current} />
      </div>
    </section>
  );
}
