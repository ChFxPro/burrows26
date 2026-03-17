import {
  buildQuarterFromReport,
  buildQuarterLabel,
  buildSummaryPeriodFromTransactions,
  inferCampaignFromCommitteeName,
  inferQuarterId,
  UNKNOWN_CAMPAIGN_ID,
  UNKNOWN_QUARTER_ID,
} from './normalize';
import type {
  CampaignFinanceReport,
  FinanceCsvParseResult,
  FinanceExpenditure,
  FinanceReceipt,
  FinanceSummaryPeriod,
} from './types';
import type { FinanceValidationResult } from './validators';

interface CsvSection {
  name: string;
  rows: string[][];
}

interface FieldEntry {
  key: string;
  value: string;
}

const KNOWN_SECTIONS = new Set([
  'COVER',
  'OFFICERS',
  'ACCOUNTS',
  'SUMMARY',
  'RECEIPTS',
  'EXPENDITURES',
  'DEBTS OWED BY THE COMMITTEE',
  'OUTSTANDING LOANS',
]);

const normalizeSectionName = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
};

const normalizeKey = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
};

const normalizeHeaderKey = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
};

const trimTrailingEmptyCells = (row: string[]): string[] => {
  const next = [...row];
  while (next.length > 0 && next[next.length - 1].trim() === '') {
    next.pop();
  }
  return next.map((cell) => cell.trim());
};

const isRowEmpty = (row: string[]): boolean => {
  return row.every((cell) => cell.trim() === '');
};

const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(trimTrailingEmptyCells(currentRow));
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  rows.push(trimTrailingEmptyCells(currentRow));

  return rows.filter((row) => !(row.length === 1 && row[0] === ''));
};

const collectSections = (rows: string[][]): CsvSection[] => {
  const sections: CsvSection[] = [];
  let currentSection: CsvSection | null = null;

  rows.forEach((row) => {
    if (isRowEmpty(row)) {
      return;
    }

    const nonEmptyCells = row.filter((cell) => cell.trim().length > 0);
    const firstCell = nonEmptyCells[0] ?? '';
    const normalizedSection = normalizeSectionName(firstCell);

    if (nonEmptyCells.length === 1 && KNOWN_SECTIONS.has(normalizedSection)) {
      currentSection = {
        name: normalizedSection,
        rows: [],
      };
      sections.push(currentSection);
      return;
    }

    if (!currentSection) {
      return;
    }

    currentSection.rows.push(row.map((cell) => cell.trim()));
  });

  return sections;
};

const buildFieldEntries = (section?: CsvSection): FieldEntry[] => {
  if (!section || section.rows.length === 0) {
    return [];
  }

  const entries: FieldEntry[] = [];
  const [firstRow, secondRow] = section.rows;

  if (
    firstRow &&
    secondRow &&
    firstRow.length > 1 &&
    firstRow.length === secondRow.length &&
    firstRow.some((cell) => /[a-z]/i.test(cell))
  ) {
    firstRow.forEach((header, index) => {
      if (!header.trim()) {
        return;
      }

      entries.push({
        key: normalizeKey(header),
        value: secondRow[index]?.trim() ?? '',
      });
    });
  }

  section.rows.forEach((row) => {
    const cells = row.map((cell) => cell.trim()).filter((cell) => cell.length > 0);
    if (cells.length < 2) {
      return;
    }

    entries.push({
      key: normalizeKey(cells.slice(0, -1).join(' ')),
      value: cells[cells.length - 1],
    });
  });

  return entries;
};

const rowsToRecords = (section?: CsvSection): Array<Record<string, string>> => {
  if (!section || section.rows.length < 2) {
    return [];
  }

  const header = section.rows[0].map((cell) => normalizeHeaderKey(cell));
  if (header.every((cell) => cell === '')) {
    return [];
  }

  return section.rows
    .slice(1)
    .filter((row) => !isRowEmpty(row))
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((key, index) => {
        if (!key) {
          return;
        }

        record[key] = row[index]?.trim() ?? '';
      });
      return record;
    });
};

const readTextField = (entries: FieldEntry[], includePatterns: RegExp[]): string | null => {
  const match = entries.find((entry) => includePatterns.some((pattern) => pattern.test(entry.key)));
  return match?.value?.trim() ? match.value.trim() : null;
};

const parseAmount = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\$/g, '').replace(/,/g, '');
  const isNegative = normalized.startsWith('(') && normalized.endsWith(')');
  const numeric = Number(normalized.replace(/[()]/g, ''));

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return isNegative ? -numeric : numeric;
};

const readAmountField = (
  entries: FieldEntry[],
  includePatterns: RegExp[],
  excludePatterns: RegExp[] = [],
): number | null => {
  const match = entries.find(
    (entry) =>
      includePatterns.some((pattern) => pattern.test(entry.key)) &&
      !excludePatterns.some((pattern) => pattern.test(entry.key)),
  );

  return match ? parseAmount(match.value) : null;
};

