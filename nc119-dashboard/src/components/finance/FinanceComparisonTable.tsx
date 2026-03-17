import { useMemo, useState } from 'react';
import { Card } from '../Card';
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPoints,
} from '../../lib/format';
import type { FinanceMetricComparisonRow, FinanceToplineComparison } from '../../lib/finance/types';

type SortKey = 'label' | 'burrows' | 'clampitt' | 'difference' | 'advantage';
type SortDirection = 'asc' | 'desc';

interface FinanceComparisonTableProps {
  comparison: FinanceToplineComparison;
}

const formatMetricValue = (row: FinanceMetricComparisonRow, value: number | null): string => {
  if (value === null) {
    return 'No data';
  }

  if (row.key === 'burnRate') {
    return formatPercent(value * 100);
  }

  return formatCurrency(value);
};

const formatDifferenceValue = (row: FinanceMetricComparisonRow): string => {
  if (row.difference === null) {
    return 'No data';
  }

  if (row.key === 'burnRate') {
    return formatSignedPoints(row.difference * 100);
  }

  return formatSignedCurrency(row.difference);
};

const advantageLabel = (row: FinanceMetricComparisonRow): string => {
  if (row.advantage === 'n/a') {
    return 'N/A';
  }

  if (row.advantage === 'tie') {
    return 'Tie';
  }

  const owner = row.advantage === 'burrows' ? 'Burrows' : 'Clampitt';
  return row.direction === 'lower' ? `${owner} (lower)` : owner;
};

export const FinanceComparisonTable = ({ comparison }: FinanceComparisonTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('difference');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const rows = useMemo(() => {
    return [...comparison.rows].sort((left, right) => {
      let result = 0;

      if (sortKey === 'label') {
        result = left.label.localeCompare(right.label);
      } else if (sortKey === 'advantage') {
        result = advantageLabel(left).localeCompare(advantageLabel(right));
      } else {
        const leftValue = left[sortKey] ?? Number.NEGATIVE_INFINITY;
        const rightValue = right[sortKey] ?? Number.NEGATIVE_INFINITY;
        result = leftValue - rightValue;
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [comparison.rows, sortDirection, sortKey]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'label' ? 'asc' : 'desc');
  };

  const headerButtonClass =
    'inline-flex items-center gap-2 rounded px-1 py-0.5 text-left transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Side-by-Side Comparison</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Canonical quarter summary metrics with Burrows-minus-Clampitt differences.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {[
                ['label', 'Metric'],
                ['burrows', 'Burrows'],
                ['clampitt', 'Clampitt'],
                ['difference', 'Difference'],
                ['advantage', 'Better / Advantage'],
              ].map(([key, label]) => {
                const typedKey = key as SortKey;
                const isActive = sortKey === typedKey;
                const ariaSort = isActive
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';

                return (
                  <th
                    key={key}
                    className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
                    aria-sort={ariaSort}
                  >
                    <button type="button" className={headerButtonClass} onClick={() => onSort(typedKey)}>
                      <span>{label}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isActive ? sortDirection.toUpperCase() : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="odd:bg-slate-50/80 dark:odd:bg-slate-800/50">
                <td className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.label}</td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {formatMetricValue(row, row.burrows)}
                </td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {formatMetricValue(row, row.clampitt)}
                </td>
                <td className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatDifferenceValue(row)}
                </td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">{advantageLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

