import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';

// ─── Storage ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nc119-succession-v1';
const CERT_DEADLINE = new Date('2026-08-20T12:00:00');

// ─── Types ────────────────────────────────────────────────────────────────────

interface SituationStatus {
  clampittStatus: string;
  replacementNominee: string;
  raceStatus: string;
  strategicPosture: 'green' | 'yellow' | 'red';
  strategicPostureLabel: string;
}

type ScenarioStatus = 'active' | 'watching' | 'resolved';

interface Scenario {
  id: string;
  title: string;
  probability: number;
  implication: string;
  messageFrame: string;
  status: ScenarioStatus;
}

type ActionColumn = 'immediate' | 'thisWeek' | 'watching' | 'done';

interface ActionItem {
  id: string;
  title: string;
  owner: string;
  column: ActionColumn;
  notes: string;
}

type IntelConfidence = 'verified' | 'likely' | 'unverified';
type IntelTag = 'GOP Replacement' | 'Legal/Procedural' | 'County Intel' | 'Messaging' | 'Fundraising' | 'Field';

interface IntelEntry {
  id: string;
  date: string;
  source: string;
  confidence: IntelConfidence;
  text: string;
  tag: IntelTag;
}

interface CountyData {
  county: string;
  riskLevel: 'low' | 'medium' | 'high';
  persuasionLane: 'open' | 'narrowing' | 'closed';
  keyIntel: string;
  recommendedPosture: string;
}

