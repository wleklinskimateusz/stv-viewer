import type { BallotEntry } from "./stvTypes";
import { factionBucketForCandidate } from "./factionRoundMatrix";

export type BallotFactionTransitionMatrix = {
  /** 1-based indeks pierwszej preferencji w parze. */
  fromRank: number;
  /** 1-based druga preferencja w parze. */
  toRank: number;
  /** matrix[fromF][toF], indeksy 0…groupCount. */
  matrix: number[][];
  /** Liczba kart, na których policzono to przejście (mają co najmniej obie pozycje). */
  totalCounted: number;
  /** Karty za krótkie na ten krok (nie wliczone do macierzy). */
  ballotsSkippedTooShort: number;
};

export function buildBallotFactionTransitionMatrix(
  papers: BallotEntry[][],
  assignments: Record<string, number>,
  groupCount: number,
  /** 0 = między 1. a 2. pozycją, 1 = między 2. a 3., … */
  stepOffset: number,
): BallotFactionTransitionMatrix {
  const width = groupCount + 1;
  const matrix = Array.from({ length: width }, () =>
    new Array<number>(width).fill(0),
  );
  let totalCounted = 0;
  let ballotsSkippedTooShort = 0;
  const fromIdx = stepOffset;
  const toIdx = stepOffset + 1;

  for (const paper of papers) {
    if (paper.length < toIdx + 1) {
      ballotsSkippedTooShort += 1;
      continue;
    }
    const a = paper[fromIdx]?.name ?? "";
    const b = paper[toIdx]?.name ?? "";
    const fa = factionBucketForCandidate(a, assignments, groupCount);
    const fb = factionBucketForCandidate(b, assignments, groupCount);
    matrix[fa]![fb]! += 1;
    totalCounted += 1;
  }

  return {
    fromRank: stepOffset + 1,
    toRank: stepOffset + 2,
    matrix,
    totalCounted,
    ballotsSkippedTooShort,
  };
}

/** Maksymalny sensowny stepOffset (0…), przy braku kart zwraca 0. */
export function maxBallotFactionStepOffset(papers: BallotEntry[][]): number {
  let maxLen = 0;
  for (const p of papers) maxLen = Math.max(maxLen, p.length);
  return Math.max(0, maxLen - 2);
}

export function flattenBallotTransitionMatrix(
  matrix: number[][],
): { fromF: number; toF: number; count: number }[] {
  const out: { fromF: number; toF: number; count: number }[] = [];
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i]!;
    for (let j = 0; j < row.length; j += 1) {
      const c = row[j]!;
      if (c > 0) out.push({ fromF: i, toF: j, count: c });
    }
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}
