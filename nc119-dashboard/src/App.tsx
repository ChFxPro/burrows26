import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from './components/Card';
import { ChartCard } from './components/ChartCard';
import { CountyTable } from './components/CountyTable';
import { JsonEditorOrExport } from './components/JsonEditorOrExport';
import { JsonUpload } from './components/JsonUpload';
import { SectionHeader } from './components/SectionHeader';
import { StatTile } from './components/StatTile';
import { ThemeToggle } from './components/ThemeToggle';
import rawDashboardData from './data/nc_primary_2026_absentee_early_reference_20260303.json';
import logoWhite from './imgs/logo-white.png';
import {
  buildPartyComparisonRows,
  compute2022Delta,
  computeNc119DistrictTotal,
  computeOverUnderIndex,
  computeStatewideMethodPct,
} from './lib/compute';
import { coerceDashboardData } from './lib/coerce';
import {
  formatIsoDateTime,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
} from './lib/format';
import type { DashboardData } from './types';

const THEME_STORAGE_KEY = 'nc119-theme';

const chartPalette = {
  brand: '#059669',
  slate: '#475569',
  blue: '#0ea5e9',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  red: '#ef4444',
};

const navItems = [
  { href: '#overview', label: 'Overview' },
  { href: '#methods', label: 'Methods' },
  { href: '#party', label: 'Party' },
  { href: '#nc119', label: 'NC119' },
];

type AppTab = 'overview' | 'admin';

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialValidation = coerceDashboardData(rawDashboardData);

