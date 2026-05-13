import type { Round } from "./stvTypes";
import {
  buildConsecutiveTransitions,
  type RoundTransitionModel,
} from "./estimateTransfers";

/** 0 = brak przypisanej frakcji; 1…groupCount = grupa. */
export function factionBucketForCandidate(
  name: string,
  assignments: Record<string, number>,
  groupCount: number,
): number {
  const g = assignments[name];
  if (g == null || g < 1 || g > groupCount) return 0;
  return g;
}

export type FactionVoteMatrixRow = {
  roundNumber: number;
  /** Indeks 0 = bez przypisanej frakcji; 1…groupCount = grupy. */
  byFaction: number[];
  grandTotal: number;
};

export function buildFactionVoteMatrix(
  rounds: Round[],
  assignments: Record<string, number>,
  groupCount: number,
): FactionVoteMatrixRow[] {
  const width = groupCount + 1;
  const sorted = [...rounds].sort((a, b) => a.number - b.number);
  return sorted.map((round) => {
    const byFaction = new Array<number>(width).fill(0);
    let grandTotal = 0;
    for (const row of round.rows) {
      const v = row.votes;
      grandTotal += v;
      const k = factionBucketForCandidate(row.candidate, assignments, groupCount);
      byFaction[k] += v;
    }
    return { roundNumber: round.number, byFaction, grandTotal };
  });
}

export type FactionDeltaRow = {
  fromRound: number;
  toRound: number;
  /** Zmiana „masy głosów” w tabeli dla każdej frakcji (to − from). */
  deltaByFaction: number[];
};

export function buildFactionVoteDeltas(
  matrix: FactionVoteMatrixRow[],
): FactionDeltaRow[] {
  const out: FactionDeltaRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const prev = matrix[i - 1]!;
    const cur = matrix[i]!;
    const deltaByFaction = cur.byFaction.map((v, j) => v - prev.byFaction[j]!);
    out.push({
      fromRound: prev.roundNumber,
      toRound: cur.roundNumber,
      deltaByFaction,
    });
  }
  return out;
}

export type FactionPairRollup = {
  fromRound: number;
  toRound: number;
  pairs: { fromF: number; toF: number; value: number }[];
};

export function rollupFactionLinksFromTransitions(
  transitions: RoundTransitionModel[],
  assignments: Record<string, number>,
  groupCount: number,
): FactionPairRollup[] {
  const key = (name: string) =>
    factionBucketForCandidate(name, assignments, groupCount);

  return transitions.map((m) => {
    const acc = new Map<string, number>();
    for (const l of m.links) {
      const a = key(l.source);
      const b = key(l.target);
      const k = `${a}|${b}`;
      acc.set(k, (acc.get(k) ?? 0) + l.value);
    }
    const pairs: FactionPairRollup["pairs"] = [];
    for (const [k, value] of acc) {
      const [fa, fb] = k.split("|").map((x) => Number.parseInt(x, 10));
      if (value > 1e-12) pairs.push({ fromF: fa!, toF: fb!, value });
    }
    pairs.sort((a, b) => b.value - a.value);
    return {
      fromRound: m.fromRound,
      toRound: m.toRound,
      pairs,
    };
  });
}

export function buildFactionPairRollups(
  rounds: Round[],
  assignments: Record<string, number>,
  groupCount: number,
): FactionPairRollup[] {
  const transitions = buildConsecutiveTransitions(rounds);
  return rollupFactionLinksFromTransitions(
    transitions,
    assignments,
    groupCount,
  );
}