const readRecordValue = (record: Record<string, string>, aliases: string[]): string => {
  const keys = Object.keys(record);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderKey(alias);
    const exactKey = keys.find((key) => key === normalizedAlias);
    if (exactKey) {
      return record[exactKey] ?? '';
    }
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderKey(alias);
    const fuzzyKey = keys.find((key) => key.includes(normalizedAlias));
    if (fuzzyKey) {
      return record[fuzzyKey] ?? '';
    }
  }

  return '';
};

const parseBoolean = (value: string): boolean => {
  return ['true', 'yes', 'y', '1', 'prior'].includes(value.trim().toLowerCase());
};

const toTitleCase = (value: string): string => {
  return value
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
};

const extractSummaryPeriod = (
  section: CsvSection | undefined,
  receipts: FinanceReceipt[],
  expenditures: FinanceExpenditure[],
  accountBeginBalance: number,
  accountEndBalance: number,
): FinanceSummaryPeriod => {
  const entries = buildFieldEntries(section);
  const overrides: Partial<FinanceSummaryPeriod> = {
    cashOnHandBeginning:
      readAmountField(entries, [/cash on hand .*begin/i, /beginning cash/i]) ?? accountBeginBalance,
    aggregatedIndividual:
      readAmountField(entries, [/aggregated individual/i, /aggregate individual/i]) ?? undefined,
    individualContributions:
      readAmountField(entries, [/individual contributions?/i, /contributions from individuals?/i], [/aggregated/i]) ??
      undefined,
    partyCommittees:
      readAmountField(entries, [/party committees?/i, /party committee contributions?/i]) ?? undefined,
    otherPoliticalCommittees:
      readAmountField(entries, [/other political committees?/i, /political committee contributions?/i], [/party/i]) ??
      undefined,
    outsideSourcesIncome:
      readAmountField(entries, [/outside sources? income/i, /outside source/i]) ?? undefined,
    inKindContributions: readAmountField(entries, [/in kind contributions?/i]) ?? undefined,
    totalReceipts: readAmountField(entries, [/total receipts?/i]) ?? undefined,
    operatingExpenditures:
      readAmountField(entries, [/operating expenditures?/i, /operating expense/i]) ?? undefined,
    aggregatedNonMediaExpenditures:
      readAmountField(entries, [/aggregated non media expenditures?/i, /aggregated non media expense/i]) ?? undefined,
    contributionsToCommittees:
      readAmountField(entries, [/contributions to committees?/i, /contribution to candidate/i]) ?? undefined,
    totalExpenditures: readAmountField(entries, [/total expenditures?/i]) ?? undefined,
    cashOnHandEnding:
      readAmountField(entries, [/cash on hand .*ending/i, /ending cash/i, /cash on hand at end/i]) ??
      accountEndBalance,
    debtOwedByCommittee: readAmountField(entries, [/debt owed by committee/i, /debt owed/i]) ?? undefined,
    outstandingLoans: readAmountField(entries, [/outstanding loans?/i]) ?? undefined,
  };

  return buildSummaryPeriodFromTransactions(receipts, expenditures, overrides);
};

const extractReceipts = (section?: CsvSection): FinanceReceipt[] => {
  return rowsToRecords(section)
    .map((record) => {
      const amount = parseAmount(readRecordValue(record, ['amount', 'receipt amount']));
      if (amount === null) {
        return null;
      }

      return {
        date: readRecordValue(record, ['date', 'receipt date']),
        isPrior: parseBoolean(readRecordValue(record, ['prior', 'is prior', 'prior period'])),
        name: readRecordValue(record, ['name', 'contributor name', 'source name', 'payer name']),
        city: readRecordValue(record, ['city']),
        state: readRecordValue(record, ['state']),
        amount,
        receiptType: readRecordValue(record, ['receipt type', 'type', 'contribution type']),
        paymentMethod: readRecordValue(record, ['payment method', 'method']),
        aggregate: parseBoolean(readRecordValue(record, ['aggregate', 'aggregated', 'is aggregate'])),
      };
    })
    .filter((receipt): receipt is FinanceReceipt => receipt !== null);
};

const extractExpenditures = (section?: CsvSection): FinanceExpenditure[] => {
  return rowsToRecords(section)
    .map((record) => {
      const amount = parseAmount(readRecordValue(record, ['amount', 'expenditure amount']));
      if (amount === null) {
        return null;
      }

      return {
        date: readRecordValue(record, ['date', 'expenditure date']),
        name: readRecordValue(record, ['name', 'payee name', 'vendor name']),
        city: readRecordValue(record, ['city']),
        state: readRecordValue(record, ['state']),
        amount,
        expenditureType: readRecordValue(record, ['expenditure type', 'type']),
        purpose: readRecordValue(record, ['purpose', 'description']),
        paymentMethod: readRecordValue(record, ['payment method', 'method']),
      };
    })
    .filter((expenditure): expenditure is FinanceExpenditure => expenditure !== null);
};

