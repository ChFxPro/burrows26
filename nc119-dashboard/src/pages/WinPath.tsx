import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { formatIsoDateTime, formatNumber, formatPercent } from '../lib/format';
import { loadNc119VoterAggregates } from '../lib/loadNc119VoterAggregates';
import {
  DEFAULT_WIN_PATH_SUPPORT_RATES,
  DEFAULT_WIN_PATH_TURNOUT_MULTIPLIERS,
  DEFAULT_WIN_PATH_TURNOUT_SCENARIOS,
  WIN_PATH_SCENARIO_LABELS,
  buildWinPathScenarioProjections,
  splitPartyCounts,
  type WinPathScenarioKey,
  type WinPathSupportRates,
  type WinPathTurnoutMultipliers,
  type WinPathTurnoutScenarios,
} from '../lib/winPathModel';

const aggregates = loadNc119VoterAggregates();

const WIN_PATH_TITLE = 'NC119 Win Path Model — Mark Burrows';
const WIN_PATH_DESCRIPTION =
  'Scenario-based vote targets for NC House District 119 using aggregated active registration composition only.';
const WIN_PATH_JSON_LD_ID = 'nc119-win-path-jsonld';
const SCENARIO_ORDER: WinPathScenarioKey[] = ['low', 'medium', 'high'];

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
};

const formatRate = (value: number, decimals = 1): string => {
  return formatPercent(value * 100, decimals);
};

const describeUnaffiliatedBurden = (requiredShare: number): string => {
  if (requiredShare >= 0.6) {
    return 'High burden';
  }

  if (requiredShare >= 0.35) {
    return 'Moderate burden';
  }

  if (requiredShare > 0) {
    return 'Lower burden';
  }

  return 'No added burden';
};

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  valueFormatter: (value: number) => string;
  hint?: string;
}

const SliderControl = ({ label, value, min, max, step, onChange, valueFormatter, hint }: SliderControlProps) => {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {valueFormatter(value)}
        </span>
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-brand-600"
      />
    </label>
  );
};

