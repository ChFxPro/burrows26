import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from '../Card';
import {
  buildDatasetFromCsvReport,
  buildQuarterLabel,
  finalizeCsvReport,
  UNKNOWN_CAMPAIGN_ID,
  UNKNOWN_QUARTER_ID,
} from '../../lib/finance/normalize';
import { parseNcCampaignCsv } from '../../lib/finance/parseNcCampaignCsv';
import { normalizeJsonFinanceDataset } from '../../lib/finance/normalize';
import type {
  FinanceCsvParseResult,
  FinanceDataset,
  FinanceImportSummary,
} from '../../lib/finance/types';

interface FinanceUploadPanelProps {
  dataset: FinanceDataset;
  onImport: (dataset: FinanceDataset) => void;
}

const CAMPAIGN_OPTIONS = [
  { id: 'burrows', label: 'Mark Burrows' },
  { id: 'clampitt', label: 'Mike Clampitt' },
];

const displayNameForCampaignId = (campaignId: string): string => {
  return CAMPAIGN_OPTIONS.find((option) => option.id === campaignId)?.label ?? '';
};

export const FinanceUploadPanel = ({ dataset, onImport }: FinanceUploadPanelProps) => {
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingCsv, setPendingCsv] = useState<FinanceCsvParseResult | null>(null);
  const [pendingJson, setPendingJson] = useState<FinanceImportSummary | null>(null);
  const [campaignId, setCampaignId] = useState('burrows');
  const [displayName, setDisplayName] = useState('Mark Burrows');
  const [quarterId, setQuarterId] = useState('');
  const [quarterLabel, setQuarterLabel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFiled, setDateFiled] = useState('');

  const resetPendingState = () => {
    setPendingCsv(null);
    setPendingJson(null);
  };

  const primeCsvForm = (result: FinanceCsvParseResult) => {
    setCampaignId(result.report.id === UNKNOWN_CAMPAIGN_ID ? 'burrows' : result.report.id);
    setDisplayName(
      result.report.displayName && result.report.id !== UNKNOWN_CAMPAIGN_ID
        ? result.report.displayName
        : displayNameForCampaignId('burrows'),
    );
    setQuarterId(result.quarter.id === UNKNOWN_QUARTER_ID ? '' : result.quarter.id);
    setQuarterLabel(result.quarter.label === 'Campaign Finance Report' ? '' : result.quarter.label);
    setDateFrom(result.quarter.dateFrom);
    setDateTo(result.quarter.dateTo);
    setDateFiled(result.quarter.dateFiled);
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setPendingJson(null);

    const content = await file.text();
    const result = parseNcCampaignCsv(file.name, content);

    if (!result.ok) {
      setPendingCsv(null);
      setError(result.errors.join(' '));
      return;
    }

    setPendingCsv(result.data);
    primeCsvForm(result.data);
  };

  const handleJsonUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setPendingCsv(null);

    const content = await file.text();

    try {
      const parsed = JSON.parse(content);
      const validation = normalizeJsonFinanceDataset(parsed);
      if (!validation.ok) {
        setPendingJson(null);
        setError(validation.errors.join(' '));
        return;
      }

      setPendingJson({
        fileName: file.name,
        sourceType: 'json',
        dataset: validation.data,
        warnings: [],
      });
    } catch {
      setPendingJson(null);
      setError(`Could not load ${file.name}: invalid JSON syntax.`);
    }
  };

  const confirmCsvImport = () => {
    if (!pendingCsv) {
      return;
    }

    if (!campaignId.trim()) {
      setError('Select a campaign before importing the CSV.');
      return;
    }

    if (!quarterId.trim()) {
      setError('Enter a quarter id before importing the CSV.');
      return;
    }

    const finalQuarterLabel = quarterLabel.trim() || buildQuarterLabel(quarterId.trim());
    const finalized = finalizeCsvReport(pendingCsv.report, pendingCsv.quarter, {
      campaignId: campaignId.trim(),
      displayName: displayName.trim() || displayNameForCampaignId(campaignId.trim()) || pendingCsv.report.displayName,
      quarterId: quarterId.trim(),
      quarterLabel: finalQuarterLabel,
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      dateFiled: dateFiled.trim(),
    });

    onImport(
      buildDatasetFromCsvReport(
        finalized.report,
        finalized.quarter,
        `finance-upload-${Date.now()}`,
      ),
    );

    resetPendingState();
    setSuccessMessage(
      `Imported ${finalized.report.displayName} ${finalized.report.report.label}. If this quarter already existed, only that campaign-quarter was replaced.`,
    );
  };

  const confirmJsonImport = () => {
    if (!pendingJson) {
      return;
    }

    onImport(pendingJson.dataset);
    resetPendingState();
    setSuccessMessage(
      `Imported ${pendingJson.dataset.campaigns.length} report${
        pendingJson.dataset.campaigns.length === 1 ? '' : 's'
      } from ${pendingJson.fileName}.`,
    );
  };

  const exportNormalizedDataset = () => {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finance-intelligence.normalized.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Finance Uploads</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Upload NC campaign finance CSV exports or normalized JSON. Imported reports merge into the local dataset
            without removing prior quarters.
          </p>
        </div>
        <button
          type="button"
          onClick={exportNormalizedDataset}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          Export Normalized Dataset
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => csvInputRef.current?.click()}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Upload CSV
        </button>
        <button
          type="button"
          onClick={() => jsonInputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          Upload JSON
        </button>
      </div>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={handleCsvUpload}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={handleJsonUpload}
      />

      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
      {successMessage ? (
        <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</p>
      ) : null}

      {pendingCsv ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              CSV Ready to Import
            </h4>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-700/20 dark:text-brand-200">
              {pendingCsv.fileName}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Detected sections: {pendingCsv.detectedSections.join(', ')}.
          </p>

          {pendingCsv.warnings.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
              {pendingCsv.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Campaign
              <select
                value={campaignId}
                onChange={(event) => {
                  const nextCampaignId = event.target.value;
                  setCampaignId(nextCampaignId);
                  setDisplayName(displayNameForCampaignId(nextCampaignId));
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {CAMPAIGN_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Display Name
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Quarter ID
              <input
                type="text"
                placeholder="2026-Q1"
                value={quarterId}
                onChange={(event) => setQuarterId(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Quarter Label
              <input
                type="text"
                placeholder="2026 First Quarter"
                value={quarterLabel}
                onChange={(event) => setQuarterLabel(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Date From
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Date To
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Date Filed
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dateFiled}
                onChange={(event) => setDateFiled(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmCsvImport}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Import CSV Dataset
            </button>
            <button
              type="button"
              onClick={resetPendingState}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {pendingJson ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              JSON Ready to Import
            </h4>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-700/20 dark:text-brand-200">
              {pendingJson.fileName}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {pendingJson.dataset.campaigns.length} report{pendingJson.dataset.campaigns.length === 1 ? '' : 's'} across{' '}
            {pendingJson.dataset.quarters.length} quarter{pendingJson.dataset.quarters.length === 1 ? '' : 's'} will be
            merged into the runtime dataset.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmJsonImport}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Import JSON Dataset
            </button>
            <button
              type="button"
              onClick={resetPendingState}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