const extractAccount = (section?: CsvSection): {
  code: string;
  name: string;
  beginBalance: number;
  endBalance: number;
} => {
  const entries = buildFieldEntries(section);
  const records = rowsToRecords(section);
  const accountRecord = records[0];

  if (accountRecord) {
    return {
      code: readRecordValue(accountRecord, ['code', 'account code']),
      name: readRecordValue(accountRecord, ['name', 'account name', 'bank name']),
      beginBalance: parseAmount(readRecordValue(accountRecord, ['begin balance', 'beginning balance'])) ?? 0,
      endBalance: parseAmount(readRecordValue(accountRecord, ['end balance', 'ending balance'])) ?? 0,
    };
  }

  return {
    code: readTextField(entries, [/account code/i, /\bcode\b/i]) ?? '',
    name: readTextField(entries, [/account name/i, /bank name/i, /\bname\b/i]) ?? '',
    beginBalance: readAmountField(entries, [/begin balance/i, /beginning balance/i]) ?? 0,
    endBalance: readAmountField(entries, [/end balance/i, /ending balance/i]) ?? 0,
  };
};

export const parseNcCampaignCsv = (
  fileName: string,
  content: string,
): FinanceValidationResult<FinanceCsvParseResult> => {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      ok: false,
      errors: ['The uploaded CSV file is empty.'],
    };
  }

  const rows = parseCsvRows(trimmed);
  const sections = collectSections(rows);
  const detectedSections = sections.map((section) => section.name);

  if (detectedSections.length === 0) {
    return {
      ok: false,
      errors: [
        'The uploaded CSV does not contain recognizable North Carolina campaign finance sections.',
      ],
    };
  }

  const sectionMap = new Map(sections.map((section) => [section.name, section]));
  const coverEntries = buildFieldEntries(sectionMap.get('COVER'));
  const receipts = extractReceipts(sectionMap.get('RECEIPTS'));
  const expenditures = extractExpenditures(sectionMap.get('EXPENDITURES'));
  const account = extractAccount(sectionMap.get('ACCOUNTS'));

  const committeeName =
    readTextField(coverEntries, [/committee name/i, /^committee$/i, /organization name/i]) ?? '';
  const inferredCampaign = inferCampaignFromCommitteeName(committeeName);
  const displayName = inferredCampaign?.displayName ?? (committeeName ? toTitleCase(committeeName) : 'Unknown Campaign');
  const reportLabel =
    readTextField(coverEntries, [/report label/i, /report name/i, /report type/i]) ?? 'Campaign Finance Report';
  const dateFrom = readTextField(coverEntries, [/date from/i, /^from date$/i, /^from$/i]) ?? '';
  const dateTo = readTextField(coverEntries, [/date to/i, /^to date$/i, /^to$/i]) ?? '';
  const dateFiled = readTextField(coverEntries, [/date filed/i, /filed date/i]) ?? '';
  const inferredQuarterId = inferQuarterId({
    label: reportLabel,
    dateFrom,
    dateTo,
    dateFiled,
  });

  const report: CampaignFinanceReport = {
    id: inferredCampaign?.id ?? UNKNOWN_CAMPAIGN_ID,
    displayName,
    committeeName,
    sboeId: readTextField(coverEntries, [/sboe id/i, /committee id/i, /state id/i]) ?? '',
    report: {
      quarterId: inferredQuarterId ?? UNKNOWN_QUARTER_ID,
      label: reportLabel || (inferredQuarterId ? buildQuarterLabel(inferredQuarterId) : 'Campaign Finance Report'),
      dateFrom,
      dateTo,
      dateFiled,
    },
    account,
    summaryPeriod: extractSummaryPeriod(
      sectionMap.get('SUMMARY'),
      receipts,
      expenditures,
      account.beginBalance,
      account.endBalance,
    ),
    receipts,
    expenditures,
  };

  const quarter = buildQuarterFromReport(report);

  const warnings: string[] = [];
  if (!committeeName) {
    warnings.push('Committee name was not found in the COVER section. Select the campaign manually before import.');
  } else if (!inferredCampaign) {
    warnings.push(`Could not map committee "${committeeName}" to a known campaign. Select the campaign manually.`);
  }

  if (!inferredQuarterId) {
    warnings.push('Quarter could not be inferred from the report label or date range. Enter it manually before import.');
  }

  if (receipts.length === 0) {
    warnings.push('No receipt transactions were detected in the RECEIPTS section.');
  }

  if (expenditures.length === 0) {
    warnings.push('No expenditure transactions were detected in the EXPENDITURES section.');
  }

  return {
    ok: true,
    data: {
      fileName,
      report,
      quarter,
      warnings,
      missingCampaignInference: !inferredCampaign,
      missingQuarterInference: !inferredQuarterId,
      detectedSections,
    },
  };
};

