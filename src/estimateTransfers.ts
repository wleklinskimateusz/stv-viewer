import type { Round } from './stvTypes';

export type VoteDelta = {
  candidate: string;
  prevVotes: number | null;
  nextVotes: number | null;
  /** next − prev (positive = gained votes in the table). */
  delta: number;
};

export type TransferLink = {
  source: string;
  target: string;
  value: number;
};

export type RoundTransitionModel = {
  fromRound: number;
  toRound: number;
  deltas: VoteDelta[];
  /** Proportional bipartite estimate — not official per-ballot transfers. */
  links: TransferLink[];
  totalOut: number;
  totalIn: number;
  omittedLinkMass: number;
  /** Stacks for drawing (kandydaci tylko — bez salda). */
  sourceNodes: { id: string; w: number }[];
  targetNodes: { id: string; w: number }[];
};

function votesMap(round: Round): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of round.rows) m.set(r.candidate, r.votes);
  return m;
}

export function estimateTransition(from: Round, to: Round): RoundTransitionModel {
  const A = votesMap(from);
  const B = votesMap(to);
  const names = [...new Set([...A.keys(), ...B.keys()])].sort((a, b) =>
    a.localeCompare(b, 'pl', { sensitivity: 'base' }),
  );

  const deltas: VoteDelta[] = names.map((candidate) => {
    const hasP = A.has(candidate);
    const hasN = B.has(candidate);
    const prevVotes = hasP ? A.get(candidate)! : null;
    const nextVotes = hasN ? B.get(candidate)! : null;
    const p = prevVotes ?? 0;
    const n = nextVotes ?? 0;
    return { candidate, prevVotes, nextVotes, delta: n - p };
  });

  const sources: { id: string; w: number }[] = [];
  const targets: { id: string; w: number }[] = [];
  const eps = 1e-8;

  for (const d of deltas) {
    const p = d.prevVotes ?? 0;
    const n = d.nextVotes ?? 0;
    const out = Math.max(0, p - n);
    const inn = Math.max(0, n - p);
    if (out > eps) sources.push({ id: d.candidate, w: out });
    if (inn > eps) targets.push({ id: d.candidate, w: inn });
  }

  const L0 = sources.reduce((s, x) => s + x.w, 0);
  const G0 = targets.reduce((s, x) => s + x.w, 0);

  if (L0 <= eps && G0 <= eps) {
    return {
      fromRound: from.number,
      toRound: to.number,
      deltas,
      links: [],
      totalOut: 0,
      totalIn: 0,
      omittedLinkMass: 0,
      sourceNodes: [],
      targetNodes: [],
    };
  }

  /** Rozdział proporcjonalny bez węzłów salda: wiersze sumują się do out_i przy mianowniku G0 (suma zysków). */
  const denom = G0 > eps ? G0 : L0 > eps ? L0 : eps;

  const raw: TransferLink[] = [];
  for (const s of sources) {
    for (const t of targets) {
      const value = (s.w * t.w) / denom;
      if (value > 1e-10) raw.push({ source: s.id, target: t.id, value });
    }
  }

  raw.sort((a, b) => b.value - a.value);

  const minKeep = Math.max(0.04, 0.008 * denom);
  const links: TransferLink[] = [];
  let omitted = 0;
  for (const l of raw) {
    if (l.value >= minKeep) links.push(l);
    else omitted += l.value;
  }

  return {
    fromRound: from.number,
    toRound: to.number,
    deltas,
    links,
    totalOut: L0,
    totalIn: G0,
    omittedLinkMass: omitted,
    sourceNodes: sources.map((s) => ({ ...s })),
    targetNodes: targets.map((t) => ({ ...t })),
  };
}

export function buildConsecutiveTransitions(rounds: Round[]): RoundTransitionModel[] {
  const sorted = [...rounds].sort((a, b) => a.number - b.number);
  const out: RoundTransitionModel[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    out.push(estimateTransition(sorted[i]!, sorted[i + 1]!));
  }
  return out;
}
