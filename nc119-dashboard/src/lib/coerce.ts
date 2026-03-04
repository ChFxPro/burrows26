import type { DashboardData, ElectionNightTopRace, Nc119CountyRow } from '../types';
import { validateDashboardData, type ValidationResult } from './validate';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? value : null;
};

const asString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const asNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const toTitleCase = (value: string): string => {
  return value
    .toLowerCase()
    .split(' ')
    .map((piece) => (piece ? `${piece[0].toUpperCase()}${piece.slice(1)}` : piece))
    .join(' ');
};

const parseTopRaces = (value: unknown): ElectionNightTopRace[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const row = asRecord(item);
      if (!row) {
        return null;
      }

      const race = asString(row.race) ?? `Race ${index + 1}`;
      const leader = asString(row.leader) ?? asString(row.candidate) ?? 'TBD';
      const votes = asNumber(row.votes) ?? asNumber(row.totalVotes) ?? 0;
      const pct = asNumber(row.pct) ?? asNumber(row.percent) ?? 0;

      return {
        race,
        leader,
        votes,
        pct,
      };
    })
    .filter((row): row is ElectionNightTopRace => row !== null);
};

const parseReferenceCountyRows = (value: unknown): Nc119CountyRow[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows = value
    .map((item) => {
      const row = asRecord(item);
      if (!row) {
        return null;
      }

      const countyRaw = asString(row.county);
      const inPersonEarly = asNumber(row.inPersonEarly);
      const civilianMail = asNumber(row.civilianMail);
      const militaryMail = asNumber(row.militaryMail);
      const overseasMail = asNumber(row.overseasMail);
      const total = asNumber(row.total);

      if (
        !countyRaw ||
        inPersonEarly === null ||
        civilianMail === null ||
        militaryMail === null ||
        overseasMail === null ||
        total === null
      ) {
        return null;
      }

      return {
        county: toTitleCase(countyRaw),
        inPersonEarly,
        civilianMail,
        militaryMail,
        overseasMail,
        total,
      };
    })
    .filter((row): row is Nc119CountyRow => row !== null);

  return rows.length > 0 ? rows : null;
};

