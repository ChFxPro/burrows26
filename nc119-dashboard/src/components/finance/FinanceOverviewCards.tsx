import { Card } from '../Card';
import { StatTile } from '../StatTile';
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPoints,
} from '../../lib/format';
import type { FinanceToplineCampaignMetrics, FinanceToplineComparison } from '../../lib/finance/types';

type CampaignView = 'both' | 'burrows' | 'clampitt';

interface FinanceOverviewCardsProps {
  comparison: FinanceToplineComparison;
  campaignView: CampaignView;
}

type MetricCardConfig = {
  key: keyof FinanceToplineCampaignMetrics;
  label: string;
  formatter: (value: number) => string;
};

const METRIC_CARDS: MetricCardConfig[] = [
  { key: 'totalReceipts', label: 'Total Receipts', formatter: formatCurrency },
  { key: 'totalExpenditures', label: 'Total Expenditures', formatter: formatCurrency },
  { key: 'cashOnHandEnding', label: 'Cash on Hand Ending', formatter: formatCurrency },
  { key: 'cashOnHandBeginning', label: 'Cash on Hand Beginning', formatter: formatCurrency },
  { key: 'netCashChange', label: 'Net Cash Change', formatter: formatCurrency },
  { key: 'burnRate', label: 'Burn Rate', formatter: (value) => formatPercent(value * 100) },
  { key: 'individualContributions', label: 'Individual Contributions', formatter: formatCurrency },
  {
    key: 'pacOtherPoliticalCommitteeContributions',
    label: 'PAC / Other Political Committee Contributions',
    formatter: formatCurrency,
  },
  { key: 'outsideSourcesIncome', label: 'Outside Sources of Income', formatter: formatCurrency },
  { key: 'inKindContributions', label: 'In-Kind Contributions', formatter: formatCurrency },
  { key: 'debtOwedByCommittee', label: 'Debt Owed by Committee', formatter: formatCurrency },
  { key: 'outstandingLoans', label: 'Outstanding Loans', formatter: formatCurrency },
];

const getSelectedMetrics = (
  comparison: FinanceToplineComparison,
  campaignView: CampaignView,
): FinanceToplineCampaignMetrics | null => {
  if (campaignView === 'burrows') {
    return comparison.burrows;
  }

  if (campaignView === 'clampitt') {
    return comparison.clampitt;
  }

  return null;
};

export const FinanceOverviewCards = ({ comparison, campaignView }: FinanceOverviewCardsProps) => {
  const selectedMetrics = getSelectedMetrics(comparison, campaignView);

  return (
    <div className="space-y-4">
      {campaignView === 'both' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatTile
            label="Receipts Advantage"
            value={comparison.receiptsAdvantage !== null ? formatSignedCurrency(comparison.receiptsAdvantage) : 'N/A'}
            note="Burrows minus Clampitt for the selected quarter."
            accent
          />
          <StatTile
            label="Cash on Hand Advantage"
            value={
              comparison.cashOnHandAdvantage !== null
                ? formatSignedCurrency(comparison.cashOnHandAdvantage)
                : 'N/A'
            }
            note="Burrows minus Clampitt using canonical summary ending cash."
            accent
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {METRIC_CARDS.map((metric) => {
          const burrowsValue = comparison.burrows?.[metric.key] ?? null;
          const clampittValue = comparison.clampitt?.[metric.key] ?? null;

          if (campaignView !== 'both') {
            const value = selectedMetrics?.[metric.key] ?? null;
            return (
              <Card key={metric.key} className="h-full">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {value !== null ? metric.formatter(value) : 'No data'}
                </p>
                {campaignView === 'burrows' && clampittValue !== null && value !== null ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Clampitt: {metric.formatter(clampittValue)}
                  </p>
                ) : null}
                {campaignView === 'clampitt' && burrowsValue !== null && value !== null ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Burrows: {metric.formatter(burrowsValue)}
                  </p>
                ) : null}
              </Card>
            );
          }

          const difference = burrowsValue !== null && clampittValue !== null ? burrowsValue - clampittValue : null;
          const differenceText =
            difference === null
              ? 'Missing comparison data'
              : metric.key === 'burnRate'
                ? `Delta: ${formatSignedPoints(difference * 100)}`
                : `Delta: ${formatSignedCurrency(difference)}`;

          return (
            <Card key={metric.key} className="h-full">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {metric.label}
              </p>
              <div className="mt-3 grid gap-2">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Burrows</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {burrowsValue !== null ? metric.formatter(burrowsValue) : 'No data'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Clampitt</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {clampittValue !== null ? metric.formatter(clampittValue) : 'No data'}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{differenceText}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
