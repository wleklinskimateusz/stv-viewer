import type { ParsedStvReport, Round } from "./stvTypes";

export type DroopSummary = {
  seats: number;
  eligibleVoters: number | null;
  /** Suma wag głosów w pierwszej rundzie z tabeli (pierwsze preferencje). */
  firstRoundVoteTotal: number;
  /** Liczba niepustych linii w sekcji „Karty do głosowania”. */
  ballotPaperLines: number;
  /** Suma długości wszystkich odczytanych kart (liczba pozycji preferencji). */
  ballotPreferenceSlotsTotal: number;
  /** Największa liczba pozycji preferencji na pojedynczej odczytanej karcie. */
  maxPreferencesOnAnyBallot: number;
  /** Liczba kart o długości równej tej maksymalnej („wypełnione do końca” wg najdłuższej karty w pliku). */
  fullyFilledBallotLines: number;
  /** V użyte w wzorze na kwotę Droop. */
  votesBaseForQuota: number;
  votesBaseExplanation: string;
  /** Kwota Droop jako próg ułamkowy: V / (S + 1). */
  droopQuota: number;
  /** V / osoby uprawnione, jeśli znane. */
  turnout: number | null;
};

export function sumFirstRoundVotes(rounds: Round[]): number {
  if (rounds.length === 0) return 0;
  const sorted = [...rounds].sort((a, b) => a.number - b.number);
  const r = sorted[0]!;
  return r.rows.reduce((sum, row) => sum + row.votes, 0);
}

export function calculateDroopQuota(validVotes: number, seats: number): number {
  if (seats <= 0 || validVotes <= 0) return 0;
  return Math.floor(validVotes / (seats + 1) + 1);
}

export function parseEligibleVoters(
  meta: ParsedStvReport["meta"],
): number | null {
  const raw = meta["Osoby głosujące"];
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(String(raw).replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function computeDroopSummary(data: ParsedStvReport): DroopSummary {
  const seats = data.elected.length;
  const eligibleVoters = parseEligibleVoters(data.meta);
  const firstRoundVoteTotal = sumFirstRoundVotes(data.rounds);
  const ballotPapers = data.ballotPapers;
  const ballotPaperLines = ballotPapers.length;
  const ballotPreferenceSlotsTotal = ballotPapers.reduce(
    (acc, p) => acc + p.length,
    0,
  );
  let maxPreferencesOnAnyBallot = 0;
  for (const p of ballotPapers) {
    if (p.length > maxPreferencesOnAnyBallot) maxPreferencesOnAnyBallot = p.length;
  }
  const fullyFilledBallotLines =
    maxPreferencesOnAnyBallot > 0
      ? ballotPapers.filter((p) => p.length === maxPreferencesOnAnyBallot).length
      : 0;

  let votesBaseForQuota: number;
  let votesBaseExplanation: string;

  if (ballotPaperLines > 1) {
    votesBaseForQuota = ballotPaperLines;
    votesBaseExplanation = `Kwota liczona od liczby linii w sekcji „Karty do głosowania” (${ballotPaperLines}) — zakładamy jedną ważną kartę na linię.`;
  } else if (firstRoundVoteTotal > 0) {
    votesBaseForQuota = firstRoundVoteTotal;
    votesBaseExplanation =
      ballotPaperLines === 1
        ? "Jedna linia w „Kartach…” traktowana jako przykładowa karta; V do kwoty Droop wzięte z sumy głosów w pierwszej rundzie tabeli (zwykle liczba ważnych kart w przeliczeniu)."
        : "Brak sekcji „Karty do głosowania”; V z sumy głosów w pierwszej rundzie tabeli.";
  } else {
    votesBaseForQuota = 0;
    votesBaseExplanation =
      "Brak danych do policzenia V (pusta pierwsza runda lub brak tabeli).";
  }

  const droopQuota = calculateDroopQuota(votesBaseForQuota, seats);
  const turnout =
    eligibleVoters != null && eligibleVoters > 0 && votesBaseForQuota >= 0
      ? votesBaseForQuota / eligibleVoters
      : null;

  return {
    seats,
    eligibleVoters,
    firstRoundVoteTotal,
    ballotPaperLines,
    ballotPreferenceSlotsTotal,
    maxPreferencesOnAnyBallot,
    fullyFilledBallotLines,
    votesBaseForQuota,
    votesBaseExplanation,
    droopQuota,
    turnout,
  };
}
