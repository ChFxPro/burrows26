import data from '../data/nc119_voter_core_aggregates.v1.json';
import type { Nc119VoterAggregates } from '../types/nc119VoterAggregates';

export const loadNc119VoterAggregates = (): Nc119VoterAggregates => {
  return data as Nc119VoterAggregates;
};