interface SuccessionState {
  status: SituationStatus;
  scenarios: Scenario[];
  actions: ActionItem[];
  intel: IntelEntry[];
  counties: CountyData[];
}

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_STATE: SuccessionState = {
  status: {
    clampittStatus: 'Deceased — Post-Primary',
    replacementNominee: 'TBD',
    raceStatus: 'Open Seat — Pending GOP Selection',
    strategicPosture: 'green',
    strategicPostureLabel: 'Narrative Window Open',
  },
  scenarios: [
    {
      id: 'scenario-a',
      title: 'Scenario A: Primary Runner-Up Selected (Ferguson or Yow)',
      probability: 40,
      implication: 'Known profiles, weaker than Clampitt. Representation gap contrast sharpens.',
      messageFrame: '"Showing Up — 30 years vs. zero track record"',
      status: 'active',
    },
    {
      id: 'scenario-b',
      title: 'Scenario B: Establishment/Business Figure Selected',
      probability: 35,
      implication: 'Highest risk to persuasion lane. Moderate presentation could neutralize disruption narrative.',
      messageFrame: '"Stability comes from service, not connections"',
      status: 'active',
    },
    {
      id: 'scenario-c',
      title: 'Scenario C: Hard-Right Committee Pick',
      probability: 25,
      implication: 'Widens unaffiliated lane. Governance vs. chaos frame available.',
      messageFrame: '"Calm competence for Western NC"',
      status: 'active',
    },
  ],
  actions: [
    { id: 'action-1', title: 'Candidate public statement of condolence', owner: 'Mark', column: 'immediate', notes: '' },
    { id: 'action-2', title: "Verify and document Mark's Helene recovery role", owner: 'Jeff', column: 'immediate', notes: '' },
    { id: 'action-3', title: 'Begin digital narrative push on community presence', owner: 'Sean/Susan', column: 'thisWeek', notes: '' },
    { id: 'action-4', title: 'Monitor GOP committee composition and replacement signals', owner: 'David', column: 'watching', notes: '' },
    { id: 'action-5', title: 'Prepare three rapid-response messaging packages by replacement scenario', owner: 'Sean/Susan', column: 'thisWeek', notes: '' },
    { id: 'action-6', title: 'Accelerate fundraising outreach', owner: 'Mark', column: 'immediate', notes: '' },
  ],
  intel: [
    {
      id: 'intel-seed-1',
      date: '2026-03-18',
      source: 'NC General Statutes 163-114',
      confidence: 'verified',
      text: "Post-primary vacancy governed by GS 163-114. GOP District 119 executive committee may fill. Nominee must be certified at least 75 days before general election (on or around August 20, 2026). Ferguson and Yow are eligible — they appeared on the Republican ballot, not a different party's ballot.",
      tag: 'Legal/Procedural',
    },
  ],
  counties: [
    {
      county: 'Transylvania',
      riskLevel: 'medium',
      persuasionLane: 'open',
      keyIntel: '',
      recommendedPosture: 'Lead with stability and competent representation',
    },
    {
      county: 'Jackson',
      riskLevel: 'high',
      persuasionLane: 'open',
      keyIntel: 'Most likely committee battleground.',
      recommendedPosture: 'Community presence and economic development credibility',
    },
    {
      county: 'Swain',
      riskLevel: 'low',
      persuasionLane: 'closed',
      keyIntel: '',
      recommendedPosture: 'Quiet presence. Respect the loss. Do not campaign hard short-term.',
    },
  ],
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadStoredState(): SuccessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SuccessionState>;
    return {
      status: parsed.status ?? DEFAULT_STATE.status,
      scenarios: parsed.scenarios ?? DEFAULT_STATE.scenarios,
      actions: parsed.actions ?? DEFAULT_STATE.actions,
      intel: parsed.intel ?? DEFAULT_STATE.intel,
      counties: parsed.counties ?? DEFAULT_STATE.counties,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Inline helpers ───────────────────────────────────────────────────────────

const POSTURE_COLORS = {
  green: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-700/20 dark:text-brand-200 dark:border-brand-600/50',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-700/20 dark:text-amber-200 dark:border-amber-600/50',
  red: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-700/20 dark:text-rose-200 dark:border-rose-600/50',
};

const RISK_COLORS = {
  low: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-700/20 dark:text-brand-200 dark:border-brand-600/50',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-700/20 dark:text-amber-200 dark:border-amber-600/50',
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-700/20 dark:text-rose-200 dark:border-rose-600/50',
};

const LANE_COLORS = {
  open: 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-200',
  narrowing: 'bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-200',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
};

const CONFIDENCE_CONFIG: Record<IntelConfidence, { label: string; dot: string; badge: string }> = {
  verified: { label: 'Verified', dot: 'bg-brand-500', badge: 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-200' },
  likely: { label: 'Likely', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-200' },
  unverified: { label: 'Unverified', dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-700/20 dark:text-rose-200' },
};

const COLUMN_LABELS: Record<ActionColumn, string> = {
  immediate: 'Immediate (0–72 hrs)',
  thisWeek: 'This Week',
  watching: 'Watching',
  done: 'Done',
};

const COLUMN_BADGE: Record<ActionColumn, string> = {
  immediate: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-700/20 dark:text-rose-200 dark:border-rose-600/50',
  thisWeek: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-700/20 dark:text-amber-200 dark:border-amber-600/50',
  watching: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-700/20 dark:text-sky-200 dark:border-sky-600/50',
  done: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600/50',
};

const INTEL_TAGS: IntelTag[] = ['GOP Replacement', 'Legal/Procedural', 'County Intel', 'Messaging', 'Fundraising', 'Field'];

const SCENARIO_STATUS_LABELS: Record<ScenarioStatus, string> = {
  active: 'Active',
  watching: 'Watching',
  resolved: 'Resolved',
};

const SCENARIO_STATUS_COLORS: Record<ScenarioStatus, string> = {
  active: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-700/20 dark:text-brand-200 dark:border-brand-600/50',
  watching: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-700/20 dark:text-amber-200 dark:border-amber-600/50',
  resolved: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600/50',
};

// ─── Pencil Icon ──────────────────────────────────────────────────────────────

const PencilIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.428 11.132a.25.25 0 00-.064.108l-.618 2.159 2.158-.619a.25.25 0 00.108-.064L11.19 6.25z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
  </svg>
);

const ChevronDown = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M4.427 6.427a.75.75 0 011.066.02L8 9.01l2.507-2.563a.75.75 0 111.086 1.036l-3.05 3.117a.75.75 0 01-1.086 0L4.407 7.493a.75.75 0 01.02-1.066z" />
  </svg>
);

// ─── Inline input helpers ─────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-400';

const textareaClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-400 resize-y';

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-brand-400 dark:focus:ring-brand-400';

// ─── Probability normalization ────────────────────────────────────────────────

function redistributeProbability(scenarios: Scenario[], changedId: string, newValue: number): Scenario[] {
  const clamped = Math.max(0, Math.min(100, newValue));
  const others = scenarios.filter((s) => s.id !== changedId);
  const othersTotal = others.reduce((sum, s) => sum + s.probability, 0);
  const remaining = 100 - clamped;

  const updated: Scenario[] = scenarios.map((s) => {
    if (s.id === changedId) return { ...s, probability: clamped };
    if (othersTotal === 0) {
      return { ...s, probability: Math.round(remaining / others.length) };
    }
    return { ...s, probability: Math.round((s.probability / othersTotal) * remaining) };
  });

  // Fix rounding drift
  const total = updated.reduce((sum, s) => sum + s.probability, 0);
  const drift = 100 - total;
  if (drift !== 0) {
    const firstOther = updated.find((s) => s.id !== changedId);
    if (firstOther) firstOther.probability = Math.max(0, firstOther.probability + drift);
  }

  return updated;
}

// ─── Export helper ────────────────────────────────────────────────────────────

function buildExportText(state: SuccessionState): string {
  const now = new Date().toISOString();
  const lines: string[] = [
    `NC119 SUCCESSION SITUATION — EXPORT SNAPSHOT`,
    `Generated: ${now}`,
    ``,
    `=== SITUATION STATUS ===`,
    `Clampitt Status: ${state.status.clampittStatus}`,
    `Replacement Nominee: ${state.status.replacementNominee}`,
    `Race Status: ${state.status.raceStatus}`,
    `Strategic Posture: [${state.status.strategicPosture.toUpperCase()}] ${state.status.strategicPostureLabel}`,
    ``,
    `=== SCENARIOS ===`,
    ...state.scenarios.map(
      (s) =>
        `[${s.status.toUpperCase()} | ${s.probability}%] ${s.title}\n  Implication: ${s.implication}\n  Message Frame: ${s.messageFrame}`,
    ),
    ``,
    `=== ACTION ITEMS ===`,
    ...(['immediate', 'thisWeek', 'watching', 'done'] as ActionColumn[]).flatMap((col) => {
      const items = state.actions.filter((a) => a.column === col);
      if (items.length === 0) return [];
      return [`\n${COLUMN_LABELS[col]}:`, ...items.map((a) => `  [${a.owner}] ${a.title}${a.notes ? `\n    Notes: ${a.notes}` : ''}`)];
    }),
    ``,
    `=== INTELLIGENCE FEED ===`,
    ...state.intel.map(
      (e) => `[${e.date}] [${e.confidence.toUpperCase()}] [${e.tag}] ${e.source}\n  ${e.text}`,
    ),
    ``,
    `=== COUNTY WATCH ===`,
    ...state.counties.map(
      (c) =>
        `${c.county}: Risk=${c.riskLevel.toUpperCase()} | Persuasion Lane=${c.persuasionLane}\n  Posture: ${c.recommendedPosture}${c.keyIntel ? `\n  Intel: ${c.keyIntel}` : ''}`,
    ),
  ];

  return lines.join('\n');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const SuccessionSituation = () => {
  const initial = loadStoredState();

  const [statusData, setStatusData] = useState<SituationStatus>(initial.status);
  const [scenarios, setScenarios] = useState<Scenario[]>(initial.scenarios);
  const [actions, setActions] = useState<ActionItem[]>(initial.actions);
  const [intel, setIntel] = useState<IntelEntry[]>(initial.intel);
  const [counties, setCounties] = useState<CountyData[]>(initial.counties);

  // UI-only state (not persisted)
  const [statusEditMode, setStatusEditMode] = useState(false);
  const [openActionNotes, setOpenActionNotes] = useState<Set<string>>(new Set());
  const [intelFilter, setIntelFilter] = useState<IntelTag | 'all'>('all');
  const [intelConfFilter, setIntelConfFilter] = useState<IntelConfidence | 'all'>('all');
  const [showAddScenario, setShowAddScenario] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [showAddIntel, setShowAddIntel] = useState(false);
  const [countyEditIdx, setCountyEditIdx] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // New scenario form state
  const [newScenario, setNewScenario] = useState({ title: '', implication: '', messageFrame: '' });

  // New action form state
  const [newAction, setNewAction] = useState({ title: '', owner: '', column: 'immediate' as ActionColumn });

  // New intel form state
  const [newIntel, setNewIntel] = useState({
    date: todayIso(),
    source: '',
    confidence: 'likely' as IntelConfidence,
    text: '',
    tag: 'GOP Replacement' as IntelTag,
  });

  // Persist to localStorage on any state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: statusData, scenarios, actions, intel, counties }));
  }, [statusData, scenarios, actions, intel, counties]);

  const daysUntilDeadline = useMemo(() => {
    return Math.ceil((CERT_DEADLINE.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, []);

  const probTotal = useMemo(() => scenarios.reduce((sum, s) => sum + s.probability, 0), [scenarios]);

  const filteredIntel = useMemo(() => {
    return intel
      .filter((e) => intelFilter === 'all' || e.tag === intelFilter)
      .filter((e) => intelConfFilter === 'all' || e.confidence === intelConfFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [intel, intelFilter, intelConfFilter]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updateStatus = <K extends keyof SituationStatus>(key: K, value: SituationStatus[K]) => {
    setStatusData((prev) => ({ ...prev, [key]: value }));
  };

  const updateScenarioProbability = (id: string, value: number) => {
    setScenarios((prev) => redistributeProbability(prev, id, value));
  };

  const updateScenarioField = <K extends keyof Scenario>(id: string, key: K, value: Scenario[K]) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  };

  const addScenario = () => {
    if (!newScenario.title.trim()) return;
    const remaining = Math.max(0, 100 - probTotal);
    setScenarios((prev) => [
      ...prev,
      {
        id: uid(),
        title: newScenario.title.trim(),
        probability: Math.min(remaining, 10),
        implication: newScenario.implication.trim(),
        messageFrame: newScenario.messageFrame.trim(),
        status: 'watching',
      },
    ]);
    setNewScenario({ title: '', implication: '', messageFrame: '' });
    setShowAddScenario(false);
  };

  const removeScenario = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  const updateActionField = <K extends keyof ActionItem>(id: string, key: K, value: ActionItem[K]) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)));
  };

  const addAction = () => {
    if (!newAction.title.trim()) return;
    setActions((prev) => [
      ...prev,
      { id: uid(), title: newAction.title.trim(), owner: newAction.owner.trim(), column: newAction.column, notes: '' },
    ]);
    setNewAction({ title: '', owner: '', column: 'immediate' });
    setShowAddAction(false);
  };

  const removeAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleNotes = (id: string) => {
    setOpenActionNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addIntelEntry = () => {
    if (!newIntel.text.trim()) return;
    setIntel((prev) => [
      {
        id: uid(),
        date: newIntel.date,
        source: newIntel.source.trim(),
        confidence: newIntel.confidence,
        text: newIntel.text.trim(),
        tag: newIntel.tag,
      },
      ...prev,
    ]);
    setNewIntel({ date: todayIso(), source: '', confidence: 'likely', text: '', tag: 'GOP Replacement' });
    setShowAddIntel(false);
  };

  const removeIntel = (id: string) => {
    setIntel((prev) => prev.filter((e) => e.id !== id));
  };

  const updateCounty = <K extends keyof CountyData>(idx: number, key: K, value: CountyData[K]) => {
    setCounties((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  };

  const handleExport = () => {
    const text = buildExportText({ status: statusData, scenarios, actions, intel, counties });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `succession-snapshot-${todayIso()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Snapshot downloaded.');
    setTimeout(() => setExportMsg(null), 3000);
  };

  const handleReset = () => {
    setStatusData(DEFAULT_STATE.status);
    setScenarios(DEFAULT_STATE.scenarios);
    setActions(DEFAULT_STATE.actions);
    setIntel(DEFAULT_STATE.intel);
    setCounties(DEFAULT_STATE.counties);
    setShowResetConfirm(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <Card className="animate-fadeIn overflow-hidden bg-gradient-to-br from-slate-100 via-white to-brand-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-300">
              War Room — Internal Only
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Succession Situation
            </h1>
            <p className="mt-3 text-base text-slate-700 dark:text-slate-200">
              Post-Clampitt strategic environment tracker. Living intelligence — update as news breaks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-200"
            >
              Export Snapshot
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-rose-500 dark:hover:text-rose-300"
            >
              Reset to Defaults
            </button>
            {exportMsg ? (
              <span className="text-xs font-medium text-brand-600 dark:text-brand-300">{exportMsg}</span>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <Card className="max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reset to defaults?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This will erase all edits, custom scenarios, action items, intel entries, and county notes. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Yes, reset everything
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── SECTION 1: Situation Status Panel ── */}
      <section className="space-y-4" aria-labelledby="section-status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            id="section-status"
            title="Situation Status"
            subtitle="Live-updatable situation fields. Edit to reflect current intelligence."
          />
          <button
            type="button"
            onClick={() => setStatusEditMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              statusEditMode
                ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-700/20 dark:text-brand-200'
                : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-200'
            }`}
          >
            <PencilIcon />
            {statusEditMode ? 'Done Editing' : 'Edit Status'}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Clampitt Status */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-card backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Clampitt Status
            </p>
            {statusEditMode ? (
              <input
                type="text"
                value={statusData.clampittStatus}
                onChange={(e) => updateStatus('clampittStatus', e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            ) : (
              <p className="mt-2 text-sm font-semibold text-rose-600 dark:text-rose-300">{statusData.clampittStatus}</p>
            )}
          </div>

          {/* GOP Replacement Window */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-card backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              GOP Replacement Deadline
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {daysUntilDeadline}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              days until Aug 20, 2026 certification deadline
            </p>
          </div>

          {/* Replacement Nominee */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-card backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Replacement Nominee
            </p>
            {statusEditMode ? (
              <input
                type="text"
                value={statusData.replacementNominee}
                onChange={(e) => updateStatus('replacementNominee', e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {statusData.replacementNominee}
              </p>
            )}
          </div>

          {/* Race Status */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-card backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Race Status
            </p>
            {statusEditMode ? (
              <input
                type="text"
                value={statusData.raceStatus}
                onChange={(e) => updateStatus('raceStatus', e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{statusData.raceStatus}</p>
            )}
          </div>

          {/* Strategic Posture */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-card backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85 sm:col-span-2 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Strategic Posture
            </p>
            {statusEditMode ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <div className="flex gap-1.5">
                  {(['green', 'yellow', 'red'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateStatus('strategicPosture', c)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                        statusData.strategicPosture === c
                          ? POSTURE_COLORS[c] + ' ring-2 ring-offset-1'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={statusData.strategicPostureLabel}
                  onChange={(e) => updateStatus('strategicPostureLabel', e.target.value)}
                  placeholder="Posture label..."
                  className={`flex-1 min-w-40 ${inputClass}`}
                />
              </div>
            ) : (
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm font-semibold ${POSTURE_COLORS[statusData.strategicPosture]}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      statusData.strategicPosture === 'green'
                        ? 'bg-brand-500'
                        : statusData.strategicPosture === 'yellow'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                  />
                  {statusData.strategicPostureLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Scenario Tracker ── */}
      <section className="space-y-4" aria-labelledby="section-scenarios">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            id="section-scenarios"
            title="Scenario Tracker"
            subtitle="Adjust probability for each replacement scenario. Sliders auto-normalize to 100%."
          />
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                probTotal === 100
                  ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-600/50 dark:bg-brand-700/20 dark:text-brand-200'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-600/50 dark:bg-amber-700/20 dark:text-amber-200'
              }`}
            >
              Total: {probTotal}%{probTotal !== 100 ? ' ⚠' : ' ✓'}
            </span>
            <button
              type="button"
              onClick={() => setShowAddScenario((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-200"
            >
              <PlusIcon />
              Add Scenario
            </button>
          </div>
        </div>

        {showAddScenario ? (
          <Card className="border-dashed border-brand-300 dark:border-brand-600/50">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Scenario</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Title
                </label>
                <input
                  type="text"
                  value={newScenario.title}
                  onChange={(e) => setNewScenario((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Scenario title..."
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Key Implication
                </label>
                <input
                  type="text"
                  value={newScenario.implication}
                  onChange={(e) => setNewScenario((p) => ({ ...p, implication: e.target.value }))}
                  placeholder="Key strategic implication..."
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recommended Message Frame
                </label>
                <input
                  type="text"
                  value={newScenario.messageFrame}
                  onChange={(e) => setNewScenario((p) => ({ ...p, messageFrame: e.target.value }))}
                  placeholder="Message frame..."
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addScenario}
                  className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  <CheckIcon />
                  Add Scenario
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddScenario(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <Card
              key={scenario.id}
              className={`relative ${
                scenario.status === 'resolved' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100 pr-6">
                  {scenario.title}
                </h3>
                <button
                  type="button"
                  onClick={() => removeScenario(scenario.id)}
                  className="shrink-0 rounded p-0.5 text-slate-400 transition hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
                  aria-label="Remove scenario"
                >
                  <XIcon />
                </button>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Probability
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {scenario.probability}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={scenario.probability}
                  onChange={(e) => updateScenarioProbability(scenario.id, Number(e.target.value))}
                  className="mt-2 w-full accent-brand-600"
                />
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all dark:bg-brand-400"
                    style={{ width: `${scenario.probability}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Key Implication
                  </p>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">{scenario.implication}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Message Frame
                  </p>
                  <p className="mt-1 text-xs italic text-brand-700 dark:text-brand-300">{scenario.messageFrame}</p>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${SCENARIO_STATUS_COLORS[scenario.status]}`}>
                    {SCENARIO_STATUS_LABELS[scenario.status]}
                  </span>
                  <select
                    value={scenario.status}
                    onChange={(e) => updateScenarioField(scenario.id, 'status', e.target.value as ScenarioStatus)}
                    className={selectClass}
                    aria-label="Scenario status"
                  >
                    {(Object.keys(SCENARIO_STATUS_LABELS) as ScenarioStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {SCENARIO_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: Action Priority Tracker ── */}
      <section className="space-y-4" aria-labelledby="section-actions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            id="section-actions"
            title="Action Priority Tracker"
            subtitle="Move items between columns. Click notes to expand. Owner fields are always editable."
          />
          <button
            type="button"
            onClick={() => setShowAddAction((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-200"
          >
            <PlusIcon />
            Add Item
          </button>
        </div>

        {showAddAction ? (
          <Card className="border-dashed border-brand-300 dark:border-brand-600/50">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Action Item</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="text"
                value={newAction.title}
                onChange={(e) => setNewAction((p) => ({ ...p, title: e.target.value }))}
                placeholder="Action item title..."
                className={inputClass}
              />
              <input
                type="text"
                value={newAction.owner}
                onChange={(e) => setNewAction((p) => ({ ...p, owner: e.target.value }))}
                placeholder="Owner..."
                className={`w-28 ${inputClass}`}
              />
              <select
                value={newAction.column}
                onChange={(e) => setNewAction((p) => ({ ...p, column: e.target.value as ActionColumn }))}
                className={selectClass}
              >
                {(Object.keys(COLUMN_LABELS) as ActionColumn[]).map((col) => (
                  <option key={col} value={col}>
                    {COLUMN_LABELS[col]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={addAction}
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                <CheckIcon />
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddAction(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(['immediate', 'thisWeek', 'watching', 'done'] as ActionColumn[]).map((col) => {
            const items = actions.filter((a) => a.column === col);
            return (
              <div key={col} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {COLUMN_LABELS[col]}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-xl border border-slate-200/80 bg-white/85 p-3 shadow-card backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              col === 'done'
                                ? 'text-slate-400 line-through dark:text-slate-500'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {action.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="shrink-0 rounded p-0.5 text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
                          aria-label="Remove action"
                        >
                          <XIcon />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${COLUMN_BADGE[col]}`}>
                          {col === 'immediate' ? 'Now' : col === 'thisWeek' ? 'This Week' : col === 'watching' ? 'Watch' : 'Done'}
                        </span>
                        <input
                          type="text"
                          value={action.owner}
                          onChange={(e) => updateActionField(action.id, 'owner', e.target.value)}
                          placeholder="Owner"
                          className="w-20 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          aria-label="Owner"
                        />
                        <select
                          value={action.column}
                          onChange={(e) => updateActionField(action.id, 'column', e.target.value as ActionColumn)}
                          className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs text-slate-600 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          aria-label="Move to column"
                        >
                          {(Object.keys(COLUMN_LABELS) as ActionColumn[]).map((c) => (
                            <option key={c} value={c}>
                              {c === 'immediate' ? 'Immediate' : c === 'thisWeek' ? 'This Week' : c === 'watching' ? 'Watching' : 'Done'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleNotes(action.id)}
                        className="mt-2 flex items-center gap-1 text-xs text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
                      >
                        <ChevronDown />
                        {openActionNotes.has(action.id) ? 'Hide notes' : 'Notes'}
                      </button>

                      {openActionNotes.has(action.id) ? (
                        <textarea
                          value={action.notes}
                          onChange={(e) => updateActionField(action.id, 'notes', e.target.value)}
                          placeholder="Add notes..."
                          rows={3}
                          className={`mt-2 ${textareaClass}`}
                        />
                      ) : null}
                    </div>
                  ))}

                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                      No items
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 4: Intelligence Feed ── */}
      <section className="space-y-4" aria-labelledby="section-intel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            id="section-intel"
            title="Intelligence Feed"
            subtitle="Chronological log of incoming intelligence. Add entries as news breaks."
          />
          <button
            type="button"
            onClick={() => setShowAddIntel((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-200"
          >
            <PlusIcon />
            Add Entry
          </button>
        </div>

        {showAddIntel ? (
          <Card className="border-dashed border-brand-300 dark:border-brand-600/50">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Intelligence Entry</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Date</label>
                <input
                  type="date"
                  value={newIntel.date}
                  onChange={(e) => setNewIntel((p) => ({ ...p, date: e.target.value }))}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Source</label>
                <input
                  type="text"
                  value={newIntel.source}
                  onChange={(e) => setNewIntel((p) => ({ ...p, source: e.target.value }))}
                  placeholder="e.g. Smoky Mountain News, NCSBE, Internal"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confidence</label>
                <select
                  value={newIntel.confidence}
                  onChange={(e) => setNewIntel((p) => ({ ...p, confidence: e.target.value as IntelConfidence }))}
                  className={`mt-1 w-full ${selectClass}`}
                >
                  <option value="verified">Verified</option>
                  <option value="likely">Likely</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tag</label>
                <select
                  value={newIntel.tag}
                  onChange={(e) => setNewIntel((p) => ({ ...p, tag: e.target.value as IntelTag }))}
                  className={`mt-1 w-full ${selectClass}`}
                >
                  {INTEL_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Entry</label>
                <textarea
                  value={newIntel.text}
                  onChange={(e) => setNewIntel((p) => ({ ...p, text: e.target.value }))}
                  placeholder="Intelligence details..."
                  rows={3}
                  className={`mt-1 ${textareaClass}`}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={addIntelEntry}
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                <CheckIcon />
                Add Entry
              </button>
              <button
                type="button"
                onClick={() => setShowAddIntel(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tag:</span>
              <select
                value={intelFilter}
                onChange={(e) => setIntelFilter(e.target.value as IntelTag | 'all')}
                className={selectClass}
              >
                <option value="all">All Tags</option>
                {INTEL_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confidence:</span>
              <select
                value={intelConfFilter}
                onChange={(e) => setIntelConfFilter(e.target.value as IntelConfidence | 'all')}
                className={selectClass}
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="likely">Likely</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {filteredIntel.length} {filteredIntel.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {filteredIntel.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No entries match the current filter.</p>
          ) : (
            <ol className="mt-4 space-y-4" reversed>
              {filteredIntel.map((entry) => {
                const conf = CONFIDENCE_CONFIG[entry.confidence];
                return (
                  <li
                    key={entry.id}
                    className="relative pl-5 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-slate-300 dark:before:bg-slate-600"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <time dateTime={entry.date} className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          {entry.date}
                        </time>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{entry.source}</span>
                        <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${conf.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                          {conf.label}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {entry.tag}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIntel(entry.id)}
                        className="shrink-0 rounded p-0.5 text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
                        aria-label="Remove entry"
                      >
                        <XIcon />
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{entry.text}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </section>

      {/* ── SECTION 5: County Watch Panel ── */}
      <section className="space-y-4" aria-labelledby="section-counties">
        <SectionHeader
          id="section-counties"
          title="County Watch"
          subtitle="Replacement risk and persuasion lane status by county. Click the pencil to edit."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {counties.map((county, idx) => (
            <Card key={county.county}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{county.county}</h3>
                <button
                  type="button"
                  onClick={() => setCountyEditIdx(countyEditIdx === idx ? null : idx)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition ${
                    countyEditIdx === idx
                      ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-700/20 dark:text-brand-200'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-200'
                  }`}
                  aria-label={`Edit ${county.county}`}
                >
                  <PencilIcon />
                  {countyEditIdx === idx ? 'Done' : 'Edit'}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {countyEditIdx === idx ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Replacement Risk</p>
                      <div className="mt-1 flex gap-1">
                        {(['low', 'medium', 'high'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => updateCounty(idx, 'riskLevel', r)}
                            className={`rounded border px-2 py-0.5 text-xs font-semibold transition ${
                              county.riskLevel === r
                                ? RISK_COLORS[r]
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Persuasion Lane</p>
                      <div className="mt-1 flex gap-1">
                        {(['open', 'narrowing', 'closed'] as const).map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => updateCounty(idx, 'persuasionLane', l)}
                            className={`rounded px-2 py-0.5 text-xs font-semibold transition ${
                              county.persuasionLane === l
                                ? LANE_COLORS[l]
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                          >
                            {l.charAt(0).toUpperCase() + l.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${RISK_COLORS[county.riskLevel]}`}>
                      Risk: {county.riskLevel.charAt(0).toUpperCase() + county.riskLevel.slice(1)}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LANE_COLORS[county.persuasionLane]}`}>
                      Lane: {county.persuasionLane.charAt(0).toUpperCase() + county.persuasionLane.slice(1)}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Recommended Posture
                  </p>
                  {countyEditIdx === idx ? (
                    <textarea
                      value={county.recommendedPosture}
                      onChange={(e) => updateCounty(idx, 'recommendedPosture', e.target.value)}
                      rows={2}
                      className={`mt-1 ${textareaClass}`}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{county.recommendedPosture}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Key Intel
                  </p>
                  {countyEditIdx === idx ? (
                    <textarea
                      value={county.keyIntel}
                      onChange={(e) => updateCounty(idx, 'keyIntel', e.target.value)}
                      placeholder="Latest county-specific notes..."
                      rows={2}
                      className={`mt-1 ${textareaClass}`}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {county.keyIntel || <span className="italic text-slate-400 dark:text-slate-500">No intel logged.</span>}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
