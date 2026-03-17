import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { FinanceCharts } from '../components/finance/FinanceCharts';
import { FinanceComparisonTable } from '../components/finance/FinanceComparisonTable';
import { FinanceDataIntegrityPanel } from '../components/finance/FinanceDataIntegrityPanel';
import { FinanceExpendituresTable } from '../components/finance/FinanceExpendituresTable';
import { FinanceOverviewCards } from '../components/finance/FinanceOverviewCards';
import { FinanceReceiptsTable } from '../components/finance/FinanceReceiptsTable';
import { FinanceUploadPanel } from '../components/finance/FinanceUploadPanel';
import financeSeedData from '../data/financeSeedData';
import { getMostRecentQuarterId, mergeFinanceDatasets } from '../lib/finance/normalize';
import {
  getCampaignReport,
  getQuarterOptions,
  getReportsForQuarter,
  getToplineComparison,
} from '../lib/finance/selectors';
import { loadStoredFinanceDataset, saveStoredFinanceDataset } from '../lib/finance/storage';
import { formatCurrency } from '../lib/format';
import { getFinanceReportIntegrity } from '../lib/finance/validators';
import type { FinanceDataset } from '../lib/finance/types';

type CampaignView = 'both' | 'burrows' | 'clampitt';

interface FinanceIntelligenceProps {
  theme: 'light' | 'dark';
}

