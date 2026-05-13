/** 1-based faction index → bar / swatch color. */
export const CANDIDATE_FACTION_COLORS: readonly string[] = [
  "#f48fb1",
  "#64b5f6",
  "#aed581",
  "#ffd54f",
  "#ce93d8",
  "#ffab91",
  "#4dd0e1",
  "#fff59d",
  "#b39ddb",
  "#80cbc4",
  "#ffcc80",
  "#90a4ae",
];

export const CANDIDATE_FACTION_MAX = CANDIDATE_FACTION_COLORS.length;

const STORAGE_PREFIX = "stv-viewer:candidate-factions:v1:";

export const FACTION_NAME_MAX_LEN = 120;

export type CandidateFactionsPersisted = {
  groupCount: number;
  assignments: Record<string, number>;
  /** Klucz "1"… — opcjonalne nazwy frakcji (1-based). */
  factionNames?: Record<string, string>;
};

export type CandidateFactionsState = {
  groupCount: number;
  /** Candidate display name (exact string from raport) → grupa 1…groupCount. */
  assignments: Record<string, number>;
  rememberForFileName: boolean;
  /** Opcjonalna etykieta dla grupy o indeksie 1…groupCount (puste = „Grupa n”). */
  factionNames: Record<number, string>;
};

function storageKey(fileName: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(fileName)}`;
}

export function candidateFactionColor(groupIndex1: number): string {
  const i = groupIndex1 - 1;
  if (i < 0 || i >= CANDIDATE_FACTION_COLORS.length)
    return "rgba(255,255,255,0.25)";
  return CANDIDATE_FACTION_COLORS[i]!;
}

/** Etykieta frakcji: 0 = bez grupy; 1…groupCount z Twoją nazwą lub „Grupa n”. */
export function displayFactionName(
  factionIndex: number,
  factionNames: Record<number, string>,
  groupCount: number,
): string {
  if (factionIndex === 0) return "Bez frakcji";
  if (factionIndex < 1 || factionIndex > groupCount) return `Grupa ${factionIndex}`;
  const custom = factionNames[factionIndex]?.trim();
  if (custom) return custom.slice(0, FACTION_NAME_MAX_LEN);
  return `Grupa ${factionIndex}`;
}

export function loadCandidateFactionsFromStorage(
  fileName: string,
  validNames: Set<string>,
): CandidateFactionsState | null {
  if (!fileName.trim() || validNames.size === 0) return null;
  try {
    const raw = localStorage.getItem(storageKey(fileName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CandidateFactionsPersisted;
    if (
      typeof parsed !== "object" ||
      parsed == null ||
      typeof parsed.groupCount !== "number"
    ) {
      return null;
    }
    const gc = Math.floor(parsed.groupCount);
    if (gc < 1 || gc > CANDIDATE_FACTION_MAX) return null;
    const assignments: Record<string, number> = {};
    const src = parsed.assignments ?? {};
    for (const [name, v] of Object.entries(src)) {
      if (!validNames.has(name)) continue;
      const g = typeof v === "number" ? Math.floor(v) : Number.NaN;
      if (Number.isFinite(g) && g >= 1 && g <= gc) assignments[name] = g;
    }
    const factionNames: Record<number, string> = {};
    const rawNames = parsed.factionNames ?? {};
    for (const [k, v] of Object.entries(rawNames)) {
      const id = Number.parseInt(k, 10);
      if (!Number.isFinite(id) || id < 1 || id > gc) continue;
      if (typeof v !== "string") continue;
      const t = v.trim().slice(0, FACTION_NAME_MAX_LEN);
      if (t) factionNames[id] = t;
    }
    return {
      groupCount: gc,
      assignments,
      rememberForFileName: true,
      factionNames,
    };
  } catch {
    return null;
  }
}

export function saveCandidateFactionsToStorage(
  fileName: string,
  validNames: Set<string>,
  payload: Pick<
    CandidateFactionsState,
    "groupCount" | "assignments" | "factionNames"
  >,
): void {
  if (!fileName.trim()) return;
  const assignments: Record<string, number> = {};
  for (const [name, g] of Object.entries(payload.assignments)) {
    if (!validNames.has(name)) continue;
    if (
      typeof g === "number" &&
      g >= 1 &&
      g <= payload.groupCount
    ) {
      assignments[name] = Math.floor(g);
    }
  }
  const factionNames: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.factionNames ?? {})) {
    const id = Number.parseInt(String(k), 10);
    if (
      !Number.isFinite(id) ||
      id < 1 ||
      id > payload.groupCount
    ) {
      continue;
    }
    const t = String(v).trim().slice(0, FACTION_NAME_MAX_LEN);
    if (t) factionNames[String(id)] = t;
  }
  const body: CandidateFactionsPersisted = {
    groupCount: payload.groupCount,
    assignments,
    factionNames:
      Object.keys(factionNames).length > 0 ? factionNames : undefined,
  };
  try {
    localStorage.setItem(storageKey(fileName), JSON.stringify(body));
  } catch {
    /* quota / private mode */
  }
}

export function clearCandidateFactionsStorage(fileName: string): void {
  if (!fileName.trim()) return;
  try {
    localStorage.removeItem(storageKey(fileName));
  } catch {
    /* ignore */
  }
}

export function pruneCandidateFactionAssignments(
  assignments: Record<string, number>,
  newGroupCount: number,
): Record<string, number> {
  if (newGroupCount < 1) return {};
  const next: Record<string, number> = {};
  for (const [name, g] of Object.entries(assignments)) {
    if (g >= 1 && g <= newGroupCount) next[name] = g;
  }
  return next;
}

export function pruneCandidateFactionNames(
  factionNames: Record<number, string>,
  newGroupCount: number,
): Record<number, string> {
  if (newGroupCount < 1) return {};
  const next: Record<number, string> = {};
  for (const [k, v] of Object.entries(factionNames)) {
    const id = Number.parseInt(k, 10);
    if (!Number.isFinite(id) || id < 1 || id > newGroupCount) continue;
    const t = v.trim().slice(0, FACTION_NAME_MAX_LEN);
    if (t) next[id] = t;
  }
  return next;
}
