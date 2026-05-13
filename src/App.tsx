import { useMemo, useRef, useState } from "react";
import "./App.css";
import {
  actionLabel,
  parseStvReport,
  validateStvReportText,
} from "./parseStvReport";
import type { ParsedStvReport, Round, RoundRow } from "./stvTypes";
import { formatVotes } from "./formatVotes";
import { groupClass } from "./groupStyles";
import { TransfersPanel } from "./TransfersPanel";
import { BallotsPanel } from "./BallotsPanel";
import { CandidateStatsPanel } from "./CandidateStatsPanel";
import { computeDroopSummary } from "./stvQuota";

type MainTab = "overview" | "transfers" | "ballots" | "candidates";

function applyRawReport(
  raw: string,
  setData: (d: ParsedStvReport | null) => void,
  setError: (e: string | null) => void,
): void {
  const parsed = parseStvReport(raw);
  const validationError = validateStvReportText(raw, parsed);
  if (validationError) {
    setError(validationError);
    setData(null);
    return;
  }
  setError(null);
  setData(parsed);
}

const META_LABEL_DISPLAY: Record<string, string> = {
  "Osoby głosujące": "Osoby uprawnione do głosowania",
};

function MetaGrid({ meta }: { meta: ParsedStvReport["meta"] }) {
  const order = [
    "Nazwa wyborów",
    "Nazwa instytucji",
    "Nazwa głosowania",
    "Początek",
    "Koniec",
    "Osoby głosujące",
  ];
  const keys = [...new Set([...order, ...Object.keys(meta)])].filter(
    (k) => meta[k],
  );

  return (
    <dl className="meta-grid">
      {keys.map((key) => (
        <div key={key} className="meta-pair">
          <dt>{META_LABEL_DISPLAY[key] ?? key}</dt>
          <dd>{meta[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

function ElectionStatsBanner({ data }: { data: ParsedStvReport }) {
  const s = useMemo(() => computeDroopSummary(data), [data]);
  const turnoutStr =
    s.turnout != null
      ? new Intl.NumberFormat("pl-PL", {
          style: "percent",
          maximumFractionDigits: 1,
          minimumFractionDigits: 0,
        }).format(s.turnout)
      : "—";

  return (
    <section className="election-stats" aria-label="Kwota Droop i frekwencja">
      <h2 className="election-stats-title">Kwota Droop i frekwencja</h2>
      <dl className="election-stats-grid">
        <div className="election-stat">
          <dt>Liczba miejsc (wybranych)</dt>
          <dd>{s.seats}</dd>
        </div>

        <div className="election-stat">
          <dt>Kwota Droopa</dt>
          <dd className="election-stat-highlight">
            {formatVotes(s.droopQuota)}
          </dd>
        </div>
        <div className="election-stat">
          <dt>Suma głosów ważnych</dt>
          <dd>{formatVotes(s.firstRoundVoteTotal)}</dd>
        </div>
        <div className="election-stat">
          <dt>Osoby uprawnione do głosowania</dt>
          <dd>
            {s.eligibleVoters != null ? formatVotes(s.eligibleVoters) : "—"}
          </dd>
        </div>
        <div className="election-stat">
          <dt>Frekwencja (V względem uprawnionych)</dt>
          <dd>{turnoutStr}</dd>
        </div>

        <div className="election-stat">
          <dt>Jak dużo osób wypełniło karty do końca?</dt>
          <dd>
            {s.maxPreferencesOnAnyBallot > 0 ? (
              <>
                {formatVotes(s.fullyFilledBallotLines)}
                <span className="election-stat-sub">
                  {" "}
                  (pełna karta = {formatVotes(s.maxPreferencesOnAnyBallot)} poz. —
                  tyle co najdłuższa z odczytanych)
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      <p className="election-stats-formula">
        Wzór: kwota = ⌊V / (S + 1) + 1⌋, gdzie S = liczba miejsc, V = liczba
        ważnych głosów.
      </p>
      <p className="election-stats-note">{s.votesBaseExplanation}</p>
    </section>
  );
}

function ElectedGrid({ elected }: { elected: ParsedStvReport["elected"] }) {
  return (
    <ul className="elected-grid">
      {elected.map((p) => (
        <li key={p.name} className="elected-card">
          <span className={`group-pill ${groupClass(p.group)}`}>{p.group}</span>
          <span className="elected-name">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

function roundSummary(round: Round): {
  elected: RoundRow[];
  eliminated: RoundRow[];
} {
  const elected: RoundRow[] = [];
  const eliminated: RoundRow[] = [];
  for (const row of round.rows) {
    const kind = actionLabel(row.action);
    if (kind === "elected") elected.push(row);
    else if (kind === "eliminated") eliminated.push(row);
  }
  return { elected, eliminated };
}

function RoundCard({ round }: { round: Round }) {
  const maxVotes = Math.max(...round.rows.map((r) => r.votes), 1);
  const { elected, eliminated } = roundSummary(round);
  const tieCount = round.rows.filter((r) => r.tie).length;

  return (
    <article className="round-card">
      <header className="round-head">
        <h3 className="round-title">Runda {round.number}</h3>
        <div className="round-badges">
          {elected.length > 0 && (
            <span className="badge badge-elected">
              Wybrano w tej rundzie:{" "}
              {elected.map((e) => e.candidate).join(", ")}
            </span>
          )}
          {eliminated.length > 0 && (
            <span className="badge badge-out">
              Eliminacja: {eliminated.map((e) => e.candidate).join(", ")}
            </span>
          )}
          {tieCount > 0 && (
            <span className="badge badge-tie">
              Remis (TAK): {tieCount} pozycji
            </span>
          )}
        </div>
      </header>
      <div className="round-rows">
        {round.rows
          .slice()
          .sort((a, b) => b.votes - a.votes)
          .map((row) => {
            const kind = actionLabel(row.action);
            const pct = (row.votes / maxVotes) * 100;
            return (
              <div
                key={row.candidate}
                className={`round-row ${kind === "elected" ? "row-elected" : ""} ${kind === "eliminated" ? "row-out" : ""}`}
              >
                <div className="row-bar-wrap" aria-hidden>
                  <div className="row-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="row-main">
                  <span className="row-name">{row.candidate}</span>
                  <span className="row-meta">
                    {row.tie && <span className="pill pill-tie">remis</span>}
                    {kind === "elected" && (
                      <span className="pill pill-ok">wybór</span>
                    )}
                    {kind === "eliminated" && (
                      <span className="pill pill-bad">eliminacja</span>
                    )}
                  </span>
                </div>
                <span className="row-votes">{formatVotes(row.votes)}</span>
              </div>
            );
          })}
      </div>
    </article>
  );
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ParsedStvReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("overview");

  const consumeFile = (file: File) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      applyRawReport(raw, setData, setError);
      setSourceLabel(file.name);
      setLoading(false);
    };
    reader.onerror = () => {
      setError("Nie udało się odczytać pliku z dysku.");
      setData(null);
      setLoading(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) consumeFile(file);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) consumeFile(file);
  };

  const roundGaps = useMemo(() => {
    if (!data || data.rounds.length < 2)
      return [] as { from: number; to: number }[];
    const nums = [...new Set(data.rounds.map((r) => r.number))].sort(
      (a, b) => a - b,
    );
    const gaps: { from: number; to: number }[] = [];
    for (let j = 1; j < nums.length; j += 1) {
      const prev = nums[j - 1]!;
      const cur = nums[j]!;
      if (cur - prev > 1) gaps.push({ from: prev, to: cur });
    }
    return gaps;
  }, [data]);

  return (
    <div className="app">
      <section className="upload-panel" aria-label="Wczytywanie raportu">
        <input
          ref={fileInputRef}
          type="file"
          className="visually-hidden"
          accept=".txt,.csv,text/plain"
          onChange={onFileInputChange}
        />
        <div
          className={`upload-zone ${dragOver ? "upload-zone-active" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p className="upload-title">Raport STV (tekst / CSV z eksportu)</p>
          <p className="upload-hint">
            Przeciągnij plik tutaj albo wybierz z dysku. Oczekiwany układ jak w
            eksporcie ZEUS”.
          </p>
          <div className="upload-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openFilePicker}
            >
              Wybierz plik…
            </button>
          </div>
        </div>
        {loading && <p className="upload-status">Wczytywanie…</p>}
        {error && (
          <p className="upload-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {!data && !loading && !error && (
        <div className="empty-report" aria-live="polite">
          <p className="empty-report-title">Dołącz plik, by pokazać wyniki</p>
          <p className="empty-report-hint">
            Użyj przycisku powyżej lub przeciągnij raport tekstowy z ZEUS na
            obszar z ramką.
          </p>
        </div>
      )}

      {data && (
        <>
          <header className="hero">
            <p className="eyebrow">Raport STV (ZEUS)</p>
            <h1>{data.meta["Nazwa wyborów"] ?? "Wybory"}</h1>
            <p className="hero-sub">
              Informacje o głosowaniu, lista wybranych oraz przebieg rund z
              liczbą głosów (w tym ułamkowych transferów).
            </p>
          </header>

          <ElectionStatsBanner data={data} />

          <nav className="app-tabs" role="tablist" aria-label="Widok raportu">
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "overview"}
              className={`app-tab ${mainTab === "overview" ? "app-tab-active" : ""}`}
              onClick={() => setMainTab("overview")}
            >
              Przegląd
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "transfers"}
              className={`app-tab ${mainTab === "transfers" ? "app-tab-active" : ""}`}
              onClick={() => setMainTab("transfers")}
              aria-label="Transfery między rundami"
            >
              Transfery
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "ballots"}
              className={`app-tab ${mainTab === "ballots" ? "app-tab-active" : ""}`}
              onClick={() => setMainTab("ballots")}
              aria-label="Karty do głosowania — podgląd kolejności preferencji"
            >
              Karty
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "candidates"}
              className={`app-tab ${mainTab === "candidates" ? "app-tab-active" : ""}`}
              onClick={() => setMainTab("candidates")}
              aria-label="Statystyki kandydatów z kart i pierwszej rundy"
            >
              Kandydatki
            </button>
          </nav>

          {mainTab === "overview" && (
            <>
              <section className="section">
                <h2>Informacje o głosowaniu</h2>
                <MetaGrid meta={data.meta} />
              </section>

              <section className="section elected">
                <h2>Wybrane ({data.elected.length})</h2>
                <p className="lead">
                  Osoby, które znalazły się w sekcji wyboru w raporcie — z
                  oznaczeniem parytetu (M / K / X).
                </p>
                <ElectedGrid elected={data.elected} />
              </section>

              <section className="section rounds">
                <h2>Rundy przeliczenia</h2>
                {roundGaps.length > 0 && (
                  <p className="notice">
                    W pliku źródłowym pominięto pełną listę rund (np. między
                    rundą {roundGaps[0]!.from} a {roundGaps[0]!.to}). Poniżej
                    wszystkie rundy obecne w pliku.
                    {roundGaps.length > 1 &&
                      ` Dodatkowe luki: ${roundGaps
                        .slice(1)
                        .map((g) => `${g.from}→${g.to}`)
                        .join(", ")}.`}
                  </p>
                )}
                <div className="round-stack">
                  {data.rounds
                    .slice()
                    .sort((a, b) => a.number - b.number)
                    .map((r, idx) => (
                      <RoundCard key={`${r.number}-${idx}`} round={r} />
                    ))}
                </div>
              </section>
            </>
          )}

          {mainTab === "transfers" && <TransfersPanel rounds={data.rounds} />}

          {mainTab === "ballots" && <BallotsPanel papers={data.ballotPapers} />}

          {mainTab === "candidates" && (
            <CandidateStatsPanel
              papers={data.ballotPapers}
              rounds={data.rounds}
              elected={data.elected}
            />
          )}
        </>
      )}

      <footer className="footer">
        <p>
          <strong>Polityka prywatności:</strong> aplikacja nie wysyła danych na
          żaden serwer zewnętrzny — wczytany plik jest analizowany wyłącznie
          lokalnie w przeglądarce.
        </p>
        {data && (
          <p>
            Źródło danych:{" "}
            {sourceLabel ? <strong>{sourceLabel}</strong> : "plik tekstowy"} —
            eksport z systemu głosowania (UTF-8).
          </p>
        )}
      </footer>
    </div>
  );
}
