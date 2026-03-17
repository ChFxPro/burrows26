import { useMemo, useState } from 'react';
import { Card } from '../Card';
import { formatCurrency, formatSignedCurrency } from '../../lib/format';
import { getFinanceReportIntegrity } from '../../lib/finance/validators';
import type { CampaignFinanceReport } from '../../lib/finance/types';

interface FinanceDataIntegrityPanelProps {
  reports: CampaignFinanceReport[];
}

export const FinanceDataIntegrityPanel = ({ reports }: FinanceDataIntegrityPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const integrityRows = useMemo(
    () =>
      reports.map((report) => ({
        report,
        integrity: getFinanceReportIntegrity(report),
      })),
    [reports],
  );

  const warningCount = integrityRows.reduce((sum, row) => sum + row.integrity.issues.length, 0);
  const hasWarnings = warningCount > 0;

  return (
    <Card className={hasWarnings ? 'border-amber-300 dark:border-amber-700' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Data Source / Integrity</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                hasWarnings
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-700/20 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-700/20 dark:text-emerald-200'
              }`}
            >
              {hasWarnings ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : 'Reconciled'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Topline cards and comparison views use summary totals as the canonical source while preserving raw uploaded
            account and transaction values for auditability.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {isOpen ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-5 space-y-5">
          {integrityRows.map(({ report, integrity }) => (
            <div
              key={`${report.id}-${report.report.quarterId}`}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  {report.displayName}
                </h4>
                {integrity.hasWarnings ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-700/20 dark:text-amber-200">
                    Needs review
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-700/20 dark:text-emerald-200">
                    No mismatch
                  </span>
                )}
              </div>

              {integrity.hasWarnings ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Check
                        </th>
                        <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Summary
                        </th>
                        <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Raw
                        </th>
                        <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Delta
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrity.issues.map((issue) => (
                        <tr key={issue.key} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-1 py-2 text-sm text-slate-700 dark:text-slate-200">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{issue.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{issue.message}</p>
                          </td>
                          <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                            {formatCurrency(issue.summaryValue)}
                          </td>
                          <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                            {formatCurrency(issue.rawValue)}
                          </td>
                          <td className="px-1 py-2 text-right text-sm font-semibold text-amber-700 dark:text-amber-300">
                            {formatSignedCurrency(issue.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Summary totals reconcile against raw account balances and transaction sums within the configured
                  tolerance.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
};

