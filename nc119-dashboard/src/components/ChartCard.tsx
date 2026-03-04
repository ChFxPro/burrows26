import type { PropsWithChildren } from 'react';
import { Card } from './Card';

interface ChartCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  ariaLabel: string;
}

export const ChartCard = ({ title, description, ariaLabel, children }: ChartCardProps) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      <figure aria-label={ariaLabel} role="img" className="mt-4 h-64 w-full sm:h-72" tabIndex={0}>
        {children}
      </figure>
    </Card>
  );
};