const buildFromAdvancedReference = (value: unknown): DashboardData | null => {
  const root = asRecord(value);
  if (!root) {
    return null;
  }

  const meta = asRecord(root.meta);
  const statewide = asRecord(root.statewide);
  const party = asRecord(root.party);
  const nc119 = asRecord(root.nc119);

  if (!meta || !statewide || !party || !nc119) {
    return null;
  }

  const statewideBallotsByMethod = asRecord(statewide.ballotsByMethod);
  const comparisonTo2022 = asRecord(asRecord(statewide.comparisonTo2022)?.ballotsCastThisTimeIn2022);
  const electionNightExtension = asRecord(root.electionNightExtension);
  const electionNight = asRecord(electionNightExtension?.electionNight);
  const partyDerived = asRecord(party.derived);
  const provenance = asRecord(meta.provenance);

  if (!statewideBallotsByMethod || !comparisonTo2022) {
    return null;
  }

  const registrationRows = Array.isArray(party.registration)
    ? party.registration
        .map((item) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }

          const partyName = asString(row.party);
          const count = asNumber(row.registered);
          const pct = asNumber(row.registeredPct);

          if (!partyName || count === null || pct === null) {
            return null;
          }

          return { party: partyName, count, pct };
        })
        .filter((row): row is { party: string; count: number; pct: number } => row !== null)
    : [];

  const ballotRows = Array.isArray(party.ballotsCast)
    ? party.ballotsCast
        .map((item) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }

          const partyName = asString(row.party);
          const count = asNumber(row.ballots);
          const sharePct = asNumber(row.ballotSharePct);
          const turnoutPct = asNumber(row.turnoutPctWithinParty);

          if (!partyName || count === null || sharePct === null || turnoutPct === null) {
            return null;
          }

          return { party: partyName, count, sharePct, turnoutPct };
        })
        .filter(
          (row): row is { party: string; count: number; sharePct: number; turnoutPct: number } => row !== null,
        )
    : [];

  const countyRows = parseReferenceCountyRows(nc119.countyRows);
  if (!countyRows || registrationRows.length === 0 || ballotRows.length === 0) {
    return null;
  }

  const sourceAgency = asString(meta.sourceAgency) ?? 'NC State Board of Elections';
  const sourceReportTitle = asString(meta.sourceReportTitle) ?? 'Daily Absentee Stats Report';
  const sourceFileLabel =
    asString(meta.sourceFileLabel) ?? asString(meta.title) ?? '2026-03-03 Daily Absentee Stats Report';

  const fallbackDate = new Date().toISOString().slice(0, 10);
  const publishedDate = asString(meta.publishedDate) ?? fallbackDate;
  const dataThroughDate = asString(meta.dataThroughDate) ?? publishedDate;

  const reportNotes = Array.isArray(provenance?.reportNotes)
    ? provenance.reportNotes.filter((note): note is string => typeof note === 'string')
    : [];

  const derivedNotes = Array.isArray(partyDerived?.notes)
    ? partyDerived.notes.filter((note): note is string => typeof note === 'string')
    : [];

  const ballotsByMethod = [
    { method: 'In-Person Early', count: asNumber(statewideBallotsByMethod.inPersonEarly) ?? 0 },
    { method: 'Civilian Mail', count: asNumber(statewideBallotsByMethod.civilianMail) ?? 0 },
    { method: 'Military Mail', count: asNumber(statewideBallotsByMethod.militaryMail) ?? 0 },
    { method: 'Overseas Mail', count: asNumber(statewideBallotsByMethod.overseasMail) ?? 0 },
  ];

  const transformed: DashboardData = {
    meta: {
      title: 'NC119 Primary Dashboard',
      subtitle: 'Pre-ballot close and election night updates',
      source: `${sourceAgency} - ${sourceReportTitle}`,
      sourceFile: sourceFileLabel,
      lastUpdatedISO: `${publishedDate}T17:00:00-05:00`,
      dataThroughISO: `${dataThroughDate}T23:59:59-05:00`,
      notes: [
        ...reportNotes,
        'NC119 counties: Jackson, Swain, Transylvania.',
        ...derivedNotes.slice(0, 1),
      ],
    },
    statewide: {
      eligibleVoters: asNumber(statewide.eligibleVoters) ?? 0,
      totalBallotsCast: asNumber(statewide.ballotsCastTotal) ?? 0,
      turnoutPct: asNumber(statewide.turnoutPctTotal) ?? 0,
      ballotsByMethod,
      comparison2022: {
        totalAcceptedBallots: asNumber(comparisonTo2022.totalAcceptedBallots) ?? 0,
        earlyVoting: asNumber(comparisonTo2022.earlyVoting) ?? 0,
        mailTotal: asNumber(comparisonTo2022.civilianMilitaryOverseas) ?? 0,
      },
    },
    party: {
      registration: registrationRows,
      ballotsCast: ballotRows,
      minorPartiesNote: derivedNotes[1] ?? 'Minor parties minimal in ballots cast.',
    },
    nc119: {
      districtLabel: asString(nc119.districtLabel) ?? 'NC House District 119',
      counties: countyRows,
    },
    electionNight: {
      enabled: true,
      placeholders: {
        precinctsReportingPct: asNumber(electionNight?.precinctsReportingPct),
        totalVotesSoFar: asNumber(electionNight?.totalVotesSoFar),
        topRaces: parseTopRaces(electionNight?.topRaces),
      },
    },
  };

  return transformed;
};

export const coerceDashboardData = (value: unknown): ValidationResult => {
  const direct = validateDashboardData(value);
  if (direct.ok) {
    return direct;
  }

  const transformed = buildFromAdvancedReference(value);
  if (!transformed) {
    return direct;
  }

  const transformedValidation = validateDashboardData(transformed);
  if (transformedValidation.ok) {
    return transformedValidation;
  }

  return {
    ok: false,
    errors: [...direct.errors, ...transformedValidation.errors],
  };
};
