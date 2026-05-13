import { useCallback, useId, useMemo, useState } from "react";
import type { Round } from "./stvTypes";
import { actionLabel } from "./parseStvReport";
import {
  buildConsecutiveTransitions,
  type RoundTransitionModel,
} from "./estimateTransfers";
import { formatVotes } from "./formatVotes";

/** Nagłówek diagramu: z kolumny „akcja” rundy źródłowej. */
function flowDiagramCaption(
  fromRound: Round | undefined,
  fromN: number,
  toN: number,
): string {
  if (!fromRound) return `Runda ${fromN} → Runda ${toN}`;
  const elected: string[] = [];
  const eliminated: string[] = [];
  for (const row of fromRound.rows) {
    const kind = actionLabel(row.action);
    if (kind === "elected") elected.push(row.candidate);
    else if (kind === "eliminated") eliminated.push(row.candidate);
  }
  const parts: string[] = [];
  if (elected.length) parts.push(`wybrano ${elected.join(", ")}`);
  if (eliminated.length) parts.push(`wyeliminowano ${eliminated.join(", ")}`);
  if (parts.length) return parts.join(" · ");
  return `Runda ${fromN} → Runda ${toN}`;
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function FlowDiagram({
  model,
  flowCaption,
}: {
  model: RoundTransitionModel;
  flowCaption: string;
}) {
  const gradId = `fg-${useId().replace(/:/g, "")}`;
  const W = 900;
  const H = 520;
  const padT = 28;
  const padB = 20;
  const xL = 56;
  const xR = W - 56;
  const bodyH = H - padT - padB;

  const L = model.totalOut;
  const G = model.totalIn;
  const maxLink = model.links.reduce((m, l) => Math.max(m, l.value), 0) || 1;

  const leftLayout = useMemo(() => {
    const m = new Map<string, { y0: number; y1: number; mid: number }>();
    if (L <= 0) return m;
    let y = padT;
    for (const s of model.sourceNodes) {
      const h = (s.w / L) * bodyH;
      m.set(s.id, { y0: y, y1: y + h, mid: y + h / 2 });
      y += h;
    }
    return m;
  }, [model.sourceNodes, L, bodyH, padT]);

  const rightLayout = useMemo(() => {
    const m = new Map<string, { y0: number; y1: number; mid: number }>();
    if (G <= 0) return m;
    let y = padT;
    for (const t of model.targetNodes) {
      const h = (t.w / G) * bodyH;
      m.set(t.id, { y0: y, y1: y + h, mid: y + h / 2 });
      y += h;
    }
    return m;
  }, [model.targetNodes, G, bodyH, padT]);

  if (model.links.length === 0) {
    return (
      <p className="transfers-empty">
        Brak wykrywalnych przepływów między tymi rundami.
      </p>
    );
  }

  return (
    <div className="flow-svg-wrap">
      <div className="flow-round-pair" aria-label={flowCaption}>
        <span className="flow-round-pair-caption">{flowCaption}</span>
      </div>
      <svg
        className="flow-svg"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Szacunkowe przepływy głosów z rundy ${model.fromRound} do ${model.toRound}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {model.links.map((link, i) => {
          const a = leftLayout.get(link.source);
          const b = rightLayout.get(link.target);
          if (!a || !b) return null;
          const sw = Math.min(12, 1.2 + Math.sqrt(link.value / maxLink) * 10);
          const cx1 = xL + (xR - xL) * 0.38;
          const cx2 = xL + (xR - xL) * 0.62;
          const d = `M ${xL} ${a.mid} C ${cx1} ${a.mid} ${cx2} ${b.mid} ${xR} ${b.mid}`;
          return (
            <path
              key={`${link.source}-${link.target}-${i}`}
              d={d}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={sw}
              strokeOpacity={0.42}
              strokeLinecap="round"
            />
          );
        })}

        {model.sourceNodes.map((s) => {
          const box = leftLayout.get(s.id);
          if (!box) return null;
          const h = box.y1 - box.y0;
          return (
            <g key={`l-${s.id}`}>
              <rect
                x={xL - 8}
                y={box.y0}
                width={8}
                height={Math.max(h, 2)}
                rx={3}
                fill={`hsl(${hashHue(s.id)} 55% 45%)`}
                opacity={0.85}
              />
              <text
                x={xL + 6}
                y={box.mid}
                dominantBaseline="middle"
                className="flow-node-label"
              >
                {s.id.length > 22 ? `${s.id.slice(0, 20)}…` : s.id}
              </text>
              <text
                x={xL - 12}
                y={box.mid}
                textAnchor="end"
                dominantBaseline="middle"
                className="flow-node-votes"
              >
                {formatVotes(s.w)}
              </text>
            </g>
          );
        })}

        {model.targetNodes.map((t) => {
          const box = rightLayout.get(t.id);
          if (!box) return null;
          const h = box.y1 - box.y0;
          return (
            <g key={`r-${t.id}`}>
              <rect
                x={xR}
                y={box.y0}
                width={8}
                height={Math.max(h, 2)}
                rx={3}
                fill={`hsl(${hashHue(t.id)} 50% 50%)`}
                opacity={0.85}
              />
              <text
                x={xR - 6}
                y={box.mid}
                textAnchor="end"
                dominantBaseline="middle"
                className="flow-node-label"
              >
                {t.id.length > 22 ? `${t.id.slice(0, 20)}…` : t.id}
              </text>
              <text
                x={xR + 20}
                y={box.mid}
                dominantBaseline="middle"
                className="flow-node-votes"
              >
                {formatVotes(t.w)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TransfersPanel({ rounds }: { rounds: Round[] }) {
  const transitions = useMemo(
    () => buildConsecutiveTransitions(rounds),
    [rounds],
  );
  const [idx, setIdx] = useState(0);

  const safeIdx =
    transitions.length === 0
      ? 0
      : Math.min(Math.max(0, idx), transitions.length - 1);

  const go = useCallback(
    (delta: number) => {
      setIdx((i) => {
        if (transitions.length === 0) return 0;
        return Math.min(Math.max(0, i + delta), transitions.length - 1);
      });
    },
    [transitions],
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

  if (transitions.length === 0) {
    return (
      <section className="section transfers-section">
        <h2>Transfery między rundami</h2>
        <p className="lead">
          Do wizualizacji przepływów potrzebne są co najmniej{" "}
          <strong>dwie</strong> kolejne rundy w pliku. Wgraj pełniejszy raport
          lub uzupełnij brakujące sekcje „Runda n”.
        </p>
      </section>
    );
  }

  const n = transitions.length;
  const model = transitions[safeIdx]!;
  const canPrev = safeIdx > 0;
  const canNext = safeIdx < n - 1;

  return (
    <section className="section transfers-section">
      <h2>Transfery między rundami</h2>

      <p className="lead ballots-tab-lead">
        Para kolejnych rund z raportu. Strzałki{" "}
        <kbd className="kbd-hint">←</kbd> <kbd className="kbd-hint">→</kbd>{" "}
        zmieniają przejście, gdy fokus jest na ramce poniżej (kliknij w tabelę
        albo diagram).
      </p>

      <div className="ballot-nav" role="group" aria-label="Wybór pary rund">
        <button
          type="button"
          className="btn btn-ghost ballot-nav-btn"
          disabled={!canPrev}
          onClick={() => go(-1)}
          aria-label="Poprzednie przejście między rundami"
        >
          ← Poprzednia
        </button>
        <div className="ballot-nav-center">
          <label htmlFor="pair-select" className="ballot-nav-label">
            Transfer między rundami
          </label>
          <select
            id="pair-select"
            className="ballot-nav-select"
            value={safeIdx}
            onChange={(e) => setIdx(Number.parseInt(e.target.value, 10))}
          >
            {transitions.map((t, i) => (
              <option key={`${t.fromRound}-${t.toRound}`} value={i}>
                Runda {t.fromRound} → Runda {t.toRound}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-ghost ballot-nav-btn"
          disabled={!canNext}
          onClick={() => go(1)}
          aria-label="Następne przejście między rundami"
        >
          Następna →
        </button>
      </div>

      <p className="ballot-nav-summary" aria-live="polite">
        Krok <strong>{safeIdx + 1}</strong> z <strong>{n}</strong>
        {" — "}
        <span className="transfers-summary-pair">
          <strong>Runda {model.fromRound}</strong>
          <span className="transfers-summary-arrow" aria-hidden="true">
            →
          </span>
          <strong>Runda {model.toRound}</strong>
        </span>
      </p>

      <div
        className="ballot-keyboard-scope"
        tabIndex={0}
        onKeyDown={onKeyNav}
        aria-label="Szczegóły transferu — strzałki zmieniają parę rund"
      >
        <p className="transfers-meta">
          Suma „wyjść”: {formatVotes(model.totalOut)} · Suma „wejść”:{" "}
          {formatVotes(model.totalIn)}
          {model.omittedLinkMass > 0.02 && (
            <>
              {" "}
              · Pominięto cienkie połączenia łącznie ~
              {formatVotes(model.omittedLinkMass)} (dla czytelności)
            </>
          )}
        </p>

        <h3 className="transfers-subh">Diagram przepływu</h3>
        <p className="lead transfers-lead">
          Lewa kolumna: skąd „odchodzą” głosy (wybór lub eliminacja). Prawa:
          gdzie przybywają.
        </p>
        <FlowDiagram
          model={model}
          flowCaption={flowDiagramCaption(
            rounds.find((r) => r.number === model.fromRound),
            model.fromRound,
            model.toRound,
          )}
        />

        <h3 className="transfers-subh">Zmiana głosów w tabeli</h3>
        <div className="table-scroll">
          <table className="delta-table">
            <thead>
              <tr>
                <th>Kandydat</th>
                <th className="num">Runda {model.fromRound}</th>
                <th className="num">Runda {model.toRound}</th>
                <th className="num">Δ</th>
              </tr>
            </thead>
            <tbody>
              {[...model.deltas]
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                .map((d) => (
                  <tr key={d.candidate}>
                    <td>{d.candidate}</td>
                    <td className="num">
                      {d.prevVotes == null ? "—" : formatVotes(d.prevVotes)}
                    </td>
                    <td className="num">
                      {d.nextVotes == null ? "—" : formatVotes(d.nextVotes)}
                    </td>
                    <td
                      className={`num delta ${d.delta > 0 ? "pos" : d.delta < 0 ? "neg" : ""}`}
                    >
                      {d.delta > 0 ? "+" : ""}
                      {formatVotes(d.delta)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <h3 className="transfers-subh">Największe transfery</h3>
        <div className="table-scroll">
          <table className="delta-table links-table">
            <thead>
              <tr>
                <th>Z</th>
                <th>Do</th>
                <th className="num">Szac. waga</th>
              </tr>
            </thead>
            <tbody>
              {model.links.slice(0, 40).map((l, i) => (
                <tr key={`${l.source}-${l.target}-${i}`}>
                  <td>{l.source}</td>
                  <td>{l.target}</td>
                  <td className="num">{formatVotes(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
