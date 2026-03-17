import { createEmptyFinanceDataset, normalizeJsonFinanceDataset } from './normalize';
import type { FinanceDataset } from './types';

export const FINANCE_UPLOAD_STORAGE_KEY = 'nc119-finance-uploads-v1';

export const loadStoredFinanceDataset = (): FinanceDataset => {
  if (typeof window === 'undefined') {
    return createEmptyFinanceDataset('nc119-finance-browser-empty-v1');
  }

  const stored = window.localStorage.getItem(FINANCE_UPLOAD_STORAGE_KEY);
  if (!stored) {
    return createEmptyFinanceDataset('nc119-finance-browser-empty-v1');
  }

  try {
    const parsed = JSON.parse(stored);
    const validation = normalizeJsonFinanceDataset(parsed);
    if (!validation.ok) {
      return createEmptyFinanceDataset('nc119-finance-browser-empty-v1');
    }

    return validation.data;
  } catch {
    return createEmptyFinanceDataset('nc119-finance-browser-empty-v1');
  }
};

export const saveStoredFinanceDataset = (dataset: FinanceDataset): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(FINANCE_UPLOAD_STORAGE_KEY, JSON.stringify(dataset));
};

