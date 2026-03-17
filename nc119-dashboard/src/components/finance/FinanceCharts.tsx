import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '../ChartCard';
import { getCampaignReport, getTrendSeries } from '../../lib/finance/selectors';
import { formatCurrency, formatPercent } from '../../lib/format';
import type { FinanceDataset } from '../../lib/finance/types';

type CampaignView = 'both' | 'burrows' | 'clampitt';

interface FinanceChartsProps {
  dataset: FinanceDataset;
  quarterId: string;
  campaignView: CampaignView;
  theme: 'light' | 'dark';
}

const currencyTick = (value: number): string => {
  return `$${Math.round(value).toLocaleString('en-US')}`;
};

const filterSeriesKeys = (campaignView: CampaignView): Array<'burrows' | 'clampitt'> => {
  if (campaignView === 'burrows') {
    return ['burrows'];
  }

  if (campaignView === 'clampitt') {
    return ['clampitt'];
  }

  return ['burrows', 'clampitt'];
};

export const FinanceCharts = ({ dataset, quarterId, campaignView, theme }: FinanceChartsProps) => {
  const burrowsReport = getCampaignReport(dataset, 'burrows', quarterId);
  const clampittReport = getCampaignReport(dataset, 'clampitt', quarterId);
  const activeSeries = filterSeriesKeys(campaignView);
  const axisTickColor = theme === 'dark' ? '#cbd5e1' : '#334155';
  const legendTextColor = theme === 'dark' ? '#e2e8f0' : '#334155';
  const gridStroke = theme === 'dark' ? '#33415599' : '#94a3b840';

  const campaignBars = [
    {
      campaign: 'Burrows',
      totalReceipts: burrowsReport?.summaryPeriod.totalReceipts ?? 0,
      totalExpenditures: burrowsReport?.summaryPeriod.totalExpenditures ?? 0,
      cashOnHandEnding: burrowsReport?.summaryPeriod.cashOnHandEnding ?? 0,
      burnRate:
        burrowsReport && burrowsReport.summaryPeriod.totalReceipts > 0
          ? burrowsReport.summaryPeriod.totalExpenditures / burrowsReport.summaryPeriod.totalReceipts
          : 0,
    },
    {
      campaign: 'Clampitt',
      totalReceipts: clampittReport?.summaryPeriod.totalReceipts ?? 0,
      totalExpenditures: clampittReport?.summaryPeriod.totalExpenditures ?? 0,
      cashOnHandEnding: clampittReport?.summaryPeriod.cashOnHandEnding ?? 0,
      burnRate:
        clampittReport && clampittReport.summaryPeriod.totalReceipts > 0
          ? clampittReport.summaryPeriod.totalExpenditures / clampittReport.summaryPeriod.totalReceipts
          : 0,
    },
  ].filter((row) => {
    if (campaignView === 'both') {
      return true;
    }

    return row.campaign.toLowerCase() === campaignView;
  });

  const receiptCompositionRows = [
    {
      category: 'Aggregated Individual',
      burrows: burrowsReport?.summaryPeriod.aggregatedIndividual ?? 0,
      clampitt: clampittReport?.summaryPeriod.aggregatedIndividual ?? 0,
    },
    {
      category: 'Individual Contributions',
      burrows: burrowsReport?.summaryPeriod.individualContributions ?? 0,
      clampitt: clampittReport?.summaryPeriod.individualContributions ?? 0,
    },
    {
      category: 'Party Committees',
      burrows: burrowsReport?.summaryPeriod.partyCommittees ?? 0,
      clampitt: clampittReport?.summaryPeriod.partyCommittees ?? 0,
    },
    {
      category: 'Other Political Committees',
      burrows: burrowsReport?.summaryPeriod.otherPoliticalCommittees ?? 0,
      clampitt: clampittReport?.summaryPeriod.otherPoliticalCommittees ?? 0,
    },
    {
      category: 'Outside Sources',
      burrows: burrowsReport?.summaryPeriod.outsideSourcesIncome ?? 0,
      clampitt: clampittReport?.summaryPeriod.outsideSourcesIncome ?? 0,
    },
    {
      category: 'In-Kind Contributions',
      burrows: burrowsReport?.summaryPeriod.inKindContributions ?? 0,
      clampitt: clampittReport?.summaryPeriod.inKindContributions ?? 0,
    },
  ];

  const expenditureCompositionRows = [
    {
      category: 'Operating Expenditures',
      burrows: burrowsReport?.summaryPeriod.operatingExpenditures ?? 0,
      clampitt: clampittReport?.summaryPeriod.operatingExpenditures ?? 0,
    },
    {
      category: 'Aggregated Non-Media',
      burrows: burrowsReport?.summaryPeriod.aggregatedNonMediaExpenditures ?? 0,
      clampitt: clampittReport?.summaryPeriod.aggregatedNonMediaExpenditures ?? 0,
    },
    {
      category: 'Contributions to Committees',
      burrows: burrowsReport?.summaryPeriod.contributionsToCommittees ?? 0,
      clampitt: clampittReport?.summaryPeriod.contributionsToCommittees ?? 0,
    },
  ];

  const trendSeries = getTrendSeries(dataset, 'cashOnHandEnding');

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Total Receipts by Campaign"
        description="Summary totals for the selected quarter."
        ariaLabel="Bar chart comparing total receipts by campaign"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={campaignBars} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="campaign" tick={{ fill: axisTickColor, fontSize: 12 }} />
            <YAxis tick={{ fill: axisTickColor, fontSize: 12 }} tickFormatter={currencyTick} />
            <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
            <Bar dataKey="totalReceipts" name="Total Receipts" fill="#059669" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Cash on Hand Ending"
        description="Canonical summary ending cash for the selected quarter."
        ariaLabel="Bar chart comparing ending cash on hand by campaign"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={campaignBars} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="campaign" tick={{ fill: axisTickColor, fontSize: 12 }} />
            <YAxis tick={{ fill: axisTickColor, fontSize: 12 }} tickFormatter={currencyTick} />
            <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
            <Bar dataKey="cashOnHandEnding" name="Cash on Hand Ending" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Receipt Composition"
        description="Grouped summary breakdown of receipt sources."
        ariaLabel="Grouped bar chart for receipt composition"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={receiptCompositionRows} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="category"
              interval={0}
              angle={-18}
              textAnchor="end"
              height={72}
              tick={{ fill: axisTickColor, fontSize: 12 }}
            />
            <YAxis tick={{ fill: axisTickColor, fontSize: 12 }} tickFormatter={currencyTick} />
            <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
            <Legend wrapperStyle={{ color: legendTextColor, fontSize: '12px' }} />
            {activeSeries.includes('burrows') ? (
              <Bar dataKey="burrows" name="Burrows" fill="#059669" radius={[6, 6, 0, 0]} />
            ) : null}
            {activeSeries.includes('clampitt') ? (
              <Bar dataKey="clampitt" name="Clampitt" fill="#475569" radius={[6, 6, 0, 0]} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Expenditure Composition"
        description="Grouped summary breakdown of expenditure categories."
        ariaLabel="Grouped bar chart for expenditure composition"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={expenditureCompositionRows} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="category"
              interval={0}
              angle={-18}
              textAnchor="end"
              height={72}
              tick={{ fill: axisTickColor, fontSize: 12 }}
            />
            <YAxis tick={{ fill: axisTickColor, fontSize: 12 }} tickFormatter={currencyTick} />
            <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
            <Legend wrapperStyle={{ color: legendTextColor, fontSize: '12px' }} />
            {activeSeries.includes('burrows') ? (
              <Bar dataKey="burrows" name="Burrows" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            ) : null}
            {activeSeries.includes('clampitt') ? (
              <Bar dataKey="clampitt" name="Clampitt" fill="#64748b" radius={[6, 6, 0, 0]} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Quarterly Trend Scaffold"
        description="Cash on hand ending over time. Additional points appear as new quarters are uploaded."
        ariaLabel="Trend chart scaffold for quarter-over-quarter finance data"
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSeries} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 12 }} />
                <YAxis tick={{ fill: axisTickColor, fontSize: 12 }} tickFormatter={currencyTick} />
                <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ color: legendTextColor, fontSize: '12px' }} />
                {activeSeries.includes('burrows') ? (
                  <Line
                    type="monotone"
                    dataKey="burrows"
                    name="Burrows"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 5 }}
                  />
                ) : null}
                {activeSeries.includes('clampitt') ? (
                  <Line
                    type="monotone"
                    dataKey="clampitt"
                    name="Clampitt"
                    stroke="#475569"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 5 }}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {trendSeries.length <= 1 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Only one quarter is available today. This trend line is ready and will populate as more quarterly uploads
              are merged into the dataset.
            </p>
          ) : null}
        </div>
      </ChartCard>

      <ChartCard
        title="Quarter Burn Rate Snapshot"
        description="Summary burn rate for the selected quarter."
        ariaLabel="Bar chart comparing quarter burn rate by campaign"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={campaignBars} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="campaign" tick={{ fill: axisTickColor, fontSize: 12 }} />
            <YAxis
              tick={{ fill: axisTickColor, fontSize: 12 }}
              tickFormatter={(value: number) => formatPercent(Number(value) * 100)}
            />
            <Tooltip formatter={(value: number | string) => formatPercent(Number(value) * 100)} />
            <Bar
              dataKey="burnRate"
              name="Burn Rate"
              fill="#f59e0b"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};
