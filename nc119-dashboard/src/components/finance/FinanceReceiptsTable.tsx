import { useMemo, useState } from 'react';
import { Card } from '../Card';
import { StatTile } from '../StatTile';
import { formatCurrency, formatPercent } from '../../lib/format';
import {
  getReceiptMetrics,
  getTopDonors,
  getTopReceipts,
} from '../../lib/finance/selectors';
import type { CampaignFinanceReport, FinanceReceipt } from '../../lib/finance/types';

type SortKey = 'date' | 'name' | 'amount' | 'state' | 'receiptType';
type SortDirection = 'asc' | 'desc';

interface FinanceReceiptsTableProps {
  report: CampaignFinanceReport | null;
}

const dateSortKey = (value: string): string => {
  const [month = '00', day = '00', year = '0000'] = value.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const FinanceReceiptsTable = ({ report }: FinanceReceiptsTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const metrics = useMemo(() => getReceiptMetrics(report), [report]);
  const topDonors = useMemo(() => getTopDonors(report, 8), [report]);
  const topReceipts = useMemo(() => getTopReceipts(report, 14), [report]);

  const sortedReceipts = useMemo(() => {
    const rows = [...topReceipts];
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
  }, [sortDirection, sortKey, topReceipts]);

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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Receipts Intelligence</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          No receipt data is available for this campaign in the selected quarter yet.
        </p>
      </Card>
    );
  }

  const geographicTotal = metrics.inStateReceiptAmount + metrics.outOfStateReceiptAmount;
  const inStatePct = geographicTotal > 0 ? (metrics.inStateReceiptAmount / geographicTotal) * 100 : 0;
  const outOfStatePct = geographicTotal > 0 ? (metrics.outOfStateReceiptAmount / geographicTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Receipts Intelligence
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{report.displayName}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {report.report.label}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Receipt Transactions" value={metrics.totalReceiptTransactions.toString()} />
        <StatTile label="Total Receipts" value={formatCurrency(metrics.totalReceiptAmount)} accent />
        <StatTile label="Named Donors" value={metrics.uniqueNamedDonorsCount.toString()} />
        <StatTile label="Largest Receipt" value={formatCurrency(metrics.largestSingleReceipt)} />
        <StatTile label="Average Named Receipt" value={formatCurrency(metrics.averageNamedReceipt)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Donors</h4>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Donor
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
                {topDonors.map((donor) => (
                  <tr key={donor.name} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {donor.name}
                    </td>
                    <td className="px-1 py-2 text-sm text-slate-700 dark:text-slate-200">
                      {[donor.city, donor.state].filter(Boolean).join(', ') || 'Unspecified'}
                    </td>
                    <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                      {donor.transactionCount}
                    </td>
                    <td className="px-1 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(donor.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Geographic Breakdown</h4>
          <div className="mt-4 space-y-4">
            {[
              {
                label: 'North Carolina',
                amount: metrics.inStateReceiptAmount,
                pct: inStatePct,
                colorClass: 'bg-brand-500',
              },
              {
                label: 'Out of State',
                amount: metrics.outOfStateReceiptAmount,
                pct: outOfStatePct,
                colorClass: 'bg-slate-500',
              },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.label}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {formatCurrency(row.amount)} • {formatPercent(row.pct)}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={`h-full rounded-full ${row.colorClass}`} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Aggregate Receipts
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(metrics.aggregateReceiptAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Non-Aggregate Receipts
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(metrics.nonAggregateReceiptAmount)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Receipts</h4>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {[
                  ['date', 'Date'],
                  ['name', 'Name'],
                  ['state', 'State'],
                  ['receiptType', 'Type'],
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
              {sortedReceipts.map((receipt: FinanceReceipt) => (
                <tr key={`${receipt.date}-${receipt.name}-${receipt.amount}`} className="odd:bg-slate-50/80 dark:odd:bg-slate-800/50">
                  <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">{receipt.date}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {receipt.name}
                  </td>
                  <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                    {receipt.state || 'N/A'}
                  </td>
                  <td className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                    {receipt.receiptType}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(receipt.amount)}
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