export const FinanceIntelligence = ({ theme }: FinanceIntelligenceProps) => {
  const [uploadedDataset, setUploadedDataset] = useState<FinanceDataset>(() => loadStoredFinanceDataset());
  const dataset = useMemo(
    () => mergeFinanceDatasets(financeSeedData, uploadedDataset),
    [uploadedDataset],
  );
  const quarterOptions = useMemo(() => getQuarterOptions(dataset), [dataset]);
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>(
    () => getMostRecentQuarterId(dataset) ?? financeSeedData.quarters[0]?.id ?? '',
  );
  const [campaignView, setCampaignView] = useState<CampaignView>('both');

  useEffect(() => {
    if (!quarterOptions.some((quarter) => quarter.id === selectedQuarterId)) {
      setSelectedQuarterId(quarterOptions[0]?.id ?? '');
    }
  }, [quarterOptions, selectedQuarterId]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Finance Intelligence — NC119 Dashboard';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  const selectedQuarter = quarterOptions.find((quarter) => quarter.id === selectedQuarterId) ?? null;
  const reportsForQuarter = useMemo(
    () => getReportsForQuarter(dataset, selectedQuarterId),
    [dataset, selectedQuarterId],
  );
  const comparison = useMemo(
    () => getToplineComparison(dataset, selectedQuarterId),
    [dataset, selectedQuarterId],
  );
  const burrowsReport = useMemo(
    () => getCampaignReport(dataset, 'burrows', selectedQuarterId),
    [dataset, selectedQuarterId],
  );
  const clampittReport = useMemo(
    () => getCampaignReport(dataset, 'clampitt', selectedQuarterId),
    [dataset, selectedQuarterId],
  );

  const activeDetailReports = useMemo(() => {
    if (campaignView === 'burrows') {
      return burrowsReport ? [burrowsReport] : [];
    }

    if (campaignView === 'clampitt') {
      return clampittReport ? [clampittReport] : [];
    }

    return [burrowsReport, clampittReport].filter((report): report is NonNullable<typeof report> => Boolean(report));
  }, [burrowsReport, campaignView, clampittReport]);

  const quarterIntegrity = useMemo(
    () =>
      reportsForQuarter.map((report) => ({
        report,
        integrity: getFinanceReportIntegrity(report),
      })),
    [reportsForQuarter],
  );

  const warningCount = quarterIntegrity.reduce((sum, row) => sum + row.integrity.issues.length, 0);

  const handleImport = (incoming: FinanceDataset) => {
    setUploadedDataset((current) => {
      const next = mergeFinanceDatasets(current, incoming);
      saveStoredFinanceDataset(next);
      return next;
    });
  };

  return (
    <div className="space-y-10">
      <Card className="overflow-hidden bg-gradient-to-br from-slate-100 via-white to-brand-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-200">
              Campaign finance analysis
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Finance Intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-base text-slate-700 dark:text-slate-200">
              Quarterly finance comparison for Mark Burrows and Mike Clampitt with seeded 2026 Q1 data, runtime CSV or
              JSON ingestion, reconciliation warnings, and reusable quarter-over-quarter comparisons.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-700/20 dark:text-brand-200">
                Seeded with 2026 Q1 finance data
              </span>
              {selectedQuarter ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {selectedQuarter.label}
                </span>
              ) : null}
              {warningCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-700/20 dark:text-amber-200">
                  Data quality warning
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
                Quarter
                <select
                  value={selectedQuarterId}
                  onChange={(event) => setSelectedQuarterId(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {quarterOptions.map((quarter) => (
                    <option key={quarter.id} value={quarter.id}>
                      {quarter.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
                Campaign View
                <select
                  value={campaignView}
                  onChange={(event) => setCampaignView(event.target.value as CampaignView)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="both">Both</option>
                  <option value="burrows">Burrows</option>
                  <option value="clampitt">Clampitt</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Quarter Snapshot
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <p>
                <span className="font-semibold">Reports loaded:</span> {reportsForQuarter.length}
              </p>
              <p>
                <span className="font-semibold">Burrows receipts:</span>{' '}
                {comparison.burrows ? formatCurrency(comparison.burrows.totalReceipts) : 'No data'}
              </p>
              <p>
                <span className="font-semibold">Clampitt receipts:</span>{' '}
                {comparison.clampitt ? formatCurrency(comparison.clampitt.totalReceipts) : 'No data'}
              </p>
              <p>
                <span className="font-semibold">Burrows cash on hand:</span>{' '}
                {comparison.burrows ? formatCurrency(comparison.burrows.cashOnHandEnding) : 'No data'}
              </p>
              <p>
                <span className="font-semibold">Clampitt cash on hand:</span>{' '}
                {comparison.clampitt ? formatCurrency(comparison.clampitt.cashOnHandEnding) : 'No data'}
              </p>
              <p>
                <span className="font-semibold">Warnings:</span> {warningCount}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <FinanceUploadPanel dataset={dataset} onImport={handleImport} />

      <section className="space-y-4" aria-labelledby="finance-overview">
        <SectionHeader
          id="finance-overview"
          title="Overview"
          subtitle="Canonical quarter summary metrics for the selected campaign view."
        />
        <FinanceOverviewCards comparison={comparison} campaignView={campaignView} />
      </section>

      <section className="space-y-4" aria-labelledby="finance-comparison">
        <SectionHeader
          id="finance-comparison"
          title="Comparison"
          subtitle="Burrows vs Clampitt quarter comparison with sortable metrics."
        />
        <FinanceComparisonTable comparison={comparison} />
      </section>

      <section className="space-y-4" aria-labelledby="finance-charts">
        <SectionHeader
          id="finance-charts"
          title="Charts"
          subtitle="Quarter-level finance charts using the same card and chart shell as the rest of the dashboard."
        />
        <FinanceCharts
          dataset={dataset}
          quarterId={selectedQuarterId}
          campaignView={campaignView}
          theme={theme}
        />
      </section>

      <section className="space-y-4" aria-labelledby="finance-receipts">
        <SectionHeader
          id="finance-receipts"
          title="Donor / Receipts Intelligence"
          subtitle="Transaction, donor, and geographic receipt views for the selected quarter."
        />
        <div className={`grid gap-4 ${activeDetailReports.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {activeDetailReports.map((report) => (
            <FinanceReceiptsTable key={`${report.id}-${report.report.quarterId}`} report={report} />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="finance-expenditures">
        <SectionHeader
          id="finance-expenditures"
          title="Expenditure Intelligence"
          subtitle="Vendor, purpose, and expenditure-type summaries for the selected quarter."
        />
        <div className={`grid gap-4 ${activeDetailReports.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {activeDetailReports.map((report) => (
            <FinanceExpendituresTable key={`${report.id}-${report.report.quarterId}`} report={report} />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="finance-integrity">
        <SectionHeader
          id="finance-integrity"
          title="Data Integrity"
          subtitle="Summary-versus-raw reconciliation. Rendering does not fail when mismatches are found."
        />
        <FinanceDataIntegrityPanel reports={reportsForQuarter} />
      </section>
    </div>
  );
};

