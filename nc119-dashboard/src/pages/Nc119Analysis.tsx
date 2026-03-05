import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { formatNumber, formatPercent, formatSignedPoints } from '../lib/format';
import { loadNc119Research } from '../lib/loadNc119Research';
import type { GeneralElectionContest, PrimaryContest } from '../types/nc119Research';

const data = loadNc119Research();

const ANALYSIS_TITLE = 'NC119 Election Analysis Dashboard';
const ANALYSIS_DESCRIPTION =
  'Data dashboard analyzing voter registration, primary election results, and general election baseline for North Carolina House District 119.';
const JSON_LD_ID = 'nc119-analysis-jsonld';

type PartyKey = Exclude<keyof typeof data.registration.byParty['2026']['totals'], 'Total'>;

interface CandidateRow {
  id: string;
  candidate: string;
  party: string;
  Jackson: number;
  Swain: number;
  Transylvania: number;
  NC119: number;
}

interface PrimaryOption {
  id: string;
  label: string;
  contest: PrimaryContest;
}

interface GeneralOption {
  id: string;
  label: string;
  contest: GeneralElectionContest;
}

interface Nc119AnalysisProps {
  theme: 'light' | 'dark';
}

const chartPalette = ['#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#64748b', '#10b981', '#7c3aed'];

const toCandidateRows = (contest: PrimaryContest | GeneralElectionContest): CandidateRow[] => {
  const democraticRows = contest.democraticCandidates.map((candidate) => ({
    id: `dem-${candidate.name}`,
    candidate: `${candidate.name} (D)`,
    party: 'Democratic',
    Jackson: candidate.votes.Jackson,
    Swain: candidate.votes.Swain,
    Transylvania: candidate.votes.Transylvania,
    NC119: candidate.votes.NC119,
  }));

  const republicanRows = contest.republicanCandidates.map((candidate) => ({
    id: `rep-${candidate.name}`,
    candidate: `${candidate.name} (R)`,
    party: 'Republican',
    Jackson: candidate.votes.Jackson,
    Swain: candidate.votes.Swain,
    Transylvania: candidate.votes.Transylvania,
    NC119: candidate.votes.NC119,
  }));

  return [...democraticRows, ...republicanRows].sort((a, b) => b.NC119 - a.NC119);
};

