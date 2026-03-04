import { Card } from './Card';

interface StatTileProps {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}

export const StatTile = ({ label, value, note, accent = false }: StatTileProps) => {
  return (
    <Card
      className={`h-full ${
        accent
          ? 'border-brand-100 bg-gradient-to-br from-brand-50/95 to-white dark:border-brand-700 dark:from-brand-700/20 dark:to-slate-900'
          : ''
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
      {note ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{note}</p> : null}
    </Card>
  );
};
