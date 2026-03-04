export interface DashboardMeta {
  title: string;
  subtitle: string;
  source: string;
  sourceFile: string;
  lastUpdatedISO: string;
  dataThroughISO: string;
  notes: string[];
}

export interface StatewideBallotMethod {
  method: string;
  count: number;
}

export interface StatewideComparison2022 {
  totalAcceptedBallots: number;
  earlyVoting: number;
  mailTotal: number;
}

export interface StatewideData {
  eligibleVoters: number;
  totalBallotsCast: number;
  turnoutPct: number;
  ballotsByMethod: StatewideBallotMethod[];
  comparison2022: StatewideComparison2022;
}

export interface PartyRegistrationRow {
  party: string;
  count: number;
  pct: number;
}

export interface PartyBallotRow {
  party: string;
  count: number;
  sharePct: number;
  turnoutPct: number;
}

export interface PartyData {
  registration: PartyRegistrationRow[];
  ballotsCast: PartyBallotRow[];
  minorPartiesNote: string;
}

export interface Nc119CountyRow {
  county: string;
  inPersonEarly: number;
  civilianMail: number;
  militaryMail: number;
  overseasMail: number;
  total: number;
}

export interface Nc119Data {
  districtLabel: string;
  counties: Nc119CountyRow[];
}

export interface ElectionNightTopRace {
  race: string;
  leader: string;
  votes: number;
  pct: number;
}

export interface ElectionNightPlaceholders {
  precinctsReportingPct: number | null;
  totalVotesSoFar: number | null;
  topRaces: ElectionNightTopRace[];
}

export interface ElectionNightData {
  enabled: boolean;
  placeholders: ElectionNightPlaceholders;
}

export interface DashboardData {
  meta: DashboardMeta;
  statewide: StatewideData;
  party: PartyData;
  nc119: Nc119Data;
  electionNight: ElectionNightData;
}
