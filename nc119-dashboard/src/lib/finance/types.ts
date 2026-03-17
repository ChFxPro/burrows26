export type QuarterId = string;
export type CampaignId = 'burrows' | 'clampitt' | string;

export interface FinanceDataset {
  datasetVersion: string;
  quarters: FinanceQuarter[];
  campaigns: CampaignFinanceReport[];
}

export interface FinanceQuarter {
  id: QuarterId;
  label: string;
  dateFrom: string;
  dateTo: string;
  dateFiled: string;
}

export interface FinanceReportPeriod {
  quarterId: QuarterId;
  label: string;
  dateFrom: string;
  dateTo: string;
  dateFiled: string;
}

export interface FinanceAccount {
  code: string;
  name: string;
  beginBalance: number;
  endBalance: number;
}

export interface FinanceSummaryPeriod {
  cashOnHandBeginning: number;
  aggregatedIndividual: number;
  individualContributions: number;
  partyCommittees: number;
  otherPoliticalCommittees: number;
  outsideSourcesIncome: number;
  inKindContributions: number;
  totalReceipts: number;
  operatingExpenditures: number;
  aggregatedNonMediaExpenditures: number;
  contributionsToCommittees: number;
  totalExpenditures: number;
  cashOnHandEnding: number;
  debtOwedByCommittee: number;
  outstandingLoans: number;
}

export interface CampaignFinanceReport {
  id: CampaignId;
  displayName: string;
  committeeName: string;
  sboeId: string;
  report: FinanceReportPeriod;
  account: FinanceAccount;
  summaryPeriod: FinanceSummaryPeriod;
  receipts: FinanceReceipt[];
  expenditures: FinanceExpenditure[];
}

export interface FinanceReceipt {
  date: string;
  isPrior: boolean;
  name: string;
  city: string;
  state: string;
  amount: number;
  receiptType: string;
  paymentMethod: string;
  aggregate: boolean;
}

export interface FinanceExpenditure {
  date: string;
  name: string;
  city: string;
  state: string;
  amount: number;
  expenditureType: string;
  purpose: string;
  paymentMethod: string;
}

export interface FinanceReceiptMetrics {
  totalReceiptTransactions: number;
  totalReceiptAmount: number;
  aggregateReceiptAmount: number;
  nonAggregateReceiptAmount: number;
  uniqueNamedDonorsCount: number;
  inStateReceiptAmount: number;
  outOfStateReceiptAmount: number;
  largestSingleReceipt: number;
  averageNamedReceipt: number;
  averageAllReceipt: number;
}

export interface FinanceExpenditureMetrics {
  totalExpenditureTransactions: number;
  totalExpenditureAmount: number;
  topVendorTotals: Array<{ name: string; amount: number; transactionCount: number }>;
  totalsByExpenditureType: Array<{ key: string; label: string; amount: number }>;
  totalsByPurpose: Array<{ key: string; label: string; amount: number }>;
}

export interface FinanceDonorTotal {
  name: string;
  city: string;
  state: string;
  amount: number;
  transactionCount: number;
}

export interface FinanceVendorTotal {
  name: string;
  city: string;
  state: string;
  amount: number;
  transactionCount: number;
}

export type FinanceTrendMetricKey =
  | keyof FinanceSummaryPeriod
  | 'netCashChange'
  | 'burnRate';

export interface FinanceTrendSeriesPoint {
  quarterId: QuarterId;
  label: string;
  burrows: number | null;
  clampitt: number | null;
}

export interface FinanceMetricComparisonRow {
  key: string;
  label: string;
  burrows: number | null;
  clampitt: number | null;
  difference: number | null;
  advantage: 'burrows' | 'clampitt' | 'tie' | 'n/a';
  direction: 'higher' | 'lower';
}

export interface FinanceToplineCampaignMetrics {
  totalReceipts: number;
  totalExpenditures: number;
  cashOnHandEnding: number;
  cashOnHandBeginning: number;
  netCashChange: number;
  burnRate: number;
  individualContributions: number;
  pacOtherPoliticalCommitteeContributions: number;
  outsideSourcesIncome: number;
  inKindContributions: number;
  debtOwedByCommittee: number;
  outstandingLoans: number;
}

export interface FinanceToplineComparison {
  quarterId: QuarterId;
  burrows: FinanceToplineCampaignMetrics | null;
  clampitt: FinanceToplineCampaignMetrics | null;
  receiptsAdvantage: number | null;
  cashOnHandAdvantage: number | null;
  rows: FinanceMetricComparisonRow[];
}

export interface FinanceIntegrityIssue {
  key: 'cashOnHandEnding' | 'totalReceipts' | 'totalExpenditures';
  label: string;
  summaryValue: number;
  rawValue: number;
  delta: number;
  message: string;
}

export interface FinanceIntegrityResult {
  hasWarnings: boolean;
  issues: FinanceIntegrityIssue[];
}

export interface FinanceCsvParseResult {
  fileName: string;
  report: CampaignFinanceReport;
  quarter: FinanceQuarter;
  warnings: string[];
  missingCampaignInference: boolean;
  missingQuarterInference: boolean;
  detectedSections: string[];
}

export interface FinanceImportSummary {
  fileName: string;
  sourceType: 'csv' | 'json';
  dataset: FinanceDataset;
  warnings: string[];
}

