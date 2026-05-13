export type StvMeta = Record<string, string>;

export type ElectedPerson = {
  name: string;
  group: string;
};

export type RoundRow = {
  candidate: string;
  votes: number;
  tie: boolean;
  action: string;
};

export type Round = {
  number: number;
  rows: RoundRow[];
};

export type BallotEntry = {
  name: string;
  group: string;
};

export type ParsedStvReport = {
  meta: StvMeta;
  elected: ElectedPerson[];
  rounds: Round[];
  /** Pierwsza karta (dla kompatybilności z UI przykładu). */
  ballots: BallotEntry[];
  /** Każda niepusta linia pod „Karty do głosowania” = jedna odczytana karta (kolejność preferencji). */
  ballotPapers: BallotEntry[][];
};
