import { useMemo, useState } from "react";
import type { BallotEntry, ElectedPerson, Round } from "./stvTypes";
import {
  buildCandidateStatsRows,
  maxBallotDepth,
  type CandidateStatsRow,
} from "./candidateBallotStats";
import { groupClass } from "./groupStyles";

const nfRank = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function RankHistogram({ row }: { row: CandidateStatsRow }) {
  const counts = row.rankCounts;
  if (counts.length === 0) {
    return (
      <p className="candidate-histo-empty">
        Brak pozycji na kartach w eksporcie dla tej osoby.
      </p>
    );
  }

  const maxC = Math.max(...counts, 1);

  return (
    <div
      className="candidate-histo"
      role="img"
      aria-label="Rozkład miejsc preferencji na kartach"
    >
      <h4 className="candidate-histo-title">
        Miejsca na kartach (liczba kart)
      </h4>
      <ul className="candidate-histo-list">
        {counts.map((c, i) => {
          const rank = i + 1;
          const pct = (c / maxC) * 100;
          return (
            <li key={rank} className="candidate-histo-row">
              <span className="candidate-histo-rank">{rank}.</span>
              <div className="candidate-histo-bar-wrap">
                <div
                  className="candidate-histo-bar"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="candidate-histo-count">{c}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type SortKey = "name" | "first" | "ballots" | "mean" | "best" | "worst" | "r1";

export function CandidateStatsPanel({
  papers,
  rounds,
  elected,
}: {
  papers: BallotEntry[][];
  rounds: Round[];
  elected: ElectedPerson[];
}) {
  const rows = useMemo(
    () => buildCandidateStatsRows(papers, rounds, elected),
    [papers, rounds, elected],
  );
  const depth = useMemo(() => maxBallotDepth(papers), [papers]);
  const [sortKey, setSortKey] = useState<SortKey>("first");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
          break;
        case "first":
          cmp = a.firstPreferenceCount - b.firstPreferenceCount;
          break;
        case "ballots":
          cmp = a.ballotCount - b.ballotCount;
          break;
        case "mean":
          cmp = a.meanRank - b.meanRank;
          break;
        case "best":
          cmp = (a.bestRank || 999) - (b.bestRank || 999);
          break;
        case "worst":
          cmp = (a.worstRank || 0) - (b.worstRank || 0);
          break;
        case "r1":
          cmp = (a.round1TableVotes ?? -1) - (b.round1TableVotes ?? -1);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const activeRow = useMemo(() => {
    if (selected) {
      const found = rows.find((r) => r.name === selected);
      if (found) return found;
    }
    return sortedRows[0] ?? null;
  }, [rows, selected, sortedRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const th = (key: SortKey, label: string) => (
    <th scope="col">
      <button
        type="button"
        className={`table-sort-btn ${sortKey === key ? "active" : ""}`}
        onClick={() => toggleSort(key)}
      >
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <section
      className="section candidate-stats-section"
      aria-labelledby="cand-stats-h"
    >
      <h2 id="cand-stats-h">Statystyki kandydatów</h2>
      <p className="lead candidate-stats-lead">
        Zliczenia z sekcji <strong>„Karty do głosowania”</strong>: na którym
        miejscu preferencji dana osoba pojawia się na poszczególnych kartach.
        Kolumna <em>Runda 1 (tabela)</em> to pierwsza runda z raportu — do
        porównania, gdy w eksporcie jest tylko część kart.
      </p>
      <p className="candidate-stats-meta">
        Linii kart w pliku: <strong>{papers.length}</strong>
        {depth > 0 ? (
          <>
            {" "}
            · maks. długość preferencji na karcie: <strong>{depth}</strong>
          </>
        ) : null}{" "}
        · wierszy w tabeli: <strong>{sortedRows.length}</strong>
      </p>

      {sortedRows.length === 0 ? (
        <p className="lead">
          Brak kandydatów w pierwszej rundzie i na kartach.
        </p>
      ) : (
        <>
          <div className="table-scroll candidate-stats-scroll">
            <table className="delta-table candidate-stats-table">
              <thead>
                <tr>
                  {th("name", "Kandydat")}
                  {th("first", "1. miejsce (karty)")}
                  {th("ballots", "Karty łącznie")}
                  {th("mean", "Śr. miejsce")}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={r.name}
                    className={activeRow?.name === r.name ? "row-selected" : ""}
                  >
                    <td>
                      <button
                        type="button"
                        className="candidate-name-btn"
                        onClick={() => setSelected(r.name)}
                      >
                        <span
                          className={`group-pill sm ${groupClass(r.group)}`}
                        >
                          {r.group}
                        </span>
                        <span className="candidate-name-txt">{r.name}</span>
                      </button>
                    </td>
                    <td className="num">{r.firstPreferenceCount}</td>
                    <td className="num">{r.ballotCount}</td>
                    <td className="num">
                      {r.ballotCount > 0 ? nfRank.format(r.meanRank) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeRow && (
            <div className="candidate-detail">
              <h3 className="candidate-detail-title">
                Szczegóły: {activeRow.name}
                <span
                  className={`group-pill sm ${groupClass(activeRow.group)}`}
                >
                  {activeRow.group}
                </span>
              </h3>
              <dl className="candidate-detail-dl">
                <div>
                  <dt>Udział 1. preferencji na kartach</dt>
                  <dd>
                    {papers.length > 0 && activeRow.ballotCount > 0
                      ? new Intl.NumberFormat("pl-PL", {
                          style: "percent",
                          maximumFractionDigits: 1,
                        }).format(
                          activeRow.firstPreferenceCount / papers.length,
                        )
                      : "—"}
                    <span className="candidate-detail-sub">
                      {" "}
                      ({activeRow.firstPreferenceCount} z {papers.length} kart)
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Suma „wag miejsc” (Σ miejsce na karcie)</dt>
                  <dd>
                    {activeRow.ballotCount > 0 ? activeRow.sumOfRanks : "—"}
                  </dd>
                </div>
              </dl>
              <RankHistogram row={activeRow} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
