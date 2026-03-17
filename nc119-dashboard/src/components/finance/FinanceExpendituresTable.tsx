import { useMemo, useState } from 'react';
import { Card } from '../Card';
import { StatTile } from '../StatTile';
import { formatCurrency } from '../../lib/format';
import {
  getExpenditureMetrics,
  getTopExpenditures,
  getTopVendors,
} from '../../lib/finance/selectors';
import type { CampaignFinanceReport, FinanceExpenditure } from '../../lib/finance/types';

type SortKey = 'date' | 'name' | 'amount' | 'state' | 'purpose';
type SortDirection = 'asc' | 'desc';

interface FinanceExpendituresTableProps {
  report: CampaignFinanceReport | null;
}

const dateSortKey = (value: string): string => {
  const [month = '00', day = '00', year = '0000'] = value.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const FinanceExpendituresTable = ({ report }: FinanceExpendituresTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const metrics = useMemo(() => getExpenditureMetrics(report), [report]);
  const topVendors = useMemo(() => getTopVendors(report, 8), [report]);
  const topExpenditures = useMemo(() => getTopExpenditures(report, 14), [report]);

  const sortedExpenditures = useMemo(() => {
    const rows = [...topExpenditures];
    rows.sort((left, right) => {
      let result = 0;

      if (sortKey === 'date') {
        result = dateSortKey(left.date).localeCompare(dateSortKey(right.date));
      } else if (sortKey === 'amount') {
        result = left.amount - right.amount;
      } else {
        result = left[sortKey].localeCompare(right[sortKey]);
      }

      return sortDirection === 'asc' ? result : -result;
    });

    return rows;
  }, [sortDirection, sortKey, topExpenditures]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'amount' ? 'desc' : 'asc');
  };

  if (!report) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Expenditure Intelligence</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          No expenditure data is available for this campaign in the selected quarter yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Expenditure Intelligence
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{report.displayName}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {report.report.label}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Expenditure Transactions" value={metrics.totalExpenditureTransactions.toString()} />
        <StatTile label="Total Expenditures" value={formatCurrency(metrics.totalExpenditureAmount)} accent />
        <StatTile
          label="Top Vendor"
          value={topVendors[0] ? formatCurrency(topVendors[0].amount) : formatCurrency(0)}
          note={topVendors[0]?.name ?? 'No vendors'}
        />
        <StatTile
          label="Top Purpose"
          value={metrics.totalsByPurpose[0] ? formatCurrency(metrics.totalsByPurpose[0].amount) : formatCurrency(0)}
          note={metrics.totalsByPurpose[0]?.label ?? 'No purpose labels'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Vendors</h4>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Vendor
                  </th>
                  <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Location
                  </th>
                  <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Transactions
                  </th>
                  <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {topVendors.map((vendor) => (
                  <tr key={vendor.name} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {vendor.name}
                    </td>
                    <td className="px-1 py-2 text-sm text-slate-700 dark:text-slate-200">
                      {[vendor.city, vendor.state].filter(Boolean).join(', ') || 'Unspecified'}
                    </td>
                    <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                      {vendor.transactionCount}
                    </td>
                    <td className="px-1 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(vendor.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Category Summary</h4>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                By Expenditure Type
              </p>
              <div className="mt-3 space-y-2">
                {metrics.totalsByExpenditureType.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                  >
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</span>
                    <span className="text-sm text-slate-700 dark:text-slate-200">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                By Purpose
              </p>
              <div className="mt-3 space-y-2">
                {metrics.totalsByPurpose.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                  >
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</span>
                    <span className="text-sm text-slate-700 dark:text-slate-200">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Expenditures</h4>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {[
                  ['date', 'Date'],
                  ['name', 'Name'],
                  ['state', 'State'],
                  ['purpose', 'Purpose'],
                  ['amount', 'Amount'],
                ].map(([key, label]) => {
                  const typedKey = key as SortKey;
                  const isActive = typedKey === sortKey;
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
                      <button
                        type="button"
                        onClick={() => onSort(typedKey)}
                        className="inline-flex items-center gap-2 rounded px-1 py-0.5 text-left transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
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
              {sortedExpenditures.map((expenditure: FinanceExpenditure) => (
                <tr
                  key={`${expenditure.date}-${expenditure.name}-${expenditure.amount}`}
                  className="odd:bg-slate-50/80 dark:odd:bg-slate-800/50"
                >
                  <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">{expenditure.date}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {expenditure.name}
                  </td>
                  <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                    {expenditure.state || 'N/A'}
                  </td>
                  <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                    {expenditure.purpose || 'Unspecified'}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(expenditure.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

