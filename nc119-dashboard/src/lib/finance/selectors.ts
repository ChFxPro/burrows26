import type {
  CampaignFinanceReport,
  CampaignId,
  FinanceDataset,
  FinanceDonorTotal,
  FinanceExpenditure,
  FinanceExpenditureMetrics,
  FinanceMetricComparisonRow,
  FinanceReceipt,
  FinanceReceiptMetrics,
  FinanceToplineCampaignMetrics,
  FinanceToplineComparison,
  FinanceTrendMetricKey,
  FinanceTrendSeriesPoint,
  FinanceVendorTotal,
  QuarterId,
} from './types';

const toSortableDateKey = (value: string): string => {
  const [month = '00', day = '00', year = '0000'] = value.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const sortQuarterDescending = (
  left: { dateTo: string; id: string },
  right: { dateTo: string; id: string },
): number => {
  const leftKey = toSortableDateKey(left.dateTo);
  const rightKey = toSortableDateKey(right.dateTo);
  return rightKey.localeCompare(leftKey) || right.id.localeCompare(left.id);
};

const sortQuarterAscending = (
  left: { dateTo: string; id: string },
  right: { dateTo: string; id: string },
): number => {
  return sortQuarterDescending(right, left);
};

const normalizeNameKey = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
};

const sumBy = <T>(rows: T[], accessor: (row: T) => number): number => {
  return rows.reduce((sum, row) => sum + accessor(row), 0);
};

const roundTo = (value: number, decimals = 2): number => {
  const precision = 10 ** decimals;
  return Math.round(value * precision) / precision;
};

const isNamedReceipt = (receipt: FinanceReceipt): boolean => {
  return !receipt.aggregate && receipt.name.trim().length > 0 && !/^aggregated /i.test(receipt.name);
};

const toToplineMetrics = (report: CampaignFinanceReport): FinanceToplineCampaignMetrics => {
  const { summaryPeriod } = report;

  return {
    totalReceipts: summaryPeriod.totalReceipts,
    totalExpenditures: summaryPeriod.totalExpenditures,
    cashOnHandEnding: summaryPeriod.cashOnHandEnding,
    cashOnHandBeginning: summaryPeriod.cashOnHandBeginning,
    netCashChange: summaryPeriod.cashOnHandEnding - summaryPeriod.cashOnHandBeginning,
    burnRate:
      summaryPeriod.totalReceipts > 0
        ? summaryPeriod.totalExpenditures / summaryPeriod.totalReceipts
        : 0,
    individualContributions: summaryPeriod.individualContributions,
    pacOtherPoliticalCommitteeContributions:
      summaryPeriod.partyCommittees + summaryPeriod.otherPoliticalCommittees,
    outsideSourcesIncome: summaryPeriod.outsideSourcesIncome,
    inKindContributions: summaryPeriod.inKindContributions,
    debtOwedByCommittee: summaryPeriod.debtOwedByCommittee,
    outstandingLoans: summaryPeriod.outstandingLoans,
  };
};

type ComparisonMetricConfig = {
  key: keyof FinanceToplineCampaignMetrics;
  label: string;
  direction: 'higher' | 'lower';
};

const COMPARISON_METRICS: ComparisonMetricConfig[] = [
  { key: 'totalReceipts', label: 'Total Receipts', direction: 'higher' },
  { key: 'totalExpenditures', label: 'Total Expenditures', direction: 'lower' },
  { key: 'cashOnHandEnding', label: 'Cash on Hand Ending', direction: 'higher' },
  { key: 'cashOnHandBeginning', label: 'Cash on Hand Beginning', direction: 'higher' },
  { key: 'netCashChange', label: 'Net Cash Change', direction: 'higher' },
  { key: 'burnRate', label: 'Burn Rate', direction: 'lower' },
  { key: 'individualContributions', label: 'Individual Contributions', direction: 'higher' },
  {
    key: 'pacOtherPoliticalCommitteeContributions',
    label: 'PAC / Other Political Committee Contributions',
    direction: 'higher',
  },
  { key: 'outsideSourcesIncome', label: 'Outside Sources of Income', direction: 'higher' },
  { key: 'inKindContributions', label: 'In-Kind Contributions', direction: 'higher' },
  { key: 'debtOwedByCommittee', label: 'Debt Owed by Committee', direction: 'lower' },
  { key: 'outstandingLoans', label: 'Outstanding Loans', direction: 'lower' },
];