export const Nc119Analysis = ({ theme }: Nc119AnalysisProps) => {
  const axisTickColor = theme === 'dark' ? '#cbd5e1' : '#334155';
  const gridStroke = theme === 'dark' ? '#33415599' : '#94a3b840';
  const legendTextColor = theme === 'dark' ? '#e2e8f0' : '#334155';
  const activeStroke = theme === 'dark' ? '#f8fafc' : '#0f172a';

  const partyKeys = useMemo(
    () =>
      (Object.keys(data.registration.byParty['2026'].totals) as Array<keyof typeof data.registration.byParty['2026']['totals']>)
        .filter((key): key is PartyKey => key !== 'Total')
        .sort((left, right) =>
          data.registration.byParty['2026'].totals[right] - data.registration.byParty['2026'].totals[left],
        ),
    [],
  );

  const partyShareDonutRows = useMemo(
    () =>
      partyKeys.map((party) => ({
        party,
        pct2026: data.registration.byParty['2026'].percentOfTotal[party] * 100,
      })),
    [partyKeys],
  );

  const partyComparisonRows = useMemo(
    () =>
      partyKeys.map((party) => {
        const pct2024 = data.registration.byParty['2024'].percentOfTotal[party] * 100;
        const pct2026 = data.registration.byParty['2026'].percentOfTotal[party] * 100;

        return {
          party,
          pct2024,
          pct2026,
          change: pct2026 - pct2024,
        };
      }),
    [partyKeys],
  );

  const ethnicityRows = useMemo(
    () =>
      (['White', 'Black', 'Hispanic', 'Asian', 'Other'] as const).map((group) => ({
        group,
        total: data.registration.byEthnicity['2026'].totals[group],
      })),
    [],
  );

  const primaryOptions = useMemo<PrimaryOption[]>(
    () =>
      (['2026', '2024'] as const).flatMap((year) =>
        data.elections.primary[year].contests.map((contest) => ({
          id: `${year}-${contest.office}`,
          label: `${year} ${contest.office} Primary`,
          contest,
        })),
      ),
    [],
  );

  const [selectedPrimaryId, setSelectedPrimaryId] = useState(primaryOptions[0]?.id ?? '');

  const selectedPrimaryContest =
    primaryOptions.find((option) => option.id === selectedPrimaryId)?.contest ?? primaryOptions[0]?.contest;

  const primaryCandidateRows = useMemo(
    () => (selectedPrimaryContest ? toCandidateRows(selectedPrimaryContest) : []),
    [selectedPrimaryContest],
  );

  const generalOptions = useMemo<GeneralOption[]>(
    () =>
      data.elections.general['2024'].contests.map((contest) => ({
        id: `2024-${contest.office}`,
        label: contest.office,
        contest,
      })),
    [],
  );

  const [selectedGeneralId, setSelectedGeneralId] = useState(generalOptions[0]?.id ?? '');

  const selectedGeneralContest =
    generalOptions.find((option) => option.id === selectedGeneralId)?.contest ?? generalOptions[0]?.contest;

  const generalCandidateRows = useMemo(
    () => (selectedGeneralContest ? toCandidateRows(selectedGeneralContest) : []),
    [selectedGeneralContest],
  );

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = descriptionMeta?.getAttribute('content') ?? null;

    document.title = ANALYSIS_TITLE;

    let createdDescriptionMeta = false;

    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', ANALYSIS_DESCRIPTION);
    } else {
      const nextDescriptionMeta = document.createElement('meta');
      nextDescriptionMeta.name = 'description';
      nextDescriptionMeta.content = ANALYSIS_DESCRIPTION;
      document.head.appendChild(nextDescriptionMeta);
      createdDescriptionMeta = true;
    }

    const jsonLdUrl = window.location.href;
    const existingJsonLd = document.getElementById(JSON_LD_ID);
    if (existingJsonLd) {
      existingJsonLd.remove();
    }

    const jsonLdScript = document.createElement('script');
    jsonLdScript.id = JSON_LD_ID;
    jsonLdScript.type = 'application/ld+json';
    jsonLdScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: ANALYSIS_TITLE,
          description: ANALYSIS_DESCRIPTION,
          url: jsonLdUrl,
        },
        {
          '@type': 'Dataset',
          name: 'NC119 Voter and Election Result Analysis',
          description: ANALYSIS_DESCRIPTION,
          url: jsonLdUrl,
          dateModified: data.meta.ingestedOn,
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
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-200">
              Campaign Intelligence
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              NC119 Election Analysis Dashboard
            </h1>
            <p className="mt-3 text-base text-slate-700 dark:text-slate-200">
              Voter registration, primary performance, and 2024 general election baseline for NC House District 119.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Dataset</h2>
            <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Dataset ID</dt>
                <dd className="text-right">{data.meta.datasetId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Ingested</dt>
                <dd className="text-right">{data.meta.ingestedOn}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Source File</dt>
                <dd className="text-right">{data.meta.sourceFile}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      <section className="space-y-4" aria-labelledby="district-registration-overview">
        <SectionHeader
          id="district-registration-overview"
          title="District Registration Overview"
          subtitle="Party share in 2026 and change versus 2024 registration"
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Party Share (2026)</h3>
            <figure aria-label="Donut chart of 2026 party share" role="img" className="mt-4 h-64 w-full sm:h-72" tabIndex={0}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={partyShareDonutRows}
                    dataKey="pct2026"
                    nameKey="party"
                    innerRadius="52%"
                    outerRadius="82%"
                    paddingAngle={1}
                    stroke="none"
                  >
                    {partyShareDonutRows.map((row, index) => (
                      <Cell key={row.party} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Pie>
                  <Tooltip cursor={false} formatter={(value: number | string) => formatPercent(Number(value), 2)} />
                  <Legend wrapperStyle={{ color: legendTextColor, fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </figure>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Party Share Change (2024 vs 2026)</h3>
            <figure
              aria-label="Bar chart comparing 2024 and 2026 party registration share"
              role="img"
              className="mt-4 h-64 w-full sm:h-72"
              tabIndex={0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partyComparisonRows} margin={{ top: 16, right: 16, left: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="party"
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={68}
                    tick={{ fill: axisTickColor, fontSize: 12 }}
                  />
                  <YAxis unit="%" tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <Tooltip cursor={false} formatter={(value: number | string) => formatPercent(Number(value), 2)} />
                  <Legend wrapperStyle={{ color: legendTextColor, fontSize: '12px' }} />
                  <Bar
                    dataKey="pct2024"
                    name="2024"
                    fill="#475569"
                    radius={[6, 6, 0, 0]}
                    activeBar={{
                      fill: '#64748b',
                      fillOpacity: 0.95,
                      stroke: activeStroke,
                      strokeWidth: 1,
                    }}
                  />
                  <Bar
                    dataKey="pct2026"
                    name="2026"
                    fill="#059669"
                    radius={[6, 6, 0, 0]}
                    activeBar={{
                      fill: '#10b981',
                      fillOpacity: 0.95,
                      stroke: activeStroke,
                      strokeWidth: 1,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </figure>
          </Card>
        </div>

        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Party Detail</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Party
                  </th>
                  <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    2024
                  </th>
                  <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    2026
                  </th>
                  <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {partyComparisonRows.map((row) => (
                  <tr key={row.party} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.party}</td>
                    <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                      {formatPercent(row.pct2024)}
                    </td>
                    <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                      {formatPercent(row.pct2026)}
                    </td>
                    <td
                      className={`px-1 py-2 text-right text-sm font-semibold ${
                        row.change >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatSignedPoints(row.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="ethnicity-breakdown">
        <SectionHeader
          id="ethnicity-breakdown"
          title="Ethnicity Breakdown"
          subtitle="2026 registration totals and county-level breakdown"
        />

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">District Ethnicity Totals</h3>
            <figure
              aria-label="Horizontal bar chart for district ethnicity totals"
              role="img"
              className="mt-4 h-64 w-full sm:h-72"
              tabIndex={0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ethnicityRows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <YAxis type="category" dataKey="group" width={68} tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <Tooltip cursor={false} formatter={(value: number | string) => formatNumber(Number(value))} />
                  <Bar
                    dataKey="total"
                    name="Registered Voters"
                    fill="#0ea5e9"
                    radius={[0, 6, 6, 0]}
                    activeBar={{
                      fill: '#38bdf8',
                      fillOpacity: 0.95,
                      stroke: activeStroke,
                      strokeWidth: 1,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </figure>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">County Breakdown</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[44rem]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      County
                    </th>
                    {ethnicityRows.map((row) => (
                      <th
                        key={row.group}
                        className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      >
                        {row.group}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.registration.byEthnicity['2026'].byCounty.map((countyRow) => (
                    <tr key={countyRow.county} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{countyRow.county}</td>
                      {ethnicityRows.map((row) => (
                        <td key={`${countyRow.county}-${row.group}`} className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                          {formatNumber(countyRow[row.group])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="primary-results">
        <SectionHeader
          id="primary-results"
          title="Primary Results"
          subtitle="Candidate totals by selected primary contest"
        />

        <Card>
          <label htmlFor="primary-contest" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Select Primary Contest
          </label>
          <select
            id="primary-contest"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={selectedPrimaryId}
            onChange={(event) => setSelectedPrimaryId(event.target.value)}
          >
            {primaryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Candidate Vote Totals (NC119)</h3>
            <figure
              aria-label="Horizontal bar chart for selected primary candidate totals"
              role="img"
              className="mt-4 w-full"
              style={{ height: `${Math.max(280, primaryCandidateRows.length * 34)}px` }}
              tabIndex={0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={primaryCandidateRows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <YAxis type="category" dataKey="candidate" width={116} tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <Tooltip cursor={false} formatter={(value: number | string) => formatNumber(Number(value))} />
                  <Bar
                    dataKey="NC119"
                    name="NC119 Total"
                    fill="#8b5cf6"
                    radius={[0, 6, 6, 0]}
                    activeBar={{
                      fill: '#a78bfa',
                      fillOpacity: 0.95,
                      stroke: activeStroke,
                      strokeWidth: 1,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </figure>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">County + District Totals</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[42rem]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Candidate
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Jackson
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Swain
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Transylvania
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      NC119 Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {primaryCandidateRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.candidate}</td>
                      <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        {formatNumber(row.Jackson)}
                      </td>
                      <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        {formatNumber(row.Swain)}
                      </td>
                      <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        {formatNumber(row.Transylvania)}
                      </td>
                      <td className="px-1 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatNumber(row.NC119)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="general-baseline">
        <SectionHeader
          id="general-baseline"
          title="2024 General Election Baseline"
          subtitle="Candidate totals by selected 2024 general election contest"
        />

        <Card>
          <label htmlFor="general-contest" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Select General Election Contest
          </label>
          <select
            id="general-contest"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={selectedGeneralId}
            onChange={(event) => setSelectedGeneralId(event.target.value)}
          >
            {generalOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Candidate Vote Totals (NC119)</h3>
            <figure
              aria-label="Horizontal bar chart for selected general election candidate totals"
              role="img"
              className="mt-4 w-full"
              style={{ height: `${Math.max(220, generalCandidateRows.length * 42)}px` }}
              tabIndex={0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={generalCandidateRows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <YAxis type="category" dataKey="candidate" width={116} tick={{ fill: axisTickColor, fontSize: 12 }} />
                  <Tooltip cursor={false} formatter={(value: number | string) => formatNumber(Number(value))} />
                  <Bar
                    dataKey="NC119"
                    name="NC119 Total"
                    fill="#0ea5e9"
                    radius={[0, 6, 6, 0]}
                    activeBar={{
                      fill: '#38bdf8',
                      fillOpacity: 0.95,
                      stroke: activeStroke,
                      strokeWidth: 1,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </figure>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">County + District Totals</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[42rem]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Candidate
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Jackson
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Swain
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Transylvania
                    </th>
                    <th className="px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      NC119 Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {generalCandidateRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-1 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.candidate}</td>
                      <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        {formatNumber(row.Jackson)}
                      </td>
                      <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        {formatNumber(row.Swain)}
                      </td>
                      <td className="px-1 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        {formatNumber(row.Transylvania)}
                      </td>
                      <td className="px-1 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatNumber(row.NC119)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="dataset-attribution">
        <Card>
          <h2 id="dataset-attribution" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Dataset Attribution
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            Source dataset and analysis prepared by Chuck Gilmore for NC House District 119 campaign research. This
            dashboard page uses that dataset as an internal reference.
          </p>
        </Card>
      </section>
    </div>
  );
};