const App = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [data, setData] = useState<DashboardData | null>(initialValidation.ok ? initialValidation.data : null);
  const [errors, setErrors] = useState<string[]>(initialValidation.ok ? [] : initialValidation.errors);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const updateData = (next: DashboardData) => {
    setData(next);
    setErrors([]);
    setUploadError(null);
  };

  const handleJsonUpload = async ({
    fileName,
    content,
  }: {
    fileName: string;
    content: string;
  }): Promise<void> => {
    setIsUploading(true);
    setUploadError(null);

    await new Promise((resolve) => window.setTimeout(resolve, 220));

    try {
      const parsed = JSON.parse(content);
      const validation = coerceDashboardData(parsed);
      if (!validation.ok) {
        setUploadError(`Could not load ${fileName}: ${validation.errors.join(' ')}`);
        return;
      }

      updateData(validation.data);
    } catch {
      setUploadError(`Could not load ${fileName}: invalid JSON syntax.`);
    } finally {
      setIsUploading(false);
    }
  };

  const derived = useMemo(() => {
    if (!data) {
      return null;
    }

    const statewideMethodPct = computeStatewideMethodPct(data);
    const comparisonDelta = compute2022Delta(data);
    const nc119DistrictTotal = computeNc119DistrictTotal(data);
    const overUnderIndex = computeOverUnderIndex(data);
    const partyComparisonRows = buildPartyComparisonRows(data);

    const countyTotals = data.nc119.counties.map((county) => ({
      county: county.county,
      total: county.total,
    }));

    const countyMethodBreakdown = data.nc119.counties.map((county) => ({
      county: county.county,
      inPersonEarly: county.inPersonEarly,
      civilianMail: county.civilianMail,
      militaryMail: county.militaryMail,
      overseasMail: county.overseasMail,
    }));

    const districtSharePct =
      data.statewide.totalBallotsCast > 0 ? (nc119DistrictTotal / data.statewide.totalBallotsCast) * 100 : 0;

    const deltaCountLabel = `${comparisonDelta.delta > 0 ? '+' : ''}${formatNumber(comparisonDelta.delta)}`;

    return {
      statewideMethodPct,
      comparisonDelta,
      nc119DistrictTotal,
      overUnderIndex,
      partyComparisonRows,
      countyTotals,
      countyMethodBreakdown,
      districtSharePct,
      deltaCountLabel,
    };
  }, [data]);

  if (!data || !derived) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-dashboard px-4 py-10 sm:px-6 lg:px-8">
        <Card className="animate-fadeIn border-red-200 dark:border-red-700">
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-slate-100">
            NC119 Dashboard data error
          </h1>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            The default source JSON payload did not pass validation.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-400">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <div className="mt-6">
            <JsonUpload onLoad={handleJsonUpload} isLoading={isUploading} error={uploadError} />
          </div>
        </Card>
      </main>
    );
  }

  const {
    statewideMethodPct,
    comparisonDelta,
    nc119DistrictTotal,
    overUnderIndex,
    partyComparisonRows,
    countyTotals,
    countyMethodBreakdown,
    districtSharePct,
    deltaCountLabel,
  } = derived;

  return (
    <div className="min-h-screen text-slate-900 transition-colors duration-300 dark:text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-colors dark:border-slate-700/80 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-dashboard flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex shrink-0 items-center rounded-lg bg-slate-900 px-2 py-1 shadow-sm ring-1 ring-slate-700 dark:bg-slate-950">
              <img src={logoWhite} alt="NC119 Dashboard" className="h-8 w-auto sm:h-9" />
            </div>

            <div
              role="tablist"
              aria-label="Dashboard mode"
              className="inline-flex rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  activeTab === 'overview'
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-200 dark:hover:bg-brand-700/20 dark:hover:text-brand-100'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'admin'}
                onClick={() => setActiveTab('admin')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  activeTab === 'admin'
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-200 dark:hover:bg-brand-700/20 dark:hover:text-brand-100'
                }`}
              >
                Admin
              </button>
            </div>

            {activeTab === 'overview' ? (
              <nav aria-label="Section navigation" className="flex flex-wrap gap-2">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-2 py-1 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-brand-700/20 dark:hover:text-brand-100"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'admin' ? (
              <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:border-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                Election Night Tools
              </span>
            ) : null}
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-dashboard space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="animate-fadeIn overflow-hidden bg-gradient-to-br from-slate-100 via-white to-brand-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-200">
                NC election snapshot
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                {data.meta.title}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-700 dark:text-slate-200">
                {data.meta.subtitle}
              </p>

              <div className="mt-5 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  <span className="font-semibold">Last updated:</span>{' '}
                  <time dateTime={data.meta.lastUpdatedISO}>{formatIsoDateTime(data.meta.lastUpdatedISO)}</time>
                </p>
                <p>
                  <span className="font-semibold">Data through:</span>{' '}
                  <time dateTime={data.meta.dataThroughISO}>{formatIsoDateTime(data.meta.dataThroughISO)}</time>
                </p>
                <p>
                  <span className="font-semibold">Source:</span> {data.meta.source}
                </p>
                <p>
                  <span className="font-semibold">Source file:</span> {data.meta.sourceFile}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Notes
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {data.meta.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {activeTab === 'overview' ? (
          <>
            <section className="space-y-4" aria-labelledby="overview">
              <SectionHeader
                id="overview"
                title="Statewide Early and Absentee Overview"
                subtitle="At-a-glance primary participation and baseline comparison"
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Total Ballots Cast" value={formatNumber(data.statewide.totalBallotsCast)} accent />
                <StatTile
                  label="Turnout"
                  value={formatPercent(data.statewide.turnoutPct)}
                  note="Share of eligible statewide voters"
                />
                <StatTile
                  label="Eligible Voters"
                  value={formatNumber(data.statewide.eligibleVoters)}
                  note="Registered voters in statewide file"
                />
                <StatTile
                  label="2022 Delta"
                  value={deltaCountLabel}
                  note={`${formatSignedPercent(comparisonDelta.deltaPct)} vs 2022 accepted ballots`}
                />
              </div>
            </section>

            <section className="space-y-4" aria-labelledby="methods">
              <SectionHeader
                id="methods"
                title="Ballots by Method"
                subtitle="Statewide early voting and absentee composition"
              />
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ChartCard
                    title="Accepted Ballots by Method"
                    description="Count by voting method with totals from statewide reporting"
                    ariaLabel="Bar chart of statewide ballots by voting method"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statewideMethodPct} margin={{ top: 16, right: 16, left: 8, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b840" />
                        <XAxis dataKey="method" angle={-18} textAnchor="end" interval={0} height={64} />
                        <YAxis />
                        <Tooltip
                          formatter={(value: number | string) => formatNumber(Number(value))}
                          contentStyle={{ borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}
                        />
                        <Bar dataKey="count" fill={chartPalette.brand} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <Card>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Method Detail</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Method
                          </th>
                          <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Count
                          </th>
                          <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Share
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {statewideMethodPct.map((row) => (
                          <tr key={row.method} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-1 py-2 text-sm text-slate-700 dark:text-slate-200">{row.method}</td>
                            <td className="px-1 py-2 text-right text-sm text-slate-900 dark:text-slate-100">
                              {formatNumber(row.count)}
                            </td>
                            <td className="px-1 py-2 text-right text-sm text-slate-900 dark:text-slate-100">
                              {formatPercent(row.pct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </section>

            <section className="space-y-4" aria-labelledby="party">
              <SectionHeader
                id="party"
                title="Party Performance"
                subtitle="Registration baseline vs ballots cast share and party turnout rates"
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Registration % vs Ballot Share %"
                  description="Grouped party bars compare registration proportion with ballots cast share"
                  ariaLabel="Grouped bar chart of party registration percentage and ballot share percentage"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={partyComparisonRows} margin={{ top: 16, right: 16, left: 8, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b840" />
                      <XAxis dataKey="party" />
                      <YAxis unit="%" />
                      <Tooltip
                        formatter={(value: number | string) => formatPercent(Number(value))}
                        contentStyle={{ borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}
                      />
                      <Legend />
                      <Bar dataKey="registrationPct" name="Registration %" fill={chartPalette.slate} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="ballotSharePct" name="Ballot Share %" fill={chartPalette.brand} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Turnout Rate Within Party"
                  description="Ballots cast as a share of registered voters by party"
                  ariaLabel="Bar chart of turnout rates within each party"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.party.ballotsCast} margin={{ top: 16, right: 16, left: 8, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b840" />
                      <XAxis dataKey="party" />
                      <YAxis unit="%" />
                      <Tooltip
                        formatter={(value: number | string) => formatPercent(Number(value))}
                        contentStyle={{ borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}
                      />
                      <Bar dataKey="turnoutPct" fill={chartPalette.blue} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <Card>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Over/Under Index</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Ballot share minus registration share by party.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Party
                        </th>
                        <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Registration %
                        </th>
                        <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Ballot Share %
                        </th>
                        <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Over/Under
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overUnderIndex.map((row) => (
                        <tr key={row.party} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.party}
                          </td>
                          <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                            {formatPercent(row.registrationPct)}
                          </td>
                          <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                            {formatPercent(row.ballotSharePct)}
                          </td>
                          <td
                            className={`px-1 py-2 text-right text-sm font-semibold ${
                              row.overUnderPct >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {formatSignedPoints(row.overUnderPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.party.minorPartiesNote}</p>
              </Card>
            </section>

            <section className="space-y-4" aria-labelledby="nc119">
              <SectionHeader
                id="nc119"
                title={`${data.nc119.districtLabel} County Roll-up`}
                subtitle="Jackson, Swain, and Transylvania county turnout summary"
              />

              <div className="grid gap-4 lg:grid-cols-3">
                <StatTile label="District Total Ballots" value={formatNumber(nc119DistrictTotal)} accent />
                <StatTile
                  label="Counties Included"
                  value={formatNumber(data.nc119.counties.length)}
                  note="Jackson, Swain, Transylvania"
                />
                <StatTile
                  label="District Share of Statewide"
                  value={formatPercent(districtSharePct)}
                  note="NC119 total divided by statewide ballots"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="County Totals"
                  description="Total accepted early and absentee ballots by county"
                  ariaLabel="Bar chart of county totals for NC119"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countyTotals} margin={{ top: 16, right: 16, left: 8, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b840" />
                      <XAxis dataKey="county" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number | string) => formatNumber(Number(value))}
                        contentStyle={{ borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}
                      />
                      <Bar dataKey="total" fill={chartPalette.violet} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Method Breakdown by County"
                  description="Stacked view of in-person early and absentee method totals"
                  ariaLabel="Stacked bar chart of ballot methods for each NC119 county"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countyMethodBreakdown} margin={{ top: 16, right: 16, left: 8, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b840" />
                      <XAxis dataKey="county" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number | string) => formatNumber(Number(value))}
                        contentStyle={{ borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}
                      />
                      <Legend />
                      <Bar dataKey="inPersonEarly" stackId="methods" fill={chartPalette.brand} />
                      <Bar dataKey="civilianMail" stackId="methods" fill={chartPalette.blue} />
                      <Bar dataKey="militaryMail" stackId="methods" fill={chartPalette.amber} />
                      <Bar dataKey="overseasMail" stackId="methods" fill={chartPalette.red} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <CountyTable counties={data.nc119.counties} />
            </section>
          </>
        ) : (
          <section className="space-y-4" aria-labelledby="updates">
            <SectionHeader
              id="updates"
              title="Election Night Update Mode"
              subtitle="Live editing for rapid updates without backend changes"
            />

            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Live Election Night Snapshot</h3>
                <dl className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold">Mode</dt>
                    <dd>{data.electionNight.enabled ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold">Precincts reporting</dt>
                    <dd>
                      {data.electionNight.placeholders.precinctsReportingPct === null
                        ? 'Not reported'
                        : formatPercent(data.electionNight.placeholders.precinctsReportingPct)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold">Total votes so far</dt>
                    <dd>
                      {data.electionNight.placeholders.totalVotesSoFar === null
                        ? 'Not reported'
                        : formatNumber(data.electionNight.placeholders.totalVotesSoFar)}
                    </dd>
                  </div>
                </dl>

                {data.electionNight.placeholders.topRaces.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Top races
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      {data.electionNight.placeholders.topRaces.map((race) => (
                        <li
                          key={race.race}
                          className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                        >
                          <p className="font-semibold">{race.race}</p>
                          <p>
                            {race.leader} · {formatNumber(race.votes)} ({formatPercent(race.pct)})
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    No race-level placeholders added yet.
                  </p>
                )}
              </Card>

              <div className="xl:col-span-2">
                <JsonUpload onLoad={handleJsonUpload} isLoading={isUploading} error={uploadError} />
              </div>
            </div>

            <JsonEditorOrExport data={data} onDataChange={updateData} />
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200/80 bg-white/70 py-6 text-sm text-slate-600 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-300">
        <div className="mx-auto w-full max-w-dashboard space-y-1 px-4 sm:px-6 lg:px-8">
          <p>
            Source: {data.meta.source} ({data.meta.sourceFile})
          </p>
          <p>
            Dashboard values are for campaign and reporting support. Verify official certified results with the NC
            State Board of Elections.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