export const WinPath = () => {
  const [selectedScenario, setSelectedScenario] = useState<WinPathScenarioKey>('medium');
  const [turnoutScenarios, setTurnoutScenarios] = useState<WinPathTurnoutScenarios>({
    ...DEFAULT_WIN_PATH_TURNOUT_SCENARIOS,
  });
  const [supportRates, setSupportRates] = useState<WinPathSupportRates>({
    ...DEFAULT_WIN_PATH_SUPPORT_RATES,
  });
  const [turnoutMultipliers, setTurnoutMultipliers] = useState<WinPathTurnoutMultipliers>({
    ...DEFAULT_WIN_PATH_TURNOUT_MULTIPLIERS,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAssumptionsOnMobile, setShowAssumptionsOnMobile] = useState(false);

  const partyCounts = useMemo(
    () =>
      splitPartyCounts(
        aggregates.counts.activeVotersHD119.byParty,
        aggregates.counts.activeVotersHD119.districtTotal,
      ),
    [],
  );

  const scenarioProjections = useMemo(
    () =>
      buildWinPathScenarioProjections({
        turnoutScenarios,
        partyCounts,
        supportRates,
        turnoutMultipliers,
      }),
    [partyCounts, supportRates, turnoutMultipliers, turnoutScenarios],
  );

  const selectedProjection = scenarioProjections[selectedScenario];

  const countyRows = useMemo(
    () =>
      Object.entries(aggregates.counts.activeVotersHD119.byCounty)
        .map(([county, voters]) => ({ county, voters }))
        .sort((left, right) => right.voters - left.voters),
    [],
  );

  const precinctRows = useMemo(
    () =>
      Object.entries(aggregates.counts.precinctParty.byCounty)
        .map(([county, precincts]) => ({ county, precinctCount: Object.keys(precincts).length }))
        .sort((left, right) => right.precinctCount - left.precinctCount),
    [],
  );

  const totalPrecinctsTracked = useMemo(
    () => precinctRows.reduce((sum, row) => sum + row.precinctCount, 0),
    [precinctRows],
  );

  const partyCompositionRows = useMemo(() => {
    const total = Math.max(1, partyCounts.totalActive);

    return [
      {
        key: 'dem',
        label: 'Democratic',
        count: partyCounts.dem,
        share: partyCounts.dem / total,
        colorClass: 'bg-sky-500',
      },
      {
        key: 'rep',
        label: 'Republican',
        count: partyCounts.rep,
        share: partyCounts.rep / total,
        colorClass: 'bg-rose-500',
      },
      {
        key: 'una',
        label: 'Unaffiliated',
        count: partyCounts.una,
        share: partyCounts.una / total,
        colorClass: 'bg-brand-500',
      },
      {
        key: 'other',
        label: 'Other',
        count: partyCounts.other,
        share: partyCounts.other / total,
        colorClass: 'bg-amber-500',
      },
    ];
  }, [partyCounts.dem, partyCounts.other, partyCounts.rep, partyCounts.totalActive, partyCounts.una]);

  const ageBandRows = useMemo(() => {
    const preferredOrder = ['18-24', '25-34', '35-44', '45-54', '55-64', '65-74', '75+'];
    const districtAgeCounts = aggregates.counts.ageBands.district;

    return preferredOrder
      .filter((band) => typeof districtAgeCounts[band] === 'number')
      .map((band) => ({
        band,
        count: districtAgeCounts[band],
      }));
  }, []);

  const maxAgeBandCount = useMemo(
    () => ageBandRows.reduce((maxValue, row) => Math.max(maxValue, row.count), 1),
    [ageBandRows],
  );

  const visualizationVotes = Math.max(
    selectedProjection.projectedBurrowsVotes,
    selectedProjection.votesToWin,
    1,
  );
  const projectedWidthPct = clampPercent((selectedProjection.projectedBurrowsVotes / visualizationVotes) * 100);
  const gapWidthPct = clampPercent((selectedProjection.persuasionVotesNeeded / visualizationVotes) * 100);
  const winLinePct = clampPercent((selectedProjection.votesToWin / visualizationVotes) * 100);

  const resetDefaults = () => {
    setTurnoutScenarios({ ...DEFAULT_WIN_PATH_TURNOUT_SCENARIOS });
    setSupportRates({ ...DEFAULT_WIN_PATH_SUPPORT_RATES });
    setTurnoutMultipliers({ ...DEFAULT_WIN_PATH_TURNOUT_MULTIPLIERS });
  };

  const updateSelectedScenarioTurnout = (nextPercent: number) => {
    const nextRate = nextPercent / 100;
    setTurnoutScenarios((current) => ({
      ...current,
      [selectedScenario]: nextRate,
    }));
  };

  const updateSupportRate = (key: 'dem' | 'rep' | 'una') => (nextPercent: number) => {
    const nextRate = nextPercent / 100;
    setSupportRates((current) => ({
      ...current,
      [key]: nextRate,
    }));
  };

  const updateTurnoutMultiplier = (key: 'dem' | 'rep' | 'una') => (nextValue: number) => {
    setTurnoutMultipliers((current) => ({
      ...current,
      [key]: nextValue,
    }));
  };

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = descriptionMeta?.getAttribute('content') ?? null;

    document.title = WIN_PATH_TITLE;

    let createdDescriptionMeta = false;
    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', WIN_PATH_DESCRIPTION);
    } else {
      const nextDescriptionMeta = document.createElement('meta');
      nextDescriptionMeta.name = 'description';
      nextDescriptionMeta.content = WIN_PATH_DESCRIPTION;
      document.head.appendChild(nextDescriptionMeta);
      createdDescriptionMeta = true;
    }

    const winPathUrl = new URL(window.location.pathname, window.location.origin).toString();
    const existingJsonLd = document.getElementById(WIN_PATH_JSON_LD_ID);
    if (existingJsonLd) {
      existingJsonLd.remove();
    }

    const jsonLdScript = document.createElement('script');
    jsonLdScript.id = WIN_PATH_JSON_LD_ID;
    jsonLdScript.type = 'application/ld+json';
    jsonLdScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: WIN_PATH_TITLE,
          description: WIN_PATH_DESCRIPTION,
          url: winPathUrl,
        },
        {
          '@type': 'Dataset',
          name: 'NC119 Voter Core Aggregates v1',
          description:
            'Aggregated active voter counts for NC House District 119 by county, party, age band, and precinct-party buckets.',
          url: winPathUrl,
          dateModified: aggregates.meta.generatedAtISO,
        },
      ],
    });
    document.head.appendChild(jsonLdScript);

    return () => {
      document.title = previousTitle;

      if (descriptionMeta) {
        if (previousDescription !== null) {
          descriptionMeta.setAttribute('content', previousDescription);
        }
      } else if (createdDescriptionMeta) {
        const createdMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (createdMeta) {
          createdMeta.remove();
        }
      }

      jsonLdScript.remove();
    };
  }, []);

  return (
    <div className="space-y-8">
      <Card className="animate-fadeIn overflow-hidden bg-gradient-to-br from-slate-100 via-white to-brand-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-200">
              Decision Tool
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Win Path — NC House 119
            </h1>
            <p className="mt-3 text-base text-slate-700 dark:text-slate-200">
              Scenario-based vote targets using active registration composition (no individual voter data).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Data Freshness
            </h2>
            <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Generated</dt>
                <dd className="text-right">
                  <time dateTime={aggregates.meta.generatedAtISO}>
                    {formatIsoDateTime(aggregates.meta.generatedAtISO)}
                  </time>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Active voters</dt>
                <dd className="text-right">{formatNumber(partyCounts.totalActive)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Schema</dt>
                <dd className="text-right">{aggregates.meta.schemaVersion}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      <section className="space-y-4" aria-labelledby="win-path-scenarios">
        <SectionHeader
          id="win-path-scenarios"
          title="Turnout Scenarios"
          subtitle="Click a scenario to focus the model and adjust assumptions."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {SCENARIO_ORDER.map((scenarioKey) => {
            const projection = scenarioProjections[scenarioKey];
            const isSelected = scenarioKey === selectedScenario;

            return (
              <button
                type="button"
                key={scenarioKey}
                onClick={() => setSelectedScenario(scenarioKey)}
                className={`h-full rounded-2xl border p-5 text-left shadow-card transition ${
                  isSelected
                    ? 'border-brand-300 bg-brand-50/90 ring-2 ring-brand-200 dark:border-brand-500/80 dark:bg-brand-700/20 dark:ring-brand-500/40'
                    : 'border-slate-200/90 bg-white/85 hover:border-brand-200 hover:bg-brand-50/40 dark:border-slate-700/90 dark:bg-slate-900/85 dark:hover:border-brand-600/70 dark:hover:bg-brand-700/15'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {WIN_PATH_SCENARIO_LABELS[scenarioKey]}
                  </h3>
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                    {formatRate(projection.turnoutRate)}
                  </span>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3 text-slate-700 dark:text-slate-200">
                    <dt>Projected votes cast</dt>
                    <dd className="font-semibold">{formatNumber(projection.projectedTotalVotes)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-700 dark:text-slate-200">
                    <dt>Votes needed to win</dt>
                    <dd className="font-semibold">{formatNumber(projection.votesToWin)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-700 dark:text-slate-200">
                    <dt>Projected Burrows votes</dt>
                    <dd className="font-semibold">{formatNumber(projection.projectedBurrowsVotes)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-700 dark:text-slate-200">
                    <dt>{projection.persuasionVotesNeeded > 0 ? 'Gap to win' : 'Projected margin'}</dt>
                    <dd
                      className={`font-semibold ${
                        projection.persuasionVotesNeeded > 0
                          ? 'text-rose-600 dark:text-rose-300'
                          : 'text-brand-700 dark:text-brand-200'
                      }`}
                    >
                      {formatNumber(
                        projection.persuasionVotesNeeded > 0
                          ? projection.persuasionVotesNeeded
                          : projection.winMarginEstimate,
                      )}
                    </dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      </section>

      <div className="xl:hidden">
        <button
          type="button"
          onClick={() => setShowAssumptionsOnMobile((current) => !current)}
          className="w-full rounded-xl border border-slate-300 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:border-brand-500 dark:hover:text-brand-200"
        >
          {showAssumptionsOnMobile ? 'Hide Assumptions' : 'Show Assumptions'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Path to Win</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Selected scenario: <span className="font-semibold">{WIN_PATH_SCENARIO_LABELS[selectedScenario]}</span>
              </p>

              <div className="group mt-5 space-y-3">
                <div className="relative rounded-xl border border-slate-200/90 bg-slate-100/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="relative h-12 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
                    <div
                      className="absolute inset-y-0 left-0 rounded-l-lg bg-brand-600 transition-all duration-200 group-hover:opacity-90 dark:bg-brand-500"
                      style={{ width: `${projectedWidthPct}%` }}
                    />
                    {selectedProjection.persuasionVotesNeeded > 0 ? (
                      <div
                        className="absolute inset-y-0 border-l border-white/80 transition-all duration-200 group-hover:opacity-90 dark:border-slate-800/80"
                        style={{
                          left: `${projectedWidthPct}%`,
                          width: `${gapWidthPct}%`,
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(244,63,94,0.2) 0px, rgba(244,63,94,0.2) 8px, rgba(15,23,42,0.0) 8px, rgba(15,23,42,0.0) 14px)',
                          backgroundColor: 'rgba(244, 63, 94, 0.12)',
                        }}
                      />
                    ) : null}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-slate-900/80 dark:bg-slate-100/85"
                      style={{ left: `${winLinePct}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                    style={{ left: `${winLinePct}%` }}
                  >
                    Win line {formatNumber(selectedProjection.votesToWin)}
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Projected Burrows:</span>{' '}
                    {formatNumber(selectedProjection.projectedBurrowsVotes)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Votes still needed:</span>{' '}
                    {formatNumber(selectedProjection.persuasionVotesNeeded)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Projected margin:</span>{' '}
                    {formatNumber(selectedProjection.winMarginEstimate)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Persuasion Focus</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Gap closure pressure on Unaffiliated turnout in the selected scenario.
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Extra votes needed
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-rose-600 dark:text-rose-300">
                    {formatNumber(selectedProjection.persuasionVotesNeeded)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Required share of Unaffiliated turnout
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {formatRate(selectedProjection.requiredUnaffiliatedShare, 1)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {formatNumber(selectedProjection.requiredExtraFromUnaffiliated)} of{' '}
                    {formatNumber(selectedProjection.unaffiliatedTurnoutVotes)} modeled Unaffiliated turnout votes.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Unaffiliated decisive share
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {describeUnaffiliatedBurden(selectedProjection.requiredUnaffiliatedShare)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-brand-600 dark:bg-brand-500"
                      style={{ width: `${clampPercent(selectedProjection.requiredUnaffiliatedShare * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">District Composition</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Aggregated active voter context by county, party, age, and precinct buckets.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Active Voters by County
                </h3>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {countyRows.map((row) => (
                    <div key={row.county} className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.county}</span>
                      <span className="font-semibold">{formatNumber(row.voters)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  District total: {formatNumber(partyCounts.totalActive)} active voters.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Party Composition
                </h3>
                <div className="h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="flex h-full w-full">
                    {partyCompositionRows.map((row) => (
                      <div
                        key={row.key}
                        className={`${row.colorClass} h-full`}
                        style={{ width: `${clampPercent(row.share * 100)}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {partyCompositionRows.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${row.colorClass}`} />
                        <span>{row.label}</span>
                      </span>
                      <span className="font-semibold">
                        {formatNumber(row.count)} ({formatRate(row.share, 1)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  District Age Bands
                </h3>
                <div className="mt-2 space-y-2">
                  {ageBandRows.map((row) => (
                    <div key={row.band} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{row.band}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-slate-500 dark:bg-slate-300"
                          style={{ width: `${clampPercent((row.count / maxAgeBandCount) * 100)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(row.count)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Precinct Buckets
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {formatNumber(totalPrecinctsTracked)} precinct rows represented in aggregate county-party counts.
                </p>
                <div className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                  {precinctRows.map((row) => (
                    <div key={row.county} className="flex items-center justify-between gap-2">
                      <span>{row.county}</span>
                      <span className="font-semibold">{formatNumber(row.precinctCount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
                How this is calculated
              </summary>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  Per scenario, projected votes cast = <code>round(active_voters * turnout_rate)</code>, and votes to win
                  = <code>floor(projected_votes / 2) + 1</code>.
                </p>
                <p>
                  Burrows projection = <code>D_base + R_crossover + U_support + Other_support</code> where each component
                  follows <code>round(group_count * turnout_rate * turnout_multiplier * support_rate)</code>.
                </p>
                <p>
                  Persuasion need = <code>max(0, votes_to_win - projected_Burrows_votes)</code>. Unaffiliated share needed
                  = <code>min(gap, U_turnout_votes) / max(1, U_turnout_votes)</code>.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Party buckets use active voter counts only: DEM, REP, UNA, and Other (all non-major parties combined).
                </p>
              </div>
            </details>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Data Source
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              NC voter registration exports (Jackson, Swain, Transylvania) filtered to Active voters in NC House
              District 119; aggregated counts only.
            </p>
            <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="font-semibold">Scope</dt>
                <dd className="text-right">{aggregates.meta.scope}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="font-semibold">Schema version</dt>
                <dd>{aggregates.meta.schemaVersion}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="font-semibold">Filters</dt>
                <dd className="text-right">{Object.entries(aggregates.meta.filters).map(([key, value]) => `${key}=${value}`).join(', ')}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <aside className={`space-y-6 ${showAssumptionsOnMobile ? 'block' : 'hidden'} xl:block`}>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assumptions</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Edit rates to pressure-test each scenario.
                </p>
              </div>
              <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:border-brand-600 dark:bg-brand-700/20 dark:text-brand-100">
                {WIN_PATH_SCENARIO_LABELS[selectedScenario]}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <SliderControl
                label="Turnout rate (selected scenario)"
                value={turnoutScenarios[selectedScenario] * 100}
                min={20}
                max={75}
                step={1}
                onChange={updateSelectedScenarioTurnout}
                valueFormatter={(value) => formatPercent(value, 1)}
              />

              <SliderControl
                label="Dem registrants for Burrows"
                value={supportRates.dem * 100}
                min={70}
                max={100}
                step={1}
                onChange={updateSupportRate('dem')}
                valueFormatter={(value) => formatPercent(value, 1)}
              />

              <SliderControl
                label="Rep crossover to Burrows"
                value={supportRates.rep * 100}
                min={0}
                max={30}
                step={1}
                onChange={updateSupportRate('rep')}
                valueFormatter={(value) => formatPercent(value, 1)}
              />

              <SliderControl
                label="Unaffiliated for Burrows"
                value={supportRates.una * 100}
                min={20}
                max={80}
                step={1}
                onChange={updateSupportRate('una')}
                valueFormatter={(value) => formatPercent(value, 1)}
              />

              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-200"
              >
                {showAdvanced ? 'Hide advanced turnout multipliers' : 'Show advanced turnout multipliers'}
              </button>

              {showAdvanced ? (
                <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                  <SliderControl
                    label="D turnout multiplier"
                    value={turnoutMultipliers.dem}
                    min={0.7}
                    max={1.3}
                    step={0.01}
                    onChange={updateTurnoutMultiplier('dem')}
                    valueFormatter={(value) => value.toFixed(2)}
                    hint="Scales Democratic turnout relative to selected scenario turnout."
                  />
                  <SliderControl
                    label="R turnout multiplier"
                    value={turnoutMultipliers.rep}
                    min={0.7}
                    max={1.3}
                    step={0.01}
                    onChange={updateTurnoutMultiplier('rep')}
                    valueFormatter={(value) => value.toFixed(2)}
                    hint="Scales Republican turnout relative to selected scenario turnout."
                  />
                  <SliderControl
                    label="U turnout multiplier"
                    value={turnoutMultipliers.una}
                    min={0.7}
                    max={1.3}
                    step={0.01}
                    onChange={updateTurnoutMultiplier('una')}
                    valueFormatter={(value) => value.toFixed(2)}
                    hint="Scales Unaffiliated turnout relative to selected scenario turnout."
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={resetDefaults}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Reset defaults
              </button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};
