import type {
  CampaignFinanceReport,
  CampaignId,
  FinanceDataset,
  FinanceQuarter,
  FinanceReceipt,
  FinanceSummaryPeriod,
  QuarterId,
} from './types';
import { validateFinanceDataset, type FinanceValidationResult } from './validators';

export const UNKNOWN_CAMPAIGN_ID = '__manual_campaign__';
export const UNKNOWN_QUARTER_ID = '__manual_quarter__';

const COMMITTEE_NAME_MAP: Record<string, { id: CampaignId; displayName: string }> = {
  'MARK BURROWS FOR NC HOUSE 119': {
    id: 'burrows',
    displayName: 'Mark Burrows',
  },
  'COMMITTEE TO ELECT MIKE CLAMPITT': {
    id: 'clampitt',
    displayName: 'Mike Clampitt',
  },
};

const QUARTER_LABEL_MAP: Record<string, string> = {
  Q1: 'First Quarter',
  Q2: 'Second Quarter',
  Q3: 'Third Quarter',
  Q4: 'Fourth Quarter',
};

const normalizeLookup = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
};

const toIsoSortableDate = (value: string): string => {
  const parsed = parseUsDate(value);
  if (!parsed) {
    return '0000-00-00';
  }

  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
};

export const parseUsDate = (value: string): Date | null => {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const inferCampaignFromCommitteeName = (
  committeeName: string,
): { id: CampaignId; displayName: string } | null => {
  const normalized = normalizeLookup(committeeName);
  return COMMITTEE_NAME_MAP[normalized] ?? null;
};

const inferQuarterNumberFromLabel = (label: string): string | null => {
  const lowered = label.toLowerCase();

  if (/\b(first|1st|q1)\b/.test(lowered)) {
    return 'Q1';
  }
  if (/\b(second|2nd|q2)\b/.test(lowered)) {
    return 'Q2';
  }
  if (/\b(third|3rd|q3)\b/.test(lowered)) {
    return 'Q3';
  }
  if (/\b(fourth|4th|q4)\b/.test(lowered)) {
    return 'Q4';
  }

  return null;
};

export const buildQuarterLabel = (quarterId: QuarterId): string => {
  const match = /^(\d{4})-(Q[1-4])$/i.exec(quarterId);
  if (!match) {
    return quarterId;
  }

  return `${match[1]} ${QUARTER_LABEL_MAP[match[2].toUpperCase()]}`;
};

export const inferQuarterId = (params: {
  label?: string;
  dateFrom?: string;
  dateTo?: string;
  dateFiled?: string;
}): QuarterId | null => {
  const label = params.label?.trim() ?? '';
  const yearMatch = /(\d{4})/.exec(label);
  const quarterNumber = label ? inferQuarterNumberFromLabel(label) : null;

  if (yearMatch && quarterNumber) {
    return `${yearMatch[1]}-${quarterNumber}`;
  }

  const fromDate = params.dateFrom ? parseUsDate(params.dateFrom) : null;
  const toDate = params.dateTo ? parseUsDate(params.dateTo) : null;
  const filedDate = params.dateFiled ? parseUsDate(params.dateFiled) : null;
  const referenceDate = toDate ?? fromDate ?? filedDate;

  if (!referenceDate) {
    return null;
  }

  const quarterIndex = Math.floor(referenceDate.getMonth() / 3) + 1;
  return `${referenceDate.getFullYear()}-Q${quarterIndex}`;
};

export const buildQuarterFromReport = (report: CampaignFinanceReport): FinanceQuarter => {
  return {
    id: report.report.quarterId,
    label: report.report.label,
    dateFrom: report.report.dateFrom,
    dateTo: report.report.dateTo,
    dateFiled: report.report.dateFiled,
  };
};

export const createEmptyFinanceDataset = (datasetVersion = 'nc119-finance-empty-v1'): FinanceDataset => {
  return {
    datasetVersion,
    quarters: [],
    campaigns: [],
  };
};

const reportSortValue = (report: CampaignFinanceReport): string => {
  return `${toIsoSortableDate(report.report.dateTo)}-${report.displayName.toLowerCase()}`;
};

const quarterSortValue = (quarter: FinanceQuarter): string => {
  return `${toIsoSortableDate(quarter.dateTo)}-${quarter.id}`;
};

export const sortFinanceDataset = (dataset: FinanceDataset): FinanceDataset => {
  return {
    ...dataset,
    quarters: [...dataset.quarters].sort((left, right) => quarterSortValue(right).localeCompare(quarterSortValue(left))),
    campaigns: [...dataset.campaigns].sort((left, right) => reportSortValue(right).localeCompare(reportSortValue(left))),
  };
};

export const getMostRecentQuarterId = (dataset: FinanceDataset): QuarterId | null => {
  const [latestQuarter] = sortFinanceDataset(dataset).quarters;
  return latestQuarter?.id ?? null;
};

const dedupeQuarters = (quarters: FinanceQuarter[]): FinanceQuarter[] => {
  const byId = new Map<string, FinanceQuarter>();
  quarters.forEach((quarter) => {
    byId.set(quarter.id, quarter);
  });
  return [...byId.values()];
};

const reportKey = (report: CampaignFinanceReport): string => {
  return `${report.id}::${report.report.quarterId}`;
};

export const mergeFinanceDatasets = (base: FinanceDataset, incoming: FinanceDataset): FinanceDataset => {
  const quarterMap = new Map<string, FinanceQuarter>();
  dedupeQuarters([...base.quarters, ...incoming.quarters]).forEach((quarter) => {
    quarterMap.set(quarter.id, quarter);
  });

  const reportMap = new Map<string, CampaignFinanceReport>();
  base.campaigns.forEach((report) => {
    reportMap.set(reportKey(report), report);
  });
  incoming.campaigns.forEach((report) => {
    reportMap.set(reportKey(report), report);
    quarterMap.set(report.report.quarterId, buildQuarterFromReport(report));
  });

  return sortFinanceDataset({
    datasetVersion: incoming.campaigns.length > 0 ? `${base.datasetVersion}+runtime` : base.datasetVersion,
    quarters: [...quarterMap.values()],
    campaigns: [...reportMap.values()],
  });
};

export const normalizeJsonFinanceDataset = (value: unknown): FinanceValidationResult<FinanceDataset> => {
  const validation = validateFinanceDataset(value);
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    data: sortFinanceDataset(validation.data),
  };
};

