import type { BallotEntry, ElectedPerson, ParsedStvReport, Round, RoundRow, StvMeta } from './stvTypes';

function splitKeyValue(line: string): [string, string] | null {
  const i = line.indexOf(',');
  if (i === -1) return null;
  return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
}

function parseRoundRow(line: string): RoundRow | null {
  const parts = line.split(',');
  if (parts.length < 4) return null;
  const candidate = parts[0]?.trim() ?? '';
  const votesRaw = parts[1]?.trim() ?? '';
  const remis = parts[2]?.trim() ?? '';
  const action = parts.slice(3).join(',').trim();
  const votes = Number.parseFloat(votesRaw.replace(',', '.'));
  if (!candidate || Number.isNaN(votes)) return null;
  return {
    candidate,
    votes,
    tie: remis.toUpperCase() === 'TAK',
    action,
  };
}

function parseBallotsLine(line: string): BallotEntry[] {
  const entries: BallotEntry[] = [];
  const chunks = line.split(',').map((s) => s.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const colon = chunk.lastIndexOf(':');
    if (colon === -1) continue;
    const name = chunk.slice(0, colon).trim();
    const group = chunk.slice(colon + 1).trim();
    if (name) entries.push({ name, group });
  }
  return entries;
}

export function parseStvReport(raw: string): ParsedStvReport {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '...');

  const meta: StvMeta = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line === 'Wybrano,Grupy') break;
    if (line === '') {
      i += 1;
      continue;
    }
    const kv = splitKeyValue(line);
    if (kv) {
      const [k, v] = kv;
      meta[k] = v;
    }
    i += 1;
  }

  const elected: ElectedPerson[] = [];
  if (i < lines.length && lines[i] === 'Wybrano,Grupy') {
    i += 1;
    while (i < lines.length) {
      const line = lines[i]!;
      if (line.startsWith('Runda ')) break;
      if (line === '') {
        i += 1;
        continue;
      }
      if (line === 'Karty do głosowania') break;
      const kv = splitKeyValue(line);
      if (kv && kv[0] && kv[1]) elected.push({ name: kv[0], group: kv[1] });
      i += 1;
    }
  }

  const rounds: Round[] = [];
  while (i < lines.length) {
    const line = lines[i]!;
    if (line === 'Karty do głosowania') break;

    const roundMatch = /^Runda\s+(\d+)\s*$/i.exec(line);
    if (!roundMatch) {
      i += 1;
      continue;
    }
    const number = Number.parseInt(roundMatch[1]!, 10);
    i += 1;
    if (i < lines.length && lines[i]!.includes('Osoba kandydująca')) i += 1;

    const rows: RoundRow[] = [];
    while (i < lines.length) {
      const rowLine = lines[i]!;
      if (rowLine.startsWith('Runda ') || rowLine === 'Karty do głosowania') break;
      if (rowLine === '') {
        i += 1;
        continue;
      }
      const row = parseRoundRow(rowLine);
      if (row) rows.push(row);
      i += 1;
    }
    if (rows.length > 0) rounds.push({ number, rows });
  }

  const ballotPapers: BallotEntry[][] = [];
  if (i < lines.length && lines[i] === 'Karty do głosowania') {
    i += 1;
    while (i < lines.length) {
      const rawLine = lines[i]!;
      if (rawLine === '') {
        i += 1;
        continue;
      }
      if (/^Runda\s+\d+/i.test(rawLine)) break;
      const entries = parseBallotsLine(rawLine);
      if (entries.length > 0) ballotPapers.push(entries);
      i += 1;
    }
  }
  const ballots = ballotPapers[0] ?? [];

  return { meta, elected, rounds, ballots, ballotPapers };
}

export function actionLabel(action: string): 'elected' | 'eliminated' | 'none' {
  const a = action.trim();
  if (a === 'None' || a === '') return 'none';
  if (/wybierz/i.test(a)) return 'elected';
  if (/elimin|odpad|usuń|reject/i.test(a)) return 'eliminated';
  return 'none';
}

/** Returns an error message if the text does not look like a ZEUS STV export, otherwise null. */
export function validateStvReportText(raw: string, parsed: ParsedStvReport): string | null {
  const t = raw.trim();
  if (!t) return 'Plik jest pusty.';
  const hasMarkers =
    /Wybrano\s*,\s*Grupy/i.test(t) || /^Runda\s+\d+/im.test(t) || /\nRunda\s+\d+/i.test(t);
  if (!hasMarkers) {
    return 'Brak rozpoznawalnej struktury (oczekiwane m.in. wiersz „Wybrano,Grupy” lub sekcje „Runda …”).';
  }
  if (parsed.elected.length === 0 && parsed.rounds.length === 0) {
    return 'Nie udało się odczytać wybranych ani rund — sprawdź kodowanie (UTF-8) i format wierszy.';
  }
  return null;
}
