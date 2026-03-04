import type { PropsWithChildren } from 'react';

interface CardProps extends PropsWithChildren {
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps) => {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-card backdrop-blur-sm transition-colors duration-300 dark:border-slate-700/80 dark:bg-slate-900/85 ${className}`}
    >
      {children}
    </section>
  );
};
