import { useMemo, useState } from 'react';
import { formatNumber } from '../lib/format';
import type { Nc119CountyRow } from '../types';
import { Card } from './Card';

type SortKey = keyof Nc119CountyRow;
type SortDirection = 'asc' | 'desc';

interface CountyTableProps {
  counties: Nc119CountyRow[];
}

const columns: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'county', label: 'County', numeric: false },
  { key: 'inPersonEarly', label: 'In-Person Early', numeric: true },
  { key: 'civilianMail', label: 'Civilian Mail', numeric: true },
  { key: 'militaryMail', label: 'Military Mail', numeric: true },
  { key: 'overseasMail', label: 'Overseas Mail', numeric: true },
  { key: 'total', label: 'Total', numeric: true },
];

export const CountyTable = ({ counties }: CountyTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedRows = useMemo(() => {
    return [...counties].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      const result =
        typeof aValue === 'string' && typeof bValue === 'string'
          ? aValue.localeCompare(bValue)
          : Number(aValue) - Number(bValue);

      return sortDirection === 'asc' ? result : -result;
    });
  }, [counties, sortDirection, sortKey]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'county' ? 'asc' : 'desc');
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">County Detail</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((column) => {
                const isActive = column.key === sortKey;
                const ariaSort = isActive
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';

                return (
                  <th
                    key={column.key}
                    className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
                    aria-sort={ariaSort}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded px-1 py-0.5 text-left transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      onClick={() => onSort(column.key)}
                    >
                      <span>{column.label}</span>
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
            {sortedRows.map((row) => (
              <tr key={row.county} className="odd:bg-slate-50/80 dark:odd:bg-slate-800/50">
                <td className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.county}</td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {formatNumber(row.inPersonEarly)}
                </td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {formatNumber(row.civilianMail)}
                </td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {formatNumber(row.militaryMail)}
                </td>
                <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {formatNumber(row.overseasMail)}
                </td>
                <td className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatNumber(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
