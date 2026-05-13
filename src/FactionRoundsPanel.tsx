import { useEffect, useMemo, useState } from "react";
import type { BallotEntry, Round } from "./stvTypes";
import {
  buildBallotFactionTransitionMatrix,
  flattenBallotTransitionMatrix,
  maxBallotFactionStepOffset,
} from "./ballotFactionTransitions";
import {
  buildFactionPairRollups,
  buildFactionVoteDeltas,
  buildFactionVoteMatrix,
} from "./factionRoundMatrix";
import {
  candidateFactionColor,
  displayFactionName,
  type CandidateFactionsState,
} from "./candidateFactions";
import { formatVotes } from "./formatVotes";

type FactionRoundsPanelProps = {
  rounds: Round[];
  papers: BallotEntry[][];
  factions: CandidateFactionsState;
};

export function FactionRoundsPanel({
  rounds,
  papers,
  factions,
}: FactionRoundsPanelProps) {
  const gc = factions.groupCount;
  const assignments = factions.assignments;
  const fn = factions.factionNames;

  const fLabel = (f: number) => displayFactionName(f, fn, gc);

  const maxStep = useMemo(() => maxBallotFactionStepOffset(papers), [papers]);
  const [stepOffset, setStepOffset] = useState(0);

  useEffect(() => {
    setStepOffset((s) => Math.min(s, Math.max(0, maxStep)));
  }, [maxStep]);

  const safeStep = Math.min(Math.max(0, stepOffset), Math.max(0, maxStep));

  const ballotStep = useMemo(
    () =>
      buildBallotFactionTransitionMatrix(
        papers,
        assignments,
        gc,
        safeStep,
      ),
    [papers, assignments, gc, safeStep],
  );

  const ballotPairs = useMemo(
    () => flattenBallotTransitionMatrix(ballotStep.matrix),
    [ballotStep.matrix],
  );

  const maxBallotCell = useMemo(
    () => Math.max(1, ...ballotStep.matrix.flat()),
    [ballotStep.matrix],
  );

  const matrix = useMemo(
    () => buildFactionVoteMatrix(rounds, assignments, gc),
    [rounds, assignments, gc],
  );

  const deltas = useMemo(() => buildFactionVoteDeltas(matrix), [matrix]);

  const pairRollups = useMemo(
    () => buildFactionPairRollups(rounds, assignments, gc),
    [rounds, assignments, gc],
  );

  if (gc < 1 || Object.keys(assignments).length === 0) {
    return null;
  }

  const topBarMax = ballotPairs[0]?.count ?? 1;

  return (
    <section
      className="section faction-rounds-section"
      aria-labelledby="faction-rounds-h"
    >
      <h2 id="faction-rounds-h">Frakcje w rundach</h2>
      <p className="lead faction-rounds-lead">
        Poniżej: najpierw <strong>perspektywa kart</strong> (każda linia eksportu =
        jedna odczytana karta), potem <strong>tabele rund</strong> z raportu.
      </p>

      <h3 className="faction-rounds-subh">
        Preferencje na kartach — przejścia między frakcjami
      </h3>
      <p className="faction-rounds-note">
        Liczymy tylko karty, które mają co najmniej dwie rozpatrywane pozycje.
        Frakcja na danej pozycji = Twoje przypisanie kandydatki (lub „bez
        frakcji”). To <strong>nie</strong> jest mechanika transferów STV —
        tylko surowa kolejność preferencji z pliku.
      </p>

      {papers.length === 0 ? (
        <p className="faction-rounds-note">
          W tym raporcie brak sekcji „Karty do głosowania” — brak danych do
          macierzy preferencji.
        </p>
      ) : papers.every((p) => p.length < 2) ? (
        <p className="faction-rounds-note">
          Żadna karta nie ma co najmniej dwóch pozycji — brak przejść do
          pokazania.
        </p>
      ) : (
        <>
          <div className="faction-ballot-step-row">
            <label className="faction-ballot-step-label" htmlFor="faction-step">
              Para kolejnych preferencji
            </label>
            <select
              id="faction-step"
              className="faction-ballot-step-select"
              value={safeStep}
              onChange={(e) =>
                setStepOffset(Number.parseInt(e.target.value, 10) || 0)
              }
            >
              {Array.from({ length: maxStep + 1 }, (_, s) => (
                <option key={s} value={s}>
                  {s + 1}. → {s + 2}.
                </option>
              ))}
            </select>
          </div>
          <p className="faction-rounds-note">
            Uwzględniono <strong>{formatVotes(ballotStep.totalCounted)}</strong>{" "}
            przejść na kartach; pominięto{" "}
            <strong>{formatVotes(ballotStep.ballotsSkippedTooShort)}</strong>{" "}
            linii za krótkich na ten krok (łącznie linii:{" "}
            {formatVotes(papers.length)}).
          </p>

          <h4 className="faction-rounds-h4">Macierz przejść (liczba kart)</h4>
          <div className="table-scroll faction-rounds-scroll">
            <table className="delta-table faction-heat-table">
              <thead>
                <tr>
                  <th scope="col">
                    {ballotStep.fromRank}. → {ballotStep.toRank}.
                  </th>
                  {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className="num faction-matrix-th faction-heat-th-compact"
                      title={fLabel(id)}
                    >
                      <span
                        className="faction-matrix-th-swatch"
                        style={{ backgroundColor: candidateFactionColor(id) }}
                        aria-hidden
                      />
                      <span className="faction-heat-th-txt">→ {fLabel(id)}</span>
                    </th>
                  ))}
                  <th scope="col" className="num">
                    → bez
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: gc }, (_, i) => i + 1).map((fromId) => (
                  <tr key={fromId}>
                    <th
                      scope="row"
                      className="faction-matrix-th faction-heat-th-compact"
                      title={fLabel(fromId)}
                    >
                      <span
                        className="faction-matrix-th-swatch"
                        style={{
                          backgroundColor: candidateFactionColor(fromId),
                        }}
                        aria-hidden
                      />
                      <span className="faction-heat-th-txt">{fLabel(fromId)} →</span>
                    </th>
                    {Array.from({ length: gc }, (_, j) => j + 1).map((toId) => {
                      const c = ballotStep.matrix[fromId]![toId] ?? 0;
                      const t = c / maxBallotCell;
                      return (
                        <td
                          key={toId}
                          className="num faction-heat-cell"
                          style={{
                            backgroundColor: `rgba(110, 231, 183, ${0.08 + t * 0.55})`,
                          }}
                        >
                          {formatVotes(c)}
                        </td>
                      );
                    })}
                    <td
                      className="num faction-heat-cell"
                      style={{
                        backgroundColor: `rgba(148, 163, 184, ${0.08 + ((ballotStep.matrix[fromId]![0] ?? 0) / maxBallotCell) * 0.45})`,
                      }}
                    >
                      {formatVotes(ballotStep.matrix[fromId]![0] ?? 0)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="faction-matrix-th">
                    bez →
                  </th>
                  {Array.from({ length: gc }, (_, j) => j + 1).map((toId) => {
                    const c = ballotStep.matrix[0]![toId] ?? 0;
                    const t = c / maxBallotCell;
                    return (
                      <td
                        key={toId}
                        className="num faction-heat-cell"
                        style={{
                          backgroundColor: `rgba(110, 231, 183, ${0.08 + t * 0.55})`,
                        }}
                      >
                        {formatVotes(c)}
                      </td>
                    );
                  })}
                  <td
                    className="num faction-heat-cell"
                    style={{
                      backgroundColor: `rgba(148, 163, 184, ${0.08 + ((ballotStep.matrix[0]![0] ?? 0) / maxBallotCell) * 0.45})`,
                    }}
                  >
                    {formatVotes(ballotStep.matrix[0]![0] ?? 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {ballotPairs.length > 0 && (
            <>
              <h4 className="faction-rounds-h4">
                Najczęstsze przejścia (te same dane)
              </h4>
              <ul className="faction-ballot-bar-list" aria-label="Top przejść">
                {ballotPairs.slice(0, 16).map((p) => (
                  <li key={`${p.fromF}-${p.toF}`} className="faction-ballot-bar-item">
                    <div className="faction-ballot-bar-label">
                      <span
                        className="faction-flow-pair-label"
                        style={{
                          borderLeftColor:
                            p.fromF === 0
                              ? "var(--muted)"
                              : candidateFactionColor(p.fromF),
                        }}
                      >
                        {fLabel(p.fromF)}
                      </span>
                      <span className="faction-ballot-bar-arrow" aria-hidden>
                        →
                      </span>
                      <span
                        className="faction-flow-pair-label"
                        style={{
                          borderLeftColor:
                            p.toF === 0
                              ? "var(--muted)"
                              : candidateFactionColor(p.toF),
                        }}
                      >
                        {fLabel(p.toF)}
                      </span>
                    </div>
                    <div className="faction-ballot-bar-track" aria-hidden>
                      <div
                        className="faction-ballot-bar-fill"
                        style={{
                          width: `${Math.min(100, (p.count / topBarMax) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="faction-ballot-bar-count num">
                      {formatVotes(p.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h3 className="faction-rounds-subh">Suma głosów w tabeli według frakcji</h3>
      <p className="faction-rounds-note">
        Suma wag głosów z <strong>tabeli rund</strong> pogrupowana według Twoich
        frakcji (wiersze tabeli — bez nowych obliczeń STV).
      </p>
      <div className="table-scroll faction-rounds-scroll">
        <table className="delta-table faction-rounds-table">
          <thead>
            <tr>
              <th scope="col">Runda</th>
              {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
                <th key={id} scope="col" className="num faction-matrix-th">
                  <span
                    className="faction-matrix-th-swatch"
                    style={{ backgroundColor: candidateFactionColor(id) }}
                    aria-hidden
                  />
                  {fLabel(id)}
                </th>
              ))}
              <th scope="col" className="num">
                Bez frakcji
              </th>
              <th scope="col" className="num">
                Σ tabeli
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.roundNumber}>
                <th scope="row">{row.roundNumber}</th>
                {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
                  <td key={id} className="num">
                    {formatVotes(row.byFaction[id] ?? 0)}
                  </td>
                ))}
                <td className="num">{formatVotes(row.byFaction[0] ?? 0)}</td>
                <td className="num">{formatVotes(row.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deltas.length > 0 && (
        <>
          <h3 className="faction-rounds-subh">
            Zmiana netto między kolejnymi rundami (Δ w tabeli)
          </h3>
          <p className="faction-rounds-note">
            To różnica sum w tabeli — <strong>nie</strong> jest to oficjalny
            rozkład transferów między frakcjami (do tego potrzebne byłyby
            dane per głos).
          </p>
          <div className="table-scroll faction-rounds-scroll">
            <table className="delta-table faction-rounds-table">
              <thead>
                <tr>
                  <th scope="col">Przejście</th>
                  {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
                    <th key={id} scope="col" className="num faction-matrix-th">
                      <span
                        className="faction-matrix-th-swatch"
                        style={{ backgroundColor: candidateFactionColor(id) }}
                        aria-hidden
                      />
                      {fLabel(id)}
                    </th>
                  ))}
                  <th scope="col" className="num">
                    Bez frakcji
                  </th>
                </tr>
              </thead>
              <tbody>
                {deltas.map((d) => (
                  <tr key={`${d.fromRound}-${d.toRound}`}>
                    <th scope="row">
                      {d.fromRound} → {d.toRound}
                    </th>
                    {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
                      <td key={id} className="num">
                        {formatVotes(d.deltaByFaction[id] ?? 0)}
                      </td>
                    ))}
                    <td className="num">
                      {formatVotes(d.deltaByFaction[0] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="faction-rounds-subh">
        Szacunek przepływów między frakcjami (model proporcjonalny)
      </h3>
      <p className="faction-rounds-note">
        Poniżej: zagregowane linki z tego samego modelu co zakładka{" "}
        <strong>Transfery</strong> (proporcje między kandydatami), złożone do
        par frakcji. To <strong>nie</strong> jest wynik z liczenia STV — tylko
        wizualna heurystyka.
      </p>
      {pairRollups.map((block) => (
        <div
          key={`${block.fromRound}-${block.toRound}`}
          className="faction-flow-block"
        >
          <h4 className="faction-flow-block-title">
            Runda {block.fromRound} → {block.toRound}
          </h4>
          {block.pairs.length === 0 ? (
            <p className="faction-rounds-note">Brak istotnych par w modelu.</p>
          ) : (
            <div className="table-scroll">
              <table className="delta-table faction-flow-pairs-table">
                <thead>
                  <tr>
                    <th scope="col">Z</th>
                    <th scope="col">Do</th>
                    <th scope="col" className="num">
                      Szac. waga
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {block.pairs.slice(0, 40).map((p, idx) => (
                    <tr key={`${p.fromF}-${p.toF}-${idx}`}>
                      <td>
                        <span
                          className="faction-flow-pair-label"
                          style={{
                            borderLeftColor:
                              p.fromF === 0
                                ? "var(--muted)"
                                : candidateFactionColor(p.fromF),
                          }}
                        >
                          {fLabel(p.fromF)}
                        </span>
                      </td>
                      <td>
                        <span
                          className="faction-flow-pair-label"
                          style={{
                            borderLeftColor:
                              p.toF === 0
                                ? "var(--muted)"
                                : candidateFactionColor(p.toF),
                          }}
                        >
                          {fLabel(p.toF)}
                        </span>
                      </td>
                      <td className="num">{formatVotes(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {block.pairs.length > 40 && (
            <p className="faction-rounds-note">
              Pokazano 40 z {block.pairs.length} par (posortowane malejąco).
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
