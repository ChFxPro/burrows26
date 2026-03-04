import type { DashboardData, PartyBallotRow, PartyRegistrationRow, StatewideBallotMethod } from '../types';

export interface MethodWithPct extends StatewideBallotMethod {
  pct: number;
}

export interface OverUnderRow {
  party: string;
  registrationPct: number;
  ballotSharePct: number;
  overUnderPct: number;
}

export const computeStatewideMethodPct = (data: DashboardData): MethodWithPct[] => {
  const total = data.statewide.totalBallotsCast;
  if (total <= 0) {
    return data.statewide.ballotsByMethod.map((row) => ({ ...row, pct: 0 }));
  }

  return data.statewide.ballotsByMethod.map((row) => ({
    ...row,
    pct: (row.count / total) * 100,
  }));
};

export const compute2022Delta = (data: DashboardData): { delta: number; deltaPct: number } => {
  const current = data.statewide.totalBallotsCast;
  const baseline = data.statewide.comparison2022.totalAcceptedBallots;
  const delta = current - baseline;
  const deltaPct = baseline > 0 ? (delta / baseline) * 100 : 0;

  return { delta, deltaPct };
};

export const computeNc119DistrictTotal = (data: DashboardData): number => {
  return data.nc119.counties.reduce((acc, county) => acc + county.total, 0);
};

export const computeOverUnderIndex = (data: DashboardData): OverUnderRow[] => {
  const registrationByParty = new Map<string, PartyRegistrationRow>();
  data.party.registration.forEach((row) => {
    registrationByParty.set(row.party, row);
  });

  const ballotsByParty = new Map<string, PartyBallotRow>();
  data.party.ballotsCast.forEach((row) => {
    ballotsByParty.set(row.party, row);
  });

  const allParties = new Set([
    ...Array.from(registrationByParty.keys()),
    ...Array.from(ballotsByParty.keys()),
  ]);

  return Array.from(allParties).map((party) => {
    const registration = registrationByParty.get(party);
    const ballots = ballotsByParty.get(party);
    const registrationPct = registration?.pct ?? 0;
    const ballotSharePct = ballots?.sharePct ?? 0;

    return {
      party,
      registrationPct,
      ballotSharePct,
      overUnderPct: ballotSharePct - registrationPct,
    };
  });
};

export const buildPartyComparisonRows = (data: DashboardData): {
  party: string;
  registrationPct: number;
  ballotSharePct: number;
  turnoutPct: number;
}[] => {
  const ballotsByParty = new Map(data.party.ballotsCast.map((row) => [row.party, row]));

  return data.party.registration.map((registration) => {
    const ballots = ballotsByParty.get(registration.party);

    return {
      party: registration.party,
      registrationPct: registration.pct,
      ballotSharePct: ballots?.sharePct ?? 0,
      turnoutPct: ballots?.turnoutPct ?? 0,
    };
  });
};
