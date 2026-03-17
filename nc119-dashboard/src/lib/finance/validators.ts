import type {
  CampaignFinanceReport,
  FinanceDataset,
  FinanceExpenditure,
  FinanceIntegrityIssue,
  FinanceIntegrityResult,
  FinanceQuarter,
  FinanceReceipt,
  FinanceSummaryPeriod,
} from './types';

interface ValidationOk<T> {
  ok: true;
  data: T;
}

interface ValidationErr {
  ok: false;
  errors: string[];
}

export type FinanceValidationResult<T> = ValidationOk<T> | ValidationErr;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const pushTypeError = (errors: string[], field: string, expected: string): void => {
  errors.push(`Field "${field}" must be ${expected}.`);
};

const validateQuarter = (value: unknown, field: string, errors: string[]): value is FinanceQuarter => {
  if (!isRecord(value)) {
    pushTypeError(errors, field, 'an object');
    return false;
  }

  if (!isString(value.id)) {
    pushTypeError(errors, `${field}.id`, 'a string');
  }
  if (!isString(value.label)) {
    pushTypeError(errors, `${field}.label`, 'a string');
  }
  if (!isString(value.dateFrom)) {
    pushTypeError(errors, `${field}.dateFrom`, 'a string');
  }
  if (!isString(value.dateTo)) {
    pushTypeError(errors, `${field}.dateTo`, 'a string');
  }
  if (!isString(value.dateFiled)) {
    pushTypeError(errors, `${field}.dateFiled`, 'a string');
  }

  return true;
};

const validateReceipt = (value: unknown, field: string, errors: string[]): value is FinanceReceipt => {
  if (!isRecord(value)) {
    pushTypeError(errors, field, 'an object');
    return false;
  }

  if (!isString(value.date)) {
    pushTypeError(errors, `${field}.date`, 'a string');
  }
  if (typeof value.isPrior !== 'boolean') {
    pushTypeError(errors, `${field}.isPrior`, 'a boolean');
  }
  if (!isString(value.name)) {
    pushTypeError(errors, `${field}.name`, 'a string');
  }
  if (!isString(value.city)) {
    pushTypeError(errors, `${field}.city`, 'a string');
  }
  if (!isString(value.state)) {
    pushTypeError(errors, `${field}.state`, 'a string');
  }
  if (!isNumber(value.amount)) {
    pushTypeError(errors, `${field}.amount`, 'a number');
  }
  if (!isString(value.receiptType)) {
    pushTypeError(errors, `${field}.receiptType`, 'a string');
  }
  if (!isString(value.paymentMethod)) {
    pushTypeError(errors, `${field}.paymentMethod`, 'a string');
  }
  if (typeof value.aggregate !== 'boolean') {
    pushTypeError(errors, `${field}.aggregate`, 'a boolean');
  }

  return true;
};

const validateExpenditure = (value: unknown, field: string, errors: string[]): value is FinanceExpenditure => {
  if (!isRecord(value)) {
    pushTypeError(errors, field, 'an object');
    return false;
  }

  if (!isString(value.date)) {
    pushTypeError(errors, `${field}.date`, 'a string');
  }
  if (!isString(value.name)) {
    pushTypeError(errors, `${field}.name`, 'a string');
  }
  if (!isString(value.city)) {
    pushTypeError(errors, `${field}.city`, 'a string');
  }
  if (!isString(value.state)) {
    pushTypeError(errors, `${field}.state`, 'a string');
  }
  if (!isNumber(value.amount)) {
    pushTypeError(errors, `${field}.amount`, 'a number');
  }
  if (!isString(value.expenditureType)) {
    pushTypeError(errors, `${field}.expenditureType`, 'a string');
  }
  if (!isString(value.purpose)) {
    pushTypeError(errors, `${field}.purpose`, 'a string');
  }
  if (!isString(value.paymentMethod)) {
    pushTypeError(errors, `${field}.paymentMethod`, 'a string');
  }

  return true;
};

const validateSummaryPeriod = (
  value: unknown,
  field: string,
  errors: string[],
): value is FinanceSummaryPeriod => {
  if (!isRecord(value)) {
    pushTypeError(errors, field, 'an object');
    return false;
  }

  const keys: Array<keyof FinanceSummaryPeriod> = [
    'cashOnHandBeginning',
    'aggregatedIndividual',
    'individualContributions',
    'partyCommittees',
    'otherPoliticalCommittees',
    'outsideSourcesIncome',
    'inKindContributions',
    'totalReceipts',
    'operatingExpenditures',
    'aggregatedNonMediaExpenditures',
    'contributionsToCommittees',
    'totalExpenditures',
    'cashOnHandEnding',
    'debtOwedByCommittee',
    'outstandingLoans',
  ];

  keys.forEach((key) => {
    if (!isNumber(value[key])) {
      pushTypeError(errors, `${field}.${key}`, 'a number');
    }
  });

  return true;
};