const compareMetric = (
  metric: ComparisonMetricConfig,
  burrows: FinanceToplineCampaignMetrics | null,
  clampitt: FinanceToplineCampaignMetrics | null,
): FinanceMetricComparisonRow => {
  const burrowsValue = burrows?.[metric.key] ?? null;
  const clampittValue = clampitt?.[metric.key] ?? null;

  if (burrowsValue === null || clampittValue === null) {
    return {
      key: metric.key,
      label: metric.label,
      burrows: burrowsValue,
      clampitt: clampittValue,
      difference: null,
      advantage: 'n/a',
      direction: metric.direction,
    };
  }

  const difference = roundTo(burrowsValue - clampittValue, 4);
  let advantage: FinanceMetricComparisonRow['advantage'] = 'tie';

  if (Math.abs(difference) > 0.0001) {
    if (metric.direction === 'higher') {
      advantage = difference > 0 ? 'burrows' : 'clampitt';
    } else {
      advantage = difference < 0 ? 'burrows' : 'clampitt';
    }
  }

  return {
    key: metric.key,
    label: metric.label,
    burrows: burrowsValue,
    clampitt: clampittValue,
    difference,
    advantage,
    direction: metric.direction,
  };
};

export const getQuarterOptions = (dataset: FinanceDataset) => {
  return [...dataset.quarters].sort(sortQuarterDescending);
};

export const getReportsForQuarter = (dataset: FinanceDataset, quarterId: QuarterId): CampaignFinanceReport[] => {
  return dataset.campaigns
    .filter((report) => report.report.quarterId === quarterId)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
};

export const getCampaignReport = (
  dataset: FinanceDataset,
  campaignId: CampaignId,
  quarterId: QuarterId,
): CampaignFinanceReport | null => {
  return dataset.campaigns.find((report) => report.id === campaignId && report.report.quarterId === quarterId) ?? null;
};

export const getToplineComparison = (dataset: FinanceDataset, quarterId: QuarterId): FinanceToplineComparison => {
  const burrowsReport = getCampaignReport(dataset, 'burrows', quarterId);
  const clampittReport = getCampaignReport(dataset, 'clampitt', quarterId);
  const burrows = burrowsReport ? toToplineMetrics(burrowsReport) : null;
  const clampitt = clampittReport ? toToplineMetrics(clampittReport) : null;

  return {
    quarterId,
    burrows,
    clampitt,
    receiptsAdvantage:
      burrows && clampitt ? roundTo(burrows.totalReceipts - clampitt.totalReceipts) : null,
    cashOnHandAdvantage:
      burrows && clampitt ? roundTo(burrows.cashOnHandEnding - clampitt.cashOnHandEnding) : null,
    rows: COMPARISON_METRICS.map((metric) => compareMetric(metric, burrows, clampitt)),
  };
};

export const getReceiptMetrics = (report: CampaignFinanceReport | null): FinanceReceiptMetrics => {
  if (!report) {
    return {
      totalReceiptTransactions: 0,
      totalReceiptAmount: 0,
      aggregateReceiptAmount: 0,
      nonAggregateReceiptAmount: 0,
      uniqueNamedDonorsCount: 0,
      inStateReceiptAmount: 0,
      outOfStateReceiptAmount: 0,
      largestSingleReceipt: 0,
      averageNamedReceipt: 0,
      averageAllReceipt: 0,
    };
  }

  const totalReceiptAmount = sumBy(report.receipts, (receipt) => receipt.amount);
  const aggregateReceiptAmount = sumBy(
    report.receipts.filter((receipt) => receipt.aggregate),
    (receipt) => receipt.amount,
  );
  const nonAggregateReceipts = report.receipts.filter((receipt) => !receipt.aggregate);
  const namedReceipts = nonAggregateReceipts.filter(isNamedReceipt);
  const namedDonors = new Set(namedReceipts.map((receipt) => normalizeNameKey(receipt.name)));

  return {
    totalReceiptTransactions: report.receipts.length,
    totalReceiptAmount,
    aggregateReceiptAmount,
    nonAggregateReceiptAmount: totalReceiptAmount - aggregateReceiptAmount,
    uniqueNamedDonorsCount: namedDonors.size,
    inStateReceiptAmount: sumBy(
      report.receipts.filter((receipt) => receipt.state.trim().toUpperCase() === 'NC'),
      (receipt) => receipt.amount,
    ),
    outOfStateReceiptAmount: sumBy(
      report.receipts.filter((receipt) => {
        const normalizedState = receipt.state.trim().toUpperCase();
        return normalizedState.length > 0 && normalizedState !== 'NC';
      }),
      (receipt) => receipt.amount,
    ),
    largestSingleReceipt: report.receipts.reduce((max, receipt) => Math.max(max, receipt.amount), 0),
    averageNamedReceipt: namedReceipts.length > 0 ? totalNamedAmount(namedReceipts) / namedReceipts.length : 0,
    averageAllReceipt: report.receipts.length > 0 ? totalReceiptAmount / report.receipts.length : 0,
  };
};

const totalNamedAmount = (receipts: FinanceReceipt[]): number => {
  return sumBy(receipts, (receipt) => receipt.amount);
};

export const getTopDonors = (report: CampaignFinanceReport | null, limit = 5): FinanceDonorTotal[] => {
  if (!report) {
    return [];
  }

  const donorMap = new Map<string, FinanceDonorTotal>();

  report.receipts.filter(isNamedReceipt).forEach((receipt) => {
    const key = normalizeNameKey(receipt.name);
    const current = donorMap.get(key);
    if (current) {
      current.amount += receipt.amount;
      current.transactionCount += 1;
      return;
    }

    donorMap.set(key, {
      name: receipt.name,
      city: receipt.city,
      state: receipt.state,
      amount: receipt.amount,
      transactionCount: 1,
    });
  });

  return [...donorMap.values()]
    .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name))
    .slice(0, limit);
};

