export type WinPathScenarioKey = 'low' | 'medium' | 'high';

export interface WinPathTurnoutScenarios {
  low: number;
  medium: number;
  high: number;
}

export interface WinPathSupportRates {
  dem: number;
  rep: number;
  una: number;
  other: number;
}

export interface WinPathTurnoutMultipliers {
  dem: number;
  rep: number;
  una: number;
  other: number;
}

export interface WinPathPartyCounts {
  totalActive: number;
  dem: number;
  rep: number;
  una: number;
  other: number;
}

export interface WinPathScenarioProjection {
  scenario: WinPathScenarioKey;
  turnoutRate: number;
  totalActive: number;
  projectedTotalVotes: number;
  votesToWin: number;
  projectedBurrowsVotes: number;
  persuasionVotesNeeded: number;
  winMarginEstimate: number;
  unaffiliatedTurnoutVotes: number;
  requiredExtraFromUnaffiliated: number;
  requiredUnaffiliatedShare: number;
  turnoutVotesByGroup: {
    dem: number;
    rep: number;
    una: number;
    other: number;
  };
  burrowsVotesByGroup: {
    demBaseVotes: number;
    repCrossVotes: number;
    unaVotes: number;
    otherVotes: number;
  };
}

export interface WinPathScenarioInput {
  scenario: WinPathScenarioKey;
  turnoutRate: number;
  partyCounts: WinPathPartyCounts;
  supportRates: WinPathSupportRates;
  turnoutMultipliers: WinPathTurnoutMultipliers;
}

export interface BuildWinPathScenarioInput {
  turnoutScenarios: WinPathTurnoutScenarios;
  partyCounts: WinPathPartyCounts;
  supportRates: WinPathSupportRates;
  turnoutMultipliers: WinPathTurnoutMultipliers;
}

export const WIN_PATH_SCENARIO_LABELS: Record<WinPathScenarioKey, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const DEFAULT_WIN_PATH_TURNOUT_SCENARIOS: WinPathTurnoutScenarios = {
  low: 0.35,
  medium: 0.45,
  high: 0.55,
};

export const DEFAULT_WIN_PATH_SUPPORT_RATES: WinPathSupportRates = {
  dem: 0.95,
  rep: 0.05,
  una: 0.5,
  other: 0.5,
};

export const DEFAULT_WIN_PATH_TURNOUT_MULTIPLIERS: WinPathTurnoutMultipliers = {
  dem: 1,
  rep: 1,
  una: 1,
  other: 1,
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const normalizeCount = (value: number): number => {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

export const splitPartyCounts = (
  byParty: Record<string, number>,
  districtTotal: number,
): WinPathPartyCounts => {
  let dem = 0;
  let rep = 0;
  let una = 0;
  let other = 0;

  Object.entries(byParty).forEach(([partyCode, count]) => {
    const normalizedCount = normalizeCount(count);
    const code = partyCode.toUpperCase();

    if (code === 'DEM') {
      dem += normalizedCount;
      return;
    }

    if (code === 'REP') {
      rep += normalizedCount;
      return;
    }

    if (code === 'UNA') {
      una += normalizedCount;
      return;
    }

    other += normalizedCount;
  });

  const inferredTotal = dem + rep + una + other;
  const totalActive = districtTotal > 0 ? districtTotal : inferredTotal;
  const residual = Math.max(0, totalActive - inferredTotal);

  return {
    totalActive,
    dem,
    rep,
    una,
    other: other + residual,
  };
};

export const projectWinPathScenario = ({
  scenario,
  turnoutRate,
  partyCounts,
  supportRates,
  turnoutMultipliers,
}: WinPathScenarioInput): WinPathScenarioProjection => {
  const turnout = clamp(turnoutRate, 0, 1);
  const demSupport = clamp(supportRates.dem, 0, 1);
  const repSupport = clamp(supportRates.rep, 0, 1);
  const unaSupport = clamp(supportRates.una, 0, 1);
  const otherSupport = clamp(supportRates.other, 0, 1);
  const demTurnoutMult = clamp(turnoutMultipliers.dem, 0, 2);
  const repTurnoutMult = clamp(turnoutMultipliers.rep, 0, 2);
  const unaTurnoutMult = clamp(turnoutMultipliers.una, 0, 2);
  const otherTurnoutMult = clamp(turnoutMultipliers.other, 0, 2);

  const projectedTotalVotes = Math.round(partyCounts.totalActive * turnout);
  const votesToWin = Math.floor(projectedTotalVotes / 2) + 1;

  const demTurnoutVotes = Math.round(partyCounts.dem * turnout * demTurnoutMult);
  const repTurnoutVotes = Math.round(partyCounts.rep * turnout * repTurnoutMult);
  const unaTurnoutVotes = Math.round(partyCounts.una * turnout * unaTurnoutMult);
  const otherTurnoutVotes = Math.round(partyCounts.other * turnout * otherTurnoutMult);

  const demBaseVotes = Math.round(partyCounts.dem * turnout * demTurnoutMult * demSupport);
  const repCrossVotes = Math.round(partyCounts.rep * turnout * repTurnoutMult * repSupport);
  const unaVotes = Math.round(partyCounts.una * turnout * unaTurnoutMult * unaSupport);
  const otherVotes = Math.round(partyCounts.other * turnout * otherTurnoutMult * otherSupport);

  const projectedBurrowsVotes = demBaseVotes + repCrossVotes + unaVotes + otherVotes;
  const persuasionVotesNeeded = Math.max(0, votesToWin - projectedBurrowsVotes);
  const requiredExtraFromUnaffiliated = Math.min(persuasionVotesNeeded, unaTurnoutVotes);
  const requiredUnaffiliatedShare = requiredExtraFromUnaffiliated / Math.max(1, unaTurnoutVotes);
  const winMarginEstimate = projectedBurrowsVotes > votesToWin ? projectedBurrowsVotes - votesToWin : 0;

  return {
    scenario,
    turnoutRate: turnout,
    totalActive: partyCounts.totalActive,
    projectedTotalVotes,
    votesToWin,
    projectedBurrowsVotes,
    persuasionVotesNeeded,
    winMarginEstimate,
    unaffiliatedTurnoutVotes: unaTurnoutVotes,
    requiredExtraFromUnaffiliated,
    requiredUnaffiliatedShare,
    turnoutVotesByGroup: {
      dem: demTurnoutVotes,
      rep: repTurnoutVotes,
      una: unaTurnoutVotes,
      other: otherTurnoutVotes,
    },
    burrowsVotesByGroup: {
      demBaseVotes,
      repCrossVotes,
      unaVotes,
      otherVotes,
    },
  };
};

export const buildWinPathScenarioProjections = ({
  turnoutScenarios,
  partyCounts,
  supportRates,
  turnoutMultipliers,
}: BuildWinPathScenarioInput): Record<WinPathScenarioKey, WinPathScenarioProjection> => {
  const projections = (Object.keys(WIN_PATH_SCENARIO_LABELS) as WinPathScenarioKey[]).reduce<
    Partial<Record<WinPathScenarioKey, WinPathScenarioProjection>>
  >((accumulator, scenario) => {
    accumulator[scenario] = projectWinPathScenario({
      scenario,
      turnoutRate: turnoutScenarios[scenario],
      partyCounts,
      supportRates,
      turnoutMultipliers,
    });

    return accumulator;
  }, {});

  return projections as Record<WinPathScenarioKey, WinPathScenarioProjection>;
};
