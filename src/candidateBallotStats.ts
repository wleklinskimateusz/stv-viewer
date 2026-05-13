import type { BallotEntry, ElectedPerson, Round } from "./stvTypes";

export type CandidateBallotAggregate = {
  name: string;
  group: string;
  /** Liczba kart, na których kandydat się pojawia (maks. jedna pozycja na kartę). */
  ballotCount: number;
  /** rankCounts[i] = ile razy na miejscu (i+1) w kolejności preferencji. */
  rankCounts: number[];
  firstPreferenceCount: number;
  sumOfRanks: number;
  meanRank: number;
  bestRank: number;
  worstRank: number;
};

function ensureLen(arr: number[], len: number): void {
  while (arr.length < len) arr.push(0);
}

/** Głosy z pierwszej rundy tabeli (dla porównania z kartami). */
export function firstRoundVotesByCandidate(rounds: Round[]): Map<string, number> {
  const sorted = [...rounds].sort((a, b) => a.number - b.number);
  if (sorted.length === 0) return new Map();
  const m = new Map<string, number>();
  for (const row of sorted[0]!.rows) {
    m.set(row.candidate, row.votes);
  }
  return m;
}

/**
 * Zlicza dla każdego kandydata: na którym miejscu na ile kartach się pojawił
 * (na podstawie linii w sekcji „Karty do głosowania”).
 */
export function aggregateCandidateBallotStats(
  papers: BallotEntry[][],
): CandidateBallotAggregate[] {
  const byName = new Map<
    string,
    {
      group: string;
      rankCounts: number[];
      sumOfRanks: number;
      ballotCount: number;
      bestRank: number;
      worstRank: number;
    }
  >();

  for (const paper of papers) {
    paper.forEach((entry, idx) => {
      const rank = idx + 1;
      let rec = byName.get(entry.name);
      if (!rec) {
        rec = {
          group: entry.group,
          rankCounts: [],
          sumOfRanks: 0,
          ballotCount: 0,
          bestRank: rank,
          worstRank: rank,
        };
        byName.set(entry.name, rec);
      }
      ensureLen(rec.rankCounts, rank);
      rec.rankCounts[rank - 1] = (rec.rankCounts[rank - 1] ?? 0) + 1;
      rec.sumOfRanks += rank;
      rec.ballotCount += 1;
      rec.bestRank = Math.min(rec.bestRank, rank);
      rec.worstRank = Math.max(rec.worstRank, rank);
    });
  }

  const out: CandidateBallotAggregate[] = [];
  for (const [name, rec] of byName) {
    const firstPreferenceCount = rec.rankCounts[0] ?? 0;
    const meanRank = rec.ballotCount > 0 ? rec.sumOfRanks / rec.ballotCount : 0;
    out.push({
      name,
      group: rec.group,
      ballotCount: rec.ballotCount,
      rankCounts: rec.rankCounts,
      firstPreferenceCount,
      sumOfRanks: rec.sumOfRanks,
      meanRank,
      bestRank: rec.bestRank,
      worstRank: rec.worstRank,
    });
  }

  out.sort((a, b) => {
    if (b.firstPreferenceCount !== a.firstPreferenceCount) {
      return b.firstPreferenceCount - a.firstPreferenceCount;
    }
    return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
  });

  return out;
}

/** Maksymalna głębokość preferencji wśród wszystkich kart (długość najdłuższej karty). */
export function maxBallotDepth(papers: BallotEntry[][]): number {
  let m = 0;
  for (const p of papers) m = Math.max(m, p.length);
  return m;
}

export type CandidateStatsRow = CandidateBallotAggregate & {
  round1TableVotes: number | null;
};

/** Łączy statystyki z kart z pierwszą rundą tabeli (kandydaci tylko w tabeli dostają puste karty). */
export function buildCandidateStatsRows(
  papers: BallotEntry[][],
  rounds: Round[],
  elected?: ElectedPerson[],
): CandidateStatsRow[] {
  const r1 = firstRoundVotesByCandidate(rounds);
  const fromBallots = aggregateCandidateBallotStats(papers);
  const seen = new Set(fromBallots.map((c) => c.name));

  const groupFor = (name: string): string =>
    elected?.find((e) => e.name === name)?.group ?? "?";

  const rows: CandidateStatsRow[] = fromBallots.map((c) => ({
    ...c,
    round1TableVotes: r1.has(c.name) ? r1.get(c.name)! : null,
  }));

  for (const [name, votes] of r1) {
    if (seen.has(name)) continue;
    rows.push({
      name,
      group: groupFor(name),
      ballotCount: 0,
      rankCounts: [],
      firstPreferenceCount: 0,
      sumOfRanks: 0,
      meanRank: 0,
      bestRank: 0,
      worstRank: 0,
      round1TableVotes: votes,
    });
  }

  rows.sort((a, b) => {
    if (b.firstPreferenceCount !== a.firstPreferenceCount) {
      return b.firstPreferenceCount - a.firstPreferenceCount;
    }
    return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
  });

  return rows;
}