const sortTransactionsByAmount = <T extends { amount: number; date: string; name: string }>(rows: T[]): T[] => {
  return [...rows].sort((left, right) => {
    if (right.amount !== left.amount) {
      return right.amount - left.amount;
    }

    return right.date.localeCompare(left.date) || left.name.localeCompare(right.name);
  });
};

export const getTopReceipts = (report: CampaignFinanceReport | null, limit = 10): FinanceReceipt[] => {
  if (!report) {
    return [];
  }

  return sortTransactionsByAmount(report.receipts).slice(0, limit);
};

const vendorReducer = (rows: FinanceExpenditure[]): FinanceVendorTotal[] => {
  const vendorMap = new Map<string, FinanceVendorTotal>();

  rows.forEach((row) => {
    const key = normalizeNameKey(row.name);
    const current = vendorMap.get(key);
    if (current) {
      current.amount += row.amount;
      current.transactionCount += 1;
      return;
    }

    vendorMap.set(key, {
      name: row.name,
      city: row.city,
      state: row.state,
      amount: row.amount,
      transactionCount: 1,
    });
  });

  return [...vendorMap.values()].sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name));
};

export const getTopVendors = (report: CampaignFinanceReport | null, limit = 5): FinanceVendorTotal[] => {
  if (!report) {
    return [];
  }

  return vendorReducer(report.expenditures).slice(0, limit);
};

export const getTopExpenditures = (report: CampaignFinanceReport | null, limit = 10): FinanceExpenditure[] => {
  if (!report) {
    return [];
  }

  return sortTransactionsByAmount(report.expenditures).slice(0, limit);
};

const buildBucketRows = (
  rows: Array<{ label: string; amount: number }>,
  limit: number,
): Array<{ key: string; label: string; amount: number }> => {
  return rows
    .filter((row) => row.label.trim().length > 0)
    .sort((left, right) => right.amount - left.amount || left.label.localeCompare(right.label))
    .slice(0, limit)
    .map((row) => ({
      key: normalizeNameKey(row.label),
      label: row.label,
      amount: row.amount,
    }));
};

export const getExpenditureMetrics = (report: CampaignFinanceReport | null): FinanceExpenditureMetrics => {
  if (!report) {
    return {
      totalExpenditureTransactions: 0,
      totalExpenditureAmount: 0,
      topVendorTotals: [],
      totalsByExpenditureType: [],
      totalsByPurpose: [],
    };
  }

  const expenditureTypeMap = new Map<string, number>();
  const purposeMap = new Map<string, number>();

  report.expenditures.forEach((row) => {
    const typeKey = row.expenditureType.trim() || 'Uncategorized';
    expenditureTypeMap.set(typeKey, (expenditureTypeMap.get(typeKey) ?? 0) + row.amount);

    const purposeKey = row.purpose.trim() || 'Unspecified';
    purposeMap.set(purposeKey, (purposeMap.get(purposeKey) ?? 0) + row.amount);
  });

  return {
    totalExpenditureTransactions: report.expenditures.length,
    totalExpenditureAmount: sumBy(report.expenditures, (row) => row.amount),
    topVendorTotals: vendorReducer(report.expenditures).slice(0, 5),
    totalsByExpenditureType: buildBucketRows(
      [...expenditureTypeMap.entries()].map(([label, amount]) => ({ label, amount })),
      6,
    ),
    totalsByPurpose: buildBucketRows(
      [...purposeMap.entries()].map(([label, amount]) => ({ label, amount })),
      6,
    ),
  };
};

const getTrendMetricValue = (report: CampaignFinanceReport | null, metricKey: FinanceTrendMetricKey): number | null => {
  if (!report) {
    return null;
  }

  if (metricKey === 'netCashChange') {
    return report.summaryPeriod.cashOnHandEnding - report.summaryPeriod.cashOnHandBeginning;
  }

  if (metricKey === 'burnRate') {
    return report.summaryPeriod.totalReceipts > 0
      ? report.summaryPeriod.totalExpenditures / report.summaryPeriod.totalReceipts
      : 0;
  }

  return report.summaryPeriod[metricKey];
};

export const getTrendSeries = (
  dataset: FinanceDataset,
  metricKey: FinanceTrendMetricKey,
): FinanceTrendSeriesPoint[] => {
  return [...dataset.quarters]
    .sort(sortQuarterAscending)
    .map((quarter) => ({
      quarterId: quarter.id,
      label: quarter.label,
      burrows: getTrendMetricValue(getCampaignReport(dataset, 'burrows', quarter.id), metricKey),
      clampitt: getTrendMetricValue(getCampaignReport(dataset, 'clampitt', quarter.id), metricKey),
    }));
};