export const finalizeCsvReport = (
  report: CampaignFinanceReport,
  quarter: FinanceQuarter,
  overrides?: {
    campaignId?: CampaignId;
    displayName?: string;
    quarterId?: QuarterId;
    quarterLabel?: string;
    dateFrom?: string;
    dateTo?: string;
    dateFiled?: string;
  },
): { report: CampaignFinanceReport; quarter: FinanceQuarter } => {
  const resolvedCampaignId = overrides?.campaignId?.trim() || report.id;
  const resolvedQuarterId = overrides?.quarterId?.trim() || quarter.id;
  const resolvedQuarterLabel =
    overrides?.quarterLabel?.trim() ||
    quarter.label ||
    (resolvedQuarterId !== UNKNOWN_QUARTER_ID ? buildQuarterLabel(resolvedQuarterId) : quarter.label);
  const resolvedDateFrom = overrides?.dateFrom?.trim() || quarter.dateFrom;
  const resolvedDateTo = overrides?.dateTo?.trim() || quarter.dateTo;
  const resolvedDateFiled = overrides?.dateFiled?.trim() || quarter.dateFiled;

  const nextQuarter: FinanceQuarter = {
    id: resolvedQuarterId,
    label: resolvedQuarterLabel,
    dateFrom: resolvedDateFrom,
    dateTo: resolvedDateTo,
    dateFiled: resolvedDateFiled,
  };

  const nextReport: CampaignFinanceReport = {
    ...report,
    id: resolvedCampaignId,
    displayName: overrides?.displayName?.trim() || report.displayName,
    report: {
      ...report.report,
      quarterId: resolvedQuarterId,
      label: resolvedQuarterLabel,
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      dateFiled: resolvedDateFiled,
    },
  };

  return {
    report: nextReport,
    quarter: nextQuarter,
  };
};

