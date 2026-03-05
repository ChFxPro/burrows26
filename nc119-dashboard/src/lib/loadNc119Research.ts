import data from '../data/nc119_voter_election_result_analysis.v1.json';
import type { Nc119ResearchData } from '../types/nc119Research';

export function loadNc119Research() {
  return data as Nc119ResearchData;
}
