export interface Nc119VoterAggregatesMeta {
  generatedAtISO: string;
  sourceFiles: Record<string, string>;
  scope: string;
  filters: Record<string, string>;
  schemaVersion: string;
}

export interface ActiveVotersHd119Counts {
  districtTotal: number;
  byCounty: Record<string, number>;
  byParty: Record<string, number>;
  byCountyParty: Record<string, Record<string, number>>;
}

export interface AgeBandsCounts {
  district: Record<string, number>;
  byCounty: Record<string, Record<string, number>>;
}

export interface PrecinctPartyCounts {
  byCounty: Record<string, Record<string, Record<string, number>>>;
}

export interface Nc119VoterAggregates {
  meta: Nc119VoterAggregatesMeta;
  counts: {
    activeVotersHD119: ActiveVotersHd119Counts;
    ageBands: AgeBandsCounts;
    precinctParty: PrecinctPartyCounts;
  };
}