export const buildDatasetFromCsvReport = (
  report: CampaignFinanceReport,
  quarter: FinanceQuarter,
  datasetVersion: string,
): FinanceDataset => {
  return sortFinanceDataset({
    datasetVersion,
    quarters: [quarter],
    campaigns: [report],
  });
};

const sumBy = <T>(rows: T[], accessor: (row: T) => number): number => {
  return rows.reduce((sum, row) => sum + accessor(row), 0);
};

export const buildSummaryPeriodFromTransactions = (
  receipts: FinanceReceipt[],
  expenditures: Array<{ amount: number; expenditureType: string }>,
  overrides?: Partial<FinanceSummaryPeriod>,
): FinanceSummaryPeriod => {
  const individualContributions = sumBy(
    receipts.filter((receipt) => !receipt.aggregate && /individual/i.test(receipt.receiptType)),
    (receipt) => receipt.amount,
  );
  const aggregatedIndividual = sumBy(
    receipts.filter((receipt) => receipt.aggregate),
    (receipt) => receipt.amount,
  );
  const partyCommittees = sumBy(
    receipts.filter((receipt) => /party committee/i.test(receipt.receiptType)),
    (receipt) => receipt.amount,
  );
  const otherPoliticalCommittees = sumBy(
    receipts.filter((receipt) => /political committee/i.test(receipt.receiptType)),
    (receipt) => receipt.amount,
  );
  const outsideSourcesIncome = sumBy(
    receipts.filter((receipt) => /outside/i.test(receipt.receiptType)),
    (receipt) => receipt.amount,
  );
  const operatingExpenditures = sumBy(
    expenditures.filter((row) => /operating/i.test(row.expenditureType)),
    (row) => row.amount,
  );
  const contributionsToCommittees = sumBy(
    expenditures.filter((row) => /committee/i.test(row.expenditureType)),
    (row) => row.amount,
  );

  const totalReceipts = sumBy(receipts, (receipt) => receipt.amount);
  const totalExpenditures = sumBy(expenditures, (row) => row.amount);

  return {
    cashOnHandBeginning: overrides?.cashOnHandBeginning ?? 0,
    aggregatedIndividual: overrides?.aggregatedIndividual ?? aggregatedIndividual,
    individualContributions: overrides?.individualContributions ?? individualContributions,
    partyCommittees: overrides?.partyCommittees ?? partyCommittees,
    otherPoliticalCommittees: overrides?.otherPoliticalCommittees ?? otherPoliticalCommittees,
    outsideSourcesIncome: overrides?.outsideSourcesIncome ?? outsideSourcesIncome,
    inKindContributions: overrides?.inKindContributions ?? 0,
    totalReceipts: overrides?.totalReceipts ?? totalReceipts,
    operatingExpenditures: overrides?.operatingExpenditures ?? operatingExpenditures,
    aggregatedNonMediaExpenditures: overrides?.aggregatedNonMediaExpenditures ?? 0,
    contributionsToCommittees: overrides?.contributionsToCommittees ?? contributionsToCommittees,
    totalExpenditures: overrides?.totalExpenditures ?? totalExpenditures,
    cashOnHandEnding: overrides?.cashOnHandEnding ?? 0,
    debtOwedByCommittee: overrides?.debtOwedByCommittee ?? 0,
    outstandingLoans: overrides?.outstandingLoans ?? 0,
  };
};