const validateCampaignReport = (value: unknown, field: string, errors: string[]): value is CampaignFinanceReport => {
  if (!isRecord(value)) {
    pushTypeError(errors, field, 'an object');
    return false;
  }

  if (!isString(value.id)) {
    pushTypeError(errors, `${field}.id`, 'a string');
  }
  if (!isString(value.displayName)) {
    pushTypeError(errors, `${field}.displayName`, 'a string');
  }
  if (!isString(value.committeeName)) {
    pushTypeError(errors, `${field}.committeeName`, 'a string');
  }
  if (!isString(value.sboeId)) {
    pushTypeError(errors, `${field}.sboeId`, 'a string');
  }

  if (!isRecord(value.report)) {
    pushTypeError(errors, `${field}.report`, 'an object');
  } else {
    if (!isString(value.report.quarterId)) {
      pushTypeError(errors, `${field}.report.quarterId`, 'a string');
    }
    if (!isString(value.report.label)) {
      pushTypeError(errors, `${field}.report.label`, 'a string');
    }
    if (!isString(value.report.dateFrom)) {
      pushTypeError(errors, `${field}.report.dateFrom`, 'a string');
    }
    if (!isString(value.report.dateTo)) {
      pushTypeError(errors, `${field}.report.dateTo`, 'a string');
    }
    if (!isString(value.report.dateFiled)) {
      pushTypeError(errors, `${field}.report.dateFiled`, 'a string');
    }
  }

  if (!isRecord(value.account)) {
    pushTypeError(errors, `${field}.account`, 'an object');
  } else {
    if (!isString(value.account.code)) {
      pushTypeError(errors, `${field}.account.code`, 'a string');
    }
    if (!isString(value.account.name)) {
      pushTypeError(errors, `${field}.account.name`, 'a string');
    }
    if (!isNumber(value.account.beginBalance)) {
      pushTypeError(errors, `${field}.account.beginBalance`, 'a number');
    }
    if (!isNumber(value.account.endBalance)) {
      pushTypeError(errors, `${field}.account.endBalance`, 'a number');
    }
  }

  validateSummaryPeriod(value.summaryPeriod, `${field}.summaryPeriod`, errors);

  if (!Array.isArray(value.receipts)) {
    pushTypeError(errors, `${field}.receipts`, 'an array');
  } else {
    value.receipts.forEach((receipt, index) => {
      validateReceipt(receipt, `${field}.receipts[${index}]`, errors);
    });
  }

  if (!Array.isArray(value.expenditures)) {
    pushTypeError(errors, `${field}.expenditures`, 'an array');
  } else {
    value.expenditures.forEach((expenditure, index) => {
      validateExpenditure(expenditure, `${field}.expenditures[${index}]`, errors);
    });
  }

  return true;
};

export const validateFinanceDataset = (value: unknown): FinanceValidationResult<FinanceDataset> => {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['Root finance JSON must be an object.'] };
  }

  if (!isString(value.datasetVersion)) {
    pushTypeError(errors, 'datasetVersion', 'a string');
  }

  if (!Array.isArray(value.quarters)) {
    pushTypeError(errors, 'quarters', 'an array');
  } else if (value.quarters.length === 0) {
    errors.push('Field "quarters" must include at least one quarter.');
  } else {
    value.quarters.forEach((quarter, index) => {
      validateQuarter(quarter, `quarters[${index}]`, errors);
    });
  }

  if (!Array.isArray(value.campaigns)) {
    pushTypeError(errors, 'campaigns', 'an array');
  } else if (value.campaigns.length === 0) {
    errors.push('Field "campaigns" must include at least one campaign report.');
  } else {
    value.campaigns.forEach((campaign, index) => {
      validateCampaignReport(campaign, `campaigns[${index}]`, errors);
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: value as unknown as FinanceDataset };
};

const sumReceiptAmounts = (report: CampaignFinanceReport): number => {
  return report.receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
};

const sumExpenditureAmounts = (report: CampaignFinanceReport): number => {
  return report.expenditures.reduce((sum, expenditure) => sum + expenditure.amount, 0);
};

const roundCurrencyDelta = (value: number): number => {
  return Number(value.toFixed(2));
};

const buildIssue = (
  key: FinanceIntegrityIssue['key'],
  label: string,
  summaryValue: number,
  rawValue: number,
): FinanceIntegrityIssue => {
  const delta = roundCurrencyDelta(summaryValue - rawValue);

  return {
    key,
    label,
    summaryValue,
    rawValue,
    delta,
    message: `${label} does not reconcile with the uploaded raw values.`,
  };
};

export const getFinanceReportIntegrity = (
  report: CampaignFinanceReport,
  tolerance = 0.01,
): FinanceIntegrityResult => {
  const issues: FinanceIntegrityIssue[] = [];

  const endingDelta = Math.abs(report.summaryPeriod.cashOnHandEnding - report.account.endBalance);
  if (endingDelta > tolerance) {
    issues.push(
      buildIssue(
        'cashOnHandEnding',
        'Ending cash on hand',
        report.summaryPeriod.cashOnHandEnding,
        report.account.endBalance,
      ),
    );
  }

  const receiptsTotal = sumReceiptAmounts(report);
  if (Math.abs(report.summaryPeriod.totalReceipts - receiptsTotal) > tolerance) {
    issues.push(buildIssue('totalReceipts', 'Total receipts', report.summaryPeriod.totalReceipts, receiptsTotal));
  }

  const expendituresTotal = sumExpenditureAmounts(report);
  if (Math.abs(report.summaryPeriod.totalExpenditures - expendituresTotal) > tolerance) {
    issues.push(
      buildIssue(
        'totalExpenditures',
        'Total expenditures',
        report.summaryPeriod.totalExpenditures,
        expendituresTotal,
      ),
    );
  }

  return {
    hasWarnings: issues.length > 0,
    issues,
  };
};
