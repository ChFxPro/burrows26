import { useEffect, useMemo, useState } from 'react';
import { coerceDashboardData } from '../lib/coerce';
import { validateDashboardData } from '../lib/validate';
import type { DashboardData } from '../types';
import { Card } from './Card';

interface JsonEditorOrExportProps {
  data: DashboardData;
  onDataChange: (data: DashboardData) => void;
}

const parseOptionalNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const JsonEditorOrExport = ({ data, onDataChange }: JsonEditorOrExportProps) => {
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(data, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [lastUpdatedISO, setLastUpdatedISO] = useState(data.meta.lastUpdatedISO);
  const [precinctsReportingPct, setPrecinctsReportingPct] = useState(
    data.electionNight.placeholders.precinctsReportingPct?.toString() ?? '',
  );
  const [totalVotesSoFar, setTotalVotesSoFar] = useState(
    data.electionNight.placeholders.totalVotesSoFar?.toString() ?? '',
  );
  const [countyTotals, setCountyTotals] = useState<Record<string, string>>({});

  useEffect(() => {
    setJsonDraft(JSON.stringify(data, null, 2));
    setLastUpdatedISO(data.meta.lastUpdatedISO);
    setPrecinctsReportingPct(data.electionNight.placeholders.precinctsReportingPct?.toString() ?? '');
    setTotalVotesSoFar(data.electionNight.placeholders.totalVotesSoFar?.toString() ?? '');

    const nextCountyTotals: Record<string, string> = {};
    data.nc119.counties.forEach((county) => {
      nextCountyTotals[county.county] = county.total.toString();
    });
    setCountyTotals(nextCountyTotals);
  }, [data]);

  const countyFields = useMemo(() => data.nc119.counties.map((county) => county.county), [data]);

  const applyQuickEdits = () => {
    const updated = structuredClone(data);
    updated.meta.lastUpdatedISO = lastUpdatedISO;
    updated.electionNight.placeholders.precinctsReportingPct = parseOptionalNumber(precinctsReportingPct);
    updated.electionNight.placeholders.totalVotesSoFar = parseOptionalNumber(totalVotesSoFar);

    updated.nc119.counties = updated.nc119.counties.map((county) => {
      const candidate = Number(countyTotals[county.county]);
      return {
        ...county,
        total: Number.isFinite(candidate) ? candidate : county.total,
      };
    });

    const result = validateDashboardData(updated);
    if (!result.ok) {
      setJsonError(result.errors.join(' '));
      return;
    }

    setJsonError(null);
    onDataChange(result.data);
    setJsonDraft(JSON.stringify(result.data, null, 2));
  };

  const applyJsonDraft = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      const result = coerceDashboardData(parsed);
      if (!result.ok) {
        setJsonError(result.errors.join(' '));
        return;
      }

      setJsonError(null);
      onDataChange(result.data);
    } catch {
      setJsonError('JSON parse failed. Check for trailing commas and quote mismatches.');
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dashboardData.updated.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-brand-200 dark:border-brand-700">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Election Night Update Mode
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Edit key fields fast or paste a full JSON payload. Apply changes live and download updated JSON.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Quick Edits
          </h4>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
            Last Updated ISO
            <input
              type="text"
              value={lastUpdatedISO}
              onChange={(event) => setLastUpdatedISO(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
            Precincts Reporting %
            <input
              type="number"
              inputMode="decimal"
              value={precinctsReportingPct}
              onChange={(event) => setPrecinctsReportingPct(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
            Total Votes So Far
            <input
              type="number"
              inputMode="numeric"
              value={totalVotesSoFar}
              onChange={(event) => setTotalVotesSoFar(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            {countyFields.map((county) => (
              <label key={county} className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
                {county} total
                <input
                  type="number"
                  inputMode="numeric"
                  value={countyTotals[county] ?? ''}
                  onChange={(event) =>
                    setCountyTotals((current) => ({
                      ...current,
                      [county]: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={applyQuickEdits}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Apply Quick Edits
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            JSON Editor
          </h4>
          <textarea
            aria-label="JSON editor"
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            className="h-80 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyJsonDraft}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Apply JSON to Dashboard
            </button>
            <button
              type="button"
              onClick={downloadJson}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Download Updated JSON
            </button>
          </div>
          {jsonError ? <p className="text-sm text-red-700 dark:text-red-400">{jsonError}</p> : null}
        </div>
      </div>
    </Card>
  );
};
