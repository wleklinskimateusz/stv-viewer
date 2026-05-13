import { useMemo, useState } from "react";
import type { BallotEntry, ElectedPerson, Round } from "./stvTypes";
import {
  buildCandidateStatsRows,
  maxBallotDepth,
  type CandidateStatsRow,
} from "./candidateBallotStats";
import {
  CANDIDATE_FACTION_MAX,
  candidateFactionColor,
  displayFactionName,
  FACTION_NAME_MAX_LEN,
  type CandidateFactionsState,
} from "./candidateFactions";
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
  sourceLabel,
  factions,
  onFactionGroupCountChange,
  onFactionAssign,
  onFactionRememberChange,
  onFactionClearBrowserStorage,
  onFactionClearAssignments,
  onFactionNameChange,
}: {
  papers: BallotEntry[][];
  rounds: Round[];
  elected: ElectedPerson[];
  sourceLabel: string;
  factions: CandidateFactionsState;
  onFactionGroupCountChange: (n: number) => void;
  onFactionAssign: (candidateName: string, groupId: number) => void;
  onFactionRememberChange: (v: boolean) => void;
  onFactionClearBrowserStorage: () => void;
  onFactionClearAssignments: () => void;
  onFactionNameChange: (groupId: number, label: string) => void;
}) {
  const rows = useMemo(
    () => buildCandidateStatsRows(papers, rounds, elected),
    [papers, rounds, elected],
  );
  const depth = useMemo(() => maxBallotDepth(papers), [papers]);
  const [sortKey, setSortKey] = useState<SortKey>("first");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string | null>(null);

  const gc = factions.groupCount;

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

  const factionSelect = (name: string) => {
    const current = factions.assignments[name];
    const val =
      current != null &&
      current >= 1 &&
      current <= gc
        ? String(current)
        : "";
    return (
      <select
        className="candidate-faction-select"
        aria-label={`Frakcja: ${name}`}
        disabled={gc < 1}
        value={val}
        onChange={(e) => {
          const raw = e.target.value;
          onFactionAssign(name, raw === "" ? 0 : Number.parseInt(raw, 10));
        }}
      >
        <option value="">—</option>
        {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
          <option key={id} value={id}>
            {displayFactionName(id, factions.factionNames, gc)}
          </option>
        ))}
      </select>
    );
  };

  const factionSwatch = (name: string) => {
    const g = factions.assignments[name];
    if (gc < 1 || g == null || g < 1 || g > gc) return null;
    const c = candidateFactionColor(g);
    const title = displayFactionName(g, factions.factionNames, gc);
    return (
      <span
        className="faction-dot faction-dot-table"
        style={{ backgroundColor: c }}
        title={title}
        aria-hidden
      />
    );
  };

  return (
    <section
      className="section candidate-stats-section"
      aria-labelledby="cand-stats-h"
    >
      <h2 id="cand-stats-h">Statystyki kandydatów</h2>
      <p className="lead candidate-stats-lead">
        Zliczenia z sekcji <strong>„Karty do głosowania”</strong>: na którym
        miejscu preferencji dana osoba pojawia się na poszczególnych kartach.
      </p>

      <div className="candidate-faction-panel" aria-label="Opcjonalne frakcje">
        <h3 className="candidate-faction-title">Frakcje (opcjonalnie)</h3>
        <p className="candidate-faction-lead">
          Przypisz każdą kandydatkę do co najwyżej jednej grupy (albo żadnej).
          Możesz też nadać grupom <strong>własne nazwy</strong> (tylko w tej
          aplikacji). To nie zmienia danych z pliku — tylko podświetlenia i
          podsumowania. Domyślnie ustawienia są tylko w tej sesji; możesz
          zapisać je lokalnie w przeglądarce (<strong>localStorage</strong>)
          pod{" "}
          <strong>tą samą nazwą pliku</strong>{" "}
          {sourceLabel ? (
            <>
              (<code className="inline-code">{sourceLabel}</code>)
            </>
          ) : null}
          .
        </p>
        <div className="candidate-faction-controls">
          <label className="candidate-faction-field">
            <span className="candidate-faction-field-label">Liczba grup</span>
            <input
              type="number"
              className="candidate-faction-input"
              min={0}
              max={CANDIDATE_FACTION_MAX}
              value={gc}
              onChange={(e) =>
                onFactionGroupCountChange(
                  Number.parseInt(e.target.value, 10) || 0,
                )
              }
            />
            <span className="candidate-faction-field-hint">
              0 = wyłączone, max. {CANDIDATE_FACTION_MAX}
            </span>
          </label>
          <label className="candidate-faction-check">
            <input
              type="checkbox"
              checked={factions.rememberForFileName}
              disabled={gc < 1}
              onChange={(e) => onFactionRememberChange(e.target.checked)}
            />
            <span>Zapamiętaj przypisania i nazwy (localStorage)</span>
          </label>
        </div>
        {gc > 0 && (
          <div className="candidate-faction-names" aria-label="Nazwy grup">
            <span className="candidate-faction-names-title">Nazwy frakcji</span>
            <div className="candidate-faction-names-grid">
              {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
                <label key={id} className="candidate-faction-name-field">
                  <span className="candidate-faction-name-label">
                    <span
                      className="candidate-faction-swatch"
                      style={{
                        backgroundColor: candidateFactionColor(id),
                      }}
                      aria-hidden
                    />
                    Grupa {id}
                  </span>
                  <input
                    type="text"
                    className="candidate-faction-name-input"
                    maxLength={FACTION_NAME_MAX_LEN}
                    placeholder={`np. „Sekcja ${id}”`}
                    value={factions.factionNames[id] ?? ""}
                    onChange={(e) => onFactionNameChange(id, e.target.value)}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
        {gc > 0 && (
          <div className="candidate-faction-legend" aria-hidden>
            {Array.from({ length: gc }, (_, j) => j + 1).map((id) => (
              <span key={id} className="candidate-faction-legend-item">
                <span
                  className="candidate-faction-swatch"
                  style={{ backgroundColor: candidateFactionColor(id) }}
                />
                {displayFactionName(id, factions.factionNames, gc)}
              </span>
            ))}
          </div>
        )}
        <div className="candidate-faction-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={Object.keys(factions.assignments).length === 0}
            onClick={() => onFactionClearAssignments()}
          >
            Wyczyść przypisania
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onFactionClearBrowserStorage()}
          >
            Usuń zapis w przeglądarce dla tej nazwy pliku
          </button>
        </div>
      </div>

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
                  {gc > 0 ? (
                    <th scope="col" className="candidate-faction-col">
                      Fr.
                    </th>
                  ) : null}
                  {th("name", "Kandydat")}
                  {th("first", "1. miejsce (karty)")}
                  {th("ballots", "Karty łącznie")}
                  {th("mean", "Śr. miejsce")}
                  {gc > 0 ? (
                    <th scope="col" className="candidate-faction-assign-col">
                      Frakcja
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={r.name}
                    className={activeRow?.name === r.name ? "row-selected" : ""}
                  >
                    {gc > 0 ? (
                      <td className="candidate-faction-col">
                        {factionSwatch(r.name)}
                      </td>
                    ) : null}
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
                    {gc > 0 ? (
                      <td className="candidate-faction-assign-col">
                        {factionSelect(r.name)}
                      </td>
                    ) : null}
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
              {gc > 0 ? (
                <p className="candidate-detail-faction-row">
                  <span className="candidate-detail-faction-label">Frakcja</span>
                  {factionSelect(activeRow.name)}
                </p>
              ) : null}
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
