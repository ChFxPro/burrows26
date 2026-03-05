export interface Meta {
  datasetId: string;
  sourceFile: string;
  ingestedOn: string;
  counties: string[];
  notes: string;
}

export interface RegistrationPartyValues {
  Democratic: number;
  Republican: number;
  Unaffiliated: number;
  Libertarian: number;
  Constitution: number;
  Green: number;
  'Justice for All': number;
  'No Labels': number;
  'We the People': number;
  Total: number;
}

export interface RegistrationPartyCountyData extends RegistrationPartyValues {
  county: string;
}

export interface RegistrationPartyData {
  recordDate: string;
  byCounty: RegistrationPartyCountyData[];
  totals: RegistrationPartyValues;
  percentOfTotal: RegistrationPartyValues;
}

export interface RegistrationEthnicityValues {
  White: number;
  Black: number;
  'American Indian/ Alaska Native': number;
  Asian: number;
  'Native Hawaiian/ Pacific Islander': number;
  'Multi-racial': number;
  Other: number;
  'Undesig-nated': number;
  Hispanic: number;
  Male: number;
  Female: number;
}

export interface RegistrationEthnicityCountyData extends RegistrationEthnicityValues {
  county: string;
}

export interface RegistrationEthnicityData {
  recordDate: string;
  byCounty: RegistrationEthnicityCountyData[];
  totals: RegistrationEthnicityValues;
}

export interface CandidateVotes {
  Jackson: number;
  Swain: number;
  Transylvania: number;
  NC119: number;
}

export interface CandidateResult {
  name: string;
  votes: CandidateVotes;
}

export interface ContestTotals {
  democratic: CandidateVotes;
  republican: CandidateVotes;
}

export interface PrimaryContest {
  office: string;
  election: 'Primary';
  year: number;
  democraticCandidates: CandidateResult[];
  republicanCandidates: CandidateResult[];
  totals: ContestTotals;
}

export interface GeneralElectionContest {
  office: string;
  election: 'General';
  year: number;
  democraticCandidates: CandidateResult[];
  republicanCandidates: CandidateResult[];
  totals: ContestTotals;
}

export interface Nc119ResearchData {
  meta: Meta;
  registration: {
    byParty: {
      '2024': RegistrationPartyData;
      '2026': RegistrationPartyData;
    };
    byEthnicity: {
      '2026': RegistrationEthnicityData;
    };
  };
  elections: {
    primary: {
      '2024': {
        registeredVoters: number;
        contests: PrimaryContest[];
      };
      '2026': {
        registeredVoters: number;
        contests: PrimaryContest[];
      };
    };
    general: {
      '2024': {
        registeredVoters: number;
        contests: GeneralElectionContest[];
      };
    };
  };
  observations: string[];
}
